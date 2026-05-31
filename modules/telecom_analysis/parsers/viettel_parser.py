"""
Viettel CDR parser — Template 1.

Structure confirmed from two real sample files (0382733506, 0969619929):
  Sheet name : Sheet2
  Row  0     : Report title
  Row  2     : Document reference (Công văn)
  Row  3     : Subscriber phone (WITHOUT leading 0)
  Row  4     : Date range — col 2 = from, col 4 = to
  Rows 6–18  : Subscriber PII block (fixed cell addresses)
  Row  21    : Column headers
  Row  22+   : CDR data records

Fallback column positions (when fuzzy mapping fails):
  1=source  2=target  3=timestamp  4=duration  5=IMEI
  6=province  7=comm_type  8=service_dir  9=bts_addr  10=LAC  11=cell
"""

from __future__ import annotations

import logging

from ..schemas.cdr_schema import RawCDRRecord
from ..schemas.subscriber_schema import RawSubscriberInfo
from .base_parser import BaseParser, ColumnMap, ParseResult

log = logging.getLogger("telecom.parsers.viettel")

# Known column positions from real files — used as fallback when fuzzy
# mapping cannot find a required field.
_FALLBACK_COLUMNS: dict[str, int] = {
    "source_number":     1,
    "target_number":     2,
    "timestamp":         3,
    "duration_seconds":  4,
    "imei":              5,
    "province_code":     6,
    "comm_type":         7,
    "service_direction": 8,
    "bts_address":       9,
    "lac":               10,
    "cell_id":           11,
}


class ViettelParser(BaseParser):

    # Fixed cell addresses for subscriber PII (row_index, col_index), 0-based
    SUBSCRIBER_PII_MAP: dict[str, tuple[int, int]] = {
        "document_ref":      (2,  2),
        "phone_raw":         (3,  2),
        "report_from":       (4,  2),
        "report_to":         (4,  4),
        "full_name":         (6,  2),
        "date_of_birth":     (8,  2),
        "address":           (9,  2),
        "subscription_type": (10, 2),
        "id_doc_type":       (11, 2),
        "id_doc_number":     (12, 2),
        "id_issue_date":     (13, 2),
        "id_issue_authority":(14, 2),
        "activation_date":   (15, 2),
        "account_status":    (16, 2),
    }

    # -------------------------------------------------------------------
    # Detection
    # -------------------------------------------------------------------

    def can_parse(self, data: list[list]) -> bool:
        """
        Recognises Viettel format by the presence of PII values at fixed cells.
        Both sample files have name at (6,2) and phone at (7,2).
        """
        try:
            return (
                len(data) > 16
                and _non_empty(data[6][2])
                and _non_empty(data[7][2])
            )
        except IndexError:
            return False

    # -------------------------------------------------------------------
    # Parsing pipeline
    # -------------------------------------------------------------------

    def parse(self, data: list[list], filename: str = "") -> ParseResult:
        """
        Full Viettel CDR parse:
          1. Extract subscriber PII from fixed cells.
          2. Find header row (usually row 21) via score-based detection.
          3. Build ColumnMap via fuzzy matching; apply fallback for missing fields.
          4. Extract CDR records.
        """
        # 1. Subscriber info
        sub_info = self._extract_subscriber_info(data)

        # 2. Header row — try score-based, fall back to known position 21
        header_row_idx = self._find_header_row(data)

        # 3. Column mapping
        header_row = data[header_row_idx] if header_row_idx < len(data) else []
        column_map = self._build_column_map(header_row)
        missing, warnings = self._validate_column_map(column_map)

        # Apply fallback columns for any missing required fields
        if missing:
            column_map = _apply_fallback(column_map)
            missing, warnings = self._validate_column_map(column_map)
            if missing:
                warnings.append(
                    f"Used fallback column positions for: {', '.join(missing)}"
                )

        # 4. Records
        owner_phone = sub_info.phone_normalized or ""
        records = self._extract_records(data, header_row_idx, column_map, owner_phone)

        log.info(
            "Viettel parse complete: phone=%s records=%d header_row=%d",
            owner_phone or "?", len(records), header_row_idx,
        )
        return ParseResult(
            subscriber_info=sub_info,
            records=records,
            column_map=column_map,
            header_row_index=header_row_idx,
            missing_required=missing,
            warnings=warnings,
        )

    # -------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------

    def _find_header_row(self, data: list[list]) -> int:
        """
        Prefer row 21 (confirmed in real files). Falls back to score-based
        detection if row 21 does not look like a header.
        """
        # Quick check: does row 21 contain CDR-like keywords?
        if len(data) > 21:
            row21 = data[21]
            non_null = sum(1 for c in row21 if c is not None and str(c).strip())
            if non_null >= 4:
                # Verify at least one CDR keyword is present
                row21_text = " ".join(str(c).lower() for c in row21 if c)
                if any(
                    kw in row21_text
                    for kw in ("số đi", "so di", "thời gian", "imei", "lac", "a_subs")
                ):
                    return 21

        # Score-based fallback
        from ..normalizers.provider_detector import find_header_row
        try:
            return find_header_row(data)
        except ValueError:
            return 21  # last resort — use known position

    def _extract_subscriber_info(self, data: list[list]) -> RawSubscriberInfo:
        """Pull subscriber PII from the fixed cell addresses in SUBSCRIBER_PII_MAP."""
        values: dict[str, str | None] = {}
        for field_name, (row_i, col_i) in self.SUBSCRIBER_PII_MAP.items():
            try:
                val = data[row_i][col_i]
                values[field_name] = str(val).strip() if val is not None else None
            except IndexError:
                values[field_name] = None

        # Normalize phone: stored without leading 0 in the file
        from ..utils.phone_utils import normalize_phone
        phone_raw  = values.get("phone_raw")
        phone_norm = normalize_phone(phone_raw or "") if phone_raw else None

        return RawSubscriberInfo(
            phone_raw=phone_raw,
            phone_normalized=phone_norm,
            full_name=values.get("full_name"),
            date_of_birth=values.get("date_of_birth"),
            address=values.get("address"),
            id_doc_type=values.get("id_doc_type"),
            id_doc_number=values.get("id_doc_number"),
            id_issue_date=values.get("id_issue_date"),
            id_issue_authority=values.get("id_issue_authority"),
            activation_date=values.get("activation_date"),
            subscription_type=values.get("subscription_type"),
            account_status=values.get("account_status"),
            document_ref=values.get("document_ref"),
            report_from=values.get("report_from"),
            report_to=values.get("report_to"),
        )

    def _extract_records(
        self,
        data: list[list],
        header_row: int,
        column_map: ColumnMap,
        owner_phone: str,
    ) -> list[RawCDRRecord]:
        """
        Iterate data rows from header_row+1 onward.
        Each row maps to one RawCDRRecord; direction is resolved inline.
        """
        from ..normalizers.phone_normalizer import resolve_direction

        records: list[RawCDRRecord] = []

        for row_num, row in enumerate(data[header_row + 1:], start=1):
            # Skip rows that are entirely empty
            if not any(c is not None and str(c).strip() for c in row):
                continue

            src_raw = _get(row, column_map.source_number) or ""
            tgt_raw = _get(row, column_map.target_number) or ""

            # resolve_direction uses owner_phone to determine in/out/service
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

        return records


# ---------------------------------------------------------------------------
# Module helpers
# ---------------------------------------------------------------------------

def _non_empty(val: object) -> bool:
    return val is not None and str(val).strip() != ""


def _get(row: list, col_idx: int | None) -> str | None:
    """Safely retrieve a cell value as a stripped string, or None."""
    if col_idx is None or col_idx >= len(row):
        return None
    val = row[col_idx]
    return str(val).strip() if val is not None else None


def _apply_fallback(column_map: ColumnMap) -> ColumnMap:
    """Apply known fixed column positions for any undetected fields."""
    for field_name, col in _FALLBACK_COLUMNS.items():
        if getattr(column_map, field_name) is None:
            setattr(column_map, field_name, col)
    return column_map
