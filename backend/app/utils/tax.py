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


def vat_on_top(net: Decimal, rate: Decimal = Decimal("0.07")) -> tuple[Decimal, Decimal, Decimal]:
    """
    VAT-exclusive: net is the price before VAT.
    Returns (net, vat_amount, gross).

    Example: vat_on_top(Decimal("490")) → (Decimal("490.00"), Decimal("34.30"), Decimal("524.30"))
    """
    vat = (net * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return net, vat, net + vat
