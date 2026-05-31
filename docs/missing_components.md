# 🔴 MISSING COMPONENTS ANALYSIS
**System:** Sentinel Platform  
**Document Purpose:** Gap analysis — what must be built for production readiness

---

## SUMMARY TABLE

| Category | Component | Priority | Effort |
|----------|-----------|----------|--------|
| Backend | FastAPI application skeleton | 🔴 CRITICAL | Medium |
| Backend | Excel multi-template parser service | 🔴 CRITICAL | High |
| Backend | Data normalization service | 🔴 CRITICAL | Medium |
| Backend | Analytics computation engine | 🔴 CRITICAL | High |
| Backend | File upload API endpoint | 🔴 CRITICAL | Low |
| Backend | Analytics query API endpoints | 🔴 CRITICAL | Medium |
| Database | SQLite/PostgreSQL schema creation | 🔴 CRITICAL | Low |
| Database | Migration scripts (Alembic) | 🟡 HIGH | Medium |
| Backend | Cross-file comparison API | 🟡 HIGH | High |
| Backend | Geospatial timeline API | 🟡 HIGH | Medium |
| Backend | Excel export service | 🟡 HIGH | Medium |
| Backend | BTS Tower coordinate database | 🟡 HIGH | High |
| Frontend | Telecom Analysis module screen | 🔴 CRITICAL | High |
| Frontend | Real API integration (replacing mocks) | 🔴 CRITICAL | Medium |
| Frontend | Subscriber dashboard component | 🟡 HIGH | Medium |
| Frontend | CDR data table (paginated) | 🟡 HIGH | Medium |
| Frontend | Interactive Leaflet/map component | 🟡 HIGH | High |
| Frontend | Chart visualization (hourly/weekly) | 🟡 HIGH | Medium |
| Frontend | Multi-file upload + progress bar | 🟡 HIGH | Medium |
| Frontend | Real-time filter/search | 🟡 HIGH | Medium |
| Frontend | Cross-comparison UI | 🟢 MEDIUM | High |
| Security | JWT authentication system | 🟡 HIGH | Medium |
| Security | AES-256 PII encryption | 🟡 HIGH | Medium |
| Security | Session management | 🟡 HIGH | Medium |
| Infra | Async task queue (Celery/background tasks) | 🟢 MEDIUM | High |
| Infra | Environment configuration (.env) | 🟡 HIGH | Low |
| Infra | CORS configuration | 🟡 HIGH | Low |
| Testing | Unit tests (backend) | 🟢 MEDIUM | High |
| Testing | Integration tests | 🟢 MEDIUM | High |
| Docs | API documentation (auto from FastAPI) | 🟢 MEDIUM | Low |

---

## 1. MISSING BACKEND INFRASTRUCTURE

### 1.1 FastAPI Application (CRITICAL)
**What's missing:** Zero backend exists. `frontend/` and `backend/` directories are completely empty.

**Required structure:**
```
backend/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Settings, env loading
│   ├── database.py          # DB engine & session factory
│   ├── api/
│   │   └── v1/
│   │       └── endpoints/
│   │           └── telecom.py  # Telecom module routes
│   ├── models/              # SQLAlchemy ORM models
│   ├── schemas/             # Pydantic request/response models
│   └── services/            # Business logic layer
│       └── telecom_analysis/
│           ├── parser.py
│           ├── normalizer.py
│           ├── analytics.py
│           └── exporter.py
├── requirements.txt
├── .env.example
└── alembic/                 # DB migrations
```

### 1.2 Excel Parser Service (CRITICAL)
**What's missing:** Server-side parsing of CDR Excel files.

The legacy `script.js` parses in the browser — this must be rebuilt in Python.

**Missing parser capabilities:**
- `detect_provider(file)` — Identify Viettel/Vinaphone/Mobifone from header patterns
- `extract_subscriber_info(sheet, template)` — Parse metadata rows 0-20
- `extract_cdr_records(sheet, template, header_row)` — Parse CDR data rows
- `detect_header_row(sheet)` — Dynamically find where CDR data begins
- Dynamic column map fallback for unknown providers

**Detection signatures needed (from parser_strategy.md):**
- Viettel: First row contains `"BÁO CÁO CHI TIẾT LỊCH SỬ LIÊN LẠC"`
- Vinaphone: Columns named `a_subs` / `b_subs`
- Mobifone: Combined `LAC-Cell` column (e.g. `31133-43691`)

### 1.3 Data Normalization Service (CRITICAL)
**What's missing:** Data cleaning pipeline.

- Phone number normalization (84xxxxxxxxx → 0xxxxxxxxx)
- DateTime unification (multiple input formats → UTC+7 standard)
- LAC/Cell integer extraction (handles both split columns and merged)
- Null/NaN handling for optional fields (IMSI, duration for SMS)

### 1.4 Analytics Engine (CRITICAL)
**What's missing:** Server-side computation of analytical outputs.

- Top contacts frequency ranking
- Hourly activity distribution (24-bucket histogram)
- Weekly activity distribution (7-day histogram)
- IMEI change timeline detection
- Contact network graph data (for social network analysis)
- Geospatial trajectory timeline from LAC/Cell sequences

### 1.5 BTS Tower Coordinate Database (HIGH)
**What's missing:** A reference database mapping `(LAC, Cell ID)` pairs to real GPS coordinates.

This is required for the GTP (Geospatial Telemetry Processor) map feature to show real locations.
Currently the GTP screen uses hardcoded mock Hanoi coordinates.

**Options:**
1. Import publicly available Vietnamese BTS tower datasets
2. Allow manual coordinate entry per tower (as the legacy module does)
3. Use an external API (e.g., OpenCelliD)

---

## 2. MISSING FRONTEND COMPONENTS

### 2.1 Telecom Analysis Module Screen (CRITICAL)
**What's missing:** A new screen in the Sentinel shell for the telecom module.

The root `index.html` has GTP, FLA, SRAU screens — but **no telecom CDR analysis screen**.
The legacy `Mau/index.html` is a separate standalone page, not integrated into the shell.

**Required:** A new `telecom-screen` div with sidebar nav link, matching the Sentinel design language, with:
- Upload center (drag-drop, multi-file)
- Subscriber info display card
- CDR history table
- Stats cards (total calls, contacts, anomalies)
- Timeline for map navigation

### 2.2 Real API Wiring (CRITICAL)
**What's missing:** All `app.js` data is hardcoded mock data.

The GTP radar uses `MOCK_CELL_PATH[]`, the FLA uses `MOCK_BANK_LEDGER[]`, the SRAU uses `MOCK_TARGETS[]`.
All must be replaced with actual API calls when backend is ready.

### 2.3 Interactive Map (HIGH)
**What's missing:** A real interactive map library integration.

The current GTP screen uses a basic SVG radar — it cannot render actual street maps.

**Needed:** Leaflet.js integration for offline tile maps or OpenStreetMap tiles.

### 2.4 Chart Library Integration (HIGH)
**What's missing:** Root platform has no charting. Legacy module uses Chart.js.

Charts needed in the new telecom module:
- Hourly call distribution bar chart
- Day-of-week activity chart
- Contact frequency ranking chart

---

## 3. MISSING SECURITY INFRASTRUCTURE

### 3.1 Authentication (HIGH)
**What's missing:** Zero authentication exists in either the root platform or the legacy module.

Required for enterprise deployment:
- JWT token-based auth
- Login screen
- Session management
- Role-based access control

### 3.2 PII Encryption (HIGH)
**What's missing:** AES-256 encryption for sensitive fields.

The schema design doc specifies AES-256 for `phone_number`, `full_name`, `address` — but the implementation is completely absent.

---

## 4. MISSING INFRASTRUCTURE

### 4.1 Environment Configuration
- No `.env` file, no `config.py`
- No secrets management
- No CORS configuration for API

### 4.2 Async Task Processing
- Large Excel files (10,000+ rows) need background processing
- Progress reporting to frontend
- FastAPI `BackgroundTasks` or Celery queue

### 4.3 Module Entry Points
- No `requirements.txt` for Python dependencies
- No `package.json` for any frontend build tooling
- No startup scripts or `Makefile`

---

## 5. CRITICAL GAPS SUMMARY

> [!CAUTION]
> The root platform and the legacy module are **completely disconnected** — they share zero code paths, zero data, and zero API calls. The legacy module (`Mau/`) is a fully functional standalone tool, while the root platform (`index.html`) is a polished shell with only mock data. The enterprise integration requires bridging both systems.

> [!WARNING]  
> The `frontend/` and `backend/` directories are **completely empty**. All future code must be built from scratch in these directories, respecting the existing design language from the root platform.

> [!IMPORTANT]
> The BTS Tower coordinate database is the single biggest data dependency for the GTP (geospatial) feature. Without real LAC/Cell-to-GPS mappings, location analysis will remain approximate or manual.
