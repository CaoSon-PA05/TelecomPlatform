# 🗄️ TELECOM SCHEMA ANALYSIS
**System:** Sentinel Platform — CDR Module  
**Document Purpose:** Detailed analysis of Vietnamese telecom Excel formats and inferred normalized schema

---

## 1. EXCEL TEMPLATE ANALYSIS

### 1.1 File Naming Convention
Sample files follow the pattern: `{index}_{phone_number}.xlsx`

| File | Phone Number | Provider (Inferred) |
|------|-------------|---------------------|
| `0_0382733506.xlsx` | 0382-733-506 | Likely Viettel (03xx prefix) |
| `1_0969619929.xlsx` | 0969-619-929 | Likely Viettel (09xx prefix) |

Both numbers follow Vietnamese mobile formatting. The `03xx` and `09xx` prefixes are registered to Viettel.

---

## 2. THREE CONFIRMED PROVIDER FORMATS

Based on deep reverse-engineering of the legacy `script.js` template mappings (lines 58-144):

### 2.1 Template 1 — VIETTEL (Primary Format)

**Detection Signature:** First row text contains `"BÁO CÁO CHI TIẾT LỊCH SỬ LIÊN LẠC"`

**Subscriber Info Block (Rows 0–20, fixed cells):**

| Excel Cell | Field | Notes |
|-----------|-------|-------|
| C5 | `startDate` | Report start date |
| E5 | `endDate` | Report end date |
| C7 | `name` | Full name (Họ Tên) |
| C8 | `phoneNumber` | Subscriber phone number |
| C9 | `birthDate` | Date of birth |
| C10 | `address` | Residential address |
| C13 | `idNumber` | CCCD / Passport number |
| C14 | `idIssueDate` | ID issue date |
| C16 | `activationDate` | SIM activation date |

**CDR Data Block (Starting from Row 22):**

| Excel Column | Field | Data Type | Notes |
|-------------|-------|-----------|-------|
| A | (index) | Integer | Row number |
| B | `sourceNumber` | String | Số đi — Calling number |
| C | `targetNumber` | String | Số đến — Called number |
| D | `timestamp` | DateTime | Format: `dd/mm/yyyy hh:mm:ss` |
| E | `duration` | Integer | Duration in seconds (0 for SMS) |
| F | `imsi` | String | IMSI identifier |
| G | `imei` | String | 15-digit device IMEI |
| H | `provinceCode` | String | Province code (e.g. G059) |
| I | `callType` | Enum | TYPE: `VOICE` / `SMS` |
| J | `serviceType` | String | Direction/service type |
| K | `location` | String | BTS station address |
| L | `lac` | Integer | Location Area Code |
| M | `cell` | Integer | Cell Identifier |

---

### 2.2 Template 2 — VINAPHONE (a_subs/b_subs Format)

**Detection Signature:** Column headers contain `a_subs` and `b_subs` keywords

**Subscriber Info Block:** Not embedded in file header (extracted via separate lookup)

**CDR Data Block (Starting from Row 1):**

| Excel Column | Field | Data Type | Notes |
|-------------|-------|-----------|-------|
| A | `sourceNumber` | String | a_subs — A-party (calling) |
| B | `imsi` | String | IMSI of subscriber |
| C | `imei` | String | Device IMEI |
| D | `date` | Date | Call date |
| E | `time` | Time | Call time (separate from date!) |
| F | `duration` | Integer | Duration in seconds |
| G | `targetNumber` | String | b_subs — B-party (called) |
| H | `callType` | String | Call type |
| I | `provinceCode` | String | Province code |
| J | `serviceType` | String | Service type |
| N | `lac` | Integer | LAC code |
| O | `cell` | Integer | Cell ID |
| P | `location` | String | BTS station location |

> **Key difference from Viettel:** Date and Time are in **separate columns** (D and E), not a combined datetime.

---

### 2.3 Template 3 — MOBIFONE (STT/Combined LAC Format)

**Detection Signature:** LAC and Cell ID appear in a **single merged column** (e.g. `31133-43691`) or STT header format

**Subscriber Info Block:** Not embedded (minimal header)

**CDR Data Block (Dynamic start row):**

| Excel Column | Field | Data Type | Notes |
|-------------|-------|-----------|-------|
| B | `timestamp` | DateTime | Full timestamp |
| C | `callType` | String | Call direction |
| D | `sourceNumber` | String | Source/calling number |
| E | `targetNumber` | String | Target/called number |
| F | `duration` | Integer | Duration in seconds |
| G | `lac_cell_combined` | String | **Combined LAC-Cell** (e.g. `31133-43691`) |
| H | `location` | String | BTS address |
| I | `imei` | String | Device IMEI |

> **Key difference:** The `G` column contains both LAC and Cell ID merged. The parser must split using regex: `^(\d+)[\-\/\\\_](\d+)$`

---

## 3. NORMALIZED DATA SCHEMA

After parsing all three provider formats, all data must be normalized to this **universal CDR schema**:

### 3.1 `subscribers` Table

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `id` | INT PK | Auto | |
| `phone_number` | VARCHAR(50) | Parsed / filename | AES-256 encrypted |
| `phone_hash` | VARCHAR(64) | Derived | SHA-256 for indexed search |
| `full_name` | VARCHAR(255) | Template1 C7 | AES-256 encrypted |
| `birth_date` | DATE | Template1 C9 | |
| `address` | TEXT | Template1 C10 | AES-256 encrypted |
| `id_number` | VARCHAR(50) | Template1 C13 | CCCD number |
| `id_issue_date` | DATE | Template1 C14 | |
| `activation_date` | DATE | Template1 C16 | |
| `status` | VARCHAR(20) | Default 'Active' | |
| `provider` | VARCHAR(20) | Detected | VIETTEL / VINAPHONE / MOBIFONE |
| `report_start` | DATE | Template1 C5 | Report period |
| `report_end` | DATE | Template1 E5 | |
| `created_at` | TIMESTAMP | System | |

### 3.2 `call_records` Table

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `id` | INT PK | Auto | |
| `subscriber_id` | INT FK | | → subscribers.id |
| `source_number` | VARCHAR(50) | Column B/A | Normalized 10-digit format |
| `target_number` | VARCHAR(50) | Column C/G | Normalized 10-digit format |
| `contact_number` | VARCHAR(50) | Derived | The "other party" (non-subscriber number) |
| `timestamp` | TIMESTAMP | Column D/B | UTC+7 standardized |
| `duration_seconds` | INT | Column E/F | 0 for SMS |
| `call_type` | VARCHAR(10) | Column I/C/H | VOICE / SMS |
| `direction` | VARCHAR(20) | Column J | INBOUND / OUTBOUND / VAS |
| `imei` | VARCHAR(20) | Column G/C/I | 15-digit string |
| `imsi` | VARCHAR(20) | Column F/B | Optional |
| `province_code` | VARCHAR(20) | Column H/I | |
| `tower_id` | INT FK | Resolved | → towers.id (may be NULL) |
| `lac_raw` | INT | Column L/N/G | Raw LAC value |
| `cell_raw` | INT | Column M/O/G | Raw Cell ID |
| `created_at` | TIMESTAMP | System | |

### 3.3 `towers` Table

| Field | Type | Notes |
|-------|------|-------|
| `id` | INT PK | |
| `lac_id` | INT | Location Area Code |
| `cell_id` | INT | Cell Identifier |
| `station_name` | VARCHAR(255) | BTS address/name |
| `province_code` | VARCHAR(20) | |
| `latitude` | REAL | GPS — may be NULL until mapped |
| `longitude` | REAL | GPS — may be NULL until mapped |
| `address_detail` | TEXT | |
| `provider` | VARCHAR(20) | Which provider's tower |
| `updated_at` | TIMESTAMP | |

**UNIQUE constraint:** `(lac_id, cell_id)`

### 3.4 `imei_logs` Table

| Field | Type | Notes |
|-------|------|-------|
| `id` | INT PK | |
| `subscriber_id` | INT FK | |
| `imei` | VARCHAR(20) | |
| `first_seen` | TIMESTAMP | |
| `last_seen` | TIMESTAMP | |
| `usage_count` | INT | Number of CDR records with this IMEI |

**UNIQUE constraint:** `(subscriber_id, imei)`

---

## 4. NORMALIZATION RULES

### 4.1 Phone Number Normalization
```python
import re

def normalize_phone(raw: str) -> str:
    """Normalize Vietnamese mobile phone numbers to 10-digit format."""
    if not raw or not isinstance(raw, str):
        return raw
    
    # Remove whitespace, dashes, parentheses, plus signs
    cleaned = re.sub(r'[\s\-\(\)\+]', '', str(raw).strip())
    
    # Handle country code prefix 84 (Vietnam)
    if cleaned.startswith('84') and len(cleaned) in (11, 12):
        cleaned = '0' + cleaned[2:]
    
    # Handle 9-digit numbers (missing leading 0)
    if len(cleaned) == 9 and cleaned[0] in '3456789':
        cleaned = '0' + cleaned
    
    # Handle service/VAS numbers — keep as-is
    if len(cleaned) < 8 or not cleaned.isdigit():
        return raw  # Keep original for brandnames, short codes
    
    return cleaned
```

### 4.2 DateTime Normalization
```python
from datetime import datetime
import pandas as pd

DATETIME_FORMATS = [
    '%d/%m/%Y %H:%M:%S',   # Vietnamese standard: 01/06/2025 05:57:45
    '%Y-%m-%d %H:%M:%S',   # ISO 8601
    '%d-%m-%Y %H:%M:%S',   # Dash variant
    '%d/%m/%Y',            # Date only
    '%Y-%m-%d',            # ISO date only
]

def normalize_datetime(raw) -> datetime | None:
    """Parse various datetime formats to Python datetime."""
    if pd.isna(raw) or raw is None:
        return None
    
    # Excel serial number (float)
    if isinstance(raw, (int, float)):
        return pd.Timestamp('1899-12-30') + pd.Timedelta(days=raw)
    
    raw_str = str(raw).strip()
    for fmt in DATETIME_FORMATS:
        try:
            return datetime.strptime(raw_str, fmt)
        except ValueError:
            continue
    return None
```

### 4.3 LAC/Cell Extraction
```python
def extract_lac_cell(raw_value: str | int, column_type: str = 'separate') -> tuple[int | None, int | None]:
    """
    Extract LAC and Cell ID from raw column value.
    
    For 'separate' type: raw_value is either LAC or Cell (call twice with correct raw)
    For 'combined' type: raw_value is like '31133-43691'
    """
    if column_type == 'combined' and isinstance(raw_value, str):
        match = re.match(r'^(\d+)[\-\/\\\_](\d+)$', raw_value.strip())
        if match:
            return int(match.group(1)), int(match.group(2))
        return None, None
    
    # Separate column
    try:
        val = str(raw_value).strip()
        if val and val not in ('nan', 'None', ''):
            return int(float(val)), None
    except (ValueError, TypeError):
        pass
    return None, None
```

---

## 5. KEY FIELD ANALYSIS SUMMARY

| Field | Viettel Col | Vinaphone Col | Mobifone Col | Criticality |
|-------|------------|---------------|-------------|-------------|
| Calling Number | B | A (a_subs) | D | 🔴 Essential |
| Called Number | C | G (b_subs) | E | 🔴 Essential |
| Timestamp | D | D+E (merged) | B | 🔴 Essential |
| Duration (s) | E | F | F | 🟡 Important |
| IMEI | G | C | I | 🟡 Important |
| LAC | L | N | G (combined) | 🟡 Important |
| Cell ID | M | O | G (combined) | 🟡 Important |
| BTS Station | K | P | H | 🟡 Important |
| Province Code | H | I | — | 🟢 Optional |
| IMSI | F | B | — | 🟢 Optional |
| Call Type | I | H | C | 🟡 Important |
