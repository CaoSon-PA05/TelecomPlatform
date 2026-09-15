# PROJECT MEMORY MASTER — Sentinel Platform (TelecomPlatform)

**Đây là file đầu tiên mọi phiên Claude phải đọc trước khi làm việc trên dự án này.**

Cập nhật lần cuối: 2026-06-30 | Nguồn: `TECHNICAL_AUDIT_2026.md` (source-level audit) + `UPGRADE_IDEAS_2026.md` (doc-level analysis)

---

## 1. Executive Summary

### Mục tiêu dự án

**Sentinel Platform** là hệ thống phân tích điều tra số (Digital Forensics Platform) cho cơ quan thực thi pháp luật Việt Nam, gồm 4 trụ cột:
- **CDR Analysis** — phân tích Call Detail Records đa nhà mạng (Viettel, Vinaphone, Mobifone)
- **FLA** — Financial Link Analysis: phân tích sao kê ngân hàng đa ngân hàng, NLP, fraud scoring
- **GTP** — Geographic Tracking: lộ trình di chuyển nghi can qua BTS towers
- **SRAU** — Surveillance & Remote Access Unit: decoy links, beacon tracking

### Phạm vi

Toàn bộ codebase tại `D:\Phần mềm lập trình dự án 2\TelecomPlatform`. Có **hai codebase song song**: Python backend (đang phát triển, FastAPI) và legacy frontend (vanilla JS, đang hoạt động thật, nguồn gốc từ `Mau/script.js` 627KB/13,645 dòng).

### Kiến trúc tổng thể

3-tier dự kiến: React frontend + FastAPI backend + PostgreSQL. **Thực tế hiện tại:** legacy JS frontend + FastAPI backend partial + SQLite. React frontend chưa bắt đầu.

### Trạng thái hiện tại

**~35% hoàn thành tổng thể.** Pattern cốt lõi: **"Engine Built, Pipeline Broken"** — logic Python (parsers, import service, analytics) tốt hơn tài liệu cũ mô tả, nhưng API surface (routers) bị cắt đứt nghiêm trọng (Analytics Router 0% — toàn bộ 13 endpoint là HTTP 501) và Security hoàn toàn chưa có (0%).

---

## 2. Current Architecture

| Layer | Mô tả | Trạng thái |
|---|---|---|
| **Frontend (React)** | Kế hoạch, dùng Vite + React + TanStack Query + Zustand | ❌ Trống hoàn toàn, chưa bắt đầu |
| **Frontend (Legacy JS)** | `cdr-analyzer.js`, `bank-parser.js`, `nlp-engine.js`, `graph-engine.js`, `fraud-engine.js`, `srau-engine.js` — vanilla JS, mock data | ✅ Hoạt động, nhưng không có Auth, không tích hợp backend |
| **Backend (FastAPI)** | `backend/app/` — routers (health, analytics, imports, exports, subscribers), `backend/app/services/upload/` (M4 pipeline) | ⚠️ Partial — upload pipeline tốt, analytics routing = stub |
| **Database** | SQLAlchemy ORM, 6 models (subscriber, cdr_record, cell_tower, import_batch, device, contact_profile), SQLite dev | ⚠️ Schema OK, không có Alembic migration, BTS data NULL |
| **Import Pipeline (M4)** | `modules/telecom_analysis/services/import_service.py` + upload handler/validator/storage | ✅ Upload 95%, Service 90%, Router 43% (4/7 endpoint = 501) |
| **Parser** | `modules/telecom_analysis/parsers/` — base, viettel, vina, mobi, auto_detector, column_mapper | ✅ Viettel 90%, Vinaphone 80%, Mobifone 75% — **không phải stub** |
| **Analytics** | `modules/telecom_analysis/analytics/` — contact, IMEI, location, time_pattern analyzers (logic ~55%) | ❌ Logic có nhưng **0% API endpoint** (13/13 = HTTP 501) |
| **Visualization (GTP)** | `modules/telecom_analysis/exports/gtp_exporter.py` (85% logic) | ❌ Không có HTTP endpoint để gọi; BTS coordinate data luôn NULL |
| **Logger / SRAU** | `srau-engine.js` (legacy JS only) — polling, beacon, WebSocket | ❌ 0% trong Python backend |
| **Security** | JWT, RBAC, AES-256 encryption | ❌ **0% — xác nhận qua Grep, không phải suy đoán** |

---

## 3. Module Status

| Module | Trạng thái | % Hoàn thành | Ghi chú |
|---|---|---|---|
| M4 Upload Pipeline | ✅ Hoạt động | 95% | handler/validator/storage/metadata đầy đủ |
| M4 Import Service | ✅ Hoạt động | 90% | Logic tốt nhưng 7/7 test là `...` placeholder |
| M4 Import Router | ⚠️ Partial | 43% | 4/7 endpoint batch management = HTTP 501 |
| Parser Viettel | ✅ Hoạt động | 90% | Chưa test hết mọi template thật |
| Parser Vinaphone | ✅ Hoạt động | 80% | **Docs cũ ghi "stub" — SAI** |
| Parser Mobifone | ✅ Hoạt động | 75% | **Docs cũ ghi "stub" — SAI**; regex PII còn mỏng |
| Auto Detector + Column Mapper | ✅ Hoạt động | 85% | 2/5 test có assertion thật |
| Analytics Router (API) | ❌ Stub hoàn toàn | 0% | 13/13 endpoint = HTTP 501, không tài liệu nào đề cập |
| Analytics Logic (Python) | ⚠️ Partial | ~55% | Có code thật nhưng không accessible qua API |
| GTP Exporter | ⚠️ Logic OK, không accessible | 85% (logic) / 0% (API) | Không có HTTP endpoint wire vào |
| BTS Coordinate DB | ⚠️ Schema OK, data thiếu | 70% (schema) / 0% (data) | lat/lng luôn NULL, không có seeder |
| JWT Authentication | ❌ Không tồn tại | 0% | Grep xác nhận 0 file |
| RBAC | ❌ Không tồn tại | 0% | Grep xác nhận 0 file |
| AES-256 Encryption | ❌ Không tồn tại | 0% | Grep xác nhận 0 file |
| SRAU (Python backend) | ❌ Không tồn tại | 0% | Chỉ có trong legacy JS (`srau-engine.js`) |
| FLA Bank Statement | ⚠️ JS only | 75% (JS) / 0% (Python) | Chưa port sang Python backend |
| Test Suite | ❌ Gần như trống | ~5% | Đa số file test chứa `...` placeholder, không chạy |
| React Frontend | ❌ Không tồn tại | 0% | Directory trống hoàn toàn |

---

## 4. Audit Facts (Single Source of Truth)

> Chỉ liệt kê những điều **đã được xác minh qua source-level audit** (đọc code thật + Grep). Không suy đoán.

- ✓ Parser Viettel có implementation thật, hoạt động (90%).
- ✓ Parser Vinaphone **KHÔNG phải stub** — có implementation đầy đủ (80%), tài liệu cũ ghi sai.
- ✓ Parser Mobifone **KHÔNG phải stub** — có implementation đầy đủ (75%), tài liệu cũ ghi sai.
- ✓ M4 Upload Pipeline hoạt động tốt (95%).
- ✓ M4 Import Service có logic thật (90%) nhưng toàn bộ 7 test trong `test_import_service.py` là placeholder `...`, không chạy được.
- ✓ M4 Import Router chỉ hoạt động 3/7 endpoint; 4/7 còn lại trả HTTP 501.
- ✓ Analytics Router: **toàn bộ 13/13 endpoint trả HTTP 501** — không có API nào hoạt động, dù logic phân tích (contact/IMEI/location/time) đã có code thật trong Python.
- ✓ GTP Exporter có logic hoàn chỉnh (85%) nhưng không có HTTP endpoint nào gọi tới nó.
- ✓ BTS Coordinate DB: schema (cell_tower model) đầy đủ cột nhưng `latitude`/`longitude` luôn NULL — không có data seeder.
- ✓ JWT Authentication **chưa tồn tại** — Grep toàn bộ Python codebase: 0 file chứa jwt/bearer/bcrypt/OAuth2.
- ✓ RBAC **chưa tồn tại** — Grep: 0 file chứa role/permission/rbac.
- ✓ AES-256 Encryption **chưa tồn tại** — Grep: 0 file chứa AES/encrypt/Fernet/cryptography.
- ✓ SRAU module **không tồn tại trong Python backend** — chỉ có trong legacy JS (`srau-engine.js`).
- ✓ `CHANGELOG_M4.md` và `FEATURE_INVENTORY.md` mâu thuẫn nhau về % hoàn thành M4 (13/15 vs 0/15) — số liệu thực tế đo từ source là Upload 95% / Service 90% / Router 43%.
- ✓ Test coverage thực tế toàn dự án ước tính ~5% — phần lớn test file chỉ có placeholder, không có assertion thật.
- ✓ React frontend (`frontend/`) hoàn toàn trống — chưa có một dòng code nào, dù tài liệu architecture mô tả như đang phát triển.
- ✓ FLA (phân tích sao kê ngân hàng) chỉ tồn tại trong legacy JS, 0% trong Python backend.

---

## 5. Documentation Conflicts

| Tài liệu A | Tài liệu B | Nội dung mâu thuẫn | Nguồn đáng tin cậy hơn |
|---|---|---|---|
| `CHANGELOG_M4.md` | `FEATURE_INVENTORY.md` | CHANGELOG báo M4 = 13/15 features; FEATURE_INVENTORY báo 0/15 | **Source code** (đo được: Upload 95%, Service 90%, Router 43%) — không phải tài liệu nào cả |
| Docs cũ (nhiều nơi) | Source code thực tế | Vinaphone & Mobifone parser bị gọi là "stub" | **Source code** — cả hai có implementation thật (80%/75%) |
| `docs/frontend_roadmap.md`, `docs/proposed_architecture.md` | Source code thực tế | Docs mô tả React frontend "đang phát triển" | **Source code** — `frontend/` trống hoàn toàn |
| `docs/architecture.md` | Source code thực tế | Docs đề xuất 3-tier React+FastAPI+PostgreSQL như hiện trạng | **Source code** — hiện tại là legacy JS + FastAPI partial + SQLite |
| Không tài liệu nào đề cập | Source code thực tế | Analytics Router 100% stub không được ghi nhận ở đâu | **Source code** — phát hiện duy nhất qua audit trực tiếp |

**Nguyên tắc áp dụng:** Khi tài liệu và source code mâu thuẫn, **source code luôn là chuẩn**. Tài liệu markdown trong dự án này có xu hướng lỗi thời (viết trước hoặc không đồng bộ với code).

---

## 6. Technical Debt (Top items)

1. Hai codebase song song (Python backend + legacy JS 627KB) — maintenance burden kép
2. `frontend/` React trống — UI production vẫn dựa vào legacy JS
3. Test suite ~5% thật — không có safety net cho refactor
4. Analytics Router 0% — logic tốt nhưng không accessible qua API
5. Auth stack hoàn toàn thiếu (JWT/RBAC) — security debt nghiêm trọng nhất
6. AES-256 PII encryption thiếu — dữ liệu điều tra lưu plaintext
7. Không có Alembic migration — schema changes nguy hiểm khi có data thật
8. BTS coordinate data NULL — GTP map không có dữ liệu vị trí thật
9. SRAU + FLA chỉ tồn tại trong legacy JS, chưa port Python — rủi ro mất tính năng nếu JS bị thay thế
10. Hardcoded credentials trong `config.py`; không có Docker/CI-CD

---

## 7. Critical Issues

### P0 (bắt buộc trước mọi deployment)
- Analytics Router 100% stub — core value sản phẩm không accessible qua API
- Không có JWT Authentication — toàn bộ API public
- Không có RBAC — không phân quyền user
- Không có AES-256 PII encryption — dữ liệu điều tra plaintext
- React Frontend hoàn toàn trống — không có UI production

### P1 (ảnh hưởng chức năng cốt lõi)
- Test suite ~5% — không có safety net
- M4 Import Router: 4/7 endpoint = 501 (không xem lại/xóa/retry batch import được)
- BTS Database: schema có nhưng data NULL — GTP map vô dụng
- GTP Exporter: logic tốt nhưng không có HTTP endpoint
- Vinaphone/Mobifone parser: chưa validate với CDR file thật (dù code đã có 75-80%)

### P2 (xử lý trong 3 tháng tới)
- Không có Alembic migrations; SQLite chưa encrypted
- Hardcoded credentials; thiếu structured logging
- SRAU + FLA chưa port sang Python; thiếu rate limiting, Docker, CI/CD

---

## 8. Priority Roadmap (Top 10 việc nên làm tiếp theo)

1. **JWT Authentication** — bảo vệ toàn bộ API trước (python-jose + passlib[bcrypt])
2. **RBAC** — phân quyền analyst/supervisor/admin
3. **AES-256 PII Encryption** — field-level cho phone/name/address
4. **Implement Analytics Router** — wire 13 endpoint đang stub vào logic analytics đã có
5. **Wire GTP Exporter vào HTTP endpoint** — logic đã sẵn, chỉ thiếu route
6. **Viết test thật cho import_service.py** — thay 7 placeholder `...` bằng assertion thật
7. **Hoàn thiện 4 endpoint M4 Import Router còn stub** — batch list/detail/delete/retry
8. **Seed BTS Coordinate Database** — tìm nguồn data thật (OpenCellID/BTTTT), viết importer
9. **Validate Vinaphone/Mobifone parser với CDR file thật** — code đã có, cần test thực tế
10. **Setup Alembic migration** — trước khi schema thay đổi thêm với data thật

---

## 9. Important Documents

| File | Vai trò |
|---|---|
| **`docs/PROJECT_MEMORY_MASTER.md`** (file này) | Single Source of Truth — đọc đầu tiên |
| `docs/TECHNICAL_AUDIT_2026.md` | Audit kỹ thuật đầy đủ 11 mục, nguồn cho Module Status và Audit Facts ở trên |
| `docs/UPGRADE_IDEAS_2026.md` | Phân tích từ 20 tài liệu markdown, Top 20 ý tưởng nâng cấp, roadmap Phase A-E (góc nhìn từ docs, không phải source-level) |
| `CHANGELOG_M4.md` | Tuyên bố M4 = 13/15 — **mâu thuẫn với FEATURE_INVENTORY.md, không hoàn toàn đáng tin** |
| `FEATURE_INVENTORY.md` | Tuyên bố M4 = 0/15 — **outdated, không cập nhật theo code thực tế** |
| `docs/architecture.md`, `docs/proposed_architecture.md` | Thiết kế kiến trúc tương lai — **không phải mô tả hiện trạng** |

---

## 10. Instructions For Future Claude Sessions

- **Luôn đọc `PROJECT_MEMORY_MASTER.md` này trước** khi bắt đầu bất kỳ nhiệm vụ nào trên dự án.
- **Không audit lại toàn bộ dự án** nếu chưa có thay đổi lớn (refactor, sprint mới, merge lớn) — dùng dữ liệu trong file này.
- **Không kết luận parser Vinaphone hoặc Mobifone là "stub"** — đã xác minh cả hai có implementation thật (80%/75%).
- **Source code luôn là nguồn sự thật cuối cùng** khi tài liệu (CHANGELOG_M4, FEATURE_INVENTORY, architecture docs) mâu thuẫn với thực tế.
- **Không tin số liệu hoàn thành trong CHANGELOG_M4.md hoặc FEATURE_INVENTORY.md** mà không verify — cả hai từng sai lệch với source code.
- **Analytics Router là 0% (toàn bộ stub)** dù logic Python phía sau đã có — đừng giả định API hoạt động chỉ vì service layer có code.
- **Chỉ đọc thêm tài liệu hoặc source code khi nhiệm vụ thực sự yêu cầu** — ví dụ: cần sửa code thì phải đọc code, nhưng cần trả lời câu hỏi tổng quan thì dùng file này là đủ.
- **Ưu tiên tiết kiệm context/token**: tránh Glob/Grep toàn dự án nếu thông tin đã có trong file này hoặc trong `TECHNICAL_AUDIT_2026.md`.
- Khi cần audit module mới hoặc thay đổi lớn xảy ra, audit có mục tiêu (targeted, không quét toàn bộ) và **cập nhật lại file này** sau khi có kết luận mới.
