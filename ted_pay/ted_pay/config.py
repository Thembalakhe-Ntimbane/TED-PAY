"""Central configuration. All secrets come from the environment / .env (never hard-coded)."""
import os, pathlib, secrets

ROOT = pathlib.Path(__file__).resolve().parent
INSTANCE = ROOT / "instance"
INSTANCE.mkdir(exist_ok=True)


def _load_dotenv() -> None:
    p = ROOT / ".env"
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


_load_dotenv()


def _secret() -> str:
    s = os.environ.get("SECRET_KEY", "").strip()
    if s:
        return s
    f = INSTANCE / "secret.key"
    if not f.exists():
        f.write_text(secrets.token_hex(32))
    return f.read_text().strip()


def _f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


SECRET_KEY = _secret()
DB_PATH = str(INSTANCE / "tedpay.db")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(_f("PORT", 5000))
DEBUG = os.environ.get("DEBUG", "0") == "1"
RATE_SOURCE = os.environ.get("RATE_SOURCE", "coingecko")
FALLBACK_RATE = _f("FALLBACK_ZAR_PER_USDT", 18.50)
QUOTE_TTL = int(_f("QUOTE_TTL_SECONDS", 60))
CHAIN_MODE = os.environ.get("CHAIN_MODE", "simulated")
CONFIRM_MIN = _f("CONFIRM_SECONDS_MIN", 3)
CONFIRM_MAX = _f("CONFIRM_SECONDS_MAX", 6)
FAUCET_USDT = _f("FAUCET_USDT", 500)
DEV_SHOW_RESET_LINK = os.environ.get("DEV_SHOW_RESET_LINK", "1") == "1"
COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "0") == "1"
NETWORK_NAME = "Tether Testnet"
