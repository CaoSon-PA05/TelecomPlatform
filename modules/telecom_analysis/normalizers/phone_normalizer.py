"""
Phone number normalizer — structured input/output for the pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from ..utils.phone_utils import (
    detect_carrier,
    get_last_9_digits,
    is_service_sender,
    normalize_phone,
    phones_are_equal,
)


@dataclass
class NormalizedPhone:
    raw:        str
    normalized: Optional[str]  # '0969619929' — with leading 0
    last_9:     Optional[str]  # '969619929'  — for cross-file comparison
    carrier:    str            # 'viettel' | 'vina' | 'mobi' | 'unknown'
    is_service: bool           # True for 'MBBANK', 'MyViettel', etc.
    is_valid:   bool           # True when normalized is not None


def normalize(raw: str | None) -> NormalizedPhone:
    """
    Full normalization pipeline for a single phone field value.
    Returns NormalizedPhone regardless of input validity — never raises.
    """
    if not raw:
        return NormalizedPhone(
            raw="", normalized=None, last_9=None,
            carrier="unknown", is_service=False, is_valid=False,
        )

    raw_s = str(raw).strip()
    service = is_service_sender(raw_s)

    if service:
        return NormalizedPhone(
            raw=raw_s, normalized=None, last_9=None,
            carrier="unknown", is_service=True, is_valid=False,
        )

    norm   = normalize_phone(raw_s)
    last9  = get_last_9_digits(raw_s)
    carrier = detect_carrier(norm) if norm else "unknown"

    return NormalizedPhone(
        raw=raw_s,
        normalized=norm,
        last_9=last9,
        carrier=carrier,
        is_service=False,
        is_valid=norm is not None,
    )


def resolve_direction(
    source_raw: str,
    target_raw: str,
    owner_phone: str,
) -> tuple[Optional[str], str]:
    """
    Infer CDR direction and extract the contact number.

    The CDR files have no explicit inbound/outbound flag — direction is
    determined by comparing source/target against the owner's phone.

    Returns:
        (contact_number, direction)
        direction: 'outgoing' | 'incoming' | 'service'
        contact_number: normalized contact phone, or None for service senders
    """
    # Service sender (MBBANK, MyViettel, etc.) → always 'service'
    if is_service_sender(source_raw):
        return None, "service"

    src_norm = normalize_phone(source_raw)
    tgt_norm = normalize_phone(target_raw)

    # Source matches owner → outgoing call/SMS
    if src_norm and phones_are_equal(src_norm, owner_phone):
        return tgt_norm, "outgoing"

    # Target matches owner → incoming call/SMS
    if tgt_norm and phones_are_equal(tgt_norm, owner_phone):
        return src_norm, "incoming"

    # Fallback: treat as incoming, use source as contact
    return src_norm or tgt_norm, "incoming"
