"""Demo data: one merchant, one payer, and a week of completed sales so analytics is not empty."""
import json, os, time, uuid, hashlib
from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash
import ledger

SAST = timezone(timedelta(hours=2))
def _env(*names):
    vals = [os.environ.get(n, "").strip() for n in names]
    return vals if all(vals) else None


def seed(db) -> None:
    """Optional. Runs only when ALL SEED_* variables are set in your private .env. No credentials live in code."""
    if db.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        return
    m = _env("SEED_MERCHANT_EMAIL", "SEED_MERCHANT_PASSWORD")
    p = _env("SEED_PAYER_EMAIL", "SEED_PAYER_PASSWORD", "SEED_PAYER_PIN")
    if not (m and p):
        return
    DEMO_MERCHANT, DEMO_PAYER = m, p
    now = time.time()
    mid, pid = str(uuid.uuid4()), str(uuid.uuid4())
    mw, pw = ledger.new_address(), ledger.new_address()
    db.execute("INSERT INTO users(id,role,email,pw_hash,name,wallet,created_at) VALUES(?,?,?,?,?,?,?)",
               (mid, "merchant", DEMO_MERCHANT[0], generate_password_hash(DEMO_MERCHANT[1]), "Lungi Mbeki", mw, now))
    db.execute("INSERT INTO merchants VALUES(?,?,?,?,?,?,?,?)",
               (mid, "Cape Table Café", "2024/184729/07", DEMO_MERCHANT[0], "South Africa", "Cape Town", "CTC-0001", "verified"))
    db.execute("INSERT INTO users(id,role,email,pw_hash,name,pin_hash,wallet,created_at) VALUES(?,?,?,?,?,?,?,?)",
               (pid, "payer", DEMO_PAYER[0], generate_password_hash(DEMO_PAYER[1]), "Thando Nkosi",
                generate_password_hash(DEMO_PAYER[2]), pw, now))
    db.commit()
    ledger.fund(db, pw, 3000 * ledger.USDT)
    rate = 18.42
    # (days_ago, hour, zar)
    sales = [(13, 10, 220), (12, 13, 180), (10, 9, 450), (9, 15, 95), (8, 11, 310),
             (6, 9, 120), (6, 12, 340), (5, 14, 275), (4, 9, 85), (3, 10, 460), (3, 16, 150),
             (2, 13, 390), (1, 9, 210), (1, 12, 520), (0, 8, 120), (0, 9, 480)]
    n = 0
    today = datetime.now(SAST).replace(minute=12, second=0, microsecond=0)
    for days, hour, zar in sales:
        ts = (today - timedelta(days=days)).replace(hour=hour).timestamp()
        if ts > now:
            ts = now - 3600
        n += 1
        pay_id = str(uuid.uuid4())
        usdt = round(zar / rate, 2)
        micro = int(round(usdt * ledger.USDT))
        h = "0x" + hashlib.sha256(pay_id.encode()).hexdigest()
        db.execute("INSERT INTO chain VALUES(?,?,?,?,?,?,?,?,?)",
                   (h, pw, mw, micro, "seed", "confirmed", ts + 40, ts + 45, 4100000 + n))
        meta = json.dumps({"tx_uuid": pay_id, "merchant_id": "CTC-0001", "timestamp": ts, "rate": rate, "zar": zar})
        db.execute("INSERT INTO payments VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                   (pay_id, f"TED-{1000+n}", mid, zar * 100, rate, micro, ts, ts + 60, "completed", pid, h, None, meta, ts + 45))
    db.commit()
