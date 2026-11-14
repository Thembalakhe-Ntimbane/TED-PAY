import sqlite3
from flask import g
import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN('merchant','payer')),
  email TEXT NOT NULL, pw_hash TEXT NOT NULL, name TEXT NOT NULL,
  pin_hash TEXT, wallet TEXT NOT NULL, lang TEXT DEFAULT 'en',
  totp_secret TEXT, totp_enabled INTEGER DEFAULT 0, created_at REAL NOT NULL,
  UNIQUE(role,email));
CREATE TABLE IF NOT EXISTS merchants(
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  business_name TEXT, reg_no TEXT, business_email TEXT, country TEXT, city TEXT,
  merchant_code TEXT UNIQUE, kyc_status TEXT DEFAULT 'verified');
CREATE TABLE IF NOT EXISTS payments(
  id TEXT PRIMARY KEY, ref TEXT UNIQUE, merchant_id TEXT, zar_cents INTEGER,
  rate REAL, usdt_micro INTEGER, created_at REAL, expires_at REAL, status TEXT,
  payer_id TEXT, tx_hash TEXT, refund_tx TEXT, meta TEXT, completed_at REAL);
CREATE TABLE IF NOT EXISTS chain(
  hash TEXT PRIMARY KEY, from_addr TEXT, to_addr TEXT, amount_micro INTEGER,
  memo TEXT, status TEXT, submitted_at REAL, confirm_at REAL, block INTEGER);
CREATE INDEX IF NOT EXISTS ix_pay_m ON payments(merchant_id, created_at);
CREATE INDEX IF NOT EXISTS ix_pay_p ON payments(payer_id, created_at);
"""


def connect() -> sqlite3.Connection:
    c = sqlite3.connect(config.DB_PATH, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = connect()
    return g.db


def init_db() -> None:
    c = connect()
    c.executescript(SCHEMA)
    c.commit()
    c.close()
