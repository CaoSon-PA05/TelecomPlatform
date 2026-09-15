# PROJECT CHECKPOINT — Sentinel Platform (TelecomPlatform)

**Đây là điểm khởi động DUY NHẤT cho mọi phiên Claude sau này. Chỉ cần đọc file này là đủ để tiếp tục phát triển.**

Checkpoint tại: 2026-06-30 — kết thúc giai đoạn Audit & Documentation.

---

## 1. Project Overview

**Tên dự án:** Sentinel Platform (TelecomPlatform)

**Mục tiêu:** Hệ thống phân tích điều tra số (Digital Forensics Platform) cho cơ quan thực thi pháp luật Việt Nam, gồm 4 trụ cột:
- **CDR Analysis** — phân tích Call Detail Records đa nhà mạng (Viettel, Vinaphone, Mobifone)
- **FLA** — Financial Link Analysis: phân tích sao kê ngân hàng, NLP, fraud scoring
- **GTP** — Geographic Tracking: lộ trình di chuyển nghi can qua BTS towers
- **SRAU** — Surveillance & Remote Access Unit: decoy links, beacon tracking

**Kiến trúc:** Hai codebase song song hiện tại:
- **Python backend** (đang phát triển): FastAPI + SQLAlchemy + SQLite, module `telecom_analysis` (parsers/analytics/services/exports)
- **Legacy frontend** (đang hoạt động thật): vanilla JS, nguồn gốc `Mau/script.js` (627KB/13,645 dòng)
- **React frontend** (kế hoạch): chưa bắt đầu, directory `frontend/` trống hoàn toàn

**Trạng thái hiện tại:** ~35% hoàn thành tổng thể. Pattern cốt lõi: **"Engine Built, Pipeline Broken"** — logic Python (parser, import service, analytics) tốt hơn tài liệu cũ mô tả, nhưng API surface bị cắt đứt nghiêm trọng (Analytics Router 0%) và Security chưa tồn tại (0%).

---

## 2. Current Progress

### Đã hoàn thành
- M4 Upload Pipeline (handler/validator/storage/metadata) — 95%
- M4 Import Service (logic 2-phase commit, bulk insert, stats rebuild) — 90%
- Parser Viettel — 90%
- Parser Vinaphone — 80% (không phải stub)
- Parser Mobifone — 75% (không phải stub)
- Auto Detector + Column Mapper — 85%
- Database models (6 SQLAlchemy ORM: subscriber, cdr_record, cell_tower, import_batch, device, contact_profile) — schema 65%
- Analytics logic Python (contact/IMEI/location/time analyzers) — ~55% (code có, không accessible)
- GTP Exporter logic — 85% (không accessible)
- Legacy JS frontend (CDR/FLA/SRAU/GTP modules) — ~75%, hoạt động thật nhưng không có Auth
- **NAPAS Upgrade (trong FLA, legacy JS) — Phase 25 + Post-Phase-25 Fix + Owner-Name Inference: COMPLETE** (2026-09-16) — detection/parsing/pairing/normalization/reconciliation/UI/XLSX export, workbook NAPAS thuần 3 sheet (Doi Ung TK / Doi Soat NAPAS / Truy Tim Tai Khoan, legacy/mixed vẫn giữ nguyên 5 sheet), nút "Refresh" ở top-bar. **Mới nhất:** suy luận trực tiếp tên chủ tài khoản từ nội dung giao dịch CHUYEN (88,1% coverage thật trên 4 fixture bắt buộc, 2 pattern xác minh từ dữ liệu thật, không fuzzy/không đoán), Sheet "Truy Tim Tai Khoan" nâng cấp thành báo cáo có bằng chứng cấp giao dịch (nội dung/REF/ngày/số tiền), Sheet "Doi Ung TK"/"Doi Soat NAPAS" (NAPAS-only) bỏ "Ma Dinh Danh NH"/"Net" khỏi export và đưa tên chủ tài khoản lên đầu — 13 cột thay vì 14, legacy export không đổi 1 cột nào. `bankId`/collision protection/Tier A/B/`resolveCounterparty()` hoàn toàn không đổi. **Fix mới nhất:** Sheet "1. Doi Ung TK" từng hiển thị ngân hàng nguồn (cột "Ngan Hang (Nguon)") xen kẽ lộn xộn cho tài khoản đa ngân hàng (VD 3710105678 tại ACB/VCB/TCB) — điều tra xác nhận dữ liệu/grouping key LUÔN đúng (đã verify từng dòng), lỗi thật chỉ là thứ tự sort của `buildAccountFlowMatrix` (dùng chung Excel export + UI tab) sắp theo tần suất toàn cục thay vì nhóm theo (tài khoản, ngân hàng) trước — đã sửa 1 vị trí duy nhất, xác nhận trên file Excel thật tải từ Chrome thật: 3 ngân hàng nguồn của 3710105678 nay hiển thị thành 3 khối liên tục, không xen kẽ. Browser E2E thật 92/92 PASS tổng cộng (25/25 Phase 25 + 22/22 Refresh + 28/28 owner-inference + 17/17 source-bank sort fix), forensic audit toàn bộ 27 file mẫu thật (21.344 giao dịch, 0 dropped/fabricated). **Technical status: READY. Current gate: BUSINESS ACCEPTANCE** (chưa có xác nhận từ chủ sở hữu nghiệp vụ cho quy trình NAPAS vận hành thật) — xem `docs/NAPAS_UPGRADE_SPEC.md` mục "Current Status Summary", "Phase 25", "Post-Phase-25 Fix", "Owner-Name Inference...", "Fix — Sắp Xếp Lại Ngan Hang (Nguon)..." để biết chi tiết đầy đủ. Chỉ trong phạm vi legacy JS; **không thay đổi** trạng thái "FLA Python backend — 0%" bên dưới.

### Đang làm / chưa hoàn chỉnh
- M4 Import Router — 43% (4/7 endpoint còn HTTP 501)
- BTS Coordinate Database — schema OK, data luôn NULL

### Chưa làm
- Analytics Router API — 0% (13/13 endpoint là HTTP 501)
- JWT Authentication — 0%
- RBAC — 0%
- AES-256 PII Encryption — 0%
- SRAU Python backend — 0% (chỉ có trong legacy JS)
- FLA Python backend — 0% (chỉ có trong legacy JS)
- React Frontend — 0%
- Test suite thật — ~5% (đa số test là placeholder `...`)
- Alembic migrations, Docker, CI/CD — 0%

---

## 3. Verified Facts

> Chỉ liệt kê điều đã xác minh qua source-level audit (đọc code thật + Grep). Không suy đoán.

- ✓ Parser Viettel có implementation thật, hoạt động (90%).
- ✓ Parser Vinaphone **KHÔNG phải stub** — implementation đầy đủ (80%), tài liệu cũ ghi sai.
- ✓ Parser Mobifone **KHÔNG phải stub** — implementation đầy đủ (75%), tài liệu cũ ghi sai.
- ✓ M4 Upload Pipeline hoạt động tốt (95%); M4 Import Service có logic thật (90%) nhưng toàn bộ 7 test trong `test_import_service.py` là placeholder `...`, không chạy được.
- ✓ M4 Import Router chỉ 3/7 endpoint hoạt động; 4/7 trả HTTP 501.
- ✓ Analytics Router: toàn bộ 13/13 endpoint trả HTTP 501 — logic phân tích đã có code thật trong Python nhưng không có API nào hoạt động.
- ✓ GTP Exporter có logic hoàn chỉnh (85%) nhưng không có HTTP endpoint nào gọi tới.
- ✓ BTS Coordinate DB: schema đầy đủ cột nhưng `latitude`/`longitude` luôn NULL — không có data seeder.
- ✓ JWT Authentication chưa tồn tại — Grep toàn Python: 0 file chứa jwt/bearer/bcrypt/OAuth2.
- ✓ RBAC chưa tồn tại — Grep: 0 file chứa role/permission/rbac.
- ✓ AES-256 Encryption chưa tồn tại — Grep: 0 file chứa AES/encrypt/Fernet/cryptography.
- ✓ SRAU module không tồn tại trong Python backend — chỉ có trong legacy JS (`srau-engine.js`).
- ✓ `CHANGELOG_M4.md` và `FEATURE_INVENTORY.md` mâu thuẫn (13/15 vs 0/15) — số liệu thực tế: Upload 95% / Service 90% / Router 43%.
- ✓ Test coverage toàn dự án ước tính ~5% — phần lớn test file chỉ có placeholder.
- ✓ React frontend (`frontend/`) hoàn toàn trống, dù tài liệu architecture mô tả như đang phát triển.
- ✓ FLA (sao kê ngân hàng) chỉ tồn tại trong legacy JS, 0% trong Python backend.

---

## 4. Outstanding Issues

### P0 — bắt buộc trước mọi deployment
- Analytics Router 100% stub — core value sản phẩm không accessible qua API
- Không có JWT Authentication — toàn bộ API public
- Không có RBAC — không phân quyền user
- Không có AES-256 PII encryption — dữ liệu điều tra lưu plaintext
- React Frontend hoàn toàn trống — không có UI production

### P1 — ảnh hưởng chức năng cốt lõi
- Test suite ~5% — không có safety net cho refactor
- M4 Import Router: 4/7 endpoint = 501 (không xem lại/xóa/retry batch import)
- BTS Database: schema có nhưng data NULL — GTP map vô dụng
- GTP Exporter: logic tốt nhưng không có HTTP endpoint
- Vinaphone/Mobifone parser: chưa validate với CDR file thật (dù code đã có 75-80%)

### P2 — xử lý trong 3 tháng tới
- Không có Alembic migrations; SQLite chưa encrypted
- Hardcoded credentials trong config.py; thiếu structured logging
- SRAU + FLA chưa port sang Python; thiếu rate limiting, Docker, CI/CD

---

## 5. Technical Debt

1. Hai codebase song song (Python backend + legacy JS 627KB) — maintenance burden kép
2. `frontend/` React trống — UI production vẫn dựa vào legacy JS
3. Test suite ~5% thật — không có safety net cho refactor
4. Analytics Router 0% — logic tốt nhưng không accessible qua API
5. Auth stack hoàn toàn thiếu (JWT/RBAC) — security debt nghiêm trọng nhất
6. AES-256 PII encryption thiếu — dữ liệu điều tra lưu plaintext
7. Không có Alembic migration — schema changes nguy hiểm khi có data thật
8. BTS coordinate data NULL — GTP map không có dữ liệu vị trí thật
9. SRAU + FLA chỉ tồn tại trong legacy JS, chưa port Python
10. Hardcoded credentials trong config.py; không có Docker/CI-CD

---

## 6. Next Recommended Tasks (Top 10 theo thứ tự ưu tiên)

1. **JWT Authentication** — bảo vệ toàn bộ API (python-jose + passlib[bcrypt])
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

## 7. Important Documents

| File | Vai trò |
|---|---|
| **`docs/PROJECT_CHECKPOINT.md`** (file này) | Điểm khởi động duy nhất — đọc đầu tiên, thay thế mọi tài liệu khác |
| `docs/PROJECT_MEMORY_MASTER.md` | Master memory chi tiết hơn — dùng khi cần tham khảo sâu hơn checkpoint này |
| `docs/TECHNICAL_AUDIT_2026.md` | Audit kỹ thuật đầy đủ 11 mục (Executive Summary → Final Score), nguồn gốc của Verified Facts |
| `docs/UPGRADE_IDEAS_2026.md` | Top 20 ý tưởng nâng cấp + roadmap Phase A-E (góc nhìn từ docs cũ) |
| `CHANGELOG_M4.md` | Tuyên bố M4 = 13/15 — mâu thuẫn với FEATURE_INVENTORY.md, không hoàn toàn đáng tin |
| `FEATURE_INVENTORY.md` | Tuyên bố M4 = 0/15 — outdated, không cập nhật theo code thực tế |
| `docs/architecture.md`, `docs/proposed_architecture.md` | Thiết kế kiến trúc tương lai — không phải mô tả hiện trạng |

---

## 8. Session Handoff

Hướng dẫn cho Claude của phiên tiếp theo:

- **Chỉ đọc `PROJECT_CHECKPOINT.md` này trước** khi bắt đầu bất kỳ nhiệm vụ nào.
- **Không audit lại** nếu chưa có thay đổi lớn (refactor, sprint mới, merge lớn) — dùng dữ liệu trong file này.
- **Không đọc toàn bộ source code** — chỉ mở đúng module được giao cho nhiệm vụ cụ thể.
- **Không kết luận parser Vinaphone hoặc Mobifone là "stub"** — đã xác minh cả hai có implementation thật (80%/75%).
- **Source code là nguồn sự thật cuối cùng** khi tài liệu (CHANGELOG_M4, FEATURE_INVENTORY, architecture docs) mâu thuẫn với thực tế.
- **Sau khi hoàn thành một Phase phải cập nhật lại `PROJECT_CHECKPOINT.md`** — đặc biệt mục 2 (Current Progress), 3 (Verified Facts), 4 (Outstanding Issues) và 6 (Next Recommended Tasks).
- Ưu tiên tiết kiệm context/token: tránh Glob/Grep toàn dự án nếu thông tin đã có trong file này.

---

## 9. Project Health

| Tiêu chí | Đánh giá |
|---|---|
| **Completion %** | ~35% tổng thể (parsers 75-90%, import pipeline 90%+, nhưng Analytics API 0%, Security 0%, Frontend 0%) |
| **Release Readiness** | ❌ **Không thể release production** — thiếu Auth/RBAC/Encryption là điều kiện chặn tuyệt đối |
| **Security** | 🔴 **10/100 — CRITICAL.** Không có Auth, RBAC, Encryption, Audit Trail. API hoàn toàn public |
| **Documentation** | 🟡 **63/100.** Phong phú (20+ markdown files) nhưng có 3+ mâu thuẫn nghiêm trọng với source code |
| **Code Quality** | 🟡 **58/100.** Engine code (parser, import service) tốt; bị kéo xuống bởi test suite ~5% và Analytics API 0% |

**Final Score tổng thể (từ TECHNICAL_AUDIT_2026.md): 45/100**

---

## 10. Next Session Prompt

Sao chép prompt dưới đây để bắt đầu phiên Claude tiếp theo cho dự án này:

```
Dự án: D:\Phần mềm lập trình dự án 2\TelecomPlatform

Trước khi làm bất kỳ điều gì:
1. Chỉ đọc file D:\Phần mềm lập trình dự án 2\TelecomPlatform\docs\PROJECT_CHECKPOINT.md
2. Không đọc thêm tài liệu nào khác (TECHNICAL_AUDIT_2026.md, UPGRADE_IDEAS_2026.md, PROJECT_MEMORY_MASTER.md...) trừ khi nhiệm vụ thực sự yêu cầu chi tiết sâu hơn.
3. Không audit lại dự án, không quét lại source code, không index lại toàn bộ project.
4. Sau khi đọc xong PROJECT_CHECKPOINT.md, dừng lại và chờ tôi giao nhiệm vụ cụ thể tiếp theo.
```

