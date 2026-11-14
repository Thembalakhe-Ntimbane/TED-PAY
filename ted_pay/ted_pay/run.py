"""Start TED Pay:  python run.py"""
import socket
import config
from app import app


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


if __name__ == "__main__":
    print(f"""
  TED Pay is running  ({config.NETWORK_NAME}, chain mode: {config.CHAIN_MODE})
  ─────────────────────────────────────────────────────────────
  On this computer :  http://localhost:{config.PORT}
  On your phone    :  http://{lan_ip()}:{config.PORT}   (same Wi-Fi)
  Side-by-side demo:  http://localhost:{config.PORT}/demo

  Demo merchant :  lungi@capetable.co.za  /  Merchant#2026!
  Demo payer    :  thando@example.com     /  Payer#2026!   (PIN 1234)
""")
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG, threaded=True)
