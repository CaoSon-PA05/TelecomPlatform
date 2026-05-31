# Export Architecture Summary
> Tài liệu tham chiếu cố định — tạo từ phân tích V10.6/script.js + TelecomPlatform  
> KHÔNG cần đọc lại V10.6/script.js hay Mau/script.js cho bất kỳ quyết định export nào.

---

## 1. Workbook chuẩn mong muốn (`<phone>_export_all.xlsx`)

| # | Sheet | Cột chuẩn |
|---|-------|-----------|
| 1 | **TTTB** | Số điện thoại, Họ tên chủ thuê bao, Ngày sinh, Địa chỉ, Số giấy tờ tùy thân, Ngày cấp ID, Ngày kích hoạt |
| 2 | **LIST** | Số chủ, Số liên hệ, Thời gian, Thời lượng, IMEI, Mã tỉnh, Loại, Dịch vụ, Địa chỉ, LAC, Cell |
| 3 | **Contact** | Số điện thoại, Tần suất, Zalo, Facebook, Telegram, Ghi chú |
| 4 | **IMEI** | IMEI, Model, Ghi chú, Thời gian sử dụng |
| 5 | **Location** | LAC, CID, Mã tỉnh, Tên trạm BTS, Tần suất, Google Maps, MNC |

> **Nguồn chuẩn**: V10.6/script.js `importExportAllFile()` đọc đúng các tên cột này.  
> **Python backend** (`modules/telecom_analysis/exports/excel_exporter.py`) đã sử dụng đúng 5 sheet này.  
> **KHÔNG có** cột TT hay cột Phone thừa trong standard template.

---

## 2. Export flows đã xác định

| Flow | File | Function | Line | Truyền CDR data? | Format hiện tại |
|------|------|----------|------|-----------------|-----------------|
| **GTP Download Excel** | app.js | `gtpDownloadExcel()` | 623 | ❌ KHÔNG | RAW_PARSED + SUMMARY + ERRORS |
| **GTP ZIP bundle** | app.js | `gtpDownloadZip()` | 644–669 | ❌ KHÔNG | RAW_PARSED + SUMMARY + ERRORS (trong ZIP) |
| **CDR Export All** | cdr-analyzer.js | `exportAll()` | 1151 | ✅ CÓ (sau patch) | 5-sheet chuẩn |
| **CDR Download ZIP** | cdr-analyzer.js | `downloadZip()` | 1163 | ✅ CÓ (sau patch) | 5-sheet chuẩn (trong ZIP) |
| **CDR Tab export** | cdr-analyzer.js | `exportTab(tabName)` | 1100 | N/A | 1 sheet đơn lẻ theo tab |

### Workbook builders

| Function | File | Line | Role |
|----------|------|------|------|
| `exportToExcel(parseResult)` | cell-lac-parser.js | 763 | Tạo XLSX Workbook object |
| `downloadExcel(parseResult)` | cell-lac-parser.js | 967 | Gọi exportToExcel → XLSX.writeFile |
| `_appendSheet(wb, data, name)` | cell-lac-parser.js | 953 | Helper: json_to_sheet + book_append_sheet |

---

## 3. Root Causes đã xác định

### ROOT CAUSE G — CRITICAL: GTP module không truyền CDR data
- **app.js L626**: `CellLacParser.downloadExcel(_gtpParseResult)` — không có `_contacts`/`_imei`/`_location`
- **app.js L669**: `CellLacParser.exportToExcel(_gtpParseResult)` — không có `_contacts`/`_imei`/`_location`
- Kết quả: CDR branch trong `exportToExcel()` không được kích hoạt → tạo file RAW_PARSED/SUMMARY

### ROOT CAUSE E — HIGH: Sai filename ở CDR path
- **cell-lac-parser.js L882**: `parseResult.pii?.phone_raw` → undefined khi gọi từ CDR path
- `_S.subscriber` (CDR) dùng field `.phone`, không phải `.phone_raw`
- `_gtpParseResult.pii` (GTP) dùng field `.phone_raw`
- Kết quả: filename = `VTL_export_all.xlsx` thay vì `0912345678_export_all.xlsx`

### ROOT CAUSE B — HIGH: Tab-specific export không phải 5-sheet
- HTML buttons: `CDRAnalyzer.exportTab('calls')`, `exportTab('imei')`, `exportTab('contacts')`, `exportTab('location')`
- `exportTab()` tạo 1 sheet đơn theo tab, không phải 5-sheet standard

### ROOT CAUSE F — MEDIUM: GTP ZIP cũng không patch
- **app.js L669**: `gtpDownloadZip()` dùng `exportToExcel(_gtpParseResult)` trong ZIP

---

## 4. Data structures

### `_S.subscriber` (CDR module — cdr-analyzer.js)
```
{ phone, name, dob, address, id_doc, activation, carrier, note, report_from, report_to }
```
> Field dùng cho phone: `.phone`

### `_gtpParseResult.pii` (GTP module — từ CellLacParser.parseFile)
```
{ phone_raw, full_name, date_of_birth, address, id_doc_number, id_issue_date,
  activation, id_doc_type, subscription, account_status, report_from, report_to }
```
> Field dùng cho phone: `.phone_raw`

### `_S.contactsData` / `parseResult._contacts`
```
{ [phone]: { count, out, in, sms, zalo, fb, tg, note, firstSeen, lastSeen } }
```

### `_S.imeiData` / `parseResult._imei`
```
{ [imei]: { count, valid, model, note } }
```
> `usagePeriods` KHÔNG tồn tại trong _S.imeiData — luôn empty string khi export

### `_S.locationData` / `parseResult._location`
```
{ [lac_cell_key]: { lac, cell, province, bts, count, gmap, lat, lng } }
```
> `mnc` KHÔNG tồn tại trong _S.locationData — cần tính từ phone prefix nếu cần

---

## 5. Phân tích format cũ (RAW_PARSED / SUMMARY / ERRORS)

| Sheet | Tạo ra ở đâu | Có được đọc lại không |
|-------|-------------|----------------------|
| `RAW_PARSED` | cell-lac-parser.js L875 (original path) | **KHÔNG** — active app không có importExportAllFile |
| `SUMMARY` | cell-lac-parser.js L919 (original path) | **KHÔNG** |
| `ERRORS` | cell-lac-parser.js L928 (original path) | **KHÔNG** |

> **importExportAllFile / isExportAllFile / readExcelFileWithSheets** chỉ tồn tại trong:
> - `Mau/script.js` (old reference — không active)
> - `reference/script.js` (old reference — không active)  
> - Python backend (hệ thống riêng biệt, không dùng JS-generated format)
>
> **KHÔNG tồn tại** trong `app.js`, `cdr-analyzer.js`, `cell-lac-parser.js`

---

## 6. File liên quan

| File | Role | Được phép sửa |
|------|------|---------------|
| `app.js` | GTP + FLA + SRAU modules, event handlers | ✅ Có |
| `cdr-analyzer.js` | CDR analysis module, _S state | ✅ Có |
| `cell-lac-parser.js` | Excel parser + workbook builder | ✅ Có |
| `index.html` | HTML, button bindings | ❌ Không |
| `reference/script.js` | OLD reference — V10.6 logic | ❌ Không đọc |
| `Mau/script.js` | OLD reference — V10.6 logic | ❌ Không đọc |

---

## 7. Các quyết định kiến trúc đã kết luận

### D1: GTP và CDR là hai module độc lập về chức năng (A)
GTP = geospatial visualization. CDR = investigation workflow. Cùng dùng `CellLacParser.parseFile()` nhưng khác mục đích.

### D2: Tất cả `_export_all.xlsx` phải nhất quán 5-sheet
Vì cùng filename → cùng format. User không phân biệt được từ filename.

### D3: Chọn Option B — Centralize trong cell-lac-parser.js
- `exportToExcel()` tự build data từ records nếu `_contacts`/`_imei`/`_location` không được truyền vào
- `app.js` KHÔNG cần sửa
- 1 file thay đổi duy nhất

### D4: Patch điểm 3 helper functions vào cell-lac-parser.js
`_buildContactsInline(records, ownerPhone)` / `_buildImeiInline(records)` / `_buildLocationInline(records)`  
Dùng khi GTP path gọi mà không truyền pre-built data.

### D5: Fix filename: `phone || phone_raw`
```js
// cell-lac-parser.js downloadExcel() L882:
const phone = parseResult.pii?.phone || parseResult.pii?.phone_raw || ...
```

### D6: Không xóa cột TT và Phone khỏi CDR path
Các cột TT/Phone được thêm trong CDR path không làm hỏng import vì importExportAllFile đọc theo tên cột.  
Tuy nhiên standard template KHÔNG có TT/Phone — xem xét loại bỏ khi patch.

### D7: IMEI `Ghi chú` không default về 'IMEI hợp lệ'
V10.6/script.js bug đã xác định: `cachedData.note || (isValid ? 'IMEI hợp lệ' : 'IMEI không hợp lệ')`.  
TelecomPlatform không có bug này — `v.note || ''` là đúng.

---

## 8. Callers của exportToExcel() / downloadExcel() trong active app

| Caller | File | Line | Truyền _contacts? | Ghi chú |
|--------|------|------|--------------------|---------|
| `gtpDownloadExcel()` | app.js | 626 | ❌ | Cần fix bởi Option B |
| `gtpDownloadZip()` | app.js | 669 | ❌ | Cần fix bởi Option B |
| `CDRAnalyzer.exportAll()` | cdr-analyzer.js | 1156 | ✅ | Đã patch |
| `CDRAnalyzer.downloadZip()` | cdr-analyzer.js | 1172 | ✅ | Đã patch |

> `Mau/script.js` có `exportToExcel(data, filename, sheetName)` là method KHÁC hoàn toàn  
> (SheetJS wrapper trên CDRAnalyzer class, không phải CellLacParser.exportToExcel)

---

*Tạo lúc: 2026-05-30 | Phiên bản: 1.0*
