# LEGACY TELECOM MODULE ANALYSIS
**Module:** `Mau/`
**Audit Date:** 2026-05-28
**Scope:** Deep analysis of business logic, analytics, parsing, UI, and reusable components

---

## 1. TELECOM BUSINESS WORKFLOWS

The `Mau/` module implements a **CDR (Call Detail Record) forensic analysis** pipeline for Vietnamese mobile subscribers. There are six core business workflows:

---

### Workflow 1: File Import & Provider Detection

```
User drops .xlsx file
    → Extract phone number from filename  (detectPhoneNumberFromFileName)
    → Match prefix to carrier             (detectNetworkProvider)
    → Select template                     (template1=Viettel, template2=Vina, template3=Mobi)
    → If auto: use content-based detection (detectTemplate → hasTemplate1/2/3Structure)
    → Read Excel into 2D array            (readExcelFile via SheetJS)
    → Queue for batch analysis
```

**Carrier prefix tables hardcoded in `script.js:1588-1598`:**

| Carrier | Prefixes |
|---------|---------|
| Viettel | `032–039`, `086`, `096–098` |
| Vinaphone | `081–085`, `088`, `091`, `094` |
| Mobifone | `070`, `076–079`, `089`, `090`, `093` |

---

### Workflow 2: Subscriber Identity Extraction

Extracts subscriber PII from the header section of the CDR Excel file:

| Field | Template 1 (Viettel) | Template 2 (Vina) | Template 3 (Mobi) |
|-------|---------------------|-------------------|-------------------|
| Phone | Cell C8 | Frequency analysis of `a_subs` column | Regex scan in first 50 rows |
| Name | Cell C7 | Not available | Text match `tên thuê bao:` |
| ID number | Cell C13 | Not available | Text match `số cmnd:` |
| Address | Cell C10 | Not available | Text match `địa chỉ:` |
| Activation date | Cell C16 | Derived from date range | Text match `ngày kích hoạt:` |
| Birth date | Cell C9 | Not available | Text match `năm sinh:` |

---

### Workflow 3: Call Record Extraction & Normalization

```
Raw Excel rows (from header row onward)
    → findHeaderRow()    — score-based detection of which row is the column header
    → buildColumnMap()   — fuzzy-match column names to known fields
    → validateColumns()  — report missing required columns
    → Per-row extraction:
        - sourceNumber + targetNumber → determine ownerPhone vs contactNumber
        - direction: 'outgoing' if sourceNumber = ownerPhone, else 'incoming'
        - callType → normalize to: Cuộc gọi đi / Cuộc gọi đến / Tin nhắn đi / Tin nhắn đến
        - timestamp → parseDateFromTimestamp (handles multiple formats)
        - duration → numeric seconds
        - imei, imsi, lac, cell, provinceCode, location
```

**CDR record fields produced:**
```
sourceNumber, targetNumber, contactNumber, ownerPhone,
direction, callType, callTypeReadable,
timestamp, duration,
imei, imsi,
lac, cell, provinceCode, location, stationName, googleMapsLink
```

---

### Workflow 4: Multi-Dimension Analysis

After extraction, five analysis engines run in sequence (via `analyzeData()`):

| Engine | Method | Output |
|--------|--------|--------|
| IMEI analysis | `analyzeIMEI()` | Unique IMEI Set |
| Contact frequency | `analyzeContacts()` | Map: phoneNumber → count + interaction history |
| Time patterns | `analyzeTimePatterns()` | hourlyStats[24], weeklyStats[7] |
| Location clustering | `analyzeLocations()` | Map: LAC-CID → frequency + time data |
| Device/SIM changes | `analyzeChanges()` | IMEI timeline, IMSI timeline (sorted by first use) |

All results are stored in instance state and persisted to LocalStorage.

---

### Workflow 5: Cross-File Comparison (Surveillance Network Analysis)

Requires at minimum 2 analyzed files. Three modes:

| Mode | Method | Logic |
|------|--------|-------|
| Shared contacts | `analyzeSharedContacts()` | Finds contact numbers appearing in 2+ subscriber files — reveals shared associates |
| Shared IMEI | `analyzeSharedIMEI()` | Finds device IMEI numbers used by 2+ subscribers — reveals device sharing |
| Shared locations | `analyzeSharedLocations()` | Finds LAC-CID pairs in 2+ subscribers — reveals co-location |
| Multi-file custom | `performTwoFilesComparison()` | Selective comparison by contact/IMEI/location for chosen subscriber set |

**Phone normalization for comparison uses last 9 digits** (`getLast9Digits()`) to handle `0xx` vs `84xx` prefix variants.

---

### Workflow 6: Export & Persistence

**Export formats:**
- Per-tab: `exportIMEI()`, `exportContacts()`, `exportCallHistory()`, `exportLocation()` → individual `.xlsx`
- Full export: `exportAllData()` → multi-sheet workbook with sheets: `TTTB`, `LIST`, `Contact`, `IMEI`, `Location`
- Compare results: `exportCurrentResults()` → `.xlsx`

**Export file naming convention:** `{ownerPhone}_{type}.xlsx` (e.g. `0982733506_IMEI_analysis.xlsx`)

**LocalStorage persistence keys:**
```
cdr_subscriber_info_{fileName}    — per-file subscriber info (editable)
imei_model_{imei}                 — device model after lookup
imei_note_{imei}                  — investigator note
location_{lac}_{cell}             — Google Maps link per tower
cdr_contact_{phone}               — Zalo/Facebook/Telegram notes per contact
imei_cookies                      — cookies string for imei.info lookup
folium_map_url                    — last generated map URL
```

---

## 2. ANALYTICS LOGIC

### 2.1 Contact Frequency Analysis (`analyzeContacts`)

- Iterates all call records, excluding the subscriber's own number
- Builds `contacts` Map: `phoneNumber → {count, types: Set}`
- Builds `contactsWithTimeData` Map: `phoneNumber → {interactions: [{timestamp, type, duration}]}`
- The time-indexed structure enables date/time range filtering without re-parsing
- Sorted by frequency (descending) for display

### 2.2 Time Pattern Analysis (`analyzeTimePatterns`)

- Produces two histograms:
  - `hourlyStats[0..23]` — call/SMS count per hour of day (24-bar chart)
  - `weeklyStats[0..6]` — call/SMS count per day of week (7-bar chart)
- Uses `parseDateFromTimestamp()` which handles multiple date formats across templates

### 2.3 Location Clustering (`analyzeLocations`)

- Groups all records by composite key `${LAC}-${CID}`
- Output: frequency (how often that tower appeared), province code, BTS station name
- `locationsWithTimeData` enables time-range filtering showing which towers were active when
- Google Maps links are manually added by the investigator and persisted to LocalStorage

### 2.4 IMEI/IMSI Change Tracking (`analyzeChanges`)

- For each unique IMEI/IMSI: records the **first timestamp** seen
- Sorts by first-seen timestamp → produces a chronological device/SIM swap timeline
- A new IMEI appearing = device was changed; a new IMSI = SIM card was swapped

### 2.5 Cross-file Shared Entity Detection

**Shared contacts algorithm (`performSharedContactsComparison`):**
```
For each analyzed file:
    normalize owner phone
    for each contact: get last-9-digits
    map: last9 → Set of owner phones that share this contact

Result: contacts appearing in ≥2 owner files
    + frequency per owner
    + provider detection per number
```

**Shared IMEI and location algorithms** follow the same intersection pattern.

---

## 3. PARSING LOGIC

### 3.1 Template Architecture

Three templates map to the three Vietnamese mobile carriers:

```
template1 → VIETTEL
    Subscriber info: fixed cells (C5, C7, C8, C9, C10, C13, C14, C16)
    Data start:      row 22 (index 21), but dynamic header detection as fallback
    Call columns:    B=source, C=target, D=timestamp, E=duration, F=IMSI, G=IMEI,
                     H=province, I=callType, J=serviceType, K=location, L=LAC, M=cell

template2 → VINAPHONE
    Subscriber info: no header section — derived from data (most frequent a_subs)
    Detection:       looks for columns named a_subs / b_subs
    Call columns:    A=source, G=target, D=date, E=time, F=duration, B=IMSI, C=IMEI,
                     I=province, H=callType, J=serviceType, P=location, N=LAC, O=cell

template3 → MOBIFONE
    Subscriber info: free-text rows before the STT column header
    Detection:       looks for cell matching "STT" or "Số thứ tự" pattern
    Call columns:    D=source, E=target, B=timestamp, F=duration, I=IMEI,
                     H=location, G=LAC+cell (combined)
```

### 3.2 Auto-Detection Pipeline

```
1. detectTemplateFromFileName(fileName)
       extract phone number via regex
       map prefix → carrier → template
       fallback to template1 if unknown

2. detectTemplate(data) — content-based fallback
       hasTemplate1Structure: checks for subscriber data at C7/C8 area
       hasTemplate2Structure: scans first 10 rows for a_subs + b_subs columns
       hasTemplate3Structure: scans first 10 rows for STT column header

3. detectTemplateByPattern(data, columnMap)
       final refinement after column map is built
```

### 3.3 Fuzzy Column Matching (`buildColumnMap`)

The most sophisticated piece of parsing. Rather than requiring exact column names, it scores column headers using:

- **Exact match** (score: 100)
- **Keyword contains** (score: 80)
- **Word boundary match** (score: 60)
- **Levenshtein string similarity** (`stringSimilarity`) — threshold 0.6

Column patterns cover Vietnamese and English aliases:

```javascript
sourceNumber: ['số đi', 'số a', 'a_subs', 'msisdn a', 'calling', 'source']
targetNumber: ['số đến', 'số b', 'b_subs', 'called', 'destination']
timestamp:    ['thời gian', 'ngày giờ', 'start time', 'datetime']
duration:     ['thời lượng', 'giây', 'seconds', 'duration']
imei:         ['imei']
imsi:         ['imsi']
lac:          ['lac', 'location area']
cell:         ['cell', 'cid', 'cell id']
```

### 3.4 Date Parsing

Multiple date formats handled by `parseDateFromTimestamp()` and `convertToStandardDateFormat()`:
- `DD/MM/YYYY HH:mm:ss`
- `YYYY-MM-DD HH:mm:ss`
- `DD-MM-YYYY`
- Excel serial date numbers (numeric → JS Date)
- Mixed separators

### 3.5 Phone Number Normalization

`formatPhoneNumber()` normalizes all of:
- `84xxxxxxxxx` → `0xxxxxxxxx` (strip country code)
- 9-digit numbers → prepend `0`
- Removes spaces, dashes, parentheses

---

## 4. FRONTEND STRUCTURE

### 4.1 Component Architecture

The entire frontend is a **single monolithic class** (`CDRAnalyzer`) in `script.js`. There is no framework — plain Vanilla JS with direct DOM manipulation.

```
CDRAnalyzer (class)
│
├── constructor()
│   ├── Instance state (data, pagination, maps, compare, filesData)
│   ├── templateMappings (hardcoded column layouts per carrier)
│   ├── initializeEventListeners()
│   ├── initializeCharts()
│   ├── initializeModals()
│   └── initializeToast()
│
├── File management methods
│   ├── processMultipleFiles() — batch import + validation
│   ├── analyzeAllFiles()      — sequential per-file analysis
│   ├── renderFilesList()      — file list UI with template selectors
│   ├── renderFileSelection()  — analyzed file picker UI
│   └── loadFileData()         — switch active file view
│
├── Core analysis pipeline (per-file)
│   ├── analyzeData()
│   ├── extractSubscriberInfo() / parseTemplate2/3SubscriberInfo()
│   ├── extractCallRecords()
│   ├── analyzeIMEI / Contacts / TimePatterns / Locations / Changes
│   └── rebuildTimeBasedData()
│
├── UI update methods (per-tab)
│   ├── updateSubscriberInfo()
│   ├── updateCallHistoryTable() / updateCallHistoryTableWithData()
│   ├── updateContactsTable() / updateContactsStats()
│   ├── updateIMEITable() / updateIMEIStats()
│   ├── updateLocationTable() / updateLocationStats()
│   ├── updateChangesLog()
│   └── updateCharts()
│
├── Filter & pagination methods (per-tab, independent)
│   ├── filterCallHistory() / resetCallHistory()
│   ├── filterContacts() / resetContactsFilters()
│   ├── filterLocation() / resetLocationFilters()
│   ├── filterIMEI()
│   ├── firstPage/previousPage/nextPage/lastPage/goToPage
│   └── (same set for contacts, location, compare)
│
├── Cross-file comparison methods (prototype extensions)
│   ├── analyzeSharedContacts/IMEI/Locations()
│   ├── performSharedContactsComparison()
│   ├── performSharedIMEIComparison()
│   ├── performSharedLocationsComparison()
│   └── performTwoFilesComparison() / performMultipleFilesComparisonAnalysis()
│
├── Map generation
│   ├── drawFoliumMap()          — reads Excel files with lat/lon
│   └── generateFoliumMapHTML()  — produces standalone Leaflet HTML string
│
├── Export methods
│   ├── exportToExcel(data, filename, sheetName)  — SheetJS wrapper
│   ├── exportAllData()           — multi-sheet workbook
│   ├── exportCallHistory/Contacts/IMEI/Location/CompareResults()
│   └── exportAllFiles()          — batch export all analyzed files as ZIP
│
├── LocalStorage methods
│   ├── saveSubscriberToStorage / loadSubscriberFromStorage
│   ├── loadLocationDataFromStorage / syncLocationData
│   ├── loadIMEIDataFromStorage
│   └── getContactDataFromStorage
│
└── UI utility methods
    ├── showToast(message, type, duration)
    ├── showModal / hideModal / hideAllModals
    ├── showDeleteConfirmModal
    └── formatPhoneNumber / normalizePhoneNumber / getLast9Digits
```

### 4.2 Tab Structure

| Tab ID | Label | Content |
|--------|-------|---------|
| `subscriber` | Thông tin thuê bao | Subscriber PII card, editable fields |
| `call-history` | Lịch sử cuộc gọi | Paginated table, multi-filter (type/date/time/text) |
| `contacts` | Số liên lạc | Paginated table, frequency stats, social media notes |
| `imei` | IMEI | IMEI table, validity stats, model lookup |
| `location` | Vị trí | LAC/CID table, Google Maps links, time filter |
| `time-analysis` | Báo cáo | Chart.js hourly/weekly charts, message classification |
| `maps` | Bản đồ | Import Excel with coordinates → generate Leaflet HTML |
| `compare` | So sánh | Cross-file comparison with 4 analysis modes |

### 4.3 Modals

| Modal ID | Purpose |
|----------|---------|
| `cookiesModal` | Input IMEI lookup cookies from imei.info |
| `fileManagerModal` | Floating file manager (duplicate of main upload section) |
| `editGoogleMapsModal` | Manually assign Google Maps link to a LAC/CID |
| `compareFilesModal` | Checkbox selection of subscriber files for comparison |
| `deleteConfirmModal` | Custom delete confirmation (replaces browser `confirm()`) |

### 4.4 External Dependencies (CDN)

| Library | Version | Usage |
|---------|---------|-------|
| `chart.js` | latest | Hourly/weekly activity bar charts |
| `xlsx.full.min.js` | 0.18.5 | Excel file reading and writing |
| `jszip.min.js` | 3.10.1 | ZIP export of multiple files |
| `font-awesome` | 6.0.0 | Icon set |
| `Inter` (Google Fonts) | — | Body typography |
| `Leaflet` | 1.9.3 | Map rendering (injected into generated HTML only) |
| `leaflet.markercluster` | 1.4.1 | Marker clustering on generated maps |

---

## 5. REUSABLE MODULES

These are the cleanest, most self-contained pieces that can be ported to the Sentinel platform:

### 5.1 Network Provider Detector
**Location:** `script.js:1584–1620`

```javascript
detectNetworkProvider(phoneNumber)  → 'viettel' | 'vina' | 'mobi' | null
getNetworkProviderName(phoneNumber) → 'VIETTEL' | 'VINA' | 'MOBI' | null
```
Pure function. No dependencies. Hardcoded prefix tables. Easily ported to Python.

---

### 5.2 Phone Number Normalizer
**Location:** `script.js` — `formatPhoneNumber()`, `normalizePhoneNumber()`, `getLast9Digits()`

Handles: `84xxx` → `0xxx`, 9-digit padding, special character stripping.
Pure functions. Direct port to Python `re` module is straightforward.

---

### 5.3 Fuzzy Column Mapper
**Location:** `script.js:2442–2548` (`buildColumnMap`)

Given a header row array, returns a `columnMap` object mapping logical field names to column indices. Uses Levenshtein distance + keyword scoring. This is the most valuable parsing component — it makes the system resilient to column name variations across CDR file versions.

**Port value:** High. Should become a Python service function that takes `header_row: list[str]` and returns `{field_name: column_index}`.

---

### 5.4 Template Auto-Detector
**Location:** `script.js:2074–2640`

```
detectTemplate(data)          — master detection
hasTemplate1/2/3Structure()   — carrier-specific structure checks
detectTemplateByPattern()     — column-content-based refinement
findHeaderRow()               — score-based header row locator
```
Self-contained. The Python port would take a 2D list (from `openpyxl`) and return `('viettel'|'vina'|'mobi', header_row_index, column_map)`.

---

### 5.5 Date/Timestamp Parser
**Location:** `parseDateFromTimestamp()`, `convertToStandardDateFormat()`

Handles all Vietnamese CDR date formats. Essential for the Python backend parser.

---

### 5.6 Cross-File Intersection Engine
**Location:** `script.js:11695–11823` (prototype methods)

Three algorithms for finding shared entities across subscriber files:
- `performSharedContactsComparison()` — shared contact numbers
- `performSharedIMEIComparison()` — shared devices
- `performSharedLocationsComparison()` — shared cell towers

**Port value:** High. These are the core "network of suspects" analysis functions. Python backend with a DB query could make this significantly faster for large datasets.

---

### 5.7 Folium Map HTML Generator
**Location:** `script.js:10549` (`generateFoliumMapHTML`)

Produces a **complete standalone HTML file** with Leaflet map, marker clustering, colored markers by phone number, popups with call metadata, and a legend. Center defaults to Vietnam (`14.0583, 108.2772`).

Input: array of `{phone, lat, lon, mnc, datetime, lac, cid}` records.
Output: full HTML string — download or open in new tab.

**Port value:** Medium. Currently only used for the Maps tab with a separate Excel import (not the main CDR data). Should be wired into the main location analysis pipeline.

---

### 5.8 Toast Notification System
**Location:** `script.js:190–240`

```javascript
showToast(message, type='info', duration=4000)
// types: 'info', 'success', 'error', 'warning'
```
Self-contained, no dependencies. Directly reusable in the Sentinel root shell.

---

### 5.9 Multi-Sheet Excel Exporter
**Location:** `script.js:9336–9340`

```javascript
exportToExcel(data, filename, sheetName)
// data: array of plain objects (JSON)
// uses SheetJS XLSX.utils.json_to_sheet
```
3-line wrapper. The export schema (TTTB / LIST / Contact / IMEI / Location sheets) should be preserved as the standard output format.

---

### 5.10 Pagination Engine
**Location:** Multiple instances per tab

Four independent pagination instances (call-history, contacts, location, compare), each with the same pattern:
```javascript
currentPage, pageSize, totalPages, filteredRecords
firstPage / previousPage / nextPage / lastPage / goToPage
```
Could be extracted into a single reusable `PaginationController` class.

---

## 6. KEY FINDINGS & MIGRATION NOTES

| Finding | Impact |
|---------|--------|
| All 3 carrier templates, all parsing logic, all analytics are in one 13,645-line JS file | High — must be decomposed for maintainability |
| Template detection works well but relies on heuristics that may break with new CDR format versions | Medium — needs unit tests with known-good files |
| Fuzzy column matching with Levenshtein is robust but slow for large files | Low (client-side is fine for current file sizes) |
| Cross-file comparison uses last-9-digits normalization — works for VN numbers, may fail for international | Low for current use case |
| LocalStorage is the only persistence — data is lost on browser clear, not shareable across devices | High — backend DB is critical |
| IMEI lookup is a placeholder (`lookupIMEI` shows a toast, no API call) | Medium — Python script integration referenced in UI |
| Map generation is disconnected from main CDR data — requires a separate Excel import with lat/lon | Medium — CDR data has LAC/CID only; coordinate lookup DB needed |
| No authentication, no server, all data local | Critical if moving to multi-user deployment |

---

## 7. FILE INVENTORY

| File | Size | Role |
|------|------|------|
| `index.html` | ~1,255 lines | Complete SPA shell — 8 tabs, 5 modals, all form controls |
| `script.js` | ~13,645 lines | Single `CDRAnalyzer` class + prototype extensions |
| `styles.css` | ~776 lines | Standalone stylesheet — light theme, separate from Sentinel dark theme |
| `call-icon.png` | 16.7 KB | Browser tab favicon |
| `HUONG_DAN_SU_DUNG.md` | ~246 lines | Vietnamese user manual |
| `Tệp.docx` | 278 KB | Word document (spec or case report — not analyzed) |
| `File data mau/0_0382733506.xlsx` | 10 KB | Sample CDR file — Mobifone number (prefix 038) |
| `File data mau/1_0969619929.xlsx` | 24.3 KB | Sample CDR file — Viettel number (prefix 096) |
