# TELECOM ANALYTICS — NORMALIZED SCHEMA DESIGN
**Version:** 1.0
**Date:** 2026-05-28
**Based on:** `excel_schema_analysis.md` + `legacy_telecom_analysis.md`

---

## 1. DESIGN PRINCIPLES

| Principle | Decision |
|-----------|---------|
| Provider-independent | No carrier-specific columns in core tables; carrier stored as enum |
| Normalize once, query fast | Pre-computed stats tables for dashboard reads; raw CDR table for ad-hoc |
| Forensic audit trail | Import batch tracking; no hard deletes on CDR records |
| Scalable per-subscriber | All analytics tables partition naturally by `subscriber_id` |
| Nullable-aware | Location, IMEI, duration are frequently null — schema reflects real data |

---

## 2. ENTITY RELATIONSHIP OVERVIEW

```
                         ┌──────────────────┐
                         │  import_batches  │
                         │  (per-file audit)│
                         └────────┬─────────┘
                                  │ batch_id
                                  │
┌──────────────────┐      ┌───────┴──────────────────────────────────┐
│    subscribers   │──────│              cdr_records                  │
│  (PII + SIM info)│  1:N │  (one row = one CDR event from Excel)     │
└──────────┬───────┘      └───┬───────────────┬──────────────────────┘
           │                  │ tower_id       │ device_id
           │ 1:N              │                │
           │         ┌────────▼──────┐  ┌──────▼──────────┐
           │         │  cell_towers  │  │    devices       │
           │         │  (LAC + CID)  │  │   (IMEI reg.)   │
           │         └───────────────┘  └─────────┬───────┘
           │                                       │
           │  1:N                                  │ N:M via
           │                            ┌──────────▼──────────────┐
           ├──────────────────────────► │   device_subscriptions  │
           │                            │  (IMEI swap timeline)   │
           │  1:N                        └─────────────────────────┘
           │
           ├──────────────────────────► contact_profiles
           │                            (per-subscriber contact freq.)
           │  1:N (pre-computed)
           │
           ├──────────────────────────► hourly_activity_stats
           ├──────────────────────────► weekly_activity_stats
           └──────────────────────────► tower_frequency_stats
```

---

## 3. TABLE DEFINITIONS

---

### 3.1 `subscribers`

The master subject table. One row per investigated phone number.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | INTEGER | PK, autoincrement | |
| `phone_normalized` | VARCHAR(15) | UNIQUE, NOT NULL | With leading 0: `0969619929` |
| `phone_raw` | VARCHAR(20) | nullable | As stored in Excel: `969619929` |
| `carrier` | ENUM | NOT NULL | `viettel / vina / mobi / unknown` |
| `full_name` | VARCHAR(200) | nullable | From `Họ Tên` field |
| `date_of_birth` | DATE | nullable | From `Ngày sinh` |
| `address` | TEXT | nullable | From `Địa chỉ` |
| `id_doc_type` | VARCHAR(20) | nullable | `CCCD`, `CMND`, etc. |
| `id_doc_number` | VARCHAR(30) | nullable | From `Số giấy tờ` |
| `id_issue_date` | DATE | nullable | From `Ngày cấp` |
| `id_issue_authority` | TEXT | nullable | From `Nơi cấp` |
| `activation_date` | DATE | nullable | From `Ngày kích hoạt` |
| `subscription_type` | ENUM | nullable | `prepaid / postpaid` |
| `account_status` | ENUM | nullable | `active / inactive / suspended` |
| `notes` | TEXT | nullable | Investigator notes |
| `created_at` | DATETIME | NOT NULL | |
| `updated_at` | DATETIME | NOT NULL | |

**Indexes:** `phone_normalized` (unique), `full_name`, `id_doc_number`

---

### 3.2 `import_batches`

One row per imported Excel file. Provides audit trail and links CDR records to their source file.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | INTEGER | PK, autoincrement | |
| `subscriber_id` | INTEGER | FK → subscribers.id | |
| `source_file_name` | VARCHAR(255) | NOT NULL | Original filename |
| `document_ref` | VARCHAR(50) | nullable | `Cong van` number (e.g. `11220`) |
| `report_period_from` | DATE | nullable | `Tu ngay` |
| `report_period_to` | DATE | nullable | `Den ngay` |
| `template_detected` | ENUM | nullable | `viettel / vina / mobi` |
| `total_records` | INTEGER | nullable | Count of CDR rows imported |
| `import_status` | ENUM | NOT NULL | `pending / success / failed` |
| `error_message` | TEXT | nullable | Parse error detail if failed |
| `imported_at` | DATETIME | NOT NULL | |

**Indexes:** `subscriber_id`, `document_ref`, `imported_at`

---

### 3.3 `cell_towers`

Registry of unique BTS towers identified from CDR data. `(lac, cell_id)` is the natural key.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | INTEGER | PK, autoincrement | |
| `lac` | INTEGER | NOT NULL | Location Area Code |
| `cell_id` | INTEGER | NOT NULL | Cell/BTS identifier |
| `carrier` | ENUM | nullable | `viettel / vina / mobi / unknown` |
| `province_code_raw` | VARCHAR(10) | nullable | As in CDR: `TNH`, `T066`, `HCM` |
| `province_name` | VARCHAR(100) | nullable | Normalized: `Tay Ninh` |
| `bts_address` | TEXT | nullable | Full Vietnamese address from CDR |
| `latitude` | FLOAT | nullable | From external lookup or manual |
| `longitude` | FLOAT | nullable | From external lookup or manual |
| `google_maps_url` | TEXT | nullable | Manually assigned by investigator |
| `notes` | TEXT | nullable | |
| `created_at` | DATETIME | NOT NULL | |
| `updated_at` | DATETIME | NOT NULL | |

**Constraints:** UNIQUE `(lac, cell_id)`
**Indexes:** `(lac, cell_id)`, `province_name`, `(latitude, longitude)`

> **Why `province_code_raw` + `province_name`:** The same province appears as both `TNH` and `T066` in real files. Store both; normalize via lookup table at import time.

---

### 3.4 `devices`

IMEI registry. One row per unique device seen across all CDR data.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | INTEGER | PK, autoincrement | |
| `imei` | VARCHAR(15) | UNIQUE, NOT NULL | 15-digit string |
| `is_valid` | BOOLEAN | NOT NULL | True if 15 numeric digits |
| `device_model` | VARCHAR(200) | nullable | From imei.info lookup |
| `manufacturer` | VARCHAR(100) | nullable | |
| `lookup_completed_at` | DATETIME | nullable | When lookup was done |
| `lookup_source` | VARCHAR(50) | nullable | `imei.info`, `manual`, etc. |
| `notes` | TEXT | nullable | Investigator notes |
| `created_at` | DATETIME | NOT NULL | |
| `updated_at` | DATETIME | NOT NULL | |

**Indexes:** `imei` (unique), `manufacturer`

---

### 3.5 `cdr_records`

Core fact table. One row per CDR event from the Excel files. Immutable after import.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | INTEGER | PK, autoincrement | |
| `subscriber_id` | INTEGER | FK → subscribers.id, NOT NULL | |
| `batch_id` | INTEGER | FK → import_batches.id, NOT NULL | |
| `source_file_row` | INTEGER | NOT NULL | Original `#` from Excel |
| `source_number_raw` | VARCHAR(100) | NOT NULL | Raw `So di` (may be service name) |
| `target_number_raw` | VARCHAR(100) | NOT NULL | Raw `So den` |
| `owner_phone` | VARCHAR(15) | NOT NULL | Normalized subscriber phone |
| `contact_number` | VARCHAR(15) | nullable | NULL for service senders (MBBANK etc.) |
| `direction` | ENUM | NOT NULL | `outgoing / incoming / service` |
| `recorded_at` | DATETIME | NOT NULL | Parsed from `Thoi gian` (UTC+7) |
| `duration_seconds` | INTEGER | nullable | NULL for SMS; integer for VOICE |
| `comm_type` | ENUM | NOT NULL | `VOICE / SMS` |
| `service_direction_raw` | VARCHAR(50) | nullable | Raw Direction column value |
| `service_category` | ENUM | nullable | `onnet / offnet / vas / international` |
| `device_id` | INTEGER | FK → devices.id, nullable | NULL when IMEI not present |
| `province_code_raw` | VARCHAR(10) | nullable | As-is from CDR |
| `tower_id` | INTEGER | FK → cell_towers.id, nullable | NULL when LAC/Cell missing |
| `created_at` | DATETIME | NOT NULL | |

**Indexes:**
- `(subscriber_id, recorded_at)` — primary analytics access pattern
- `(contact_number)` — contact frequency queries
- `(tower_id)` — location analysis
- `(device_id)` — IMEI analysis
- `(subscriber_id, comm_type)` — voice vs SMS breakdown
- `(subscriber_id, direction)` — outgoing vs incoming

> **Immutable after import.** No UPDATE on this table. Re-import with a new `batch_id` to correct data.

---

### 3.6 `contact_profiles`

Per-subscriber contact relationship cache. Pre-computed from CDR records.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | INTEGER | PK, autoincrement | |
| `subscriber_id` | INTEGER | FK → subscribers.id, NOT NULL | |
| `contact_phone` | VARCHAR(15) | NOT NULL | Normalized |
| `contact_phone_raw` | VARCHAR(20) | nullable | As found in CDR |
| `carrier` | ENUM | nullable | Detected from prefix |
| `total_count` | INTEGER | NOT NULL, DEFAULT 0 | All interactions |
| `outgoing_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `incoming_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `voice_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `sms_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `first_interaction_at` | DATETIME | nullable | |
| `last_interaction_at` | DATETIME | nullable | |
| `zalo_id` | VARCHAR(100) | nullable | Investigator annotation |
| `facebook_url` | VARCHAR(300) | nullable | |
| `telegram_id` | VARCHAR(100) | nullable | |
| `notes` | TEXT | nullable | |
| `created_at` | DATETIME | NOT NULL | |
| `updated_at` | DATETIME | NOT NULL | |

**Constraints:** UNIQUE `(subscriber_id, contact_phone)`
**Indexes:** `(subscriber_id, total_count DESC)`, `contact_phone`

---

### 3.7 `device_subscriptions`

Junction: which subscriber used which device, and when. Enables IMEI swap timeline forensics.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | INTEGER | PK, autoincrement | |
| `subscriber_id` | INTEGER | FK → subscribers.id, NOT NULL | |
| `device_id` | INTEGER | FK → devices.id, NOT NULL | |
| `first_seen_at` | DATETIME | NOT NULL | First CDR using this IMEI |
| `last_seen_at` | DATETIME | NOT NULL | Last CDR using this IMEI |
| `interaction_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `created_at` | DATETIME | NOT NULL | |
| `updated_at` | DATETIME | NOT NULL | |

**Constraints:** UNIQUE `(subscriber_id, device_id)`
**Indexes:** `device_id` (for shared-device cross-subscriber queries)

---

### 3.8 `hourly_activity_stats`

Pre-computed 24-hour histogram per subscriber. Rebuilt from `cdr_records` on demand.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | INTEGER | PK | |
| `subscriber_id` | INTEGER | FK, NOT NULL | |
| `hour_of_day` | SMALLINT | NOT NULL | 0–23 |
| `total_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `voice_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `sms_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `outgoing_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `incoming_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `computed_at` | DATETIME | NOT NULL | |

**Constraints:** UNIQUE `(subscriber_id, hour_of_day)`

---

### 3.9 `weekly_activity_stats`

Pre-computed day-of-week histogram per subscriber.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | INTEGER | PK | |
| `subscriber_id` | INTEGER | FK, NOT NULL | |
| `day_of_week` | SMALLINT | NOT NULL | 0=Monday … 6=Sunday (ISO) |
| `total_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `voice_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `sms_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `computed_at` | DATETIME | NOT NULL | |

**Constraints:** UNIQUE `(subscriber_id, day_of_week)`

---

### 3.10 `tower_frequency_stats`

Pre-computed location frequency per subscriber. Rebuilt from `cdr_records` on demand.

| Column | Type | Constraints | Notes |
|--------|------|------------|-------|
| `id` | INTEGER | PK | |
| `subscriber_id` | INTEGER | FK, NOT NULL | |
| `tower_id` | INTEGER | FK → cell_towers.id, NOT NULL | |
| `total_count` | INTEGER | NOT NULL, DEFAULT 0 | |
| `first_seen_at` | DATETIME | nullable | |
| `last_seen_at` | DATETIME | nullable | |
| `computed_at` | DATETIME | NOT NULL | |

**Constraints:** UNIQUE `(subscriber_id, tower_id)`
**Indexes:** `(subscriber_id, total_count DESC)`, `tower_id`

---

## 4. CROSS-SUBSCRIBER ANALYTICS (SQL VIEWS)

### Shared Contacts
```sql
SELECT cp.contact_phone,
       COUNT(DISTINCT cp.subscriber_id) AS shared_by,
       GROUP_CONCAT(DISTINCT s.phone_normalized) AS owners,
       SUM(cp.total_count) AS total_interactions
FROM contact_profiles cp
JOIN subscribers s ON s.id = cp.subscriber_id
GROUP BY cp.contact_phone
HAVING COUNT(DISTINCT cp.subscriber_id) >= 2
ORDER BY shared_by DESC, total_interactions DESC;
```

### Shared Devices
```sql
SELECT d.imei, d.device_model,
       COUNT(DISTINCT ds.subscriber_id) AS shared_by,
       GROUP_CONCAT(DISTINCT s.phone_normalized) AS owners
FROM device_subscriptions ds
JOIN devices d ON d.id = ds.device_id
JOIN subscribers s ON s.id = ds.subscriber_id
GROUP BY d.id
HAVING COUNT(DISTINCT ds.subscriber_id) >= 2;
```

### Shared Tower Locations
```sql
SELECT ct.lac, ct.cell_id, ct.province_name, ct.bts_address,
       COUNT(DISTINCT tfs.subscriber_id) AS shared_by,
       GROUP_CONCAT(DISTINCT s.phone_normalized) AS owners
FROM tower_frequency_stats tfs
JOIN cell_towers ct ON ct.id = tfs.tower_id
JOIN subscribers s ON s.id = tfs.subscriber_id
GROUP BY ct.id
HAVING COUNT(DISTINCT tfs.subscriber_id) >= 2;
```

### Movement Timeline (per subscriber, ordered)
```sql
SELECT cr.recorded_at, cr.comm_type, cr.direction,
       cr.contact_number, cr.duration_seconds,
       ct.lac, ct.cell_id, ct.province_name,
       ct.bts_address, ct.latitude, ct.longitude
FROM cdr_records cr
LEFT JOIN cell_towers ct ON ct.id = cr.tower_id
WHERE cr.subscriber_id = :subscriber_id
  AND cr.tower_id IS NOT NULL
ORDER BY cr.recorded_at ASC;
```

---

## 5. ENUM REFERENCE

```python
class Carrier(str, Enum):
    VIETTEL = "viettel"
    VINA    = "vina"
    MOBI    = "mobi"
    UNKNOWN = "unknown"

class SubscriptionType(str, Enum):
    PREPAID  = "prepaid"
    POSTPAID = "postpaid"

class AccountStatus(str, Enum):
    ACTIVE    = "active"
    INACTIVE  = "inactive"
    SUSPENDED = "suspended"

class CommType(str, Enum):
    VOICE = "VOICE"
    SMS   = "SMS"

class Direction(str, Enum):
    OUTGOING = "outgoing"
    INCOMING = "incoming"
    SERVICE  = "service"

class ServiceCategory(str, Enum):
    ONNET         = "onnet"
    OFFNET        = "offnet"
    VAS           = "vas"
    INTERNATIONAL = "international"

class ImportStatus(str, Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED  = "failed"
```

---

## 6. PROVINCE CODE NORMALIZATION MAP

Real inconsistency found in sample files — same province uses multiple codes:

| Raw Code | Province (normalized) |
|----------|-----------------------|
| `TNH` | Tay Ninh |
| `T066` | Tay Ninh |
| `HCM` | Ho Chi Minh City |

Store `province_code_raw` verbatim; resolve to `province_name` at import time.

---

## 7. SCALABILITY NOTES

- **SQLite → PostgreSQL:** All queries are standard SQL; SQLAlchemy dialect abstraction handles the switch.
- **Stats tables are idempotent:** Rebuild with DELETE + INSERT from `cdr_records` — no incremental complexity.
- **`cell_towers` and `devices` are global** (not scoped per subscriber), enabling efficient cross-subscriber intersection queries.
- **`cdr_records` is append-only** — no UPDATE path; corrections re-import with a new batch.
- **Future partitioning:** `cdr_records` can be range-partitioned by `recorded_at` as data volume grows.
