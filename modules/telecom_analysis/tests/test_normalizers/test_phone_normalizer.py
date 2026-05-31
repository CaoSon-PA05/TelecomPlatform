"""Tests for phone number normalization."""

from __future__ import annotations

import pytest

from modules.telecom_analysis.normalizers.phone_normalizer import normalize, resolve_direction
from modules.telecom_analysis.utils.phone_utils import (
    detect_carrier,
    get_last_9_digits,
    is_service_sender,
    normalize_phone,
)


class TestNormalizePhone:

    def test_strips_country_code_84(self):
        assert normalize_phone("84969619929") == "0969619929"

    def test_prepends_zero_to_9_digits(self):
        assert normalize_phone("969619929") == "0969619929"

    def test_already_normalized(self):
        assert normalize_phone("0969619929") == "0969619929"

    def test_returns_none_for_empty(self):
        assert normalize_phone("") is None
        assert normalize_phone(None) is None

    def test_returns_none_for_invalid(self):
        assert normalize_phone("12345") is None

    def test_strips_whitespace(self):
        assert normalize_phone(" 0969619929 ") == "0969619929"


class TestDetectCarrier:

    def test_viettel_038(self):
        assert detect_carrier("0382733506") == "viettel"

    def test_viettel_096(self):
        assert detect_carrier("0969619929") == "viettel"

    def test_unknown(self):
        assert detect_carrier("0123456789") == "unknown"


class TestServiceSender:

    def test_mbbank_is_service(self):
        assert is_service_sender("MBBANK") is True

    def test_myviettel_is_service(self):
        assert is_service_sender("MyViettel") is True

    def test_phone_is_not_service(self):
        assert is_service_sender("0969619929") is False

    def test_short_code_is_not_service(self):
        assert is_service_sender("211") is False


class TestResolveDirection:

    def test_outgoing(self):
        contact, direction = resolve_direction(
            "0969619929", "0363292601", "0969619929"
        )
        assert direction == "outgoing"
        assert contact == "0363292601"

    def test_incoming(self):
        contact, direction = resolve_direction(
            "0363292601", "0969619929", "0969619929"
        )
        assert direction == "incoming"
        assert contact == "0363292601"

    def test_service_sender(self):
        contact, direction = resolve_direction(
            "MBBANK", "0969619929", "0969619929"
        )
        assert direction == "service"
        assert contact is None
