# 📦 CURRENT RESOURCES INVENTORY
**System:** Sentinel Platform  
**Audit Date:** 2026-05-28  
**Auditor:** Enterprise Architecture Review

---

## 1. ROOT PROJECT FILES

| File | Size | Purpose | Status |
|------|------|---------|--------|
| `index.html` | 17.5 KB | Sentinel Core Platform Shell — dashboard, GTP, FLA, SRAU screens | ✅ Operational |
| `app.js` | 16.3 KB | Platform JS controller — navigation, mock GTP/FLA/SRAU logic, live clock | ⚠️ Mock data only |
| `styles.css` | 17.3 KB | Complete design system — CSS variables, dark theme, all component styles | ✅ Reusable |
| `Claude.md` | 10.9 KB | Architecture context doc — design system spec, terminology mapping | 📋 Reference |
| `analyze_legacy.py` | 5.4 KB | Python script to analyze legacy project structure (helper tool) | 🛠️ Dev tool |
| `inspect_*.py` (×6) | ~1KB each | Individual Python inspection scripts for Excel templates and JS mappings | 🛠️ Dev tools |
| `check_env.py` | 637B | Environment validation script | 🛠️ Dev tool |
| `www.icam-inox.it__ref.png` | 51 KB | Design reference screenshot (premium industrial UI) | 🎨 Design ref |

---

## 2. LEGACY MODULE: `Mau/`

### 2.1 Core Files

| File | Size | Purpose | Status |
|------|------|---------|--------|
| `Mau/index.html` | 78.3 KB | Full CDR Analyzer UI — 8 tabs, all forms, tables, modals, pagination | ✅ Operational |
| `Mau/script.js` | 627.5 KB (14,239 lines) | Complete analytics engine — parsers, charts, export, compare | ✅ Operational |
| `Mau/styles.css` | 85.5 KB | Legacy CSS — complete UI style for CDR Analyzer | ✅ Operational |
| `Mau/call-icon.png` | 16.7 KB | Application favicon | 🎨 Asset |
| `Mau/HUONG_DAN_SU_DUNG.md` | 8.4 KB | Vietnamese user guide — full feature documentation | 📋 Reference |
| `Mau/Tệp.docx` | 278 KB | Word document (likely specification or report template) | 📋 Reference |

### 2.2 Excel Sample Templates: `Mau/File data mau/`

| File | Size | Provider | Notes |
|------|------|---------|-------|
| `0_0382733506.xlsx` | 10.0 KB | TBD (from filename pattern) | Small sample — likely subscriber 0382733506 |
| `1_0969619929.xlsx` | 24.3 KB | TBD (from filename pattern) | Larger sample — subscriber 0969619929 |

> **Note:** Previous system analysis referenced 21 Excel sample files. The current workspace contains only 2 files. The naming convention `{index}_{phone_number}.xlsx` suggests organized case files.

---

## 3. EXISTING DOCUMENTATION: `docs/`

| File | Size | Content |
|------|------|---------|
| `system_analysis.md` | 9.1 KB | Deep legacy system reverse-engineering; CDR schema inference; 3 provider template analysis |
| `architecture.md` | 6.6 KB | 3-tier target architecture (React + FastAPI + SQLAlchemy); data pipeline; module separation |
| `telecom_schema_design.md` | 7.4 KB | Full SQL schema: `subscribers`, `towers`, `call_records`, `imei_logs`; AES-256 encryption strategy |
| `integration_plan.md` | 7.9 KB | Frontend-backend integration spec; 4 API endpoint definitions; 4-step roadmap |
| `parser_strategy.md` | 6.0 KB | Template detection heuristics; phone normalization rules; datetime parsing; LAC/Cell extraction |
| `migration_plan.md` | 5.1 KB | Step-by-step migration plan from legacy to enterprise |
| `frontend_roadmap.md` | 5.1 KB | React frontend development roadmap |
| `backend_roadmap.md` | 5.3 KB | FastAPI backend development roadmap |
| `project_folder_structure.md` | 5.6 KB | Proposed folder structure |

---

## 4. WHAT ALREADY EXISTS (Reusable Components)

### 4.1 Design System (Root `styles.css`)
- ✅ Complete CSS variable system (colors, fonts, spacing)
- ✅ Sidebar navigation styles
- ✅ Tactical card components with hover animations
- ✅ Data table styles (`tactical-table`)
- ✅ Form elements (dropzone, select, input, buttons)
- ✅ Badge system (cyan, danger, warning)
- ✅ Radar/SVG map container
- ✅ Mini stat cards
- ✅ Console log stream styles
- ✅ Timeline slider
- ✅ Scrollbar customization
- ✅ Keyframe animations (pulse, rotateSweep, fadeIn, slideLeft)

### 4.2 Frontend Shell (Root `index.html` + `app.js`)
- ✅ Sidebar with brand, nav items, footer
- ✅ Top bar with live UTC+7 clock and status badge
- ✅ Screen container with fade-in transitions
- ✅ Panel layout (control + display columns)
- ✅ Navigation controller (single-page routing)
- ✅ GTP screen: provider selector, dropzone, timeline slider, SVG radar map
- ✅ FLA screen: bank selector, dropzone, filter, stats row, table
- ✅ SRAU screen: decoy URL config, beacon URL display, live console logs

### 4.3 Legacy Analytics Engine (`Mau/script.js`)
- ✅ `CDRAnalyzer` class (full OOP architecture)
- ✅ Multi-file management (`filesData Map`)
- ✅ Template detection system (template1/template2/template3)
- ✅ Template column mappings for all 3 providers
- ✅ Excel reading pipeline (XLSX.js integration)
- ✅ Subscriber info extraction (header block rows 0-20)
- ✅ CDR record extraction (dynamic header detection)
- ✅ Phone number normalization
- ✅ Hourly/weekly stats computation
- ✅ Location/LAC/Cell aggregation
- ✅ IMEI tracking and deduplication
- ✅ Contacts frequency analysis
- ✅ Time-range filtering (date, hour-range)
- ✅ Paginated table rendering
- ✅ Excel export (XLSX.js write)
- ✅ Cross-file comparison engine
- ✅ Folium map generation (HTML export)
- ✅ Chart.js chart initialization
- ✅ LocalStorage persistence layer
- ✅ Toast notification system
- ✅ Modal management system
- ✅ IMEI lookup integration (via imei.info cookies)

### 4.4 Existing Architecture Plans
- ✅ Relational DB schema (SQL DDL ready)
- ✅ FastAPI endpoint specifications
- ✅ Parser detection heuristics
- ✅ Normalization rules (phone, datetime, LAC/Cell)
- ✅ AES-256 encryption strategy

---

## 5. DIRECTORIES

| Directory | Content | Status |
|-----------|---------|--------|
| `frontend/` | Empty | ❌ To be built |
| `backend/` | Empty | ❌ To be built |
| `docs/` | 9 planning documents | ✅ Partially populated |
| `Mau/` | Legacy module (untouched) | ✅ Preserved |
| `Mau/File data mau/` | 2 Excel test files | ✅ Available |
