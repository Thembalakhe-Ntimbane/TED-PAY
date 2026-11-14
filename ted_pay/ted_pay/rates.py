"""Live ZAR per USDT. Falls back to FALLBACK_ZAR_PER_USDT when offline."""
import json, time, urllib.request
import config

_cache = {"t": 0.0, "rate": None, "src": ""}


def get_rate() -> tuple[float, str]:
    now = time.time()
    if _cache["rate"] and now - _cache["t"] < 20:
        return _cache["rate"], _cache["src"]
    rate, src = config.FALLBACK_RATE, "fixed fallback rate"
    if config.RATE_SOURCE == "coingecko":
        try:
            req = urllib.request.Request(
                "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=zar",
                headers={"User-Agent": "tedpay/1.0"})
            with urllib.request.urlopen(req, timeout=3) as r:
                rate = float(json.load(r)["tether"]["zar"])
                src = "live market rate"
        except Exception:
            pass
    _cache.update(t=now, rate=rate, src=src)
    return rate, src
