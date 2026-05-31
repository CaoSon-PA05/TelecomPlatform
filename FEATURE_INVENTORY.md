# FEATURE INVENTORY — TelecomPlatform (Sentinel CDR Analytics)
**Generated:** 2026-05-31  
**Source:** BUSINESS_LOGIC_AUDIT_TELECOM.md  
**Generator:** Claude Code (claude-sonnet-4-6)  
**Status:** Read-only — no source files modified

---

## LEGEND

| Symbol | Meaning |
|--------|---------|
| **CORE** | System cannot function without this feature |
| **IMPORTANT** | High value; needed before production |
| **OPTIONAL** | Nice-to-have; can be deferred |
| `[TELECOM]` | Domain-specific to Vietnamese telecom / CDR forensics |
| `[PLATFORM]` | Generic enough to become a shared platform-wide service |
| `[STUB]` | Defined / designed but not yet implemented |
| `[PARTIAL]` | Started but incomplete |
| `✓` | Implemented and working |

---

## MODULE INDEX

| ID | Module | Domain | Status |
|----|--------|--------|--------|
| M1 | File Upload & Validation | Platform | Implemented |
| M2 | CDR Parsing | Telecom | Partial |
| M3 | Phone Normalization & Classification | Telecom | Implemented |
| M4 | Database Import Pipeline | Platform | Stub |
| M5 | Analytics & Aggregation | Telecom | Partial |
| M6 | Export Engine | Platform | Implemented |
| M7 | Investigator Annotations | Platform | Stub |
| M8 | Authentication & Navigation | Platform | Implemented (insecure) |
| M9 | GTP — Geospatial Telemetry Processor | Telecom | Implemented |
| M10 | FLA — Financial Ledger Analyzer | Finance | Implemented |
| M11 | SRAU — Secure Endpoint Audit Utility | Security | Stub |

---

## M1 — FILE UPLOAD & VALIDATION `[PLATFORM]`

> Generic file ingestion pipeline. No telecom-specific logic.  
> Reusable for GTP, FLA, SRAU, and any future data module.

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 1.1 | Single file upload (`POST /imports/upload`) | **CORE** | — | ✓ | ✓ | 1.3, 1.4, 1.5 |
| 1.2 | Batch upload up to 20 files (max 4 concurrent) | IMPORTANT | — | ✓ | ✓ | 1.1 |
| 1.3 | Extension whitelist validation (`.xlsx`, `.xls`) | **CORE** | — | ✓ | ✓ | — |
| 1.4 | Magic-byte validation (XLSX=PK, XLS=D0CF) | **CORE** | — | ✓ | ✓ | — |
| 1.5 | Streaming size check (never loads full file) | **CORE** | — | ✓ | ✓ | — |
| 1.6 | Excel structural integrity check (openpyxl) | **CORE** | — | ✓ | ✓ | — |
| 1.7 | Phone extraction from filename (regex) | IMPORTANT | `[TELECOM]` | — | ✓ | 3.1 |
| 1.8 | Carrier auto-detection from extracted phone | IMPORTANT | `[TELECOM]` | — | ✓ | 3.5 |
| 1.9 | CDR sheet auto-selection (keyword scoring) | IMPORTANT | `[TELECOM]` | — | ✓ | — |
| 1.10 | Estimated record count from sheet metadata | OPTIONAL | — | ✓ | ✓ | 1.6 |
| 1.11 | Async file storage to disk (aiofiles) | **CORE** | — | ✓ | ✓ | — |
| 1.12 | Upload result with `upload_id` + metadata response | **CORE** | — | ✓ | ✓ | 1.1 |
| 1.13 | Import batch management (list / delete / retry) | IMPORTANT | — | ✓ | `[STUB]` | 4.2 |

**Dependency summary:**  
1.7 → requires M3 (phone normalization)  
1.8 → requires 3.5 (carrier detection)  
1.1 → gates all of M4 (DB import pipeline)

---

## M2 — CDR PARSING `[TELECOM]`

> Domain-specific to Vietnamese carrier CDR file formats.  
> Not reusable outside telecom context, but the abstract `BaseParser` pattern is platform-reusable.

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 2.1 | `BaseParser` abstract contract | **CORE** | — | ✓ | ✓ | — |
| 2.2 | Auto-detect carrier (filename → content cascade) | **CORE** | `[TELECOM]` | — | ✓ | 3.5 |
| 2.3 | Viettel CDR format parser (Sheet2, fixed cells) | **CORE** | `[TELECOM]` | — | ✓ | 3.1, 3.5 |
| 2.4 | Fixed-cell PII extraction (rows 0–21, 14 fields) | **CORE** | `[TELECOM]` | — | ✓ | — |
| 2.5 | Scored header-row detection (keyword density) | **CORE** | `[TELECOM]` | — | ✓ | — |
| 2.6 | Fuzzy column mapping with positional fallbacks | **CORE** | `[TELECOM]` | — | ✓ | — |
| 2.7 | CDR record extraction (row 22+) | **CORE** | `[TELECOM]` | — | ✓ | 2.5, 2.6, 3.1–3.4 |
| 2.8 | Vinaphone CDR format parser | **CORE** | `[TELECOM]` | — | `[STUB]` | 2.1 |
| 2.9 | Mobifone CDR format parser | **CORE** | `[TELECOM]` | — | `[STUB]` | 2.1 |
| 2.10 | Parse quality report (skipped rows, invalid fields) | IMPORTANT | — | ✓ | `[PARTIAL]` | 2.7 |
| 2.11 | Client-side CDR parser (JavaScript / SheetJS) | IMPORTANT | `[TELECOM]` | — | ✓ | 3.1–3.4 |
| 2.12 | Document reference (Công văn) extraction | OPTIONAL | `[TELECOM]` | — | ✓ | 2.4 |

**Dependency summary:**  
2.2 → requires M3 (phone normalization, carrier detection)  
2.3, 2.7 → require M3 (normalization + direction inference)  
2.8, 2.9 → blocked by their implementation; `auto_detector` already routes to them

---

## M3 — PHONE NORMALIZATION & CLASSIFICATION `[TELECOM]` → partially `[PLATFORM]`

> Core utility layer. Mostly telecom-specific (Vietnamese carriers, 10-digit format)  
> but the **normalization pattern** (strip → validate → classify) is platform-reusable.

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 3.1 | Strip non-digits (spaces, dashes, parens) | **CORE** | — | ✓ | ✓ | — |
| 3.2 | Strip country prefix (+84, 84) | **CORE** | `[TELECOM]` | — | ✓ | 3.1 |
| 3.3 | Prepend `0` to 9-digit numbers | **CORE** | `[TELECOM]` | — | ✓ | 3.1 |
| 3.4 | 10-digit format validation (`0[3-9]xxxxxxxx`) | **CORE** | `[TELECOM]` | — | ✓ | 3.1–3.3 |
| 3.5 | Carrier detection from prefix (Viettel/Vina/Mobi) | **CORE** | `[TELECOM]` | — | ✓ | 3.4 |
| 3.6 | Service sender detection (MBBANK, Apple, short codes) | **CORE** | `[TELECOM]` | — | ✓ | — |
| 3.7 | Direction inference (outgoing / incoming / service) | **CORE** | `[TELECOM]` | — | ✓ | 3.4, 3.6 |
| 3.8 | Cross-subscriber key: last-9 digits | **CORE** | `[TELECOM]` | — | ✓ | 3.4 |
| 3.9 | Phone equality check (prefix-agnostic) | **CORE** | `[TELECOM]` | — | ✓ | 3.8 |
| 3.10 | Province code normalization (TNH → Tay Ninh) | IMPORTANT | `[TELECOM]` | — | `[PARTIAL]` | — |
| 3.11 | Client-side phone normalizer (JavaScript mirror) | IMPORTANT | `[TELECOM]` | — | ✓ | — |

**Note on drift risk:** 3.11 is a JavaScript parallel of 3.1–3.9. Any change to the Python rules must be manually mirrored in `cdr-analyzer.js`. This is the highest maintenance risk in the codebase.

**Dependency summary:**  
Used by: M1 (1.7, 1.8), M2 (2.2, 2.3, 2.7), M4 (4.1), M5 (5.1, 5.3), M6 (6.7)

---

## M4 — DATABASE IMPORT PIPELINE `[PLATFORM]`

> Orchestrates ingestion of parsed data into persistent storage.  
> The pipeline pattern is generic; the entities it creates are telecom-specific.

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 4.1 | Trigger import from upload (`POST /imports/{id}/process`) | **CORE** | — | ✓ | `[STUB]` | M1, M2, M3 |
| 4.2 | ImportBatch creation (audit anchor, cascade delete) | **CORE** | — | ✓ | `[STUB]` | 4.1 |
| 4.3 | Subscriber upsert (create or update PII) | **CORE** | `[TELECOM]` | — | `[STUB]` | 4.2, M3 |
| 4.4 | Bulk CDRRecord insert (immutable fact table) | **CORE** | `[TELECOM]` | — | `[STUB]` | 4.2, 4.3 |
| 4.5 | Device upsert per IMEI | IMPORTANT | `[TELECOM]` | — | `[STUB]` | 4.4 |
| 4.6 | CellTower upsert per (LAC, CID) | IMPORTANT | `[TELECOM]` | — | `[STUB]` | 4.4 |
| 4.7 | ContactProfile aggregation rebuild | **CORE** | `[TELECOM]` | — | `[STUB]` | 4.4 |
| 4.8 | HourlyActivityStat rebuild (24h histogram) | IMPORTANT | — | ✓ | `[STUB]` | 4.4 |
| 4.9 | WeeklyActivityStat rebuild (day-of-week) | IMPORTANT | — | ✓ | `[STUB]` | 4.4 |
| 4.10 | TowerFrequencyStat rebuild | IMPORTANT | `[TELECOM]` | — | `[STUB]` | 4.4, 4.6 |
| 4.11 | DeviceSubscription timeline update | IMPORTANT | `[TELECOM]` | — | `[STUB]` | 4.4, 4.5 |
| 4.12 | Annotation preservation across re-imports | **CORE** | — | ✓ | `[STUB]` | 4.7 |
| 4.13 | Transactional rollback on failure (batch atomicity) | **CORE** | — | ✓ | `[STUB]` | 4.2 |
| 4.14 | IMEI model lookup (imei.info, async, optional) | OPTIONAL | `[TELECOM]` | — | `[STUB]` | 4.5 |
| 4.15 | Alembic database migrations | **CORE** | — | ✓ | `[STUB]` | — |

**Dependency summary:**  
All of M4 is blocked by the missing `process` endpoint (4.1).  
M5, M6, M7 all depend on M4 completing successfully.

---

## M5 — ANALYTICS & AGGREGATION `[TELECOM]`

> Query and aggregation layer over stored CDR facts.  
> Pre-computed stat tables (4.8–4.10) make analytics O(1) reads.

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 5.1 | Contact frequency (total/in/out/voice/SMS, filters) | **CORE** | `[TELECOM]` | — | ✓ (client) / `[STUB]` (server) | M4, M3 |
| 5.2 | Call history list (paginated, filterable by date/time) | **CORE** | `[TELECOM]` | — | `[STUB]` | M4 |
| 5.3 | Tower visit frequency per subscriber | **CORE** | `[TELECOM]` | — | ✓ (client) / `[STUB]` (server) | M4 |
| 5.4 | Movement timeline (location events, ordered) | IMPORTANT | `[TELECOM]` | — | ✓ (client) / `[STUB]` (server) | M4 |
| 5.5 | 24-hour activity histogram | IMPORTANT | — | ✓ | `[STUB]` | 4.8 |
| 5.6 | Day-of-week activity histogram | IMPORTANT | — | ✓ | `[STUB]` | 4.9 |
| 5.7 | IMEI device list per subscriber | **CORE** | `[TELECOM]` | — | ✓ (client) / `[STUB]` (server) | M4 |
| 5.8 | IMEI device swap forensics (usage timeline) | IMPORTANT | `[TELECOM]` | — | ✓ (client) / `[STUB]` (server) | 4.11 |
| 5.9 | Subscriber PII display (Tab 1) | **CORE** | `[TELECOM]` | — | `[STUB]` | M4 |
| 5.10 | Cross-subscriber shared contact query | IMPORTANT | `[TELECOM]` | — | ✓ (client) / `[STUB]` (server) | 4.7 |
| 5.11 | Cross-subscriber shared IMEI query | IMPORTANT | `[TELECOM]` | — | ✓ (client) / `[STUB]` (server) | 4.11 |
| 5.12 | Cross-subscriber shared tower query | IMPORTANT | `[TELECOM]` | — | ✓ (client) / `[STUB]` (server) | 4.10 |
| 5.13 | Movement map (Leaflet, tower GPS coordinates) | OPTIONAL | `[TELECOM]` | — | `[STUB]` | 4.6 |
| 5.14 | Contacts-by-tower (which contacts called from each tower) | OPTIONAL | `[TELECOM]` | — | ✓ (client) / `[STUB]` (server) | 5.1, 5.3 |
| 5.15 | Search / filter across contacts, IMEI, location | IMPORTANT | — | ✓ | ✓ (client) | 5.1–5.7 |

**Dependency summary:**  
5.1–5.9 → require M4 (DB import) for server-side; client-side works standalone.  
5.10–5.12 → require multiple subscribers imported → require M4.

---

## M6 — EXPORT ENGINE `[PLATFORM]`

> Generic XLSX generation with styled output.  
> `BaseExporter` + `ExcelExporter` are fully platform-reusable.  
> Only sheet content (column names, data sources) is telecom-specific.

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 6.1 | `BaseExporter` abstract contract | **CORE** | — | ✓ | ✓ | — |
| 6.2 | Single-sheet XLSX export (`BytesIO`) | **CORE** | — | ✓ | ✓ | 6.1 |
| 6.3 | Multi-sheet XLSX export (5 standard sheets) | **CORE** | — | ✓ | ✓ | 6.2 |
| 6.4 | TTTB sheet — Subscriber PII | **CORE** | `[TELECOM]` | — | ✓ | 6.3, M4 |
| 6.5 | LIST sheet — CDR records | **CORE** | `[TELECOM]` | — | ✓ | 6.3, M4 |
| 6.6 | Contact sheet — frequency + annotations | **CORE** | `[TELECOM]` | — | ✓ | 6.3, M7 |
| 6.7 | IMEI sheet — devices + usage periods | IMPORTANT | `[TELECOM]` | — | ✓ | 6.3, M7 |
| 6.8 | Location sheet — tower frequency + Maps link | IMPORTANT | `[TELECOM]` | — | ✓ | 6.3, M7 |
| 6.9 | GTP 3-sheet export (movement, LAC, signal) | IMPORTANT | `[TELECOM]` | — | ✓ | 6.1 |
| 6.10 | FLA 3-sheet export (transactions, stats, hours) | IMPORTANT | — | ✓ | ✓ | 6.1 |
| 6.11 | ZIP batch export (all subscribers) | IMPORTANT | — | ✓ | `[PARTIAL]` | 6.3 |
| 6.12 | Dark-theme XLSX styling (navy header, cyan text) | OPTIONAL | — | ✓ | ✓ | 6.2 |
| 6.13 | Conditional red highlight (anomaly rows) | IMPORTANT | — | ✓ | ✓ | 6.10 |
| 6.14 | Auto-width column sizing | OPTIONAL | — | ✓ | ✓ | 6.2 |
| 6.15 | Per-sheet export endpoints (calls / contacts / IMEI / location) | IMPORTANT | — | ✓ | `[STUB]` | 6.4–6.8 |
| 6.16 | Comparison result export | OPTIONAL | — | ✓ | `[STUB]` | 5.10–5.12 |
| 6.17 | Client-side XLSX export (SheetJS) | IMPORTANT | — | ✓ | ✓ | — |

**Dependency summary:**  
6.4–6.8 depend on M4 (data must be in DB) for server-side export.  
6.9 depends only on GTP module input data — fully self-contained.  
6.10 depends only on FLA module input data — fully self-contained.

---

## M7 — INVESTIGATOR ANNOTATIONS `[PLATFORM]`

> Persistent key-value metadata attached to entities by investigators.  
> Fully platform-reusable pattern (annotate any entity with any key-value).

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 7.1 | Contact annotation: Zalo ID, Facebook, Telegram, notes | **CORE** | `[TELECOM]` | — | `[STUB]` | M4 |
| 7.2 | Tower annotation: Google Maps URL, notes | IMPORTANT | `[TELECOM]` | — | `[STUB]` | M4 |
| 7.3 | IMEI annotation: device model, manufacturer, source | IMPORTANT | `[TELECOM]` | — | `[STUB]` | M4 |
| 7.4 | Annotations preserved across CDR re-imports | **CORE** | — | ✓ | `[STUB]` | 4.12 |
| 7.5 | PATCH contact annotations endpoint | **CORE** | — | ✓ | `[STUB]` | 7.1 |
| 7.6 | PATCH tower Google Maps link endpoint | IMPORTANT | — | ✓ | `[STUB]` | 7.2 |
| 7.7 | Client-side annotation storage (localStorage) | **CORE** | — | ✓ | ✓ | — |
| 7.8 | Annotations merged into export sheets | **CORE** | — | ✓ | ✓ (client) | 6.6–6.8, 7.1–7.3 |

**Dependency summary:**  
7.1–7.6 → require M4 (DB import) for server-side.  
7.7, 7.8 → work client-side without M4.

---

## M8 — AUTHENTICATION & NAVIGATION `[PLATFORM]`

> App shell, access control, and module routing.  
> Currently implemented but insecure (hardcoded credentials).

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 8.1 | Login gate (username + password) | **CORE** | — | ✓ | ✓ (insecure) | — |
| 8.2 | Session token validation (client-only sessionStorage) | **CORE** | — | ✓ | ✓ (insecure) | 8.1 |
| 8.3 | Multi-step auth animation (UX) | OPTIONAL | — | — | ✓ | 8.1 |
| 8.4 | 5-module sidebar navigation | **CORE** | — | ✓ | ✓ | 8.2 |
| 8.5 | Screen switching (one active module at a time) | **CORE** | — | ✓ | ✓ | 8.4 |
| 8.6 | Server-side JWT authentication | **CORE** | — | ✓ | `[STUB]` | — |
| 8.7 | Role-based access control (analyst / supervisor) | IMPORTANT | — | ✓ | `[STUB]` | 8.6 |
| 8.8 | Audit log (who accessed what, when) | IMPORTANT | — | ✓ | `[STUB]` | 8.6 |

**Critical gap:** 8.6 (server-side auth) must replace 8.1/8.2 before production.  
Hardcoded credentials (`canbo/ca@2024`, `sentinel/anm@2024`, `admin/Sentinel@2026`) are in plaintext JavaScript.

---

## M9 — GTP: GEOSPATIAL TELEMETRY PROCESSOR `[TELECOM]`

> Cell-tower location tracking from LAC/CID data.  
> Export engine (6.9) is fully implemented; UI is functional.

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 9.1 | GTP module UI (screen + file drop) | **CORE** | `[TELECOM]` | — | ✓ | M8 |
| 9.2 | Movement log sheet (time, LAC, CID, BTS, GPS) | **CORE** | `[TELECOM]` | — | ✓ | 6.9 |
| 9.3 | LAC zone frequency summary (occurrence + %) | IMPORTANT | `[TELECOM]` | — | ✓ | 6.9 |
| 9.4 | Signal strength classification (Good/Medium/Weak) | IMPORTANT | `[TELECOM]` | — | ✓ | 6.9 |
| 9.5 | Weak signal red highlight in export | OPTIONAL | — | ✓ | ✓ | 6.13 |
| 9.6 | LAC/CID → GPS coordinate lookup (cell DB) | IMPORTANT | `[TELECOM]` | — | `[STUB]` | — |
| 9.7 | Vector map with movement timeline (Leaflet) | OPTIONAL | `[TELECOM]` | — | `[STUB]` | 9.6 |
| 9.8 | Time-slider animation (movement replay) | OPTIONAL | `[TELECOM]` | — | `[STUB]` | 9.7 |

---

## M10 — FLA: FINANCIAL LEDGER ANALYZER `[FINANCE]`

> Bank transaction analysis and anomaly detection.  
> Self-contained; does not depend on CDR data. Partially reusable as a generic anomaly detector.

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 10.1 | FLA module UI (screen + file drop) | **CORE** | — | — | ✓ | M8 |
| 10.2 | Transaction list sheet (date, bank, amount, code, content, flag) | **CORE** | — | — | ✓ | 6.10 |
| 10.3 | Large transaction flag (amount ≥ 150M VND) | **CORE** | — | — | ✓ | 10.2 |
| 10.4 | Danger-hour flag (23:00, 00:00–04:00) | **CORE** | — | — | ✓ | 10.2 |
| 10.5 | Summary statistics sheet (totals, anomaly counts, per-bank) | IMPORTANT | — | ✓ | ✓ | 6.10 |
| 10.6 | Hourly transaction distribution (0–23) | IMPORTANT | — | ✓ | ✓ | 6.10 |
| 10.7 | Per-bank breakdown analysis | IMPORTANT | — | ✓ | ✓ | 10.5 |
| 10.8 | Configurable anomaly threshold (not yet exposed) | OPTIONAL | — | ✓ | `[PARTIAL]` | 10.3 |
| 10.9 | Transaction flow graph (Node Link Diagram) | OPTIONAL | — | ✓ | `[STUB]` | 10.2 |
| 10.10 | Red highlight on flagged rows (export) | IMPORTANT | — | ✓ | ✓ | 6.13 |
| 10.11 | `POST /exports/fla` endpoint | **CORE** | — | ✓ | ✓ | 6.10 |

---

## M11 — SRAU: SECURE ENDPOINT AUDIT UTILITY `[SECURITY]`

> Decoy link creation and target device fingerprinting.  
> Entirely unimplemented beyond navigation stub.

| # | Feature | Class | Telecom? | Platform? | Status | Depends On |
|---|---------|-------|----------|-----------|--------|------------|
| 11.1 | SRAU module UI (screen) | **CORE** | — | — | `[STUB]` | M8 |
| 11.2 | Decoy link generator (URL with embedded token) | **CORE** | — | — | `[STUB]` | — |
| 11.3 | Decoy page type selection (article / PDF / image) | IMPORTANT | — | — | `[STUB]` | 11.2 |
| 11.4 | Click event capture (IP, ISP, GPS estimate, UA, screen, ping, timestamp) | **CORE** | — | — | `[STUB]` | 11.2 |
| 11.5 | Real-time audit log stream (WebSocket) | IMPORTANT | — | — | `[STUB]` | 11.4 |
| 11.6 | Redirect chain configuration | OPTIONAL | — | — | `[STUB]` | 11.2 |
| 11.7 | Server-side beacon receiver (Node.js / Python) | **CORE** | — | — | `[STUB]` | 11.4 |

---

## FEATURE DEPENDENCY GRAPH

```
M1 (File Upload)
  │
  ├─► M2 (CDR Parsing) ─────────────────► M4 (DB Import)
  │         │                                    │
  │         └─► M3 (Phone Normalization)         ├─► M5 (Analytics)
  │                   │                          │       │
  │                   └──────────────────────────┤       ├─► M6 (Export)
  │                                              │       │
  │                                              ├─► M7 (Annotations) ─► M6
  │                                              │
  │                                              └─► M8 (Auth/Nav) [parallel]
  │
  ├─► M9 (GTP) ─────────────────────────────────────────► M6 (Export)
  │
  └─► M10 (FLA) ────────────────────────────────────────► M6 (Export)

M11 (SRAU) ─── standalone (no dependency on CDR pipeline)
```

**Critical path to end-to-end CDR flow:**  
`M1 → M2 → M3 → M4 → M5 → M6`  
Currently broken at: **M4 (no process endpoint)**

---

## TELECOM-SPECIFIC FEATURES

Features that are inherently tied to Vietnamese telecom / CDR forensics and **cannot be reused** outside that domain without modification:

| Feature ID | Description | Why Telecom-Specific |
|-----------|-------------|---------------------|
| 1.7, 1.8 | Phone extraction from filename, carrier detection | Vietnamese phone format + carrier prefix rules |
| 1.9 | CDR sheet auto-selection | CDR keyword vocabulary (tiếng Việt) |
| 2.2–2.12 | All CDR parsers (Viettel, Vina, Mobi) | Fixed Vietnamese carrier file formats |
| 3.2–3.9 | Phone normalization rules | Vietnamese 10-digit format, `+84`/`84` prefix, carrier prefix table |
| 3.6 | Service sender detection | Vietnamese bank codes (MBBANK, BIDV), carrier codes (MyViettel) |
| 3.7 | Call direction inference | CDR-specific source/target field semantics |
| 3.10 | Province code normalization | Vietnamese province code map (TNH, HCM, etc.) |
| 4.3, 4.4 | Subscriber and CDR record models | PII fields match Viettel/Vina/Mobi document layout |
| 4.5, 4.6 | Device (IMEI) and CellTower upsert | IMEI 15-digit + LAC/CID telecom identifiers |
| 4.10, 4.11 | TowerFrequencyStat, DeviceSubscription | BTS tower tracking, device swap forensics |
| 5.1–5.14 | All CDR analytics tabs | Contact forensics, tower movement, IMEI tracking |
| 6.4–6.8 | Export sheets (TTTB, LIST, Contact, IMEI, Location) | Vietnamese forensic report format |
| 6.9 | GTP 3-sheet export | Cell-LAC + signal strength columns |
| 9.1–9.8 | GTP module | Cell-tower geospatial processing |

---

## REUSABLE FEATURES — PLATFORM-WIDE CANDIDATES

Features generic enough to be extracted as shared platform services usable by any future module (FLA, SRAU, Case Management, etc.):

### Service 1: File Ingestion Service
**From:** M1 (features 1.1–1.6, 1.11, 1.12)  
**Provides:** Streaming upload → validation pipeline → async storage → metadata response  
**Reusable for:** Any module that accepts file uploads (GTP files, bank statements, evidence files)  
**Interface:** `validate(file) → result`, `store(file) → path`, `handle(file) → UploadedFile`

---

### Service 2: XLSX Export Engine
**From:** M6 (features 6.1, 6.2, 6.3, 6.12, 6.13, 6.14)  
**Provides:** `BaseExporter` + `ExcelExporter` — styled multi-sheet XLSX generation from plain dicts  
**Reusable for:** Any module needing Excel output (FLA already uses it; GTP already uses it)  
**Interface:** `export(data, sheet_name) → BytesIO`, `export_multi_sheet(sheets: dict) → BytesIO`

---

### Service 3: Batch Concurrency Controller
**From:** M1 (feature 1.2)  
**Provides:** Semaphore-limited concurrent task execution (max N at a time, up to 20 queued)  
**Reusable for:** Any batch operation (batch import, batch export, batch IMEI lookup)  
**Interface:** `batch_handle(files[], semaphore=4) → [results, errors]`

---

### Service 4: Time-Pattern Aggregator
**From:** M5 (features 5.5, 5.6), M10 (feature 10.6)  
**Provides:** 24-hour histogram + day-of-week histogram over any timestamped event dataset  
**Reusable for:** CDR activity patterns, bank transaction timing, SRAU click timing  
**Interface:** `hourly_histogram(events[], timestamp_field) → int[24]`, `weekly_histogram(...) → int[7]`

---

### Service 5: Threshold-Based Anomaly Flagger
**From:** M10 (features 10.3, 10.4, 10.8)  
**Provides:** Rule-based flagging with configurable thresholds; outputs a `flag: bool` column  
**Reusable for:** Financial anomalies, abnormal call frequency, unusual location visits, IMEI changes  
**Interface:** `flag(records[], rules: list[Rule]) → records_with_flags[]`

---

### Service 6: Annotation Store
**From:** M7 (features 7.1–7.8)  
**Provides:** Persistent key-value metadata attached to any entity; survives data re-imports  
**Reusable for:** Annotating contacts, towers, devices, bank accounts, IP addresses, cases  
**Interface:** `set(entity_type, entity_id, key, value)`, `get(entity_type, entity_id) → dict`, `merge_into(record)`

---

### Service 7: Entity Comparison Engine
**From:** M5 (features 5.10–5.12)  
**Provides:** Find shared entities across multiple data sets using a normalized comparison key  
**Reusable for:** Shared contacts across CDR files, shared bank accounts across statements, shared IPs across beacon logs  
**Interface:** `compare(datasets[], key_fn, min_overlap=2) → SharedEntity[]`

---

### Service 8: Import Batch Tracker
**From:** M4 (features 4.2, 4.13, 1.13)  
**Provides:** Atomic import unit with status tracking (pending / success / failed), cascade rollback, retry support  
**Reusable for:** Any data import operation that must be auditable and rollback-safe  
**Interface:** `create_batch(source, subscriber_id) → batch`, `finalize(batch, records)`, `fail(batch, reason)`

---

### Service 9: Structured Logging & Health API
**From:** M8 (features 8.8), backend core  
**Provides:** Structured JSON logs + liveness/readiness/info health endpoints  
**Reusable for:** Any FastAPI service in the platform  
**Interface:** `GET /health`, `GET /health/ready`, `GET /health/info`

---

## IMPLEMENTATION PRIORITY MATRIX

### Tier 1 — Critical Path (unblock end-to-end CDR flow)

| Priority | Feature IDs | Description |
|----------|------------|-------------|
| P1 | 4.1 | Implement `POST /imports/{id}/process` — connects upload to DB |
| P2 | 4.2–4.4 | ImportBatch + Subscriber upsert + CDR bulk insert |
| P3 | 4.7 | ContactProfile aggregation rebuild |
| P4 | 5.2 | `GET /{subscriber_id}/calls` — most-used analytics tab |
| P5 | 2.8, 2.9 | Vina + Mobi parsers — complete carrier coverage |

### Tier 2 — Complete Analytics (all 501 stubs)

| Priority | Feature IDs | Description |
|----------|------------|-------------|
| P6 | 5.9, 5.1, 5.7 | Subscriber / Contacts / IMEI tabs |
| P7 | 5.3, 5.4 | Location + movement timeline |
| P8 | 5.5, 5.6 | Hourly / weekly activity histograms |
| P9 | 5.10–5.12 | Cross-subscriber compare (contacts, IMEI, tower) |

### Tier 3 — Security & Infrastructure

| Priority | Feature IDs | Description |
|----------|------------|-------------|
| P10 | 8.6 | Server-side JWT authentication (replaces hardcoded logins) |
| P11 | 4.15 | Alembic database migrations |
| P12 | 3.10 | Province code normalization pass (complete the map) |
| P13 | 3.11 | Unify JS/Python phone normalization (single source of truth) |
| P14 | 8.7, 8.8 | RBAC + audit logging |

### Tier 4 — Optional Enhancements

| Priority | Feature IDs | Description |
|----------|------------|-------------|
| P15 | 10.8 | Configurable FLA anomaly threshold |
| P16 | 9.6–9.8 | Full GTP map with GPS coordinates + time slider |
| P17 | 11.1–11.7 | SRAU decoy link module (full implementation) |
| P18 | 4.14 | IMEI model auto-lookup (imei.info) |
| P19 | 10.9 | Transaction flow graph (Node Link Diagram) |
| P20 | 5.13 | Leaflet movement map per subscriber |

---

## FEATURE COUNT SUMMARY

| Module | Total Features | Core | Important | Optional | Implemented | Stub/Partial |
|--------|---------------|------|-----------|----------|-------------|-------------|
| M1 Upload | 13 | 7 | 4 | 2 | 12 | 1 |
| M2 CDR Parsing | 12 | 8 | 3 | 1 | 9 | 3 |
| M3 Phone Norm | 11 | 9 | 2 | 0 | 10 | 1 |
| M4 DB Import | 15 | 8 | 6 | 1 | 0 | 15 |
| M5 Analytics | 15 | 6 | 7 | 2 | 7 (client) | 15 (server) |
| M6 Export | 17 | 6 | 8 | 3 | 11 | 6 |
| M7 Annotations | 8 | 5 | 2 | 1 | 2 | 6 |
| M8 Auth/Nav | 8 | 5 | 2 | 1 | 5 | 3 |
| M9 GTP | 8 | 3 | 3 | 2 | 5 | 3 |
| M10 FLA | 11 | 4 | 5 | 2 | 9 | 2 |
| M11 SRAU | 7 | 4 | 2 | 1 | 0 | 7 |
| **TOTAL** | **125** | **65** | **44** | **16** | **70** | **62** |

**Implementation rate:** 56% overall (70/125 features).  
**Server-side implementation rate:** ~20% (M4 + M5 server-side = 0/30 features).  
**Client-side implementation rate:** ~85% of client-deliverable features.

---

*Generated by Claude Code (claude-sonnet-4-6) on 2026-05-31. No source files were modified.*
