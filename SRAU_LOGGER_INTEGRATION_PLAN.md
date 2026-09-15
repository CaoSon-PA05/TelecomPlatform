# SRAU × Logger — Kế Hoạch Tích Hợp & Nâng Cấp
> **Sentinel Platform v4.2.1-SECURE** — Gravity Intelligence Lab  
> Tài liệu: Chuẩn bị tích hợp | Ngày: 2026-06-02  
> Trạng thái: **PLANNING** — chưa triển khai

---

## 1. Tổng Quan

### Vấn đề hiện tại

Module **SRAU** (Secure Remote Audit Utility — hiển thị là *Kiểm Toán SRAU*) trong TelecomPlatform hiện là **stub hoàn toàn**: nút "KHỞI TẠO LIÊN KẾT AN TOÀN" chỉ tạo URL giả, console log hiển thị 4 target hardcode cố định (Hà Nội, TP.HCM, Đà Nẵng, Bắc Ninh) với dữ liệu không thực tế, không có backend thật, không lưu trữ, không tái sử dụng.

### Giải pháp

Tích hợp dự án **IP Logger** (Python/Flask/SQLite) làm **microservice backend riêng biệt** cho SRAU. TelecomPlatform gọi Logger qua REST API, hiển thị dữ liệu thật, đồng thời nâng cấp toàn bộ giao diện SRAU lên chuẩn cao của nền tảng điều tra số.

### Lợi ích sau tích hợp

| Trước | Sau |
|-------|-----|
| URL giả `secureservers-cdn.net/...` | URL thật (localhost hoặc domain VPS) |
| 4 target cố định hardcode | Dữ liệu thật từ `logger.db` |
| Console log mô phỏng với `setInterval` | Log thật: IP, UA, referer, ngôn ngữ, timestamp |
| Không lưu trữ, mất khi reload | Persistent SQLite — tra cứu lại bất kỳ lúc nào |
| 1 giao diện 2 panel đơn giản | Giao diện đa tầng: 5 khu vực chức năng |

---

## 2. Kiến Trúc Mục Tiêu

```
┌─────────────────────────────────────────────────────────────┐
│  TelecomPlatform (Browser)                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  SRAU Screen (index.html + srau-engine.js)          │    │
│  │  • Tạo/quản lý beacon tokens                        │    │
│  │  • Hiển thị log thật theo thời gian (polling)       │    │
│  │  • Mã hóa/che giấu URL theo decoy mode              │    │
│  └─────────────────┬───────────────────────────────────┘    │
│                    │ fetch() REST API                        │
└────────────────────┼────────────────────────────────────────┘
                     │
          HTTP (dev) / HTTPS (prod)
                     │
┌────────────────────▼────────────────────────────────────────┐
│  IP Logger Backend (Python 3.12 / Flask 3.x)                │
│  localhost:5000  hoặc  https://beacon.domain.com            │
│                                                             │
│  Endpoints mới (thêm vào app.py):                           │
│  GET  /api/tokens          → danh sách tokens + hit counts  │
│  POST /api/tokens          → tạo token mới                  │
│  GET  /api/hits/<token>    → log của 1 token                │
│  DELETE /api/tokens/<token>→ xóa token                      │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  logger.db (SQLite)                                │     │
│  │  tokens: token, label, mode, lat, lng, gif_source  │     │
│  │  hits:   ip, user_agent, referer, language, ts     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                     │
          URL được gửi cho mục tiêu
                     │
┌────────────────────▼────────────────────────────────────────┐
│  Mục tiêu (bất kỳ trình duyệt nào)                          │
│  GET /t/<token>  → trả về GIF / bản đồ / trang decoy       │
│  → Logger ghi IP, UA, referer, language, timestamp          │
└─────────────────────────────────────────────────────────────┘
```

### Giao tiếp dữ liệu

```
SRAU Screen                     Logger API
    │                               │
    ├─ POST /api/tokens ──────────► tạo token, lưu DB
    │   body: {label, mode, ...}    trả về {token, track_url}
    │◄─ {token, track_url} ─────────┤
    │                               │
    ├─ GET  /api/tokens  ──────────► SELECT * tokens + COUNT hits
    │◄─ [{token, label, hits}] ─────┤
    │                               │
    ├─ GET  /api/hits/<token> ─────► SELECT * hits WHERE token=?
    │◄─ [{ip, ua, ref, ts}] ────────┤
    │                               │
    ├─ (polling 5s) ───────────────► kiểm tra hits mới
    │◄─ new hits ───────────────────┤
```

---

## 3. Phân Tích Hai Dự Án

### 3.1 TelecomPlatform — SRAU hiện tại

**File liên quan:** `index.html` (lines 1123–1194), `app.js` (lines 3485–3572), `styles.css`

**Hiện trạng SRAU screen:**
- `<div id="srau-screen">` — 2 panel ngang
- Panel trái: dropdown chọn Decoy URL (5 link chính phủ hardcode), dropdown chọn loại máy chủ
- Panel phải: stats (3 số) + console log stream
- `initSrauModule()` trong app.js: fake URL + `setInterval(4000)` chạy 4 target giả
- Không có state management, không có persistence

**Design tokens của TelecomPlatform (styles.css):**
```css
--accent-cyan:   #00f0ff
--accent-red:    #ff3b30
--accent-yellow: #ffcc00
--accent-violet: #9f7aea
--accent-green:  #4ade80
--bg-main:       #080b0f
--bg-card:       rgba(16, 20, 28, 0.78)
--text-primary:  #eef2f8
--text-secondary:#8fa3be
--text-muted:    #536480
--border-color:  rgba(255,255,255,0.07)
Font: Inter (body), Outfit (heading), Roboto Mono (code)
```

**Claude.md — Dữ liệu SRAU cần thu thập (theo spec):**
- IP Public, ISP, Vị trí địa lý
- User-Agent (thiết bị, trình duyệt, HĐH)
- Độ phân giải màn hình *(hiện Logger chưa thu được — cần JS snippet trong gif_page.html)*
- Độ trễ mạng/Ping *(hiện Logger chưa thu được)*
- Thời gian click tới mili-giây

### 3.2 IP Logger — Hiện trạng

**Path:** `C:\Users\ASUS\Downloads\logger\logger\`  
**File:** `app.py`, `db.py`, `requirements.txt`  
**Tham chiếu:** `LOGGER_MODULE_BRIEF.md` (cùng thư mục)

**Đã có sẵn:**
- ✅ 3 chế độ tracking: `gif` (ẩn 1×1), `custom_gif` (OG preview), `map` (OpenStreetMap)
- ✅ Thu thập: IP (xử lý X-Forwarded-For), User-Agent, Referer, Accept-Language, timestamp UTC
- ✅ SQLite persistent, CRUD đầy đủ
- ✅ Admin panel với giao diện CYBEROPS theme (Bootstrap 5)
- ✅ Token: `uuid4().hex[:12]` — 48-bit entropy
- ✅ Gunicorn + Nginx deployment ready

**Cần bổ sung để tích hợp:**
- ❌ CORS headers (flask-cors) — bắt buộc khi gọi từ browser
- ❌ JSON API endpoints (`/api/...`) — hiện chỉ có HTML endpoints
- ❌ API key / token auth cho JSON API (thay thế Basic Auth)
- ❌ Thu thập screen resolution (JS beacon snippet)
- ❌ Trường `case_id` để liên kết với vụ án TelecomPlatform

---

## 4. Danh Sách Việc Cần Làm — Chi Tiết

### PHASE 1 — Nền Tảng (Ưu tiên: Bắt buộc)

#### 4.1 [Logger] Thêm JSON API + CORS

**File:** `app.py`

```
TASK L-1: Cài flask-cors
  pip install flask-cors
  Thêm vào requirements.txt: flask-cors>=4.0

TASK L-2: Enable CORS trong app.py
  from flask_cors import CORS
  CORS(app, resources={r"/api/*": {"origins": "*"}})
  → Chỉ mở CORS cho /api/*, không mở cho /admin/*

TASK L-3: Tạo endpoint GET /api/tokens (JSON)
  @app.route("/api/tokens")
  @require_api_key           ← xem L-5
  def api_list_tokens():
    tokens = db.get_all_tokens()
    hits   = db.get_all_hits()
    # Tính hit_count per token
    return jsonify(tokens_with_counts)

TASK L-4: Tạo endpoint POST /api/tokens (JSON)
  @app.route("/api/tokens", methods=["POST"])
  @require_api_key
  def api_create_token():
    data = request.get_json()
    # Validate: mode, label, lat, lng, zoom, gif_source
    token = db.create_token(...)
    url   = f"{request.host_url.rstrip('/')}}/t/{token}"
    return jsonify({"token": token, "track_url": url})

TASK L-5: Tạo decorator @require_api_key
  API_KEY = os.environ.get("API_KEY", "sentinel-dev-key")
  def require_api_key(f):
    # Kiểm tra header: X-API-Key: <key>
    # Hoặc query param: ?api_key=<key>
    # Trả 403 nếu sai

TASK L-6: Tạo endpoint GET /api/hits/<token> (JSON)
  @app.route("/api/hits/<token>")
  @require_api_key
  def api_get_hits(token):
    hits = db.get_hits_for_token(token)
    return jsonify(hits)

TASK L-7: Tạo endpoint DELETE /api/tokens/<token>
  @app.route("/api/tokens/<token>", methods=["DELETE"])
  @require_api_key
  def api_delete_token(token):
    db.delete_token(token)
    return jsonify({"deleted": token})
```

#### 4.2 [Logger] Thêm trường `case_id` vào database

**File:** `db.py`

```
TASK L-8: Alter bảng tokens — thêm cột case_id
  Trong db.init():
    try:
      conn.execute("ALTER TABLE tokens ADD COLUMN case_id TEXT")
    except: pass  ← migration pattern đã có trong code

TASK L-9: Cập nhật create_token() nhận tham số case_id
  def create_token(..., case_id=""):
    INSERT INTO tokens ... VALUES (..., case_id, ...)

  → TelecomPlatform sẽ gửi case_id = tên vụ án hiện tại
  → Giúp lọc beacon theo vụ án khi tích hợp Cases module sau
```

#### 4.3 [TelecomPlatform] Tạo file srau-engine.js

**File mới:** `srau-engine.js`  
**Vị trí load:** sau `app.js` trong `index.html` (thêm vào cuối script list)

```
TASK T-1: Tạo file srau-engine.js với namespace _SRAU

  const _SRAU = {
    apiBase:  "http://localhost:5000",   ← configurable
    apiKey:   "sentinel-dev-key",        ← từ config
    tokens:   [],
    pollInterval: null,
    activeToken:  null,

    // Khởi tạo module
    init()

    // Tạo beacon token mới
    async createBeacon(label, mode, options)

    // Load danh sách tokens
    async loadTokens()

    // Load hits của 1 token
    async loadHits(token)

    // Bắt đầu polling hits mới (interval 5s)
    startPolling(token)

    // Dừng polling
    stopPolling()

    // Xóa token
    async deleteToken(token)

    // Render danh sách tokens vào UI
    renderTokenList(tokens)

    // Render hits vào console log
    renderHits(hits)

    // Parse UA → human readable
    parseUA(ua)

    // Detect platform từ referer
    getPlatform(referer)

    // Format timestamp UTC → ICT
    toICT(utcStr)
  }
```

#### 4.4 [TelecomPlatform] Cập nhật initSrauModule() trong app.js

```
TASK T-2: Thay thế toàn bộ nội dung initSrauModule() trong app.js
  Xóa: URL giả, mock targets array, setInterval simulation
  Thêm: gọi _SRAU.init() để khởi tạo module thật
  
  Trước:
    function initSrauModule() {
      // ... fake URL, setInterval mock ...
    }

  Sau:
    function initSrauModule() {
      if (typeof _SRAU !== 'undefined') {
        _SRAU.init();
      }
    }

TASK T-3: Cập nhật script load order trong index.html
  Thêm dòng:
  <script src="srau-engine.js"></script>
  Vị trí: SAU tất cả engine files hiện có, TRƯỚC app.js
```

---

### PHASE 2 — Giao Diện Nâng Cấp (Ưu tiên: Cao)

#### 4.5 [TelecomPlatform] Redesign SRAU Screen trong index.html

**Cấu trúc HTML mới cho `<div id="srau-screen">`:**

```
TASK T-4: Thay thế toàn bộ nội dung srau-screen

Bố cục mới (5 khu vực):

┌─────────────────────────────────────────────────────────┐
│  HEADER: SRAU · SECURE REMOTE AUDIT UTILITY     [BADGE] │
│  Subtitle: Kiểm toán điểm cuối · Định danh IP           │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ STAT 1   │ STAT 2   │ STAT 3   │ STAT 4   │ STAT 5      │
│ Beacons  │ Tổng Hit │ Online   │ Đang chờ │ Thất bại    │
│ [n]      │ [n]      │ [n]      │ [n]      │ [n]         │
├──────────┴──────────┴──────────┴──────────┴─────────────┤
│ PANEL A (40%)          │ PANEL B (60%)                   │
│ CẤU HÌNH BEACON        │ DANH SÁCH BEACON                │
│                        │                                 │
│ [Label input]          │ ┌────────────────────────────┐  │
│ [Mode selector cards]  │ │ Token  Nhãn  Hits  Kiểu    │  │
│  • GIF Ẩn              │ │ ...    ...   [n]   [badge] │  │
│  • GIF Hiện            │ │ [copy] [xem] [xóa]         │  │
│  • Bản Đồ              │ └────────────────────────────┘  │
│ [→ Conditional fields] │                                 │
│ [BTN: TẠO BEACON]      │                                 │
├────────────────────────┴────────────────────────────────┤
│ CONSOLE STREAM — NHẬT KÝ TRUY CẬP THỜI GIAN THỰC       │
│ [polling indicator] [active token] [stats row]          │
│                                                         │
│ [14:23:45 ICT] ● 113.190.231.42 · iPhone iOS 17 · Zalo │
│ [14:23:49 ICT] ● 115.79.40.112  · Android S24 · FPT    │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘

Specs chi tiết:

HEADER khu vực:
  - Title: "SRAU · SECURE REMOTE AUDIT UTILITY"
    Font: Outfit, 18px, letter-spacing: 3px, uppercase
    Color: var(--text-primary)
  - Badge: "BEACON-ACTIVE" hoặc "STANDBY"
    Color: --accent-green khi active, --text-muted khi idle
    Animation: pulse 2s khi active
  - Subtitle: "Kiểm toán điểm cuối · Định danh IP · Thu thập kênh truyền"
    Font: Inter 12px, --text-muted

STATS ROW (5 mini cards):
  Dùng class .mini-stat-card hiện có + mở rộng
  Card 1: Tổng Beacon     — icon: fa-link          — color: --accent-cyan
  Card 2: Tổng Lượt Hit   — icon: fa-crosshairs    — color: --accent-violet
  Card 3: Beacon Active   — icon: fa-circle-dot    — color: --accent-green
  Card 4: Chờ Phản Hồi    — icon: fa-hourglass     — color: --accent-yellow
  Card 5: Kết Nối Lỗi     — icon: fa-triangle-excl — color: --accent-red

PANEL A — Cấu hình Beacon:
  Header: "⊕ TẠO BEACON MỚI" — border-left: 2px solid --accent-cyan
  
  Label input:
    Placeholder: "Tên vụ án / Đối tượng cần kiểm tra..."
    Style: border-bottom only (không border box), Roboto Mono
  
  Mode Selector (3 cards ngang):
    Card 1 [GIF ẨN]:
      Icon: fa-ghost, color: rgba(143,163,190,0.8)
      Label: "GIF ẨN"
      Desc: "Pixel vô hình · Nhúng email"
    Card 2 [GIF HIỆN]:
      Icon: fa-image, color: var(--accent-violet)
      Label: "GIF HIỆN"
      Desc: "Preview Zalo/Telegram"
    Card 3 [BẢN ĐỒ]:
      Icon: fa-map-location-dot, color: var(--accent-cyan)
      Label: "BẢN ĐỒ"
      Desc: "Ngụy trang vị trí"
    Selected state: border: 1px solid var(--accent-cyan)
                    background: rgba(0,240,255,0.04)
                    box-shadow: 0 0 12px rgba(0,240,255,0.08)
  
  Conditional fields (animate fadeIn 200ms):
    Map mode: lat input + lng input + zoom select (1 hàng)
    GIF Hiện: file upload zone + OR + URL input
  
  Submit button:
    Text: "⊕ KHỞI TẠO BEACON AN TOÀN"
    Style: outline cyan, full-width, hover: fill cyan + text black
    Height: 42px, letter-spacing: 2px

PANEL B — Danh sách Beacon:
  Header: "≡ BEACONS ĐANG HOẠT ĐỘNG" + count badge
  
  Beacon list (scrollable, max-height: 320px):
    Mỗi item:
      ┌──────────────────────────────────────────────────┐
      │ [mode icon] [label] [hits badge]        [status] │
      │ [token chip Roboto Mono] [mode badge]            │
      │ [URL text truncate]              [copy][log][del]│
      └──────────────────────────────────────────────────┘
      
      Hover: border-color → --accent-cyan, left glow strip
      Active (selected for log view): background slightly lighter
      
      Mode badges:
        gif:        "GIF ẨN"   — color: --text-muted
        custom_gif: "GIF HIỆN" — color: --accent-violet
        map:        "BẢN ĐỒ"  — color: --accent-cyan
      
      Hits badge: "[n] HIT" — cyan khi n>0, muted khi n=0
      
      Action buttons (icon-only, 28x28px):
        [copy]  fa-copy     — copy track_url to clipboard
        [log]   fa-eye      — chọn token này cho console stream
        [del]   fa-trash    — xác nhận rồi xóa

CONSOLE STREAM:
  Header: "▶ NHẬT KÝ TRUY CẬP THỜI GIAN THỰC"
    + Polling indicator: "● POLLING 5s" (pulse animation khi active)
    + Tên beacon đang xem: "[label]" — cyan
    + Stats inline: [n hits] · [latest: timestamp]
  
  Log container (min-height: 220px, overflow-y: scroll, Roboto Mono):
    Background: rgba(0,0,0,0.4), border: 1px solid var(--border-color)
    Padding: 12px 16px
    
    Khi chưa chọn beacon:
      Centered text: "[SYSTEM] Chọn beacon để xem nhật ký..."
      Color: --text-muted
    
    Khi active, mỗi log entry:
      Format: [HH:MM:SS ICT] ● [IP] · [UA parsed] · [platform icon][referer]
      
      Màu theo platform:
        Zalo:     color: #0068ff
        Telegram: color: #26a5e4
        Gmail:    color: #ea4335
        Direct:   color: --text-muted
      
      Mỗi entry mới: animation slideInLeft 200ms, sau đó static
      Giới hạn: 100 entries, tự scroll xuống entry mới nhất
      
      Khi có hit mới (polling): prepend entry + flash 800ms
        background: rgba(0,240,255,0.06) → transparent
```

#### 4.6 [TelecomPlatform] Bổ sung CSS trong styles.css

```
TASK T-5: Thêm CSS section mới — SRAU Upgraded Components

  /* === SRAU v2 === */

  .srau-header { ... }               ← header section với badge
  .srau-badge-active { ... }         ← animated active badge
  .srau-stats-row { ... }            ← 5-column stat row
  .srau-panel-grid { ... }           ← 40/60 panel split
  .srau-config-panel { ... }         ← panel A
  .srau-beacon-list-panel { ... }    ← panel B
  
  .beacon-mode-cards { ... }         ← 3-card grid
  .beacon-mode-card { ... }          ← individual mode card
  .beacon-mode-card.selected { ... } ← selected state
  .beacon-mode-icon { ... }          ← icon container
  
  .beacon-list { ... }               ← scrollable list
  .beacon-item { ... }               ← individual beacon row
  .beacon-item:hover { ... }         ← hover state với glow
  .beacon-item.active { ... }        ← selected for log view
  .beacon-item-actions { ... }       ← action buttons row
  
  .console-stream { ... }            ← full-width console
  .console-header { ... }            ← header với polling indicator
  .console-body { ... }              ← scroll container
  .console-entry { ... }             ← individual log line
  .console-entry.new-hit { ... }     ← flash animation
  .poll-indicator { ... }            ← pulse dot khi polling
  
  Responsive (≤768px):
    .srau-panel-grid: grid-template-columns 1fr (stack vertical)
    .beacon-mode-cards: grid 1fr (stack vertical)
```

---

### PHASE 3 — Tính Năng Nâng Cao (Ưu tiên: Cao sau Phase 2)

#### 4.7 [Logger] Thu thập screen resolution & ping (beacon JS snippet)

```
TASK L-10: Cập nhật gif_page.html (mode custom_gif)
  Thêm JS snippet để báo cáo thêm dữ liệu:

  <script>
    (function() {
      const data = {
        w:    screen.width,
        h:    screen.height,
        lang: navigator.language,
        tz:   Intl.DateTimeFormat().resolvedOptions().timeZone,
        t:    Date.now()   // client timestamp cho ping calc
      };
      // Gửi về server qua endpoint mới
      fetch('/beacon/meta/' + TOKEN + '?' + new URLSearchParams(data),
            { method: 'GET', keepalive: true });
    })();
  </script>

TASK L-11: Thêm endpoint GET /beacon/meta/<token>
  Thu thập: screen_w, screen_h, tz, client_ts
  Lưu vào bảng hits: cập nhật row cuối cùng của token này
  Hoặc: tạo bảng beacon_meta riêng (id, hit_id, screen_w, screen_h, tz, client_ts)
```

#### 4.8 [TelecomPlatform] Liên kết với Cases module

```
TASK T-6: Truyền case_id khi tạo beacon từ SRAU
  Khi TelecomPlatform tạo beacon: gửi case_id = activeCase.id
  Logger lưu vào tokens.case_id
  
  Lợi ích: sau này có thể lọc /api/tokens?case_id=xxx
           để xem tất cả beacons của 1 vụ án

TASK T-7: Thêm badge "BEACON" trong Cases module
  Khi xem chi tiết vụ án → hiển thị số beacon và tổng hits
  Click → navigate sang SRAU screen đã filter theo case_id
```

#### 4.9 [Logger] Nâng cấp thu thập IP Intelligence

```
TASK L-12: Thêm IP Geolocation (optional)
  Dùng ip-api.com (free, 45req/min):
    GET http://ip-api.com/json/{ip}?fields=country,regionName,city,isp,org
  Gọi async sau khi log hit — không làm chậm response cho mục tiêu
  Lưu vào bảng hits: thêm cột geo_city, geo_isp

  → TelecomPlatform hiển thị: "[City] · [ISP]" trong console stream
  → Khớp với spec Claude.md: "Vị trí địa lý ước tính, Nhà mạng ISP"
```

---

## 5. Thứ Tự Triển Khai

```
PHASE 1 (Nền tảng — ~1-2 ngày dev)
  L-1  → Cài flask-cors
  L-2  → Enable CORS /api/*
  L-3  → GET /api/tokens
  L-4  → POST /api/tokens
  L-5  → @require_api_key decorator
  L-6  → GET /api/hits/<token>
  L-7  → DELETE /api/tokens/<token>
  L-8  → Migrate DB thêm case_id
  L-9  → Update create_token()
  T-1  → Tạo srau-engine.js skeleton
  T-2  → Thay initSrauModule() trong app.js
  T-3  → Update script load order index.html
  ────────────────────────────────────────
  CHECKPOINT: SRAU gọi API thật, dữ liệu thật trong console log

PHASE 2 (Giao diện — ~2-3 ngày dev)
  T-4  → Redesign SRAU screen HTML (index.html)
  T-5  → Thêm CSS section SRAU v2 (styles.css)
  Hoàn thiện srau-engine.js: renderTokenList(), renderHits(), polling
  ────────────────────────────────────────
  CHECKPOINT: Giao diện mới hoàn chỉnh, UX hiện đại

PHASE 3 (Tính năng nâng cao — theo nhu cầu)
  L-10 → Beacon JS snippet (screen, timezone, client_ts)
  L-11 → /beacon/meta/<token> endpoint
  L-12 → IP Geolocation (ip-api.com)
  T-6  → Cases ↔ SRAU linkage
  T-7  → Cases badge
```

---

## 6. Đặc Tả UI Nâng Cấp — Design Language

### Nguyên tắc thiết kế

Module SRAU là module **"tác nghiệp nhạy cảm"** — giao diện cần thể hiện:
- **Nghiêm túc, chuyên nghiệp**: không decoration thừa, mỗi element có chức năng
- **Trạng thái rõ ràng**: beacon active/idle/error phải phân biệt ngay lập tức
- **Dữ liệu là trung tâm**: IP, timestamp, platform được highlight bằng màu, không bị chìm

### Màu sắc theo chức năng (kế thừa design system TelecomPlatform)

| Yếu tố | Color token | Hex | Ý nghĩa |
|--------|------------|-----|---------|
| Module accent | `--accent-red` | `#ff3b30` | SRAU identity color (warning/sensitive) |
| Tracking active | `--accent-green` | `#4ade80` | Beacon đang hoạt động |
| Hit mới | `--accent-cyan` | `#00f0ff` | Dữ liệu thu được |
| IP display | `--accent-cyan` | `#00f0ff` | Dữ liệu kỹ thuật quan trọng |
| Timestamp | `--text-secondary` | `#8fa3be` | Metadata thứ cấp |
| Platform Zalo | hardcode | `#0068ff` | Nhận diện nguồn |
| Platform Telegram | hardcode | `#26a5e4` | Nhận diện nguồn |
| Platform Gmail | hardcode | `#ea4335` | Nhận diện nguồn |

### Typography spec

```
Module title:  Outfit 18px / weight 700 / letter-spacing 3px / uppercase
Section heads: Inter 11px / weight 700 / letter-spacing 2px / uppercase / --text-muted
Console log:   Roboto Mono 12.5px / --text-secondary (base) / --accent-cyan (IP)
Token chips:   Roboto Mono 11px / --text-muted / bg: rgba(0,0,0,0.3)
Stat values:   Roboto Mono 28px / weight 700 / --text-primary
Stat labels:   Inter 9.5px / weight 700 / letter-spacing 2px / --text-muted
```

### Micro-interactions

```
Beacon tạo mới:
  → Button loading state: spin icon + "ĐANG KHỞI TẠO..."
  → Success: item mới slide-in từ top trong beacon list
  → URL result: flash highlight 1s cyan → stable

Hit mới (polling phát hiện):
  → Console entry slide-in từ left (200ms ease-out)
  → Flash background rgba(0,240,255,0.08) → transparent (800ms)
  → Stat counter increment: scale 1.2 → 1.0 (300ms)
  → Beacon item hit badge: pulse 1 lần

Polling indicator:
  → Dot pulse mỗi 5s khi check
  → Text: "● POLLING 5S" → "● CHECKING..." → "● POLLING 5S"

Xóa beacon:
  → Confirm inline (không modal full-screen): expand panel nhỏ "Xóa vĩnh viễn? [Hủy] [Xóa]"
  → Item fade out (300ms) + slide up → remove từ list
```

### Animation system

```css
/* Sử dụng lại animation đã có trong styles.css + thêm mới */

@keyframes slideInLeft {
  from { opacity:0; transform: translateX(-12px); }
  to   { opacity:1; transform: translateX(0); }
}

@keyframes hitFlash {
  0%   { background: rgba(0,240,255,0.08); }
  100% { background: transparent; }
}

@keyframes counterBump {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.18); color: var(--accent-cyan); }
  100% { transform: scale(1); }
}

@keyframes pollPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
```

---

## 7. Cấu Hình & Biến Môi Trường

### Logger (backend)

```bash
# .env (tạo mới bên cạnh app.py)
ADMIN_PASSWORD=<mật_khẩu_admin_panel>
API_KEY=sentinel-dev-key          # TelecomPlatform dùng key này
PORT=5000
DB_PATH=logger.db
```

### TelecomPlatform (frontend)

```javascript
// Trong srau-engine.js (top of file)
const SRAU_CONFIG = {
  apiBase: "http://localhost:5000",    // Dev: localhost
  // apiBase: "https://beacon.domain.com", // Prod: VPS domain
  apiKey:  "sentinel-dev-key",
  pollMs:  5000,   // Polling interval: 5 giây
  maxLogs: 100,    // Giữ tối đa 100 entries trong console
};
```

### Nginx (production — thêm vào config logger)

```nginx
# Thêm vào /etc/nginx/sites-available/iplogger
# Cho phép TelecomPlatform gọi API (nếu khác origin)
location /api/ {
    add_header Access-Control-Allow-Origin  "https://telecom.domain.com";
    add_header Access-Control-Allow-Headers "X-API-Key, Content-Type";
    add_header Access-Control-Allow-Methods "GET, POST, DELETE, OPTIONS";
    proxy_pass http://127.0.0.1:5000;
    ...
}
```

---

## 8. Rủi Ro & Lưu Ý Kỹ Thuật

| Rủi ro | Mức độ | Giải pháp |
|--------|--------|-----------|
| CORS block khi dev (file://) | Cao | Dùng live-server hoặc VS Code Live Server extension |
| Logger không chạy → SRAU trắng | Trung bình | Fallback UI: "Backend chưa kết nối · [Hướng dẫn]" |
| API key lộ trong JS client | Trung bình | Dev only; prod dùng Nginx proxy che API key khỏi browser |
| Polling 5s quá nhiều request | Thấp | Chỉ poll khi SRAU screen đang active (visible) |
| Logger DB lớn khi nhiều hits | Thấp | Giới hạn `get_hits_for_token()` ở 500 entries là đủ |
| `initSrauModule()` gọi trước `_SRAU.init()` ready | Cao | Đặt `<script src="srau-engine.js">` TRƯỚC `app.js` |

---

## 9. File & Thư Mục Sẽ Thay Đổi

### TelecomPlatform

```
index.html          THAY ĐỔI — Redesign toàn bộ #srau-screen div
styles.css          THAY ĐỔI — Thêm section "=== SRAU v2 ===" vào cuối
app.js              THAY ĐỔI — initSrauModule() → gọi _SRAU.init()
srau-engine.js      TẠO MỚI — Toàn bộ SRAU logic, API calls, rendering
```

### IP Logger

```
app.py              THAY ĐỔI — Thêm /api/* endpoints, @require_api_key, CORS
db.py               THAY ĐỔI — Thêm case_id migration + param
requirements.txt    THAY ĐỔI — Thêm flask-cors>=4.0
templates/gif_page.html  THAY ĐỔI (Phase 3) — Beacon meta JS snippet
```

---

## 10. Tham Chiếu

- `LOGGER_MODULE_BRIEF.md` — Tóm tắt kỹ thuật IP Logger
  Path: `C:\Users\ASUS\Downloads\logger\logger\LOGGER_MODULE_BRIEF.md`
- `PROJECT_ANALYSIS.md` — Phân tích đầy đủ IP Logger
  Path: `C:\Users\ASUS\Downloads\logger\logger\PROJECT_ANALYSIS.md`
- `Claude.md` — Design system & terminology mapping (TelecomPlatform)
- `BUSINESS_LOGIC_AUDIT_TELECOM.md` — Audit toàn bộ TelecomPlatform (SRAU = M11)
- `MASTER_ARCHITECTURE_HINH_SU_CNC.md` — Kiến trúc tổng thể

---

*Tài liệu nội bộ — Gravity Intelligence Lab*  
*Chỉ sử dụng trong phạm vi điều tra số hợp pháp*
