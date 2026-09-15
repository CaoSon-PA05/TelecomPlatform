# 🚀 UPGRADE IDEAS 2026 — Sentinel Platform (TelecomPlatform)

**Phạm vi tài liệu:** Tổng hợp từ 20 file Markdown whitelist (root + `docs/`) — KHÔNG đọc source code.
**Ngày tổng hợp:** 2026-06-29
**Generator:** Claude Code (claude-sonnet-4-6), Agent phụ (research-only)

---

## PHẦN 1 — PHÂN TÍCH HIỆN TRẠNG

### 1.1 Mục tiêu của dự án

Sentinel Platform là hệ thống phân tích dữ liệu viễn thông chuyên sâu phục vụ công tác trinh sát/điều tra (CDR — Call Detail Record forensics), với 3 module nghiệp vụ chính:

- **Telecom CDR Analysis** — phân tích chi tiết lịch sử liên lạc thoại/SMS, lộ trình di chuyển (LAC/Cell), thiết bị IMEI, đối soát chéo nhiều đối tượng.
- **GTP (Geospatial Telemetry Processor)** — theo dõi vị trí trạm BTS từ dữ liệu LAC/CID.
- **FLA (Financial Ledger Analyzer)** — phân tích sao kê ngân hàng, phát hiện giao dịch bất thường.
- **SRAU (Secure Endpoint Audit Utility)** — tạo liên kết mồi (decoy link) và vân tay thiết bị mục tiêu (chưa triển khai).

Mục tiêu kiến trúc: chuyển từ công cụ client-side đơn lẻ (legacy `Mau/`, dùng LocalStorage, dễ vỡ khi >10MB dữ liệu) sang nền tảng full-stack quan hệ (FastAPI + SQLAlchemy + SQLite/PostgreSQL), nhiều người dùng, có mã hóa AES-256 cho PII, có khả năng đối soát chéo tập trung giữa nhiều chuyên án.

### 1.2 Kiến trúc hiện tại

Mô hình 3-tier (Service-Repository pattern):

```
Frontend (kế hoạch: React 18 + Vite + TailwindCSS + Shadcn/UI + Recharts + Leaflet;
          thực tế hiện có: Vanilla JS root shell index.html/app.js/styles.css)
        ↓ Axios/Fetch
Backend (FastAPI Python 3.12, async/await)
   ├── routers/ (imports, subscribers, ...)
   └── modules/telecom_analysis/
         ├── parsers/ (BaseParser, ColumnMapper, AutoDetector, Viettel/Vina/Mobi parser)
         ├── normalizers/ (phone, date, province, provider_detector)
         ├── analytics/ (contact, IMEI, time_pattern, location, cross_subscriber)
         ├── schemas/ (Pydantic v2: Raw*/Create/Response/Update)
         ├── services/ (import_service, subscriber_service, analytics_service, stats_service, export_service)
         ├── exports/ (BaseExporter, ExcelExporter, ZipExporter)
         └── frontend/adapters/ (format_*_tab response shaping)
        ↓ SQLAlchemy ORM
Database (SQLite dev → PostgreSQL production, qua connection string)
```

Pipeline dữ liệu chuẩn 5 bước: **Import & Detect → Parsing → Normalization → Persistence (mã hóa PII) → Analytics**.

Module `telecom_analysis` được port từ legacy `Mau/script.js` (13.645 dòng JS đơn khối) sang Python có cấu trúc, có test strategy (`pytest`, fixtures `conftest.py`).

Root platform shell (`index.html`, `app.js`, `styles.css`) là một SPA vanilla JS độc lập, mock data, có 4 màn hình: Dashboard, GTP, FLA, SRAU — **chưa có màn hình Telecom CDR** tích hợp.

Legacy `Mau/` (CDR Analyzer cũ) được bảo tồn nguyên trạng, hoạt động độc lập hoàn toàn (8 tabs, LocalStorage, không backend) — dùng làm công cụ dự phòng offline khi hệ thống mới gặp sự cố.

### 1.3 Các module đã hoàn thành

| Module | Trạng thái | Ghi chú |
|---|---|---|
| **M1 — File Upload & Validation** | ✅ 12/13 | Upload đơn/batch, validate extension + magic-byte, streaming size check, auto-detect carrier từ filename |
| **M3 — Phone Normalization & Classification** | ✅ 10/11 | Chuẩn hóa số VN, phát hiện nhà mạng, phân loại hướng cuộc gọi |
| **M4 — Database Import Pipeline** | ✅ 13/15 (đã implement theo CHANGELOG_M4) | Pipeline 2-phase transaction, upsert subscriber/device/tower, rebuild 5 loại stats, bulk insert |
| **M6 — Export Engine** | ✅ 11/17 | `BaseExporter`/`ExcelExporter` platform-reusable, multi-sheet XLSX, GTP 3-sheet, FLA 3-sheet, dark-theme styling |
| **M9 — GTP module** | ✅ 5/8 | UI hoạt động, movement log, LAC zone frequency, signal strength classification |
| **M10 — FLA module** | ✅ 9/11 | Transaction list, large-amount flag, danger-hour flag, summary stats, hourly distribution |
| **Legacy `Mau/`** | ✅ Hoạt động đầy đủ | CDR Analyzer client-side, 8 tabs, vẫn dùng được như công cụ dự phòng |

Lưu ý quan trọng: FEATURE_INVENTORY.md (2026-05-31) đánh giá M4 = 0/15 (toàn Stub), nhưng CHANGELOG_M4.md (2026-06-04, mới hơn) xác nhận M4 đã được **implement 13/15 feature core** — đây là tài liệu cập nhật nhất, cho thấy pipeline import → DB đã thông suốt end-to-end (Upload → Process → Analytics có dữ liệu thật).

### 1.4 Các module đang phát triển

| Module | Trạng thái | Việc còn lại |
|---|---|---|
| **M2 — CDR Parsing** | Partial (9/12) | Viettel parser xong; **Vinaphone, Mobifone parser còn STUB** — `auto_detector` đã route nhưng chưa có implementation |
| **M5 — Analytics & Aggregation** | Partial — client-side ~85% xong, server-side cần xác minh lại sau M4 | Endpoint server-side (`/calls`, `/contacts`, `/imei`, `/location`, cross-subscriber compare) — theo FEATURE_INVENTORY là Stub nhưng M4 đã unblock, cần audit lại |
| **M7 — Investigator Annotations** | Partial (2/8 server, đầy đủ client) | PATCH endpoint cho contact/tower annotation chưa có ở server, chỉ tồn tại ở client LocalStorage |
| **M6.11/6.15/6.16** | Partial | ZIP batch export, per-sheet export endpoints, comparison export còn stub |

### 1.5 Các module còn thiếu

| Module | Trạng thái | Mô tả |
|---|---|---|
| **M2.8, M2.9** | STUB | Parser Vinaphone, Mobifone chưa viết — chỉ Viettel hoạt động đầy đủ |
| **M8.6, M8.7, M8.8** | STUB | Server-side JWT auth, RBAC, audit log — hiện auth chỉ là hardcoded credentials phía client |
| **M9.6–9.8** | STUB | LAC/CID → GPS lookup, bản đồ Leaflet thực, time-slider animation — GTP hiện chỉ có SVG radar giả lập |
| **M11 — SRAU** | STUB hoàn toàn (0/7) | Toàn bộ module decoy-link/beacon chưa triển khai gì ngoài UI nav |
| **Frontend React mới** | Chưa bắt đầu | `frontend/` trống hoàn toàn; root shell vẫn vanilla JS mock data |
| **BTS Tower Coordinate DB** | Thiếu hoàn toàn | Không có nguồn dữ liệu LAC/CID → GPS thật (GTP map vẫn mock Hà Nội) |
| **Alembic migrations** | Deferred (P11) | Hiện dùng `create_tables()` dev-only, chưa có migration thật |
| **Batch CDR đa nhà mạng (Vietnamobile, Gmobile)** | Chưa triển khai | IMPLEMENTATION_PLAN.md đề xuất 10 phase nhưng là plan client-side (cell-lac-parser.js), chưa rõ đã code hay chưa |

### 1.6 Technical Debt

1. **Drift risk lớn nhất:** Logic chuẩn hóa số điện thoại tồn tại **song song ở cả Python (`phone_normalizer.py`) và JavaScript (`cdr-analyzer.js`)** — mọi thay đổi rule phải sửa 2 nơi, không có nguồn chân lý duy nhất (FEATURE_INVENTORY 3.11, Tier 3 P13).
2. **Monolith JS legacy:** `Mau/script.js` 627KB/13.645 dòng — một class `CDRAnalyzer` ôm hết parser + analytics + UI + export + compare. Không phải nợ kỹ thuật của hệ thống mới, nhưng là rủi ro nếu còn phải bảo trì song song trong giai đoạn dual-run.
3. **Frontend hiện tại 2 hệ song song không kết nối:** Root shell (mock data, vanilla JS) và `Mau/` legacy (hoạt động thật, đứng riêng) — chưa hợp nhất. `missing_components.md` xác nhận "share zero code paths, zero data, zero API calls".
4. **Authentication không an toàn:** Hardcoded credentials trong JS plaintext (`canbo/ca@2024`, `sentinel/anm@2024`, `admin/Sentinel@2026`) — phải thay bằng JWT server-side trước khi production.
5. **Thiếu Alembic migration:** Dùng `create_tables()` — không version-control được schema, rủi ro khi cần thay đổi cấu trúc DB sau khi đã có dữ liệu thật.
6. **Province code không nhất quán:** Cùng một tỉnh dùng cả `TNH` và `T066` trong cùng file — bảng lookup chuẩn hóa còn `[PARTIAL]`.
7. **Inconsistent data types:** Cột LAC/Cell ID lưu lẫn lộn string/integer trong Excel gốc — parser phải xử lý ép kiểu cẩn thận.

### 1.7 Known Issues

1. **M4 vs FEATURE_INVENTORY mâu thuẫn thời điểm:** Tài liệu cũ hơn (FEATURE_INVENTORY, 05-31) nói M4 = stub hoàn toàn; CHANGELOG_M4 (06-04) nói đã xong 13/15. Cần một lần audit thực tế mã nguồn để xác nhận tình trạng dứt điểm (ngoài phạm vi nhiệm vụ này vì không được đọc code).
2. **2 bugfix tiền tồn tại được phát hiện trong lúc làm M4:** `DELETE /subscribers/{id}` và `DELETE /imports/batches/{id}` thiếu `response_model=None` gây lỗi assertion FastAPI khi load app — đã fix kèm M4.
3. **`GET /imports/batches`, `DELETE /imports/batches/{id}`, `POST /imports/batches/{id}/retry`** vẫn là stub 501 — cần thiết kế pagination/cascade rebuild/re-queue.
4. **GTP map hiện dùng coordinate mock Hà Nội** — không phản ánh vị trí tháp BTS thật vì thiếu cơ sở dữ liệu LAC/CID → GPS.
5. **Cross-subscriber comparison dùng last-9-digits normalization** — hoạt động cho số Việt Nam, nhưng theo `legacy_telecom_analysis.md` "may fail for international" (rủi ro thấp với phạm vi hiện tại).
6. **IMEI lookup (`imei.info`)** trong legacy chỉ là placeholder UI (`lookupIMEI` hiện toast, không gọi API thật).

### 1.8 Các TODO còn tồn tại

Theo `CHANGELOG_M4.md` mục "Chức năng còn thiếu (ngoài phạm vi M4)":
- `GET /imports/batches` — cần pagination design.
- `DELETE /imports/batches/{id}` — cần cascade rebuild stats.
- `POST /imports/batches/{id}/retry` — cần re-queue logic.
- Alembic migrations — infrastructure, đang dùng `create_tables()` tạm.
- IMEI model lookup qua imei.info — external API call, optional.
- Vinaphone parser (M2.8) — chưa implement.
- Mobifone parser (M2.9) — chưa implement.

Theo `FEATURE_INVENTORY.md` Tier 3/4 (chưa triển khai):
- P10: Server-side JWT auth.
- P12: Hoàn thiện bảng chuẩn hóa mã tỉnh.
- P13: Hợp nhất logic chuẩn hóa số điện thoại JS/Python.
- P14: RBAC + audit logging.
- P15: Ngưỡng cảnh báo FLA có thể cấu hình (hiện hard-code).
- P16: GTP map đầy đủ với GPS + time slider.
- P17: SRAU toàn bộ module.
- P18: IMEI model auto-lookup.
- P19: Đồ thị luồng giao dịch (Node Link Diagram) cho FLA.
- P20: Leaflet movement map per subscriber.

### 1.9 Những tính năng đã lên kế hoạch nhưng chưa triển khai

1. **Multi-carrier batch CDR system** (`IMPLEMENTATION_PLAN.md`) — 10 phase đầy đủ: hỗ trợ Vietnamobile/Gmobile, `detectCarrier()` enriched object (confidence/version/matchedRules), Parser Registry pattern, multi-session architecture (`AnalysisSession`), Batch Processing UI tab, ZIP export theo cấu trúc carrier/phone, Summary.xlsx, performance/queue processing cho 500+ file. **Toàn bộ là kế hoạch — chưa có xác nhận đã code.**
2. **React/Vite frontend hiện đại** (`frontend_roadmap.md`) — TailwindCSS/Shadcn UI, `@tanstack/react-table`, Recharts, Leaflet với offline tile cache, Zustand state management, Social Network Graph visualization, parallel timelines cho so sánh 2 đối tượng.
3. **REST API đầy đủ theo `proposed_architecture.md`** — endpoints `/telecom/upload`, `/telecom/subscriber/{id}`, `/telecom/records/{id}`, `/telecom/analytics/{id}`, `/telecom/timeline/{id}`, `/telecom/compare` — một phần đã có (theo CHANGELOG_M4), phần lớn endpoint analytics/timeline/compare chưa xác nhận.
4. **AES-256 encryption cho PII** — được thiết kế trong schema (`telecom_schema_design.md`, `telecom_schema_analysis.md`) và roadmap nhưng chưa thấy xác nhận triển khai thực tế.
5. **Migration tool từ LocalStorage legacy → DB mới** (`migration_plan.md`) — nút "Xuất Dữ Liệu Di Trú" ở app cũ + endpoint `/api/v1/migration/import` ở backend mới — chưa triển khai, đang ở giai đoạn kế hoạch Bước 2.
6. **BTS Tower Coordinate Database** — cần nguồn dữ liệu LAC/CID → GPS thật (OpenCelliD hoặc nhập liệu thủ công) để GTP map hoạt động chính xác.

---

## PHẦN 2 — KHOẢNG TRỐNG CỦA DỰ ÁN (GAP ANALYSIS)

| Nhóm | Khoảng trống chính |
|---|---|
| **Parser coverage** | Chỉ Viettel hoạt động đầy đủ; Vinaphone/Mobifone/Vietnamobile/Gmobile chưa có parser thật |
| **Security** | Không có JWT thật, không có RBAC, không có audit log, không có mã hóa PII đã xác nhận hoạt động |
| **Geospatial thực** | Không có BTS coordinate DB → bản đồ chỉ là mock/SVG, không định vị được tháp sóng thật |
| **Frontend hiện đại** | `frontend/` (React) trống hoàn toàn; root shell vẫn là mock-data vanilla JS chưa nối API |
| **AI/ML** | Chưa có bất kỳ thành phần học máy/AI nào — toàn bộ "phân tích" hiện tại là rule-based (threshold, aggregation) |
| **Automation/Plugin** | Không có cơ chế plugin để thêm carrier mới mà không sửa code lõi; không có pipeline CI/CD được đề cập |
| **Monitoring/Observability** | Chỉ có health-check cơ bản (`/health`); không có logging tập trung, không có metrics/alerting |
| **Mobile/Cross-platform** | Hoàn toàn chưa được đề cập trong toàn bộ 20 tài liệu |
| **Offline-first đầy đủ** | Có đề cập offline map tile cache (kế hoạch), nhưng chưa có chiến lược offline-first toàn diện cho backend (sync khi mất mạng) |

---

## PHẦN 3 — TOP 20 Ý TƯỞNG NÂNG CẤP (BẢNG XẾP HẠNG)

| STT | Ý tưởng | Lợi ích | Độ khó | Giá trị | Ưu tiên |
|---|---|---|---|---|---|
| 1 | Hoàn thiện parser Vinaphone + Mobifone (server-side Python) | Mở khóa toàn bộ pipeline cho 2/3 nhà mạng lớn còn lại | Trung bình | Rất cao | **P0** |
| 2 | Server-side JWT Auth + RBAC (analyst/supervisor) | Bắt buộc trước khi đưa vào production thật, thay hardcoded credentials | Trung bình | Rất cao | **P0** |
| 3 | Triển khai AES-256 encryption cho cột PII (phone, name, address) | Bảo vệ dữ liệu chuyên án nếu DB bị rò rỉ — yêu cầu nghiệp vụ cốt lõi | Trung bình | Rất cao | **P0** |
| 4 | Audit log server-side (ai truy cập gì, khi nào) | Truy vết trách nhiệm, bắt buộc cho môi trường điều tra | Thấp-Trung bình | Cao | **P1** |
| 5 | Hợp nhất logic chuẩn hóa số điện thoại (1 nguồn chân lý Python, JS gọi qua API hoặc generate từ cùng spec) | Loại bỏ drift risk lớn nhất đã ghi nhận | Trung bình | Cao | **P1** |
| 6 | Module phát hiện bất thường bằng Machine Learning (anomaly detection cho CDR — cụm hành vi lạ, ngoài rule-based threshold) | Vượt qua giới hạn rule cố định, phát hiện pattern phức tạp (vd: thay đổi hành vi bất ngờ) | Cao | Rất cao | **P1** |
| 7 | Social Network Analysis / Graph visualization (mạng lưới liên lạc, định vị "nút trung tâm" đường dây) | Trực quan hóa mối quan hệ nghi can — giá trị nghiệp vụ điều tra rất cao | Cao | Rất cao | **P1** |
| 8 | BTS Tower Coordinate Database (import OpenCelliD hoặc seed thủ công) | Biến GTP từ "mock" thành công cụ định vị thật | Cao (cần nguồn data) | Rất cao | **P1** |
| 9 | Bản đồ Leaflet thực + time-slider playback (thay SVG radar) | Trực quan hóa lộ trình di chuyển mục tiêu theo thời gian thực | Trung bình-Cao | Cao | **P2** |
| 10 | REST API đầy đủ cho Analytics/Timeline/Compare (hoàn thiện stub 501) | Unblock toàn bộ M5, M6, M7 server-side | Trung bình | Rất cao | **P1** |
| 11 | Dashboard tổng hợp đa chuyên án (cross-case overview, không chỉ per-subscriber) | Cho phép giám sát nhiều chuyên án cùng lúc — giá trị quản lý cao | Trung bình | Cao | **P2** |
| 12 | Plugin system cho parser nhà mạng mới (đăng ký template qua config/JSON, không sửa code lõi) | Mở rộng hỗ trợ Vietnamobile/Gmobile/carrier mới nhanh, giảm rủi ro regressions | Cao | Cao | **P2** |
| 13 | Batch/multi-session CDR processing (theo IMPLEMENTATION_PLAN.md đầy đủ) | Xử lý hàng trăm file cùng lúc, tăng năng suất trinh sát | Cao | Cao | **P2** |
| 14 | Alembic migration framework | An toàn khi thay đổi schema sau khi có dữ liệu thật | Thấp | Trung bình-Cao | **P2** |
| 15 | Cảnh báo thời gian thực (WebSocket) khi phát hiện giao dịch/cuộc gọi bất thường | Phản ứng nhanh hơn so với xem báo cáo tĩnh | Trung bình-Cao | Cao | **P2** |
| 16 | Module Export/Report nâng cao: PDF report tự động (tóm tắt chuyên án dạng văn bản + biểu đồ nhúng) | Giảm thời gian soạn báo cáo thủ công | Trung bình | Cao | **P2** |
| 17 | Tích hợp LLM/AI Assistant hỗ trợ tóm tắt hồ sơ + gợi ý hướng điều tra (trên dữ liệu đã ẩn danh/nội bộ) | Tăng tốc phân tích, gợi ý insight mà rule-based có thể bỏ sót | Cao | Cao | **P3** |
| 18 | Mobile-responsive / PWA cho trinh sát hiện trường (xem nhanh hồ sơ, không cần full desktop) | Hỗ trợ tác nghiệp thực địa | Cao | Trung bình-Cao | **P3** |
| 19 | Centralized structured logging + metrics (Prometheus/Grafana hoặc tương đương nhẹ) | Quan sát hệ thống, phát hiện lỗi/độ trễ sớm | Trung bình | Trung bình | **P3** |
| 20 | SRAU module hoàn chỉnh (decoy link + beacon receiver + WebSocket live log) | Hoàn thiện module forensics còn thiếu hoàn toàn (0/7) | Cao | Trung bình-Cao | **P3** |

---

## PHẦN 4 — QUICK WINS (triển khai nhanh, giá trị tức thời)

1. **Hoàn thiện 3 endpoint stub của M4** (`GET /imports/batches`, `DELETE .../{id}`, `POST .../retry`) — đã có pattern từ `import_service.py`, chỉ cần thêm pagination + cascade logic.
2. **Audit lại thực trạng M4/M5** bằng cách chạy smoke test thực tế (so với CHANGELOG_M4 đã claim 13/15) để xác nhận tài liệu nào đúng — input rẻ, giá trị cao để tránh lập kế hoạch trên thông tin sai.
3. **Bổ sung bảng chuẩn hóa mã tỉnh đầy đủ** (province normalization) — đã có pattern `TNH→Tay Ninh`, chỉ cần mở rộng danh sách 63 tỉnh/thành.
4. **Cấu hình ngưỡng FLA động** (P15, hiện hardcode 150M VND / giờ nguy hiểm 23h-04h) — đưa vào config file hoặc DB settings.
5. **Thêm Alembic** — effort thấp, rủi ro giảm đáng kể khi schema cần đổi sau này.
6. **CORS + .env.example chính thức** — effort rất thấp, cần thiết trước khi deploy.

---

## PHẦN 5 — LONG-TERM VISION

Sentinel Platform hướng tới trở thành **nền tảng phân tích forensics viễn thông + tài chính tích hợp AI**, nơi:

- Mọi nhà mạng Việt Nam (Viettel, Vinaphone, Mobifone, Vietnamobile, Gmobile) được hỗ trợ qua **plugin parser** có thể đăng ký động, không cần sửa code lõi mỗi khi có nhà mạng/định dạng mới.
- **Lớp AI/ML** không chỉ rule-based threshold mà có khả năng phát hiện bất thường hành vi (anomaly detection), gợi ý mối liên hệ ẩn (graph embedding/social network analysis), và hỗ trợ trinh sát viên qua trợ lý hội thoại nội bộ (LLM on-prem/offline) tóm tắt hồ sơ.
- **Bản đồ địa lý thật** với cơ sở dữ liệu BTS đầy đủ, hỗ trợ playback lộ trình di chuyển, phát hiện điểm gặp mặt vật lý giữa nhiều đối tượng theo thời gian thực.
- **Bảo mật cấp doanh nghiệp**: JWT + RBAC + audit log đầy đủ, mã hóa PII AES-256 toàn diện, sẵn sàng triển khai multi-user trên PostgreSQL tập trung.
- **Hệ sinh thái module mở**: GTP, FLA, SRAU, và các module tương lai (vd: phân tích mạng xã hội, OSINT) đều dùng lại các platform service đã trừu tượng hóa (File Ingestion, XLSX Export Engine, Annotation Store, Batch Concurrency Controller — đã liệt kê trong FEATURE_INVENTORY.md).
- **Giao diện hiện đại đa nền tảng**: React/Vite desktop-first hiện tại, có thể mở rộng PWA cho thiết bị di động hỗ trợ trinh sát tác nghiệp hiện trường.

---

## PHẦN 6 — ROADMAP CÁC PHASE TIẾP THEO

### Phase A — Hoàn thiện Core Pipeline & Bảo mật nền tảng
**Mục tiêu:** Đưa pipeline CDR end-to-end lên trạng thái production-ready cho cả 3 nhà mạng chính, vá lỗ hổng bảo mật nghiêm trọng nhất.
**Chức năng:**
- Parser Vinaphone + Mobifone (server-side)
- JWT Auth + RBAC thay hardcoded credentials
- AES-256 encryption cho cột PII
- Audit log cơ bản
- Hoàn thiện 3 endpoint stub M4 (batches list/delete/retry)
**Độ khó:** Trung bình–Cao
**Thời gian ước tính:** 4–6 tuần
**Rủi ro:** Sai lệch giữa parser mới và dữ liệu thật chưa từng thấy (Vinaphone/Mobifone chưa có file mẫu xác nhận) → cần thu thập file mẫu thật trước khi code.

### Phase B — Analytics & Visualization nâng cao
**Mục tiêu:** Hoàn thiện toàn bộ REST API analytics/timeline/compare, đưa bản đồ và biểu đồ thành thật (không còn mock).
**Chức năng:**
- Hoàn thiện endpoint Analytics/Timeline/Compare (M5 server-side)
- BTS Tower Coordinate Database (OpenCelliD import hoặc nhập liệu thủ công)
- Bản đồ Leaflet thật + time-slider playback
- Social Network Graph visualization (Recharts/D3 hoặc tương đương)
**Độ khó:** Cao
**Thời gian ước tính:** 6–8 tuần
**Rủi ro:** Phụ thuộc nguồn dữ liệu BTS GPS công khai có thể không đầy đủ/chính xác cho khu vực Việt Nam — cần fallback nhập liệu thủ công.

### Phase C — Frontend hiện đại hóa & hợp nhất hệ thống
**Mục tiêu:** Thay root shell mock-data bằng frontend React thật kết nối API, tích hợp module Telecom CDR vào Sentinel shell, khai tử dần `Mau/` legacy.
**Chức năng:**
- Scaffold `frontend/` React + Vite + TailwindCSS + Shadcn/UI
- Telecom CDR screen tích hợp vào sidebar Sentinel
- Migration tool LocalStorage → DB (theo migration_plan.md Bước 2-3)
- Dual-run verification 2-4 tuần theo migration_plan.md
**Độ khó:** Cao
**Thời gian ước tính:** 8–10 tuần
**Rủi ro:** Trinh sát viên đang quen giao diện cũ — cần đào tạo lại; sai lệch tính toán giữa app cũ/mới phải = 0% trước khi cutover.

### Phase D — AI/ML & Automation
**Mục tiêu:** Đưa năng lực phân tích vượt khỏi rule-based, hỗ trợ trinh sát viên qua gợi ý thông minh.
**Chức năng:**
- Anomaly detection ML cho hành vi liên lạc/giao dịch bất thường
- LLM assistant nội bộ tóm tắt hồ sơ + gợi ý hướng điều tra (chạy offline/on-prem để bảo mật)
- Plugin system cho parser nhà mạng mới (đăng ký template động)
- Batch/multi-session CDR processing đầy đủ (IMPLEMENTATION_PLAN.md)
**Độ khó:** Cao
**Thời gian ước tính:** 8–12 tuần
**Rủi ro:** Yêu cầu hạ tầng AI on-prem (không thể dùng cloud LLM cho dữ liệu chuyên án nhạy cảm) — cần đánh giá khả năng phần cứng sẵn có.

### Phase E — Hoàn thiện Module phụ & Observability
**Mục tiêu:** Hoàn thiện SRAU, bổ sung logging/monitoring tập trung, PDF report tự động.
**Chức năng:**
- SRAU module đầy đủ (decoy link, beacon receiver, WebSocket live log)
- Structured logging + metrics dashboard
- PDF report tự động tổng hợp chuyên án
- Alembic migration chính thức hóa toàn bộ
**Độ khó:** Trung bình–Cao
**Thời gian ước tính:** 4–6 tuần
**Rủi ro:** SRAU có thể vướng vấn đề pháp lý/đạo đức khi triển khai decoy-link thật — cần xác nhận khung pháp lý trước khi code phần beacon thu thập dữ liệu thiết bị mục tiêu.

---

*Tài liệu được tổng hợp tự động từ 20 file Markdown whitelist. Không có file source code nào được đọc hoặc sửa đổi trong quá trình tạo báo cáo này.*
