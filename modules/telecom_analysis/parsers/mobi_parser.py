"""
Mobifone CDR parser — Template 3.

Structure:
  Free-text rows before the 'STT' column header contain subscriber PII.
  PII is extracted via regex matching on each row's concatenated text.
  The STT row IS the column header row; data starts immediately below it.
"""

from __future__ import annotations

import logging
import re

from ..schemas.cdr_schema import RawCDRRecord
from ..schemas.subscriber_schema import RawSubscriberInfo
from .base_parser import BaseParser, ColumnMap, ParseResult

log = logging.getLogger("telecom.parsers.mobi")

# Regex patterns for extracting PII from free-text rows above STT
_PII_PATTERNS: dict[str, re.Pattern] = {
    "phone_raw":       re.compile(r"(\d{9,11})"),
    "full_name":       re.compile(r"tên\s+thuê\s+bao\s*[:\-]\s*(.+)", re.I),
    "date_of_birth":   re.compile(r"năm\s+sinh\s*[:\-]\s*(\d{2}/\d{2}/\d{4})", re.I),
    "address":         re.compile(r"(?:địa\s+chỉ|hộ\s+khẩu)\s*[:\-]\s*(.+)", re.I),
    "id_doc_number":   re.compile(r"(?:số\s+cmnd|số\s+cccd)\s*[:\-]\s*(\d+)", re.I),
    "id_issue_date":   re.compile(r"ngày\s+cấp\s+(?:cmnd|cccd)\s*[:\-]\s*(.+)", re.I),
    "activation_date": re.compile(r"ngày\s+kích\s+hoạt\s*[:\-]\s*(.+)", re.I),
}


class MobiParser(BaseParser):

    # -------------------------------------------------------------------
    # Detection
    # -------------------------------------------------------------------

    def can_parse(self, data: list[list]) -> bool:
        """True when any cell in the first 10 rows matches the STT pattern."""
        for row in data[:10]:
            for cell in row:
                if cell is not None and _is_stt(str(cell)):
                    return True
        return False

    # -------------------------------------------------------------------
    # Parsing pipeline
    # -------------------------------------------------------------------

    def parse(self, data: list[list], filename: str = "") -> ParseResult:
        """
        1. Find the STT header row.
        2. Extract subscriber PII from rows above STT via regex.
        3. Build ColumnMap for the STT row.
        4. Extract CDR records.
        """
        stt_row = self._find_stt_row(data)

        # PII is in rows 0..(stt_row-1)
        sub_info = self._extract_subscriber_info(data, stt_row, filename)

        # STT row IS the column header
        header_row = data[stt_row]
        column_map = self._build_column_map(header_row)
        missing, warnings = self._validate_column_map(column_map)

        owner_phone = sub_info.phone_normalized or ""

        from ..normalizers.phone_normalizer import resolve_direction

        records: list[RawCDRRecord] = []
        for row_num, row in enumerate(data[stt_row + 1:], start=1):
            if not any(c is not None and str(c).strip() for c in row):
                continue
            src_raw = _get(row, column_map.source_number) or ""
            tgt_raw = _get(row, column_map.target_number) or ""

            # If owner_phone not yet known, try to infer from records
            if not owner_phone:
                from ..utils.phone_utils import normalize_phone, is_service_sender
                for val in (src_raw, tgt_raw):
                    if val and not is_service_sender(val):
                        norm = normalize_phone(val)
                        if norm:
                            owner_phone = norm
                            break

            _contact, _direction = resolve_direction(src_raw, tgt_raw, owner_phone)

            records.append(RawCDRRecord(
                source_file_row=row_num,
                source_number_raw=src_raw,
                target_number_raw=tgt_raw,
                timestamp_raw=_get(row, column_map.timestamp),
                duration_raw=_get(row, column_map.duration_seconds),
                imei_raw=_get(row, column_map.imei),
                province_code_raw=_get(row, column_map.province_code),
                comm_type_raw=_get(row, column_map.comm_type),
                service_direction_raw=_get(row, column_map.service_direction),
                bts_address_raw=_get(row, column_map.bts_address),
                lac_raw=_get(row, column_map.lac),
                cell_id_raw=_get(row, column_map.cell_id),
            ))

        # Back-fill owner_phone into sub_info if it was inferred from records
        if owner_phone and not sub_info.phone_normalized:
            sub_info = sub_info.model_copy(
                update={"phone_normalized": owner_phone}
            )

        log.info(
            "Mobi parse complete: phone=%s records=%d stt_row=%d",
            owner_phone or "?", len(records), stt_row,
        )
        return ParseResult(
            subscriber_info=sub_info,
            records=records,
            column_map=column_map,
            header_row_index=stt_row,
            missing_required=missing,
            warnings=warnings,
        )

    # -------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------

    def _find_stt_row(self, data: list[list]) -> int:
        """
        Return the 0-based index of the row containing 'STT' or 'Số thứ tự'.
        Raises ValueError if not found in the first 20 rows.
        """
        for i, row in enumerate(data[:20]):
            for cell in row:
                if cell is not None and _is_stt(str(cell)):
                    return i
        raise ValueError("Mobifone STT header row not found")

    def _extract_subscriber_info(
        self,
        data: list[list],
        stt_row: int,
        filename: str,
    ) -> RawSubscriberInfo:
        """
        Scan rows 0..(stt_row-1) for PII using regex patterns.
        Falls back to filename-based phone extraction and record scanning.
        """
        from ..utils.phone_utils import normalize_phone
        from ..utils.file_utils import extract_phone_from_filename

        pii: dict[str, str | None] = {k: None for k in _PII_PATTERNS}

        for row in data[:stt_row]:
            row_text = " ".join(str(c) for c in row if c is not None)
            row_text_lower = row_text.lower()

            for field_name, pattern in _PII_PATTERNS.items():
                if pii.get(field_name):
                    continue
                m = pattern.search(row_text)
                if m:
                    pii[field_name] = m.group(1).strip()

        # Validate and normalize the phone number
        phone_raw = pii.get("phone_raw")
        phone_norm: str | None = None

        if phone_raw:
            phone_norm = normalize_phone(phone_raw)

        # Fallback: extract phone from filename
        if not phone_norm:
            phone_norm = extract_phone_from_filename(filename)
            if phone_norm:
                phone_raw = phone_norm.lstrip("0")

        return RawSubscriberInfo(
            phone_raw=phone_raw,
            phone_normalized=phone_norm,
            full_name=pii.get("full_name"),
            date_of_birth=pii.get("date_of_birth"),
            address=pii.get("address"),
            id_doc_number=pii.get("id_doc_number"),
            id_issue_date=pii.get("id_issue_date"),
            activation_date=pii.get("activation_date"),
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_stt(value: str) -> bool:
    v = value.strip().upper()
    return v == "STT" or "SỐ THỨ TỰ" in v or "SO THU TU" in v


def _get(row: list, col_idx: int | None) -> str | None:
    if col_idx is None or col_idx >= len(row):
        return None
    val = row[col_idx]
    return str(val).strip() if val is not None else None
