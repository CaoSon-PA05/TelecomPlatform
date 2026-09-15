# LOGGER INTEGRATION AUDIT
> **Sentinel Platform — TelecomPlatform × IP Logger**  
> Ngày audit: 2026-06-04  
> Auditor: Claude Code (claude-sonnet-4-6)  
> Phương pháp: Đọc tài liệu trước → xác minh source code theo điểm nghi vấn

---

## TÓM TẮT ĐIỀU HÀNH

| Câu hỏi | Kết quả |
|---------|---------|
| Mức độ tích hợp hiện tại | **TÍCH HỢP MỘT PHẦN — Phase 1 hoàn thành** |
| Logger có trong TelecomPlatform chưa? | Không nhúng trực tiếp — chạy microservice riêng |
| Có cần copy Logger vào TelecomPlatform không? | **Không** — giữ tách riêng là đúng kiến trúc |
| Kiến trúc tối ưu | Microservice tách biệt giao tiếp qua REST API (đã đang dùng) |

---

## A. MỨC ĐỘ TÍCH HỢP HIỆN TẠI

### Đánh giá: **TÍCH HỢP MỘT PHẦN — Phase 1 của SRAU_LOGGER_INTEGRATION_PLAN.md đã hoàn tất**

Hai trong ba Phase của kế hoạch tích hợp đã được thực hiện:

| Phase | Nội dung | Trạng thái |
|-------|---------|-----------|
| Phase 1 — Nền tảng | Logger REST API + CORS + srau-engine.js | ✅ **HOÀN THÀNH** |
| Phase 2 — Giao diện | Redesign HTML SRAU screen + CSS | ❓ Chưa xác nhận |
| Phase 3 — Nâng cao | Geo IP, beacon meta, Cases linkage | ✅ **Logger đã cài sẵn** (thiếu phần UI) |

### Chi tiết Phase 1 đã hoàn thành

**Phía Logger (`app.py` + `db.py`):**
- ✅ CORS headers thủ công cho `/api/*` (không dùng flask-cors, tự implement)
- ✅ `GET /api/tokens` — danh sách tokens kèm hit count, hỗ trợ filter `?case_id=`
- ✅ `POST /api/tokens` — tạo token, nhận `case_id` từ TelecomPlatform
- ✅ `GET /api/hits/<token>` — log của 1 token
- ✅ `DELETE /api/tokens/<token>` — xóa token
- ✅ `@require_api_key` decorator, key mặc định `sentinel-dev-key`
- ✅ OPTIONS preflight handler cho browser CORS
- ✅ `GET /beacon/meta/<token>` — thu thêm `screen_w`, `screen_h`, `tz`, `client_ts`
- ✅ IP Geolocation async qua ip-api.com, lưu `geo_city`, `geo_isp`
- ✅ `case_id` column trong bảng `tokens`

**Phía TelecomPlatform (`srau-engine.js`):**
- ✅ File `srau-engine.js` tồn tại, đầy đủ API client
- ✅ Gọi tất cả 4 API endpoints (`GET/POST /api/tokens`, `GET /api/hits`, `DELETE`)
- ✅ Config lưu localStorage (`srau_apiBase`, `srau_apiKey`)
- ✅ Polling 5 giây
- ✅ Truyền `case_id`, header `ngrok-skip-browser-warning`

---

## B. THÀNH PHẦN CÒN THIẾU

### B1. Logger — Templates HTML (NGHIÊM TRỌNG)

```
logger/templates/   ← THƯ MỤC RỖNG
  admin.html        ← THIẾU
  generate.html     ← THIẾU
  hits.html         ← THIẾU
  gif_page.html     ← THIẾU (được reference từ app.py line 160)
```

**Hậu quả:** Logger không thể chạy admin panel trên web. Mode `custom_gif` (`render_template("gif_page.html")`) sẽ crash ngay khi mục tiêu click link.

### B2. TelecomPlatform — SRAU Screen HTML chưa redesign (Có thể)

Theo `SRAU_LOGGER_INTEGRATION_PLAN.md`, TASK T-4 yêu cầu redesign toàn bộ `#srau-screen` trong `index.html`. Chưa xác nhận đã thực hiện hay chưa. Nếu chưa, giao diện SRAU vẫn là 2 panel đơn giản với fake console.

### B3. TelecomPlatform — `initSrauModule()` trong app.js (Có thể)

TASK T-2 yêu cầu `initSrauModule()` gọi `_SRAU.init()` thay vì chạy mock simulation. Chưa xác nhận.

### B4. Logger — Requirements.txt chưa cập nhật thêm dependency

File `requirements.txt` vẫn là:
```
flask>=3.0
requests>=2.31
gunicorn>=22.0
```
CORS được implement thủ công (không dùng flask-cors), nên không cần cập nhật. Tuy nhiên nếu thêm `flask-limiter` hoặc `flask-wtf` thì cần bổ sung.

---

## C. PHÂN TÍCH CHI TIẾT — KIỂM TRA FILE IMPORT & API CALLS

### C1. Import references
TelecomPlatform không import trực tiếp bất kỳ file nào của Logger. Giao tiếp hoàn toàn qua REST API — đúng như thiết kế microservice.

### C2. API Endpoints đang được gọi

| srau-engine.js gọi | Logger có endpoint? | Cần auth? |
|-------------------|--------------------|----|
| `GET /api/tokens?case_id=` | ✅ `api_get_tokens()` | X-API-Key |
| `POST /api/tokens` | ✅ `api_create_token()` | X-API-Key |
| `GET /api/hits/<token>` | ✅ `api_get_hits()` | X-API-Key |
| `DELETE /api/tokens/<token>` | ✅ `api_delete_token()` | X-API-Key |

Tất cả 4 endpoints đều khớp. Không có endpoint nào được gọi mà chưa có trong Logger.

### C3. Database fields đồng bộ

| TelecomPlatform gửi | Logger nhận/lưu |
|--------------------|----------------|
| `mode`, `label`, `lat`, `lng`, `zoom`, `gif_source`, `case_id` | ✅ Tất cả đều có trong `CREATE TABLE tokens` |
| Chờ hits trả về: `ip`, `user_agent`, `referer`, `geo_city`, `geo_isp`, `screen_w`, `screen_h`, `tz`, `timestamp` | ✅ Tất cả đều có trong bảng `hits` |

### C4. Config files

| File | Logger reference |
|------|----------------|
| `srau-engine.js` CONFIG | `apiBase: localStorage('srau_apiBase') || 'http://localhost:5000'` |
| `srau-engine.js` CONFIG | `apiKey: localStorage('srau_apiKey') || 'sentinel-dev-key'` |
| `logger/app.py` | `API_KEY = os.environ.get("API_KEY", "sentinel-dev-key")` |

Key mặc định khớp nhau — tích hợp hoạt động ngay khi Logger chạy ở `localhost:5000`.

---

## D. CÓ CẦN COPY LOGGER VÀO TELECOMPLATFORM KHÔNG?

### Kết luận: **KHÔNG**

Lý do:

1. **Kiến trúc microservice là đúng** — Logger cần chạy trên VPS công khai với IP tĩnh để nhận tracking hits từ mục tiêu. TelecomPlatform là client-only app chạy trên máy điều tra viên. Hai vai trò này không thể gộp chung.

2. **CORS đã được giải quyết** — Logger đã implement CORS thủ công cho `/api/*`, hoạt động cả với `Origin: null` (file:// protocol) và cross-domain.

3. **API đã đầy đủ** — Tất cả 4 endpoints mà TelecomPlatform cần đều đã có.

4. **Nếu copy vào TelecomPlatform**: Logger là Python/Flask, TelecomPlatform là Node.js/vanilla JS — không thể chạy chung một runtime.

### Vị trí đặt nếu cần tham chiếu (documentation only):
```
TelecomPlatform/
└── services/          ← tham chiếu, không chạy
    └── logger-ref/    ← giữ LOGGER_MODULE_BRIEF.md để tra cứu
```

---

## E. KIẾN TRÚC TỐI ƯU

### Phương án đề xuất: **Giữ tách riêng — Microservice Architecture** ✅

```
┌─────────────────────────────┐       REST API        ┌──────────────────────────────┐
│  TelecomPlatform             │  ←────────────────→  │  IP Logger Backend            │
│  (Browser / Máy điều tra)    │  X-API-Key            │  (VPS / localhost:5000)        │
│                              │  fetch() / polling    │                              │
│  • srau-engine.js            │                       │  • app.py (Flask)             │
│  • SRAU screen UI            │                       │  • db.py (SQLite)             │
│  • Case management           │                       │  • /api/* endpoints           │
└─────────────────────────────┘                       └──────────────────────────────┘
                                                                    │
                                                              /t/<token>
                                                                    │
                                                       ┌────────────▼────────────┐
                                                       │  Mục tiêu (Internet)     │
                                                       │  Không biết bị theo dõi  │
                                                       └─────────────────────────┘
```

**Lý do không gộp:**
- Logger phải **public accessible** (mục tiêu mới gọi được `/t/<token>`)
- TelecomPlatform chạy **offline / local** (dữ liệu CDR không thoát ra ngoài)
- Hai security boundary khác nhau không nên gộp

---

## F. RỦI RO

| ID | Rủi ro | Mức độ | Trạng thái |
|----|--------|--------|-----------|
| R1 | **Logger templates thiếu** — admin panel crash, mode custom_gif crash | 🔴 Cao | Chưa fix |
| R2 | **TelecomPlatform SRAU screen** chưa redesign — UX vẫn là mock | 🟡 Trung bình | Chưa xác nhận |
| R3 | **API key hardcode** trong srau-engine.js localStorage — lộ nếu inspect | 🟡 Trung bình | Dev only, chấp nhận được |
| R4 | **Logger chạy user root** trong systemd — security risk | 🟡 Trung bình | Nên sửa khi deploy |
| R5 | **SQLite concurrent write** — bottle-neck nếu nhiều hits đồng thời | 🟢 Thấp | Chấp nhận cho tải thấp |
| R6 | **Drift JS/Python phone normalizer** (M3.11) — không liên quan Logger | 🟡 Trung bình | TelecomPlatform issue riêng |

---

## G. KIẾN NGHỊ THỰC THI (Theo thứ tự ưu tiên)

### P1 — Tạo Logger templates (BẮT BUỘC trước khi demo)

```
Tạo 4 file trong logger/templates/:
  gif_page.html     ← ƯU TIÊN 1 (crash khi mục tiêu click custom_gif link)
  admin.html        ← Dashboard quản trị
  generate.html     ← Form tạo link
  hits.html         ← Chi tiết log
```

### P2 — Xác nhận và hoàn thiện SRAU screen redesign (QUAN TRỌNG)

Kiểm tra `index.html` — nếu `#srau-screen` vẫn là 2 panel cũ:
- Thực hiện TASK T-4 (redesign HTML)
- Thực hiện TASK T-5 (thêm CSS section SRAU v2)
- Xác nhận `initSrauModule()` trong app.js đã gọi `_SRAU.init()`

### P3 — Test end-to-end (SAU P1+P2)

```powershell
# Chạy Logger
cd C:\Users\ASUS\Downloads\logger\logger
.\venv\Scripts\python.exe app.py

# Mở TelecomPlatform, đến màn hình SRAU
# Tạo beacon → copy URL → paste vào browser → kiểm tra console log TelecomPlatform
```

### P4 — Trước khi deploy production

- Đổi `User=root` → `User=iplogger` trong systemd service
- Đổi `API_KEY` và `ADMIN_PASSWORD` thành giá trị thật (không dùng default)
- Cấu hình HTTPS (Let's Encrypt) — bắt buộc để Zalo/Telegram hiện GIF preview
- Cập nhật `srau-engine.js` CONFIG: `apiBase = "https://beacon.domain.com"`

---

## H. FILE & THAY ĐỔI CẦN THỰC HIỆN

```
logger/
  templates/
    gif_page.html     TẠO MỚI   ← P1
    admin.html        TẠO MỚI   ← P1
    generate.html     TẠO MỚI   ← P1
    hits.html         TẠO MỚI   ← P1

TelecomPlatform/
  index.html          THAY ĐỔI? ← Xác nhận P2 (redesign #srau-screen)
  app.js              THAY ĐỔI? ← Xác nhận P2 (initSrauModule → _SRAU.init)
  styles.css          THAY ĐỔI? ← Xác nhận P2 (thêm SRAU v2 CSS)
  srau-engine.js      ✅ XONG
```

---

*Audit nội bộ — Gravity Intelligence Lab*  
*Không sửa đổi bất kỳ file nào trong quá trình audit*  
*Generated: 2026-06-04 bởi Claude Code (claude-sonnet-4-6)*
