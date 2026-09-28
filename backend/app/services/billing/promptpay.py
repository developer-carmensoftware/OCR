"""
PromptPay dynamic-QR payload builder.

Generates an EMVCo/PromptPay payload string for a given receiving PromptPay ID
and amount.  The payload can be rendered as a QR image by any QR library.

Spec: Bank of Thailand PromptPay QR Standard (EMVCo TLV format).
"""


def _tlv(tag: str, value: str) -> str:
    return f"{tag}{len(value):02d}{value}"


def _crc16(payload: str) -> str:
    """CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF)."""
    crc = 0xFFFF
    for ch in payload.encode("ascii"):
        crc ^= ch << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def _format_target(raw: str) -> str:
    """Normalise proxy: 10-digit mobile → 0066XXXXXXXXX (13 digits); ID/Tax ID passed as-is."""
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 10 and digits.startswith("0"):
        return ("66" + digits[1:]).rjust(13, "0")
    return digits


def build_payload(promptpay_id: str, amount: float) -> str:
    """
    Build a PromptPay dynamic QR payload string with the amount embedded.

    Args:
        promptpay_id: Mobile number (10 digits) or national/tax ID (13 digits).
        amount: Amount in THB (will appear locked in the banking app).

    Returns:
        EMVCo-formatted string to be encoded as a QR code.
    """
    digits = "".join(c for c in promptpay_id if c.isdigit())
    proxy_tag = "01" if (len(digits) == 10 and digits.startswith("0")) else "02"

    merchant_account = _tlv("00", "A000000677010111") + _tlv(
        proxy_tag, _format_target(promptpay_id)
    )

    payload = (
        _tlv("00", "01")
        + _tlv("01", "12")  # dynamic (one-time use)
        + _tlv("29", merchant_account)
        + _tlv("53", "764")  # THB
        + _tlv("54", f"{amount:.2f}")
        + _tlv("58", "TH")
    )
    payload += "6304"
    return payload + _crc16(payload)
