import base64
import io

import qrcode


def generate_qr_png(data: str) -> bytes:
    """Return PNG bytes of a QR code encoding the given data/URL."""
    img = qrcode.make(data)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_qr_data_uri(data: str) -> str:
    png = generate_qr_png(data)
    b64 = base64.b64encode(png).decode()
    return f"data:image/png;base64,{b64}"
