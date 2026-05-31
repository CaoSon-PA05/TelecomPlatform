# MODULE ARCHITECTURE — `telecom_analysis`
**Version:** 1.0
**Date:** 2026-05-28
**Location:** `modules/telecom_analysis/`

---

## 1. PURPOSE

`telecom_analysis` is the enterprise Python module that ports all forensic CDR analytics from the legacy `Mau/script.js` (~13,645 lines of monolithic JavaScript) into a structured, testable, and scalable Python package.

**The legacy `Mau/` folder is never modified.** This module is a clean parallel implementation.

---

## 2. FULL DIRECTORY TREE

```
modules/
└── telecom_analysis/
    ├── __init__.py                         Module entry point + version
    │
    ├── parsers/                            Excel CDR file parsing
    │   ├── __init__.py
    │   ├── base_parser.py                  Abstract BaseParser, ParseResult, ColumnMap
    │   ├── column_mapper.py                Fuzzy column header matching (Levenshtein)
    │   ├── auto_detector.py                Cascade detector → selects correct parser
    │   ├── viettel_parser.py               Template 1: fixed cell PII + scored header
    │   ├── vina_parser.py                  Template 2: a_subs/b_subs columns
    │   └── mobi_parser.py                  Template 3: STT column + free-text PII
    │
    ├── normalizers/                        Raw value → typed normalized value
    │   ├── __init__.py
    │   ├── phone_normalizer.py             Phone → 0xxx, direction resolution
    │   ├── date_normalizer.py              DD/MM/YYYY, serial float → datetime
    │   ├── province_normalizer.py          TNH/T066 → 'Tay Ninh'
    │   └── provider_detector.py           Filename/content template detection
    │
    ├── analytics/                          Business analytics engines
    │   ├── __init__.py
    │   ├── base_analyzer.py                Abstract BaseAnalyzer (compute + rebuild_stats)
    │   ├── contact_analyzer.py             Contact frequency, shared contacts
    │   ├── imei_analyzer.py                IMEI list, device swap timeline
    │   ├── time_pattern_analyzer.py        Hourly/weekly histograms
    │   ├── location_analyzer.py            Tower frequency, movement timeline
    │   └── cross_subscriber_analyzer.py   Shared contacts/IMEI/locations across files
    │
    ├── schemas/                            Pydantic v2 request/response models
    │   ├── __init__.py
    │   ├── subscriber_schema.py            RawSubscriberInfo, Create, Response, Update
    │   ├── cdr_schema.py                   RawCDRRecord, Create, Response, FilterParams
    │   ├── contact_schema.py               ContactProfile, Annotation, Shared* results
    │   ├── analytics_schema.py             ActivityReport, TowerFrequency, IMEI, Movement
    │   └── import_schema.py                ImportRequest, ImportResult, BatchResponse
    │
    ├── services/                           Business logic façades (used by API routes)
    │   ├── __init__.py
    │   ├── import_service.py               Full file→DB pipeline orchestrator
    │   ├── subscriber_service.py           Subscriber CRUD
    │   ├── analytics_service.py            Façade over all analyzer classes
    │   ├── stats_service.py                Idempotent stats rebuild coordinator
    │   └── export_service.py               Excel + ZIP export generation
    │
    ├── exports/                            Output formatters
    │   ├── __init__.py
    │   ├── base_exporter.py                Abstract BaseExporter
    │   ├── excel_exporter.py               openpyxl multi-sheet workbook builder
    │   └── zip_exporter.py                 ZIP bundle for batch exports
    │
    ├── frontend/                           Python-side API response adapters
    │   ├── __init__.py
    │   ├── components/                     (future: per-component response schemas)
    │   │   └── __init__.py
    │   └── adapters/
    │       ├── __init__.py
    │       └── tab_adapters.py             format_*_tab() — one per frontend tab
    │
    ├── utils/                              Pure utility functions (no DB, no I/O)
    │   ├── __init__.py
    │   ├── constants.py                    Carrier prefixes, province map, column keywords
    │   ├── phone_utils.py                  normalize_phone, detect_carrier, is_service_sender
    │   ├── date_utils.py                   parse_cdr_timestamp, parse_pii_date
    │   └── file_utils.py                   read_excel_to_array, extract_phone_from_filename
    │
    └── tests/
        ├── __init__.py
        ├── conftest.py                     Shared fixtures: db, sample Excel data
        ├── test_parsers/
        │   ├── __init__.py
        │   └── test_auto_detector.py
        ├── test_normalizers/
        │   ├── __init__.py
        │   └── test_phone_normalizer.py
        ├── test_analytics/
        │   ├── __init__.py
        │   └── test_contact_analyzer.py
        └── test_services/
            ├── __init__.py
            └── test_import_service.py
```

---

## 3. LAYER ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Routes                        │
│             (not in this module — in backend/)           │
└─────────────────────┬───────────────────────────────────┘
                      │ calls
┌─────────────────────▼───────────────────────────────────┐
│                   services/                              │
│   ImportService  SubscriberService  AnalyticsService    │
│   StatsService   ExportService                          │
└──────┬──────────────────────┬───────────────────────────┘
       │                      │
┌──────▼──────┐    ┌──────────▼────────────┐
│  parsers/   │    │    analytics/          │
│  + normaliz-│    │  ContactAnalyzer       │
│  ers/       │    │  IMEIAnalyzer          │
│  + utils/   │    │  TimePatternAnalyzer   │
└──────┬──────┘    │  LocationAnalyzer      │
       │           │  CrossSubscriberAnalyzer│
       │           └──────────┬─────────────┘
       │                      │
┌──────▼──────────────────────▼─────────────────┐
│             backend/database/models/           │
│  Subscriber  CDRRecord  CellTower  Device      │
│  ContactProfile  DeviceSubscription  Stats     │
└────────────────────────────────────────────────┘
                      │
┌─────────────────────▼──────────────┐
│       SQLite (dev) / PostgreSQL    │
└────────────────────────────────────┘
```

---

## 4. SUB-PACKAGE CONTRACTS

### 4.1 `parsers/` — Input boundary

**Entry point:** `auto_detect_parser(data, filename)` → `BaseParser`

Each parser takes a raw 2-D list from openpyxl and returns a `ParseResult`:
```python
@dataclass
class ParseResult:
    subscriber_info: RawSubscriberInfo   # unvalidated PII
    records:         list[RawCDRRecord]  # one per Excel row
    column_map:      ColumnMap           # field → col index
    header_row_index: int
    missing_required: list[str]
    warnings:        list[str]
```

Parsers never write to the database. They only transform raw arrays.

---

### 4.2 `normalizers/` — Transformation layer

Pure functions that convert raw parser outputs to typed Python values:

| Function | Input | Output |
|----------|-------|--------|
| `normalize_phone("969619929")` | raw string | `"0969619929"` |
| `normalize_timestamp("11/07/2025 17:12:47")` | raw string | `datetime(2025,7,11,17,12,47,tz=UTC+7)` |
| `normalize_province("T066")` | raw code | `"Tay Ninh"` |
| `resolve_direction(src, tgt, owner)` | three strings | `(contact_phone, "outgoing")` |

---

### 4.3 `analytics/` — Analysis engines

All analyzers follow the `BaseAnalyzer` interface:
```python
class BaseAnalyzer(ABC):
    def __init__(self, db: Session): ...
    def compute(self, subscriber_id: int, **kwargs) -> schema: ...
    def rebuild_stats(self, subscriber_id: int) -> None: ...
```

`rebuild_stats()` is always idempotent: DELETE + INSERT, never UPDATE.

---

### 4.4 `schemas/` — API contracts

Two schema layers per domain:

| Schema type | Purpose |
|-------------|---------|
| `Raw*` | Direct parser output — all fields optional |
| `*Create` | Validated, typed — ready for DB insertion |
| `*Response` | API-facing — includes id, timestamps |
| `*Update` | Partial update — all fields optional |

---

### 4.5 `services/` — Orchestration

Route handlers call one method on one service — no direct DB access from routes:

| Service | Responsibility |
|---------|---------------|
| `ImportService.import_file(path)` | Parse → normalize → persist → rebuild stats |
| `SubscriberService.get_by_phone()` | Subscriber CRUD |
| `AnalyticsService.get_contacts()` | Tab-facing analytics queries |
| `StatsService.rebuild_all()` | Re-aggregate all stats tables |
| `ExportService.export_all()` | Multi-sheet Excel generation |

---

### 4.6 `frontend/adapters/` — Response shaping

Each `format_*_tab()` function maps a typed Pydantic schema to the exact JSON dictionary the frontend JavaScript expects for that tab:

```python
format_reports_tab(report: ActivityReport) -> {
    "hourly": [{"hour": 0, "total": 12, ...}, ...],   # Chart.js labels + data
    "weekly": [{"day": "Mon", "total": 8, ...}, ...],
    "peak_hour": 17,
    "peak_day": 4
}
```

This isolates frontend-breaking changes to a single file per tab.

---

## 5. DATA FLOW — FILE IMPORT

```
File dropped by user
        │
        ▼
utils/file_utils.read_excel_to_array(path)
        │  2-D list (raw)
        ▼
parsers/auto_detector.auto_detect_parser(data, filename)
        │  selected: ViettelParser | VinaParser | MobiParser
        ▼
parser.parse(data)
        │  ParseResult { subscriber_info, records[], column_map }
        ▼
services/import_service._upsert_subscriber(raw_info)
        │  subscriber_id
        ▼
services/import_service._create_batch(...)
        │  batch_id
        ▼
[for each RawCDRRecord]
    normalizers/phone_normalizer.normalize(source_raw)
    normalizers/phone_normalizer.resolve_direction(...)
    normalizers/date_normalizer.normalize_timestamp(timestamp_raw)
    normalizers/date_normalizer.normalize_duration(duration_raw)
    normalizers/province_normalizer.normalize_province(code_raw)
    import_service._get_or_create_device(imei_raw)
    import_service._get_or_create_tower(lac_raw, cell_id_raw, ...)
        │  CDRRecordCreate (validated, all FKs resolved)
        ▼
services/import_service._bulk_insert_records(...)
        │
        ▼
services/stats_service.rebuild_all(subscriber_id)
    ContactAnalyzer.rebuild_stats()
    IMEIAnalyzer.rebuild_stats()
    TimePatternAnalyzer.rebuild_stats()
    LocationAnalyzer.rebuild_stats()
        │
        ▼
ImportResult { success=True, records_imported=216, warnings=[] }
```

---

## 6. LEGACY COMPATIBILITY

| Legacy JS function | Python equivalent |
|-------------------|------------------|
| `detectNetworkProvider(phone)` | `utils/phone_utils.detect_carrier()` |
| `formatPhoneNumber(raw)` | `utils/phone_utils.normalize_phone()` |
| `getLast9Digits(phone)` | `utils/phone_utils.get_last_9_digits()` |
| `buildColumnMap(headerRow)` | `parsers/column_mapper.build_column_map()` |
| `findHeaderRow(data)` | `normalizers/provider_detector.find_header_row()` |
| `detectTemplate(data)` | `normalizers/provider_detector.detect_from_content()` |
| `analyzeContacts()` | `analytics/contact_analyzer.rebuild_stats()` |
| `analyzeTimePatterns()` | `analytics/time_pattern_analyzer.rebuild_stats()` |
| `analyzeLocations()` | `analytics/location_analyzer.rebuild_stats()` |
| `analyzeChanges()` | `analytics/imei_analyzer.rebuild_stats()` |
| `analyzeSharedContacts()` | `analytics/cross_subscriber_analyzer.find_shared_contacts()` |
| `exportToExcel()` | `exports/excel_exporter.ExcelExporter.export()` |
| `exportAllData()` | `services/export_service.ExportService.export_all()` |
| `generateFoliumMapHTML()` | `analytics/location_analyzer.get_movement_timeline()` → frontend |

---

## 7. TEST STRATEGY

| Test file | What is covered |
|-----------|----------------|
| `test_parsers/test_auto_detector.py` | Parser selection, real Excel file parsing, ParseResult shape |
| `test_normalizers/test_phone_normalizer.py` | All normalization edge cases from real data (84xxx, 9-digit, service names) |
| `test_analytics/test_contact_analyzer.py` | Stats rebuild, count accuracy, annotation persistence |
| `test_services/test_import_service.py` | End-to-end pipeline with real sample files + in-memory SQLite |

**`conftest.py`** fixtures:
- `db` — isolated in-memory SQLite per test function
- `viettel_raw_data` — real Excel file loaded once per session
- Sample phone values for parameterized tests

---

## 8. DEPENDENCIES REQUIRED

```
# requirements for this module
openpyxl>=3.1        # Excel reading + writing
pydantic>=2.0        # Schema validation
sqlalchemy>=2.0      # ORM (shared with backend/)
python-multipart     # file upload handling
pytest               # test runner
pytest-asyncio       # async test support (if FastAPI integration tested)
```
