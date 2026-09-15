# HƯỚNG DẪN SỬ DỤNG — LOGGER & SRAU BEACON
## Sentinel Platform · Phân Hệ Kiểm Toán Điểm Cuối (SRAU-BEACON)

> **Tài liệu này bao gồm:**  
> Khởi động Logger Backend · Cấu hình kết nối · Tạo & quản lý Beacon · Logger Dashboard · Cloud Sync · Investigation Mode · Xử lý sự cố

---

## 1. Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────┐
│               SENTINEL PLATFORM (index.html)            │
│                                                         │
│   [Màn hình SRAU]          [Màn hình LOGGER]           │
│   ├─ Tạo beacon mới        ├─ Timeline toàn bộ hit     │
│   ├─ Danh sách beacon      ├─ Bộ lọc thời gian/nguồn  │
│   ├─ Polling real-time     ├─ Cloud sync (Supabase)    │
│   └─ Console live stream   └─ Investigation Mode       │
│                 │                    │                  │
│         srau-engine.js       logger-engine.js          │
└─────────────────────────────────────────────────────────┘
                      │ REST API (X-API-Key)
                      ▼
         ┌────────────────────────┐
         │   LOGGER BACKEND       │
         │   Flask · port 5000    │
         │   logger/app.py        │
         │   logger/db.py         │
         │   logger/logger.db     │
         └──────────┬─────────────┘
                    │ ngrok tunnel
                    ▼
         https://xxx.ngrok-free.app
              (URL gửi đối tượng)
```

**Luồng hoạt động:**
1. Điều tra viên khởi động Logger Backend (`start-logger.bat`)
2. ngrok tạo URL công khai trỏ vào localhost:5000
3. TelecomPlatform kết nối Backend qua REST API
4. Điều tra viên tạo Beacon trên màn hình SRAU → nhận tracking URL
5. Gửi tracking URL cho đối tượng → đối tượng click → Backend ghi nhận hit
6. TelecomPlatform hiển thị real-time trên console SRAU và Logger Dashboard

---

## 2. Yêu Cầu Hệ Thống

| Thành phần | Yêu cầu |
|---|---|
| Python | 3.10+ (kiểm tra: `python --version`) |
| Thư viện Python | flask, requests, gunicorn (xem `logger/requirements.txt`) |
| ngrok | Đã cài và đăng nhập (`ngrok config add-authtoken ...`) |
| Trình duyệt | Chrome/Edge/Firefox phiên bản mới nhất |
| Mạng | Không cần server VPS — chạy hoàn toàn local + ngrok |

### Cài thư viện Python (lần đầu)

```bash
cd logger
pip install -r requirements.txt
```

---

## 3. Khởi Động Logger Backend

### 3.1 Cách nhanh — dùng start-logger.bat

Mở file `logger\start-logger.bat`. File này sẽ:
- Khởi động ngrok tạo tunnel tới port 5000
- Khởi động Flask server (`python app.py`)

**Trước khi chạy, mở file bằng Notepad và cấu hình 2 dòng đầu:**

```batch
SET NGROK_DOMAIN=alibi-wake-sassy.ngrok-free.dev   ← thay bằng domain ngrok static của bạn
SET LOGGER_API_KEY=sentinel-dev-key                 ← API key (dùng khớp với TelecomPlatform)
```

> **Lấy ngrok static domain:**  
> Đăng nhập tại `ngrok.com/dashboard` → mục **Domains** → tạo free static domain (1 domain/tài khoản free).  
> Format: `xxx-yyy-zzz.ngrok-free.app`

Sau khi chạy, cửa sổ console hiển thị:
```
[OK] Dung static domain: https://alibi-wake-sassy.ngrok-free.dev
Logger URL (giu nguyen moi lan):
  https://alibi-wake-sassy.ngrok-free.dev
  API KEY : sentinel-dev-key
```

### 3.2 Cách thủ công (không dùng bat)

```bash
cd logger
python app.py
```

Server khởi động tại `http://localhost:5000`. Mở ngrok riêng:
```bash
ngrok http 5000
```

### 3.3 Kiểm tra hoạt động

Mở trình duyệt vào `http://localhost:5000/admin` (hoặc URL ngrok `/admin`).  
Hệ thống yêu cầu đăng nhập HTTP Basic:
- **Username:** bất kỳ (không kiểm tra)
- **Password:** giá trị `ADMIN_PASSWORD` (mặc định: `admin123`)

Trang admin hiển thị danh sách token và lượt hit — xác nhận backend đang chạy.

### 3.4 Cấu hình biến môi trường (tùy chọn)

Copy file `logger\.env.example` thành `logger\.env` và điền giá trị:

```ini
ADMIN_PASSWORD=Mat_khau_manh_16_ky_tu
API_KEY=64_ky_tu_hex_ngau_nhien
PORT=5000
DB_PATH=logger.db
```

> Nếu không có file `.env`, hệ thống dùng giá trị mặc định: password `admin123`, API key `sentinel-dev-key`.

---

## 4. Kết Nối TelecomPlatform với Logger Backend

### 4.1 Mở màn hình SRAU

Trong TelecomPlatform, click **"Kiểm Toán SRAU"** ở sidebar trái hoặc click **"THIẾT LẬP BEACON"** trên Dashboard.

### 4.2 Nhập SERVER URL

Trong thanh stat trên cùng, tìm ô **SERVER URL**:

```
[ https://alibi-wake-sassy.ngrok-free.dev ]  ✓
```

- Nhập URL ngrok (hoặc `http://localhost:5000` nếu chạy local)
- Nhấn **Enter** hoặc nút **✓** để áp dụng
- URL được lưu vào `localStorage` — không cần nhập lại sau khi reload

### 4.3 Nhập API KEY

Trong ô **API KEY**, nhập API key khớp với giá trị `API_KEY` trong `logger/.env`:

```
[ sentinel-dev-key ]  ✓
```

- Nhấn **Enter** hoặc **✓** để áp dụng

### 4.4 Kiểm tra trạng thái kết nối

| Chỉ số | Ý nghĩa |
|---|---|
| `TRẠNG THÁI API: ONLINE` (màu xanh lá) | Kết nối thành công |
| `TRẠNG THÁI API: OFFLINE` (màu đỏ) | Backend chưa chạy hoặc URL sai |
| Console: `[ERROR] Xác thực thất bại (HTTP 401)` | API Key không đúng |
| Console: `[ERROR] Không kết nối được Logger API` | URL sai hoặc Flask chưa khởi động |

Click vào ô **TRẠNG THÁI API ↺** để thử kết nối lại thủ công.

---

## 5. Tạo Beacon Mới (Màn Hình SRAU)

### 5.1 Liên kết với Vụ Án

Ô **VỤ ÁN** ở đầu form hiển thị vụ án đang mở từ module **Quản lý Vụ Án**.  
Mở một vụ án trước khi tạo beacon để beacon tự động gắn thẻ `case_id` — giúp lọc beacon theo vụ án sau này.

### 5.2 Điền Nhãn Nhận Dạng (bắt buộc)

Ô **"Nhãn nhận dạng \*"** — đặt tên mô tả đối tượng hoặc chiến dịch:

```
VD: Nguyen Van A — 0987654321
VD: Suspect_B — Zalo profile 12/06
VD: FB_account_xyz — Op_Alpha
```

Nhãn hiển thị trong danh sách beacon và trong console hit log.

### 5.3 Chọn Chế Độ Ngụy Trang

| Chế độ | Biểu tượng | Mô tả | Phù hợp với |
|---|---|---|---|
| **GIF ẨN** | 👁 | Pixel ảnh 1×1 trong suốt, không nhìn thấy | Nhúng trong email, HTML |
| **ẢNH NGỤ TRANG** | 🖼 | Trang HTML có Open Graph preview | Gửi qua Zalo / Telegram |
| **BẢN ĐỒ** | 🗺 | Ảnh bản đồ tĩnh OpenStreetMap | Giả bản đồ chia sẻ vị trí |

**Chi tiết từng chế độ:**

#### GIF ẨN
- Backend trả về ảnh GIF 1×1 pixel transparent
- Tracking URL dạng: `https://domain.ngrok-free.app/t/TOKEN`
- Dùng khi nhúng vào nội dung email HTML: `<img src="URL">`
- Đối tượng không thấy gì khi email/trang load

#### ẢNH NGỤ TRANG
- Render trang HTML đầy đủ có Open Graph meta tags
- Khi gửi link qua Zalo/Telegram, hiện preview ảnh/tiêu đề tùy chỉnh
- Script JavaScript trong trang tự động gửi thêm: độ phân giải màn hình, múi giờ, timestamp client
- Nguồn tracking bổ sung qua endpoint `/beacon/meta/<token>`

#### BẢN ĐỒ
- Tải ảnh bản đồ tĩnh từ OpenStreetMap dựa trên tọa độ lat/lng
- Trông như link chia sẻ bản đồ địa điểm
- Tọa độ mặc định: Hà Nội (21.0285, 105.8542)

### 5.4 Nhấn "TẠO BEACON"

Sau khi nhấn, console ghi nhận:
```
[HH:MM:SS] ✓ Beacon [Nguyen Van A] · GIF · case:a1b2c3 tạo thành công
```

Beacon xuất hiện ngay trong **Danh sách Beacon** bên phải, kèm tracking URL.

---

## 6. Quản Lý Danh Sách Beacon

Mỗi beacon trong danh sách hiển thị:

```
┌──────────────────────────────────────────────────────┐
│ Nguyen Van A — 0987654321          [GIF]   2 hits    │
│ https://domain.app/t/a1b2c3d4e5f6        [⎘] [◉] [✕]│
└──────────────────────────────────────────────────────┘
```

| Nút | Chức năng |
|---|---|
| **⎘ (Copy)** | Sao chép tracking URL vào clipboard |
| **◉ (Watch)** | Bắt đầu polling real-time cho beacon này (mỗi 5 giây) |
| **✕ (Xóa)** | Xóa beacon và toàn bộ hit liên quan (có xác nhận) |

### 6.1 Polling Real-Time

Nhấn **◉** trên beacon cần theo dõi. Thanh **POLL** ở góc trên đổi từ `IDLE` sang `● Polling: [tên beacon]`.

Khi đối tượng click vào tracking URL, console tức thì hiện:
```
[HH:MM:SS] 🔔 HIT · 113.190.xx.xx · 📍Hà Nội / Viettel · 🖥1920×1080 · Asia/Ho_Chi_Minh · Android · 05/06/2026, 14:32:17
```

Beacon item nhấp nháy hiệu ứng flash khi có hit mới.

**Lưu ý:** Chỉ 1 beacon được polling tại một thời điểm. Nhấn **◉** trên beacon khác sẽ dừng beacon cũ và bắt đầu beacon mới.

---

## 7. Thông Tin Ghi Nhận Từ Mỗi Hit

Mỗi lần đối tượng click tracking URL, hệ thống ghi nhận:

| Trường | Nguồn | Ghi chú |
|---|---|---|
| **IP Public** | HTTP header `X-Forwarded-For` / `REMOTE_ADDR` | IP thực của thiết bị |
| **User-Agent** | HTTP header | Hệ điều hành, trình duyệt, phiên bản |
| **Referer** | HTTP header | Nguồn gửi link (Zalo, Telegram, Gmail, direct) |
| **Accept-Language** | HTTP header | Ngôn ngữ thiết bị |
| **X-Forwarded-For** | HTTP header | Chuỗi proxy đầy đủ |
| **Thời gian** | Server UTC, hiển thị múi giờ ICT (+7) | |
| **Geo: Thành phố** | API `ip-api.com` (async, 5s timeout) | Điền muộn sau hit ~1-3s |
| **Geo: ISP/Nhà mạng** | API `ip-api.com` | Viettel, VNPT, FPT, v.v. |
| **Độ phân giải màn hình** | JavaScript client-side (chế độ ẢNH NGỤ TRANG) | `screen_w × screen_h` |
| **Múi giờ client** | JavaScript `Intl.DateTimeFormat` | |
| **Timestamp client** | `Date.now()` phía client | |

> **Phát hiện Bot tự động:** Logger Dashboard tự nhận diện và đánh dấu `🤖` các hit từ Facebook crawler, Googlebot, Twitterbot v.v. dựa trên User-Agent.

---

## 8. Logger Dashboard (Màn Hình LOGGER)

Màn hình **Logger** hiển thị toàn bộ hit từ tất cả beacon, dạng timeline liên tục.

### 8.1 Thanh thống kê

| Chỉ số | Mô tả |
|---|---|
| **TỔNG HIT** | Tổng lượt click từ trước đến nay |
| **BEACONS** | Số beacon đang tồn tại |
| **HIT HÔM NAY** | Hit trong 24 giờ qua |
| **NGUỒN** | Số nguồn phát hiện duy nhất (Zalo, Telegram, Direct...) |
| **LẦN SYNC** | Thời điểm load/sync dữ liệu gần nhất từ API |

### 8.2 Thanh trạng thái kết nối

```
API [ONLINE]   CLOUD [OFFLINE]
```

- **API:** trạng thái kết nối tới Logger Backend
- **CLOUD:** trạng thái kết nối Supabase (nếu đã cấu hình)

### 8.3 Bộ lọc Timeline

| Bộ lọc | Tùy chọn |
|---|---|
| **Thời gian** | Tất cả / 1 giờ qua / 6 giờ qua / 24 giờ qua / 7 ngày qua |
| **Nguồn** | Tất cả nguồn / Zalo / Telegram / Gmail / Facebook / Direct / Other |

Bộ lọc áp dụng ngay lập tức, không cần reload.

### 8.4 Xem chi tiết từng hit

Mỗi dòng hit có các cột:

```
THỜI GIAN    IP              NGUỒN     ĐỊA LÝ/ISP          BEACON    ▸
```

Click vào dòng để mở rộng chi tiết:

```
IP ĐẦY ĐỦ   │ 113.190.xx.xx  [copy]
USER AGENT  │ Mozilla/5.0 (Linux; Android 13) Chrome/124
MÀN HÌNH   │ 1080×2400
MÚI GIỜ    │ Asia/Ho_Chi_Minh
REFERER    │ https://zalo.me/...
NGÔN NGỮ   │ vi-VN,vi;q=0.9,en;q=0.8
```

Nút **⬡** bên cạnh IP: sao chép IP vào clipboard.

### 8.5 Các nút hành động

| Nút | Chức năng |
|---|---|
| **↺ LÀM MỚI** | Tải lại toàn bộ timeline từ API |
| **☁ CLOUD** | Đồng bộ thủ công lên Supabase |
| **⚙ CLOUD/VPS** | Mở modal cài đặt Cloud + VPS Webhook |
| **⚡ ĐIỀU TRA** | Kích hoạt Investigation Mode (spin-up VPS) |

### 8.6 System Log

Nhấn **NHẬT KÝ HỆ THỐNG ▶** ở cuối màn hình để xem/ẩn log kỹ thuật nội bộ (50 dòng gần nhất). Hiển thị ngược (mới nhất ở trên).

---

## 9. Chế Độ Offline & Cache

Logger Dashboard tự động cache toàn bộ hit vào `localStorage` sau mỗi lần load thành công.

**Khi Backend offline (ngrok bị ngắt, máy tính ngủ):**
- Timeline vẫn hiển thị dữ liệu từ cache lần cuối
- Thanh trạng thái: `API [OFFLINE]`
- Thông báo: `[ OFFLINE — ĐANG DÙNG CACHE ]`
- Hệ thống tự thử kết nối lại sau **30 giây**

---

## 10. Cloud Sync (Supabase) — Tùy Chọn

Cho phép lưu backup hit lên cloud Supabase (free tier đủ dùng).

### 10.1 Thiết lập Supabase

1. Tạo tài khoản tại `supabase.com`
2. Tạo project mới
3. Trong SQL Editor, chạy:

```sql
CREATE TABLE logger_hits (
  id          BIGSERIAL PRIMARY KEY,
  token       TEXT,
  label       TEXT,
  ip          TEXT,
  user_agent  TEXT,
  referer     TEXT,
  geo_city    TEXT,
  geo_isp     TEXT,
  timestamp   TEXT,
  synced_at   TIMESTAMPTZ
);
```

4. Vào **Settings → API** → lấy **Project URL** và **anon public key**

### 10.2 Cấu hình trong TelecomPlatform

Trên màn hình Logger, click **⚙ CLOUD/VPS** → nhập:

```
SUPABASE URL:  https://xxxx.supabase.co
SUPABASE KEY:  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Click **LƯU CÀI ĐẶT**.

### 10.3 Đồng bộ

- **Thủ công:** Click **☁ CLOUD** trên toolbar
- Hệ thống gửi toàn bộ `STATE.allHits` lên bảng `logger_hits`
- Trùng lặp tự bỏ qua (`resolution=ignore-duplicates`)
- Console ghi nhận: `[OK] Đã đồng bộ N sự kiện lên cloud.`

---

## 11. Investigation Mode (VPS Webhook) — Tùy Chọn

Investigation Mode cho phép kích hoạt VPS forensic từ xa qua webhook khi cần xử lý vụ án có độ ưu tiên cao.

### 11.1 Cấu hình VPS Webhook

Trên màn hình Logger, click **⚙ CLOUD/VPS** → nhập:

```
VPS WEBHOOK:  https://your-vps-control.webhook.site/...
```

### 11.2 Kích hoạt

Click **⚡ ĐIỀU TRA**. Hệ thống gửi POST request:

```json
{
  "action":    "spin_up",
  "timestamp": "2026-06-05T14:32:00.000Z",
  "hits":      127,
  "tokens":    8
}
```

Console ghi nhận: `[OK] VPS đang khởi động. Kiểm tra trạng thái sau 2–3 phút.`

---

## 12. Tích Hợp với Module Vụ Án

Khi một vụ án đang mở trong module **Quản lý Vụ Án**:

1. Màn hình SRAU tự hiển thị tên vụ án trong ô **VỤ ÁN**
2. Beacon tạo mới tự gắn `case_id`
3. Trong màn hình **Chi tiết Vụ Án**, dòng **▸ BEACON SRAU** hiển thị số lượng beacon gắn với vụ
4. Nút **→ MỞ SRAU** chuyển thẳng sang màn hình SRAU đã lọc theo vụ án

---

## 13. Xử Lý Sự Cố

### Lỗi: "Không kết nối được Logger API"

```
[ERROR] Không kết nối được Logger API tại http://localhost:5000
[HINT]  Chạy: cd logger && python app.py   (port 5000)
```

**Nguyên nhân & Cách xử lý:**
- Flask chưa chạy → mở `start-logger.bat` hoặc `python app.py`
- SERVER URL sai → kiểm tra ô SERVER URL trên màn hình SRAU
- ngrok chưa khởi động → kiểm tra cửa sổ ngrok tunnel

---

### Lỗi: "Xác thực thất bại (HTTP 401)"

```
[ERROR] Xác thực thất bại (HTTP 401) — API Key không đúng.
[HINT]  Kiểm tra API Key trong ô bên phải. Key mặc định: "sentinel-dev-key"
```

**Nguyên nhân & Cách xử lý:**
- API Key trong TelecomPlatform không khớp với `API_KEY` trong `logger/.env`
- Kiểm tra ô **API KEY** trên màn hình SRAU → nhập đúng giá trị

---

### Hit không có thông tin Geo (thành phố/ISP trống)

**Nguyên nhân:**
- IP là private/loopback (127.x, 192.168.x, 10.x) — hệ thống bỏ qua geo lookup
- API `ip-api.com` timeout hoặc giới hạn rate (free: 45 req/phút)
- Đối tượng dùng VPN

**Cách xử lý:**
- Dùng ngrok URL (không phải localhost) để nhận IP public thực
- Geo điền bất đồng bộ sau 1-3 giây — bấm **↺ LÀM MỚI** để tải lại

---

### Beacon tạo thành công nhưng tracking URL không hoạt động

**Nguyên nhân & Cách xử lý:**
- ngrok tunnel đã hết thời gian hoặc bị đóng → kiểm tra cửa sổ ngrok
- Dùng static domain ngrok (không thay đổi sau mỗi lần restart) — cấu hình trong `start-logger.bat`
- Token không tồn tại → kiểm tra lại URL, tránh gõ nhầm

---

### TelecomPlatform mất kết nối sau khi máy tính ngủ

- Hệ thống tự retry sau 30 giây
- Hoặc click ô **TRẠNG THÁI API ↺** để kết nối lại thủ công
- ngrok free tier đôi khi cần restart sau vài giờ → chạy lại `start-logger.bat`

---

## 14. Cấu Trúc Thư Mục Logger

```
TelecomPlatform/logger/
├── app.py              ← Flask server (routes, auth, REST API)
├── db.py               ← SQLite engine (tokens + hits tables)
├── requirements.txt    ← flask, requests, gunicorn
├── start-logger.bat    ← Windows launcher (ngrok + Flask)
├── .env.example        ← Template cấu hình (copy thành .env)
├── logger.db           ← Cơ sở dữ liệu SQLite (tự tạo lần đầu)
├── static/
│   ├── css/app.css     ← Style admin dashboard
│   └── js/app.js       ← Logic admin dashboard
├── templates/
│   ├── base.html       ← Layout chung
│   ├── admin.html      ← Trang /admin (danh sách token + hit)
│   ├── generate.html   ← Trang /admin/generate (tạo token thủ công)
│   ├── hits.html       ← Trang /admin/hits/<token>
│   └── gif_page.html   ← Trang ngụy trang (chế độ ẢNH NGỤ TRANG)
└── uploads/            ← File ảnh upload (chế độ ẢNH NGỤ TRANG)
```

---

## 15. REST API Reference (dành cho tích hợp nâng cao)

Tất cả endpoint yêu cầu header `X-API-Key: <API_KEY>`.

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/tokens` | Lấy danh sách tất cả beacon |
| GET | `/api/tokens?case_id=<id>` | Lọc beacon theo vụ án |
| POST | `/api/tokens` | Tạo beacon mới |
| GET | `/api/hits/<token>` | Lấy danh sách hit của beacon |
| DELETE | `/api/tokens/<token>` | Xóa beacon |

**Tạo beacon (POST /api/tokens):**
```json
{
  "label":      "Nguyen Van A",
  "mode":       "gif",
  "lat":        "21.0285",
  "lng":        "105.8542",
  "zoom":       "14",
  "gif_source": "",
  "case_id":    "abc123"
}
```

**Response:**
```json
{
  "token":     "a1b2c3d4e5f6",
  "track_url": "https://domain.ngrok-free.app/t/a1b2c3d4e5f6"
}
```
