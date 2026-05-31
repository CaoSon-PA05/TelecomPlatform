# EXCEL SCHEMA ANALYSIS — CDR SAMPLE FILES
**Files analyzed:** `Mau/File data mau/`
**Audit Date:** 2026-05-28
**Scope:** Schema detection only — no parser generated

---

## 1. FILES SUMMARY

| File | Phone Number | Prefix → Carrier | Records | Date Range |
|------|-------------|-----------------|---------|------------|
| `0_0382733506.xlsx` | 0382733506 | `038` → **Viettel** | 30 | 01/06/2025 – 03/12/2025 |
| `1_0969619929.xlsx` | 0969619929 | `096` → **Viettel** | 216 | 01/06/2025 – 03/12/2025 |

**Both files are the same carrier (Viettel) and the same CDR format.** Despite the different phone prefixes, both use the identical Excel structure. The filename prefix `0_` and `1_` appears to be an import sequence number, not a carrier indicator.

---

## 2. WORKBOOK STRUCTURE

Both files share the exact same workbook layout:

```
Workbook
└── Sheet2   (only sheet, named "Sheet2")
    ├── Row  0  : Report title (merged header)
    ├── Row  1  : Empty
    ├── Row  2  : Document reference number (Công văn)
    ├── Row  3  : Subscriber phone number (without leading 0)
    ├── Row  4  : Date range: Từ ngày / Đến ngày
    ├── Row  5  : Empty
    ├── Rows 6–18 : Subscriber PII block
    ├── Rows 19–20: Empty
    ├── Row 21  : Column headers
    └── Row 22+ : CDR data records
```

**Sheet name anomaly:** The sheet is named `Sheet2` (not `Sheet1`). The legacy parser's template1 hardcodes `startRow: 22` — this is correct for this format.

---

## 3. SECTION A: SUBSCRIBER INFO BLOCK (Rows 2–18)

### 3.1 Exact Cell Mapping

| Row Index | Col B (label) | Col C (value) | Sample File 0 | Sample File 1 |
|-----------|--------------|---------------|--------------|--------------|
| 2 | `Công văn` | Document # | `11220` | `11220` |
| 3 | `Số thuê bao` | Phone (no leading 0) | `382733506` | `969619929` |
| 4 | `Từ ngày` | Start date | `01/06/2025` | `01/06/2025` |
| 4 | `Đến ngày` (col D+E) | End date | `03/12/2025` | `03/12/2025` |
| 6 | `Họ Tên` | Full name | `NGUYỄN ANH TUẤN` | `NGUYỄN THANH TUYỀN` |
| 7 | `Số thuê bao` | Phone (no leading 0, duplicate) | `382733506` | `969619929` |
| 8 | `Ngày sinh` | Date of birth | `14/04/1984` | `28/08/1994` |
| 9 | `Địa chỉ` | Full address | (Hanoi address) | (Hai Duong address) |
| 10 | `Loại thuê bao` | Subscription type | `Trả trước` | `Trả sau` |
| 11 | `Loại giấy tờ` | ID document type | `CCCD` | `CCCD` |
| 12 | `Số giấy tờ` | ID number | `001084016075` | `030094017551` |
| 13 | `Ngày cấp` | ID issue date | `14/06/2016` | `29/03/2023` |
| 14 | `Nơi cấp` | ID issue authority | (full authority name) | `cục cs` |
| 15 | `Ngày kích hoạt` | SIM activation date | `15/07/2021` | `18/09/2024` |
| 16 | `Tình trạng thuê bao` | Status | `Hoạt động` | `Hoạt động` |
| 17 | `Ngày kết thúc` | End date | *(empty)* | *(empty)* |
| 18 | `Ghi chú` | Notes | *(empty)* | *(empty)* |

### 3.2 Key Observations

- **Phone number stored WITHOUT leading zero** at row 3 and row 7 (e.g. `382733506` not `0382733506`). Parser must prepend `0` when normalizing.
- **Phone number appears TWICE** (rows 3 and 7) — identical values, both usable.
- **ID type is always CCCD** (Căn cước công dân = Vietnamese national ID) in both samples.
- **Subscription type** differs: `Trả trước` (prepaid) vs `Trả sau` (postpaid).
- **Date format throughout header:** `DD/MM/YYYY` string (not Excel serial number).
- **Document number `11220`** is identical in both files — likely a batch request reference, not a subscriber-specific field. Do not use as a unique key.

---

## 4. SECTION B: CDR COLUMN SCHEMA (Row 21 Header + Row 22+ Data)

### 4.1 Column Header Row (Row Index 21, Excel Row 22)

| Col Index | Excel Col | Header Label | Field Name | Data Type |
|-----------|-----------|-------------|------------|-----------|
| 0 | A | `#` | row_number | Integer (sequential) |
| 1 | B | `Số đi` | source_number | String (phone or service name) |
| 2 | C | `Số đến` | target_number | String (phone) |
| 3 | D | `Thời gian` | timestamp | String `DD/MM/YYYY HH:mm:ss` |
| 4 | E | `Giây` | duration_seconds | String/Integer (empty for SMS) |
| 5 | F | `IMEI` | imei | String (15-digit, nullable) |
| 6 | G | `Mã tỉnh` | province_code | String (2-4 char code, nullable) |
| 7 | H | `TYPE` | comm_type | String enum: `VOICE` / `SMS` |
| 8 | I | `Direction` | service_direction | String enum (see below) |
| 9 | J | `Địa chỉ trạm BTS` | bts_address | String (full Vietnamese address, nullable) |
| 10 | K | `LAC` | lac | String/Integer (nullable) |
| 11 | L | `Số Cell` | cell_id | String/Integer (nullable) |

> **Note:** The legacy `script.js` template1 column map has `F=IMSI, G=IMEI`. The **actual files have no IMSI column** — `F=IMEI` and `G=Mã tỉnh`. The fuzzy column matcher in `buildColumnMap()` handles this discrepancy at runtime.

### 4.2 Confirmed Enum Values

**`TYPE` (column H):**
| Value | Meaning |
|-------|---------|
| `VOICE` | Voice call |
| `SMS` | Text message |

**`Direction` (column I):**
| Value | Meaning |
|-------|---------|
| `Nội mạng` | On-net (same Viettel network) |
| `Ngoại mạng` | Off-net (different carrier) |
| `Vas` | Value-added service (bank OTP, system SMS) |
| `Quốc tế` | International / App-originated message |

> `Quốc tế` (international) is used for app-triggered SMS (MyViettel, MBBANK) even when the destination is a local number. This appears to be a Viettel billing classification, not a geographic indicator.

### 4.3 Source Number Patterns

The `Số đi` field contains heterogeneous values:

| Pattern | Examples | Meaning |
|---------|---------|---------|
| 9-digit number | `382733506`, `969619929` | Subscriber's own number (outgoing call) |
| 9–10 digit number | `363292601`, `369565587` | Other subscriber (incoming shows them as source) |
| Short code | `211`, `1498`, `6167` | Carrier service codes |
| Service name | `MBBANK`, `BIDV`, `Apple`, `F88` | VAS/bank SMS senders |
| App name | `MyViettel`, `VIETTEL 4G`, `VIETTEL 5G` | Carrier app notifications |
| Financial service | `NAPTHE VT`, `VTMONEY`, `MBV` | Mobile payment services |

**Subscriber direction rule:**
- If `Số đi` matches subscriber phone → **outgoing**
- If `Số đến` matches subscriber phone → **incoming** (Số đi = the caller/sender)

---

## 5. CELL / LAC COLUMNS (Columns K and L)

### 5.1 LAC (Location Area Code) — Column K

| File | LAC Values Observed | Notes |
|------|-------------------|-------|
| 0382733506 | `20665`, `27034` | Only 2 distinct LACs across 30 records |
| 0969619929 | `20665`, `25133`, `25187`, `27034` | 4 distinct LACs across 216 records |

- **Data type:** Stored as string or integer (inconsistent across cells)
- **Range:** 5-digit integer (e.g. `20665`, `27034`)
- **LAC `20665` appears in both files** → both subscribers were in the same general area (Bến Cầu, Tây Ninh at some point)
- **Nullable:** Yes — recent records (near file end) have empty LAC when BTS address is also empty

### 5.2 Cell ID — Column L

| File | Cell ID Samples | Notes |
|------|----------------|-------|
| 0382733506 | `51054`, `50320`, `51056`, `7884807` | Mix of 5-digit and 7-digit IDs |
| 0969619929 | `54964`, `30408`, `30399`, `11761`, `52122`, `13162` | All 5-digit in early records |

- **Data type:** String or integer (inconsistent)
- **Cell ID `7884807`** in file 0 is anomalously large (7 digits) — likely a different encoding or antenna sector suffix
- **Nullable:** Yes — same null pattern as LAC (both null together)
- **LAC + Cell together** form the unique tower identifier: `LAC-CellID`

### 5.3 BTS Address (Column J)

Full Vietnamese street address format:
```
{house_number}, {hamlet/area}, {commune/ward}, {district}, {province}
```
Example: `Số 46, ấp Rừng Dầu, Xã Tiên Thuận, Huyện Bến Cầu, Tỉnh Tây Ninh`

- Address is nullable — disappears when LAC/Cell are null
- Address contains the **physical location of the tower**, not the subscriber
- Province always ends with `Tỉnh {province_name}` — extractable via regex

---

## 6. SUBSCRIBER IDENTIFIERS

### 6.1 Primary Subscriber Keys

| Identifier | Location | File 0 | File 1 | Notes |
|-----------|----------|--------|--------|-------|
| Phone (with 0) | Filename | `0382733506` | `0969619929` | Most reliable key |
| Phone (no 0) | Row 3 Col C | `382733506` | `969619929` | Must normalize |
| Phone (no 0) | Row 7 Col C | `382733506` | `969619929` | Duplicate |
| CCCD (ID) | Row 12 Col C | `001084016075` | `030094017551` | National ID |
| Full name | Row 6 Col C | `NGUYỄN ANH TUẤN` | `NGUYỄN THANH TUYỀN` | |
| DOB | Row 8 Col C | `14/04/1984` | `28/08/1994` | |

### 6.2 Device Identifiers (IMEI)

| File | IMEI Values | Count | Observation |
|------|------------|-------|-------------|
| 0382733506 | `353094102881660` | 1 | Single device throughout entire period |
| 0969619929 | `355832089714530` | 1 (early records) | First device |
| 0969619929 | `356726081105280` | 1 (later records) | **Device swap detected** |

- **IMEI validation:** All 15-digit — passes Luhn format check
- **IMEI is empty** for records from service senders (MBBANK, MyViettel etc.) — these SMS have no device context
- **File 1 device swap:** The IMEI change from `355832089714530` → `356726081105280` is a forensic event — subscriber changed physical device during the observation period

---

## 7. DATE / TIME STRUCTURES

### 7.1 Timestamp Format (Column D)

**Format: `DD/MM/YYYY HH:mm:ss`**

```
Examples:
  "11/07/2025 17:12:47"
  "18/09/2025 18:45:06"
  "25/11/2025 15:28:37"
```

- **Stored as string** in both files (not Excel date serial number)
- **No timezone marker** — assumed UTC+7 (Vietnam time)
- **Seconds always present** — full datetime precision
- **Chronological order:** Records appear to be in chronological order within each file

### 7.2 Date Range Fields (Row 4)

- `Từ ngày` (from date): `DD/MM/YYYY` string in Col C
- `Đến ngày` (to date): `DD/MM/YYYY` string in Col E

### 7.3 PII Date Fields (Rows 8, 13, 15)

All use `DD/MM/YYYY` string format:
- `Ngày sinh` (DOB): `14/04/1984`, `28/08/1994`
- `Ngày cấp` (ID issue): `14/06/2016`, `29/03/2023`
- `Ngày kích hoạt` (activation): `15/07/2021`, `18/09/2024`

### 7.4 Duration Field (Column E)

- **Present only for VOICE records** — integer seconds as string
- **Empty string or None for SMS** — not zero, not null-typed, just missing
- Sample voice durations: `57`, `61`, `2`, `19`, `15`, `52`, `53` (all short calls)
- Parser must treat empty string = 0 duration, not an error

---

## 8. COMMUNICATION FREQUENCY FIELDS

### 8.1 Record Counts

| Metric | File 0 (038) | File 1 (096) |
|--------|-------------|-------------|
| Total records | 30 | 216 |
| VOICE records | 3 (10%) | 18 (8.3%) |
| SMS records | 27 (90%) | 198 (91.7%) |
| On-net (Nội mạng) | 2 | 9 |
| Off-net (Ngoại mạng) | 0 | 28 |
| VAS (Vas) | 14 | 120 |
| International/App (Quốc tế) | 13 | 46 |

### 8.2 Contact Frequency Pattern (File 1 sample)

Top contact numbers visible in data:
- `369565587` → appears as both source and destination (mutual contact)
- `966965589` → appears once
- `779603646` → appears 3× at end of file (bulk SMS)
- `MBBANK` → 11+ records (bank notification SMS)
- `MyViettel` → 4+ records (carrier app)

### 8.3 Null Data Patterns

| Field | Null condition | Impact on analysis |
|-------|---------------|-------------------|
| `Giây` (duration) | Always null for SMS | Expected — skip for SMS |
| `IMEI` | Null for service SMS senders | Expected — no device context |
| `Mã tỉnh` | Null for recent records | BTS data missing — location analysis degraded |
| `LAC` + `Số Cell` | Null together | Both null or both present — treat as pair |
| `Địa chỉ trạm BTS` | Null with LAC/Cell | No address when no tower data |

---

## 9. DIFFERENCES FROM LEGACY PARSER ASSUMPTIONS

| Assumption in `script.js` | Actual File Behavior |
|--------------------------|---------------------|
| Template1: col F = IMSI, col G = IMEI | Actual: col F = IMEI, no IMSI column present |
| Template1: subscriber phone at cell C8 | Actual: row index 7, col C = row 8 in Excel (1-indexed) — matches C8 ✓ |
| Template1: startRow = 22 | Actual: data starts at Excel row 23 (index 22) ✓ |
| Phone number formatted with leading 0 | Actual: stored WITHOUT leading 0 — parser adds it |
| IMSI column available | Not present in these samples — may be carrier-specific |
| Province code consistent | Actual: same province uses BOTH `TNH` and `T066` in same file |
| Timestamp is Excel serial number | Actual: stored as string `DD/MM/YYYY HH:mm:ss` |

---

## 10. SCHEMA CANONICAL FORM

Proposed normalized record schema for the Python backend:

```python
# Subscriber info
{
    "phone_number":     "0969619929",     # normalized with leading 0
    "name":             "NGUYỄN THANH TUYỀN",
    "dob":              "1994-08-28",      # ISO 8601
    "address":          "...",
    "id_type":          "CCCD",
    "id_number":        "030094017551",
    "id_issue_date":    "2023-03-29",
    "activation_date":  "2024-09-18",
    "subscription_type": "postpaid",       # Trả sau → postpaid, Trả trước → prepaid
    "status":           "active",
    "report_from":      "2025-06-01",
    "report_to":        "2025-12-03",
    "document_ref":     "11220"
}

# CDR record
{
    "row_number":       1,
    "source_number":    "MyViettel",      # raw value — may be service name
    "target_number":    "969619929",
    "owner_number":     "0969619929",     # resolved subscriber (normalized)
    "contact_number":   None,             # resolved contact (service senders → None)
    "direction":        "incoming",       # outgoing / incoming / service
    "timestamp":        "2025-06-15T00:18:03+07:00",  # ISO 8601 with TZ
    "duration_seconds": None,             # None for SMS, integer for VOICE
    "imei":             "355832089714530",
    "province_code":    "T066",
    "comm_type":        "SMS",            # VOICE / SMS
    "service_direction": "Quốc tế",      # raw Direction value
    "bts_address":      "Số 1835, ấp Ngã Tắc, Xã Long Thuận...",
    "lac":              20665,
    "cell_id":          54964,
    "location_key":     "20665-54964"     # composite tower key
}
```

---

## 11. PARSER REQUIREMENTS IDENTIFIED

Based on actual file inspection:

1. **Phone normalization:** Prepend `0` to 9-digit numbers (strip `84` country prefix if present)
2. **Date parsing:** `DD/MM/YYYY HH:mm:ss` → `datetime` — NOT Excel serial number
3. **Duration:** Empty string → `None`, not `0` (distinguish no-call from zero-second call)
4. **IMEI column:** Column F (index 5) — no IMSI in these samples
5. **Province code inconsistency:** `TNH` and `T066` both mean Tây Ninh — needs lookup table
6. **LAC/Cell null handling:** Treat as pair — both null or both present
7. **Service sender detection:** Non-numeric `Số đi` values are service names, not contacts
8. **Direction field has NO direct inbound/outbound flag** — must infer from whether subscriber phone appears in `Số đi` or `Số đến`
9. **Document ref `Công văn` shared** across files — batch identifier, not subscriber key
10. **Both files identical format** — one parser handles both; no need for separate Mobifone template for these specific samples
