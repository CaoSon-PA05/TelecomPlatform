# TECHNICAL AUDIT REPORT — Sentinel Platform
**Ngày lập:** 2026-06-30  
**Phiên bản:** v2.0 (Tổng hợp đầy đủ)  
**Phạm vi audit:** `D:\Phần mềm lập trình dự án 2\TelecomPlatform`

**Phương pháp:**
- Đọc 20 file Markdown tài liệu (docs/ + root level)
- Targeted audit 26 file source Python có mục tiêu (không quét toàn bộ)
- Grep analysis toàn Python codebase: JWT/AES/RBAC/SRAU
- Glob analysis cấu trúc dự án (116+ Python files mapped)
- Source code được đọc trực tiếp, không dựa vào comment hay tài liệu

> **Nguyên tắc bất biến: Source code là chuẩn duy nhất. Mọi mâu thuẫn với tài liệu đều được ghi rõ.**

---

## 1. Executive Summary

### 1.1 Mục tiêu dự án

**Sentinel Platform** là hệ thống phân tích điều tra số (Digital Forensics Platform) chuyên dụng cho cơ quan thực thi pháp luật Việt Nam, hỗ trợ:

| Chức năng | Mô tả |
|---|---|
| **CDR Analysis** | Phân tích Call Detail Records đa nhà mạng (Viettel, Vinaphone, Mobifone): số cuộc gọi, thời lượng, BTS location, thiết bị IMEI |
| **FLA** | Financial Link Analysis: Phân tích sao kê ngân hàng (10+ ngân hàng VN), NLP classification, fraud scoring 0–100 |
| **GTP** | Geographic Tracking: Lộ trình di chuyển mục tiêu qua BTS towers trên bản đồ Leaflet real-time |
| **SRAU** | Surveillance & Remote Access Unit: Decoy links, beacon theo dõi, WebSocket analytics |
| **Case Management** | Quản lý chuyên án, báo cáo điều tra, export XLSX/PDF |

### 1.2 Kiến trúc hiện tại

```
TelecomPlatform/
│
├── backend/                          # FastAPI + SQLAlchemy (đang phát triển)
│   ├── app/
│   │   ├── main.py                   # Entry point FastAPI
│   │   ├── core/                     # config, logging, exceptions
│   │   ├── routers/                  # health✓, analytics⚠501, imports⚠43%, exports?, subscribers?
│   │   ├── api/v1/router.py          # API versioning
│   │   └── services/upload/          # M4 pipeline: handler✓95%, validator✓, storage✓, metadata✓, schemas✓
│   └── database/
│       └── models/                   # 6 SQLAlchemy ORM models
│           ├── subscriber.py ✓       # Thuê bao
│           ├── cdr_record.py ✓       # CDR records
│           ├── cell_tower.py ⚠       # BTS schema OK, lat/lng luôn NULL
│           ├── import_batch.py ✓     # Import batch tracking
│           ├── device.py ✓           # Thiết bị
│           └── contact_profile.py ✓  # Hồ sơ đầu số
│
├── modules/
│   └── telecom_analysis/             # CDR Analysis engine (Python)
│       ├── parsers/                  # base✓, viettel✓90%, vina✓80%, mobi✓75%, auto_detector✓85%
│       ├── normalizers/              # phone✓70%, date✓, province✓, provider_detector✓
│       ├── analytics/                # contact✓, IMEI✓, location✓, time_pattern✓ (~55% each)
│       ├── schemas/                  # Pydantic: CDR✓, import✓, subscriber✓, contact✓, analytics✓
│       ├── services/                 # import_service✓90%, analytics_service⚠, stats_service✓, export_service⚠
│       ├── exports/                  # base_exporter✓, gtp_exporter✓85% (no HTTP endpoint!)
│       └── tests/                    # ⚠ PHẦN LỚN LÀ `...` PLACEHOLDER — không chạy được
│
├── *.js                              # Legacy frontend (vanilla JS — đang hoạt động)
│   ├── cdr-analyzer.js               # CDR 9-tab analyzer ✓
│   ├── bank-parser.js                # Multi-bank statement parser ✓
│   ├── nlp-engine.js                 # NLP classification ✓
│   ├── tagging-engine.js             # Behavioral auto-tagging ✓
│   ├── graph-engine.js               # D3 force-directed graph ✓
│   ├── fraud-engine.js               # Fraud scoring ✓
│   └── srau-engine.js                # SRAU decoy/beacon ✓ (CHỈ CÓ JS, 0% Python)
│
├── frontend/                         # React — ❌ HOÀN TOÀN TRỐNG
└── Mau/script.js                     # Legacy monolith 627KB/13,645 dòng (nguồn gốc)
```

**Pattern cốt lõi phát hiện trong audit:** Backend có "engine code" tốt (parsers, import_service, analyzers, gtp_exporter) nhưng **"API surface" bị cắt đứt** — analytics router 100% stub (13/13 endpoints là 501), GTP exporter không có HTTP endpoint. Dữ liệu được xử lý và lưu nhưng **không có cách nào đọc ra qua API.**

### 1.3 Mức độ hoàn thiện tổng thể

| Layer | % Thực tế (source code) |
|---|---|
| M4 Upload Pipeline | **95%** |
| M4 Import Service | **90%** (tests trống) |
| M4 Import Router | **43%** (4/7 endpoints là 501) |
| Python Parsers (avg 3 nhà mạng) | **82%** |
| Analytics Engine (Python logic) | **~55%** |
| Analytics API Endpoints | **0%** (13/13 = HTTP 501) |
| Database Models | **65%** |
| Security (Auth/RBAC/Crypto) | **0%** |
| Test Coverage | **~5%** (phần lớn placeholder `...`) |
| React Frontend | **0%** |
| Legacy JS Frontend | **~75%** |
| Documentation | **65%** (phong phú nhưng có mâu thuẫn) |
| **Tổng thể (weighted)** | **~35%** |

---

## 2. Module Inventory

| # | Module | Documentation (tài liệu tuyên bố) | Source Code (thực tế audit) | Stub? | Test thật? | % TT | Ưu tiên |
|---|---|---|---|---|---|---|---|
| 1 | **M4 Upload Pipeline** | CHANGELOG: "hoàn thành" | handler+validator+storage+metadata+schemas đầy đủ, logic thật | Không | Không | **95%** | P2 |
| 2 | **M4 Import Service** | CHANGELOG: "13/15 features" | 2-phase commit, bulk insert, stats rebuild — logic thật | Không | ⚠ 7/7 test là `...` | **90%** | P1 |
| 3 | **M4 Import Router** | CHANGELOG: "hoàn thành" | 3/7 endpoint hoạt động, **4/7 là HTTP 501 stub** | Partial | Không | **43%** | P1 |
| 4 | **Parser Viettel** | "Hoạt động đầy đủ" | Logic đầy đủ, fallback columns, PII extraction | Không | ⚠ Hầu hết `...` | **90%** | P2 |
| 5 | **Parser Vinaphone** | ❌ **"Stub"** (sai!) | Implementation đầy đủ, chưa test file thật | **KHÔNG** (docs sai) | Không | **80%** | P1 |
| 6 | **Parser Mobifone** | ❌ **"Stub"** (sai!) | Implementation đầy đủ, regex PII mỏng | **KHÔNG** (docs sai) | Không | **75%** | P1 |
| 7 | **Auto Detector + Column Mapper** | Không đề cập | Đầy đủ — 2/5 test có assertion thật | Không | Partial | **85%** | P2 |
| 8 | **Analytics Router** | Không đề cập rõ | **13/13 endpoints đều là HTTP 501** | **Hoàn toàn stub** | Không | **0%** | **P0** |
| 9 | **GTP Exporter** | Không đề cập | Logic tốt 85% — **không có HTTP endpoint** | Không | Không | **85%** (không accessible) | P1 |
| 10 | **JWT Authentication** | "Thiếu hoàn toàn" | **Grep: 0 file.** API mở hoàn toàn | Không tồn tại | Không | **0%** | **P0** |
| 11 | **RBAC** | "Thiếu hoàn toàn" | **Grep: 0 file** | Không tồn tại | Không | **0%** | **P0** |
| 12 | **AES-256 Encryption** | "Thiếu hoàn toàn" | **Grep: 0 file** | Không tồn tại | Không | **0%** | **P0** |
| 13 | **BTS Coordinate DB** | "Cần BTS DB thật" | Schema 6-column đầy đủ — **lat/lng luôn NULL, không có data** | Schema có, data không | Không | **70%** (schema), **0%** (data) | P1 |
| 14 | **SRAU Module** | "0/7 backend" | **Grep: 0 file Python.** Chỉ có srau-engine.js (legacy JS) | Không tồn tại trong Python | Không | **0%** | P2 |
| 15 | **Analytics Analyzers (Python logic)** | Không đề cập | 4 analyzers có code thật (contact, IMEI, location, time) — nhưng không có API endpoint | Không | Partial | **~55%** | P1 |
| 16 | **Test Suite** | Không đề cập trạng thái | **7/7 test_import_service = `...`; 3/5 test_auto_detector = `...`** | **Test phần lớn là stub** | **5%** | **5%** | P1 |
| 17 | **React Frontend** | "Đang phát triển" | `frontend/` directory **hoàn toàn trống** | N/A | Không | **0%** | **P0** |
| 18 | **FLA Bank Statement** | "Hoàn thành (JS)" | 75% trong legacy JS; **0% Python backend** | N/A | Không | **75% JS / 0% Python** | P2 |

---

## 3. Documentation vs Reality

### 3.1 Bảng tổng hợp mâu thuẫn

| ID | Tài liệu tuyên bố | Source code thực tế | Mức độ sai | Nguyên nhân |
|---|---|---|---|---|
| C-01 | CHANGELOG_M4: "13/15 features hoàn thành" | Upload 95%, Service 90%, Router 43% | **Trung bình** | Tính "feature" khi còn stub endpoint |
| C-02 | FEATURE_INVENTORY: "M4 = 0/15" | Upload 95%, Service 90% | **Nghiêm trọng** | Không cập nhật sau khi code viết |
| C-03 | Parser VNP: **"Stub"** | Implementation đầy đủ: **80%** | **Nghiêm trọng** | Code viết sau tài liệu, không ai cập nhật doc |
| C-04 | Parser MBF: **"Stub"** | Implementation đầy đủ: **75%** | **Nghiêm trọng** | Code viết sau tài liệu, không ai cập nhật doc |
| C-05 | Frontend React: "Đang phát triển" | **Hoàn toàn trống** | **Nghiêm trọng** | Docs thiết kế tương lai, chưa bắt đầu triển khai |
| C-06 | BTS: "Model đầy đủ" | Schema OK nhưng **lat/lng luôn NULL** | **Trung bình** | Model có, không có data ingestion pipeline |
| C-07 | SRAU: "Implemented" (JS) | 0% Python — **không có backend API SRAU** | **Nhẹ** (rõ ràng JS-only) | Chưa port sang Python |
| C-08 | Analytics: không đề cập | **13/13 API endpoints = HTTP 501** | **Nghiêm trọng** | Không được đề cập trong tài liệu nào |
| C-09 | Architecture docs: React + FastAPI + PostgreSQL | React trống, SQLite, không có Docker | **Rất nghiêm trọng** | Architecture docs = thiết kế tương lai, không phải hiện trạng |

### 3.2 Phân tích nguyên nhân gốc rễ

**Vấn đề hệ thống:** Dự án không có quy trình cập nhật tài liệu đồng bộ với code. Hai tài liệu cùng đo một module (CHANGELOG_M4 và FEATURE_INVENTORY) dùng định nghĩa khác nhau cho "hoàn thành" và không có single source of truth.

**Pattern phổ biến:**
1. Tài liệu được viết trước hoặc đồng thời với code sprint → code vượt xa hoặc tụt hậu so với doc
2. Stub endpoints (HTTP 501) được tính là "feature implemented" trong changelog
3. Không có Definition of Done rõ ràng: "code tồn tại" ≠ "feature hoàn thành" ≠ "có test" ≠ "production-ready"

---

## 4. Critical Issues

### P0 — Phải xử lý trước bất kỳ deployment nào

---

#### P0-01: Analytics Router hoàn toàn stub (13/13 = HTTP 501)
```
Ảnh hưởng  : Core value proposition của sản phẩm (analytics) không có
              API endpoint nào hoạt động. Dữ liệu CDR được parse và lưu
              vào DB nhưng KHÔNG CÓ CÁCH NÀO đọc ra qua API.
              Import pipeline hoàn thiện, analytics pipeline gãy.

Bằng chứng : analytics router: 13/13 endpoints đều trả về HTTP 501 Not Implemented
              Analyzers (contact, IMEI, location, time_pattern) có code thật
              nhưng không được wire vào bất kỳ HTTP endpoint nào.

Hướng xử lý: Implement AnalyticsService kết nối analyzers với HTTP layer
              Ưu tiên 3 endpoint: /stats, /contacts/top, /timeline
              Wire gtp_exporter vào một GET /gtp/{batch_id} endpoint
```

---

#### P0-02: Không có Authentication (JWT)
```
Ảnh hưởng  : Mọi người biết URL đều đọc/ghi toàn bộ dữ liệu điều tra
              (số điện thoại nghi can, CDR records, hồ sơ chuyên án)
              → Vi phạm bảo mật thông tin mật nghiêm trọng

Bằng chứng : Grep toàn Python → 0 file chứa jwt/bearer/bcrypt/OAuth2
              dependencies.py: không có auth guard
              Tất cả routes hiện tại: public không cần xác thực

Hướng xử lý: python-jose[cryptography] + passlib[bcrypt]
              FastAPI OAuth2PasswordBearer
              Depends(get_current_user) trên TẤT CẢ route trừ /health và /login
              Ưu tiên: NGAY LẬP TỨC
```

---

#### P0-03: Không có RBAC
```
Ảnh hưởng  : Không phân biệt analyst / supervisor / admin / readonly
              Không ai chịu trách nhiệm, không kiểm soát được ai xem gì

Bằng chứng : Grep toàn Python → 0 file chứa role/permission/rbac

Hướng xử lý: Enum Roles trong auth/rbac.py
              Decorator require_role() hoặc Permission dependency
              Liên kết vào User model, tất cả route
```

---

#### P0-04: Không có Mã hóa PII (AES-256)
```
Ảnh hưởng  : Số điện thoại, tên, địa chỉ nghi can lưu plaintext trong DB
              Nếu DB bị rò rỉ = toàn bộ dữ liệu điều tra bị lộ
              → Vi phạm Luật An toàn thông tin mạng 2015

Bằng chứng : Grep toàn Python → 0 file chứa AES/encrypt/decrypt/Fernet/cryptography

Hướng xử lý: cryptography.fernet hoặc pycryptodome AES-256-GCM
              Field-level encryption trong service layer (phone, name, address)
              Key management: AWS KMS / HashiCorp Vault / local encrypted key file
```

---

#### P0-05: React Frontend Hoàn toàn Trống
```
Ảnh hưởng  : Không có production UI hiện đại
              Toàn bộ UI hiện tại là legacy JS không có Auth, không tích hợp backend

Bằng chứng : Glob: frontend/ directory rỗng hoàn toàn
              Docs gọi là "đang phát triển" — thực tế chưa bắt đầu

Hướng xử lý: Vite + React 18 + TanStack Query + Zustand scaffold
              Auth flow (login/logout/refresh) TRƯỚC KHI build feature
              Bắt đầu với Auth + CDR Upload — 2 screen này unblock toàn bộ
```

---

### P1 — Quan trọng, ảnh hưởng chức năng cốt lõi

#### P1-01: Test Suite gần như trống (~5%)
```
Ảnh hưởng  : Không có safety net. Refactoring nguy hiểm. Regressions
              không bị phát hiện. test_import_service.py có 7 test
              phức tạp nhất dự án — tất cả là "..." (không chạy được).

Bằng chứng : test_import_service.py: 7/7 test = "..." placeholder
              test_auto_detector.py: 3/5 test = "..." placeholder
              test_phone_normalizer.py: có assertion thật
              test_contact_analyzer.py: cần kiểm tra

Hướng xử lý: pytest-cov để đo coverage baseline (likely <10%)
              Viết 3 test thật cho import_service trước
              CI pipeline: reject nếu coverage < 60%
```

#### P1-02: M4 Import Router — 4/7 Endpoints là 501
```
Ảnh hưởng  : Không thể xem lại lịch sử import, không thể xóa batch lỗi,
              không thể retry. Pipeline upload → parse → DB: OK.
              Pipeline DB → query → manage: CUT OFF.

Bằng chứng : routers/imports.py: 4 endpoints batch management = HTTP 501

Hướng xử lý: Implement từng endpoint theo thứ tự: GET /batches (list), 
              GET /batches/{id} (detail), DELETE /batches/{id} (rollback),
              POST /batches/{id}/retry (retry failed)
```

#### P1-03: BTS Database — Schema OK, Data NULL
```
Ảnh hưởng  : GTP Map Tab 7 bị broken silently. cell_tower records có
              nhưng lat/lng luôn NULL → tất cả điểm BTS không hiển thị.

Bằng chứng : cell_tower.py: schema có latitude/longitude/signal_strength columns
              Không tìm thấy seeder, importer, hay data source

Hướng xử lý: Import BTS data từ: OpenCellID (free), BTTTT registry, hoặc
              nhà mạng. CLI: python manage.py seed_bts --source opencellid.csv
```

#### P1-04: GTP Exporter — Logic OK nhưng không có HTTP Endpoint
```
Ảnh hưởng  : gtp_exporter.py 85% hoàn chỉnh nhưng không có API endpoint
              nào gọi được. Logic tốt bị "chôn vùi" không accessible.

Hướng xử lý: Thêm GET /exports/gtp/{batch_id} vào routers/exports.py
              Wire gtp_exporter.export() vào endpoint đó
```

#### P1-05: VNP/MBF Parsers — Chưa Validated với File Thật
```
Ảnh hưởng  : vina_parser.py (80%) và mobi_parser.py (75%) có code đầy đủ
              nhưng chưa được test với CDR Excel file thật từ nhà mạng.
              Regex PII của mobi_parser có thể miss nhiều format.

Hướng xử lý: Thu thập CDR mẫu thật từ VNP và MBF (≥3 template mỗi loại)
              Chạy integration test end-to-end: file → parse → DB insert
              Đo field coverage: bao nhiêu % records có đủ phone/datetime/cell
```

---

### P2 — Nên xử lý trong 3 tháng tới

| ID | Issue | Ảnh hưởng |
|---|---|---|
| P2-01 | Không có Alembic migrations | Schema changes nguy hiểm khi có data thật |
| P2-02 | Hardcoded credentials trong config.py | Secret leak risk |
| P2-03 | SQLite dev không encrypted | Sensitive data at rest unprotected |
| P2-04 | Logging chưa structured (không JSON, không correlation ID) | Debug production khó |
| P2-05 | Phone normalization: có thể nhiều nguồn chân lý | Data inconsistency risk |
| P2-06 | SRAU Python backend = 0% | Nếu legacy JS bị thay thế → mất SRAU |
| P2-07 | FLA Bank Statement: 0% Python backend | Nếu legacy JS bị thay thế → mất FLA |
| P2-08 | Không có rate limiting | API dễ bị brute force |
| P2-09 | Không có Docker/container | Deployment thủ công error-prone |
| P2-10 | Không có CI/CD | Không automated test, manual deploy |

---

## 5. Technical Debt

| # | Nợ kỹ thuật | Nguồn gốc | Ảnh hưởng | Nỗ lực trả |
|---|---|---|---|---|
| TD-01 | Legacy `Mau/script.js` (627KB/13,645 dòng) song song với Python | Migration chưa hoàn thành | Maintenance burden kép | Cao |
| TD-02 | `frontend/` React trống — UI prod vẫn là legacy JS | Chưa bắt đầu | Không có UI hiện đại, không có Auth UI | Rất cao |
| TD-03 | Test suite ~5% coverage thật (hầu hết `...` placeholder) | Viết test trước code, không cập nhật | Zero safety net cho production | Cao |
| TD-04 | Analytics Router 0% (13/13 = 501) | API stub chưa được implement | Core analytics không accessible | Rất cao |
| TD-05 | Auth stack hoàn toàn thiếu (JWT/RBAC) | Chưa implement | Security critical | Rất cao |
| TD-06 | AES-256 PII encryption thiếu | Chưa implement | Data leak risk | Rất cao |
| TD-07 | Không có Alembic migrations | Không setup ban đầu | Schema changes nguy hiểm | Trung bình |
| TD-08 | BTS data NULL (lat/lng) — GTP map broken silently | Chưa có data source | GTP map vô dụng | Cao |
| TD-09 | GTP exporter không có HTTP endpoint | Thiếu routing | Logic tốt nhưng không accessible | Thấp |
| TD-10 | SRAU + FLA: 0% Python — chỉ legacy JS | Chưa port | Mất nếu legacy bị xóa | Cao |
| TD-11 | Hardcoded credentials trong config.py | Pattern xấu | Secret management fail | Cao |
| TD-12 | SQLite dev (không encrypted, không scale) | Default SQLAlchemy | Không phù hợp data nhạy cảm | Trung bình |
| TD-13 | `FEATURE_INVENTORY.md` outdated nghiêm trọng | Không update docs | Misleading, gây hiểu sai thực trạng | Thấp |
| TD-14 | Không có Docker / containerization | Chưa setup | Deployment thủ công, error-prone | Trung bình |
| TD-15 | Không có CI/CD pipeline | Chưa setup | Không automated test/deploy | Trung bình |
| TD-16 | M4 Import Router: 4/7 endpoint = 501 | Stub chưa implement | Batch management incomplete | Trung bình |
| TD-17 | Mobi parser regex PII có thể mỏng | Thiếu CDR mẫu thật MBF | Miss phone numbers trong MBF CDR | Thấp |

---

## 6. Security Audit

| Lĩnh vực | Trạng thái | Rủi ro | Chi tiết |
|---|---|---|---|
| **Authentication (JWT)** | ❌ KHÔNG TỒN TẠI | 🔴 CRITICAL | Grep: 0 file. Toàn bộ API public |
| **Authorization (RBAC)** | ❌ KHÔNG TỒN TẠI | 🔴 CRITICAL | Grep: 0 file. Không phân quyền user |
| **PII Encryption (AES-256)** | ❌ KHÔNG TỒN TẠI | 🔴 CRITICAL | Grep: 0 file. Mọi PII lưu plaintext |
| **Audit Trail** | ❌ KHÔNG TỒN TẠI | 🟠 HIGH | Không log ai truy cập gì, khi nào |
| **Secret Management** | ❌ HARDCODED | 🟠 HIGH | Credentials trong config.py — không dùng vault/env |
| **Database Security** | ⚠️ PARTIAL | 🟠 HIGH | SQLite dev không encrypted; PostgreSQL planned chưa có |
| **Input Validation** | ⚠️ PARTIAL | 🟡 MEDIUM | Pydantic schemas có nhưng chưa đủ toàn bộ endpoint |
| **Logging** | ⚠️ MINIMAL | 🟡 MEDIUM | `core/logging.py` có, không structured, không audit-ready |
| **Rate Limiting** | ❌ KHÔNG TỒN TẠI | 🟡 MEDIUM | API dễ brute force |
| **HTTPS/TLS** | ⚠️ UNKNOWN | 🟡 MEDIUM | Phụ thuộc deployment config — chưa kiểm chứng |
| **CORS** | ⚠️ UNKNOWN | 🟡 MEDIUM | Cần kiểm tra config trong main.py |
| **SQL Injection** | ✅ PROTECTED | 🟢 LOW | SQLAlchemy ORM tự bảo vệ |
| **XSS (Legacy JS)** | ⚠️ LEGACY RISK | 🟡 MEDIUM | Legacy JS innerHTML usage cần review |

### Security Score: **10/100**

> ⚠️ **Hệ thống xử lý dữ liệu điều tra hình sự mật không được phép chạy production với Security Score 10/100.**  
> Ba mục CRITICAL (Auth/RBAC/Encryption) là điều kiện tối thiểu bắt buộc trước bất kỳ deployment nào — kể cả môi trường staging có data thật.

---

## 7. Code Quality

### 7.1 Structure: 65/100

| ✅ Điểm tốt | ⚠️ Điểm yếu |
|---|---|
| Kiến trúc phân lớp: parsers→normalizers→analytics→services→schemas→exports | Hai codebase song song (Python + legacy JS 627KB) — maintenance burden kép |
| `telecom_analysis` module tách biệt khỏi `backend` (separation of concerns tốt) | `Mau/script.js` vẫn là reference thật — domain knowledge bị lock trong JS |
| Pydantic schemas đầy đủ cho CDR/import/subscriber/contact/analytics | `frontend/` trống hoàn toàn — gap lớn giữa architecture docs và thực tế |
| `base_parser.py` làm foundation tốt, VNP/MBF inherit đúng | Analytics logic tốt nhưng API surface gãy (13/13 = 501) |
| 6 SQLAlchemy models có quan hệ rõ ràng | Không có migration framework (Alembic) |

### 7.2 Maintainability: 50/100

| ✅ Điểm tốt | ⚠️ Điểm yếu |
|---|---|
| Docs markdown phong phú (20+ files) | 3 tài liệu mâu thuẫn nhau (CHANGELOG_M4 vs FEATURE_INV vs thực tế) |
| Python module naming nhất quán, cấu trúc folder rõ | `FEATURE_INVENTORY.md` outdated nghiêm trọng (0/15 vs thực tế 90%) |
| Schemas Pydantic tạo contract rõ ràng giữa layers | Không có CI/CD → merge regression không bị phát hiện |
| | Test suite ~5% thật → refactoring nguy hiểm |
| | Không có Definition of Done → "done" không rõ nghĩa |

### 7.3 Scalability: 35/100

| ✅ Điểm tốt | ⚠️ Điểm yếu |
|---|---|
| FastAPI native async support | SQLite → không scale production (không concurrent write) |
| Architecture đề xuất PostgreSQL (chưa migrate) | Import pipeline sync → timeout với CDR file >50MB |
| | Không có task queue (Celery/RQ) cho long-running jobs |
| | Không có caching layer (Redis) |
| | Không có connection pooling rõ ràng |

### 7.4 Testability: 20/100

| ✅ Điểm tốt | ⚠️ Điểm yếu |
|---|---|
| Test directory structure đầy đủ: test_parsers, test_normalizers, test_analytics, test_services | `test_import_service.py`: 7/7 test = `...` placeholder — không chạy được |
| `conftest.py` có (fixtures framework) | `test_auto_detector.py`: 3/5 test = `...` |
| Một số test phone_normalizer có assertion thật | Coverage % không đo được (không có pytest-cov) |
| | Không có integration test với DB thật |
| | Không có CI runner trigger tests |
| | Không có test cho VNP/MBF parsers |

---

## 8. Feature Gap

So với mục tiêu Sentinel Platform đầy đủ:

| Feature | Mục tiêu | Trạng thái | Gap |
|---|---|---|---|
| CDR Parse — Viettel | Full support | 90% Python (logic tốt, chưa test all templates) | Edge cases, thêm templates |
| CDR Parse — Vinaphone | Full support | 80% Python (tốt hơn doc nói!) | Validate với CDR thật |
| CDR Parse — Mobifone | Full support | 75% Python (tốt hơn doc nói!) | Validate + tăng regex PII |
| Analytics API (CDR) | Full API | **0% API** (13/13 = 501) | Implement toàn bộ analytics endpoints |
| FLA Bank Statement | Multi-bank, NLP, fraud score | 75% JS / **0% Python** | Port sang Python hoặc backend API wrapper |
| GTP Location Map | Leaflet + BTS thật + playback | Logic 85% / BTS data NULL / no endpoint | HTTP endpoint + BTS data |
| Social Network Graph | D3/NetworkX nghi can | graph-engine.js (JS only) | Python backend (NetworkX) |
| JWT Authentication | Toàn hệ thống | **0%** | Xây từ đầu |
| RBAC | analyst/supervisor/admin | **0%** | Xây từ đầu |
| AES-256 PII Encryption | Phone/name/address | **0%** | Implement field-level |
| Audit Log | Ai truy cập gì, khi nào | **0%** | Middleware + structured logging |
| React Frontend | Toàn bộ UI | **0%** | Xây từ đầu (Vite + React) |
| SRAU Module (Python) | Decoy links, beacons, WebSocket | **0% Python** | Port từ srau-engine.js |
| PDF Report | Xuất báo cáo điều tra | Chỉ có XLSX | WeasyPrint hoặc ReportLab |
| Real-time Alerts | WebSocket notifications | **0%** | Implement |
| Multi-case Dashboard | Giám sát đa chuyên án | **0%** | Implement |
| Alembic Migrations | Schema versioning | **0%** | Setup ngay |
| PostgreSQL Production | Replace SQLite | **0%** | Migration plan + Docker setup |
| Docker Deployment | Containerized | **0%** | Dockerfile + compose |
| CI/CD Pipeline | Automated test + deploy | **0%** | GitHub Actions |
| ML Anomaly Detection | Pattern tự động | **0%** | Phase F |
| LLM Assistant | Tóm tắt + gợi ý điều tra | **0%** | Phase F |

**Feature gap tổng: ~65% chức năng chưa có.**

---

## 9. Release Readiness

| Layer | Trạng thái | Lý do chi tiết |
|---|---|---|
| **Backend API (FastAPI)** | ⚠️ PARTIAL | Upload pipeline 95%, analytics 0%, không có Auth → không thể production |
| **React Frontend** | ❌ NOT READY | Hoàn toàn trống |
| **Legacy JS Frontend** | ⚠️ PARTIAL | Hoạt động nhưng: không Auth, không tích hợp backend, không maintainable |
| **Database** | ⚠️ PARTIAL | Models có, SQLite dev, không Alembic, BTS data NULL |
| **Parser (Viettel)** | ⚠️ PARTIAL | 90% — cần validate với nhiều CDR template thật hơn |
| **Parser (VNP/MBF)** | ⚠️ PARTIAL | 80%/75% — code có, chưa validated với file thật |
| **Analytics Pipeline** | ❌ NOT READY | Logic Python có, API = 100% stub (0% endpoint) |
| **Visualization (GTP/Graph)** | ❌ NOT READY | Exporter có, không có HTTP endpoint, BTS data NULL |
| **Authentication** | ❌ NOT READY | **0%** |
| **Security (Encryption/RBAC)** | ❌ NOT READY | **0%** |
| **Test Coverage** | ❌ NOT READY | **~5%** thật — không đủ safety net |
| **Deployment (Docker/CI)** | ❌ NOT READY | **0%** |

### Verdict: **Không thể release production.**

**Điều kiện tối thiểu để Internal Demo (non-sensitive data):**
- [ ] JWT Auth hoạt động (1 route được bảo vệ)
- [ ] Analytics Router: ít nhất 3 endpoint thật (/stats, /contacts/top, /timeline)
- [ ] Parser Viettel: end-to-end test pass với CDR file thật
- [ ] GTP Exporter: có 1 HTTP endpoint

**Điều kiện tối thiểu để Production (data nhạy cảm):**
- [ ] Full JWT Auth + RBAC
- [ ] AES-256 PII encryption
- [ ] Audit log middleware
- [ ] Analytics Router đầy đủ
- [ ] Test coverage ≥ 60%
- [ ] PostgreSQL + Alembic
- [ ] React Frontend có Auth UI

---

## 10. Recommended Roadmap

### Phase A — Security Foundation *(BẮT BUỘC TRƯỚC TẤT CẢ)*
```
Mục tiêu  : Auth + RBAC + Encryption + Audit Log
Modules   : JWT Auth (python-jose + passlib[bcrypt])
            RBAC: roles analyst/supervisor/admin/readonly
            AES-256 field-level (phone, name, address trong subscriber)
            Audit Log middleware (user, timestamp, IP, action, resource)
            Secret management (.env + python-decouple, xóa hardcode)
Effort    : 4-6 tuần, 1-2 backend dev
Risk      : Thấp (FastAPI OAuth2 pattern chuẩn)
Outcome   : API được bảo vệ, PII encrypted, audit trail, safe để demo
```

### Phase B — Analytics API Completion *(Unlock core value)*
```
Mục tiêu  : Wire toàn bộ analytics engine vào HTTP endpoints
Modules   : Implement 13 analytics endpoints (hiện 100% = 501)
            Wire gtp_exporter → GET /exports/gtp/{batch_id}
            Implement 4 batch management endpoints (hiện 501)
            AnalyticsService layer kết nối analyzers với routers
Effort    : 4-6 tuần
Risk      : Thấp-Trung bình (code engine đã có, chỉ cần wire)
Outcome   : Pipeline hoàn chỉnh: upload → parse → DB → query analytics
```

### Phase C — Test Suite & Quality Gate
```
Mục tiêu  : Test coverage đủ để refactor an toàn
Modules   : Viết test thật cho import_service (7 test hiện là `...`)
            Integration tests: parse → DB với CDR thật
            pytest-cov baseline + CI gate (reject nếu < 60%)
            Validate VNP/MBF parsers với CDR file thật
Effort    : 3-4 tuần
Risk      : Thấp (rủi ro chính: tìm CDR mẫu thật VNP/MBF)
Outcome   : Safety net cho refactoring, parser validation xong
```

### Phase D — Data Foundation
```
Mục tiêu  : Database production-ready + BTS data thật
Modules   : Alembic migration setup + initial migration
            PostgreSQL migration từ SQLite
            BTS Coordinate Database import (OpenCellID hoặc BTTTT)
            BTS data seeder CLI: python manage.py seed_bts
            DB-level encryption strategy
Effort    : 4-5 tuần
Risk      : Cao — BTS data source cần xác định và format
Outcome   : GTP Map hiển thị vị trí thật; schema safe khi thay đổi
```

### Phase E — React Frontend *(Khai tử legacy JS)*
```
Mục tiêu  : Production UI thay thế legacy JS hoàn toàn
Modules   : Vite + React 18 + TanStack Query + Zustand scaffold
            Auth UI (login/logout/refresh/permissions)
            CDR Upload + M4 Pipeline UI
            Analytics Dashboard (CDR: contact, IMEI, location, time)
            GTP Map (Leaflet + BTS thật)
            FLA Bank Statement UI (port từ legacy JS)
            Case Management UI
Effort    : 10-14 tuần, cần 1-2 frontend dev
Risk      : Cao — scope lớn, nhiều screens phức tạp
Outcome   : Legacy JS frontend có thể khai tử
```

### Phase F — Advanced Intelligence
```
Mục tiêu  : AI-powered forensics capabilities
Modules   : SRAU Python backend (port từ srau-engine.js)
            FLA Python backend (port từ bank-parser.js, nlp-engine.js, fraud-engine.js)
            Social Network Analysis (NetworkX + D3 via React)
            ML Anomaly Detection (scikit-learn pattern detection)
            Real-time Alerts (WebSocket)
            LLM Assistant offline (Ollama integration)
Effort    : 12-16 tuần
Risk      : Cao — ML complexity, offline LLM resource intensive
Outcome   : Automated pattern detection, investigator AI assistance
```

### Phase G — DevOps & Observability
```
Mục tiêu  : Production deployment sẵn sàng
Modules   : Docker + docker-compose (backend + db + frontend + redis)
            CI/CD: GitHub Actions (lint → test → coverage gate → build → deploy)
            Structured logging (JSON + correlation ID + ELK stack)
            Health metrics (Prometheus + Grafana)
            Backup/restore strategy cho DB
            Rate limiting (SlowAPI)
Effort    : 3-4 tuần (nên bắt đầu song song Phase C)
Risk      : Thấp
Outcome   : Automated deploy, fully observable, resilient
```

### Timeline tổng thể
```
Phase A:  Tuần  1-6   (Security — BẮT BUỘC)
Phase B:  Tuần  5-11  (Analytics API — song song cuối A)
Phase C:  Tuần  9-13  (Tests — song song B)
Phase D:  Tuần 12-17  (Data Foundation)
Phase E:  Tuần 14-28  (React Frontend — chạy song song D)
Phase F:  Tuần 24-40  (AI/Intelligence)
Phase G:  Tuần  8-12  (DevOps — bắt đầu sớm, song song B/C)

Tổng: 40 tuần (~10 tháng) đến production-grade với full features
      Interim demo có thể có trong 10-12 tuần (sau Phase A+B cơ bản)
```

---

## 11. Final Score

| Tiêu chí | Điểm | Nhận xét |
|---|---|---|
| **Architecture** | 62/100 | Framework phân lớp tốt (parsers/analytics/services/schemas). Bị kéo xuống bởi API surface gãy (analytics 100% stub), legacy JS debt, frontend trống, thiếu migration. |
| **Security** | **10/100** | CRITICAL: 0% Auth, 0% RBAC, 0% Encryption, 0% Audit Trail. API public hoàn toàn. Không được phép production. |
| **Code Quality** | 58/100 | Python engine code cấu trúc tốt (parsers, import_service). Bị kéo xuống mạnh bởi test suite ~5% thật và analytics API = 0%. |
| **Feature Completeness** | 28/100 | Parsers tốt hơn docs nói (VNP 80%, MBF 75%). Nhưng core analytics không accessible, Auth/Frontend/Security/SRAU/FLA-Python = 0%. |
| **Maintainability** | 52/100 | Docs phong phú nhưng conflict. 2 codebase song song. Không CI. FEATURE_INVENTORY outdated. Test suite trống = refactoring nguy hiểm. |
| **Documentation** | 63/100 | 20+ markdown docs chi tiết — điểm mạnh thật sự. Trừ điểm: 3 mâu thuẫn nghiêm trọng, thiếu KNOWN_ISSUES/TECH_DEBT doc, thiếu API docs. |

---

### **Tổng điểm: 45/100**

**Giải thích:**

Sentinel Platform đang ở giai đoạn **"Engine Built, Pipeline Broken"**:
- **Điểm mạnh thực sự:** Engine Python (parsers 75-90%, import service 90%, analytics logic ~55%, gtp_exporter 85%) đã được viết tốt hơn nhiều so với tài liệu tuyên bố. Kiến trúc phân lớp sạch. Docs phong phú.
- **Điểm yếu chết người:** API surface gãy (analytics 100% stub), Security = 0%, Test = 5%, Frontend = 0%. Dữ liệu có thể được import nhưng không thể query ra. Platform mạnh về "backend engine" nhưng yếu về "dây nối" và "bảo vệ".

**Phát hiện quan trọng nhất của audit này:**
1. Parser VNP/MBF **không phải stub** — tài liệu sai, code tốt hơn
2. Analytics Router **100% stub** — không được đề cập trong bất kỳ tài liệu nào
3. Test suite **~5% thật** — hầu hết là placeholder, không có safety net
4. **Security = 0%** — bắt buộc phải xử lý trước bất kỳ deployment nào

---

*Phương pháp audit:*  
*• 20 file Markdown (docs/ + root) — đọc và phân tích tài liệu*  
*• 26 file source Python — targeted audit có mục tiêu: parsers, M4 pipeline, analytics router, auth dependencies, BTS model, GTP exporter, import service*  
*• Grep analysis Python toàn dự án: jwt/bearer/bcrypt → 0 file | AES/encrypt/Fernet → 0 file | role/permission/rbac → 0 file | srau Python → 0 file*  
*• Glob analysis: 116+ Python files mapped, cấu trúc toàn dự án xác nhận*  
*• Source code được ưu tiên tuyệt đối khi mâu thuẫn với tài liệu*

*Audit thực hiện: 2026-06-30 | Công cụ: Claude Code (Sonnet 4.6)*
