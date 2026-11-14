"""Tether Testnet ledger.

CHAIN_MODE=simulated : a self-contained testnet ledger (SQLite). Transactions are
  broadcast as 'pending' and only become 'confirmed' after a few seconds, exactly
  like a mined block. Merchant status is derived ONLY from this ledger.
CHAIN_MODE=wdk       : swap `submit`/`sync` for calls into the Tether WDK testnet
  (see README, "Going to the real testnet"). The rest of the app is unchanged.
"""
import hashlib, random, secrets, time
import config

USDT = 1_000_000  # 6 decimals
FAUCET = "0x" + "fa" * 20


class LedgerError(Exception):
    pass


def new_address() -> str:
    return "0x" + secrets.token_hex(20)


def balance(db, addr: str) -> int:
    row = db.execute(
        """SELECT COALESCE(SUM(CASE WHEN to_addr=? AND status='confirmed' THEN amount_micro END),0)
                - COALESCE(SUM(CASE WHEN from_addr=? AND status IN('pending','confirmed') THEN amount_micro END),0)
           FROM chain""", (addr, addr)).fetchone()
    return int(row[0])


def fund(db, addr: str, amount_micro: int) -> str:
    """Testnet faucet: instantly confirmed."""
    h = "0x" + hashlib.sha256(f"faucet{addr}{time.time()}{secrets.token_hex(4)}".encode()).hexdigest()
    now = time.time()
    db.execute("INSERT INTO chain VALUES(?,?,?,?,?,?,?,?,?)",
               (h, FAUCET, addr, amount_micro, "faucet", "confirmed", now, now, 0))
    db.execute("UPDATE chain SET block=4200000+rowid WHERE hash=?", (h,))
    db.commit()
    return h


def submit(db, frm: str, to: str, amount_micro: int, memo: str) -> str:
    if config.CHAIN_MODE == "wdk":
        raise LedgerError("WDK adapter not configured (see README).")
    if amount_micro <= 0:
        raise LedgerError("Invalid amount")
    if balance(db, frm) < amount_micro:
        raise LedgerError("Insufficient USDT balance")
    now = time.time()
    h = "0x" + hashlib.sha256(f"{frm}{to}{amount_micro}{memo}{now}{secrets.token_hex(8)}".encode()).hexdigest()
    confirm = now + random.uniform(config.CONFIRM_MIN, config.CONFIRM_MAX)
    db.execute("INSERT INTO chain VALUES(?,?,?,?,?,?,?,?,NULL)",
               (h, frm, to, amount_micro, memo, "pending", now, confirm, ))
    db.commit()
    return h


def sync(db) -> None:
    """Mine any pending transactions whose confirmation time has passed."""
    db.execute("UPDATE chain SET status='confirmed', block=4200000+rowid "
               "WHERE status='pending' AND confirm_at<=?", (time.time(),))
    db.commit()


def get(db, h: str):
    return db.execute("SELECT * FROM chain WHERE hash=?", (h,)).fetchone()
