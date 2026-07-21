"""
PromptPay dynamic-QR demo (standalone — not wired into the app).

Generates an EMVCo/PromptPay payload for a given receiving PromptPay ID + amount,
prints it as an ASCII QR in the terminal, and saves a PNG you can scan.

Usage:
    python promptpay_demo.py <promptpay_id> <amount>

Examples:
    python promptpay_demo.py 0812345678 500        # mobile number
    python promptpay_demo.py 1234567890123 1000    # national ID / tax ID

The amount shows up locked in the banking app when scanned.
"""

import sys

import qrcode


def _tlv(tag: str, value: str) -> str:
    """EMVCo field = tag + 2-digit length + value."""
    return f"{tag}{len(value):02d}{value}"


def _crc16(payload: str) -> str:
    """CRC-16/CCITT-FALSE checksum (poly 0x1021, init 0xFFFF)."""
    crc = 0xFFFF
    for ch in payload.encode("ascii"):
        crc ^= ch << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def _format_target(raw: str) -> str:
    """Normalise a PromptPay proxy: 10-digit mobile -> 0066XXXXXXXXX, else 13-digit ID."""
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 10 and digits.startswith("0"):
        # mobile: country code 66 + number without leading 0, left-padded to 13
        return ("66" + digits[1:]).rjust(13, "0")
    return digits  # national ID / tax ID (13 digits)


def build_payload(target: str, amount: float) -> str:
    """Build a dynamic PromptPay QR payload string."""
    digits = "".join(c for c in target if c.isdigit())
    proxy_tag = "01" if (len(digits) == 10 and digits.startswith("0")) else "02"

    merchant_account = _tlv("00", "A000000677010111") + _tlv(proxy_tag, _format_target(target))

    payload = (
        _tlv("00", "01")  # payload format indicator
        + _tlv("01", "12")  # point of init: 12 = dynamic (one-time)
        + _tlv("29", merchant_account)  # PromptPay merchant account info
        + _tlv("53", "764")  # currency THB
        + _tlv("54", f"{amount:.2f}")  # transaction amount
        + _tlv("58", "TH")  # country
    )
    payload += "6304"  # CRC tag + length, value appended next
    return payload + _crc16(payload)


def main() -> None:
    target = sys.argv[1] if len(sys.argv) > 1 else "055665692274"
    amount = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0

    payload = build_payload(target, amount)

    print(f"\nReceiving PromptPay : {target}")
    print(f"Amount (locked)     : {amount:.2f} THB")
    print(f"\nQR payload string:\n{payload}\n")

    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(payload)
    qr.make(fit=True)

    # PNG you can open and scan with a phone
    out = "promptpay_qr.png"
    # pyrefly: ignore [bad-argument-type]
    qr.make_image(fill_color="black", back_color="white").save(out)
    print(f"Saved scannable QR -> {out}")
    print("Open it and scan with any Thai banking app to verify the amount shows up.")

    # ASCII preview (best-effort; some Windows consoles can't render block glyphs)
    try:
        qr.print_ascii(invert=True)
    except UnicodeEncodeError:
        pass


if __name__ == "__main__":
    main()
