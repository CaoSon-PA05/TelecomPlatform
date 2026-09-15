"""
Import Service — orchestrates the full file-to-database pipeline.

Pipeline
--------
  Excel file
    → read_excel_to_array
    → auto_detect_parser  (filename → content fallback)
    → parser.parse()      → ParseResult
    → normalize each row  (phone, timestamp, duration, province)
    → upsert Subscriber
    → create ImportBatch  (status=pending, commit)
    → get_or_create Device (per IMEI)
    → get_or_create CellTower (per LAC+CID)
    → bulk_insert CDRRecords
    → rebuild_stats (contacts, IMEI, time, location)
    → update ImportBatch  (status=success, commit)
    → return ImportResult

Transaction strategy — two-phase commit:
  Phase 1: subscriber upsert + batch row (status=pending) — committed immediately
           so that a crash in Phase 2 still leaves an auditable FAILED batch.
  Phase 2: CDR inserts + stats rebuilds + status update (success/failed) — one commit.
           On failure: rollback Phase 2 data, update batch to FAILED, re-commit.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from ..parsers import auto_detect_parser, parse_file
from ..parsers.base_parser import ParseResult
from ..schemas.import_schema import ImportResult
from ..schemas.subscriber_schema import RawSubscriberInfo
from ..normalizers.date_normalizer import normalize_date, normalize_duration, normalize_timestamp
from ..normalizers.phone_normalizer import resolve_direction
from ..normalizers.province_normalizer import normalize_province
from ..utils.constants import IMEI_LENGTH, SERVICE_DIRECTION_MAP
from ..utils.file_utils import extract_phone_from_filename
from ..utils.phone_utils import detect_carrier

from backend.database.models.subscriber import Subscriber
from backend.database.models.import_batch import ImportBatch
from backend.database.models.cdr_record import CDRRecord
from backend.database.models.device import Device
from backend.database.models.cell_tower import CellTower
from backend.database.models.contact_profile import ContactProfile
from backend.database.models.device_subscription import DeviceSubscription
from backend.database.models.stats import (
    HourlyActivityStat,
    WeeklyActivityStat,
    TowerFrequencyStat,
)
from backend.database.models.enums import (
    AccountStatus,
    Carrier,
    CommType,
    Direction,
    ImportStatus,
    ServiceCategory,
    SubscriptionType,
)
from .stats_service import StatsService

log = logging.getLogger("telecom.services.import")

# ---------------------------------------------------------------------------
# Subscription type raw-string → enum mapping
# ---------------------------------------------------------------------------
_SUB_TYPE_MAP: dict[str, SubscriptionType] = {
    "tra truoc": SubscriptionType.PREPAID,
    "prepaid":   SubscriptionType.PREPAID,
    "tra sau":   SubscriptionType.POSTPAID,
    "postpaid":  SubscriptionType.POSTPAID,
    "trả trước": SubscriptionType.PREPAID,
    "trả sau":   SubscriptionType.POSTPAID,
}

_ACC_STATUS_MAP: dict[str, AccountStatus] = {
    "active":     AccountStatus.ACTIVE,
    "hoat dong":  AccountStatus.ACTIVE,
    "hoạt động":  AccountStatus.ACTIVE,
    "inactive":   AccountStatus.INACTIVE,
    "khoa":       AccountStatus.INACTIVE,
    "khóa":       AccountStatus.INACTIVE,
    "suspended":  AccountStatus.SUSPENDED,
    "tam khoa":   AccountStatus.SUSPENDED,
    "tạm khóa":   AccountStatus.SUSPENDED,
}

_CARRIER_VALUES = {e.value for e in Carrier}
_IMPORT_STATUS_VALUES = {e.value for e in ImportStatus}


# ---------------------------------------------------------------------------
# ImportService
# ---------------------------------------------------------------------------

class ImportService:

    def __init__(self, db: Session) -> None:
        self.db = db
        self._stats = StatsService(db)

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    def import_file(self, path: Path, template_override: str | None = None) -> ImportResult:
        """
        Full import pipeline for one Excel file.
        Creates or updates subscriber, creates batch record, inserts CDR rows.
        Triggers stats rebuild for the subscriber on success.
        Returns ImportResult with counts and any warnings.
        """
        # ── Step 1: Parse ───────────────────────────────────────────────────
        parse_result = self._parse(path, template_override)
        raw_info = parse_result.subscriber_info

        owner_phone = raw_info.phone_normalized or ""
        if not owner_phone:
            owner_phone = extract_phone_from_filename(path.name) or ""
        if not owner_phone:
            raise ValueError(
                f"Cannot determine subscriber phone number from '{path.name}'. "
                "Check that the filename contains a 10-digit Vietnamese phone number."
            )

        carrier = detect_carrier(owner_phone) or "unknown"

        log.info(
            "Importing '%s': phone=%s carrier=%s records=%d",
            path.name, owner_phone, carrier, len(parse_result.records),
        )

        # Backfill phone_normalized onto raw_info if it was resolved from filename.
        # _upsert_subscriber reads raw_info.phone_normalized directly.
        if not raw_info.phone_normalized:
            raw_info.phone_normalized = owner_phone

        # ── Phase 1 commit: subscriber + batch (status=pending) ─────────────
        subscriber_id = self._upsert_subscriber(raw_info, carrier)
        batch_id = self._create_batch(
            subscriber_id=subscriber_id,
            filename=path.name,
            raw_info=raw_info,
            template=carrier,
            status=ImportStatus.PENDING.value,
        )
        self.db.commit()
        log.debug("Phase 1 committed: sub_id=%d batch_id=%d", subscriber_id, batch_id)

        # ── Phase 2: CDR insert + stats + status update ──────────────────────
        count = 0
        try:
            count = self._process_records(
                parse_result=parse_result,
                subscriber_id=subscriber_id,
                batch_id=batch_id,
                owner_phone=owner_phone,
            )

            self._rebuild_stats(subscriber_id)

            batch = self.db.get(ImportBatch, batch_id)
            batch.import_status = ImportStatus.SUCCESS
            batch.total_records = count
            self.db.commit()

            log.info(
                "Import success: batch_id=%d sub=%s records=%d",
                batch_id, owner_phone, count,
            )

        except Exception as exc:
            log.exception("Import failed batch_id=%d: %s", batch_id, exc)
            self.db.rollback()
            batch = self.db.get(ImportBatch, batch_id)
            if batch:
                batch.import_status = ImportStatus.FAILED
                batch.error_message = str(exc)[:500]
                self.db.commit()
            raise

        return ImportResult(
            batch_id=batch_id,
            subscriber_id=subscriber_id,
            phone_normalized=owner_phone,
            template_used=carrier,
            records_imported=count,
            missing_columns=parse_result.missing_required,
            warnings=parse_result.warnings,
            success=True,
        )

    def import_multiple(
        self, paths: list[Path], template_override: str | None = None
    ) -> list[ImportResult]:
        """Import multiple files sequentially; collects all results."""
        results = []
        for path in paths:
            try:
                results.append(self.import_file(path, template_override))
            except Exception as exc:
                log.error("Failed to import '%s': %s", path.name, exc)
                results.append(
                    ImportResult(
                        batch_id=-1,
                        subscriber_id=-1,
                        phone_normalized="",
                        template_used="",
                        records_imported=0,
                        success=False,
                        warnings=[f"Import failed: {exc}"],
                    )
                )
        return results

    # -----------------------------------------------------------------------
    # Private helpers — Phase 1
    # -----------------------------------------------------------------------

    def _upsert_subscriber(self, raw_info: RawSubscriberInfo, carrier: str) -> int:
        """
        Create subscriber if phone not in DB; update PII fields if already exists.
        Returns subscriber_id.
        """
        phone = raw_info.phone_normalized
        if not phone:
            raise ValueError("Subscriber phone_normalized is required for DB insert.")

        sub = (
            self.db.query(Subscriber)
            .filter(Subscriber.phone_normalized == phone)
            .one_or_none()
        )

        carrier_enum = (
            Carrier(carrier) if carrier in _CARRIER_VALUES else Carrier.UNKNOWN
        )
        dob        = normalize_date(raw_info.date_of_birth)
        issue_date = normalize_date(raw_info.id_issue_date)
        act_date   = normalize_date(raw_info.activation_date)
        sub_type   = _map_sub_type(raw_info.subscription_type)
        acc_status = _map_acc_status(raw_info.account_status)

        if sub is None:
            sub = Subscriber(
                phone_normalized=phone,
                phone_raw=raw_info.phone_raw,
                carrier=carrier_enum,
                full_name=raw_info.full_name,
                date_of_birth=dob,
                address=raw_info.address,
                id_doc_type=raw_info.id_doc_type,
                id_doc_number=raw_info.id_doc_number,
                id_issue_date=issue_date,
                id_issue_authority=raw_info.id_issue_authority,
                activation_date=act_date,
                subscription_type=sub_type,
                account_status=acc_status,
            )
            self.db.add(sub)
            self.db.flush()
            log.debug("Created subscriber %s", phone)
        else:
            # Update non-null PII — newer import wins
            if raw_info.full_name:       sub.full_name = raw_info.full_name
            if dob:                      sub.date_of_birth = dob
            if raw_info.address:         sub.address = raw_info.address
            if raw_info.id_doc_type:     sub.id_doc_type = raw_info.id_doc_type
            if raw_info.id_doc_number:   sub.id_doc_number = raw_info.id_doc_number
            if issue_date:               sub.id_issue_date = issue_date
            if raw_info.id_issue_authority: sub.id_issue_authority = raw_info.id_issue_authority
            if act_date:                 sub.activation_date = act_date
            if sub_type:                 sub.subscription_type = sub_type
            if acc_status:               sub.account_status = acc_status
            sub.carrier = carrier_enum
            self.db.flush()
            log.debug("Updated subscriber %s (id=%d)", phone, sub.id)

        return sub.id

    def _create_batch(
        self,
        subscriber_id: int,
        filename: str,
        raw_info: RawSubscriberInfo,
        template: str,
        status: str,
    ) -> int:
        """Insert import_batches row. Returns batch_id."""
        carrier_enum = (
            Carrier(template) if template in _CARRIER_VALUES else Carrier.UNKNOWN
        )
        import_status_enum = (
            ImportStatus(status)
            if status in _IMPORT_STATUS_VALUES
            else ImportStatus.PENDING
        )

        batch = ImportBatch(
            subscriber_id=subscriber_id,
            source_file_name=filename,
            document_ref=raw_info.document_ref,
            report_period_from=normalize_date(raw_info.report_from),
            report_period_to=normalize_date(raw_info.report_to),
            template_detected=carrier_enum,
            import_status=import_status_enum,
        )
        self.db.add(batch)
        self.db.flush()
        return batch.id

    # -----------------------------------------------------------------------
    # Private helpers — Phase 2
    # -----------------------------------------------------------------------

    def _get_or_create_device(self, imei_raw: str) -> Optional[int]:
        """
        Normalize IMEI; look up devices table; create if not found.
        Returns device_id or None for empty/invalid IMEI.
        """
        if not imei_raw:
            return None
        digits = "".join(c for c in imei_raw if c.isdigit())
        if len(digits) != IMEI_LENGTH:
            return None

        device = (
            self.db.query(Device).filter(Device.imei == digits).one_or_none()
        )
        if device is None:
            device = Device(imei=digits, is_valid=True)
            self.db.add(device)
            self.db.flush()

        return device.id

    def _get_or_create_tower(
        self,
        lac_raw: str,
        cell_id_raw: str,
        province_code_raw: str,
        bts_address: str,
    ) -> Optional[int]:
        """
        Look up cell_towers by (lac, cell_id); create if not found.
        Updates bts_address and province_name if new info is available.
        Returns tower_id or None for missing location data.
        """
        lac    = _safe_int(lac_raw)
        cel_id = _safe_int(cell_id_raw)
        if lac is None or cel_id is None:
            return None

        tower = (
            self.db.query(CellTower)
            .filter(CellTower.lac == lac, CellTower.cell_id == cel_id)
            .one_or_none()
        )

        province_name = normalize_province(province_code_raw) if province_code_raw else None

        if tower is None:
            tower = CellTower(
                lac=lac,
                cell_id=cel_id,
                province_code_raw=province_code_raw or None,
                province_name=province_name,
                bts_address=bts_address or None,
            )
            self.db.add(tower)
            self.db.flush()
        else:
            if bts_address and not tower.bts_address:
                tower.bts_address = bts_address
            if province_code_raw and not tower.province_code_raw:
                tower.province_code_raw = province_code_raw
            if province_name and not tower.province_name:
                tower.province_name = province_name
            self.db.flush()

        return tower.id

    def _bulk_insert_records(
        self, subscriber_id: int, batch_id: int, normalized_rows: list
    ) -> int:
        """Bulk insert normalized CDRRecordCreate objects. Returns count inserted."""
        if not normalized_rows:
            return 0
        self.db.bulk_insert_mappings(CDRRecord, normalized_rows)  # type: ignore[arg-type]
        self.db.flush()
        return len(normalized_rows)

    # -----------------------------------------------------------------------
    # Core orchestration — called from import_file Phase 2
    # -----------------------------------------------------------------------

    def _process_records(
        self,
        parse_result: ParseResult,
        subscriber_id: int,
        batch_id: int,
        owner_phone: str,
    ) -> int:
        """
        Normalize every raw CDR row → resolve device/tower IDs → bulk insert.
        Returns the number of rows successfully inserted.
        """
        rows: list[dict] = []
        skipped = 0

        for raw in parse_result.records:
            ts = normalize_timestamp(raw.timestamp_raw)
            if ts is None:
                skipped += 1
                continue  # skip rows without a parseable timestamp

            contact, direction = resolve_direction(
                raw.source_number_raw or "",
                raw.target_number_raw or "",
                owner_phone,
            )

            device_id = self._get_or_create_device(raw.imei_raw or "")
            tower_id  = self._get_or_create_tower(
                raw.lac_raw or "",
                raw.cell_id_raw or "",
                raw.province_code_raw or "",
                raw.bts_address_raw or "",
            )

            comm_type_str = (raw.comm_type_raw or "SMS").upper()
            comm_type_enum = (
                CommType(comm_type_str)
                if comm_type_str in {e.value for e in CommType}
                else CommType.SMS
            )

            direction_enum = (
                Direction(direction)
                if direction in {e.value for e in Direction}
                else Direction.INCOMING
            )

            service_cat_raw = SERVICE_DIRECTION_MAP.get(raw.service_direction_raw or "")
            service_cat_enum: Optional[ServiceCategory] = None
            if service_cat_raw and service_cat_raw in {e.value for e in ServiceCategory}:
                service_cat_enum = ServiceCategory(service_cat_raw)

            rows.append({
                "subscriber_id":        subscriber_id,
                "batch_id":             batch_id,
                "source_file_row":      raw.source_file_row,
                "source_number_raw":    raw.source_number_raw or "",
                "target_number_raw":    raw.target_number_raw or "",
                "owner_phone":          owner_phone,
                "contact_number":       contact,
                "direction":            direction_enum,
                "recorded_at":          ts,
                "duration_seconds":     normalize_duration(raw.duration_raw),
                "comm_type":            comm_type_enum,
                "service_direction_raw": raw.service_direction_raw,
                "service_category":     service_cat_enum,
                "device_id":            device_id,
                "province_code_raw":    raw.province_code_raw or None,
                "tower_id":             tower_id,
                # bulk_insert_mappings bypasses ORM-side defaults (default=func.now()).
                # Provide created_at explicitly to avoid NOT NULL IntegrityError.
                "created_at":           datetime.utcnow(),
            })

        if skipped:
            log.warning("Skipped %d rows with unparseable timestamp.", skipped)

        count = self._bulk_insert_records(subscriber_id, batch_id, rows)
        log.debug("Inserted %d CDR records (skipped=%d).", count, skipped)
        return count

    # -----------------------------------------------------------------------
    # Stats rebuild — full DELETE + INSERT (idempotent, re-import safe)
    # -----------------------------------------------------------------------

    def _rebuild_stats(self, subscriber_id: int) -> None:
        """
        Recompute all pre-aggregated stat tables for subscriber_id.
        ContactProfile annotations (zalo_id, facebook_url, telegram_id, notes)
        are preserved across recomputes.
        Called after every successful CDR bulk insert.
        """
        self.db.flush()  # ensure CDR rows are visible in the session

        # Load all CDR records for this subscriber (already in session after flush)
        records = (
            self.db.query(CDRRecord)
            .filter(CDRRecord.subscriber_id == subscriber_id)
            .all()
        )
        now = datetime.utcnow()

        self._rebuild_contact_profiles(subscriber_id, records, now)
        self._rebuild_hourly_stats(subscriber_id, records, now)
        self._rebuild_weekly_stats(subscriber_id, records, now)
        self._rebuild_tower_stats(subscriber_id, records, now)
        self._rebuild_device_subscriptions(subscriber_id, records, now)

        self.db.flush()
        log.debug("Stats rebuilt for subscriber_id=%d (%d records).", subscriber_id, len(records))

    def _rebuild_contact_profiles(
        self, subscriber_id: int, records: list, now: datetime
    ) -> None:
        """DELETE + re-INSERT contact_profiles, preserving investigator annotations."""
        # Preserve existing annotations keyed by contact_phone
        existing: dict[str, ContactProfile] = {
            cp.contact_phone: cp
            for cp in self.db.query(ContactProfile)
            .filter(ContactProfile.subscriber_id == subscriber_id)
            .all()
        }

        stats: dict[str, dict] = defaultdict(lambda: {
            "total": 0, "out": 0, "in_": 0, "voice": 0, "sms": 0,
            "first": None, "last": None,
        })
        for r in records:
            if not r.contact_number:
                continue
            s = stats[r.contact_number]
            s["total"] += 1
            if r.direction == Direction.OUTGOING:  s["out"]   += 1
            elif r.direction == Direction.INCOMING: s["in_"]  += 1
            if r.comm_type == CommType.VOICE:       s["voice"] += 1
            else:                                    s["sms"]   += 1
            if s["first"] is None or r.recorded_at < s["first"]: s["first"] = r.recorded_at
            if s["last"]  is None or r.recorded_at > s["last"]:  s["last"]  = r.recorded_at

        self.db.query(ContactProfile).filter(
            ContactProfile.subscriber_id == subscriber_id
        ).delete(synchronize_session=False)

        for phone, s in stats.items():
            old = existing.get(phone)
            self.db.add(ContactProfile(
                subscriber_id=subscriber_id,
                contact_phone=phone,
                total_count=s["total"],
                outgoing_count=s["out"],
                incoming_count=s["in_"],
                voice_count=s["voice"],
                sms_count=s["sms"],
                first_interaction_at=s["first"],
                last_interaction_at=s["last"],
                zalo_id=      old.zalo_id       if old else None,
                facebook_url= old.facebook_url  if old else None,
                telegram_id=  old.telegram_id   if old else None,
                notes=        old.notes         if old else None,
            ))

    def _rebuild_hourly_stats(
        self, subscriber_id: int, records: list, now: datetime
    ) -> None:
        """Rebuild 24-hour activity histogram (0–23)."""
        self.db.query(HourlyActivityStat).filter(
            HourlyActivityStat.subscriber_id == subscriber_id
        ).delete(synchronize_session=False)

        buckets: dict[int, dict] = defaultdict(lambda: {
            "total": 0, "voice": 0, "sms": 0, "out": 0, "in_": 0,
        })
        for r in records:
            h = r.recorded_at.hour
            b = buckets[h]
            b["total"] += 1
            if r.comm_type == CommType.VOICE:       b["voice"] += 1
            else:                                    b["sms"]   += 1
            if r.direction == Direction.OUTGOING:   b["out"]   += 1
            elif r.direction == Direction.INCOMING: b["in_"]   += 1

        for hour, b in buckets.items():
            self.db.add(HourlyActivityStat(
                subscriber_id=subscriber_id,
                hour_of_day=hour,
                total_count=b["total"],
                voice_count=b["voice"],
                sms_count=b["sms"],
                outgoing_count=b["out"],
                incoming_count=b["in_"],
                computed_at=now,
            ))

    def _rebuild_weekly_stats(
        self, subscriber_id: int, records: list, now: datetime
    ) -> None:
        """Rebuild day-of-week histogram (0=Monday … 6=Sunday)."""
        self.db.query(WeeklyActivityStat).filter(
            WeeklyActivityStat.subscriber_id == subscriber_id
        ).delete(synchronize_session=False)

        buckets: dict[int, dict] = defaultdict(lambda: {
            "total": 0, "voice": 0, "sms": 0,
        })
        for r in records:
            d = r.recorded_at.weekday()  # 0=Monday per Python convention
            b = buckets[d]
            b["total"] += 1
            if r.comm_type == CommType.VOICE: b["voice"] += 1
            else:                              b["sms"]   += 1

        for day, b in buckets.items():
            self.db.add(WeeklyActivityStat(
                subscriber_id=subscriber_id,
                day_of_week=day,
                total_count=b["total"],
                voice_count=b["voice"],
                sms_count=b["sms"],
                computed_at=now,
            ))

    def _rebuild_tower_stats(
        self, subscriber_id: int, records: list, now: datetime
    ) -> None:
        """Rebuild tower visit frequency per subscriber."""
        self.db.query(TowerFrequencyStat).filter(
            TowerFrequencyStat.subscriber_id == subscriber_id
        ).delete(synchronize_session=False)

        tower_stats: dict[int, dict] = defaultdict(lambda: {
            "total": 0, "first": None, "last": None,
        })
        for r in records:
            if r.tower_id is None:
                continue
            s = tower_stats[r.tower_id]
            s["total"] += 1
            if s["first"] is None or r.recorded_at < s["first"]: s["first"] = r.recorded_at
            if s["last"]  is None or r.recorded_at > s["last"]:  s["last"]  = r.recorded_at

        for tower_id, s in tower_stats.items():
            self.db.add(TowerFrequencyStat(
                subscriber_id=subscriber_id,
                tower_id=tower_id,
                total_count=s["total"],
                first_seen_at=s["first"],
                last_seen_at=s["last"],
                computed_at=now,
            ))

    def _rebuild_device_subscriptions(
        self, subscriber_id: int, records: list, now: datetime
    ) -> None:
        """Rebuild device subscription timeline from CDR facts."""
        self.db.query(DeviceSubscription).filter(
            DeviceSubscription.subscriber_id == subscriber_id
        ).delete(synchronize_session=False)

        dev_stats: dict[int, dict] = defaultdict(lambda: {
            "total": 0, "first": None, "last": None,
        })
        for r in records:
            if r.device_id is None:
                continue
            s = dev_stats[r.device_id]
            s["total"] += 1
            if s["first"] is None or r.recorded_at < s["first"]: s["first"] = r.recorded_at
            if s["last"]  is None or r.recorded_at > s["last"]:  s["last"]  = r.recorded_at

        for device_id, s in dev_stats.items():
            self.db.add(DeviceSubscription(
                subscriber_id=subscriber_id,
                device_id=device_id,
                first_seen_at=s["first"],
                last_seen_at=s["last"],
                interaction_count=s["total"],
            ))

    # -----------------------------------------------------------------------
    # Parsing helper
    # -----------------------------------------------------------------------

    @staticmethod
    def _parse(path: Path, template_override: str | None) -> ParseResult:
        """Select parser (auto or forced) and parse the Excel file."""
        if template_override:
            from ..parsers import MobiParser, VinaParser, ViettelParser
            from ..utils.file_utils import read_excel_to_array

            _OVERRIDE: dict[str, object] = {
                "viettel": ViettelParser(),
                "vina":    VinaParser(),
                "mobi":    MobiParser(),
            }
            parser = _OVERRIDE.get(template_override, ViettelParser())
            data   = read_excel_to_array(path)
            return parser.parse(data, filename=path.name)  # type: ignore[union-attr]
        return parse_file(path)


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _map_sub_type(raw: str | None) -> Optional[SubscriptionType]:
    if not raw:
        return None
    return _SUB_TYPE_MAP.get(raw.strip().lower())


def _map_acc_status(raw: str | None) -> Optional[AccountStatus]:
    if not raw:
        return None
    return _ACC_STATUS_MAP.get(raw.strip().lower())


def _safe_int(value: object) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return None
