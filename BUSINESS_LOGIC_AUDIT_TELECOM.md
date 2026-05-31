# BUSINESS LOGIC AUDIT — TelecomPlatform (Sentinel CDR Analytics)
**Audited:** 2026-05-31  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Scope:** Full project at `C:\Users\ASUS\OneDrive\Desktop\New folder\Gravity\TelecomPlatform`  
**Status:** Read-only audit — no files modified

---

## 1. PROJECT OVERVIEW

**Platform name:** Sentinel Core — Precision Intelligence Analytics Platform  
**Domain:** CDR (Call Data Record) forensics for law enforcement / intelligence analysis  
**Architecture:** Hybrid — FastAPI (Python) backend + vanilla JS frontend (HTML/CSS/JS)  
**Database:** SQLite (dev) / PostgreSQL (prod) via SQLAlchemy 2.0  
**Processing model:** Two-track — client-side browser parsing (JS) + server-side pipeline (Python)

**Four functional modules:**

| Module Code | Full Name | Purpose |
|-------------|-----------|---------|
| **CDR** | CDR Analyzer | Call Detail Record parsing, analysis, and forensics |
| **GTP** | Geospatial Telemetry Processor | Cell-tower location tracking + movement timeline |
| **FLA** | Financial Ledger Analyzer | Bank transaction analysis + anomaly detection |
| **SRAU** | Secure Endpoint Audit Utility | Decoy link creation and tracking (stub) |

---

## 2. FEATURE INVENTORY

### 2.1 File Upload & Validation

| Feature | Location | Status |
|---------|----------|--------|
| Single file upload (`POST /imports/upload`) | `backend/app/routers/imports.py` | Implemented |
| Batch upload up to 20 files (`POST /imports/upload/batch`) | `backend/app/routers/imports.py` | Implemented |
| Extension validation (`.xlsx`, `.xls` only) | `backend/app/services/upload/validator.py` | Implemented |
| Magic-byte validation (PK header for XLSX, D0CF for XLS) | `backend/app/services/upload/validator.py` | Implemented |
| Streaming size check (never loads full file into memory) | `backend/app/services/upload/validator.py` | Implemented |
| Excel structure check (openpyxl can open it) | `backend/app/services/upload/validator.py` | Implemented |
| Phone extraction from filename (regex `0[3-9]\d{8}`) | `backend/app/services/upload/metadata.py` | Implemented |
| Carrier auto-detection from phone prefix | `backend/app/services/upload/metadata.py` | Implemented |
| CDR sheet auto-selection (keyword scoring) | `backend/app/services/upload/metadata.py` | Implemented |
| Estimated record count (total rows − 22 header rows) | `backend/app/services/upload/metadata.py` | Implemented |
| Concurrent batch upload (semaphore: max 4 at a time) | `backend/app/routers/imports.py` | Implemented |
| Async file storage (aiofiles) | `backend/app/services/upload/handler.py` | Implemented |

### 2.2 CDR Parsing

| Feature | Location | Status |
|---------|----------|--------|
| Viettel CDR format parser | `modules/telecom_analysis/parsers/viettel_parser.py` | Implemented |
| Auto-detect carrier from filename → content | `modules/telecom_analysis/parsers/auto_detector.py` | Implemented |
| Fixed-cell PII extraction (Viettel rows 0–21) | `modules/telecom_analysis/parsers/viettel_parser.py` | Implemented |
| Scored header-row detection | `modules/telecom_analysis/parsers/` | Implemented |
| Fuzzy column mapping with fallbacks | `modules/telecom_analysis/parsers/` | Implemented |
| CDR record extraction (row 22+) | `modules/telecom_analysis/parsers/viettel_parser.py` | Implemented |
| Vina / Mobi format parsers | `modules/telecom_analysis/parsers/` | Partial / stub |

### 2.3 Phone Normalization & Classification

| Feature | Location | Status |
|---------|----------|--------|
| Strip non-digits (spaces, dashes, parentheses) | `modules/telecom_analysis/utils/phone_utils.py` | Implemented |
| Strip country prefix (`84`, `+84`) | `modules/telecom_analysis/utils/phone_utils.py` | Implemented |
| Prepend `0` to 9-digit numbers | `modules/telecom_analysis/utils/phone_utils.py` | Implemented |
| 10-digit validation (`0[3-9]xxxxxxxx`) | `modules/telecom_analysis/utils/phone_utils.py` | Implemented |
| Service sender detection (MBBANK, MyViettel, Apple, etc.) | `modules/telecom_analysis/utils/phone_utils.py` | Implemented |
| Carrier detection from prefix (Viettel/Vina/Mobi) | `modules/telecom_analysis/utils/phone_utils.py` | Implemented |
| Cross-subscriber comparison via last-9 digits | `modules/telecom_analysis/utils/phone_utils.py` | Implemented |
| Direction inference (outgoing / incoming / service) | `modules/telecom_analysis/normalizers/phone_normalizer.py` | Implemented |
| Province code normalization (TNH → Tay Ninh) | `modules/telecom_analysis/utils/constants.py` | Partial |

### 2.4 Database Import Pipeline

| Feature | Location | Status |
|---------|----------|--------|
| Subscriber upsert (create if new, update PII if exists) | `backend/` — planned | Stub |
| ImportBatch record creation | `backend/database/models/import_batch.py` | Model only |
| Device upsert per IMEI | `backend/database/models/device.py` | Model only |
| CellTower upsert per (LAC, CID) | `backend/database/models/cell_tower.py` | Model only |
| Bulk CDRRecord insert | `backend/database/models/cdr_record.py` | Model only |
| ContactProfile aggregation rebuild | `backend/database/models/contact_profile.py` | Model only |
| HourlyActivityStat rebuild (24h histogram) | `backend/database/models/stats.py` | Model only |
| WeeklyActivityStat rebuild (day-of-week) | `backend/database/models/stats.py` | Model only |
| TowerFrequencyStat rebuild | `backend/database/models/stats.py` | Model only |
| DeviceSubscription timeline update | `backend/database/models/device_subscription.py` | Model only |

### 2.5 Analytics & Aggregation

| Feature | Location | Status |
|---------|----------|--------|
| Contact frequency (total/in/out/voice/SMS, date range filter) | `modules/telecom_analysis/analytics/contact_analyzer.py` | Implemented |
| Tower visit frequency per subscriber | `modules/telecom_analysis/analytics/location_analyzer.py` | Implemented |
| Movement timeline (ordered location events + contacts) | `modules/telecom_analysis/analytics/location_analyzer.py` | Implemented |
| 24-hour activity histogram | `backend/database/models/stats.py` | Model only |
| Day-of-week activity histogram | `backend/database/models/stats.py` | Model only |
| Cross-subscriber shared contact query | `backend/app/routers/analytics.py` | Stub (501) |
| Cross-subscriber shared IMEI query | `backend/app/routers/analytics.py` | Stub (501) |
| Cross-subscriber shared tower query | `backend/app/routers/analytics.py` | Stub (501) |
| IMEI device swap forensics (timeline) | `backend/app/routers/analytics.py` | Stub (501) |

### 2.6 Export

| Feature | Location | Status |
|---------|----------|--------|
| Single-sheet XLSX export | `modules/telecom_analysis/exports/excel_exporter.py` | Implemented |
| Multi-sheet XLSX (TTTB / LIST / Contact / IMEI / Location) | `modules/telecom_analysis/exports/excel_exporter.py` | Implemented |
| GTP 3-sheet export (movement log, LAC summary, signal stats) | `modules/telecom_analysis/exports/gtp_exporter.py` | Implemented |
| FLA 3-sheet export (transactions, stats, hourly anomalies) | `modules/telecom_analysis/exports/fla_exporter.py` | Implemented |
| ZIP batch export (multiple subscribers) | `backend/app/routers/exports.py` | Route defined, service partial |
| Dark-theme Excel styling (header: `1A2233`, text: `00F0FF`) | `modules/telecom_analysis/exports/excel_exporter.py` | Implemented |
| Red highlight: transactions ≥ 150M VND | `modules/telecom_analysis/exports/fla_exporter.py` | Implemented |
| Red highlight: transactions in danger hours (23:00, 00:00–04:00) | `modules/telecom_analysis/exports/fla_exporter.py` | Implemented |
| Auto-width columns | `modules/telecom_analysis/exports/excel_exporter.py` | Implemented |

### 2.7 Investigator Annotations

| Feature | Location | Status |
|---------|----------|--------|
| Contact: Zalo ID, Facebook URL, Telegram ID, notes | `backend/database/models/contact_profile.py` | Model only |
| Cell tower: Google Maps URL, notes | `backend/database/models/cell_tower.py` | Model only |
| IMEI: device model, manufacturer, lookup source | `backend/database/models/device.py` | Model only |
| Annotations preserved across CDR re-imports | `backend/database/models/contact_profile.py` | Design intent |
| PATCH contact annotations endpoint | `backend/app/routers/analytics.py` | Stub (501) |
| PATCH tower Google Maps link endpoint | `backend/app/routers/analytics.py` | Stub (501) |

### 2.8 Frontend UI (Client-Side)

| Feature | Location | Status |
|---------|----------|--------|
| Login gate with 3 hardcoded accounts | `app.js` | Implemented |
| Multi-step auth animation | `app.js` | Implemented |
| 5-module sidebar navigation | `index.html`, `app.js` | Implemented |
| CDR Analyzer (9 tabs) | `cdr-analyzer.js` | Implemented (client-side) |
| Multi-session / multi-file management | `cdr-analyzer.js` | Implemented |
| Client-side Excel parsing (SheetJS `xlsx`) | `cdr-analyzer.js` | Implemented |
| Client-side contact analysis | `cdr-analyzer.js` | Implemented |
| Client-side IMEI tracking | `cdr-analyzer.js` | Implemented |
| Client-side location analysis | `cdr-analyzer.js` | Implemented |
| GTP module UI | `app.js` | Implemented |
| FLA module UI | `app.js` | Implemented |
| SRAU module (decoy link tracker) | `app.js` | Stub |
| Batch upload UI | `batch-ui.js` | Implemented |
| Chart.js visualizations (hourly/weekly patterns) | `cdr-analyzer.js` | Implemented |
| Client-side export to XLSX | `cdr-analyzer.js` | Implemented |

---

## 3. MODULE INVENTORY

### 3.1 Backend Modules

```
backend/
├── app/
│   ├── main.py                        FastAPI application factory
│   ├── core/
│   │   ├── config.py                  Settings (pydantic-settings, env-driven)
│   │   ├── exceptions.py              Typed exception hierarchy
│   │   └── logging.py                 Structured logging setup
│   ├── routers/
│   │   ├── imports.py                 Upload endpoints (single + batch)
│   │   ├── subscribers.py             Subscriber CRUD (all 501)
│   │   ├── analytics.py               8-tab analytics + compare (all 501)
│   │   ├── exports.py                 Export routes (defined, partial)
│   │   └── health.py                  Liveness / readiness / info
│   └── services/
│       └── upload/
│           ├── validator.py           Async streaming file validation
│           ├── metadata.py            Excel metadata extraction
│           └── handler.py             Upload pipeline orchestrator
│
├── database/
│   ├── session.py                     SQLAlchemy engine + session factory
│   └── models/
│       ├── enums.py                   Carrier, CommType, Direction, ServiceCategory
│       ├── subscriber.py              Subscriber PII (immutable)
│       ├── cdr_record.py              CDR fact table (immutable)
│       ├── device.py                  IMEI → device model
│       ├── cell_tower.py              (LAC, CID) → tower info + GPS
│       ├── contact_profile.py         Aggregated contact relationships + annotations
│       ├── device_subscription.py     Subscriber ↔ device usage timeline
│       ├── import_batch.py            File import history
│       └── stats.py                   Pre-computed hourly / weekly / tower stats
```

### 3.2 Modules (Analysis Engine)

```
modules/
└── telecom_analysis/
    ├── parsers/
    │   ├── base_parser.py             Abstract parser contract
    │   ├── auto_detector.py           Cascade carrier detection + parser selection
    │   └── viettel_parser.py          Viettel CDR format (fixed cell map)
    ├── normalizers/
    │   └── phone_normalizer.py        NormalizedPhone + direction resolver
    ├── analytics/
    │   ├── base_analyzer.py           Abstract analyzer contract
    │   ├── contact_analyzer.py        Contact frequency aggregation
    │   └── location_analyzer.py       Tower frequency + movement timeline
    ├── exports/
    │   ├── base_exporter.py           Abstract exporter contract
    │   ├── excel_exporter.py          Multi-sheet XLSX (5 standard sheets)
    │   ├── gtp_exporter.py            GTP 3-sheet (movement, LAC, signal)
    │   └── fla_exporter.py            FLA 3-sheet (transactions, stats, hours)
    └── utils/
        ├── phone_utils.py             Normalization + carrier detection functions
        └── constants.py               Prefixes, province map, direction map
```

### 3.3 Frontend Modules

```
(root)/
├── index.html                         App shell + all screen containers
├── styles.css                         Cyber dark theme (dark navy + cyan)
├── app.js                             Login, navigation, GTP, FLA, SRAU init
├── cdr-analyzer.js                    CDR Analyzer (9 tabs, multi-session, all analysis)
├── batch-ui.js                        Batch upload UI (drag-drop, progress, results)
└── package.json                       Single dependency: xlsx@0.18.5
```

---

## 4. DEPENDENCY INVENTORY

### 4.1 Python Backend Dependencies (`backend/requirements.txt`)

| Package | Version | Purpose |
|---------|---------|---------|
| FastAPI | 0.115.5 | Async HTTP framework |
| Uvicorn | — | ASGI server |
| SQLAlchemy | 2.0.36 | ORM + connection pooling |
| Alembic | — | Database migrations |
| Pydantic | 2.10.3 | Request/response validation |
| pydantic-settings | — | Environment config |
| Pandas | 2.2.3 | DataFrame-based header detection |
| openpyxl | 3.1.5 | Excel read/write |
| aiofiles | — | Async file I/O |
| python-multipart | — | File upload (FastAPI dependency) |

### 4.2 JavaScript Frontend Dependencies (`package.json`)

| Package | Version | Purpose |
|---------|---------|---------|
| xlsx (SheetJS) | 0.18.5 | Client-side Excel parsing + export |

**Loaded via CDN (inferred from HTML):**
- Chart.js — hourly/weekly activity histograms
- Leaflet.js — Map tab (tower locations)

### 4.3 Internal Module Dependencies

```
app.js
  └── (no imports — vanilla JS)

cdr-analyzer.js
  └── reads window.XLSX (from xlsx@0.18.5 bundle)
  └── reads Chart (from Chart.js CDN)

batch-ui.js
  └── calls fetch() against FastAPI /api/v1/imports/upload/batch

FastAPI routers
  └── upload/handler.py
        └── upload/validator.py (streaming validation)
        └── upload/metadata.py (openpyxl + pandas inspection)

modules/telecom_analysis/analytics/contact_analyzer.py
  └── base_analyzer.py
  └── modules/telecom_analysis/utils/phone_utils.py

modules/telecom_analysis/analytics/location_analyzer.py
  └── base_analyzer.py

modules/telecom_analysis/exports/excel_exporter.py
  └── base_exporter.py
  └── openpyxl

modules/telecom_analysis/exports/gtp_exporter.py
  └── base_exporter.py
  └── openpyxl

modules/telecom_analysis/exports/fla_exporter.py
  └── base_exporter.py
  └── openpyxl

modules/telecom_analysis/parsers/auto_detector.py
  └── viettel_parser.py
  └── phone_utils.py (carrier detection from filename phone)

modules/telecom_analysis/parsers/viettel_parser.py
  └── base_parser.py
  └── phone_normalizer.py
  └── constants.py
```

---

## 5. DATA MODELS

### 5.1 Enumerations (`backend/database/models/enums.py`)

```
Carrier:          VIETTEL | VINA | MOBI | UNKNOWN
CommType:         VOICE | SMS
Direction:        outgoing | incoming | service
ServiceCategory:  onnet | offnet | vas | international
ImportStatus:     pending | success | failed
```

### 5.2 Core Database Tables

| Table | Key Fields | Role |
|-------|-----------|------|
| `subscribers` | phone_normalized (unique), full_name, DOB, address, ID doc, SIM dates | Immutable PII anchor |
| `cdr_records` | subscriber_id, contact_number, recorded_at, direction, comm_type, device_id, tower_id | Immutable CDR fact table |
| `devices` | imei (unique), is_valid, device_model, manufacturer, lookup_source | IMEI → device identity |
| `cell_towers` | (lac, cell_id) composite unique, carrier, province, bts_address, lat, lng, google_maps_url | Tower geo-registry |
| `contact_profiles` | (subscriber_id, contact_phone) unique, counts, first/last interaction, annotations | Pre-aggregated contact cache |
| `device_subscriptions` | (subscriber_id, device_id) unique, first_seen_at, last_seen_at, interaction_count | Device swap timeline |
| `import_batches` | subscriber_id, source_file_name, document_ref, template_detected, import_status | Import audit log |
| `hourly_activity_stats` | (subscriber_id, hour_of_day 0–23), total/voice/sms/out/in counts | 24h histogram |
| `weekly_activity_stats` | (subscriber_id, day_of_week 0–6 ISO), total/voice/sms counts | Day-of-week histogram |
| `tower_frequency_stats` | (subscriber_id, tower_id), total_count, first/last seen | Tower visit frequency |

### 5.3 Key Indexes

| Index | Table | Purpose |
|-------|-------|---------|
| `ix_cdr_subscriber_time` | cdr_records | Primary timeline queries |
| `ix_cdr_contact_number` | cdr_records | Contact frequency aggregation |
| `ix_cdr_tower_id` | cdr_records | Location analysis |
| `ix_cdr_device_id` | cdr_records | Device tracking |
| `ix_tower_freq_tower_id` | tower_frequency_stats | Cross-subscriber shared-tower queries |
| `(lac, cell_id)` unique | cell_towers | Tower upsert lookup |

### 5.4 Client-Side State Model (`cdr-analyzer.js`)

```javascript
_S = {
  parseResult:    null,        // raw ParseResult from client parser
  records:        [],          // normalized CDR records array
  subscriber:     null,        // {phone, name, address, DOB, ...}
  subscriberKey:  null,
  currentTab:     'subscriber',
  callsPage:      1,
  callsFiltered:  [],
  imeiData:       {},          // {imei: {count, valid, model, note}}
  contactsData:   {},          // {phone: {count, out, in, sms, zalo, fb, tg, note}}
  locationData:   {},          // {lac_cell: {lac, cell, province, bts, count, gmap}}
  compareFiles:   [],
  compareResult:  [],
  mapHtml:        null,
  charts:         {},          // Chart.js instances (destroyed on session switch)
}
```

Session key: `sentinel_cdr_v3` in `localStorage`.  
Multi-file support: `Map<sessionId, _S>` with `activateSession()` / `registerSession()`.

---

## 6. PARSERS

### 6.1 Auto-Detector (`parsers/auto_detector.py`)

**Cascade detection logic:**
1. **Fast path:** Extract phone from filename → detect carrier from prefix → return matching parser
2. **Content fallback:** Structural content matching against carrier-specific markers
3. **Last resort:** Default to `ViettelParser`

### 6.2 Viettel Parser (`parsers/viettel_parser.py`)

**Sheet:** `Sheet2`

**Fixed PII cell addresses (row, col — 0-indexed):**

| Field | Cell |
|-------|------|
| document_ref (Công văn) | (2, 2) |
| phone (without leading 0) | (3, 2) |
| report_period_from | (4, 2) |
| report_period_to | (4, 4) |
| full_name | (6, 2) |
| date_of_birth | (8, 2) |
| address | (9, 2) |
| subscription_type | (10, 2) |
| id_doc_type | (11, 2) |
| id_doc_number | (12, 2) |
| id_issue_date | (13, 2) |
| id_issue_authority | (14, 2) |
| activation_date | (15, 2) |
| account_status | (16, 2) |

**CDR data:** Row 22 onward (0-indexed row 21 = column headers)

**Column keywords for header detection:**  
`"so di"`, `"so den"`, `"thoi gian"`, `"imei"`, `"lac"`, `"cell"`

### 6.3 Vina / Mobi Parsers

Referenced in `auto_detector.py` but not yet fully implemented.

### 6.4 Client-Side Parser (`cdr-analyzer.js`)

Parallel implementation in JavaScript using SheetJS:
- Same Viettel fixed-cell PII logic
- Header row scored by keyword density
- Column mapping with fuzzy matching fallbacks
- Direction inference, service sender detection, phone normalization — all in-browser

---

## 7. ANALYZERS

### 7.1 Contact Analyzer (`analytics/contact_analyzer.py`)

**Inputs:** CDR DataFrame, owner phone, optional filters (date range, time range, search, top_n)

**Output per contact:**
- `contact_number` (normalized)
- `total_count`, `outgoing_count`, `incoming_count`
- `voice_count`, `sms_count`
- `first_interaction_at`, `last_interaction_at`
- `carrier` (detected from prefix)

**Business rule:** Contacts matching owner phone are excluded.

### 7.2 Location Analyzer (`analytics/location_analyzer.py`)

**Inputs:** CDR DataFrame, owner phone, optional filters

**Output per tower:**
- `lac`, `cell_id` (composite key)
- `total_count`, `first_seen_at`, `last_seen_at`
- `contacts_by_tower` (set of phone numbers reached from this tower)

**Movement timeline:**
- Ordered location events: timestamp → tower → contact → direction

### 7.3 Client-Side Analysis (`cdr-analyzer.js`)

All analysis in-browser:
- **Contacts:** Grouped by `contact_number`, sorted by `count` DESC, filterable
- **IMEI:** Tracked per record, model lookup via IMEI prefix table, usage periods
- **Location:** LAC-Cell-Province grouped, Google Maps link generation
- **Activity Report:** Chart.js bar charts for hourly (0–23) and weekly (Mon–Sun) patterns
- **Compare:** Cross-file shared contacts, IMEI, and location matching

---

## 8. EXPORTERS

### 8.1 Excel Multi-Sheet Exporter (`exports/excel_exporter.py`)

**5-sheet workbook format (standard forensic report):**

| Sheet | Vietnamese Name | Contents |
|-------|----------------|---------|
| `TTTB` | Thông Tin Thuê Bao | Subscriber PII (phone, name, DOB, address, ID doc, SIM dates) |
| `LIST` | Danh Sách Cuộc Gọi | CDR records (row#, owner, contact, timestamp, duration, IMEI, province, type, service, BTS address, LAC, CID) |
| `Contact` | Danh Sách Liên Hệ | Contact frequency (phone, count, Zalo, Facebook, Telegram, notes) |
| `IMEI` | Thiết Bị IMEI | IMEI list (IMEI, frequency, device model, usage period) |
| `Location` | Vị Trí Trạm BTS | Tower frequency (LAC, CID, province, BTS address, count, Google Maps) |

**Styling:**
- Header row background: `1A2233` (dark navy)
- Header text: `00F0FF` (cyan)
- Auto-width columns (max 50 chars)
- Font: Calibri 11pt body, 12pt bold headers

### 8.2 GTP Exporter (`exports/gtp_exporter.py`)

**3-sheet export for cell-tower geospatial analysis:**

**Sheet 1: Lich Trinh Tram (Movement Log)**

| Column | Field |
|--------|-------|
| Thoi Gian | time |
| LAC | lac |
| Cell ID | cell |
| Vi Tri Tram | label (BTS address/name) |
| Nha Mang | ip (carrier name) |
| Tin Hieu | strength (dBm) |
| Vi Do | lat (latitude) |
| Kinh Do | lng (longitude) |

**Sheet 2: Bao Cao LAC (LAC Zone Summary)**

| Column | Content |
|--------|---------|
| Vung LAC | LAC identifier |
| So Lan Xuat Hien | occurrence count |
| Ti Le (%) | percentage of all events |

**Sheet 3: Thong Ke Tin Hieu (Signal Distribution)**

| Classification | Threshold |
|---------------|-----------|
| Tot (Good) | ≥ −75 dBm |
| Trung binh (Medium) | −75 to −90 dBm |
| Yeu (Weak) | < −90 dBm |
| Khong xac dinh (Unknown) | no value |

**Formatting:** Weak signal rows highlighted in red.

### 8.3 FLA Exporter (`exports/fla_exporter.py`)

**3-sheet export for bank transaction analysis:**

**Sheet 1: Giao Dich (Transaction List)**

| Column | Field | Alert Rule |
|--------|-------|-----------|
| Ngay Gio | date | — |
| Ngan Hang | bank | — |
| So Tien (VND) | amount | Red if ≥ 150,000,000 |
| Ma Lenh | code | — |
| Noi Dung | content | — |
| Canh Bao | flag | Red if flagged |

**Sheet 2: Thong Ke (Summary Statistics)**
- Total transaction count
- Anomalous transactions (flagged)
- Large transactions (≥ 150M VND)
- Total value (VND)
- Per-bank breakdown table

**Sheet 3: Phan Tich Gio (Hourly Analysis, 0–23)**
- Columns: Gio, So Giao Dich, Co Bat Thuong
- **Danger hours:** 23:00, 00:00–04:00 → highlighted red

---

## 9. API ENDPOINTS

### 9.1 Implemented Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/imports/upload` | Single file upload + metadata extraction |
| `POST` | `/api/v1/imports/upload/batch` | Batch upload (up to 20 files, max 4 concurrent) |
| `GET` | `/health` | Liveness check |
| `GET` | `/health/ready` | Readiness check (DB connectivity) |
| `GET` | `/health/info` | App info (version, env, config) |

### 9.2 Stub Endpoints (HTTP 501)

**Import management:**
- `GET /api/v1/imports/batches`
- `GET /api/v1/imports/batches/{id}`
- `DELETE /api/v1/imports/batches/{id}`
- `POST /api/v1/imports/batches/{id}/retry`

**Subscriber CRUD:**
- `GET /api/v1/subscribers`
- `POST /api/v1/subscribers`
- `GET /api/v1/subscribers/{id}`
- `GET /api/v1/subscribers/phone/{phone}`
- `PATCH /api/v1/subscribers/{id}`
- `DELETE /api/v1/subscribers/{id}`

**Analytics (8 tabs × subscriber):**
- `GET /{subscriber_id}/subscriber` — Tab 1: PII
- `GET /{subscriber_id}/calls` — Tab 2: Call history (paginated, filterable)
- `GET /{subscriber_id}/contacts` — Tab 3: Contact frequency
- `PATCH /{subscriber_id}/contacts/{phone}` — Update contact annotation
- `GET /{subscriber_id}/imei` — Tab 4: IMEI list
- `GET /{subscriber_id}/imei/timeline` — Device swap timeline
- `GET /{subscriber_id}/location` — Tab 5: Tower frequency
- `PATCH /towers/{lac}/{cell_id}/maps-link` — Set Google Maps annotation
- `GET /{subscriber_id}/report` — Tab 6: Hourly + weekly histograms
- `GET /{subscriber_id}/map` — Tab 7: Movement timeline for Leaflet
- `GET /compare/contacts` — Tab 8: Shared contacts across subscribers
- `GET /compare/imei` — Tab 8: Shared devices
- `GET /compare/locations` — Tab 8: Shared towers
- `POST /compare/selected` — Tab 8: Compare subset

**Exports:**
- `POST /exports/gtp` — GTP Excel export
- `POST /exports/fla` — FLA Excel export
- `GET /{subscriber_id}/all` — All-sheets subscriber export
- `GET /{subscriber_id}/calls` — CDR list sheet export
- `GET /{subscriber_id}/contacts` — Contacts sheet export
- `GET /{subscriber_id}/imei` — IMEI sheet export
- `GET /{subscriber_id}/location` — Location sheet export
- `POST /exports/compare` — Comparison result export
- `POST /exports/batch` — ZIP of all subscribers

---

## 10. CRITICAL BUSINESS LOGIC

### 10.1 Phone Normalization Algorithm

```
Input: raw string (any format)
1. Strip whitespace, dashes, dots, parentheses
2. If starts with '+84' → remove '+84', prepend '0'
3. If starts with '84' and length is 11 → remove '84', prepend '0'
4. If 9 digits, starts with [3-9] → prepend '0'
5. Validate: exactly 10 digits, starts with '0', digit[1] in [3-9]
6. If invalid → return None (not discarded — flagged in ParseReport)
```

### 10.2 Direction Inference Algorithm

```
Input: source_raw, target_raw, owner_phone (normalized)

normalize(source_raw) → source_normalized
normalize(target_raw) → target_normalized

is_service_sender(source_raw) → True if:
  - source starts with a letter (MBBANK, MyViettel, Apple)
  - source is ≤ 6 digits (short codes)

If is_service_sender(source_raw):
  direction = 'service'
  contact_number = source_raw (preserve raw for display)
Elif phones_are_equal(source_normalized, owner_phone):
  direction = 'outgoing'
  contact_number = target_normalized
Elif phones_are_equal(target_normalized, owner_phone):
  direction = 'incoming'
  contact_number = source_normalized
Else:
  direction = 'unknown'
  contact_number = target_normalized (best guess)
```

### 10.3 Cross-Subscriber Comparison Key

```
Contacts: last 9 digits of normalized phone
  → handles '0386123456' == '84386123456' == '386123456'
  → getLast9Digits('0386123456') = '386123456'

IMEI: first 14 digits
  → device model identifier; excludes Luhn check digit (15th)
  → getFirst14Digits('352099001761481') = '35209900176148'

Location: (lac, cell_id) composite
  → exact match required
  → additional: carrier (MNC) for disambiguation
```

### 10.4 Service Sender Detection

```
Classified as 'service' (not a human contact) if source:
- Starts with a letter: MBBANK, MyViettel, Apple, BIDV, Vietcombank, VPBank, etc.
- Is ≤ 6 digits: 8x68, 1900xxxx, etc.

Effect: these records show Direction='service', excluded from contact frequency stats
```

### 10.5 FLA Anomaly Detection Rules

```
Transaction flagged if:
  - Amount ≥ 150,000,000 VND → highlight red in Sheet 1
  - Timestamp hour ∈ {23, 0, 1, 2, 3, 4} → highlight red in Sheet 3

Flagged column ("Canh Bao"): pre-computed boolean from input data
Sheet 2 counters:
  - Giao dich bat thuong = count where flagged = True
  - Giao dich gia tri lon = count where amount ≥ 150M
```

### 10.6 GTP Signal Quality Classification

```
Signal strength (dBm) → category:
  ≥ −75  → "Tot" (Good)        — white background
  −75 to −90 → "Trung binh" (Medium) — white background
  < −90  → "Yeu" (Weak)        — red background (warning)
  None   → "Khong xac dinh"   — white background
```

### 10.7 Import Batch Processing Guarantees

```
- ImportBatch created BEFORE CDR records are inserted
  → Orphaned records on failure roll back with batch (cascade delete)
- subscriber_id is anchor: all data attached to subscriber
- contact_profile, stats, device_subscriptions REBUILT on each import
  → Investigator annotations (Zalo, FB, Telegram, notes) PRESERVED
  → Only counts/timestamps are overwritten
- IMEI lookup (imei.info) is async + optional
  → CDR import proceeds even if IMEI lookup fails
```

### 10.8 Client-Side Session Architecture

```
Multi-file: each uploaded file gets its own session (_S clone)
Map<sessionId, _S>  →  only one active at a time

Session stored in localStorage key 'sentinel_cdr_v3'
Switching sessions: destroy Chart.js instances → restore saved _S → re-render all tabs

Zero server leak policy: all parsing, analysis, and export happens in-browser
  → no CDR data transmitted to server in client-side mode
```

---

## 11. REUSABLE ASSETS

### 11.1 Reusable Python Components

| Asset | Location | Interface | Reuse Potential |
|-------|----------|-----------|----------------|
| `normalize_phone()` | `utils/phone_utils.py` | `(str) → str \| None` | High — used in parsers, normalizers, analytics |
| `get_last_9_digits()` | `utils/phone_utils.py` | `(str) → str \| None` | High — cross-subscriber comparison |
| `is_service_sender()` | `utils/phone_utils.py` | `(str) → bool` | High — direction inference |
| `detect_carrier()` | `utils/phone_utils.py` | `(str) → str` | High — carrier tagging |
| `phones_are_equal()` | `utils/phone_utils.py` | `(str, str) → bool` | High — direction inference, dedup |
| `BaseParser` | `parsers/base_parser.py` | Abstract class | High — add Vina/Mobi by subclassing |
| `BaseAnalyzer` | `analytics/base_analyzer.py` | Abstract class | High — add new analyzers |
| `BaseExporter` | `exports/base_exporter.py` | Abstract class | High — add new export formats |
| `ExcelExporter` | `exports/excel_exporter.py` | `export()` / `export_multi_sheet()` | High — all subscriber exports |
| `GtpExporter` | `exports/gtp_exporter.py` | `export(data)` → BytesIO | Medium — GTP module only |
| `FlaExporter` | `exports/fla_exporter.py` | `export(data)` → BytesIO | Medium — FLA module only |
| `ContactAnalyzer` | `analytics/contact_analyzer.py` | `_analyze_dataframe()` | High — contacts tab |
| `LocationAnalyzer` | `analytics/location_analyzer.py` | `_analyze_dataframe()` | High — location + map tabs |
| `auto_detect_parser()` | `parsers/auto_detector.py` | `(data, filename) → BaseParser` | High — import pipeline |
| `validate_upload_file()` | `services/upload/validator.py` | `async (UploadFile) → ValidationResult` | High — any file upload endpoint |
| `extract_metadata()` | `services/upload/metadata.py` | `async (path, ...) → UploadMetadata` | Medium — import pipeline |
| `PROVINCE_CODE_MAP` | `utils/constants.py` | `dict[str, str]` | Medium — normalization |
| `*_PREFIXES` constants | `utils/constants.py` | `list[str]` | High — carrier detection |

### 11.2 Reusable JavaScript Components

| Asset | Location | Interface | Reuse Potential |
|-------|----------|-----------|----------------|
| `CDRAnalyzer` module | `cdr-analyzer.js` | IIFE with public API | High — entire CDR feature |
| Client phone normalizer | `cdr-analyzer.js` | `normalizePhone(raw)` | High — any JS phone handling |
| Client direction inferrer | `cdr-analyzer.js` | `resolveDirection(src, tgt, owner)` | High |
| Client contact aggregator | `cdr-analyzer.js` | `buildContactsData(records, owner)` | High |
| Client IMEI aggregator | `cdr-analyzer.js` | `buildImeiData(records)` | High |
| Client location aggregator | `cdr-analyzer.js` | `buildLocationData(records)` | High |
| Client XLSX export | `cdr-analyzer.js` | wraps SheetJS `xlsx` | Medium |
| `BatchUI` module | `batch-ui.js` | IIFE with `init()` | Medium — batch upload screens |
| Navigation system | `app.js` | `navigateTo(screenKey)` | Medium — new screens |
| Login gate | `app.js` | `initLoginScreen()` | Low — hardcoded accounts |

### 11.3 Database Schema Assets (Reusable for Other Carriers / Datasets)

| Asset | Reuse |
|-------|-------|
| `CDRRecord` model | Add new carrier columns via nullable fields |
| `ContactProfile` model | Works for any subscriber relationship (not CDR-specific) |
| `TowerFrequencyStat` | Works for any location-based system |
| `HourlyActivityStat` / `WeeklyActivityStat` | Generic time-pattern tables |
| `ImportBatch` model | Generic file import audit log |

---

## 12. STRENGTHS

1. **Abstract base classes** for Parser, Analyzer, and Exporter — adding new carriers or export formats is additive (subclass only).
2. **Phone normalization is centralized** — single source of truth across Python backend and JS frontend (parallel implementations).
3. **Investigator annotations are preserved** across CDR re-imports — `ContactProfile` annotations (`zalo_id`, `facebook_url`, `telegram_id`, `notes`) survive stat rebuilds.
4. **Import batch = unit of atomicity** — cascade delete on batch rolls back all CDR records cleanly.
5. **Pre-computed stat tables** (`HourlyActivityStat`, `WeeklyActivityStat`, `TowerFrequencyStat`) — analytics queries hit O(1) aggregates, not O(N) CDR scans.
6. **Streaming file validation** — never loads full upload into memory; size check, magic bytes, and structure validation run as a pipeline.
7. **GtpExporter + FlaExporter are self-contained** — receive plain dicts, produce BytesIO; zero coupling to database models.
8. **Client-side zero-leak mode** — CDR data is parsed and analyzed entirely in-browser; no subscriber PII transmitted to server in this mode.
9. **Five-sheet export is a round-trip contract** — the sheet format matches import expectations, enabling re-import of previously exported reports.

---

## 13. WEAKNESSES & GAPS

1. **Backend import pipeline is not connected** — file upload works, but no endpoint triggers `ImportService.import_file()`. The gap between `POST /imports/upload` (returns `upload_id`) and actual database insertion is missing.
2. **All analytics and subscriber endpoints return 501** — the platform cannot serve a subscriber's call history, contacts, IMEI, or locations from the database.
3. **Hardcoded credentials in JavaScript** — `canbo/ca@2024`, `sentinel/anm@2024`, `admin/Sentinel@2026` are visible in source. Session validation is client-only (`sessionStorage`).
4. **Vina and Mobi parsers not implemented** — `auto_detector.py` routes to them, but only `ViettelParser` exists.
5. **Province code map is incomplete and inconsistent** — `TNH` and `T066` both map to "Tay Ninh" (acknowledged in comment). No normalization pass is documented.
6. **Two parallel implementations of core logic** — phone normalization, direction inference, and CDR parsing exist in both Python (`modules/telecom_analysis/`) and JavaScript (`cdr-analyzer.js`). Drift between them is a maintenance risk.
7. **No test coverage found** — no `tests/` directory, no `pytest` fixtures, no JS test files.
8. **SQLite in development; no migration files found** — Alembic is listed in requirements but no `alembic/` directory or migration scripts were found.
9. **No CSP, CORS locked to localhost only** — production CORS origins not configured; no HTTP security headers.
10. **SRAU (decoy link tracker) is an unimplemented stub** — referenced in navigation and `app.js` but has no logic.
11. **IMEI lookup is a stub** — `device.lookup_source = 'imei.info'` is set in the model, but no HTTP client or rate-limiting implementation exists.

---

## 14. IMPLEMENTATION PRIORITY (RECOMMENDED)

### Tier 1 — Unblock End-to-End Flow

1. **Implement `POST /imports/{upload_id}/process`** — trigger `ImportService.import_file()` using the stored `upload_id`. This connects upload to database.
2. **Implement Subscriber CRUD** — at minimum `GET /subscribers`, `GET /subscribers/{id}`, and `GET /subscribers/phone/{phone}`.
3. **Implement `GET /{subscriber_id}/calls`** — the call history tab is the most frequently accessed; paginated query against `cdr_records`.
4. **Implement Vina + Mobi parsers** — complete the carrier coverage that `auto_detector` already routes to.

### Tier 2 — Complete Analytics

5. **Implement `GET /{subscriber_id}/contacts`** — query `contact_profiles` (already pre-aggregated).
6. **Implement `GET /{subscriber_id}/location`** — query `tower_frequency_stats` joined to `cell_towers`.
7. **Implement `GET /{subscriber_id}/report`** — query `hourly_activity_stats` and `weekly_activity_stats`.
8. **Implement `GET /compare/contacts`** — join `contact_profiles` across subscribers by `contact_phone`.

### Tier 3 — Security & Hardening

9. **Replace hardcoded credentials** — add JWT auth or session tokens validated server-side.
10. **Add Alembic migrations** — run `alembic init` and generate initial schema migration.
11. **Unify phone normalization** — extract shared normalization rules to a JSON config consumed by both Python and JS to prevent drift.
12. **Add province code normalization pass** — canonicalize all `province_code_raw` values at import time.

---

*Audit generated by Claude Code (claude-sonnet-4-6) on 2026-05-31. Read-only analysis — no project files were modified.*
