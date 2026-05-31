"""
Auto-detector — selects the correct CDR parser for a given Excel file.

Detection cascade
-----------------
1. Filename → extract phone → carrier prefix → select parser  (fast, O(1))
2. Content  → structural pattern matching                     (fallback)
3. Default  → ViettelParser                                   (last resort)
"""

from __future__ import annotations

import logging
from pathlib import Path

from ..utils.file_utils import extract_phone_from_filename, read_excel_to_array
from ..utils.phone_utils import detect_carrier
from .base_parser import BaseParser, ParseResult
from .mobi_parser import MobiParser
from .viettel_parser import ViettelParser
from .vina_parser import VinaParser

log = logging.getLogger("telecom.parsers.auto_detector")

# Ordered list — checked in sequence for content-based detection
_PARSERS: list[BaseParser] = [
    ViettelParser(),
    VinaParser(),
    MobiParser(),
]

_CARRIER_TO_PARSER: dict[str, BaseParser] = {
    "viettel": _PARSERS[0],
    "vina":    _PARSERS[1],
    "mobi":    _PARSERS[2],
}


def auto_detect_parser(data: list[list], filename: str = "") -> BaseParser:
    """
    Return the best-matching parser for the given 2-D Excel array.
    Does NOT parse — only selects. Call parser.parse(data) afterward.
    """
    # --- Fast path: filename contains a phone number ---
    if filename:
        phone = extract_phone_from_filename(filename)
        if phone:
            carrier = detect_carrier(phone)
            parser  = _CARRIER_TO_PARSER.get(carrier)
            if parser is not None:
                log.debug(
                    "Auto-detect via filename: '%s' → phone=%s carrier=%s",
                    filename, phone, carrier,
                )
                return parser

    # --- Fallback: content-based structural matching ---
    for parser in _PARSERS:
        if parser.can_parse(data):
            log.debug(
                "Auto-detect via content: '%s' → %s",
                filename or "<no filename>", type(parser).__name__,
            )
            return parser

    # --- Last resort: default to Viettel ---
    log.warning(
        "Auto-detect failed for '%s' — defaulting to ViettelParser",
        filename or "<no filename>",
    )
    return _PARSERS[0]


def parse_file(path: Path) -> ParseResult:
    """
    Convenience one-liner:
        read Excel → detect parser → parse → return ParseResult.

    This is the main entry point for the import pipeline.
    """
    data   = read_excel_to_array(path)
    parser = auto_detect_parser(data, filename=path.name)
    return parser.parse(data, filename=path.name)
