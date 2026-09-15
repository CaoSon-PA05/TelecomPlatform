# GTP PHASE 1 — PHÂN TÍCH KHÔNG GIAN VIỄN THÔNG

**Ngày:** 2026-06-02  
**Phạm vi:** Module GTP (M9) only — không chạm các module khác

---

## Files Đã Sửa

| File | Loại thay đổi |
|------|--------------|
| `index.html` | Đổi tên module (3 nơi) + thêm 4 HTML panel mới |
| `app.js` | Thêm 8 hàm JS mới + wiring vào `gtpLoadData` + cải thiện `updateTimelineStep` |

## Files Mới

| File | Mục đích |
|------|---------|
| `GTP_PHASE1_IMPLEMENTATION.md` | Báo cáo này |

---

## Tính Năng Đã Triển Khai

### 1. Đổi tên module
- Nav sidebar: `Hệ Không Gian GTP` → `Phân Tích KG Viễn Thông`
- Dashboard card: `Hệ Không Gian GTP` → `Phân Tích Không Gian Viễn Thông`
- Screen title: `BẢN ĐỒ RADAR KHÔNG GIAN SÓNG` → `PHÂN TÍCH KHÔNG GIAN VIỄN THÔNG — BẢN ĐỒ RADAR BTS`

### 2. AI Summary Box (`#gtp-ai-summary`)
**Hiển thị sau khi load dữ liệu.** Tự động tính toán và hiển thị:
- Tổng số bản ghi, vùng LAC, trạm BTS
- Khoảng thời gian (first → last timestamp)
- Vùng LAC chủ đạo (tần suất cao nhất)
- Tín hiệu trung bình (dBm) + % tín hiệu yếu
- Cảnh báo tự động khi >30% tín hiệu yếu
- Nhận xét hành vi di động (cao/thấp)

**Hàm:** `gtpBuildAiSummary(data)` — `app.js:~995`

### 3. Stay Point Analysis (`#gtp-stay-points`)
**Phát hiện điểm neo — nơi thiết bị lưu lại lâu.** Thuật toán:
- Phân tích các "runs" liên tiếp cùng LAC
- Stay point = run có ≥ 2 bản ghi
- Hiển thị top 5 stay points theo tần suất
- Click vào mỗi row → nhảy radar tới điểm đó (`gtpJumpToStep`)

**Hàm:** `gtpComputeStayPoints(data)`, `gtpRenderStayPoints(data)` — `app.js:~1060`

### 4. Travel Path Engine
**Phân tích lộ trình di chuyển.** Tích hợp trong AI Summary Box:
- Đếm số lần đổi vùng LAC (hops)
- Đếm tổng số vùng LAC phủ sóng khác nhau
- Hiển thị tóm tắt lộ trình dưới AI Summary

**Hàm:** `gtpBuildTravelPath(data)`, `gtpRenderTravelInfo(data)` — `app.js:~1038`

### 5. Playback Mode (`#gtp-playback-controls`)
**Tự động phát lại hành trình.** Nằm trong panel trái, dưới timeline-info:
- Nút ▶ PHÁT / ⏸ DỪNG
- Selector tốc độ: 1× (1000ms), 2× (600ms), 4× (250ms)
- Hiển thị `N / Total` step hiện tại
- Tích hợp với `updateTimelineStep` và radar map
- Tự dừng khi đến cuối

**Hàm:** `gtpInitPlayback(data)` — `app.js:~1078`

### 6. Journey Timeline (`#gtp-journey-timeline`)
**Biểu đồ timeline ngang — hiển thị toàn bộ hành trình.** Nằm dưới bảng dữ liệu:
- Mỗi "run" (chuỗi liên tiếp cùng LAC) = một block màu
- Màu sắc riêng biệt cho từng vùng LAC (8 màu tự động)
- Chiều rộng block tỉ lệ với số bản ghi
- Tooltip: LAC, số bản ghi, thời gian
- Click → `gtpJumpToStep()` nhảy radar đến điểm đó
- Scroll ngang khi nhiều zones

**Hàm:** `gtpRenderJourneyTimeline(data)` — `app.js:~1103`

---

## Kiến Trúc Tái Sử Dụng

| Resource | Tái sử dụng |
|---------|------------|
| `_gtpState.data` | Nguồn dữ liệu chính — không thay đổi |
| `_gtpParseResult` | Context export — không thay đổi |
| `CellLacParser.toGtpFormat()` | Pipeline chuyển đổi — không thay đổi |
| `drawRadarPath()` | Radar render — không thay đổi |
| `updateTimelineStep()` | Timeline update — chỉ thêm 2 dòng |
| `gtpLoadData()` | Entry point — chỉ thêm 4 lời gọi cuối |
| `MOCK_CELL_PATH` | Demo data — không thay đổi |

---

## Lỗi Còn Tồn Tại

| Lỗi | Mức độ | Ghi chú |
|-----|--------|---------|
| Không có | — | Syntax check passed (node --check) |
| Journey Timeline chưa tự scroll đến vị trí hiện tại khi slider di chuyển | Minor UX | Cần thêm `scrollIntoView` nếu muốn |
| AI Summary Box có dư biến `lacCount` (dùng `lacCountVal` thay) | Minor dead code | Không ảnh hưởng runtime |

---

## Ghi Chú Kiến Trúc

- Tất cả HTML mới là `display:none` — chỉ hiện khi có dữ liệu
- `_gtpPlaybackTimer` là module-level (không gây conflict)
- `gtpJumpToStep(idx)` là hàm global — an toàn gọi từ `onclick` trong innerHTML
- Không sửa `cell-lac-parser.js`, `gtp_exporter.py`, hay bất kỳ module nào ngoài GTP
