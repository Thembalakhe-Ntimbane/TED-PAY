"""TED Pay — ZAR → USDT merchant/payer payments on the Tether Testnet (Flask)."""
from __future__ import annotations

import base64, hashlib, hmac, io, json, math, os, secrets, struct, time, uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from urllib.parse import quote

from flask import (Flask, Response, abort, g, jsonify, redirect, render_template,
                   request, session, url_for)
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

import config, db as dbm, i18n, ledger, pdfgen, rates
from seed import seed

SAST = timezone(timedelta(hours=2))  # South Africa has no DST
app = Flask(__name__, instance_path=str(config.INSTANCE))
app.config.update(SECRET_KEY=config.SECRET_KEY, SESSION_COOKIE_HTTPONLY=True,
                  SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_SECURE=config.COOKIE_SECURE,
                  MAX_CONTENT_LENGTH=30 * 1024 * 1024)
serializer = URLSafeTimedSerializer(config.SECRET_KEY, salt="pw-reset")


# ───────────────────────── helpers ─────────────────────────
def get_db():
    return dbm.get_db()


@app.teardown_appcontext
def _close(_):
    d = g.pop("db", None)
    if d:
        d.close()


def now() -> float:
    return time.time()


def zar(cents) -> str:
    return "R {:,.2f}".format((cents or 0) / 100)


def usdt(micro) -> str:
    return "{:,.2f}".format((micro or 0) / ledger.USDT)


def stamp(ts) -> str:
    d = datetime.fromtimestamp(ts, SAST)
    n = datetime.now(SAST)
    if d.date() == n.date():
        return "Today, " + d.strftime("%H:%M")
    if d.date() == (n - timedelta(days=1)).date():
        return "Yesterday, " + d.strftime("%H:%M")
    return d.strftime("%d %b, %H:%M")


def full_stamp(ts) -> str:
    return datetime.fromtimestamp(ts, SAST).strftime("%d %b %Y %H:%M:%S SAST")


app.jinja_env.filters.update(zar=zar, usdt=usdt, stamp=stamp,
                             short=lambda a: (a[:8] + "…" + a[-6:]) if a else "")

STATUS_LABEL = {"pending": "Pending", "processing": "Pending", "completed": "Completed",
                "failed": "Failed", "expired": "Failed", "refunding": "Refund pending",
                "refunded": "Refunded", "cancelled": "Cancelled"}
STATUS_CLASS = {"Pending": "warn", "Completed": "ok", "Failed": "bad",
                "Refund pending": "warn", "Refunded": "blue", "Cancelled": "bad"}


def label(status):
    return STATUS_LABEL.get(status, status)


def cur(role: str):
    uid = session.get("m" if role == "merchant" else "p")
    if not uid:
        return None
    return get_db().execute(
        "SELECT u.*, m.business_name, m.reg_no, m.business_email, m.country, m.city, m.merchant_code, m.kyc_status "
        "FROM users u LEFT JOIN merchants m ON m.user_id=u.id WHERE u.id=? AND u.role=?", (uid, role)).fetchone()


def login_required(role: str):
    def deco(fn):
        @wraps(fn)
        def w(*a, **k):
            u = cur(role)
            if not u:
                if "/api/" in request.path:
                    return jsonify(error="Not signed in"), 401
                if role == "merchant":
                    return redirect(url_for("landing"))
                return redirect(url_for("payer_login", next=request.path))
            g.user = u
            return fn(*a, **k)
        return w
    return deco


merchant_required = login_required("merchant")
payer_required = login_required("payer")


@app.context_processor
def ctx():
    lang = session.get("lang", "en")
    return dict(t=lambda k: i18n.t(k, lang), lang=lang, STATUS_CLASS=STATUS_CLASS, label=label,
                network=config.NETWORK_NAME, ttl=config.QUOTE_TTL)


def reconcile() -> None:
    """Merchant Confirmation Broker: derive every payment status from the LEDGER only."""
    d = get_db()
    ledger.sync(d)
    t = now()
    d.execute("""UPDATE payments SET status='completed',
                 completed_at=(SELECT confirm_at FROM chain WHERE hash=payments.tx_hash)
                 WHERE status='processing' AND tx_hash IN (SELECT hash FROM chain WHERE status='confirmed')""")
    d.execute("""UPDATE payments SET status='refunded'
                 WHERE status='refunding' AND refund_tx IN (SELECT hash FROM chain WHERE status='confirmed')""")
    d.execute("UPDATE payments SET status='expired' WHERE status='pending' AND expires_at<?", (t,))
    d.commit()


def payment_for(pid, uid=None, role=None):
    reconcile()
    p = get_db().execute("SELECT * FROM payments WHERE id=?", (pid,)).fetchone()
    if not p:
        return None
    if role == "merchant" and p["merchant_id"] != uid:
        return None
    return p


def merchant_of(p):
    return get_db().execute("SELECT u.*, m.* FROM users u JOIN merchants m ON m.user_id=u.id WHERE u.id=?",
                            (p["merchant_id"],)).fetchone()


def status_payload(p):
    return dict(status=p["status"], label=label(p["status"]), tx_hash=p["tx_hash"], ref=p["ref"],
                seconds_left=max(0, round(p["expires_at"] - now(), 1)) if p["status"] == "pending" else 0)


# ───────────────────────── TOTP (2FA) ─────────────────────────
def totp_now(secret: str, t: float | None = None) -> str:
    key = base64.b32decode(secret)
    ctr = struct.pack(">Q", int((t or now()) // 30))
    h = hmac.new(key, ctr, hashlib.sha1).digest()
    o = h[-1] & 15
    return "%06d" % ((struct.unpack(">I", h[o:o + 4])[0] & 0x7FFFFFFF) % 10**6)


def totp_ok(secret: str, code: str) -> bool:
    code = (code or "").strip()
    return any(hmac.compare_digest(totp_now(secret, now() + off * 30), code) for off in (-1, 0, 1))


# ───────────────────────── public / auth ─────────────────────────
@app.get("/")
def landing(error=None, need_code=False, email=""):
    return render_template("landing.html", error=error, need_code=need_code, email=email)


@app.post("/merchant/login")
def merchant_login():
    email = request.form.get("email", "").strip().lower()
    pw = request.form.get("password", "")
    u = get_db().execute("SELECT * FROM users WHERE role='merchant' AND email=?", (email,)).fetchone()
    if not u or not check_password_hash(u["pw_hash"], pw):
        return landing(error="Incorrect email or password.", email=email), 401
    if u["totp_enabled"] and not totp_ok(u["totp_secret"], request.form.get("code", "")):
        return landing(error="Enter the 6-digit code from your authenticator app." if not request.form.get("code")
                       else "That code is not valid.", need_code=True, email=email), 401
    session["m"] = u["id"]
    session["lang"] = u["lang"] or "en"
    return redirect(url_for("pos"))


@app.get("/merchant/logout")
def merchant_logout():
    session.pop("m", None)
    return redirect(url_for("landing"))


@app.get("/merchant/register")
def merchant_register_page():
    return render_template("register.html")


def _pw_problem(pw: str):
    if len(pw) < 12:
        return "Password must be at least 12 characters."
    if not any(c.isdigit() for c in pw) or not any(not c.isalnum() for c in pw):
        return "Password needs a number and a symbol."
    return None


@app.post("/merchant/register")
def merchant_register():
    f = request.form
    d = get_db()
    name, reg, email = f.get("business_name", "").strip(), f.get("reg_no", "").strip(), f.get("business_email", "").strip().lower()
    pw = f.get("password", "")
    if not (name and reg and "@" in email):
        return jsonify(error="Please complete your business details.", step=1), 400
    if not all(request.files.get(k) and request.files[k].filename for k in ("cipc", "iddoc", "selfie")):
        return jsonify(error="Please add all three verification items.", step=2), 400
    if _pw_problem(pw) or pw != f.get("confirm", ""):
        return jsonify(error=_pw_problem(pw) or "Passwords do not match.", step=3), 400
    if d.execute("SELECT 1 FROM users WHERE role='merchant' AND email=?", (email,)).fetchone():
        return jsonify(error="A merchant with this email already exists.", step=1), 400
    uid = str(uuid.uuid4())
    code = "MCH-" + secrets.token_hex(3).upper()
    secret = base64.b32encode(secrets.token_bytes(10)).decode() if f.get("tfa") else None
    d.execute("INSERT INTO users(id,role,email,pw_hash,name,wallet,totp_secret,created_at) VALUES(?,?,?,?,?,?,?,?)",
              (uid, "merchant", email, generate_password_hash(pw), f.get("owner_name", "").strip() or name,
               ledger.new_address(), secret, now()))
    d.execute("INSERT INTO merchants VALUES(?,?,?,?,?,?,?,?)",
              (uid, name, reg, email, f.get("country", "South Africa"), f.get("city", "Cape Town"), code, "verified"))
    d.commit()
    kyc = config.INSTANCE / "kyc" / uid
    kyc.mkdir(parents=True, exist_ok=True)
    for k in ("cipc", "iddoc", "selfie"):
        fl = request.files[k]
        fl.save(kyc / f"{k}_{secure_filename(fl.filename)}")
    session["m"] = uid
    return jsonify(ok=True, redirect=url_for("security") if secret else url_for("pos"))


@app.route("/forgot", methods=["GET", "POST"])
def forgot():
    role = request.values.get("role", "merchant")
    link = None
    sent = False
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        u = get_db().execute("SELECT * FROM users WHERE role=? AND email=?", (role, email)).fetchone()
        sent = True
        if u:
            tok = serializer.dumps({"id": u["id"], "h": u["pw_hash"][-12:]})
            url = request.host_url.rstrip("/") + url_for("reset", token=tok)
            print(f"[TED Pay] password reset link for {email}: {url}")
            if config.DEV_SHOW_RESET_LINK:
                link = url
    return render_template("forgot.html", role=role, sent=sent, link=link)


@app.route("/reset/<token>", methods=["GET", "POST"])
def reset(token):
    try:
        data = serializer.loads(token, max_age=3600)
    except (BadSignature, SignatureExpired):
        return render_template("reset.html", bad=True)
    d = get_db()
    u = d.execute("SELECT * FROM users WHERE id=?", (data["id"],)).fetchone()
    if not u or u["pw_hash"][-12:] != data["h"]:
        return render_template("reset.html", bad=True)
    err = None
    if request.method == "POST":
        pw = request.form.get("password", "")
        err = _pw_problem(pw) if u["role"] == "merchant" else (None if len(pw) >= 8 else "Use at least 8 characters.")
        if not err and pw != request.form.get("confirm"):
            err = "Passwords do not match."
        if not err:
            d.execute("UPDATE users SET pw_hash=? WHERE id=?", (generate_password_hash(pw), u["id"]))
            d.commit()
            return redirect(url_for("landing") if u["role"] == "merchant" else url_for("payer_login"))
    return render_template("reset.html", bad=False, err=err)


@app.get("/lang/<code>")
def set_lang(code):
    if code in i18n.CODES:
        session["lang"] = code
        for role, key in (("merchant", "m"), ("payer", "p")):
            if session.get(key):
                get_db().execute("UPDATE users SET lang=? WHERE id=?", (code, session[key]))
                get_db().commit()
    return redirect(request.referrer or url_for("landing"))


# ───────────────────────── merchant portal ─────────────────────────
@app.get("/merchant")
@merchant_required
def pos():
    return render_template("pos.html", u=g.user, active="payments")


@app.post("/merchant/api/request")
@merchant_required
def create_request():
    cents = int(request.get_json(force=True).get("zar", 0)) * 100
    if not (100 <= cents <= 99_999_900):
        return jsonify(error="Enter an amount between R1 and R999,999."), 400
    rate, src = rates.get_rate()
    micro = max(10_000, int(round(round(cents / 100 / rate, 2) * ledger.USDT)))
    pid, t = str(uuid.uuid4()), now()
    d = get_db()
    d.execute("UPDATE payments SET status='cancelled' WHERE merchant_id=? AND status='pending'", (g.user["id"],))
    n = d.execute("SELECT COUNT(*) FROM payments").fetchone()[0] + 1
    meta = json.dumps({"tx_uuid": pid, "merchant_id": g.user["merchant_code"], "timestamp": t,
                       "rate": rate, "zar": cents / 100, "rate_source": src})
    d.execute("INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
              (pid, f"TED-{1000+n}", g.user["id"], cents, rate, micro, t, t + config.QUOTE_TTL,
               "pending", None, None, None, meta, None))
    d.commit()
    return jsonify(id=pid, url=url_for("request_screen", pid=pid))


@app.get("/merchant/request/<pid>")
@merchant_required
def request_screen(pid):
    p = payment_for(pid, g.user["id"], "merchant")
    if not p:
        abort(404)
    link = request.host_url.rstrip("/") + url_for("checkout", pid=pid)
    return render_template("request.html", u=g.user, p=p, link=link, active="payments",
                           left=max(0, p["expires_at"] - now()), rate_src=json.loads(p["meta"]).get("rate_source", ""))


@app.get("/merchant/api/payment/<pid>/status")
@merchant_required
def merchant_status(pid):
    p = payment_for(pid, g.user["id"], "merchant")
    if not p:
        return jsonify(error="Not found"), 404
    return jsonify(status_payload(p))


@app.post("/merchant/api/payment/<pid>/cancel")
@merchant_required
def cancel(pid):
    get_db().execute("UPDATE payments SET status='cancelled' WHERE id=? AND merchant_id=? AND status='pending'",
                     (pid, g.user["id"]))
    get_db().commit()
    return jsonify(ok=True)


@app.get("/merchant/transactions")
@merchant_required
def transactions():
    reconcile()
    d = get_db()
    rows = d.execute("""SELECT p.*, u.name AS payer_name FROM payments p LEFT JOIN users u ON u.id=p.payer_id
                        WHERE p.merchant_id=? AND p.status NOT IN('cancelled')
                        ORDER BY p.created_at DESC LIMIT 100""", (g.user["id"],)).fetchall()
    bal = ledger.balance(d, g.user["wallet"])
    return render_template("transactions.html", u=g.user, rows=rows, bal=bal, active="transactions")


@app.post("/merchant/api/refund/<pid>")
@merchant_required
def refund(pid):
    p = payment_for(pid, g.user["id"], "merchant")
    d = get_db()
    if not p or p["status"] != "completed" or not p["payer_id"]:
        return jsonify(error="Only completed payments can be refunded."), 400
    payer = d.execute("SELECT wallet FROM users WHERE id=?", (p["payer_id"],)).fetchone()
    sender = d.execute("SELECT from_addr FROM chain WHERE hash=?", (p["tx_hash"],)).fetchone()["from_addr"]
    memo = json.dumps({"refund_of": p["tx_hash"], "payment": p["id"], "ref": p["ref"], "merchant_id": g.user["merchant_code"]})
    try:
        h = ledger.submit(d, g.user["wallet"], sender or payer["wallet"], p["usdt_micro"], memo)
    except ledger.LedgerError as e:
        return jsonify(error=str(e)), 400
    d.execute("UPDATE payments SET status='refunding', refund_tx=? WHERE id=?", (h, pid))
    d.commit()
    return jsonify(ok=True, tx=h)


def build_analytics(mid):
    d = get_db()
    today = datetime.now(SAST).date()
    days = [today - timedelta(days=i) for i in range(6, -1, -1)]
    tot = {x: 0 for x in days}
    cnt = {x: 0 for x in days}
    hours: dict[int, int] = {}
    prev = 0
    usdt_total = 0
    for r in d.execute("SELECT zar_cents, usdt_micro, completed_at FROM payments WHERE merchant_id=? AND status='completed' "
                       "AND completed_at IS NOT NULL", (mid,)):
        dt = datetime.fromtimestamp(r["completed_at"], SAST)
        if dt.date() in tot:
            tot[dt.date()] += r["zar_cents"]
            cnt[dt.date()] += 1
            usdt_total += r["usdt_micro"]
            hours[dt.hour] = hours.get(dt.hour, 0) + 1
        elif today - timedelta(days=14) < dt.date() <= today - timedelta(days=7):
            prev += r["zar_cents"]
    total = sum(tot.values())
    count = sum(cnt.values())
    pct = None if not prev else round((total - prev) / prev * 100, 1)
    best = max(days, key=lambda x: tot[x])
    insights = []
    if count:
        insights.append(f"{best.strftime('%A')} was your strongest day with {zar(tot[best])}.")
        insights.append(f"Average sale is {zar(total // count)} across {count} payments.")
        if hours:
            ph = max(hours, key=hours.get)
            insights.append(f"Peak trading hour is {ph:02d}:00–{ph+1:02d}:00 — make sure staff are ready to take payments then.")
        if pct is not None:
            insights.append(f"Sales are {'up' if pct >= 0 else 'down'} {abs(pct)}% versus the previous week.")
        slow = min(days, key=lambda x: tot[x])
        insights.append(f"{slow.strftime('%A')} is your quietest day — a lunch special could help.")
    else:
        insights.append("Take your first payment to unlock weekly insights.")
    return dict(days=[dict(label=x.strftime("%a"), date=x.strftime("%d %b"), cents=tot[x], n=cnt[x]) for x in days],
                total=total, count=count, pct=pct, prev=prev, usdt=usdt_total, insights=insights,
                avg=(total // count if count else 0), best=best.strftime("%A") if count else "—")


@app.get("/merchant/analytics")
@merchant_required
def analytics():
    reconcile()
    return render_template("analytics.html", u=g.user, a=build_analytics(g.user["id"]), active="analytics")


@app.get("/merchant/settings")
@merchant_required
def settings():
    return render_template("settings.html", u=g.user, active="settings", langs1=i18n.LANGS_PRIMARY,
                           langs2=i18n.LANGS_OTHER, bal=ledger.balance(get_db(), g.user["wallet"]), msg=request.args.get("msg"))


@app.post("/merchant/settings/profile")
@merchant_required
def save_profile():
    f = request.form
    d = get_db()
    d.execute("UPDATE merchants SET business_name=?, business_email=?, city=? WHERE user_id=?",
              (f.get("business_name", "").strip() or g.user["business_name"], f.get("business_email", "").strip(),
               f.get("city", "").strip(), g.user["id"]))
    d.execute("UPDATE users SET name=? WHERE id=?", (f.get("name", "").strip() or g.user["name"], g.user["id"]))
    d.commit()
    return redirect(url_for("settings", msg="Profile saved."))


@app.route("/merchant/security", methods=["GET", "POST"])
@merchant_required
def security():
    d = get_db()
    msg = err = None
    u = g.user
    if request.method == "POST":
        act = request.form.get("action")
        if act == "password":
            if not check_password_hash(u["pw_hash"], request.form.get("current", "")):
                err = "Current password is incorrect."
            elif _pw_problem(request.form.get("new", "")):
                err = _pw_problem(request.form["new"])
            else:
                d.execute("UPDATE users SET pw_hash=? WHERE id=?", (generate_password_hash(request.form["new"]), u["id"]))
                msg = "Password updated."
        elif act == "enable2fa":
            if totp_ok(u["totp_secret"], request.form.get("code", "")):
                d.execute("UPDATE users SET totp_enabled=1 WHERE id=?", (u["id"],))
                msg = "Two-factor authentication is on."
            else:
                err = "That code is not valid. Try the current code from your app."
        elif act == "start2fa":
            d.execute("UPDATE users SET totp_secret=?, totp_enabled=0 WHERE id=?",
                      (base64.b32encode(secrets.token_bytes(10)).decode(), u["id"]))
        elif act == "disable2fa":
            if totp_ok(u["totp_secret"], request.form.get("code", "")):
                d.execute("UPDATE users SET totp_enabled=0, totp_secret=NULL WHERE id=?", (u["id"],))
                msg = "Two-factor authentication is off."
            else:
                err = "Enter a valid code to turn 2FA off."
        d.commit()
        u = cur("merchant")
    uri = None
    if u["totp_secret"]:
        uri = f"otpauth://totp/TED%20Pay:{quote(u['email'])}?secret={u['totp_secret']}&issuer=TED%20Pay"
    return render_template("security.html", u=u, active="settings", msg=msg, err=err, otp_uri=uri)


@app.get("/qr")
def qr():
    data = request.args.get("d", "")
    try:
        import segno
        buf = io.BytesIO()
        segno.make(data, error="m").save(buf, kind="svg", scale=6, border=2, dark="#111111", xmldecl=False,
                                         svgns=True, nl=False)
        return Response(buf.getvalue(), mimetype="image/svg+xml")
    except ImportError:
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/>'
               '<text x="100" y="95" text-anchor="middle" font-size="11" font-family="sans-serif">QR needs the</text>'
               '<text x="100" y="112" text-anchor="middle" font-size="11" font-family="sans-serif">“segno” package</text></svg>')
        return Response(svg, mimetype="image/svg+xml")


# ───────────────────────── payer portal ─────────────────────────
@app.get("/payer/login")
def payer_login(error=None, email=""):
    return render_template("payer_auth.html", mode="login", error=error, email=email, nxt=request.args.get("next", ""))


@app.post("/payer/login")
def payer_login_post():
    email = request.form.get("email", "").strip().lower()
    u = get_db().execute("SELECT * FROM users WHERE role='payer' AND email=?", (email,)).fetchone()
    if not u or not check_password_hash(u["pw_hash"], request.form.get("password", "")):
        return render_template("payer_auth.html", mode="login", error="Incorrect email or password.", email=email,
                               nxt=request.form.get("next", "")), 401
    session["p"] = u["id"]
    session["lang"] = u["lang"] or session.get("lang", "en")
    nxt = request.form.get("next", "")
    return redirect(nxt if nxt.startswith("/") and not nxt.startswith("//") else url_for("payer_home"))


@app.route("/payer/register", methods=["GET", "POST"])
def payer_register():
    err = None
    f = request.form
    if request.method == "POST":
        email, pw, pin = f.get("email", "").strip().lower(), f.get("password", ""), f.get("pin", "")
        d = get_db()
        if not f.get("name", "").strip() or "@" not in email:
            err = "Enter your name and a valid email."
        elif len(pw) < 8:
            err = "Password must be at least 8 characters."
        elif not (pin.isdigit() and 4 <= len(pin) <= 6):
            err = "Payment PIN must be 4–6 digits."
        elif d.execute("SELECT 1 FROM users WHERE role='payer' AND email=?", (email,)).fetchone():
            err = "An account with this email already exists."
        else:
            uid, w = str(uuid.uuid4()), ledger.new_address()
            d.execute("INSERT INTO users(id,role,email,pw_hash,name,pin_hash,wallet,created_at) VALUES(?,?,?,?,?,?,?,?)",
                      (uid, "payer", email, generate_password_hash(pw), f["name"].strip(), generate_password_hash(pin), w, now()))
            d.commit()
            ledger.fund(d, w, int(config.FAUCET_USDT * ledger.USDT))
            session["p"] = uid
            nxt = f.get("next", "")
            return redirect(nxt if nxt.startswith("/") and not nxt.startswith("//") else url_for("payer_home"))
    return render_template("payer_auth.html", mode="register", error=err, email=f.get("email", ""),
                           nxt=request.values.get("next", ""))


@app.get("/payer/logout")
def payer_logout():
    session.pop("p", None)
    return redirect(url_for("payer_login"))


@app.get("/payer")
@payer_required
def payer_home():
    reconcile()
    d = get_db()
    rows = d.execute("""SELECT p.*, m.business_name FROM payments p JOIN merchants m ON m.user_id=p.merchant_id
                        WHERE p.payer_id=? ORDER BY p.created_at DESC LIMIT 30""", (g.user["id"],)).fetchall()
    return render_template("payer_home.html", u=g.user, rows=rows, bal=ledger.balance(d, g.user["wallet"]))


@app.post("/payer/api/faucet")
@payer_required
def faucet():
    ledger.fund(get_db(), g.user["wallet"], 100 * ledger.USDT)
    return jsonify(ok=True)


@app.post("/payer/api/resolve")
@payer_required
def resolve_link():
    """Accepts a pasted link / QR text / NFC payload and returns the checkout path."""
    raw = (request.get_json(force=True).get("text") or "").strip()
    import re
    m = re.search(r"/pay/([0-9a-fA-F-]{36})", raw) or re.fullmatch(r"([0-9a-fA-F-]{36})", raw)
    if not m:
        return jsonify(error="That doesn’t look like a TED Pay payment link."), 400
    return jsonify(url=url_for("checkout", pid=m.group(1).lower()))


@app.get("/pay/<pid>")
@payer_required
def checkout(pid):
    p = payment_for(pid)
    if not p:
        abort(404)
    m = merchant_of(p)
    meta = json.loads(p["meta"])
    mine = p["payer_id"] in (None, g.user["id"])
    return render_template("checkout.html", u=g.user, p=p, m=m, meta=meta, mine=mine,
                           bal=ledger.balance(get_db(), g.user["wallet"]),
                           left=max(0, p["expires_at"] - now()))


@app.post("/payer/api/pay/<pid>")
@payer_required
def pay(pid):
    d = get_db()
    if not check_password_hash(g.user["pin_hash"], str(request.get_json(force=True).get("pin", ""))):
        return jsonify(error="Incorrect PIN.", retry=True), 403
    reconcile()
    t = now()
    # atomic claim: only one payer can move a request from pending → processing
    c = d.execute("UPDATE payments SET status='processing', payer_id=? WHERE id=? AND status='pending' AND expires_at>=?",
                  (g.user["id"], pid, t))
    d.commit()
    p = d.execute("SELECT * FROM payments WHERE id=?", (pid,)).fetchone()
    if not p:
        return jsonify(error="Payment request not found."), 404
    if c.rowcount == 0:
        if p["status"] == "pending":
            d.execute("UPDATE payments SET status='expired' WHERE id=?", (pid,))
            d.commit()
        return jsonify(error="Quote expired or request no longer payable.", declined=True), 409
    merchant = merchant_of(p)
    try:
        h = ledger.submit(d, g.user["wallet"], merchant["wallet"], p["usdt_micro"], p["meta"])
    except ledger.LedgerError as e:
        d.execute("UPDATE payments SET status='failed', payer_id=? WHERE id=?", (g.user["id"], pid))
        d.commit()
        return jsonify(error=str(e), declined=True), 402
    d.execute("UPDATE payments SET tx_hash=? WHERE id=?", (h, pid))
    d.commit()
    return jsonify(ok=True, tx=h)


@app.get("/payer/api/pay/<pid>/status")
@payer_required
def payer_status(pid):
    p = payment_for(pid)
    if not p or p["payer_id"] not in (None, g.user["id"]):
        return jsonify(error="Not found"), 404
    return jsonify(status_payload(p))


# ───────────────────────── proof of payment + invoice ─────────────────────────
def _party_payment(pid):
    reconcile()
    p = get_db().execute("SELECT * FROM payments WHERE id=?", (pid,)).fetchone()
    if not p:
        abort(404)
    if session.get("m") != p["merchant_id"] and not (session.get("p") and session.get("p") == p["payer_id"]):
        abort(403)
    return p


def _details(p):
    d = get_db()
    m = merchant_of(p)
    payer = d.execute("SELECT name FROM users WHERE id=?", (p["payer_id"],)).fetchone() if p["payer_id"] else None
    tx = ledger.get(d, p["tx_hash"]) if p["tx_hash"] else None
    meta = json.loads(p["meta"])
    rows = [("Receipt", p["ref"]), ("Merchant", f"{m['business_name']} ({m['merchant_code']})"),
            ("Payer", payer["name"] if payer else "-"), ("Amount (ZAR)", zar(p["zar_cents"])),
            ("Amount (USDT)", usdt(p["usdt_micro"]) + " USDT"),
            ("Locked conversion rate", f"1 USDT = R {p['rate']:.4f}  (locked for {config.QUOTE_TTL}s)"),
            ("Rate locked at", full_stamp(meta["timestamp"])),
            ("Network", config.NETWORK_NAME),
            ("Transaction hash", p["tx_hash"] or "-"),
            ("Block", str(tx["block"]) if tx and tx["block"] else "-"),
            ("Confirmed at", full_stamp(p["completed_at"]) if p["completed_at"] else "-"),
            ("Transaction UUID", meta["tx_uuid"])]
    if p["refund_tx"]:
        rows.append(("Refund transaction", p["refund_tx"]))
    return rows


@app.get("/receipt/<pid>.pdf")
def receipt_pdf(pid):
    p = _party_payment(pid)
    pdf = pdfgen.build("Proof of Payment", _details(p), label(p["status"]),
                       "Generated by TED Pay · Tether Testnet · Test funds only, not legal tender.")
    return Response(pdf, mimetype="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{p["ref"]}-proof-of-payment.pdf"'})


@app.get("/api/invoice/<pid>")
def invoice(pid):
    p = _party_payment(pid)
    rows = _details(p)
    body = "Hello,\n\nHere is your TED Pay invoice / proof of payment.\n\n" + \
           "\n".join(f"{k}: {v}" for k, v in rows) + f"\nStatus: {label(p['status'])}\n\nThank you.\nTED Pay"
    subj = f"TED Pay invoice {p['ref']} – {zar(p['zar_cents'])}"
    return jsonify(subject=subj, body=body,
                   mailto=f"mailto:?subject={quote(subj)}&body={quote(body)}",
                   gmail=f"https://mail.google.com/mail/?view=cm&fs=1&su={quote(subj)}&body={quote(body)}")


# ───────────────────────── demo split-screen ─────────────────────────
@app.get("/demo")
def demo():
    return render_template("demo.html")


def bootstrap():
    dbm.init_db()
    c = dbm.connect()
    seed(c)
    c.close()


bootstrap()
