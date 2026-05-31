"""
Shared constants for the telecom_analysis module.
All carrier-specific knowledge lives here — one place to update.
"""

# ---------------------------------------------------------------------------
# Carrier phone prefix tables (Vietnamese mobile)
# ---------------------------------------------------------------------------

VIETTEL_PREFIXES: list[str] = [
    "032", "033", "034", "035", "036", "037", "038", "039",
    "086", "096", "097", "098",
]

VINA_PREFIXES: list[str] = [
    "081", "082", "083", "084", "085", "088", "091", "094",
]

MOBI_PREFIXES: list[str] = [
    "070", "076", "077", "078", "079", "089", "090", "093",
]

# ---------------------------------------------------------------------------
# Province code normalisation map
# Real CDR data uses inconsistent codes for the same province.
# ---------------------------------------------------------------------------

PROVINCE_CODE_MAP: dict[str, str] = {
    "TNH":  "Tay Ninh",
    "T066": "Tay Ninh",
    "HCM":  "Ho Chi Minh City",
    "HN":   "Ha Noi",
    "DN":   "Da Nang",
    "BD":   "Binh Duong",
    "LA":   "Long An",
    # Extend as new province codes appear in imported files
}

# ---------------------------------------------------------------------------
# CDR direction / service classification
# ---------------------------------------------------------------------------

SERVICE_DIRECTION_MAP: dict[str, str] = {
    "Nội mạng":   "onnet",
    "Ngoai mang": "offnet",
    "Ngoại mạng": "offnet",
    "Vas":         "vas",
    "Quoc te":     "international",
    "Quốc tế":    "international",
}

# ---------------------------------------------------------------------------
# IMEI validation
# ---------------------------------------------------------------------------

IMEI_LENGTH = 15

# ---------------------------------------------------------------------------
# Excel parsing
# ---------------------------------------------------------------------------

CDR_SHEET_NAME = "Sheet2"    # Actual sheet name in real Viettel CDR files
SUBSCRIBER_HEADER_END_ROW = 19   # Rows 0–18 contain PII; row 21 = column headers
DATA_START_ROW = 22              # First data row (0-indexed: row 21)

# Header scoring keywords used by column detection
COLUMN_KEYWORDS: dict[str, list[str]] = {
    "source_number":      ["số đi", "so di", "a_subs", "a-subs", "calling", "source", "msisdn a"],
    "target_number":      ["số đến", "so den", "b_subs", "b-subs", "called", "destination", "msisdn b"],
    "timestamp":          ["thời gian", "thoi gian", "ngày giờ", "start time", "datetime", "date time"],
    "duration_seconds":   ["giây", "giay", "seconds", "duration", "thời lượng"],
    "imei":               ["imei"],
    "province_code":      ["mã tỉnh", "ma tinh", "province", "tinh"],
    "comm_type":          ["type", "loại", "loai"],
    "service_direction":  ["direction", "hướng", "huong"],
    "bts_address":        ["địa chỉ trạm", "dia chi tram", "bts", "station", "address"],
    "lac":                ["lac", "location area"],
    "cell_id":            ["số cell", "so cell", "cell id", "cell", "cid"],
}
