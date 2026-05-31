"""
Vinaphone CDR parser — Template 2.

Structure:
  No fixed subscriber PII header section.
  Header row contains columns named 'a_subs' and 'b_subs'.
  Subscriber phone is the most-frequent value in the a_subs (source) column.
  Date range is derived from the min/max timestamp across all records.
"""

from __future__ import annotations

import logging
from collections import Counter

from ..schemas.cdr_schema import RawCDRRecord
from ..schemas.subscriber_schema import RawSubscriberInfo
from .base_parser import BaseParser, ColumnMap, ParseResult

log = logging.getLogger("telecom.parsers.vina")


class VinaParser(BaseParser):

    # -------------------------------------------------------------------
    # Detection
    # -------------------------------------------------------------------

    def can_parse(self, data: list[list]) -> bool:
        """
        True when any of the first 10 rows contains both 'a_subs' and 'b_subs'.
        """
        for row in data[:10]:
            row_lower = [str(c).lower().strip() for c in row if c is not None]
            if (any("a_subs" in c or "a-subs" in c for c in row_lower) and
                    any("b_subs" in c or "b-subs" in c for c in row_lower)):
                return True
        return False

    # -------------------------------------------------------------------
    # Parsing pipeline
    # -------------------------------------------------------------------

    def parse(self, data: list[list], filename: str = "") -> ParseResult:
        """
        1. Find header row containing a_subs / b_subs.
        2. Build ColumnMap.
        3. Extract all CDR records.
        4. Infer subscriber phone from the most-frequent source value.
        5. Build minimal RawSubscriberInfo.
        """
        header_row_idx = self._find_vina_header(data)
        if header_row_idx < 0:
            raise ValueError("Vinaphone header row with a_subs/b_subs not found")

        header_row = data[header_row_idx]
        column_map = self._build_column_map(header_row)
        missing, warnings = self._validate_column_map(column_map)

        # Source column index — needed for phone inference
        source_col = column_map.source_number

        # Extract raw records first (owner_phone determined after)
        raw_rows = data[header_row_idx + 1:]
        owner_phone = self._infer_subscriber_phone(raw_rows, source_col)

        from ..normalizers.phone_normalizer import resolve_direction
        records: list[RawCDRRecord] = []
        for row_num, row in enumerate(raw_rows, start=1):
            if not any(c is not None and str(c).strip() for c in row):
                continue
            src_raw = _get(row, column_map.source_number) or ""
            tgt_raw = _get(row, column_map.target_number) or ""
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

        sub_info = self._build_subscriber_from_records(owner_phone, records, filename)

        log.info(
            "Vina parse complete: phone=%s records=%d header_row=%d",
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

    def _find_vina_header(self, data: list[list]) -> int:
        """Return 0-based index of the row with a_subs + b_subs, or -1."""
        for i, row in enumerate(data[:10]):
            row_lower = [str(c).lower().strip() for c in row if c is not None]
            has_a = any("a_subs" in c or "a-subs" in c for c in row_lower)
            has_b = any("b_subs" in c or "b-subs" in c for c in row_lower)
            if has_a and has_b:
                return i
        return -1

    def _infer_subscriber_phone(
        self,
        data_rows: list[list],
        source_col: int | None,
    ) -> str:
        """
        The most-frequent non-empty, non-service value in the source column
        is the subscriber's own phone number.
        """
        from ..utils.phone_utils import is_service_sender, normalize_phone

        if source_col is None:
            return ""

        counter: Counter = Counter()
        for row in data_rows:
            val = _get(row, source_col)
            if val and not is_service_sender(val):
                norm = normalize_phone(val)
                if norm:
                    counter[norm] += 1

        return counter.most_common(1)[0][0] if counter else ""

    def _build_subscriber_from_records(
        self,
        phone: str,
        records: list[RawCDRRecord],
        filename: str,
    ) -> RawSubscriberInfo:
        """
        Construct a minimal RawSubscriberInfo from inferred data.
        Vinaphone CDR files have no PII header section.
        """
        from ..utils.file_utils import extract_phone_from_filename

        # Prefer phone from filename if records inference failed
        if not phone:
            phone = extract_phone_from_filename(filename) or ""

        timestamps = [r.timestamp_raw for r in records if r.timestamp_raw]

        return RawSubscriberInfo(
            phone_raw=phone.lstrip("0") if phone.startswith("0") else phone,
            phone_normalized=phone or None,
            report_from=min(timestamps) if timestamps else None,
            report_to=max(timestamps) if timestamps else None,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get(row: list, col_idx: int | None) -> str | None:
    if col_idx is None or col_idx >= len(row):
        return None
    val = row[col_idx]
    return str(val).strip() if val is not None else None
