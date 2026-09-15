# LOGGER HYBRID ARCHITECTURE
## TelecomPlatform × Sentinel Logger — Zero-Cost Forensic System
> Gravity Intelligence Lab | 2026-06-05 | v1.0

---

## KIẾN TRÚC TỔNG THỂ

```
╔══════════════════════════════════════════════════════════════════════╗
║  LAYER 0 — TelecomPlatform UI (Browser / Offline-First)             ║
║                                                                      ║
║  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐   ║
║  │  SRAU Screen    │  │  Logger Screen   │  │  Cases Screen    │   ║
║  │  (Beacon Mgmt)  │  │  (Timeline+Inv)  │  │  (Case Linkage)  │   ║
║  │  srau-engine.js │  │  logger-engine.js│  │                  │   ║
║  └────────┬────────┘  └────────┬─────────┘  └──────────────────┘   ║
╚═══════════╪════════════════════╪════════════════════════════════════╝
            │ REST API           │ REST API / Cloud API
            │ X-API-Key          │ Supabase / Logger API
            ▼                   ▼
╔═══════════════════════════════════════════════════════════════════╗
║  LAYER 1 — Edge Device (Android / iOS via Capacitor)              ║
║                                                                   ║
║  ┌───────────────────────────────────────────────────────────┐   ║
║  │  Sentinel Logger Android App                              │   ║
║  │  (React + Capacitor — com.gravitylab.sentinellogger)      │   ║
║  │                                                           │   ║
║  │  Pages:  Login · Dashboard · CreateBeacon · HitsDetail   │   ║
║  │  Services:                                                │   ║
║  │   • OfflineQueue.js  — IndexedDB pending queue           │   ║
║  │   • SyncWorker.js    — Background sync + retry           │   ║
║  │   • CloudAdapter.js  — Supabase upload                   │   ║
║  └───────────────────────────────────────────────────────────┘   ║
╚════════════════════════════╪══════════════════════════════════════╝
                             │ When online
              ┌──────────────┴──────────────┐
              ▼                             ▼
╔══════════════════════╗    ╔════════════════════════════╗
║  LAYER 2A            ║    ║  LAYER 2B                  ║
║  Logger Flask API    ║    ║  Cloud Storage (Supabase)  ║
║  (On-demand VPS)     ║    ║                            ║
║                      ║    ║  Table: logger_hits         ║
║  /api/tokens  CRUD   ║    ║  Idempotent upsert         ║
║  /t/<token>   track  ║    ║  Free tier: 500MB          ║
║  /beacon/meta stats  ║    ║  Cost: $0/month            ║
║                      ║    ║                            ║
║  Cost: ~$0.009/hour  ║    ║  Read by: TelecomPlatform  ║
║  (DigitalOcean s-1   ║    ║           Investigation VPS║
║   vcpu-1gb)          ║    ║                            ║
╚══════════════════════╝    ╚════════════════════════════╝
              │
              ▼
╔═════════════════════════════════════════════════════════════════╗
║  LAYER 3 — On-Demand VPS (Investigation Mode)                   ║
║                                                                 ║
║  Trigger: TelecomPlatform "⚡ KÍCH HOẠT ĐIỀU TRA" button       ║
║           → POST to webhook → scripts/vps-lifecycle.sh         ║
║                                                                 ║
║  Stack (Docker):                                                ║
║  ┌────────────────────────────────────────────────────────┐   ║
║  │  sentinel-logger  (Flask + Gunicorn)                   │   ║
║  │  sentinel-nginx   (HTTPS proxy)                        │   ║
║  └────────────────────────────────────────────────────────┘   ║
║                                                                 ║
║  Actions:                                                       ║
║  1. Spin up from snapshot  (~60 seconds)                        ║
║  2. Pull hits from Supabase                                     ║
║  3. Run CDR analysis (M4/M5)                                    ║
║  4. Run SRAU correlation                                        ║
║  5. Auto-shutdown after N minutes                               ║
║  6. Save snapshot for next time                                 ║
║                                                                 ║
║  Cost: ~$0.009/hour (DigitalOcean)                              ║
║  If used 10 hours/month: ~$0.09                                 ║
╚═════════════════════════════════════════════════════════════════╝
```

---

## MÔ HÌNH CHI PHÍ

| Thành phần | Nhà cung cấp | Tier | Chi phí/tháng |
|-----------|-------------|------|--------------|
| Cloud Storage (hits DB) | Supabase | Free | **$0** |
| Beacon tracking endpoint | Cloudflare Workers | Free (100K req/day) | **$0** |
| Android app | Capacitor (self-build) | Free | **$0** |
| TelecomPlatform UI | Browser (local) | — | **$0** |
| Investigation VPS | DigitalOcean | On-demand ~10h/mo | **~$0.09** |
| Domain | DuckDNS / tenten.vn | Free / ~$5/năm | **$0–0.42** |
| **TỔNG** | | | **~$0–$1/tháng** |

---

## FILES ĐÃ TẠO / SỬA

### TelecomPlatform

| File | Thay đổi |
|------|---------|
| `logger-engine.js` | **TẠO MỚI** — Logger Dashboard module (timeline, investigation mode, cloud sync) |
| `index.html` | **SỬA** — Nav item Logger, `#logger-screen` HTML, script tag |
| `app.js` | **SỬA** — `_LOGGER.init()` on startup, `loadTimeline()` on screen enter |
| `styles.css` | **SỬA** — Logger CSS (event rows, source colors, empty state) |

### Logger Android App

| File | Thay đổi |
|------|---------|
| `src/services/OfflineQueue.js` | **TẠO MỚI** — IndexedDB offline buffer (pending beacons + cached hits) |
| `src/services/SyncWorker.js` | **TẠO MỚI** — Background sync, retry, exponential backoff |
| `src/services/CloudAdapter.js` | **TẠO MỚI** — Supabase upload adapter + DDL |

### Logger Infrastructure

| File | Thay đổi |
|------|---------|
| `Dockerfile` | **TẠO MỚI** — Container image (python:3.11-slim, user nobody) |
| `docker-compose.yml` | **TẠO MỚI** — Logger + Nginx stack with volumes |
| `scripts/vps-lifecycle.sh` | **TẠO MỚI** — Spin-up/teardown/snapshot automation (doctl) |

---

## INTEGRATION FLOW — END-TO-END

```
Điều tra viên (TelecomPlatform SRAU screen)
  → Tạo beacon (POST /api/tokens)
  → Logger API lưu vào SQLite (layer 2A) hoặc Supabase (layer 2B)
  → Copy tracking URL: https://domain.com/t/<token>

Điều tra viên gửi link cho mục tiêu (Zalo/Telegram/SMS)
  → Mục tiêu click link
  → Nginx → Gunicorn → Flask tracks hit (IP, UA, geo, screen, tz)
  → Lưu SQLite
  
Sync lên Cloud:
  → SyncWorker.js polling 15s (Android app)
  → CloudAdapter.uploadHits() → Supabase logger_hits table
  → TelecomPlatform logger-engine.js → syncToCloud()

TelecomPlatform Logger Screen:
  → Load timeline: GET /api/tokens → GET /api/hits/token → merge
  → Hiện event timeline (filter: time/source)
  → Offline fallback: localStorage cache

Investigation Mode:
  → Click "⚡ KÍCH HOẠT ĐIỀU TRA"
  → POST to VPS webhook (configured in Logger Settings)
  → scripts/vps-lifecycle.sh spin_up
  → VPS khởi động từ snapshot (~60s)
  → Docker stack running → HTTPS endpoint ready
  → Auto-shutdown after N minutes
  → Snapshot saved → teardown
```

---

## HƯỚNG DẪN THIẾT LẬP NHANH

### 1. Supabase (5 phút)
```
1. Đăng ký tại supabase.com (miễn phí)
2. Tạo project mới
3. Vào SQL Editor → paste nội dung CloudAdapter.SUPABASE_DDL
4. Vào Settings > API → copy URL và anon key
5. Mở TelecomPlatform > Logger > ⚙ CÀI ĐẶT → nhập URL + key
```

### 2. Investigation Mode Webhook
```bash
# Option A: Chạy vps-lifecycle.sh trực tiếp
export DO_SNAPSHOT_ID=your-snapshot-id
export DO_REGION=sgp1
bash scripts/vps-lifecycle.sh spin_up

# Option B: Dùng n8n / Make (webhook trigger)
# → Workflow: receive POST → run doctl command → notify back

# Option C: GitHub Actions (manual trigger)
# → workflow_dispatch → run vps-lifecycle.sh
```

### 3. Android App build
```bash
cd logger/android-app
npm install
npm run build              # output → dist/
npx cap add android        # (lần đầu)
npx cap sync
npx cap open android       # Android Studio → Build APK
```

---

## FAILURE RECOVERY

| Scenario | Recovery |
|---------|---------|
| Logger API offline | Logger screen dùng localStorage cache, hiện "OFFLINE" badge |
| Supabase down | Android queue tích lũy, sync khi cloud khôi phục |
| VPS không khởi động được | Teardown failed droplet, spin_up lại từ snapshot |
| Beacon creation khi offline | OfflineQueue lưu, SyncWorker drain khi online |
| Mất kết nối giữa sync | Idempotency key (token+timestamp+ip) ngăn duplicate |

---

*Tài liệu nội bộ — Gravity Intelligence Lab*  
*Generated: 2026-06-05 | Claude Code (claude-sonnet-4-6)*
