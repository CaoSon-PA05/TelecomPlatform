# TELECOM MODULE MAP — TelecomPlatform (Sentinel CDR Analytics)
**Generated:** 2026-05-31  
**Source:** BUSINESS_LOGIC_AUDIT_TELECOM.md + FEATURE_INVENTORY.md  
**Generator:** Claude Code (claude-sonnet-4-6)  
**Status:** Read-only — no source files modified

---

## LEGEND

| Symbol | Meaning |
|--------|---------|
| **Complexity: Low** | < 200 LOC, pure functions, no external state |
| **Complexity: Medium** | 200–500 LOC, some integrations or I/O |
| **Complexity: High** | 500–1000 LOC, multiple dependencies, stateful |
| **Complexity: Very High** | > 1000 LOC or complex cross-cutting concerns |
| **P1** | Migrate first — blocks all downstream modules |
| **P2** | Migrate second — high value, depends on P1 |
| **P3** | Migrate third — completes core feature set |
| **P4** | Migrate when core is stable — significant enhancement |
| **P5** | Migrate last — optional / future capability |
| `[IMPL]` | Implemented and working |
| `[STUB]` | Defined but not implemented |
| `[PARTIAL]` | Started, incomplete |
| `[UNTRACKED]` | Exists in working tree, not yet committed |

---

## SECTION 1 — PARSER MODULES

---

### PM-01 · `base_parser.py`
**Path:** `modules/telecom_analysis/parsers/base_parser.py`  
**Status:** `[IMPL]`

**Purpose:**  
Abstract base class that defines the contract all CDR parsers must fulfill. Establishes the parse pipeline interface: receive raw Excel data as `list[list]`, return a structured `ParseResult` containing subscriber PII, normalized CDR records, and a quality report. Enforces consistency across Viettel, Vina, and Mobi implementations.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `modules/telecom_analysis/schemas/` | Internal | `ParseResult` return type definition |
| Python `abc` | stdlib | Abstract method enforcement |

**Estimated Complexity:** Low  
`~80–120 LOC`. Pure abstract class with no business logic. Defines method signatures only.

**Migration Priority:** **P1**  
Must exist before any concrete parser can be built or tested. Foundation of the entire parsing subsystem.

---

### PM-02 · `column_mapper.py`
**Path:** `modules/telecom_analysis/parsers/column_mapper.py`  
**Status:** `[IMPL]`

**Purpose:**  
Scores and maps raw Excel column headers to canonical field names (`source_number`, `target_number`, `timestamp`, `imei`, `lac`, `cell_id`, etc.) using fuzzy string matching. Implements a two-pass strategy: (1) exact keyword match against a vocabulary table, (2) Levenshtein-distance similarity for misspelled or abbreviated headers. Returns a `ColumnMap` dict used by all three carrier parsers. Falls back to positional (fixed-index) mappings when fuzzy score falls below threshold.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `utils/constants.py` | Internal | Column keyword vocabulary, match threshold |
| `utils/phone_utils.py` | Internal | Keyword normalization (lowercase, strip diacritics) |
| Python `difflib` or Levenshtein impl | stdlib / internal | Fuzzy score computation |

**Estimated Complexity:** Medium  
`~250–350 LOC`. Core logic is the scoring loop and fallback chain. No I/O but vocabulary maintenance cost is ongoing.

**Migration Priority:** **P1**  
Consumed by all three carrier parsers. A bug here silently mis-maps columns across all files.

---

### PM-03 · `auto_detector.py`
**Path:** `modules/telecom_analysis/parsers/auto_detector.py`  
**Status:** `[IMPL]`

**Purpose:**  
Entry point for parser selection. Runs a three-level cascade:
1. **Fast path** — extract phone number from filename via regex `0[3-9]\d{8}`, detect carrier from prefix, return corresponding parser.
2. **Content fallback** — inspect sheet structure for carrier-specific markers (Viettel fixed PII cells, Vina `a_subs` header pattern, Mobi STT row).
3. **Last resort** — default to `ViettelParser` (most common format in production).

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `parsers/viettel_parser.py` | Internal | Returned when Viettel detected |
| `parsers/vina_parser.py` | Internal | Returned when Vina detected |
| `parsers/mobi_parser.py` | Internal | Returned when Mobi detected |
| `utils/phone_utils.py` | Internal | `normalize_phone()`, `detect_carrier()` |
| Python `re` | stdlib | Filename phone extraction |

**Estimated Complexity:** Low  
`~100–150 LOC`. Pure routing logic. Complexity is in the fallback heuristics, not in volume.

**Migration Priority:** **P1**  
Called first in every import pipeline. Incorrect detection cascades silently through the entire parse chain.

---

### PM-04 · `viettel_parser.py`
**Path:** `modules/telecom_analysis/parsers/viettel_parser.py`  
**Status:** `[IMPL]`

**Purpose:**  
Parses CDR files exported by Viettel (Vietnam's largest carrier). Implements a two-phase extraction:

**Phase 1 — Subscriber PII (fixed cell addresses, Sheet2):**

| Field | Cell (row, col) |
|-------|----------------|
| document_ref | (2, 2) |
| phone | (3, 2) — without leading `0` |
| report_from | (4, 2) |
| report_to | (4, 4) |
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

**Phase 2 — CDR records (row 22 onward):**  
Uses `ColumnMap` from PM-02 for flexible field assignment. Falls back to fixed column positions if header detection fails.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `parsers/base_parser.py` | Internal | Inherits `BaseParser` |
| `parsers/column_mapper.py` | Internal | `build_column_map()` |
| `normalizers/phone_normalizer.py` | Internal | Normalize source/target numbers, infer direction |
| `normalizers/date_normalizer.py` | Internal | Parse timestamps (Excel serial, dd/MM/yyyy, etc.) |
| `normalizers/province_normalizer.py` | Internal | Normalize province codes |
| `utils/constants.py` | Internal | Fallback column positions |

**Estimated Complexity:** High  
`~500–700 LOC`. Two-phase extraction, 14 PII cells, per-row CDR extraction with normalization, quality tracking, and column-map fallback chain.

**Migration Priority:** **P1**  
Most production files are Viettel format. All testing runs on Viettel data first.

---

### PM-05 · `vina_parser.py`
**Path:** `modules/telecom_analysis/parsers/vina_parser.py`  
**Status:** `[STUB]` — file exists (compiled `.pyc` present), minimal or placeholder implementation

**Purpose:**  
Parses CDR files exported by Vinaphone. Key structural differences from Viettel:
- Column headers use `a_subs` / `b_subs` naming (source/target identifier pattern)
- Date and time are in separate columns — must be combined via `parseTemplate2DateTime()`
- Subscriber PII uses frequency analysis (most common number in source column = owner) rather than fixed cells
- Data starts at row 1 (no header block)

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `parsers/base_parser.py` | Internal | Inherits `BaseParser` |
| `parsers/column_mapper.py` | Internal | `a_subs`/`b_subs` column detection |
| `normalizers/phone_normalizer.py` | Internal | Same normalization pipeline |
| `normalizers/date_normalizer.py` | Internal | Must handle separate date + time columns |
| `utils/constants.py` | Internal | Vina prefix table |

**Estimated Complexity:** High  
`~400–600 LOC`. Date+time combination logic, frequency-based PII extraction, and `a_subs` header pattern are the main complexities.

**Migration Priority:** **P2**  
Blocking Vina CDR files. `auto_detector` already routes to this; null implementation causes silent failures for Vina files.

---

### PM-06 · `mobi_parser.py`
**Path:** `modules/telecom_analysis/parsers/mobi_parser.py`  
**Status:** `[STUB]` — file exists, minimal implementation

**Purpose:**  
Parses CDR files exported by Mobifone. Key structural differences:
- Uses an STT (Số Thứ Tự / sequence number) row as the header marker — no traditional column header row
- Subscriber PII is in free-text cells above the STT row, parsed via regex patterns:
  - `"Số điện thoại: xxx"` → phone
  - `"Tên thuê bao: xxx"` → name
  - `"Số CMND: xxx"` → ID number
- LAC and Cell ID are combined in a single column (format: `"452-01-LAC-Cell"`) — must be split by parser
- ALWAYS uses fixed column positions (never falls back to `ColumnMap` — STT format is inconsistent)

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `parsers/base_parser.py` | Internal | Inherits `BaseParser` |
| `normalizers/phone_normalizer.py` | Internal | Same normalization pipeline |
| `normalizers/date_normalizer.py` | Internal | Timestamp parsing |
| `normalizers/province_normalizer.py` | Internal | Province code handling |
| Python `re` | stdlib | Regex PII extraction from free-text rows |
| `utils/constants.py` | Internal | Mobi prefix table, fixed column map |

**Estimated Complexity:** High  
`~450–600 LOC`. STT row detection, regex PII extraction, LAC-Cell split, and no-ColumnMap constraint make this the most structurally unusual parser.

**Migration Priority:** **P2**  
Same urgency as PM-05. Must be implemented to support all three Vietnamese carriers.

---

### PM-07 · `cell-lac-parser.js`
**Path:** `cell-lac-parser.js` (root)  
**Status:** `[UNTRACKED]` — exists in working tree

**Purpose:**  
Client-side JavaScript parser for GTP (Geospatial Telemetry Processor) module. Reads Excel files containing cell-tower location data columns: `MCC`, `MNC`, `LAC`, `Cell-ID`, `Thoi gian` (timestamp), `Cuong do tin hieu` (signal strength dBm). Outputs a structured movement log for the GTP export engine and Leaflet map renderer. Handles LAC/CID combined-column format (Mobifone style) as a special case.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `window.XLSX` (SheetJS) | CDN | Excel reading |
| `app.js` | Internal | `initGtpModule()` wires this parser to the GTP UI |

**Estimated Complexity:** Medium  
`~300–450 LOC`. Input format is simpler than CDR (no PII block, no carrier variants), but signal strength classification and LAC-Cell splitting add logic.

**Migration Priority:** **P3**  
GTP module is feature-complete at export level; this parser feeds it. Lower priority than CDR parsers because GTP is a secondary module.

---

### PM-08 · `bank-parser.js`
**Path:** `bank-parser.js` (root)  
**Status:** `[UNTRACKED]` — exists in working tree

**Purpose:**  
Client-side JavaScript parser for the FLA (Financial Ledger Analyzer) module. Reads bank statement Excel files from Vietnamese commercial banks. Detects and normalizes:
- Bank name from filename or sheet metadata
- Transaction date/time (various formats across banks)
- Amount (VND) — handles number formatting, commas, negative values for debits
- Transaction reference code (`Ma lenh`)
- Content/narrative field
- Pre-computed `flag` boolean (for anomaly highlighting)

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `window.XLSX` (SheetJS) | CDN | Excel reading |
| `app.js` | Internal | `initFlaModule()` wires this parser to FLA UI |
| `fraud-engine.js` | Internal | Passes parsed transactions for anomaly flagging |

**Estimated Complexity:** Medium  
`~250–400 LOC`. Multi-bank format variance is the core challenge. Each bank has different column names and date formats.

**Migration Priority:** **P3**  
FLA export engine is implemented; this parser feeds it. FLA is self-contained and doesn't depend on CDR pipeline.

---

## SECTION 2 — ANALYSIS MODULES

---

### AM-01 · `base_analyzer.py`
**Path:** `modules/telecom_analysis/analytics/base_analyzer.py`  
**Status:** `[IMPL]`

**Purpose:**  
Abstract base class for all analysis engines. Defines the standard interface: accept a CDR `DataFrame`, owner phone, and optional filter parameters (date range, time range, search query, top_n limit); return a typed `AnalysisResult`. Enforces that all analyzers are stateless functions over DataFrames — no DB connections, no side effects.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `schemas/analytics_schema.py` | Internal | `AnalysisResult` return types |
| `pandas` | External | DataFrame type annotation |

**Estimated Complexity:** Low  
`~60–100 LOC`. Abstract class only.

**Migration Priority:** **P1**  
Prerequisite for all concrete analyzers.

---

### AM-02 · `record_normalizer.py`
**Path:** `modules/telecom_analysis/analytics/record_normalizer.py`  
**Status:** `[IMPL]`

**Purpose:**  
Post-parse normalization pass applied to raw `ParseResult.records` before any analysis. Responsibilities:
- Re-validates phone normalization (catches edge cases parsers miss)
- Strips records with null `recorded_at` (cannot be placed on timeline)
- Deduplicates exact duplicate rows (same source, target, timestamp, IMEI)
- Converts `duration_seconds` to int (handles float-cast from Excel)
- Normalizes IMEI: strips `.0` suffix, removes spaces, validates 15-digit length
- Sets `service_category` from raw `service_direction_raw` using the direction map

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `normalizers/phone_normalizer.py` | Internal | Re-validate phone fields |
| `normalizers/date_normalizer.py` | Internal | Timestamp coercion |
| `utils/constants.py` | Internal | Service direction map, IMEI length constant |
| `pandas` | External | DataFrame operations |

**Estimated Complexity:** Medium  
`~200–300 LOC`. High correctness requirement — errors here propagate silently through all downstream analyzers.

**Migration Priority:** **P1**  
Runs before any analyzer. Bad records that pass through here corrupt all aggregations.

---

### AM-03 · `aggregator.py`
**Path:** `modules/telecom_analysis/analytics/aggregator.py`  
**Status:** `[IMPL]`

**Purpose:**  
Central orchestrator for all per-subscriber aggregation. Accepts a normalized CDR DataFrame and owner phone; calls each specialized analyzer in sequence; assembles and returns the complete `AggregationBundle`. Also computes the pre-aggregated stat tables (hourly/weekly histograms, tower frequency) that are later persisted as `HourlyActivityStat`, `WeeklyActivityStat`, and `TowerFrequencyStat` in the database.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `analytics/contact_analyzer.py` | Internal | Contact frequency |
| `analytics/location_analyzer.py` | Internal | Tower frequency, movement |
| `analytics/imei_analyzer.py` | Internal | Device tracking |
| `analytics/time_pattern_analyzer.py` | Internal | Hourly/weekly histograms |
| `analytics/frequency_analyzer.py` | Internal | General frequency aggregation |
| `analytics/record_normalizer.py` | Internal | Pre-normalization pass |
| `analytics/results.py` | Internal | `AggregationBundle` type |
| `pandas` | External | DataFrame orchestration |

**Estimated Complexity:** Medium  
`~250–350 LOC`. Logic is mostly sequential calls to child analyzers; complexity is in assembling the final bundle and handling partial failures gracefully.

**Migration Priority:** **P2**  
The import pipeline calls this after parsing. Must exist before M4 (DB import) can write stat tables.

---

### AM-04 · `contact_analyzer.py`
**Path:** `modules/telecom_analysis/analytics/contact_analyzer.py`  
**Status:** `[IMPL]`

**Purpose:**  
Aggregates all CDR records into a per-contact frequency table. For each unique `contact_number`:
- `total_count`, `outgoing_count`, `incoming_count`
- `voice_count`, `sms_count`
- `first_interaction_at`, `last_interaction_at`
- Carrier detected from contact prefix
- Filters: date range, time-of-day range, text search, top-N limit

**Business rule:** Contacts whose normalized phone equals the owner's phone are excluded (self-calls / test records).

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `analytics/base_analyzer.py` | Internal | Inherits `BaseAnalyzer` |
| `utils/phone_utils.py` | Internal | `phones_are_equal()`, `detect_carrier()` |
| `pandas` | External | `groupby`, `agg`, `filter` |

**Estimated Complexity:** Medium  
`~250–400 LOC`. GroupBy aggregation is straightforward; filter chain and edge-case handling (self-call exclusion, null phones) add length.

**Migration Priority:** **P2**  
Powers the Contacts tab — the most frequently used analytics view after call history.

---

### AM-05 · `location_analyzer.py`
**Path:** `modules/telecom_analysis/analytics/location_analyzer.py`  
**Status:** `[IMPL]`

**Purpose:**  
Two outputs from one pass over CDR records:

1. **Tower frequency table** — per `(lac, cell_id)` composite key:
   - `total_count`, `first_seen_at`, `last_seen_at`
   - `contacts_by_tower` (set of phone numbers reached from this tower)

2. **Movement timeline** — chronologically ordered list of location events:
   - `recorded_at`, `lac`, `cell_id`, `contact_number`, `direction`
   - Used by the Map tab (Leaflet) and the movement replay timeline

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `analytics/base_analyzer.py` | Internal | Inherits `BaseAnalyzer` |
| `pandas` | External | Sort, groupby, iterrows for timeline |

**Estimated Complexity:** Medium  
`~300–450 LOC`. Two distinct output formats from the same data; movement timeline requires ordered iteration, not just groupby.

**Migration Priority:** **P2**  
Powers Location tab and Map tab. Also feeds `TowerFrequencyStat` in the DB.

---

### AM-06 · `imei_analyzer.py`
**Path:** `modules/telecom_analysis/analytics/imei_analyzer.py`  
**Status:** `[IMPL]`

**Purpose:**  
Tracks every IMEI seen in the CDR file for a subscriber:
- **Device list** — unique IMEIs with frequency count, first/last seen
- **Usage periods** — for each IMEI, compute continuous time ranges when that device was used (a "run" ends when a different non-null IMEI appears)
- **Device swap events** — ordered list of IMEI changes with timestamps (forensic chain of custody)
- **IMEI validation** — 15-digit check; flags non-standard values

**Comparison key:** First 14 digits (device model, excluding Luhn check digit) used for cross-subscriber matching.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `analytics/base_analyzer.py` | Internal | Inherits `BaseAnalyzer` |
| `utils/constants.py` | Internal | `IMEI_LENGTH = 15`, `IMEI_COMPARE_PREFIX_LENGTH = 14` |
| `pandas` | External | Sort by timestamp, groupby IMEI |

**Estimated Complexity:** Medium  
`~300–400 LOC`. Usage period computation (detecting run boundaries) is the main algorithmic complexity.

**Migration Priority:** **P2**  
Powers the IMEI tab. Device swap forensics is a key investigator workflow.

---

### AM-07 · `time_pattern_analyzer.py`
**Path:** `modules/telecom_analysis/analytics/time_pattern_analyzer.py`  
**Status:** `[IMPL]`

**Purpose:**  
Computes two pre-aggregated time histograms over all CDR records:

1. **24-hour histogram** (`HourlyActivityStat`):
   - Buckets: hour 0–23
   - Per bucket: `total_count`, `voice_count`, `sms_count`, `outgoing_count`, `incoming_count`

2. **Day-of-week histogram** (`WeeklyActivityStat`):
   - Buckets: 0=Monday … 6=Sunday (ISO 8601)
   - Per bucket: `total_count`, `voice_count`, `sms_count`

Output is written to the pre-computed stat tables, not re-computed at query time.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `analytics/base_analyzer.py` | Internal | Inherits `BaseAnalyzer` |
| `normalizers/date_normalizer.py` | Internal | Extract hour/weekday from timestamps |
| `pandas` | External | `dt.hour`, `dt.dayofweek`, groupby |

**Estimated Complexity:** Low  
`~150–200 LOC`. Two clean groupby aggregations. No edge cases beyond null timestamp handling.

**Migration Priority:** **P2**  
Powers the Report tab (activity histograms). Pre-computation makes Report tab queries O(1).

---

### AM-08 · `frequency_analyzer.py`
**Path:** `modules/telecom_analysis/analytics/frequency_analyzer.py`  
**Status:** `[IMPL]`

**Purpose:**  
Generic frequency aggregation helper used by multiple analyzers. Computes ranked frequency distributions over any categorical field (contact phone, IMEI, province code, service category, etc.). Supports:
- Top-N filtering
- Percentage calculation
- Change detection (compare two time windows)

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `pandas` | External | `value_counts()`, `nlargest()` |

**Estimated Complexity:** Low  
`~120–180 LOC`. Generic utility; no domain logic.

**Migration Priority:** **P3**  
Used internally by other analyzers. Not directly called by external modules.

---

### AM-09 · `cross_subscriber_analyzer.py`
**Path:** `modules/telecom_analysis/analytics/cross_subscriber_analyzer.py`  
**Status:** `[IMPL]`

**Purpose:**  
Finds shared entities across multiple subscribers using normalized comparison keys. Three comparison modes:

| Mode | Key Function | Match Criteria |
|------|-------------|----------------|
| Contacts | Last 9 digits of normalized phone | `owners.size ≥ 2` |
| IMEI | First 14 digits of IMEI | `owners.size ≥ 2` |
| Locations | `(lac, cell_id)` composite string | `owners.size ≥ 2` |

Excludes contacts matching any subscriber's own phone number. Returns a `SharedEntityResult` list with owner set, file names, and all variant values seen for the shared key.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `analytics/base_analyzer.py` | Internal | Inherits `BaseAnalyzer` |
| `utils/phone_utils.py` | Internal | `get_last_9_digits()` |
| `utils/constants.py` | Internal | `IMEI_COMPARE_PREFIX_LENGTH = 14` |
| `pandas` | External | Multi-DataFrame join |
| `schemas/analytics_schema.py` | Internal | `SharedEntityResult` types |

**Estimated Complexity:** High  
`~400–600 LOC`. Three distinct comparison strategies, normalization key computation, multi-file indexing, and subscriber self-exclusion logic.

**Migration Priority:** **P3**  
Powers Compare tab — used when investigators work multiple files simultaneously. Depends on having ≥2 subscribers imported (requires M4 completion first).

---

### AM-10 · `results.py`
**Path:** `modules/telecom_analysis/analytics/results.py`  
**Status:** `[IMPL]`

**Purpose:**  
Typed data container definitions for all analysis outputs. Provides Python dataclasses (or Pydantic models) for:
- `ContactResult`, `ContactFrequencyTable`
- `TowerResult`, `MovementEvent`, `LocationFrequencyTable`
- `ImeiResult`, `DeviceSwapEvent`, `ImeiFrequencyTable`
- `TimePatternResult` (hourly + weekly buckets)
- `SharedEntityResult` (cross-subscriber)
- `AggregationBundle` (all of the above combined)

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `dataclasses` or `pydantic` | stdlib / External | Type definitions |
| `schemas/analytics_schema.py` | Internal | May overlap; one should be canonical |

**Estimated Complexity:** Low  
`~200–300 LOC`. Pure data definitions; no logic.

**Migration Priority:** **P1**  
Imported by every analyzer. Must be stable before any analyzer is implemented.

---

### AM-11 · `fraud-engine.js`
**Path:** `fraud-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Client-side fraud/anomaly detection engine for the FLA module. Applies configurable rule-based flagging to parsed bank transactions:
- **Large transaction rule:** amount ≥ 150,000,000 VND → `flag = true`
- **Danger-hour rule:** transaction hour ∈ {23, 0, 1, 2, 3, 4} → `flag = true`
- **Frequency spike rule:** N+ transactions within M minutes from the same account → `flag = true`
- **Configurable thresholds** via `risk-calibration-engine.js`

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `bank-parser.js` | Internal | Receives parsed transaction array |
| `risk-calibration-engine.js` | Internal | Reads configured thresholds |
| `fraud-governance-layer.js` | Internal | Rule priority and override logic |

**Estimated Complexity:** High  
`~500–700 LOC`. Multiple rule types, threshold configuration, and the frequency-spike rule requires a sliding window computation.

**Migration Priority:** **P3**  
Powers the FLA anomaly detection column. The 150M VND and danger-hour rules are already implemented in `fla_exporter.py`; this engine adds the configurable frequency-spike detection on top.

---

### AM-12 · `fraud-governance-layer.js`
**Path:** `fraud-governance-layer.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Rule governance layer above `fraud-engine.js`. Manages the registry of active fraud rules, their priority ordering, conflict resolution (when two rules flag the same transaction for different reasons), and rule enable/disable state. Provides a structured `RuleViolation` object per flagged transaction for display in the FLA UI.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `fraud-engine.js` | Internal | Rule execution |
| `risk-calibration-engine.js` | Internal | Threshold values |

**Estimated Complexity:** Medium  
`~200–350 LOC`. Registry pattern with priority ordering.

**Migration Priority:** **P4**  
Enhancement on top of `fraud-engine.js`. The simpler threshold-only rules work without this layer.

---

### AM-13 · `risk-calibration-engine.js`
**Path:** `risk-calibration-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Manages configurable risk thresholds for the FLA and potentially CDR modules. Persists threshold settings (amount limit, danger hours, frequency window) to `localStorage` so investigators can tune them per-session. Exposes a settings UI panel for real-time adjustment.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `fraud-engine.js` | Internal | Consumed by rules |
| `localStorage` | Browser API | Persistence |

**Estimated Complexity:** Low  
`~150–250 LOC`. Configuration management pattern.

**Migration Priority:** **P4**  
Optional enhancement. Default thresholds are hardcoded in `fla_exporter.py` and work without this.

---

### AM-14 · `graph-engine.js`
**Path:** `graph-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Client-side network/graph engine for visualizing entity relationships. Builds a node-link diagram (force-directed or hierarchical) from:
- **CDR graph:** subscriber ↔ contact frequency network
- **Financial graph:** account → transfer → account (money flow)
- **IMEI graph:** subscriber ↔ shared device ↔ subscriber

Handles node sizing by frequency, edge weighting by interaction count, and cluster detection (identify tightly connected subgroups).

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| D3.js or similar | CDN | Force-directed graph rendering |
| `cdr-analyzer.js` | Internal | Contact data source |
| `bank-parser.js` | Internal | Transaction flow data source |

**Estimated Complexity:** Very High  
`~800–1500 LOC`. Graph layout algorithms, interaction handling (zoom/pan/click), and multi-source data normalization are all non-trivial.

**Migration Priority:** **P5**  
Powerful but non-essential. Investigators can use tabular views first; graph is an enhancement.

---

### AM-15 · `nlp-engine.js`
**Path:** `nlp-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Natural language processing utilities applied to transaction content/narrative fields in FLA and CDR SMS content. Capabilities:
- Keyword extraction from transaction narratives (detect bank codes, transfer references)
- SMS content classification (banking, marketing, OTP, personal)
- Simple pattern matching for common Vietnamese banking phrases
- Scoring of "suspicious content" in transaction descriptions

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `bank-parser.js` | Internal | Transaction content fields |
| `fraud-engine.js` | Internal | Feeds classified content to fraud rules |

**Estimated Complexity:** High  
`~400–600 LOC`. Vietnamese text processing without a full NLP library requires extensive pattern matching.

**Migration Priority:** **P5**  
Enhancement on top of working fraud detection. Useful for SMS-based CDR classification.

---

### AM-16 · `phone-topup-engine.js`
**Path:** `phone-topup-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Detects and classifies phone top-up transactions within bank statement data. Identifies patterns where a bank transfer amount matches common Vietnamese mobile top-up denominations (50k, 100k, 200k, 500k VND) made to carrier-linked accounts (Viettel, Vina, Mobi payment services). Useful for establishing subscriber identity and carrier linkage from financial data.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `bank-parser.js` | Internal | Transaction records |
| `utils/constants.py` equivalent | Internal | Top-up denomination table, carrier payment account patterns |

**Estimated Complexity:** Medium  
`~200–300 LOC`. Pattern matching against known denomination amounts and payee patterns.

**Migration Priority:** **P4**  
Niche but useful for correlating FLA and CDR data for the same subscriber.

---

## SECTION 3 — EXPORT MODULES

---

### EM-01 · `base_exporter.py`
**Path:** `modules/telecom_analysis/exports/base_exporter.py`  
**Status:** `[IMPL]`

**Purpose:**  
Abstract base class defining the exporter contract. All exporters must implement `export(data: list[dict]) → BytesIO`. Provides shared utility methods available to all subclasses:
- `_apply_header_style(ws, row, style)` — applies dark navy / cyan header formatting
- `_auto_width(ws)` — computes column widths from content
- `_highlight_row(ws, row, color)` — applies conditional red/yellow row background
- `_new_workbook() → Workbook` — creates a pre-configured openpyxl workbook

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `openpyxl` | External | Workbook creation, style application |

**Estimated Complexity:** Low  
`~100–150 LOC`. Shared utilities only; no domain logic.

**Migration Priority:** **P1**  
Required by all three concrete exporters.

---

### EM-02 · `excel_exporter.py`
**Path:** `modules/telecom_analysis/exports/excel_exporter.py`  
**Status:** `[IMPL]`

**Purpose:**  
The standard 5-sheet forensic report workbook. Implements `export_multi_sheet(sheets: dict[str, list[dict]]) → BytesIO` producing a workbook used for all CDR subscriber exports:

| Sheet | Vietnamese Name | Data Source |
|-------|----------------|------------|
| `TTTB` | Thông Tin Thuê Bao | Subscriber PII |
| `LIST` | Danh Sách Cuộc Gọi | CDR records |
| `Contact` | Danh Sách Liên Hệ | Contact frequency + annotations |
| `IMEI` | Thiết Bị IMEI | Device list + usage periods |
| `Location` | Vị Trí Trạm BTS | Tower frequency + Maps links |

**Column maps** are fixed — changing column names or order would break round-trip import compatibility.

**Styling:** Header `1A2233` background, `00F0FF` text, Calibri 11pt body, auto-width.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `exports/base_exporter.py` | Internal | Inherits styling utilities |
| `openpyxl` | External | Sheet building |
| `analytics/imei_analyzer.py` | Internal | `get_usage_periods()` for IMEI sheet |
| `services/annotation_service.py` | Internal | Merge investigator annotations |

**Estimated Complexity:** High  
`~500–700 LOC`. Five distinct sheet schemas, column ordering, annotation merge logic, and the round-trip format contract all add surface area.

**Migration Priority:** **P2**  
The primary deliverable from every CDR investigation. Must work before export endpoints can be shipped.

---

### EM-03 · `gtp_exporter.py`
**Path:** `modules/telecom_analysis/exports/gtp_exporter.py`  
**Status:** `[IMPL]`

**Purpose:**  
Self-contained 3-sheet export for GTP (cell-tower geospatial) data. Receives plain `list[dict]` — no DB coupling:

| Sheet | Contents | Alert Logic |
|-------|---------|-------------|
| Lich Trinh Tram | Movement log (time, LAC, CID, BTS label, carrier, signal dBm, lat, lng) | — |
| Bao Cao LAC | LAC zone frequency (occurrence count + %) | — |
| Thong Ke Tin Hieu | Signal quality distribution (Good/Medium/Weak/Unknown) | Weak (< −90 dBm) → red row |

**Signal classification thresholds:**
- Good: ≥ −75 dBm
- Medium: −75 to −90 dBm
- Weak: < −90 dBm

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `exports/base_exporter.py` | Internal | Inherits styling utilities |
| `openpyxl` | External | Sheet building |

**Estimated Complexity:** Medium  
`~300–400 LOC`. Three sheets with clear schemas. Signal classification logic is the main domain content.

**Migration Priority:** **P3**  
GTP module is self-contained. Low risk — already implemented and tested independently of CDR pipeline.

---

### EM-04 · `fla_exporter.py`
**Path:** `modules/telecom_analysis/exports/fla_exporter.py`  
**Status:** `[IMPL]`

**Purpose:**  
Self-contained 3-sheet export for FLA (financial ledger) data. Receives plain `list[dict]` — no DB coupling:

| Sheet | Contents | Alert Logic |
|-------|---------|-------------|
| Giao Dich | Transaction list (date, bank, amount VND, code, content, flag) | Amount ≥ 150M → red; `flag=True` → red |
| Thong Ke | Summary statistics (totals, anomaly counts, per-bank breakdown) | — |
| Phan Tich Gio | Hourly distribution 0–23 with anomaly count | Hours 23, 0–4 → red row |

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `exports/base_exporter.py` | Internal | Inherits styling + highlight utilities |
| `openpyxl` | External | Sheet building |

**Estimated Complexity:** Medium  
`~350–450 LOC`. Three sheets, conditional row highlighting, and per-bank aggregation in Sheet 2.

**Migration Priority:** **P3**  
FLA is self-contained. Route `POST /exports/fla` is defined; this exporter already produces correct output.

---

### EM-05 · `zip_exporter.py`
**Path:** `modules/telecom_analysis/exports/zip_exporter.py`  
**Status:** `[IMPL]`

**Purpose:**  
Bundles multiple XLSX workbooks (one per subscriber) into a single ZIP archive for batch download. Accepts a list of `(filename, BytesIO)` tuples and produces a ZIP `BytesIO`. Used by `POST /exports/batch`.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `exports/excel_exporter.py` | Internal | Source of per-subscriber workbooks |
| `exports/base_exporter.py` | Internal | `workbook_to_bytes()` utility |
| Python `zipfile` | stdlib | ZIP creation |

**Estimated Complexity:** Low  
`~80–120 LOC`. Thin wrapper around `zipfile.ZipFile`.

**Migration Priority:** **P3**  
Useful for multi-subscriber batch export. Depends on EM-02 completing first.

---

### EM-06 · `export-manager.js`
**Path:** `export-manager.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Client-side export orchestrator. Coordinates all client-side export flows:
- Single subscriber → 5-sheet XLSX (calls SheetJS formatter for each sheet)
- Multi-file batch → ZIP via JSZip
- GTP data → 3-sheet XLSX
- FLA data → 3-sheet XLSX
- Comparison result → summary XLSX

Manages the download trigger (`URL.createObjectURL` + `<a>.click()`), export progress feedback, and filename generation (`{phone}_{date}_{suffix}.xlsx`).

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `window.XLSX` (SheetJS) | CDN | XLSX workbook building |
| JSZip | CDN | ZIP generation |
| `cdr-analyzer.js` | Internal | CDR session data |
| `account-export-grouping.js` | Internal | Multi-account grouping logic |

**Estimated Complexity:** High  
`~500–700 LOC`. Coordinates multiple export types, progress UX, and edge cases (empty data, large files, filename sanitization).

**Migration Priority:** **P2**  
Central to the client-side export workflow. Currently distributed across `cdr-analyzer.js`; extracting to `export-manager.js` is a clean separation.

---

### EM-07 · `account-export-grouping.js`
**Path:** `account-export-grouping.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Groups CDR sessions by subscriber phone number for batch export. When multiple files for the same subscriber are loaded (e.g., Viettel + Vina CDR for the same person), merges their data into a single export workbook rather than producing separate files. Handles deduplication of overlapping records.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `cdr-analyzer.js` | Internal | Session registry |
| `export-manager.js` | Internal | Export trigger |
| `utils/phone_utils.py` equivalent (JS) | Internal | Normalized phone equality |

**Estimated Complexity:** Medium  
`~250–350 LOC`. Cross-session merging and deduplication logic.

**Migration Priority:** **P4**  
Enhancement for multi-carrier multi-file subscribers. Core export works without this.

---

### EM-08 · `investigation-report-engine.js`
**Path:** `investigation-report-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Generates formal investigative report documents from CDR analysis results. Produces a structured summary narrative including: subscriber identity, date range analyzed, key contacts (top N), device history, location clusters, anomalous patterns, and cross-subscriber links. Output format: XLSX report sheet or formatted HTML for printing.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `cdr-analyzer.js` | Internal | Analysis results |
| `export-manager.js` | Internal | Export delivery |
| `investigation-case-engine.js` | Internal | Case metadata |

**Estimated Complexity:** High  
`~500–700 LOC`. Narrative generation from structured data; template filling; multi-section document assembly.

**Migration Priority:** **P4**  
High value for investigators but requires core analytics to be complete first.

---

## SECTION 4 — UI MODULES

---

### UI-01 · `index.html`
**Path:** `index.html` (root)  
**Status:** `[IMPL]`

**Purpose:**  
Single-page application shell. Contains all screen containers (`<div id="X-screen" class="screen">`), the sidebar navigation tree, top bar, login overlay, and script/style references. Uses CSS `display: none` toggling to show one screen at a time. No server-side rendering — fully static HTML.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `styles.css` | Internal | All styling |
| `app.js` | Internal | Login + navigation |
| `cdr-analyzer.js` | Internal | CDR screen content |
| `batch-ui.js` | Internal | Batch upload UI |
| `cell-lac-parser.js` | Internal | GTP parsing |
| `bank-parser.js` | Internal | FLA parsing |
| Chart.js | CDN | Activity histograms |
| Leaflet.js | CDN | Map tab |

**Estimated Complexity:** Medium  
`~400–600 LOC HTML`. Structure is straightforward but the number of nested screen containers and tab panels is large.

**Migration Priority:** **P1**  
The app shell that wires all modules together.

---

### UI-02 · `app.js`
**Path:** `app.js` (root)  
**Status:** `[IMPL]`

**Purpose:**  
Root application controller. Manages:
- **Login gate:** Multi-step auth animation, hardcoded credential validation, `sessionStorage` token write
- **Navigation:** `navigateTo(screenKey)` — shows/hides screens, updates active nav item, handles sidebar collapse
- **Module init orchestration:** Calls `CDRAnalyzer.init()`, `BatchUI.init()`, `initGtpModule()`, `initFlaModule()`, `initSrauModule()` on `DOMContentLoaded`
- **GTP module logic** — file drop, GTP parser invocation, export trigger
- **FLA module logic** — file drop, FLA parser invocation, export trigger
- **SRAU module stub** — placeholder screen

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `cdr-analyzer.js` | Internal | CDR module init |
| `batch-ui.js` | Internal | Batch upload init |
| `cell-lac-parser.js` | Internal | GTP parsing |
| `bank-parser.js` | Internal | FLA parsing |
| `export-manager.js` | Internal (planned) | Export orchestration |
| `sessionStorage` | Browser API | Auth session |

**Estimated Complexity:** High  
`~600–900 LOC`. Monolithic controller that currently owns too many responsibilities. Should be split as modules mature.

**Migration Priority:** **P1**  
Entry point of the entire frontend. Navigation and login gate are immediate blockers for all UI work.

---

### UI-03 · `cdr-analyzer.js`
**Path:** `cdr-analyzer.js` (root)  
**Status:** `[IMPL]`

**Purpose:**  
The largest and most complex frontend file. An IIFE module that owns the entire CDR Analyzer feature: 9 tabs, multi-session management, client-side parsing, all analysis, and all CDR-specific export. Internal state object `_S` tracks parse result, normalized records, subscriber info, per-tab filtered data, and Chart.js instances.

**9 Tabs implemented:**

| Tab | Content |
|-----|---------|
| Subscriber | PII display + editable overlay |
| Calls | Paginated + filterable CDR record table |
| Contacts | Contact frequency table + annotation fields (Zalo, FB, Telegram) |
| IMEI | Device list + usage periods + model annotation |
| Location | Tower frequency + Google Maps links + BTS address |
| Report | Hourly + weekly Chart.js bar charts |
| Map | Leaflet placeholder + movement timeline |
| Compare | Cross-file shared contacts / IMEI / location |
| Export | Export panel (scope selection → `export-manager.js`) |

**Multi-session:** `Map<sessionId, _S>`. Switching sessions destroys Chart.js instances and re-renders all tabs.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `window.XLSX` (SheetJS) | CDN | Client-side Excel parsing |
| Chart.js | CDN | Report tab histograms |
| Leaflet.js | CDN | Map tab |
| `export-manager.js` | Internal (planned) | Export delegation |
| `forensic-snapshot-engine.js` | Internal | Session snapshot/restore |
| `tagging-engine.js` | Internal | Entity tagging |

**Estimated Complexity:** Very High  
`~2000–3000 LOC`. The largest single file in the project. Owns too much — should be split into tab-level components in a future refactor.

**Migration Priority:** **P1**  
The primary user-facing module. All CDR investigation happens here.

---

### UI-04 · `batch-ui.js`
**Path:** `batch-ui.js` (root)  
**Status:** `[IMPL]`

**Purpose:**  
Batch upload screen UI. Manages:
- Drag-and-drop file area (multiple files)
- File list with per-file status indicators (pending / uploading / success / error)
- Progress bar per file (fetch-based streaming)
- Calls `POST /api/v1/imports/upload/batch` for server-side upload
- Falls back to client-side parsing (CDRAnalyzer) if server is unavailable
- Summary panel: N files processed, M errors

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `fetch` API | Browser | Server batch upload calls |
| `cdr-analyzer.js` | Internal | Client-side fallback parse |
| FastAPI `/api/v1/imports/upload/batch` | Backend | Server upload endpoint |

**Estimated Complexity:** Medium  
`~350–500 LOC`. Upload state machine per file is the main complexity.

**Migration Priority:** **P2**  
Enables multi-file workflows. Depends on server batch endpoint being functional.

---

### UI-05 · `styles.css`
**Path:** `styles.css` (root)  
**Status:** `[IMPL]`

**Purpose:**  
Complete design system for the Sentinel platform. Implements the cyber/intelligence aesthetic defined in CLAUDE.md:
- **Color tokens:** `--bg-sentinel: #0b0d11`, `--panel-steel: #13161c`, `--accent-cyan: #00f0ff`, `--border-light: rgba(255,255,255,0.07)`
- **Typography:** Inter (body), Roboto Mono (headings + technical labels)
- **Component styles:** `.tactical-card` (hover glow + lift), `.btn-tactical` (cyan outline → fill on hover), `.pulse-indicator` (online/standby)
- **Table styles:** Dark alternating rows, cyan column headers
- **Login overlay:** Corner brackets, scan-line animation, badge

**Dependencies:** None  
Pure CSS; no build tooling.

**Estimated Complexity:** Medium  
`~600–900 LOC CSS`. Large but mechanical.

**Migration Priority:** **P1**  
All UI modules depend on this for layout and visual correctness.

---

### UI-06 · `investigation-case-engine.js`
**Path:** `investigation-case-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Case management system. Manages named investigation cases — each case groups multiple CDR sessions, FLA data, GTP data, and annotations under a single case identifier. Provides:
- Case creation / rename / archive
- Attach/detach subscriber sessions to a case
- Case-level timeline (all events from all subscribers in chronological order)
- Case export (all subscribers in one ZIP)
- `localStorage` persistence with `case-drift-protection.js` for integrity

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `cdr-analyzer.js` | Internal | Session registry |
| `case-drift-protection.js` | Internal | Data integrity on reload |
| `investigation-report-engine.js` | Internal | Case-level report |
| `localStorage` | Browser API | Persistence |

**Estimated Complexity:** High  
`~500–800 LOC`. Multi-entity grouping, timeline merge across sessions, and persistence integrity.

**Migration Priority:** **P4**  
Powerful multi-case workflow. Requires core CDR + annotation features to be stable first.

---

### UI-07 · `case-drift-protection.js`
**Path:** `case-drift-protection.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Guards against `localStorage` corruption and case data drift across page reloads. On startup, validates the stored case structure against a schema checksum; repairs or prompts for reset if corrupt. Prevents silent data loss when a session is interrupted mid-write.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `investigation-case-engine.js` | Internal | Case schema definition |
| `localStorage` | Browser API | Read/validate stored state |

**Estimated Complexity:** Low  
`~150–200 LOC`. Schema validation + repair logic.

**Migration Priority:** **P4**  
Companion to `investigation-case-engine.js`.

---

### UI-08 · `forensic-snapshot-engine.js`
**Path:** `forensic-snapshot-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Creates point-in-time snapshots of a CDR session's analysis state (`_S` object). Allows investigators to:
- Save a named snapshot before making changes
- Compare two snapshots (diff contact list, IMEI list, location list)
- Restore a previous snapshot
- Export snapshot as a reference JSON for audit trail

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `cdr-analyzer.js` | Internal | `_S` state access |
| `localStorage` | Browser API | Snapshot storage |

**Estimated Complexity:** Medium  
`~250–350 LOC`. JSON serialization + diff logic.

**Migration Priority:** **P4**  
Audit trail feature. Useful but not blocking core workflows.

---

### UI-09 · `tagging-engine.js`
**Path:** `tagging-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Entity tagging system. Allows investigators to attach free-form tags to any entity (contact phone, IMEI, tower, bank account) across all sessions. Tags persist in `localStorage`, are merged into exports, and can be used as search filters. Supports predefined tag categories: `suspect`, `associate`, `witness`, `unknown`, `verified`.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `cdr-analyzer.js` | Internal | Entity data |
| `localStorage` | Browser API | Tag persistence |
| `export-manager.js` | Internal | Tags merged into export sheets |

**Estimated Complexity:** Medium  
`~200–300 LOC`. Tag CRUD + filter integration.

**Migration Priority:** **P4**  
Annotation enhancement. Pairs well with M7 (investigator annotations).

---

### UI-10 · `soc-incident-engine.js`
**Path:** `soc-incident-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Security Operations Center incident management UI. Manages active incidents triggered by anomaly detection (from FLA or CDR patterns). Each incident has: severity, status (open/investigating/closed), linked entities, notes, and timestamps. Provides an incident queue view for supervisors.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `fraud-engine.js` | Internal | Incident trigger source (FLA) |
| `cdr-analyzer.js` | Internal | CDR anomaly source |
| `investigation-case-engine.js` | Internal | Convert incident to case |

**Estimated Complexity:** Medium  
`~300–450 LOC`. State machine per incident (open → investigating → closed).

**Migration Priority:** **P5**  
Enterprise feature. Not needed for single-investigator workflows.

---

### UI-11 · `system-observability.js`
**Path:** `system-observability.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Client-side performance and error telemetry. Measures and logs: parse duration per file, analysis duration per tab, export generation time, memory usage estimate, and unhandled JS errors. Output goes to a debug panel (shown to admins) and optionally to the health endpoint.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `Performance API` | Browser | Timing measurements |
| `system-validation-engine.js` | Internal | Pre-condition checks |

**Estimated Complexity:** Low  
`~150–250 LOC`. Instrumentation wrapper.

**Migration Priority:** **P5**  
Developer / ops tooling. Not user-facing.

---

### UI-12 · `system-validation-engine.js`
**Path:** `system-validation-engine.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Pre-flight validation checks on startup. Verifies: SheetJS loaded, Chart.js loaded, Leaflet loaded, `localStorage` accessible, session storage functional, required DOM elements present. Shows a dependency error screen if critical prerequisites are missing.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `app.js` | Internal | Called during init sequence |
| `window.XLSX`, `window.Chart`, `window.L` | Global | CDN dependency checks |

**Estimated Complexity:** Low  
`~100–150 LOC`. Boolean checks and error display.

**Migration Priority:** **P3**  
Important for reliability. Should run before any module initializes.

---

### UI-13 · `batch-processor.js`
**Path:** `batch-processor.js` (root)  
**Status:** `[UNTRACKED]`

**Purpose:**  
Client-side batch analysis orchestrator. When multiple CDR files are dropped simultaneously, manages the analysis queue: processes files sequentially (to avoid main-thread saturation), reports per-file progress, handles failures gracefully without aborting the remaining queue. Uses `requestIdleCallback` or `setTimeout` yield for large files.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `cdr-analyzer.js` | Internal | `registerSession()`, analysis per file |
| `batch-ui.js` | Internal | Progress UI updates |

**Estimated Complexity:** Medium  
`~250–350 LOC`. Queue management + yield-based scheduling.

**Migration Priority:** **P3**  
Required for smooth multi-file batch workflows. Currently `cdr-analyzer.js` processes files inline.

---

## SECTION 5 — SHARED UTILITIES

---

### SU-01 · `phone_utils.py`
**Path:** `modules/telecom_analysis/utils/phone_utils.py`  
**Status:** `[IMPL]`

**Purpose:**  
The single source of truth for all Vietnamese phone number operations. Seven pure functions used across parsers, normalizers, and analyzers:

| Function | Signature | Description |
|----------|-----------|-------------|
| `normalize_phone` | `(str\|None) → str\|None` | Full normalization pipeline (strip → country code → prepend 0 → validate) |
| `get_last_9_digits` | `(str) → str\|None` | Cross-subscriber comparison key |
| `is_service_sender` | `(str) → bool` | Detect MBBANK, Apple, short codes |
| `detect_carrier` | `(str) → str` | Viettel / Vina / Mobi / unknown from prefix |
| `phones_are_equal` | `(str, str) → bool` | Prefix-agnostic equality via last-9 |
| `get_first_14_digits` | `(str) → str\|None` | IMEI device-model comparison key |
| `get_mnc_from_phone` | `(str) → str` | MNC code (04/02/01) for export |

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `utils/constants.py` | Internal | `VIETTEL_PREFIXES`, `VINA_PREFIXES`, `MOBI_PREFIXES` |

**Estimated Complexity:** Low  
`~200–280 LOC`. Pure functions; no I/O or state.

**Migration Priority:** **P1**  
Used by almost every module. Correctness is critical — a bug here silently corrupts all contact frequency and comparison results.

---

### SU-02 · `constants.py`
**Path:** `modules/telecom_analysis/utils/constants.py`  
**Status:** `[IMPL]` (partial — province map incomplete)

**Purpose:**  
Single file for all magic numbers, lookup tables, and configuration constants used across the analysis engine:

| Constant | Value | Used By |
|----------|-------|---------|
| `VIETTEL_PREFIXES` | `["032","033",…,"098"]` | SU-01, PM-02, PM-03 |
| `VINA_PREFIXES` | `["081","082",…,"094"]` | SU-01, PM-02 |
| `MOBI_PREFIXES` | `["070","076",…,"093"]` | SU-01, PM-02 |
| `PROVINCE_CODE_MAP` | `{"TNH": "Tay Ninh", …}` | SU-04 |
| `SERVICE_DIRECTION_MAP` | `{"Nội mạng": "onnet", …}` | AM-02 |
| `IMEI_LENGTH` | `15` | AM-06 |
| `IMEI_COMPARE_PREFIX_LENGTH` | `14` | AM-06, AM-09 |
| `PHONE_COMPARE_SUFFIX_LENGTH` | `9` | SU-01 |
| `COLUMN_KEYWORDS` | `{field: [keyword, …], …}` | PM-02 |
| `COLUMN_MATCH_THRESHOLD` | `0.5` | PM-02 |
| `HEADER_SEARCH_DEPTH` | `30` | PM-02, all parsers |
| `VIETTEL_PII_CELLS` | `{field: (row, col), …}` | PM-04 |

**Dependencies:** None — leaf module.

**Estimated Complexity:** Low  
`~150–250 LOC`. Data only.

**Migration Priority:** **P1**  
Leaf dependency of everything else. Province map is `[PARTIAL]` — needs completion before location normalization is reliable.

---

### SU-03 · `phone_normalizer.py`
**Path:** `modules/telecom_analysis/normalizers/phone_normalizer.py`  
**Status:** `[IMPL]`

**Purpose:**  
Higher-level normalizer wrapping `phone_utils.py`. Returns a structured `NormalizedPhone` object (not just a string) containing:
- `raw`: original value
- `normalized`: 10-digit form
- `carrier`: detected carrier
- `is_service`: bool
- `comparison_key`: last-9 digits

Also provides `resolve_direction(source_raw, target_raw, owner_phone) → (contact_number, direction)` — the core direction inference used by every parser.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `utils/phone_utils.py` | Internal | All underlying operations |

**Estimated Complexity:** Low  
`~120–180 LOC`. Thin wrapper adding structured output.

**Migration Priority:** **P1**  
Called by every parser on every CDR row.

---

### SU-04 · `province_normalizer.py`
**Path:** `modules/telecom_analysis/normalizers/province_normalizer.py`  
**Status:** `[PARTIAL]`

**Purpose:**  
Normalizes raw province codes from CDR files to canonical Vietnamese province names. Handles the inconsistency in the source data where the same province has multiple code variants (e.g., `TNH`, `T066`, `TN` all → `"Tay Ninh"`). Also normalizes common misspellings and encoding artifacts (e.g., `"Ho Chi Minh"` → `"TP. Hồ Chí Minh"`).

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `utils/constants.py` | Internal | `PROVINCE_CODE_MAP` |

**Estimated Complexity:** Low  
`~100–150 LOC`. Map lookup with fallback to raw value.

**Migration Priority:** **P2**  
Incomplete province map causes inconsistent location data in exports. Fix the map before shipping Location tab.

---

### SU-05 · `date_normalizer.py`
**Path:** `modules/telecom_analysis/normalizers/date_normalizer.py`  
**Status:** `[IMPL]`

**Purpose:**  
Handles all timestamp parsing variants found across Vietnamese CDR files:

| Format | Example | Handler |
|--------|---------|---------|
| Excel serial number | `44927.5` | `xlrd.xldate_as_datetime()` |
| `dd/MM/yyyy HH:mm:ss` | `25/01/2024 14:30:00` | `strptime` |
| `dd/MM/yyyy` | `25/01/2024` | `strptime` |
| `HH:mm:ss` (time only) | `14:30:00` | Combined with separate date column (Vina) |
| ISO 8601 | `2024-01-25T14:30:00` | `fromisoformat()` |
| 6-digit date | `250124` | Custom: `DDMMYY` |
| 6-digit time | `143000` | Custom: `HHMMSS` |

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| Python `datetime` | stdlib | Parsing and formatting |
| `xlrd` | External (optional) | Excel serial date conversion |

**Estimated Complexity:** Medium  
`~200–280 LOC`. Seven format handlers with priority order and graceful failure.

**Migration Priority:** **P1**  
Timestamp errors mean records cannot be placed on timeline — they are silently dropped from all analytics.

---

### SU-06 · `provider_detector.py`
**Path:** `modules/telecom_analysis/normalizers/provider_detector.py`  
**Status:** `[IMPL]`

**Purpose:**  
Standalone carrier detection with richer output than `phone_utils.detect_carrier()`. Returns a full `ProviderConfig`:
- `name`: "VIETTEL" | "VINA" | "MOBI" | "UNKNOWN"
- `mnc`: "04" | "02" | "01" | ""
- `template_id`: "viettel" | "vina" | "mobi"
- `prefixes`: list of matching prefixes

Used by `auto_detector.py` and `metadata.py` to suggest parser and template.

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `utils/constants.py` | Internal | Prefix tables |

**Estimated Complexity:** Low  
`~100–140 LOC`. Lookup table with structured output.

**Migration Priority:** **P1**  
Used at file ingestion time to route to correct parser.

---

### SU-07 · `date_utils.py`
**Path:** `modules/telecom_analysis/utils/date_utils.py`  
**Status:** `[IMPL]`

**Purpose:**  
General date utility functions used across the project:
- `format_date_vn(dt) → str` — Vietnamese date format (`dd/MM/yyyy`)
- `parse_date_range(from_str, to_str) → (date, date)` — for API filter parameters
- `get_report_period(records) → (date, date)` — infer period from first/last CDR timestamp
- `excel_serial_to_datetime(serial) → datetime` — Excel date number conversion

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| Python `datetime` | stdlib | All date operations |

**Estimated Complexity:** Low  
`~120–160 LOC`.

**Migration Priority:** **P2**  
Needed by export service (report period header) and API filter handling.

---

### SU-08 · `file_utils.py`
**Path:** `modules/telecom_analysis/utils/file_utils.py`  
**Status:** `[IMPL]`

**Purpose:**  
File system utilities used by the upload and import pipeline:
- `generate_upload_id() → str` — UUID4 for upload tracking
- `get_upload_path(upload_id, filename) → Path` — deterministic storage path
- `sanitize_filename(name) → str` — remove unsafe characters for storage
- `get_file_extension(filename) → str` — lowercase extension extraction
- `read_excel_as_list(path, sheet) → list[list]` — openpyxl → `list[list[Any]]`
- `detect_encoding(path) → str` — for CSV fallback support

**Dependencies:**

| Dependency | Type | Reason |
|-----------|------|--------|
| `pathlib` | stdlib | Path operations |
| `uuid` | stdlib | Upload ID generation |
| `openpyxl` | External | Excel reading |

**Estimated Complexity:** Low  
`~150–200 LOC`.

**Migration Priority:** **P1**  
Used by upload handler and all parsers.

---

## MODULE DEPENDENCY MATRIX

```
                      PM01 PM02 PM03 PM04 PM05 PM06 PM07 PM08
                       ┆    ┆    ┆    ┆    ┆    ┆    ┆    ┆
AM01 base_analyzer     .    .    .    .    .    .    .    .
AM02 record_normalizer .    .    .    .    .    .    .    .    ◄─ SU03 SU05 SU02
AM03 aggregator        .    .    .    .    .    .    .    .    ◄─ AM04 AM05 AM06 AM07
AM04 contact_analyzer  .    .    .    .    .    .    .    .    ◄─ SU01 AM01
AM05 location_analyzer .    .    .    .    .    .    .    .    ◄─ AM01
AM06 imei_analyzer     .    .    .    .    .    .    .    .    ◄─ AM01 SU02
AM07 time_pattern      .    .    .    .    .    .    .    .    ◄─ AM01 SU05
AM09 cross_subscriber  .    .    .    .    .    .    .    .    ◄─ SU01 SU02

EM01 base_exporter     .    .    .    .    .    .    .    .    (no deps)
EM02 excel_exporter    .    .    .    .    .    .    .    .    ◄─ EM01 AM06
EM03 gtp_exporter      .    .    .    .    .    .    ◄─ PM07   ◄─ EM01
EM04 fla_exporter      .    .    .    .    .    .    .    ◄─PM08  ◄─ EM01
EM05 zip_exporter      .    .    .    .    .    .    .    .    ◄─ EM02

SU01 phone_utils       .    .    .    .    .    .    .    .    ◄─ SU02
SU02 constants         .    .    .    .    .    .    .    .    (leaf)
SU03 phone_normalizer  .    .    .    .    .    .    .    .    ◄─ SU01
SU04 province_norm     .    .    .    .    .    .    .    .    ◄─ SU02
SU05 date_normalizer   .    .    .    .    .    .    .    .    (stdlib only)
SU06 provider_detect   .    .    .    .    .    .    .    .    ◄─ SU02

PM01 base_parser       .    .    .    .    .    .    .    .    (leaf)
PM02 column_mapper     ◄─PM01  .    .    .    .    .    .    ◄─ SU02 SU01
PM03 auto_detector     ◄─PM04 PM05 PM06  .    .    .    .    ◄─ SU01
PM04 viettel_parser    ◄─PM01 PM02  .    .    .    .    .    ◄─ SU03 SU05 SU04 SU02
PM05 vina_parser       ◄─PM01 PM02  .    .    .    .    .    ◄─ SU03 SU05 SU02
PM06 mobi_parser       ◄─PM01  .    .    .    .    .    .    ◄─ SU03 SU05 SU02
```

---

## MIGRATION PRIORITY SUMMARY

| Priority | Modules | Rationale |
|----------|---------|-----------|
| **P1** | PM-01, PM-02, PM-03, PM-04, AM-01, AM-10, EM-01, SU-01, SU-02, SU-03, SU-05, SU-06, SU-08, UI-01, UI-02, UI-03, UI-05 | Foundational layer — all other modules depend on these |
| **P2** | PM-05, PM-06, AM-02, AM-03, AM-04, AM-05, AM-06, AM-07, EM-02, SU-04, SU-07, UI-04 | Core feature completion — analytics + export unlocked |
| **P3** | PM-07, PM-08, AM-08, AM-09, EM-03, EM-04, EM-05, EM-06, UI-12, UI-13 | Secondary modules + compare + batch export |
| **P4** | AM-11, AM-12, AM-13, AM-16, EM-07, EM-08, UI-06, UI-07, UI-08, UI-09, UI-10 | Enhancements — annotations, fraud governance, case management |
| **P5** | AM-14, AM-15, UI-10, UI-11 | Advanced capabilities — graph visualization, NLP, SOC |

**Total modules mapped:** 48  
**P1 (must migrate first):** 17  
**P2 (core completion):** 12  
**P3 (secondary):** 10  
**P4 (enhancements):** 11  
**P5 (advanced):** 5 (–)  

---

*Generated by Claude Code (claude-sonnet-4-6) on 2026-05-31. No source files were modified.*
