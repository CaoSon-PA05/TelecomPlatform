"""
Province code normalizer.
Maps raw carrier province codes to a consistent province name.

Real CDR data has 'TNH' and 'T066' both meaning Tay Ninh in the same file.
"""

from __future__ import annotations

from typing import Optional

from ..utils.constants import PROVINCE_CODE_MAP

# Runtime-mutable copy so new codes can be registered without modifying constants
_RUNTIME_MAP: dict[str, str] = {k.upper(): v for k, v in PROVINCE_CODE_MAP.items()}


def normalize_province(code_raw: str | None) -> Optional[str]:
    """
    Return the canonical province name for a raw province code.
    Returns None for empty/unknown codes — location data is often missing
    in CDR files and that is expected, not an error.
    """
    if not code_raw:
        return None
    return _RUNTIME_MAP.get(str(code_raw).strip().upper())


def get_province_code_map() -> dict[str, str]:
    """Return the full raw-code → province-name mapping (for diagnostics)."""
    return dict(_RUNTIME_MAP)


def register_province(raw_code: str, province_name: str) -> None:
    """
    Register a new raw → normalized mapping at runtime.
    Called when an import encounters an unrecognised province code.
    """
    _RUNTIME_MAP[raw_code.strip().upper()] = province_name
