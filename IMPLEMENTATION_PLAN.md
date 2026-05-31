# IMPLEMENTATION PLAN — Multi-Carrier Batch CDR System
> Version: 1.0 | Date: 2026-05-30 | Project: TelecomPlatform (C:\...)

---

## 0. CURRENT STATE ANALYSIS

### Carriers hỗ trợ hiện tại
| Carrier | Code | Template key | Parser function |
|---------|------|-------------|-----------------|
| Viettel | VTL | `viettel` | `parseViettel()` |
| Mobiphone | MBF | `mobiphone` | `parseMobiphone()` |
| Vinaphone | VNP | `vinaphone` | `parseVinaphone()` |

### Giới hạn hiện tại
- **Không có**: Vietnamobile, Gmobile
- **Không có**: phiên bản (V1/V2/V3) — chỉ 1 parser/nhà mạng
- **detectCarrier()** trả về string (chưa có confidence, version, matchedRules)
- **parseWorkbook()** dùng `switch` cứng — không mở rộng được
- **_S** là singleton — chỉ xử lý 1 file tại 1 thời điểm
- **cdr-file-input** chỉ nhận 1 file, không có multi/folder
- **Không có**: Batch export, Summary.xlsx, queue, progress

---

## 1. FILE CHANGES SUMMARY

### Files được phép sửa (cần xác nhận với user về index.html)
| File | Loại thay đổi | Phases |
|------|--------------|--------|
| `cell-lac-parser.js` | Mở rộng lớn | 1, 2, 3, 10 |
| `cdr-analyzer.js` | Refactor lớn | 4, 5, 6, 7, 8, 9, 10 |
| `index.html` | Thêm UI mới | 4, 6 |

### Files mới cần tạo
| File | Mục đích | Phase |
|------|---------|-------|
| `batch-processor.js` | Queue, progress, batch export | 4, 7, 8, 9 |
| `batch-ui.js` | Tab UI Batch Processing | 6 |

> **Nguyên tắc thiết kế**: Mọi tính năng batch là **additive only** — không sửa logic đang chạy của CDR single-file mode, GTP, FLA.

---

## 2. PHASE 1 — AUTO DETECT CARRIER (Enhanced)

### Thay đổi trong `cell-lac-parser.js`

#### 2.1 Thêm TEMPLATES cho Vietnamobile và Gmobile

```
TEMPLATES.vietnamobile = {
    name: 'Vietnamobile VNM',
    code: 'VNM',
    signatures: {
        keywords: ['vietnamobile', 'vietnam mobile', 'gmobile là công ty'],
        sheetNames: ['sheet1', 'data'],
    },
    aliases: { ... }
}

TEMPLATES.gmobile = {
    name: 'Gmobile GMB',
    code: 'GMB',
    signatures: {
        keywords: ['gmobile', 'g-mobile', 'indochina telecom', 'gtell'],
        sheetNames: ['sheet1'],
    },
    aliases: { ... }
}
```

#### 2.2 Nâng cấp `detectCarrier(workbook)` → trả về enriched object

**Function hiện tại:** `detectCarrier(workbook)` → string

**Function mới:** `detectCarrier(workbook)` → `{carrier, confidence, version, matchedRules}`

```
OLD return: 'viettel'
NEW return: {
    carrier:      'viettel',
    confidence:   0.92,          // 0.0–1.0
    version:      'V2',          // null nếu chưa detect
    matchedRules: [
        'sheet_name:sheet2',
        'keyword:bao_cao_chi_tiet',
        'keyword:so_cell',
        'keyword:lac'
    ]
}
```

**Detection priority (theo yêu cầu):**
1. Sheet names → +6 per match
2. Content keywords (25 rows đầu) → +2 per keyword
3. Column names (header row) → +3 per match (MỚI)
4. Metadata/file properties → +1 (MỚI)
5. First data row patterns → +1 (MỚI)

**Backward compatibility:** `parseFile()` hiện dùng `detectCarrier(workbook)` và expect string. Cần cập nhật để xử lý cả object mới và string cũ.

#### 2.3 Thêm detection rules chi tiết

```
CARRIER_SIGNATURES = {
    viettel: {
        required: ['số đi', 'số đến', 'lac', 'số cell'],
        strong:   ['bản kê chi tiết', 'tập đoàn viễn thông quân đội', 'cell id'],
        weak:     ['viettel', 'vtl'],
        sheetNames: ['sheet2'],
    },
    vinaphone: {
        required: ['a_subs', 'b_subs'],
        strong:   ['vnpt', 'vinaphone', 'bảng kê chi tiết cuộc gọi', 'lac', 'cellid'],
        weak:     ['vinaphone'],
        sheetNames: ['sheet1'],
    },
    mobiphone: {
        required: ['số thứ tự', 'số chủ', 'mã địa danh'],
        strong:   ['mobifone', 'trung tâm mobifone', 'báo cáo chi tiết dữ liệu online'],
        weak:     ['mobi'],
        sheetNames: ['sheet 1', 'sheet1'],
    },
    vietnamobile: {
        required: [],
        strong:   ['vietnamobile', 'vietnam mobile'],
        weak:     ['vnm', 'viet nam mobile'],
        sheetNames: ['sheet1', 'data'],
    },
    gmobile: {
        required: [],
        strong:   ['gmobile', 'g-mobile', 'indochina telecom'],
        weak:     ['gmb', 'g mobile'],
        sheetNames: ['sheet1'],
    },
}
```

**Scoring:**
- required column match: +10
- strong keyword: +5
- sheet name match: +6
- weak keyword: +2
- Confidence = score / max_possible_score

---

## 3. PHASE 2 — FORMAT DETECTOR

### New function: `detectFormat(workbook)`

**Mục đích:** Phân biệt các phiên bản file của cùng nhà mạng.

**Ví dụ:** Viettel có ít nhất 2 phiên bản:
- V1: header tại row 22, có PII block cố định
- V2: header tại row khác, có thêm IMSI column

```javascript
function detectFormat(workbook) {
    const carrierResult = detectCarrier(workbook);
    const carrier = typeof carrierResult === 'object'
        ? carrierResult.carrier
        : carrierResult;

    // Version detection per carrier
    const version = _detectVersion(workbook, carrier);

    return {
        carrier,
        format: `${carrier}_${version}`,   // e.g. 'viettel_V2'
        confidence: carrierResult.confidence || 0.8,
        version,
    };
}

function _detectVersion(workbook, carrier) {
    // Per-carrier version rules
    if (carrier === 'viettel') {
        // V1: sheet2, fixed header row 22, no IMSI
        // V2: sheet2, dynamic header, has IMSI
        // V3: sheet có thêm cột mới (4G/5G fields)
        return _detectViettelVersion(workbook);
    }
    if (carrier === 'vinaphone') {
        return _detectVinaVersion(workbook);
    }
    // Default
    return 'V1';
}
```

### Format Registry (for PHASE 3)
```
FORMAT_REGISTRY = {
    'viettel_V1':       { headerRow: 21, hasIMSI: false },
    'viettel_V2':       { headerRow: 'dynamic', hasIMSI: true },
    'mobiphone_V1':     { headerRow: 17, piiBlock: true },
    'vinaphone_V1':     { headerRow: 0, multiSubscriber: true },
    'vietnamobile_V1':  { headerRow: 'auto' },
    'gmobile_V1':       { headerRow: 'auto' },
}
```

---

## 4. PHASE 3 — PARSER REGISTRY

### Thay `switch` trong `parseWorkbook()` → Registry

**Hiện tại:**
```javascript
switch (carrierKey) {
    case 'viettel':   parseResult = parseViettel(rows, template);   break;
    case 'mobiphone': parseResult = parseMobiphone(rows, template);  break;
    case 'vinaphone': parseResult = parseVinaphone(rows, template);  break;
    default: throw new Error(`Unknown carrier: ${carrierKey}`);
}
```

**Mới:**
```javascript
const PARSER_REGISTRY = {
    'viettel_V1':       (rows, tmpl) => parseViettel(rows, tmpl),
    'viettel_V2':       (rows, tmpl) => parseViettelV2(rows, tmpl),
    'mobiphone_V1':     (rows, tmpl) => parseMobiphone(rows, tmpl),
    'vinaphone_V1':     (rows, tmpl) => parseVinaphone(rows, tmpl),
    'vietnamobile_V1':  (rows, tmpl) => parseVietnamobile(rows, tmpl),
    'gmobile_V1':       (rows, tmpl) => parseGmobile(rows, tmpl),
};

// parseWorkbook() sử dụng registry:
const parserKey = `${carrier}_${version}`;
const parser = PARSER_REGISTRY[parserKey]
            || PARSER_REGISTRY[`${carrier}_V1`]
            || PARSER_REGISTRY[carrier];
if (!parser) throw new Error(`No parser for: ${parserKey}`);
parseResult = parser(rows, template);
```

### Workflow mới:
```
upload file
    ↓
parseFile(file, 'auto')
    ↓
detectCarrier(workbook)     → { carrier, confidence, version, matchedRules }
    ↓
detectFormat(workbook)      → { carrier, format, confidence, version }
    ↓
PARSER_REGISTRY[format]     → parserFn
    ↓
parserFn(rows, template)    → ParseResult
    ↓
resolve(enriched ParseResult)
```

### Public API mới cho `parseFile()`:
```javascript
// result sẽ có thêm:
result.format         = 'viettel_V2';
result.detection      = { confidence, matchedRules };
result.auto_detected  = true;
```

---

## 5. PHASE 4 — BATCH IMPORT

### Thay đổi trong `cdr-analyzer.js`

#### 5.1 Thay `_bindUpload()` để hỗ trợ multi-file

**Hiện tại:** single file input

**Mới:**
```javascript
// input type="file" multiple + webkitdirectory toggle
<input type="file" id="cdr-file-input"
    accept=".xlsx,.xls"
    multiple
    style="display:none;">

// Thêm nút "Chọn folder"
<input type="file" id="cdr-folder-input"
    accept=".xlsx,.xls"
    webkitdirectory
    style="display:none;">
```

#### 5.2 Dropzone nhận nhiều file
```javascript
dz.addEventListener('drop', e => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files)
        .filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
    if (files.length === 1) {
        _processUpload(files[0]);   // single mode — backward compat
    } else {
        BatchProcessor.addFiles(files);   // batch mode
    }
});
```

#### 5.3 Hàm thêm vào `batch-processor.js`
```javascript
// batch-processor.js
const BatchProcessor = (() => {
    const _queue = [];         // pending files
    const _sessions = new Map(); // sessionId → AnalysisSession
    let _processing = false;

    function addFiles(files) { ... }
    function processQueue() { ... }
    async function processFile(file) { ... }
    function getSession(sessionId) { ... }
    function getAllSessions() { ... }
    function clearAll() { ... }
    function exportAll() { ... }   // Phase 7

    return { addFiles, processQueue, processFile,
             getSession, getAllSessions, clearAll, exportAll };
})();
```

---

## 6. PHASE 5 — MULTI SESSION ARCHITECTURE

### Thay đổi trong `cdr-analyzer.js`

#### 6.1 State architecture mới

**Hiện tại:**
```javascript
let _S = { parseResult, records, subscriber, imeiData, contactsData, locationData, ... };
```

**Mới — AnalysisSession:**
```javascript
// Data model
class AnalysisSession {
    constructor(sessionId, file, parseResult) {
        this.sessionId    = sessionId;         // UUID
        this.fileName     = file.name;
        this.carrier      = parseResult.carrier;
        this.carrierName  = parseResult.carrier_name;
        this.format       = parseResult.format;
        this.subscriber   = null;
        this.records      = [];
        this.contactsData = {};
        this.imeiData     = {};
        this.locationData = {};
        this.status       = 'pending';         // pending|processing|done|error
        this.error        = null;
        this.createdAt    = new Date();
    }
}

// Session store
const _sessions  = new Map();   // Map<sessionId, AnalysisSession>
let _activeId    = null;        // session hiện đang xem
```

#### 6.2 Single-file mode vẫn dùng `_S`
**Backward compatibility:** `_S` vẫn tồn tại. Khi import single file qua dropzone, `_S` được cập nhật như cũ → CDR Analyzer tabs hiển thị bình thường.

Khi import batch, sessions được tạo trong `_sessions Map` → BatchUI hiển thị danh sách sessions.

#### 6.3 Activate session
```javascript
function activateSession(sessionId) {
    const s = _sessions.get(sessionId);
    if (!s) return;
    _activeId = sessionId;

    // Copy session data into _S for CDR Analyzer tabs
    _S.parseResult   = s.parseResult;
    _S.records       = s.records;
    _S.subscriber    = s.subscriber;
    _S.imeiData      = s.imeiData;
    _S.contactsData  = s.contactsData;
    _S.locationData  = s.locationData;

    _showData();
    _renderTab(_S.currentTab);
}
```

---

## 7. PHASE 6 — UI UPGRADE (Batch Processing Tab)

### Thay đổi trong `index.html` và `batch-ui.js`

#### 7.1 Thêm tab "Batch" vào CDR tab bar
```html
<!-- Thêm vào cdr-tab-bar -->
<button class="cdr-tab" data-tab="batch">📦 Batch</button>
```

#### 7.2 Tab panel mới
```html
<div class="cdr-tab-panel" id="tab-batch" style="display:none;">
    <!-- Upload controls -->
    <div class="batch-upload-bar">
        <button onclick="BatchUI.selectFiles()">📁 Thêm Files</button>
        <button onclick="BatchUI.selectFolder()">📂 Chọn Folder</button>
        <button onclick="BatchProcessor.processQueue()">▶ Xử lý tất cả</button>
        <button onclick="BatchProcessor.exportAll()">📦 Xuất tất cả</button>
    </div>

    <!-- Progress bar -->
    <div class="batch-progress" id="batch-progress" style="display:none;">
        <div class="progress-bar" id="batch-progress-bar"></div>
        <span id="batch-progress-text">0/0</span>
    </div>

    <!-- Sessions table -->
    <table class="batch-table">
        <thead>
            <tr>
                <th>File</th>
                <th>Carrier</th>
                <th>Format</th>
                <th>Records</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody id="batch-sessions-body">
            <!-- Filled by BatchUI.render() -->
        </tbody>
    </table>
</div>
```

#### 7.3 `batch-ui.js` — render và event handling
```javascript
const BatchUI = (() => {
    function render() {
        const sessions = BatchProcessor.getAllSessions();
        const tbody = document.getElementById('batch-sessions-body');
        tbody.innerHTML = sessions.map(s => `
            <tr class="status-${s.status}">
                <td>${s.fileName}</td>
                <td>${s.carrierName}</td>
                <td>${s.format || '—'}</td>
                <td>${s.records.length}</td>
                <td>${s.subscriber?.phone || '—'}</td>
                <td>${_statusBadge(s.status)}</td>
                <td>
                    <button onclick="CDRAnalyzer.activateSession('${s.sessionId}')">Xem</button>
                    <button onclick="BatchProcessor.exportSession('${s.sessionId}')">Xuất</button>
                </td>
            </tr>
        `).join('');
    }

    function selectFiles() { document.getElementById('cdr-file-input').click(); }
    function selectFolder() { document.getElementById('cdr-folder-input').click(); }

    return { render, selectFiles, selectFolder };
})();
```

---

## 8. PHASE 7 — BATCH EXPORT (ZIP với folder structure)

### Trong `batch-processor.js`

#### 8.1 Export all sessions
```javascript
async function exportAll() {
    if (!JSZip) { _showToast('JSZip required', 'error'); return; }

    const zip = new JSZip();
    const ts  = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
    const root = `Export_${ts.replace('T', '_').slice(0, 15)}`;

    // Phase 8: Summary.xlsx
    const summaryWb = _buildSummaryWorkbook();
    zip.file(`${root}/Summary.xlsx`,
        XLSX.write(summaryWb, {bookType:'xlsx', type:'array'}));

    // Per-carrier/per-phone export
    for (const [id, session] of _sessions) {
        if (session.status !== 'done') continue;
        const phone    = session.subscriber?.phone || session.carrier;
        const carrier  = session.carrierName || 'Unknown';
        const wb       = CellLacParser.exportToExcel({
            pii:       session.subscriber,
            records:   session.records,
            _contacts: session.contactsData,
            _imei:     session.imeiData,
            _location: session.locationData,
            carrier_name: session.carrierName,
        });
        const path = `${root}/${carrier}/${phone}/${phone}_export_all.xlsx`;
        zip.file(path, XLSX.write(wb, {bookType:'xlsx', type:'array'}));
    }

    const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), {
        href: url,
        download: `${root}.zip`
    }).click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}
```

#### 8.2 Cấu trúc ZIP output:
```
Export_20260530_170000.zip
├── Summary.xlsx
├── Viettel VTL/
│   ├── 0961046583/
│   │   └── 0961046583_export_all.xlsx
│   └── 0988888888/
│       └── 0988888888_export_all.xlsx
├── Vinaphone VNP/
│   └── ...
├── Mobiphone MBF/
│   └── ...
├── Vietnamobile VNM/
│   └── ...
└── Gmobile GMB/
    └── ...
```

---

## 9. PHASE 8 — MASTER SUMMARY (Summary.xlsx)

### Trong `batch-processor.js`

```javascript
function _buildSummaryWorkbook() {
    const wb = XLSX.utils.book_new();
    const rows = [];

    for (const [, s] of _sessions) {
        if (s.status !== 'done') continue;

        const timestamps = s.records.filter(r => r.timestamp)
            .map(r => String(r.timestamp)).sort();

        rows.push({
            'Carrier':      s.carrierName,
            'Format':       s.format || '—',
            'Phone':        s.subscriber?.phone || '—',
            'Subscriber':   s.subscriber?.name  || '—',
            'Records':      s.records.length,
            'Contacts':     Object.keys(s.contactsData).length,
            'IMEI':         Object.keys(s.imeiData).length,
            'Locations':    Object.keys(s.locationData).length,
            'StartDate':    timestamps[0]?.slice(0, 10) || '—',
            'EndDate':      timestamps[timestamps.length - 1]?.slice(0, 10) || '—',
            'ExportTime':   new Date().toLocaleString('vi-VN'),
        });
    }

    const ws = rows.length
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.aoa_to_sheet([['Không có dữ liệu']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    return wb;
}
```

---

## 10. PHASE 9 — PERFORMANCE

### Queue-based processing trong `batch-processor.js`

#### 10.1 Non-blocking UI với chunked processing
```javascript
async function processQueue() {
    if (_processing) return;
    _processing = true;

    const pending = Array.from(_sessions.values())
        .filter(s => s.status === 'pending');

    let done = 0;
    for (const session of pending) {
        // Yield to UI between files
        await new Promise(resolve => setTimeout(resolve, 0));

        try {
            session.status = 'processing';
            BatchUI.updateRow(session.sessionId);

            const parseResult = await CellLacParser.parseFile(session.file, 'auto');
            // Build derived data
            _buildSessionData(session, parseResult);

            session.status = 'done';
        } catch (err) {
            session.status = 'error';
            session.error  = err.message;
        }

        done++;
        _updateProgress(done, pending.length);
        BatchUI.updateRow(session.sessionId);
    }

    _processing = false;
    BatchUI.render();
}

function _updateProgress(done, total) {
    const pct = Math.round(done / total * 100);
    const bar  = document.getElementById('batch-progress-bar');
    const txt  = document.getElementById('batch-progress-text');
    if (bar) bar.style.width = `${pct}%`;
    if (txt) txt.textContent = `${done}/${total} (${pct}%)`;
}
```

#### 10.2 Memory cleanup sau export
```javascript
function clearExported() {
    for (const [id, s] of _sessions) {
        if (s.status === 'done') {
            // Keep metadata, free large arrays
            s.records       = [];
            s.contactsData  = {};
            s.imeiData      = {};
            s.locationData  = {};
            s.status        = 'exported';
        }
    }
}
```

#### 10.3 File size limit check
```javascript
const MAX_BATCH_FILES    = 500;
const MAX_TOTAL_SIZE_MB  = 2048;   // 2 GB total
const WARN_RECORDS_COUNT = 100_000; // warn khi quá 100k records
```

---

## 11. PHASE 10 — BACKWARD COMPATIBILITY GUARANTEES

### Các điểm cần bảo vệ

| Component | Guarantee | Cách bảo vệ |
|-----------|-----------|-------------|
| CDR Analyzer single-file mode | Không thay đổi | `_processUpload(file)` vẫn là path chính cho 1 file |
| `_S` state | Không xóa | `_S` vẫn là source-of-truth cho CDR tabs hiện tại |
| GTP Module | Không thay đổi | `_gtpParseResult` độc lập hoàn toàn |
| FLA Module | Không thay đổi | `_flaState` độc lập hoàn toàn |
| Export hiện tại | Không thay đổi | `exportAll()`, `downloadZip()` vẫn dùng `_S` |
| `CellLacParser.parseFile()` | API backward compat | Thêm `format`, `detection` vào result nhưng không bỏ field cũ |

### Test scenarios cần verify sau mỗi phase:
1. Drop 1 file Viettel → CDR Analyzer tabs hoạt động bình thường
2. Drop 1 file Vinaphone → Tab Subscriber_Profile hiển thị đúng
3. Click "⬇ EXCEL (full)" trong GTP → file với 6 sheets
4. Click "📊 Xuất tất cả" trong CDR → file với 6 sheets
5. FLA module vẫn parse và export file tài chính

---

## 12. SEQUENCE OF IMPLEMENTATION

### Thứ tự đề xuất (ít rủi ro nhất → rủi ro cao hơn)

```
SPRINT 1 — Foundation (cell-lac-parser.js only)
    Phase 1a: Thêm TEMPLATES cho Vietnamobile, Gmobile
    Phase 1b: Nâng cấp detectCarrier() → enriched object
    Phase 2:  detectFormat() + version detection
    Phase 3:  Parser Registry pattern

SPRINT 2 — Data Architecture (cdr-analyzer.js)
    Phase 5:  AnalysisSession class + _sessions Map
    Phase 4a: Multi-file input bindings
    Phase 10: Verify backward compat sau mỗi step

SPRINT 3 — Batch Processing (batch-processor.js NEW)
    Phase 4b: Queue + addFiles()
    Phase 9:  Performance / progress / yield
    Phase 7:  Batch export ZIP

SPRINT 4 — UI (index.html + batch-ui.js NEW)
    Phase 6:  Batch Processing tab
    Phase 8:  Summary.xlsx

SPRINT 5 — Polish
    Phase 9:  Memory cleanup, 500+ file stress test
    Phase 10: Full regression test
```

---

## 13. DATA MODEL REFERENCE

### AnalysisSession
```javascript
{
    sessionId:    string,           // crypto.randomUUID() hoặc timestamp+random
    file:         File,             // original File object (for re-parse)
    fileName:     string,
    carrier:      string,           // 'VTL', 'MBF', 'VNP', ...
    carrierName:  string,           // 'Viettel VTL', ...
    format:       string,           // 'viettel_V2', ...
    detection:    {confidence, matchedRules},
    subscriber:   object,           // same as _S.subscriber
    records:      array,
    contactsData: object,
    imeiData:     object,
    locationData: object,
    status:       'pending'|'processing'|'done'|'error'|'exported',
    error:        string|null,
    createdAt:    Date,
    processedAt:  Date|null,
}
```

### Enhanced ParseResult (new fields added, old preserved)
```javascript
{
    // EXISTING (không thay đổi):
    carrier, carrier_name, sheet_name, total_data_rows,
    valid_count, error_count, missing_columns, col_warnings,
    parse_warnings, pii, column_map, records, errors,
    subscribers, multi_subscriber, auto_detected,
    file_name, file_size,

    // NEW (additive):
    format:      'viettel_V2',       // carrier + version
    version:     'V2',
    detection: {
        confidence:   0.92,
        matchedRules: ['sheet_name:sheet2', 'keyword:lac'],
    },
}
```

### Enhanced detectCarrier() return
```javascript
{
    carrier:      'viettel',         // key trong TEMPLATES
    confidence:   0.92,              // 0.0–1.0
    version:      'V2',              // null nếu không detect được
    matchedRules: string[],          // audit trail
}
```

---

## 14. NEW PUBLIC API ADDITIONS

### `cell-lac-parser.js` — new exports
```javascript
CellLacParser.detectCarrier(workbook)   // → { carrier, confidence, version, matchedRules }
CellLacParser.detectFormat(workbook)    // → { carrier, format, confidence, version }
CellLacParser.PARSER_REGISTRY          // read-only access
CellLacParser.SUPPORTED_CARRIERS       // ['viettel', 'vinaphone', 'mobiphone', 'vietnamobile', 'gmobile']
```

### `batch-processor.js` — new global
```javascript
BatchProcessor.addFiles(files)
BatchProcessor.processQueue()
BatchProcessor.exportAll()
BatchProcessor.exportSession(sessionId)
BatchProcessor.getAllSessions()
BatchProcessor.getSession(sessionId)
BatchProcessor.clearAll()
```

### `cdr-analyzer.js` — new exposed methods
```javascript
CDRAnalyzer.activateSession(sessionId)
CDRAnalyzer.getActiveSessions()
```

---

## 15. RISKS

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Vietnamobile/Gmobile parser viết sai vì chưa có file thật | HIGH | Viết fallback generic parser, test khi có file thật |
| `detectCarrier()` enriched return breaks `parseFile()` | MEDIUM | Cập nhật `parseFile()` xử lý cả string và object |
| Multi-session _S coupling | MEDIUM | `activateSession()` copy data vào _S — không thay đổi CDR tab logic |
| 500+ files OOM | MEDIUM | Chunk processing + memory cleanup sau export |
| index.html không được phép sửa | MEDIUM | Cần confirm với user — batch tab cần HTML |
| JSZip không available | LOW | Fallback: download từng file riêng |

---

*Tạo lúc: 2026-05-30 | File: IMPLEMENTATION_PLAN.md*
