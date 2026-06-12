"""VAT utilities for Thai billing documents."""

from decimal import ROUND_HALF_UP, Decimal


def split_inclusive(gross: Decimal, rate: Decimal = Decimal("0.07")) -> tuple[Decimal, Decimal]:
    """
    Split a VAT-inclusive gross amount into (subtotal_ex_vat, vat_amount).

    subtotal = round(gross / (1 + rate), 2)
    vat      = gross - subtotal  (preserves gross exactly)

    Example: split_inclusive(Decimal("990")) → (Decimal("925.23"), Decimal("64.77"))
    """
    subtotal = (gross / (1 + rate)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    vat = gross - subtotal
    return subtotal, vat
