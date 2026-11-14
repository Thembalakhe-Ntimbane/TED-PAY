"""Dependency-free single-page PDF writer for Proof of Payment."""

def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build(title: str, rows: list[tuple[str, str]], status: str, footer: str) -> bytes:
    ops = ["0.90 0.17 0.12 rg 0 742 595 100 re f",
           "BT /F2 26 Tf 1 1 1 rg 48 790 Td (T) Tj ET",
           f"BT /F2 20 Tf 1 1 1 rg 80 790 Td ({_esc('TED Pay')}) Tj ET",
           f"BT /F1 12 Tf 1 1 1 rg 48 762 Td ({_esc(title)}) Tj ET",
           f"BT /F2 16 Tf 0.1 0.1 0.1 rg 48 700 Td ({_esc('Status: ' + status)}) Tj ET"]
    y = 665
    for k, v in rows:
        ops.append(f"BT /F1 9 Tf 0.45 0.45 0.45 rg 48 {y} Td ({_esc(k.upper())}) Tj ET")
        ops.append(f"BT /F1 {10 if len(v) > 60 else 12} Tf 0.1 0.1 0.1 rg 48 {y-15} Td ({_esc(v)}) Tj ET")
        ops.append(f"0.88 0.88 0.88 RG 48 {y-24} m 547 {y-24} l S")
        y -= 42
    ops.append(f"BT /F1 9 Tf 0.45 0.45 0.45 rg 48 40 Td ({_esc(footer)}) Tj ET")
    stream = "\n".join(ops).encode("latin-1", "replace")
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>",
            b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R "
            b"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> >>",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream"]
    out = bytearray(b"%PDF-1.4\n")
    offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    x = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for o in offs:
        out += b"%010d 00000 n \n" % o
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % (len(objs) + 1, x)
    return bytes(out)
