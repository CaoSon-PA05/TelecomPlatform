# 🏗️ PROPOSED ENTERPRISE ARCHITECTURE
**System:** Sentinel Platform v2.0  
**Document Purpose:** Target state architecture for the telecom analytics enterprise module

---

## 1. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                     SENTINEL PLATFORM v2.0                      │
│                  Enterprise Analytics System                    │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────▼──────┐    ┌───────▼──────┐    ┌──────▼──────┐
    │  FRONTEND  │    │   BACKEND    │    │  DATABASE   │
    │  LAYER     │    │   LAYER      │    │  LAYER      │
    │            │    │              │    │             │
    │ Vanilla JS │◄──►│ Python       │◄──►│ SQLite      │
    │ HTML/CSS   │    │ FastAPI      │    │ (→Postgres) │
    │            │    │              │    │             │
    └────────────┘    └──────────────┘    └─────────────┘
```

---

## 2. FOLDER STRUCTURE (TARGET STATE)

```
TelecomPlatform/
│
├── index.html                        ← Root Sentinel Shell (PRESERVE AS-IS)
├── app.js                            ← Root JS Controller (EXTEND, NOT REPLACE)
├── styles.css                        ← Root Design System (SHARED, EXTEND)
├── Claude.md                         ← Project context reference
│
├── Mau/                              ← LEGACY MODULE (DO NOT TOUCH)
│   ├── index.html
│   ├── script.js
│   ├── styles.css
│   ├── call-icon.png
│   ├── HUONG_DAN_SU_DUNG.md
│   └── File data mau/
│       ├── 0_0382733506.xlsx
│       └── 1_0969619929.xlsx
│
├── frontend/                         ← NEW: Platform Integration Layer
│   ├── modules/
│   │   └── telecom_analysis/         ← Telecom module UI components
│   │       ├── telecom-screen.html   ← Module screen HTML fragment
│   │       ├── telecom.js            ← Module JS controller
│   │       └── telecom.css           ← Module-specific styles (extends root)
│   ├── shared/
│   │   ├── api-client.js             ← Centralized fetch/API helper
│   │   ├── toast.js                  ← Toast notification utility
│   │   └── utils.js                  ← Shared utilities (formatters, helpers)
│   └── assets/
│       └── icons/                    ← SVG icons, provider logos
│
├── backend/                          ← NEW: FastAPI Backend
│   ├── app/
│   │   ├── main.py                   ← FastAPI application entry point
│   │   ├── config.py                 ← Environment & settings
│   │   ├── database.py               ← SQLAlchemy engine, session
│   │   ├── dependencies.py           ← Dependency injection helpers
│   │   │
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py         ← API v1 router aggregator
│   │   │       └── endpoints/
│   │   │           ├── telecom.py    ← Telecom module endpoints
│   │   │           └── health.py     ← Health check endpoint
│   │   │
│   │   ├── models/                   ← SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── subscriber.py
│   │   │   ├── call_record.py
│   │   │   ├── tower.py
│   │   │   └── imei_log.py
│   │   │
│   │   ├── schemas/                  ← Pydantic request/response models
│   │   │   ├── __init__.py
│   │   │   ├── subscriber.py
│   │   │   ├── call_record.py
│   │   │   └── analytics.py
│   │   │
│   │   └── services/
│   │       └── telecom_analysis/     ← Core telecom business logic
│   │           ├── __init__.py
│   │           ├── parser.py         ← Excel multi-template parser
│   │           ├── normalizer.py     ← Data normalization engine
│   │           ├── analytics.py      ← Frequency & behavior analysis
│   │           ├── exporter.py       ← Excel/PDF export service
│   │           └── tower_resolver.py ← LAC/Cell → GPS coordinate lookup
│   │
│   ├── requirements.txt              ← Python dependencies
│   ├── .env.example                  ← Environment variables template
│   └── run.py                        ← Dev server launcher
│
├── modules/                          ← NEW: Shared Module Registry
│   └── telecom_analysis/             ← Telecom module definition
│       ├── parsers/                  ← Provider-specific parser configs
│       │   ├── viettel.json
│       │   ├── vinaphone.json
│       │   └── mobifone.json
│       ├── analytics/                ← Analytics algorithm specs
│       ├── normalizers/              ← Normalization rule definitions
│       ├── exports/                  ← Export templates
│       ├── schemas/                  ← Shared schema definitions
│       ├── services/                 ← Service contracts
│       └── utils/                    ← Shared utilities
│
├── database/                         ← NEW: Database artifacts
│   ├── sentinel.db                   ← SQLite database (gitignored)
│   ├── migrations/                   ← Alembic migration scripts
│   │   └── versions/
│   ├── seeds/                        ← Seed data scripts
│   │   └── towers_viettel_hanoi.sql  ← BTS tower coordinates seed
│   └── schemas/                      ← Schema DDL files
│       └── initial_schema.sql
│
├── shared/                           ← NEW: Cross-layer shared resources
│   ├── constants.py                  ← Shared constants (provider names, etc.)
│   ├── types.ts                      ← TypeScript type definitions (if needed)
│   └── telecom_norms.py              ← Business normalization constants
│
├── services/                         ← NEW: External service integrations
│   └── imei_lookup/                  ← IMEI.info integration (optional)
│       └── client.py
│
├── docs/                             ← Documentation (EXPANDED)
│   ├── project_overview.md           ← ✅ NEW (this audit)
│   ├── current_resources.md          ← ✅ NEW (this audit)
│   ├── missing_components.md         ← ✅ NEW (this audit)
│   ├── proposed_architecture.md      ← ✅ NEW (this document)
│   ├── telecom_schema_analysis.md    ← ✅ NEW (this audit)
│   ├── integration_strategy.md       ← ✅ NEW (this audit)
│   ├── system_analysis.md            ← Existing
│   ├── architecture.md               ← Existing
│   ├── telecom_schema_design.md      ← Existing (SQL DDL)
│   ├── integration_plan.md           ← Existing
│   ├── parser_strategy.md            ← Existing
│   ├── migration_plan.md             ← Existing
│   ├── frontend_roadmap.md           ← Existing
│   └── backend_roadmap.md            ← Existing
│
├── scripts/                          ← NEW: Utility and maintenance scripts
│   ├── analyze_legacy.py             ← Moved from root (was analyze_legacy.py)
│   ├── inspect_excel.py              ← Excel inspection helper
│   ├── seed_towers.py                ← BTS tower data seeding
│   └── validate_schema.py            ← Schema validation utility
│
└── tests/                            ← NEW: Test suite
    ├── backend/
    │   ├── test_parser.py
    │   ├── test_normalizer.py
    │   └── test_analytics.py
    └── fixtures/
        ├── sample_viettel.xlsx
        ├── sample_vinaphone.xlsx
        └── sample_mobifone.xlsx
```

---

## 3. DATA FLOW ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA FLOW PIPELINE                       │
└─────────────────────────────────────────────────────────────┘

  [User Drops Excel File]
          │
          ▼
  [Frontend: telecom.js]
  → POST multipart/form-data to /api/v1/telecom/upload
          │
          ▼
  [Backend: telecom.py endpoint]
  → Receive UploadFile
  → Spawn background task
          │
          ▼
  [Parser Service: parser.py]
  → Read first 30 rows with openpyxl
  → Detect provider (Viettel / Vinaphone / Mobifone / Unknown)
  → Load appropriate column mapping
  → Extract subscriber info block (rows 0-20)
  → Locate CDR header row (keyword scan)
  → Iterate CDR rows
          │
          ▼
  [Normalizer Service: normalizer.py]
  → Normalize phone numbers (84xxx → 0xxx)
  → Parse datetime strings → UTC+7 datetime
  → Extract LAC/Cell from combined or separate columns
  → Resolve contact_number (the non-subscriber party)
  → Validate IMEI format (15 digits)
          │
          ▼
  [Database: SQLAlchemy]
  → Upsert subscriber record
  → Bulk insert call_records
  → Upsert tower records (LAC/Cell pairs)
  → Upsert imei_logs
          │
          ▼
  [Analytics Service: analytics.py]
  → Compute hourly distribution (24h histogram)
  → Compute weekly distribution (7-day)
  → Rank top contacts by frequency + duration
  → Extract IMEI change events
  → Build geospatial timeline (LAC/Cell sequence)
          │
          ▼
  [Frontend: Render Results]
  → Subscriber info card
  → CDR paginated table
  → Stat cards (total calls, anomalies, contacts)
  → Chart.js charts (hourly, weekly)
  → Leaflet map with trajectory
```

---

## 4. API CONTRACT SPECIFICATION

### 4.1 Upload & Parse
```
POST /api/v1/telecom/upload
Content-Type: multipart/form-data

Request:
  file: File (xlsx/xls)
  
Response 200:
{
  "subscriber_id": 42,
  "phone_number": "09xxxxxxxx",
  "provider": "VIETTEL",
  "records_imported": 3847,
  "template_detected": "template1",
  "status": "success"
}
```

### 4.2 Subscriber Dashboard
```
GET /api/v1/telecom/subscriber/{id}

Response 200:
{
  "id": 42,
  "phone_number": "09xxxxxxxx",
  "full_name": "...",
  "provider": "VIETTEL",
  "activation_date": "2020-03-15",
  "status": "Active",
  "report_start": "2025-01-01",
  "report_end": "2025-06-01"
}
```

### 4.3 CDR Records (Paginated)
```
GET /api/v1/telecom/records/{subscriber_id}?page=1&size=50&type=VOICE&from=2025-01-01

Response 200:
{
  "total": 3847,
  "page": 1,
  "size": 50,
  "records": [
    {
      "id": 1,
      "contact_number": "0987654321",
      "timestamp": "2025-01-15T14:32:00",
      "duration_seconds": 180,
      "call_type": "VOICE",
      "direction": "OUTBOUND",
      "imei": "356938035643809",
      "lac_raw": 5421,
      "cell_raw": 23912,
      "station_name": "Trạm Ba Đình 01"
    }
  ]
}
```

### 4.4 Analytics Summary
```
GET /api/v1/telecom/analytics/{subscriber_id}

Response 200:
{
  "total_calls": 2140,
  "total_sms": 1707,
  "total_duration_hours": 84.3,
  "unique_contacts": 127,
  "unique_imei": 3,
  "hourly_distribution": [12, 3, 1, 0, ...],  // 24 buckets
  "weekly_distribution": [231, 445, 380, ...], // 7 days
  "top_contacts": [
    {"number": "0987654321", "calls": 45, "total_seconds": 8400}
  ]
}
```

### 4.5 Geospatial Timeline
```
GET /api/v1/telecom/timeline/{subscriber_id}?from=2025-01-01&to=2025-01-31

Response 200:
{
  "points": [
    {
      "timestamp": "2025-01-15T08:32:00",
      "lac": 5421,
      "cell": 23912,
      "station_name": "Trạm Ba Đình 01",
      "latitude": 21.0285,
      "longitude": 105.8542
    }
  ]
}
```

### 4.6 Cross-File Compare
```
POST /api/v1/telecom/compare

Request:
{
  "subscriber_ids": [1, 2, 3],
  "compare_type": "contacts"  // contacts | imei | locations
}

Response 200:
{
  "common_contacts": ["0987654321", "0912345678"],
  "common_imei": ["356938035643809"],
  "analysis_summary": "3 common contacts found across all subjects"
}
```

---

## 5. FRONTEND MODULE INTEGRATION

The telecom module integrates into the existing Sentinel Shell via a **new nav item** and **new screen**:

```html
<!-- Addition to root index.html sidebar nav -->
<li class="nav-item" data-screen="telecom">
  <i>📡</i> <span>Phân Tích Viễn Thông</span>
</li>

<!-- New screen added to screen-container -->
<div class="screen" id="telecom-screen">
  <!-- Loaded from frontend/modules/telecom_analysis/telecom-screen.html -->
</div>
```

The `telecom.js` module controller:
- Extends `app.js` pattern (module init function `initTelecomModule()`)
- Calls backend API instead of using mock data
- Uses existing CSS classes from `styles.css` (no design changes needed)
- Adds module-specific styles in `telecom.css`

---

## 6. TECHNOLOGY DECISIONS

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend framework | FastAPI (Python) | High performance, async, auto-docs |
| Excel parsing | openpyxl + pandas | Pandas vectorized ops for large files |
| Database | SQLite → PostgreSQL | Start local, scale to server |
| ORM | SQLAlchemy 2.x | Industry standard, portable |
| Frontend | Vanilla JS (extend existing) | No framework overhead; design already done |
| Map library | Leaflet.js (CDN) | Lightweight, offline-capable |
| Charts | Chart.js (existing) | Already in legacy module |
| Encryption | Python `cryptography` (AES-256-GCM) | Field-level PII protection |
| Auth | JWT (python-jose) | Stateless, scalable |
| Task queue | FastAPI BackgroundTasks (simple) → Celery (advanced) | Progressive complexity |
