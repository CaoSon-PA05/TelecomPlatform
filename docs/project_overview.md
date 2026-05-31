# PROJECT OVERVIEW
**System:** Sentinel Core | Precision Data & Analytics Platform
**Audit Date:** 2026-05-28
**Scope:** High-level structure only — no deep file analysis performed

---

## 1. ROOT PROJECT STRUCTURE

```
TelecomPlatform/
│
├── index.html                      ← Root platform shell (SPA)
├── app.js              (~340 lines) ← Core navigation + module controller
├── styles.css          (~776 lines) ← Complete design system
├── Claude.md                       ← Project context & design specification
│
├── frontend/                       ← [EMPTY] Placeholder for future frontend layer
├── backend/                        ← [EMPTY] Placeholder for future backend layer
├── Mau/                            ← Legacy standalone CDR analyzer (fully working)
├── docs/                           ← Planning & architecture documents (14 files)
│
├── analyze_legacy.py               ← Legacy code analysis helper
├── check_env.py                    ← Environment validation script
├── inspect_all_templates.py        ← Dev inspection script
├── inspect_column_maps.py          ← Dev inspection script
├── inspect_comparative.py          ← Dev inspection script
├── inspect_one_excel.py            ← Dev inspection script
├── inspect_record_extractors.py    ← Dev inspection script
├── inspect_script_js.py            ← Dev inspection script
├── inspect_templates_js.py         ← Dev inspection script
└── www.icam-inox.it__ref=godly.png ← UI design reference image
```

---

## 2. FRONTEND STRUCTURE

### 2.1 Root Platform Shell (Active — All Mock Data)

The root-level files form a complete, standalone SPA with a dark industrial UI:

| File | Size | Role |
|------|------|------|
| `index.html` | — | Single-page layout: sidebar nav, topbar, 4 module screens |
| `app.js` | ~340 lines | Navigation controller, live clock, module init stubs |
| `styles.css` | ~776 lines | Full design system: CSS variables, components, animations |

**Screens defined in `index.html`:**

| Screen ID | Nav Label | Business Function |
|-----------|-----------|-------------------|
| `#home-screen` | Bảng Điều Khiển | Dashboard with 3 module quick-launch cards |
| `#gtp-screen` | Hệ Không Gian GTP | Geospatial Telemetry Processor (Cell-LAC tower analysis) |
| `#fla-screen` | Đối Soát Luồng FLA | Financial Ledger Analyzer (bank statement audit) |
| `#srau-screen` | Kiểm Toán Điểm Cuối | Secure Endpoint Audit Utility (IP tracking beacon) |

> **Warning:** All screen data is currently hardcoded mock data inside `app.js`. No real API calls exist.

**Design System tokens (from `styles.css`):**
- Background: `#090c10` (near-black matte)
- Card surface: `rgba(18,22,30,0.75)` (frosted glass dark)
- Accent cyan: `#00f0ff` (radar/night-vision green-cyan)
- Alert red: `#ff3b30`
- Fonts: `Roboto Mono` (headers/data), `Inter` (body), `Outfit` (brand)

### 2.2 Frontend Directory

```
frontend/    ← EXISTS but completely EMPTY
```

Reserved for the modular frontend integration layer (not yet started).

---

## 3. BACKEND STRUCTURE

```
backend/     ← EXISTS but completely EMPTY
```

No backend exists. No server, no API, no database, no processing engine. The platform is entirely client-side at this stage. The target stack per planning docs is **Python FastAPI**.

---

## 4. LEGACY TELECOM MODULE — `Mau/`

The `Mau/` folder is a **fully operational, production-grade CDR analyzer** — a standalone web application entirely separate from the Sentinel shell.

```
Mau/
├── index.html                      ← Full CDR Analyzer UI (8 tabs)
├── script.js          (~13,645 lines) ← Complete CDRAnalyzer class engine
├── styles.css          (~776 lines)  ← Standalone legacy stylesheet
├── call-icon.png                   ← App favicon
├── HUONG_DAN_SU_DUNG.md           ← Vietnamese user guide
├── Tệp.docx                        ← Word document (spec or report)
└── File data mau/
    ├── 0_0382733506.xlsx           ← Sample CDR Excel file
    └── 1_0969619929.xlsx           ← Sample CDR Excel file
```

**Capabilities of the legacy CDR module:**
- Drag-and-drop multi-file Excel upload (`.xlsx`, `.xls`)
- Auto-detection of Vietnamese telecom providers: Viettel, Vinaphone, Mobifone
- 8 analysis tabs: Subscriber Info, Call History, Contacts, IMEI Tracking, Location, Reports, Maps, Cross-file Compare
- Chart.js charts (hourly/weekly stats)
- Cross-file comparison engine
- Excel/ZIP export
- Browser LocalStorage persistence across sessions

**Dependencies (CDN-loaded, no npm):**
- `chart.js` — charting
- `xlsx.full.min.js` — Excel parsing
- `jszip.min.js` — ZIP export
- `font-awesome` — icons

> The `Mau/` folder is preserved and untouched. All new development is separate from it.

---

## 5. REUSABLE UI RESOURCES

The following assets are directly reusable from the root design system when building new screens or integrating the legacy module:

| Resource | Location | Notes |
|----------|----------|-------|
| CSS variable palette | `styles.css :root` | All colors, spacing, typography tokens |
| Sidebar navigation component | `index.html` + `app.js` | `initNavigation()` — data-screen switching |
| Live UTC+7 clock | `app.js` | `updateLiveClock()` — reusable telemetry widget |
| Screen/panel layout shell | `index.html` | `.screen`, `.sidebar`, `.main-content` structure |
| Card/tile component | `styles.css` | `.card`, `.metric-card` classes |
| Design reference image | `www.icam-inox.it__ref=godly.png` | Stainless steel industrial UI reference |

---

## 6. DOCUMENTATION — `docs/`

14 planning documents currently in `docs/`:

| File | Purpose |
|------|---------|
| `project_overview.md` | This file — structure audit |
| `architecture.md` | 3-tier target architecture spec |
| `system_analysis.md` | Legacy module reverse-engineering analysis |
| `proposed_architecture.md` | Alternative architecture proposals |
| `telecom_schema_design.md` | SQL schema with DDL statements |
| `telecom_schema_analysis.md` | Telecom data schema analysis |
| `integration_plan.md` | Frontend-backend integration plan |
| `parser_strategy.md` | Excel parser provider-detection rules |
| `migration_plan.md` | Migration roadmap from legacy to new |
| `frontend_roadmap.md` | Frontend development roadmap |
| `backend_roadmap.md` | Backend development roadmap |
| `project_folder_structure.md` | Proposed folder structure |
| `missing_components.md` | Gap analysis — what is not yet built |
| `current_resources.md` | Inventory of current assets |

---

## 7. ARCHITECTURE OVERVIEW

### Current State

```
TelecomPlatform/
│
├── ROOT SHELL (index.html + app.js + styles.css)
│     ├── Dashboard (Home)       → mock data
│     ├── GTP screen             → mock data
│     ├── FLA screen             → mock data
│     └── SRAU screen            → mock data
│
├── Mau/ (LEGACY)
│     └── CDR Analyzer           → FULLY WORKING, standalone, disconnected
│
├── frontend/                    → EMPTY
└── backend/                     → EMPTY
```

### Target State (per planning docs)

```
┌─────────────────────────────────┬──────────────────────────────┐
│         FRONTEND                │         BACKEND              │
│                                 │                              │
│  Sentinel Shell (index.html)    │  Python FastAPI              │
│  + CDR Module (new screen)      │  ├── Parser Service          │
│  + GTP / FLA / SRAU screens     │  ├── Normalizer Service      │
│                                 │  ├── Analytics Engine        │
│  Vanilla JS (no framework)      │  └── Export Service          │
│  Chart.js                       │           │                  │
│  Leaflet Maps                   │     SQLite / PostgreSQL       │
│                                 │     (subscribers, CDR,        │
│         ← REST API calls →      │      towers, IMEI logs)      │
└─────────────────────────────────┴──────────────────────────────┘
```

---

## 8. STATUS SUMMARY

| Component | Status | Notes |
|-----------|--------|-------|
| Root Sentinel shell | ✅ Complete | Dark UI, 4 screens, mock data only |
| Legacy CDR analyzer (`Mau/`) | ✅ Fully working | Standalone, not integrated into shell |
| `frontend/` directory | ❌ Empty | Placeholder only |
| `backend/` directory | ❌ Empty | No backend exists |
| Database | ❌ None | Only browser LocalStorage in legacy |
| Design system (CSS) | ✅ Complete | Variables and components ready to reuse |
| Architecture planning | ✅ Extensive | 14 docs written, no implementation yet |
| Sample Excel data | ✅ Present | 2 files in `Mau/File data mau/` |
| Authentication | ❌ None | No login or encryption implemented |
| Excel inspection scripts | ✅ Present | 9 Python scripts at root for dev analysis |

---

## 9. IMMEDIATE NEXT STEPS (Awaiting Approval)

1. Scaffold `frontend/` and `backend/` directory structures
2. Set up Python FastAPI skeleton in `backend/`
3. Port CDR parser logic from `Mau/script.js` to Python service
4. Add CDR module as a new screen in the Sentinel shell
5. Confirm database choice (SQLite for dev, PostgreSQL for prod)
