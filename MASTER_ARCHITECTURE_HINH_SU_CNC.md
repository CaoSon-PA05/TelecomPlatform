# MASTER ARCHITECTURE — HÌNH SỰ CNC (Sentinel Intelligence Platform)
**Version:** 1.0 — Authoritative Single-Source Architecture  
**Generated:** 2026-05-31  
**Generator:** Claude Code (claude-sonnet-4-6)  
**Sources Consolidated:** 12 documents (audit files + all docs/ + SonPlatform audit)  
**Status:** Read-only — no source files modified

> **This document supersedes all individual architecture documents.**  
> When any prior doc conflicts with this document, this document wins.

---

## TABLE OF CONTENTS

1. [Platform Overview](#1-platform-overview)
2. [Conflicts Identified & Resolved](#2-conflicts-identified--resolved)
3. [Single Target Architecture](#3-single-target-architecture)
4. [Folder Structure (Canonical)](#4-folder-structure-canonical)
5. [Module Ownership](#5-module-ownership)
6. [Reusable Shared Libraries](#6-reusable-shared-libraries)
7. [Design System Strategy](#7-design-system-strategy)
8. [Intelligence UI Strategy](#8-intelligence-ui-strategy)
9. [Migration Phases](#9-migration-phases)
10. [API Contract (Canonical)](#10-api-contract-canonical)
11. [Database Schema Summary](#11-database-schema-summary)
12. [Security Architecture](#12-security-architecture)
13. [Testing Strategy](#13-testing-strategy)

---

## 1. PLATFORM OVERVIEW

**Platform name:** Sentinel Intelligence Platform — Hình Sự CNC  
**Mission:** End-to-end forensic analytics for Vietnamese law enforcement: CDR analysis, cell-tower geospatial tracking, financial anomaly detection, and secure endpoint auditing.

### 1.1 Two Codebases, One Platform

| Codebase | Path | Status | Role |
|----------|------|--------|------|
| **TelecomPlatform** | `C:\Users\ASUS\OneDrive\Desktop\New folder\Gravity\TelecomPlatform\` | Active — Partial | Full-stack: FastAPI backend + Vanilla JS frontend (migrating to React) |
| **SonPlatform** | `D:\SonPlatform\frontend\` | Active — Phases 1–4 complete | React 19 + TypeScript CDR client (browser-only mode) |

These two codebases implement the **same domain** from different angles. The target architecture merges them into a unified full-stack platform sharing a common design system and shared utility libraries.

### 1.2 Four Functional Modules

| Code | Full Name | Domain | Backend | Frontend |
|------|-----------|--------|---------|----------|
| **CDR** | CDR Analyzer (Phân Tích Viễn Thông) | Telecom | FastAPI + SQLAlchemy | React 19 |
| **GTP** | Geospatial Telemetry Processor | Telecom | FastAPI | React 19 + Leaflet |
| **FLA** | Financial Ledger Analyzer | Finance | FastAPI | React 19 + Recharts |
| **SRAU** | Secure Endpoint Audit Utility | Security | FastAPI + WebSocket | React 19 |

---

## 2. CONFLICTS IDENTIFIED & RESOLVED

The following conflicts were found across the 12 source documents. Each is resolved with a binding decision.

---

### CONFLICT 1 — Frontend Technology Stack

| Document | Position |
|----------|----------|
| `proposed_architecture.md` | "Vanilla JS (extend existing)" |
| `frontend_roadmap.md` | React 18 + Next.js + TailwindCSS + Shadcn/UI |
| `project_folder_structure.md` | React + Vite + Tailwind |
| `integration_plan.md` | Vanilla JS extension of root `app.js` |
| `SonPlatform architecture audit` | React 19 + TypeScript + Vite 6 + Zustand 5 — Phases 1–4 complete |

**RESOLUTION: React 19 + TypeScript + Vite 6 + Zustand 5**

Rationale: SonPlatform already has a production-quality React 19 + TypeScript architecture with clean layering (types → config → utils → services → workflows → UI). Rebuilding TelecomPlatform's frontend on the same stack eliminates a parallel implementation. The existing Vanilla JS code (`app.js`, `cdr-analyzer.js`) becomes a **temporary read-only reference** until each module is ported to React. Not Next.js — Vite SPA is sufficient and SonPlatform proves it works.

---

### CONFLICT 2 — State Management

| Document | Position |
|----------|----------|
| `frontend_roadmap.md` | Zustand (siêu nhẹ) |
| `project_folder_structure.md` | Zustand / React Context |
| `SonPlatform` | Zustand 5.0.5 with `useShallow` memoized selectors |
| `cdr-analyzer.js` | Manual IIFE with `Map<sessionId, _S>` |

**RESOLUTION: Zustand 5.0.5**  
Use the same slice + selector pattern as SonPlatform (`filesStore`, `compareStore`, `uiStore`, `currentFileStore`). The client-side `Map<sessionId, _S>` pattern from `cdr-analyzer.js` becomes `filesStore`'s `Map<fileId, FileData>`.

---

### CONFLICT 3 — CSS / Styling System

| Document | Position |
|----------|----------|
| `frontend_roadmap.md` | TailwindCSS + Shadcn/UI |
| `proposed_architecture.md` | Extend existing `styles.css` |
| `CLAUDE.md` | Custom CSS: `--bg-sentinel: #0b0d11`, `--accent-cyan: #00f0ff` (Brushed Steel theme) |
| `SonPlatform` | TailwindCSS 3 with full custom token system (`surface.*`, `brand.*`, `accent.*`) |
| `TelecomPlatform styles.css` | Custom CSS with HSL token variables |

**RESOLUTION: TailwindCSS 3 with Unified Token System**  
Shadcn/UI is excluded — it forces Radix UI dependency and conflicts with the existing tactical/cyber aesthetic. Use TailwindCSS with a unified token config (Section 7). The existing `styles.css` variables become the source of truth for color definitions migrated into Tailwind's config. No Shadcn/UI.

---

### CONFLICT 4 — Import Trigger Gap

All documents acknowledge that file upload (`POST /imports/upload`) stores a file but nothing calls `ImportService.import_file()`. No document proposes a consistent solution.

**RESOLUTION: Synchronous import on upload response**  
`POST /api/v1/imports/upload` runs the full parse + normalize + persist pipeline as a foreground task. No separate `process` endpoint. For files > 5000 rows, use FastAPI `BackgroundTasks` and return a `202 Accepted` with a polling endpoint `GET /api/v1/imports/{upload_id}/status`. Simple files respond `201 Created` synchronously with the full import result.

---

### CONFLICT 5 — AES-256 PII Encryption Scope

| Document | Position |
|----------|----------|
| `missing_components.md` | AES-256 for `phone_number`, `full_name`, `address` |
| `backend_roadmap.md` | Field-level encryption in Data Access Layer |
| `proposed_architecture.md` | Python `cryptography` (AES-256-GCM) |
| Current models | No encryption implemented anywhere |

**RESOLUTION: Defer field-level encryption to Phase 3**  
Implement it correctly (AES-256-GCM, per-row IV, key from environment) rather than quickly. Phase 1 and Phase 2 use plaintext fields with DB-level access control (file permissions on SQLite; PostgreSQL roles in production). Field encryption is a Phase 3 hardening item. Do not implement partial or incorrect encryption.

---

### CONFLICT 6 — BTS Tower GPS Source

| Document | Proposed Source |
|----------|----------------|
| `missing_components.md` | OpenCelliD API or manual entry |
| `proposed_architecture.md` | Seed file `towers_viettel_hanoi.sql` |
| `backend_roadmap.md` | Internal BTS dataset |
| `integration_plan.md` | Coordinate lookup from `towers` table |

**RESOLUTION: Manual + bulk import hybrid**  
Phase 1: `cell_towers` table accepts manual Google Maps annotations per (LAC, CID) — already in schema. Phase 2: provide a CSV/SQL import endpoint for bulk tower coordinate datasets. Phase 3: optional OpenCelliD integration as a fallback lookup. The `cell_towers` table is the canonical registry regardless of data source.

---

### CONFLICT 7 — Authentication Model

| Document | Position |
|----------|----------|
| `missing_components.md` | JWT + RBAC + session management |
| `backend_roadmap.md` | JWT (python-jose), `/api/v1/auth/` |
| `proposed_architecture.md` | JWT (python-jose) |
| Current `app.js` | Hardcoded accounts in JS — `canbo/ca@2024`, `sentinel/anm@2024`, `admin/Sentinel@2026` |

**RESOLUTION: JWT with two roles, Phase 1 minimum viable auth**  
Phase 1: replace hardcoded JS login with server-validated JWT. Two roles only: `analyst` (read + import + annotate) and `supervisor` (all + delete + compare + export). HTTP-only cookies for token storage. `python-jose` + `passlib[bcrypt]` backend. No OAuth, no SSO in Phase 1.

---

### CONFLICT 8 — Folder Structure (project_folder_structure.md vs proposed_architecture.md vs current)

`project_folder_structure.md` proposes a clean `backend/` + `frontend/` split with full React app.  
`proposed_architecture.md` proposes keeping `index.html` and extending `app.js`.  
Current reality: both are partially implemented.

**RESOLUTION: Two-phase transition (Section 4)**  
Phase 1: Backend becomes canonical. Phase 2: New `frontend/` React app replaces `index.html`/`app.js`. The legacy Vanilla JS files (`app.js`, `cdr-analyzer.js`, `cell-lac-parser.js`, etc.) stay frozen in place until their React equivalents are verified.

---

### DUPLICATED RECOMMENDATIONS (removed from target)

The following recommendations appeared in 3+ source documents and are consolidated into single entries in this document:
- JWT authentication → Section 12
- Alembic migrations → Section 9 Phase 1
- BTS tower database → Section 9 Phase 2
- Province code normalization → Section 6 (shared library)
- Cross-subscriber compare → Section 5 (CDR module)
- Dual-run verification → Section 9 Phase 3
- Unit tests with sample Excel files → Section 13

---

## 3. SINGLE TARGET ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SENTINEL INTELLIGENCE PLATFORM v2.0                      │
│                         Hình Sự CNC — Target State                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React 19 + TypeScript)          │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐   │
│  │   CDR   │  │   GTP   │  │   FLA   │  │    SRAU     │   │
│  │ Analyzer│  │Geospatial│  │Financial│  │  Endpoint   │   │
│  │ (9 tabs)│  │Telemetry│  │ Ledger  │  │   Audit     │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └─────┬───────┘   │
│       │            │            │              │            │
│  ┌────▼────────────▼────────────▼──────────────▼─────────┐ │
│  │              Shared UI Shell                           │ │
│  │  Auth Gate · Navigation · Toast · Modal · DataTable   │ │
│  └────────────────────────┬───────────────────────────────┘ │
└───────────────────────────┼──────────────────────────────────┘
                            │ HTTPS + JSON
┌───────────────────────────▼──────────────────────────────────┐
│                    BACKEND (FastAPI + Python)                 │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ /imports │  │/analytics│  │ /exports │  │  /compare   │ │
│  │ /upload  │  │/calls    │  │ /xlsx    │  │  /contacts  │ │
│  │ /process │  │/contacts │  │ /zip     │  │  /imei      │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬──────┘ │
│       │             │             │                │        │
│  ┌────▼─────────────▼─────────────▼────────────────▼──────┐ │
│  │                   Service Layer                         │ │
│  │  ImportService · AnalyticsService · ExportService      │ │
│  │  SubscriberService · StatsService · CompareService     │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼──────────────────────────────────┐ │
│  │              modules/telecom_analysis/                  │ │
│  │  parsers/ · normalizers/ · analytics/ · exports/       │ │
│  │  utils/   · schemas/    · services/  · tests/          │ │
│  └──────────────────────┬──────────────────────────────────┘ │
└─────────────────────────┼────────────────────────────────────┘
                          │ SQLAlchemy ORM
┌─────────────────────────▼────────────────────────────────────┐
│              DATABASE (SQLite dev → PostgreSQL prod)         │
│                                                              │
│  subscribers · cdr_records · devices · cell_towers          │
│  contact_profiles · device_subscriptions · import_batches   │
│  hourly_activity_stats · weekly_activity_stats              │
│  tower_frequency_stats                                       │
└──────────────────────────────────────────────────────────────┘
```

### 3.1 Technology Stack (Canonical)

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend framework | React | 19.1.0 | Strict mode |
| Frontend language | TypeScript | ~5.8+ | `strict: true` |
| Frontend build | Vite | 6.x | SPA, no SSR |
| Frontend state | Zustand | 5.0.5 | Slices + `useShallow` selectors |
| Frontend routing | React Router | 7.x | Lazy-loaded routes |
| Frontend tables | TanStack Table | 8.x | Headless, no Shadcn |
| Frontend charts | Recharts | 2.x | Replaces Chart.js in new frontend |
| Frontend maps | Leaflet | 1.9.x | Offline tiles supported |
| Frontend CSS | TailwindCSS | 3.4.x | Custom token config (Section 7) |
| Frontend Excel | SheetJS (xlsx) | 0.18.5 | Client-side read/write |
| Frontend icons | Lucide React | latest | |
| Backend framework | FastAPI | 0.115+ | Python 3.12 |
| Backend ORM | SQLAlchemy | 2.0.x | |
| Backend migrations | Alembic | latest | |
| Backend validation | Pydantic | 2.x | |
| Backend Excel | openpyxl | 3.1.5 | |
| Backend analytics | Pandas | 2.2.x | |
| Backend auth | python-jose + passlib | latest | JWT + bcrypt |
| Database (dev) | SQLite | 3.x | File: `sentinel.db` |
| Database (prod) | PostgreSQL | 16+ | |
| Python tests | pytest + pytest-asyncio | latest | |
| Frontend tests | Vitest | 3.x | |

---

## 4. FOLDER STRUCTURE (CANONICAL)

This is the **single authoritative** folder structure. All prior proposals (`proposed_architecture.md`, `project_folder_structure.md`, `module_architecture.md`) are superseded.

```
TelecomPlatform/                          ← Repository root
│
├── MASTER_ARCHITECTURE_HINH_SU_CNC.md   ← This document (authoritative)
├── BUSINESS_LOGIC_AUDIT_TELECOM.md       ← Source audit
├── FEATURE_INVENTORY.md                  ← Feature classification
├── TELECOM_MODULE_MAP.md                 ← Module map
│
├── ── LEGACY (DO NOT MODIFY) ──
├── Mau/                                  ← Legacy CDR Analyzer (frozen)
│   ├── index.html, script.js, styles.css
│   └── File data mau/                    ← Real sample Excel files for testing
│
├── ── CURRENT VANILLA JS (TRANSITIONAL) ──
├── index.html                            ← Current shell (kept until Phase 2)
├── app.js                                ← Current controller (Phase 1: auth wired here)
├── styles.css                            ← Current design tokens (migrated to Tailwind in P2)
├── cdr-analyzer.js                       ← Frozen reference (client-side CDR)
├── cell-lac-parser.js                    ← Frozen reference (GTP parser)
├── bank-parser.js                        ← Frozen reference (FLA parser)
├── [other *.js]                          ← Frozen reference files
│
├── ── BACKEND (ACTIVE — BUILD HERE) ──
├── backend/
│   ├── app/
│   │   ├── main.py                       ← FastAPI factory + lifespan hooks
│   │   ├── core/
│   │   │   ├── config.py                 ← Settings (pydantic-settings, .env-driven)
│   │   │   ├── exceptions.py             ← Typed exception hierarchy
│   │   │   ├── logging.py                ← Structured JSON logging (prod) / text (dev)
│   │   │   └── security.py              ← JWT encode/decode, password hash
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py             ← Aggregate all v1 routers
│   │   │       └── routers/
│   │   │           ├── auth.py           ← POST /auth/login, POST /auth/refresh
│   │   │           ├── imports.py        ← POST /imports/upload (sync + async)
│   │   │           ├── subscribers.py   ← CRUD /subscribers
│   │   │           ├── analytics.py     ← GET /analytics/{subscriber_id}/...
│   │   │           ├── exports.py       ← GET|POST /exports/...
│   │   │           ├── compare.py       ← POST /compare/{contacts|imei|locations}
│   │   │           └── health.py        ← GET /health, /health/ready, /health/info
│   │   ├── services/
│   │   │   └── upload/
│   │   │       ├── validator.py          ← Async streaming file validation
│   │   │       ├── metadata.py          ← Excel sheet metadata extraction
│   │   │       └── handler.py           ← Upload pipeline orchestrator
│   │   └── utils/
│   │       ├── pagination.py            ← Paginated query helper
│   │       └── responses.py             ← Standard JSON response wrappers
│   │
│   ├── database/
│   │   ├── base.py                       ← DeclarativeBase
│   │   ├── session.py                    ← Engine + SessionLocal + get_db()
│   │   └── models/
│   │       ├── enums.py                  ← Carrier, CommType, Direction, ServiceCategory
│   │       ├── subscriber.py             ← Subscriber PII
│   │       ├── cdr_record.py             ← Immutable CDR fact table
│   │       ├── device.py                 ← IMEI → device info
│   │       ├── cell_tower.py             ← (LAC, CID) → GPS + annotations
│   │       ├── contact_profile.py        ← Pre-aggregated contacts + social annotations
│   │       ├── device_subscription.py   ← Subscriber ↔ device timeline
│   │       ├── import_batch.py           ← Import audit log
│   │       └── stats.py                  ← Hourly / weekly / tower frequency stats
│   │
│   ├── alembic/                          ← Database migrations
│   │   ├── alembic.ini
│   │   ├── env.py
│   │   └── versions/
│   │       └── 001_initial_schema.py     ← Initial migration (Phase 1 deliverable)
│   │
│   ├── requirements.txt
│   └── .env.example
│
├── ── ANALYSIS ENGINE (ACTIVE — SHARED BY BACKEND) ──
├── modules/
│   └── telecom_analysis/
│       ├── parsers/                      ← base, column_mapper, auto_detector,
│       │                                    viettel, vina, mobi
│       ├── normalizers/                  ← phone, date, province, provider
│       ├── analytics/                    ← base, contact, imei, location,
│       │                                    time_pattern, frequency, cross_subscriber,
│       │                                    aggregator, record_normalizer, results
│       ├── exports/                      ← base, excel (5-sheet), gtp (3-sheet),
│       │                                    fla (3-sheet), zip
│       ├── services/                     ← import, subscriber, analytics,
│       │                                    stats, export
│       ├── schemas/                      ← subscriber, cdr, contact,
│       │                                    analytics, import
│       ├── utils/                        ← phone_utils, constants, date_utils, file_utils
│       └── tests/
│           ├── conftest.py
│           ├── test_parsers/
│           ├── test_normalizers/
│           ├── test_analytics/
│           └── test_services/
│
├── ── FRONTEND v2 (BUILD IN PHASE 2) ──
├── frontend/                             ← New React 19 + TypeScript app
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts                ← Unified design tokens (Section 7)
│   └── src/
│       ├── main.tsx
│       ├── app/
│       │   ├── App.tsx
│       │   └── Router.tsx                ← Lazy routes per module
│       ├── types/                        ← Result<T,E>, all data contracts
│       ├── config/                       ← Constants, carrier prefixes, patterns
│       ├── utils/                        ← Phone normalizer, date parser, validators
│       ├── services/                     ← API client + all business logic
│       ├── store/                        ← Zustand slices + selectors
│       ├── workflows/                    ← Orchestration (services → store)
│       ├── workers/                      ← Excel parser Web Worker
│       ├── shared/
│       │   ├── layouts/                  ← DashboardLayout, Sidebar, TopBar
│       │   └── components/              ← DataTable, Modal, Toast, Filter, Badge
│       └── modules/
│           ├── cdr-analyzer/            ← 9-tab CDR module
│           ├── gtp/                     ← Geospatial Telemetry Processor
│           ├── fla/                     ← Financial Ledger Analyzer
│           └── srau/                    ← Secure Endpoint Audit Utility
│
├── ── DATA FIXTURES ──
├── templates/
│   └── carriers/
│       ├── viettel_template.json         ← Column map + PII cell definitions
│       ├── vinaphone_template.json
│       └── mobiphone_template.json
│
├── ── DOCUMENTATION ──
├── docs/
│   ├── [all existing docs — read-only reference]
│   └── [new docs go here]
│
└── ── REFERENCE (READ-ONLY) ──
    └── reference/
        └── script.js                    ← Legacy JS reference (never modify)
```

---

## 5. MODULE OWNERSHIP

Each module has a single designated owner layer responsible for defining its interface, writing tests, and approving changes.

### 5.1 Backend Module Ownership

| Module | Owner | Files | Interface |
|--------|-------|-------|-----------|
| **Phone Normalization** | `modules/telecom_analysis/utils/` | `phone_utils.py`, `normalizers/phone_normalizer.py` | `normalize_phone()`, `detect_carrier()`, `resolve_direction()` |
| **CDR Parsing** | `modules/telecom_analysis/parsers/` | `auto_detector.py`, `viettel_parser.py`, `vina_parser.py`, `mobi_parser.py` | `auto_detect_parser(data, filename) → BaseParser` |
| **Column Mapping** | `modules/telecom_analysis/parsers/` | `column_mapper.py` | `build_column_map(header_row) → ColumnMap` |
| **Date Normalization** | `modules/telecom_analysis/normalizers/` | `date_normalizer.py` | `normalize_timestamp(raw) → datetime` |
| **Province Normalization** | `modules/telecom_analysis/normalizers/` | `province_normalizer.py` | `normalize_province(code) → str` |
| **Contact Analysis** | `modules/telecom_analysis/analytics/` | `contact_analyzer.py` | `rebuild_stats(subscriber_id)` |
| **Location Analysis** | `modules/telecom_analysis/analytics/` | `location_analyzer.py` | `get_movement_timeline(subscriber_id)` |
| **IMEI Analysis** | `modules/telecom_analysis/analytics/` | `imei_analyzer.py` | `get_device_swap_timeline(subscriber_id)` |
| **Time Patterns** | `modules/telecom_analysis/analytics/` | `time_pattern_analyzer.py` | `rebuild_stats(subscriber_id)` |
| **Cross-Subscriber Compare** | `modules/telecom_analysis/analytics/` | `cross_subscriber_analyzer.py` | `find_shared_contacts()`, `find_shared_imei()`, `find_shared_locations()` |
| **Excel Export** | `modules/telecom_analysis/exports/` | `excel_exporter.py` | `export_multi_sheet(sheets) → BytesIO` |
| **GTP Export** | `modules/telecom_analysis/exports/` | `gtp_exporter.py` | `export(data) → BytesIO` |
| **FLA Export** | `modules/telecom_analysis/exports/` | `fla_exporter.py` | `export(data) → BytesIO` |
| **Import Orchestration** | `modules/telecom_analysis/services/` | `import_service.py` | `import_file(path, subscriber_id) → ImportResult` |
| **Stats Rebuild** | `modules/telecom_analysis/services/` | `stats_service.py` | `rebuild_all(subscriber_id)` — idempotent, DELETE + INSERT |
| **File Validation** | `backend/app/services/upload/` | `validator.py`, `handler.py` | `handle_upload(file) → UploadedFile` |
| **Authentication** | `backend/app/core/` | `security.py` | `create_token()`, `verify_token()`, `hash_password()` |

### 5.2 Frontend Module Ownership

| Module | Owner | Path | Consumes |
|--------|-------|------|---------|
| **Phone Utils (TS)** | `src/utils/` | `phoneNormalizer.ts` | Nothing — pure functions |
| **Date Utils (TS)** | `src/utils/` | `dateParser.ts` | Nothing — pure functions |
| **CDR Types** | `src/types/` | All `.ts` type files | Nothing — contracts only |
| **Config / Constants** | `src/config/` | `constants.ts`, `networkProviders.ts` | Types |
| **Service Layer** | `src/services/` | `cdrParserService.ts`, `analysisEngineService.ts`, etc. | Types, Config, Utils |
| **State (Zustand)** | `src/store/` | `filesStore.ts`, `compareStore.ts`, `uiStore.ts` | Types |
| **Workflows** | `src/workflows/` | `uploadWorkflow.ts`, `analyzeWorkflow.ts`, etc. | Services, Store |
| **Web Worker** | `src/workers/` | `excelParser.worker.ts` | Services |
| **Shared Layout** | `src/shared/layouts/` | `DashboardLayout.tsx`, `Sidebar.tsx`, `TopBar.tsx` | Store |
| **Shared Components** | `src/shared/components/` | `DataTable`, `Modal`, `Toast`, `Filter` | Store (toast/modal) |
| **CDR Module** | `src/modules/cdr-analyzer/` | 9 panels + GlobalSearch | Workflows, Store, Shared |
| **GTP Module** | `src/modules/gtp/` | GTP panels | Workflows, Store, Shared |
| **FLA Module** | `src/modules/fla/` | FLA panels | Workflows, Store, Shared |
| **SRAU Module** | `src/modules/srau/` | SRAU panels | Workflows, Store, Shared |

### 5.3 Ownership Rules

1. **A module may only import from its own layer or a layer below it.** The diagram in Section 3.1 defines the valid import directions.
2. **Services never import from Store, Workflows, or UI.** Services are pure functions or DB-touching only.
3. **Workflows own the seam between services and store.** They call services, receive `Result<T,E>`, then write to the store.
4. **No component imports directly from another module's internals.** All cross-module data flows through the Store.
5. **`utils/` and `config/` are read-only at runtime.** No writing, no side effects.

---

## 6. REUSABLE SHARED LIBRARIES

These components are sufficiently generic to be used by CDR, GTP, FLA, and SRAU modules without modification.

### 6.1 Python Shared Libraries (`modules/telecom_analysis/utils/`)

| Library | Module | Interface | Consumers |
|---------|--------|-----------|-----------|
| **Phone Utils** | `phone_utils.py` | `normalize_phone()`, `get_last_9_digits()`, `detect_carrier()`, `is_service_sender()`, `phones_are_equal()` | All parsers, all analyzers, export service |
| **Date Utils** | `date_utils.py` | `normalize_timestamp()`, `format_date_vn()`, `parse_date_range()`, `excel_serial_to_datetime()` | All parsers, export service, API filters |
| **File Utils** | `file_utils.py` | `read_excel_to_array()`, `generate_upload_id()`, `sanitize_filename()`, `extract_phone_from_filename()` | Upload handler, import service |
| **Province Map** | `constants.py` → `province_normalizer.py` | `normalize_province(code) → str` | CDR parsers, location analyzer, export |
| **Carrier Prefixes** | `constants.py` | `VIETTEL_PREFIXES`, `VINA_PREFIXES`, `MOBI_PREFIXES` | `phone_utils.py`, `auto_detector.py` |
| **Column Keywords** | `constants.py` | `COLUMN_KEYWORDS`, `COLUMN_MATCH_THRESHOLD` | `column_mapper.py` |

### 6.2 Python Reusable Services

| Service | Interface | Consumers |
|---------|-----------|-----------|
| **BaseParser** | `parse(data: list[list]) → ParseResult` | Viettel, Vina, Mobi parsers |
| **BaseAnalyzer** | `compute(subscriber_id) → schema`, `rebuild_stats(subscriber_id)` | All analyzer classes |
| **BaseExporter** | `export(data) → BytesIO`, shared styling utilities | Excel, GTP, FLA exporters |
| **File Validator** | `validate_upload_file(file) → ValidationResult` | Any upload endpoint |
| **Batch Controller** | Semaphore(4) concurrency wrapper | Batch upload, batch export |
| **Import Batch** | Atomic batch anchor with cascade delete | Any file import operation |
| **Stats Rebuild** | Idempotent DELETE + INSERT per subscriber | Any import that changes CDR data |

### 6.3 TypeScript Shared Libraries (`src/`)

| Library | Path | Interface | Consumers |
|---------|------|-----------|---------|
| **Result<T,E>** | `src/types/Result.ts` | `ok(data)`, `err(error)`, `isOk()` | All services (enforced — never throw) |
| **Phone Normalizer** | `src/utils/phoneNormalizer.ts` | `normalizePhone()`, `getLast9Digits()`, `detectCarrier()`, `isServiceSender()` | CDR service, compare service, GTP |
| **Date Parser** | `src/utils/dateParser.ts` | `parseExcelDateTime()`, `parseDateFromTimestamp()` | CDR parser, FLA parser |
| **Validators** | `src/utils/validators.ts` | `validateIMEI()`, `validateExcelExtension()`, `generateFileId()` | Upload workflow, CDR parser |
| **DataTable** | `src/shared/components/Table/DataTable.tsx` | Headless TanStack Table wrapper | All 9 CDR tabs, GTP, FLA, Compare |
| **VirtualDataTable** | `src/shared/components/Table/VirtualDataTable.tsx` | Virtualized for > 1000 rows | Call history, contact list |
| **Modal** | `src/shared/components/Modal/Modal.tsx` | Controlled by `uiStore.activeModal` | Any module needing modals |
| **Toast** | `src/shared/components/Toast/ToastContainer.tsx` | `uiStore.addToast(msg, type)` | All modules |
| **Filter Components** | `src/shared/components/Filter/` | `DateRangeFilter`, `TimeRangeFilter`, `SearchInput` | CDR, FLA, GTP |
| **Badge** | `src/shared/components/Badge.tsx` | Direction, carrier, status variants | CDR call history, contacts |
| **Worker Bridge** | `src/workers/workerBridge.ts` | `parseExcelFile(file, hint)` → Promise | Upload workflow, GTP workflow |
| **Export Engine** | `src/services/exportService.ts` | `buildWorkbook()`, `downloadWorkbook()`, `workbookToBinaryString()` | All export workflows |
| **Annotation Store** | `src/services/annotationStorageService.ts` | `getContactAnnotation()`, `getIMEIModel()`, `getLocationAnnotation()` | CDR tabs, export |

### 6.4 Shared Rule: No Drift Between Python and TypeScript Phone Utils

The phone normalization algorithm **must be identical** in:
- Python: `modules/telecom_analysis/utils/phone_utils.py`
- TypeScript: `frontend/src/utils/phoneNormalizer.ts`

The canonical specification is in `modules/telecom_analysis/utils/phone_utils.py`. Any change to the normalization algorithm must be mirrored in TypeScript within the same commit. This is documented in `constants.py` and `constants.ts` which share the same prefix tables via copy (not API call — copy is intentional for offline support).

---

## 7. DESIGN SYSTEM STRATEGY

### 7.1 Decision: Single Unified Token System

The two codebases had divergent color systems. These are merged into one canonical TailwindCSS config.

| Prior System | SonPlatform Tokens | TelecomPlatform CLAUDE.md | Unified Token |
|-------------|-------------------|--------------------------|---------------|
| Background | `surface.DEFAULT: #0f1117` | `--bg-sentinel: #0b0d11` | `surface.DEFAULT: #0d0f14` |
| Card bg | `surface.card: #1a1d27` | `--panel-steel: #13161c` | `surface.card: #13161c` |
| Raised bg | `surface.raised: #222536` | — | `surface.raised: #1e2130` |
| Border | `surface.border: #2d3148` | `--border-light: rgba(255,255,255,0.07)` | Both kept as `surface.border` + `surface.border-glass` |
| Primary accent | `brand.DEFAULT: #3b82f6` (blue) | — | `brand.DEFAULT: #3b82f6` |
| Tactical accent | `accent.cyan: #22d3ee` | `--accent-cyan: #00f0ff` | `accent.cyan: #00f0ff` (TelecomPlatform wins — brighter) |
| Danger | `status.danger: #ef4444` | (implied) | `status.danger: #ef4444` |
| Text primary | `text.primary: #f1f5f9` | — | `text.primary: #f1f5f9` |

### 7.2 Canonical `tailwind.config.ts`

```typescript
// tailwind.config.ts — CANONICAL (applies to both frontend apps)
const config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d0f14',    // deepest background
          card:    '#13161c',    // card / panel (brushed steel)
          raised:  '#1e2130',    // raised surfaces, dropdowns
          border:  '#2d3148',    // solid borders
          glass:   'rgba(255,255,255,0.07)', // glassmorphism borders
          hover:   '#252840',    // hover state
        },
        brand: {
          DEFAULT: '#3b82f6',    // primary blue (data / analytics)
          glow:    '#60a5fa',
          dim:     '#1e3a5f',
          muted:   '#1d2d4a',
        },
        accent: {
          cyan:    '#00f0ff',    // tactical / active element highlight
          'cyan-dim': 'rgba(0,240,255,0.15)',
          purple:  '#a78bfa',    // secondary accent
          green:   '#34d399',    // success / confirmed
        },
        status: {
          success:     '#22c55e',
          'success-dim':'#14532d',
          warning:     '#f59e0b',
          'warning-dim':'#78350f',
          danger:      '#ef4444',
          'danger-dim':'#7f1d1d',
          info:        '#3b82f6',
          'info-dim':  '#1e3a5f',
        },
        text: {
          primary:   '#f1f5f9',
          secondary: '#94a3b8',
          muted:     '#475569',
          disabled:  '#334155',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Roboto Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':    'fadeIn 0.15s ease-out',
        'slide-up':   'slideUp 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-line':  'scanLine 2s linear infinite',
      },
      boxShadow: {
        'glow':       '0 0 12px rgba(0, 240, 255, 0.35)',
        'glow-sm':    '0 0 6px rgba(0, 240, 255, 0.25)',
        'glow-blue':  '0 0 12px rgba(59, 130, 246, 0.35)',
        'card':       '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.6)',
        'tactical':   '0 4px 20px rgba(0, 0, 0, 0.5)',
      },
    },
  },
}
```

### 7.3 Component Vocabulary

| Component | Tailwind Classes | Usage |
|-----------|-----------------|-------|
| **Tactical card** | `bg-surface-card border border-surface-glass rounded hover:border-accent-cyan hover:shadow-glow` | Module cards, panel containers |
| **Primary button** | `border border-accent-cyan text-accent-cyan hover:bg-accent-cyan hover:text-surface font-mono text-sm` | Primary actions |
| **Data table** | `bg-surface-card text-text-primary border-surface-border` | All CDR data views |
| **Badge: outgoing** | `bg-brand-dim text-brand-glow` | Call direction |
| **Badge: incoming** | `bg-status-success-dim text-status-success` | Call direction |
| **Badge: service** | `bg-surface-raised text-text-muted` | SMS from services |
| **Pulse indicator** | `w-2 h-2 rounded-full bg-accent-cyan shadow-glow-sm animate-pulse-slow` | Online status |
| **Danger highlight** | `bg-status-danger-dim text-status-danger` | FLA anomaly rows |
| **Weak signal** | `bg-status-danger-dim` | GTP signal rows |

### 7.4 Typography Rules

- **All phone numbers, IMEI, LAC/CID, timestamps:** `font-mono`
- **Headings, module codes (GTP-V4, FLA-ANALYTICS):** `font-mono text-accent-cyan`
- **Body text, labels, table cells:** `font-sans text-text-primary`
- **Secondary labels, captions:** `font-sans text-text-secondary`
- **Disabled / muted:** `text-text-muted`

---

## 8. INTELLIGENCE UI STRATEGY

This section defines how the platform presents itself visually and terminologically. All UI decisions follow the discreet enterprise aesthetic defined in `CLAUDE.md` and refined here.

### 8.1 Discreet Terminology Map (Canonical)

| Internal Forensic Term | Displayed Term (English) | Displayed Term (Vietnamese) |
|------------------------|--------------------------|----------------------------|
| CDR Analyzer (subscriber surveillance) | **CDR Analyzer** | Phân Tích Viễn Thông |
| Call Detail Record file | **Communication Log** | Nhật Ký Liên Lạc |
| Subscriber (surveillance target) | **Subject Node** | Nút Mục Tiêu |
| Cell-tower tracking | **Geospatial Telemetry Processor (GTP)** | Hệ Phân Tích Không Gian Viễn Thông |
| Financial transaction analysis | **Financial Ledger Analyzer (FLA)** | Bộ Đối Soát Luồng Tài Chính |
| Decoy link / tracking beacon | **Secure Endpoint Audit Utility (SRAU)** | Trình Kiểm Toán Điểm Cuối |
| Investigation case | **Active Operation** | Chuyên Án Đang Mở |
| Contact frequency (who they talk to) | **Interaction Frequency** | Tần Suất Tương Tác |
| Device swap forensics | **Device Continuity Analysis** | Phân Tích Liên Tục Thiết Bị |
| Co-location detection | **Concurrent Zone Presence** | Hiện Diện Vùng Đồng Thời |
| Shared contact (common associate) | **Common Node** | Nút Chung |

### 8.2 UI Aesthetic Principles

1. **Brushed Steel, not Hacker Green.** The aesthetic is high-end industrial / precision instrument — stainless steel and dark glass, not Matrix terminal.
2. **Tactical precision.** Data must be clearly readable at a glance. Dense tables are acceptable; clutter is not.
3. **Cyan is the signal color.** `accent.cyan` (#00f0ff) is used exclusively for: active states, selected rows, live indicators, and primary interactive elements. Never for decorative use.
4. **Red is only for genuine alerts.** `status.danger` is reserved for: FLA threshold violations, weak GTP signals, failed imports, critical system errors. Never used for style.
5. **Animation is sparse.** Only three animation types are permitted:
   - `fade-in` — panel/modal entry
   - `pulse-slow` — live connection indicator
   - `scan-line` — login overlay only (once per session)
6. **No emojis in the UI.** Use Lucide React icons or text codes (`[CRITICAL]`, `[ALERT]`).
7. **Monospace for all intelligence data.** Any value that represents a real-world identifier (phone, IMEI, LAC/CID, timestamp, IP address, GPS coordinate) is displayed in `font-mono`.

### 8.3 Module Card System

Each module is represented by a "tactical card" on the dashboard:

```
┌─ GTP-V4 ──────────────────── ● ONLINE ─┐
│                                         │
│  Hệ Không Gian Telemetry               │
│  Geospatial Telemetry Processor        │
│                                         │
│  Phân tích phân bổ nút sóng và         │
│  lịch trình di chuyển thiết bị.        │
│                                         │
│  [  KHỞI CHẠY MODULE  ]               │
└─────────────────────────────────────────┘
```

Card states:
- **ONLINE** (cyan pulse): Module functional, data loaded
- **STANDBY** (amber pulse): Module ready, no data
- **PROCESSING** (animated scan): Import or analysis in progress
- **OFFLINE** (red static): Error state

### 8.4 Tab Navigation Pattern (CDR Analyzer)

The CDR Analyzer's 9 tabs follow a numbered mission-sequence pattern:

```
[01 TTTB]  [02 CALLS]  [03 CONTACTS]  [04 IMEI]  [05 LOCATION]
[06 REPORT]  [07 MAP]  [08 COMPARE]  [09 EXPORT]
```

Active tab: `border-b-2 border-accent-cyan text-accent-cyan font-mono`  
Inactive tab: `text-text-secondary hover:text-text-primary`  
Unavailable tab: `text-text-muted opacity-40 cursor-not-allowed`

### 8.5 Data Density Standard

| View type | Row height | Font size | Columns shown |
|-----------|-----------|-----------|---------------|
| CDR call history | 36px | 12px | 8 (collapse 4 on narrow) |
| Contact list | 44px | 13px | 6 |
| IMEI list | 44px | 13px | 5 |
| Location list | 44px | 13px | 7 |
| Compare results | 36px | 12px | 5 |
| FLA transactions | 36px | 12px | 6 |

Minimum page size: 50 rows. Maximum: 500 rows. Default: 50 rows.

### 8.6 Login Gate Design

The login screen follows the CLAUDE.md specification exactly:
- Full-screen dark overlay (`bg-surface`)
- Corner brackets (CSS pseudo-elements)
- Scan-line animation (one-time on load)
- Badge: `"TRUY CẬP CÓ KIỂM SOÁT · CHỈ DÀNH CHO CÁN BỘ ĐƯỢC PHÊ DUYỆT"`
- Platform name: `SENTINEL` (Roboto Mono, large, `text-accent-cyan`)
- Subtitle: `PRECISION INTELLIGENCE ANALYTICS PLATFORM`
- No logo, no brand colors — only text and the cyan accent

---

## 9. MIGRATION PHASES

### Overview

```
PHASE 0           PHASE 1           PHASE 2           PHASE 3           PHASE 4
Foundation  ──►   Backend Core  ──►  Frontend      ──►  Security &    ──►  Advanced
(Now)             (4 weeks)          Migration          Hardening          Features
                                     (6 weeks)          (4 weeks)          (ongoing)
```

---

### PHASE 0 — Foundation (Current sprint)

**Goal:** Establish shared rules, fix critical gaps, no new features.

| Task | Owner | Deliverable |
|------|-------|-------------|
| Freeze all legacy JS files (no edits to `Mau/`, `cdr-analyzer.js`, `cell-lac-parser.js`) | All | Git tag `legacy-freeze-v1` |
| Complete `province_normalizer.py` province code map | modules/ | All Vietnamese provinces mapped |
| Complete `vina_parser.py` implementation | modules/ | Vina CDR files parse correctly |
| Complete `mobi_parser.py` implementation | modules/ | Mobi CDR files parse correctly |
| Run `alembic init` + generate `001_initial_schema.py` | backend/ | Migrations working |
| Write `conftest.py` fixtures using real sample Excel files from `Mau/File data mau/` | tests/ | 3 sample files loaded as fixtures |
| Write unit tests: `test_phone_normalizer.py` (all edge cases) | tests/ | 100% coverage of `phone_utils.py` |
| Write unit tests: `test_viettel_parser.py` with real Viettel file | tests/ | ParseResult validated |

**Done when:** All existing parsers pass against real sample files. Province map complete. Alembic baseline committed.

---

### PHASE 1 — Backend Core (Weeks 1–4)

**Goal:** End-to-end CDR import pipeline working. Analytics endpoints serving real DB data.

#### Week 1: Import Pipeline

| Task | Deliverable |
|------|-------------|
| Implement `ImportService.import_file(path, upload_id)` | Full parse → normalize → DB persist |
| Modify `POST /api/v1/imports/upload` to call ImportService synchronously for < 5000 rows | `201` response with `ImportResult` |
| Implement `POST /api/v1/imports/upload` async path (BackgroundTasks) for ≥ 5000 rows | `202` + `GET /imports/{id}/status` polling |
| Implement `GET /api/v1/imports/{id}/status` | Import progress + result |
| Test: import Viettel sample → verify subscriber, CDR records, stats in DB | All 3 stat tables populated |

#### Week 2: Subscriber + Analytics Endpoints

| Task | Deliverable |
|------|-------------|
| Implement `GET /api/v1/subscribers` (list, paginated) | `SubscriberResponse[]` |
| Implement `GET /api/v1/subscribers/{id}` | Single subscriber with report period |
| Implement `GET /api/v1/analytics/{subscriber_id}/calls` (paginated, filterable) | CDR records from DB |
| Implement `GET /api/v1/analytics/{subscriber_id}/contacts` | ContactProfile list |
| Implement `GET /api/v1/analytics/{subscriber_id}/imei` | Device list + usage periods |

#### Week 3: Location + Report + Compare

| Task | Deliverable |
|------|-------------|
| Implement `GET /api/v1/analytics/{subscriber_id}/location` | Tower frequency list |
| Implement `GET /api/v1/analytics/{subscriber_id}/report` | Hourly + weekly histograms |
| Implement `PATCH /api/v1/analytics/{subscriber_id}/contacts/{phone}` | Update annotation |
| Implement `PATCH /api/v1/towers/{lac}/{cell_id}/maps-link` | Update tower Maps URL |
| Implement `POST /api/v1/compare/contacts` | Shared contacts across subscribers |
| Implement `POST /api/v1/compare/imei` | Shared devices |
| Implement `POST /api/v1/compare/locations` | Shared towers |

#### Week 4: Export + Auth Stub

| Task | Deliverable |
|------|-------------|
| Implement `GET /api/v1/exports/{subscriber_id}/all` | 5-sheet XLSX download |
| Implement `POST /api/v1/exports/batch` | ZIP of all subscribers |
| Implement `POST /api/v1/exports/gtp` | GTP 3-sheet |
| Implement `POST /api/v1/exports/fla` | FLA 3-sheet |
| Implement `POST /api/v1/auth/login` (JWT issue) | JWT in HTTP-only cookie |
| Wire auth middleware to all `/api/v1/` routes | 401 on missing token |

**Done when:** Batch upload UI (`batch-ui.js`) calls backend, imports Viettel file, all analytics tabs return real DB data, exports download correctly.

---

### PHASE 2 — Frontend Migration (Weeks 5–10)

**Goal:** New React 19 + TypeScript frontend replaces the Vanilla JS app.

> The migration strategy from `migration_plan.md` is adopted:  
> **Dual-run period** — both `index.html` (Vanilla) and `frontend/` (React) run simultaneously.  
> Results must match 100% before the Vanilla JS app is retired.

#### Week 5–6: Shell + Auth + CDR Layout

| Task | Deliverable |
|------|-------------|
| `frontend/` React project initialized (Vite + TypeScript + TailwindCSS unified config) | `npm run dev` running |
| `DashboardLayout`, `Sidebar`, `TopBar` components | App shell with 4-module navigation |
| Login gate component (calls `POST /auth/login`, stores JWT in cookie) | Auth working |
| Route structure: `/`, `/cdr`, `/gtp`, `/fla`, `/srau` | Lazy-loaded per module |
| `filesStore`, `compareStore`, `uiStore`, `currentFileStore` (Zustand) | State management wired |

#### Week 7–8: CDR Module (9 Tabs)

| Task | Deliverable |
|------|-------------|
| File upload + batch UI (Dropzone → `POST /imports/upload`) | Upload with progress |
| Tab 1: Subscriber info panel | PII display from API |
| Tab 2: Call history table (paginated, filtered) | CDR records from API |
| Tab 3: Contacts panel + annotation fields | ContactProfile from API |
| Tab 4: IMEI panel + usage periods | Device list from API |
| Tab 5: Location panel + Maps links | Tower frequency from API |
| Tab 6: Report (Recharts hourly + weekly charts) | Histograms from API |
| Tab 7: Map (Leaflet movement timeline) | Tower GPS from API |
| Tab 8: Compare panel | Cross-subscriber from API |
| Tab 9: Export panel | Download from API |

#### Week 9: GTP + FLA Modules

| Task | Deliverable |
|------|-------------|
| GTP module: file drop → parse → 3-sheet export | Full GTP workflow |
| GTP module: Leaflet map with movement replay | Map rendering |
| FLA module: file drop → parse → anomaly flags → 3-sheet export | Full FLA workflow |
| FLA module: Recharts hourly distribution | Chart rendering |

#### Week 10: Dual-Run Verification + Cutover

| Verification Step | Pass Criteria |
|------------------|---------------|
| Import same Viettel file into both apps | 0% count discrepancy on contacts, calls, IMEI |
| Import same Vina file | Same verification |
| Import same Mobi file | Same verification |
| Cross-subscriber compare: same 3-file set | Identical shared contacts list |
| Export 5-sheet XLSX from both | Column-by-column match |
| Performance: 5000-row Viettel file | React app: < 3s full analysis. Vanilla: baseline |

**Cutover:** After 100% verification, `index.html` is archived (not deleted). React app becomes the entry point. `app.js`, `cdr-analyzer.js`, etc. remain frozen in root as reference.

---

### PHASE 3 — Security & Hardening (Weeks 11–14)

| Task | Deliverable |
|------|-------------|
| RBAC: two roles (`analyst`, `supervisor`) with middleware enforcement | Role-checked endpoints |
| Audit log: every import, export, annotation change, login event | `audit_log` table |
| AES-256-GCM field encryption for `phone_normalized`, `full_name`, `address`, `id_doc_number` | Encrypted at rest |
| Migration for encrypted columns (Alembic) | Zero data loss migration |
| CSP + security headers via FastAPI middleware | Content-Security-Policy, X-Frame-Options |
| CORS locked to production origins only | No `localhost` in prod |
| Rate limiting on upload endpoint (10 req/min per user) | `slowapi` or `fastapi-limiter` |
| Dependency audit (`pip audit`, `npm audit`) | Zero known CVEs in critical deps |
| BTS tower bulk import endpoint + CSV loader | `/api/v1/towers/import` |
| LocalStorage migration utility (Vanilla JS → backend) | `POST /api/v1/migration/import-localstorage` |

---

### PHASE 4 — Advanced Features (Ongoing)

These are enhancement features. They require Phase 1–3 to be complete before implementation.

| Feature | Depends On | Priority |
|---------|-----------|----------|
| GTP: full GPS coordinate resolution from OpenCelliD API | Phase 3 (tower bulk import) | HIGH |
| GTP: movement replay timeline slider with Canvas animation | Phase 2 (Leaflet map) | HIGH |
| FLA: configurable anomaly thresholds (per-user) | Phase 2 (FLA module) | MEDIUM |
| FLA: transaction flow graph (D3 force-directed) | Phase 2 (FLA module) | MEDIUM |
| SRAU: decoy link generator with WebSocket live log | Phase 3 (auth, security) | HIGH |
| Case Management: group multiple subscribers into named case | Phase 2 (CDR module) | HIGH |
| Investigator Report: narrative XLSX export from case | Case Management | MEDIUM |
| IMEI auto-lookup (imei.info) with rate limiting | Phase 3 | LOW |
| NLP: SMS content classification (banking, OTP, personal) | Phase 4 stable | LOW |
| Graph engine: contact network visualization | Phase 4 stable | LOW |

---

## 10. API CONTRACT (CANONICAL)

This section supersedes the API specs in `proposed_architecture.md` and `integration_plan.md`.

### 10.1 Base URL and Versioning

```
Development:  http://localhost:8000/api/v1/
Production:   https://sentinel.internal/api/v1/
```

All responses wrap with:
```json
{ "success": true, "data": {...} }
{ "success": false, "error": { "status_code": 422, "detail": "...", "errors": [] } }
```

### 10.2 Canonical Endpoints

```
POST   /auth/login                          → { token, role, expires_at }
POST   /auth/refresh                        → { token, expires_at }
POST   /auth/logout                         → 204

POST   /imports/upload                      → ImportResult (sync < 5000 rows)
                                            → { upload_id, status: "processing" } (async)
GET    /imports/{upload_id}/status          → { status, progress, result? }
GET    /imports/batches                     → BatchSummary[]
DELETE /imports/batches/{id}               → 204

GET    /subscribers                         → SubscriberSummary[] (paginated)
POST   /subscribers                         → Subscriber
GET    /subscribers/{id}                    → Subscriber
GET    /subscribers/phone/{phone}           → Subscriber
PATCH  /subscribers/{id}                   → Subscriber
DELETE /subscribers/{id}                   → 204

GET    /analytics/{id}/subscriber           → SubscriberDetail
GET    /analytics/{id}/calls                → CDRRecord[] (paginated, filterable)
GET    /analytics/{id}/contacts             → ContactProfile[]
PATCH  /analytics/{id}/contacts/{phone}    → ContactProfile (annotation update)
GET    /analytics/{id}/imei                 → ImeiSummary[]
GET    /analytics/{id}/imei/timeline       → DeviceSwapEvent[]
GET    /analytics/{id}/location             → TowerFrequency[]
GET    /analytics/{id}/location/timeline   → MovementEvent[]
PATCH  /towers/{lac}/{cell_id}/maps-link   → CellTower
GET    /analytics/{id}/report              → ActivityReport { hourly[24], weekly[7] }
GET    /analytics/{id}/map                 → MovementPoint[] (for Leaflet)

POST   /compare/contacts                   → SharedContactResult[]
POST   /compare/imei                       → SharedImeiResult[]
POST   /compare/locations                  → SharedLocationResult[]
POST   /compare/selected                   → CompareResult (subset)

GET    /exports/{id}/all                   → XLSX binary (Content-Disposition: attachment)
GET    /exports/{id}/calls                 → XLSX binary
GET    /exports/{id}/contacts              → XLSX binary
GET    /exports/{id}/imei                  → XLSX binary
GET    /exports/{id}/location              → XLSX binary
POST   /exports/batch                      → ZIP binary
POST   /exports/gtp                        → XLSX binary (3-sheet GTP)
POST   /exports/fla                        → XLSX binary (3-sheet FLA)
POST   /exports/compare                    → XLSX binary

POST   /migration/import-localstorage      → MigrationResult

GET    /health                             → { status: "ok" }
GET    /health/ready                       → { status: "ok", db: "ok" }
GET    /health/info                        → { version, env, uptime }
```

### 10.3 Standard Query Parameters (analytics endpoints)

```
?page=1                 Pagination (1-indexed)
?size=50                Page size (max 500)
?from=2025-01-01        Date range start (ISO 8601)
?to=2025-12-31          Date range end (ISO 8601)
?hour_from=8            Hour-of-day filter start (0–23)
?hour_to=22             Hour-of-day filter end (0–23)
?search=0987654321      Text search (phone, IMEI, address)
?type=VOICE             Filter by comm_type (VOICE | SMS)
?direction=outgoing     Filter by direction (outgoing | incoming | service)
?top_n=20               Limit top-N results (contacts, towers)
```

---

## 11. DATABASE SCHEMA SUMMARY

This is the canonical schema. Individual model files in `backend/database/models/` implement this.

```sql
-- Immutable PII anchor
CREATE TABLE subscribers (
    id                  INTEGER PRIMARY KEY,
    phone_normalized    TEXT UNIQUE NOT NULL,  -- "0982733506"
    phone_raw           TEXT,
    full_name           TEXT,
    date_of_birth       DATE,
    address             TEXT,
    id_doc_number       TEXT,
    id_issue_date       DATE,
    id_issue_authority  TEXT,
    activation_date     DATE,
    subscription_type   TEXT,
    account_status      TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Carrier CDR file import log
CREATE TABLE import_batches (
    id                  INTEGER PRIMARY KEY,
    subscriber_id       INTEGER REFERENCES subscribers(id),
    source_file_name    TEXT NOT NULL,
    document_ref        TEXT,              -- Công văn reference
    report_period_from  DATE,
    report_period_to    DATE,
    template_detected   TEXT,             -- viettel | vina | mobi
    total_records       INTEGER,
    import_status       TEXT DEFAULT 'pending', -- pending | success | failed
    error_message       TEXT,
    imported_at         TIMESTAMP DEFAULT NOW()
);

-- Immutable CDR fact table (one row per call/SMS)
CREATE TABLE cdr_records (
    id                      INTEGER PRIMARY KEY,
    subscriber_id           INTEGER REFERENCES subscribers(id),
    batch_id                INTEGER REFERENCES import_batches(id) ON DELETE CASCADE,
    source_file_row         INTEGER,
    source_number_raw       TEXT,
    target_number_raw       TEXT,
    owner_phone             TEXT NOT NULL,
    contact_number          TEXT,          -- normalized
    direction               TEXT,          -- outgoing | incoming | service
    recorded_at             TIMESTAMP,
    duration_seconds        INTEGER,
    comm_type               TEXT,          -- VOICE | SMS
    service_direction_raw   TEXT,
    service_category        TEXT,          -- onnet | offnet | vas | international
    device_id               INTEGER REFERENCES devices(id),
    province_code_raw       TEXT,
    tower_id                INTEGER REFERENCES cell_towers(id)
);
CREATE INDEX ix_cdr_subscriber_time ON cdr_records(subscriber_id, recorded_at);
CREATE INDEX ix_cdr_contact_number  ON cdr_records(contact_number);
CREATE INDEX ix_cdr_tower_id        ON cdr_records(tower_id);
CREATE INDEX ix_cdr_device_id       ON cdr_records(device_id);

-- IMEI → device identity
CREATE TABLE devices (
    id                  INTEGER PRIMARY KEY,
    imei                TEXT UNIQUE NOT NULL,
    is_valid            BOOLEAN,
    device_model        TEXT,
    manufacturer        TEXT,
    lookup_completed_at TIMESTAMP,
    lookup_source       TEXT
);

-- (LAC, CID) → tower info + GPS + annotations
CREATE TABLE cell_towers (
    id                  INTEGER PRIMARY KEY,
    lac                 INTEGER NOT NULL,
    cell_id             INTEGER NOT NULL,
    carrier             TEXT,
    province_code_raw   TEXT,
    province_name       TEXT,
    bts_address         TEXT,
    latitude            REAL,
    longitude           REAL,
    google_maps_url     TEXT,
    notes               TEXT,
    UNIQUE(lac, cell_id)
);
CREATE INDEX ix_tower_lac_cell ON cell_towers(lac, cell_id);

-- Pre-aggregated contact cache + investigator annotations
CREATE TABLE contact_profiles (
    id                      INTEGER PRIMARY KEY,
    subscriber_id           INTEGER REFERENCES subscribers(id),
    contact_phone           TEXT NOT NULL,
    carrier                 TEXT,
    total_count             INTEGER DEFAULT 0,
    outgoing_count          INTEGER DEFAULT 0,
    incoming_count          INTEGER DEFAULT 0,
    voice_count             INTEGER DEFAULT 0,
    sms_count               INTEGER DEFAULT 0,
    first_interaction_at    TIMESTAMP,
    last_interaction_at     TIMESTAMP,
    -- Investigator annotations (preserved across re-imports):
    zalo_id                 TEXT,
    facebook_url            TEXT,
    telegram_id             TEXT,
    notes                   TEXT,
    UNIQUE(subscriber_id, contact_phone)
);

-- Subscriber ↔ device usage timeline (device swap forensics)
CREATE TABLE device_subscriptions (
    id                  INTEGER PRIMARY KEY,
    subscriber_id       INTEGER REFERENCES subscribers(id),
    device_id           INTEGER REFERENCES devices(id),
    first_seen_at       TIMESTAMP,
    last_seen_at        TIMESTAMP,
    interaction_count   INTEGER DEFAULT 0,
    UNIQUE(subscriber_id, device_id)
);

-- Pre-computed 24h histogram (rebuilt idempotently on each import)
CREATE TABLE hourly_activity_stats (
    id              INTEGER PRIMARY KEY,
    subscriber_id   INTEGER REFERENCES subscribers(id),
    hour_of_day     INTEGER,   -- 0–23
    total_count     INTEGER DEFAULT 0,
    voice_count     INTEGER DEFAULT 0,
    sms_count       INTEGER DEFAULT 0,
    outgoing_count  INTEGER DEFAULT 0,
    incoming_count  INTEGER DEFAULT 0,
    UNIQUE(subscriber_id, hour_of_day)
);

-- Pre-computed day-of-week histogram (ISO: 0=Monday, 6=Sunday)
CREATE TABLE weekly_activity_stats (
    id              INTEGER PRIMARY KEY,
    subscriber_id   INTEGER REFERENCES subscribers(id),
    day_of_week     INTEGER,   -- 0–6
    total_count     INTEGER DEFAULT 0,
    voice_count     INTEGER DEFAULT 0,
    sms_count       INTEGER DEFAULT 0,
    UNIQUE(subscriber_id, day_of_week)
);

-- Tower visit frequency per subscriber
CREATE TABLE tower_frequency_stats (
    id              INTEGER PRIMARY KEY,
    subscriber_id   INTEGER REFERENCES subscribers(id),
    tower_id        INTEGER REFERENCES cell_towers(id),
    total_count     INTEGER DEFAULT 0,
    first_seen_at   TIMESTAMP,
    last_seen_at    TIMESTAMP,
    UNIQUE(subscriber_id, tower_id)
);
CREATE INDEX ix_tower_freq_tower ON tower_frequency_stats(tower_id);
```

---

## 12. SECURITY ARCHITECTURE

### 12.1 Authentication (Phase 1)

- **JWT** in HTTP-only cookies (prevents XSS token theft)
- `access_token`: 8-hour expiry
- `refresh_token`: 7-day expiry, rotated on each use
- `python-jose` + `passlib[bcrypt]` (cost factor 12)
- Account credentials stored in a separate `users` table — not hardcoded in JS

### 12.2 Authorization (Phase 1)

Two roles enforced via FastAPI dependency injection:

| Role | Permissions |
|------|------------|
| `analyst` | Upload, import, view all tabs, annotate contacts/towers, export own imports |
| `supervisor` | All analyst permissions + delete subscribers/batches, compare across users, bulk export |

### 12.3 PII Encryption (Phase 3)

- Algorithm: AES-256-GCM
- Key: 32-byte key from `SENTINEL_CRYPTO_KEY` environment variable (base64-encoded)
- IV: 12-byte random per row per field (stored as prefix in column value)
- Fields encrypted: `phone_normalized`, `full_name`, `address`, `id_doc_number`
- Decryption: only in API response serializers — never in SQL queries
- Key rotation: new key + migration script that re-encrypts all rows

### 12.4 Audit Logging (Phase 3)

Every write action is recorded:

```sql
CREATE TABLE audit_log (
    id              INTEGER PRIMARY KEY,
    user_id         INTEGER,
    action          TEXT,     -- 'import', 'export', 'annotate', 'delete', 'login'
    entity_type     TEXT,     -- 'subscriber', 'batch', 'tower', 'contact'
    entity_id       INTEGER,
    details         JSON,
    ip_address      TEXT,
    recorded_at     TIMESTAMP DEFAULT NOW()
);
```

### 12.5 Transport Security

- All API communication over HTTPS in production
- `Content-Security-Policy: default-src 'self'; script-src 'self'; img-src 'self' data:`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (prod only)
- CORS: explicit origin whitelist, no wildcard in production

---

## 13. TESTING STRATEGY

### 13.1 Backend Tests (`modules/telecom_analysis/tests/`)

| Test file | Scope | Coverage target |
|-----------|-------|----------------|
| `conftest.py` | Shared fixtures: in-memory SQLite, real sample Excel data from `Mau/File data mau/` | — |
| `test_parsers/test_viettel_parser.py` | Viettel ParseResult: 14 PII fields, CDR record count, direction inference | 100% of `viettel_parser.py` |
| `test_parsers/test_vina_parser.py` | Vina ParseResult: frequency-based PII, a_subs detection, date+time merge | 100% of `vina_parser.py` |
| `test_parsers/test_mobi_parser.py` | Mobi ParseResult: STT detection, regex PII, LAC-Cell split | 100% of `mobi_parser.py` |
| `test_parsers/test_auto_detector.py` | Cascade detection: filename → content → fallback for all 3 carriers | 100% of `auto_detector.py` |
| `test_normalizers/test_phone_normalizer.py` | All normalization edge cases: 84xxx, 9-digit, service names, invalid | 100% of `phone_utils.py` |
| `test_normalizers/test_date_normalizer.py` | All 7 date formats: serial, dd/MM/yyyy, ISO, 6-digit, combined Vina | 100% of `date_normalizer.py` |
| `test_analytics/test_contact_analyzer.py` | Counts match, self-exclusion, annotation preservation | 100% of `contact_analyzer.py` |
| `test_analytics/test_cross_subscriber.py` | Shared contacts: last-9 key. Shared IMEI: first-14 key. Locations | 100% of `cross_subscriber_analyzer.py` |
| `test_services/test_import_service.py` | End-to-end: file → DB → stat tables, with real sample Excel files | All 3 carrier formats |

**Invariant:** `0%` discrepancy between Python backend results and Vanilla JS legacy results for the same input file. Verified by dual-run in Phase 2.

### 13.2 Frontend Tests (`frontend/src/`)

| Test file | Scope |
|-----------|-------|
| `utils/phoneNormalizer.test.ts` | Mirror of Python phone_utils tests — same inputs, same outputs |
| `utils/dateParser.test.ts` | All 7 date format handlers |
| `services/cdrParserService.test.ts` | Column mapping, PII extraction, direction inference |
| `services/analysisEngineService.test.ts` | Contact aggregation, IMEI grouping, time patterns |
| `services/compareEngineService.test.ts` | Cross-file shared entity detection |
| `store/filesStore.test.ts` | State transitions: pending → analyzing → analyzed → error |

### 13.3 Integration Tests

| Test | Scope |
|------|-------|
| Upload Viettel file → verify DB | API end-to-end: upload → import → analytics → export |
| Compare 3 subscribers → verify shared contacts | Cross-subscriber API correctness |
| Export 5-sheet XLSX → re-import → verify same data | Round-trip format contract |

---

## DOCUMENT INDEX (Source Documents — Read-Only Reference)

| Document | Key Contribution | Conflict Status |
|----------|-----------------|----------------|
| `BUSINESS_LOGIC_AUDIT_TELECOM.md` | Complete feature inventory, parsers, analyzers, exporters | No conflicts — adopted |
| `FEATURE_INVENTORY.md` | Feature classification, module map, platform-wide candidates | No conflicts — adopted |
| `TELECOM_MODULE_MAP.md` | Per-module: purpose, deps, complexity, priority | No conflicts — adopted |
| `D:\SonPlatform\ARCHITECTURE_AUDIT_SONPLATFORM.md` | React 19 + TS architecture, proven clean layering | Informs frontend target — adopted |
| `docs/legacy_telecom_analysis.md` | Mau/ monolith analysis, reusable functions identified | No conflicts — adopted |
| `docs/module_architecture.md` | Python module structure, layer contracts, data flow | No conflicts — adopted |
| `docs/missing_components.md` | Gap analysis — all gaps addressed in phases above | Resolved |
| `docs/migration_plan.md` | 4-step migration strategy (preserve → migrate → dual-run → cutover) | Adopted in Phase 2/3 |
| `docs/proposed_architecture.md` | "Vanilla JS (extend existing)" | **Conflict** — resolved in favor of React 19 |
| `docs/integration_plan.md` | API specs, frontend integration | API specs consolidated into Section 10 |
| `docs/frontend_roadmap.md` | React 18 + Next.js + Shadcn/UI | **Conflict** — resolved: React 19 + Vite, no Next.js, no Shadcn |
| `docs/backend_roadmap.md` | FastAPI + Pandas + SQLAlchemy phases | No conflicts — adopted |
| `docs/project_folder_structure.md` | Full React app in frontend/ | Aligned with Section 4 |

---

*Master Architecture generated by Claude Code (claude-sonnet-4-6) on 2026-05-31.*  
*No source files were modified. This document is the single authoritative architecture reference.*  
*All prior architecture documents are superseded by this document.*
