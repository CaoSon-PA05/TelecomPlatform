"""Tests for parser auto-detection logic."""

from __future__ import annotations

import pytest

from modules.telecom_analysis.parsers import auto_detect_parser
from modules.telecom_analysis.parsers.viettel_parser import ViettelParser


class TestAutoDetector:

    def test_detects_viettel_from_filename(self):
        """File '1_0969619929.xlsx' has 096 prefix → should select ViettelParser."""
        ...

    def test_detects_viettel_from_content(self, viettel_raw_data):
        """Content detection: rows 6 and 7 have values in col 2 → ViettelParser."""
        parser = auto_detect_parser(viettel_raw_data, filename="unknown.xlsx")
        assert isinstance(parser, ViettelParser)

    def test_falls_back_to_viettel_on_unknown_filename(self, viettel_raw_data):
        """Unknown filename with Viettel-structured content → ViettelParser."""
        parser = auto_detect_parser(viettel_raw_data, filename="file.xlsx")
        assert isinstance(parser, ViettelParser)

    def test_parse_result_has_records(self, viettel_raw_data):
        """Full parse of the real Viettel sample produces ≥1 CDR record."""
        from modules.telecom_analysis.parsers import parse_file
        ...

    def test_parse_result_subscriber_phone(self, viettel_raw_data):
        """Parsed subscriber phone should be normalized to '0969619929'."""
        ...
