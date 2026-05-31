"""Phone number utilities — normalization, carrier detection, validation."""

from __future__ import annotations

import re
from typing import Optional

from .constants import MOBI_PREFIXES, VIETTEL_PREFIXES, VINA_PREFIXES

_STRIP_RE       = re.compile(r"[\s\-\(\)\+]")
_VALID_VN_RE    = re.compile(r"^0[3-9]\d{8}$")
_SERVICE_RE     = re.compile(r"^[A-Za-z]")
_DIGITS_ONLY_RE = re.compile(r"\D")


def normalize_phone(raw: str | None) -> Optional[str]:
    """
    Return a normalized Vietnamese phone number with leading '0'.

    Rules (in order):
      1. Strip whitespace, dashes, parentheses.
      2. Strip country code '84' or '+84'.
      3. Prepend '0' to 9-digit numbers.
      4. Return None if result is not a valid 10-digit VN mobile number.
    """
    if not raw:
        return None

    s = _STRIP_RE.sub("", str(raw).strip())

    # Strip country code variants
    if s.startswith("+84"):
        s = "0" + s[3:]
    elif s.startswith("84") and len(s) == 11:
        s = "0" + s[2:]

    # Prepend 0 to 9-digit numbers starting with a valid mobile digit
    if len(s) == 9 and s[0] in "3456789":
        s = "0" + s

    return s if _VALID_VN_RE.match(s) else None


def get_last_9_digits(phone: str) -> Optional[str]:
    """
    Return the last 9 digits of a phone number for cross-subscriber comparison.
    Handles '0' prefix and '84' country code variants.
    Returns None if fewer than 9 digits found.
    """
    digits = _DIGITS_ONLY_RE.sub("", str(phone))
    return digits[-9:] if len(digits) >= 9 else None


def is_service_sender(value: str) -> bool:
    """
    Return True when the CDR source field is a service name rather than a phone number.
    Examples: 'MBBANK', 'MyViettel', 'Apple', 'BIDV', 'NAPTHE VT'.

    Rules:
      - Starts with a letter → service name
      - All digits but 6 digits or fewer → short code (e.g. '211', '1498')
    """
    if not value:
        return False
    s = str(value).strip()
    if _SERVICE_RE.match(s):
        return True
    digits = _DIGITS_ONLY_RE.sub("", s)
    return len(digits) <= 6


def detect_carrier(phone_normalized: str) -> str:
    """
    Return carrier identifier from phone number prefix.
    Returns 'viettel' | 'vina' | 'mobi' | 'unknown'.
    """
    if not phone_normalized or len(phone_normalized) < 3:
        return "unknown"
    prefix = phone_normalized[:3]
    if prefix in VIETTEL_PREFIXES:
        return "viettel"
    if prefix in VINA_PREFIXES:
        return "vina"
    if prefix in MOBI_PREFIXES:
        return "mobi"
    return "unknown"


def phones_are_equal(a: str, b: str) -> bool:
    """
    Compare two phone numbers ignoring prefix variants (0 vs 84).
    Uses last-9-digit normalization.
    """
    a9 = get_last_9_digits(a)
    b9 = get_last_9_digits(b)
    return bool(a9 and b9 and a9 == b9)
