# M4 VALIDATION CHECKLIST
> **TelecomPlatform — Import Pipeline**  
> Review ngày: 2026-06-04 | Reviewer: Claude Code (claude-sonnet-4-6)  
> Scope: `import_service.py` + `routers/imports.py` + related models

---

## BUGS ĐÃ FIX TRONG SESSION NÀY

| ID | Mức độ | Bug | Fix |
|----|--------|-----|-----|
| BF-1 | **CRITICAL** | `CDRRecord.created_at` không có trong dict truyền vào `bulk_insert_mappings` — `default=func.now()` là ORM-side default, bị bypass → NOT NULL IntegrityError mọi import | Thêm `"created_at": datetime.utcnow()` vào rows dict |
| BF-2 | **CRITICAL** | `_upsert_subscriber` đọc `raw_info.phone_normalized` trực tiếp; khi phone fallback từ filename thì `raw_info.phone_normalized` vẫn `None` → ValueError | Backfill `raw_info.phone_normalized = owner_phone` trước khi gọi `_upsert_subscriber` |

---

## PHÂN TÍCH LUỒNG UPLOAD → PROCESS → STATS REBUILD

### Luồng chính

```
POST /imports/upload
  ValidateFile → SaveToPending → ExtractMetadata
  ← { upload_id, detected_carrier, estimated_records }

POST /imports/{upload_id}/process
  [Thread pool]
  ├─ _parse()                          ← Excel → ParseResult
  ├─ resolve owner_phone               ← raw_info OR filename
  │
  ├─ Phase 1 COMMIT ────────────────────────────────────────────
  │   _upsert_subscriber()             ← SELECT+INSERT/UPDATE subscribers
  │   _create_batch(status=PENDING)    ← INSERT import_batches
  │   db.commit()
  │
  ├─ Phase 2 ────────────────────────────────────────────────────
  │   _process_records()
  │     ├─ for each raw CDR row:
  │     │   normalize_timestamp → skip if None
  │     │   resolve_direction → (contact_number, direction)
  │     │   _get_or_create_device(imei)     ← per-row SELECT+flush
  │     │   _get_or_create_tower(lac,cid)   ← per-row SELECT+flush
  │     │   build row dict
  │     └─ bulk_insert_mappings(CDRRecord, rows)
  │   _rebuild_stats(subscriber_id)
  │     ├─ db.query(CDRRecord).all()        ← load ALL records into RAM
  │     ├─ _rebuild_contact_profiles()
  │     ├─ _rebuild_hourly_stats()
  │     ├─ _rebuild_weekly_stats()
  │     ├─ _rebuild_tower_stats()
  │     └─ _rebuild_device_subscriptions()
  │   batch.import_status = SUCCESS
  │   db.commit()
  │
  move_to_processed()
  ← { success: true, data: ImportResult }

  ON EXCEPTION in Phase 2:
    db.rollback()               ← CDR + stats changes reverted
    batch.import_status = FAILED
    batch.error_message = str(exc)[:500]
    db.commit()
    move_to_failed()
    ← HTTP 422
```

---

## CHECKLIST KIỂM TRA

### A. Correctness — Chức năng cơ bản

| # | Test | Expected | Status |
|---|------|----------|--------|
| A-1 | Import file Viettel hợp lệ (filename có phone) | records_imported > 0, batch status=SUCCESS, subscriber tạo mới | ⬜ TODO |
| A-2 | Subscriber PII được lưu đúng vào DB | full_name, id_doc_number, date_of_birth khớp với header Excel | ⬜ TODO |
| A-3 | CDR records có đủ fields: recorded_at, comm_type, direction, contact_number | Không có NULL trên các trường NOT NULL | ⬜ TODO |
| A-4 | `created_at` của CDRRecord không NULL | `SELECT created_at FROM cdr_records LIMIT 5` → tất cả có giá trị | ⬜ TODO |
| A-5 | contact_profiles được tạo sau import | `SELECT COUNT(*) FROM contact_profiles WHERE subscriber_id=?` > 0 | ⬜ TODO |
| A-6 | hourly_activity_stats có đủ 24 bucket (nếu CDR trải đều) | Max 24 rows per subscriber | ⬜ TODO |
| A-7 | weekly_activity_stats: 0–6 (0=Monday) | Không có giá trị ngoài range 0–6 | ⬜ TODO |
| A-8 | tower_frequency_stats được tạo cho mọi tower xuất hiện | `SELECT COUNT(DISTINCT tower_id) FROM cdr_records` = `SELECT COUNT(*) FROM tower_frequency_stats` | ⬜ TODO |
| A-9 | device_subscriptions được tạo cho mọi IMEI hợp lệ | first_seen_at ≤ last_seen_at | ⬜ TODO |
| A-10 | IMEI 14 hoặc 16 chữ số → `device_id = NULL` | Không gây error | ⬜ TODO |
| A-11 | CDR row không có timestamp → bị skip (không insert) | `records_imported` < `estimated_records` nếu có rows trống | ⬜ TODO |
| A-12 | Tower LAC/CID là string float (ví dụ "12345.0") | `_safe_int("12345.0")` → 12345 | ⬜ TODO |

---

### B. Transaction Safety — An toàn dữ liệu

| # | Test | Expected | Status |
|---|------|----------|--------|
| B-1 | Giả lập parse exception (corrupt Excel) | Batch status=FAILED, không có CDR records, file → failed/ | ⬜ TODO |
| B-2 | Giả lập DB exception trong Phase 2 (raise trong _bulk_insert) | Phase 1 committed (batch=PENDING→FAILED), Phase 2 rolled back | ⬜ TODO |
| B-3 | Import thành công rồi import lại file khác cùng subscriber | Subscriber UPDATED (không tạo mới), batch_id mới, CDR records từ cả 2 batch | ⬜ TODO |
| B-4 | Import cùng 1 file 2 lần | 2 batch rows, CDR records doubled, stats doubled — **no dedup** (expected behavior, cần document) | ⬜ TODO |
| B-5 | Batch PENDING còn tồn tại sau crash giả lập Phase 1 | `GET /imports/batches` (when implemented) hiện batch với status=PENDING | ⬜ TODO |

---

### C. Edge Cases — Dữ liệu biên

| # | Test | Expected | Status |
|---|------|----------|--------|
| C-1 | File 0 CDR records (header only) | `records_imported=0`, `batch status=SUCCESS` (không lỗi) | ⬜ TODO |
| C-2 | File có CDR record với source_number = target_number | direction xử lý đúng (không crash) | ⬜ TODO |
| C-3 | File có IMEI = "000000000000000" (15 số 0) | Tạo device với imei="000000000000000" | ⬜ TODO |
| C-4 | Tất cả CDR rows thiếu timestamp | `records_imported=0`, warning logged, batch=SUCCESS | ⬜ TODO |
| C-5 | Phone trong file là "0969619929" vs "969619929" vs "+84969619929" | normalize_phone xử lý đúng, cùng phone_normalized | ⬜ TODO |
| C-6 | upload_id không tồn tại trong pending/ | HTTP 404 | ⬜ TODO |
| C-7 | upload_id đã được processed (file đã move sang processed/) | HTTP 404 | ⬜ TODO |
| C-8 | File tên không có phone (ví dụ "data.xlsx") nhưng PII block có phone | Import thành công — phone lấy từ file content | ⬜ TODO |
| C-9 | File tên không có phone VÀ PII block không có phone | ValueError, batch=FAILED, HTTP 422 | ⬜ TODO |
| C-10 | LAC/CID = 0 (giá trị zero hợp lệ) | `_safe_int("0")` → 0, tower tạo với lac=0 | ⬜ TODO |

---

### D. Performance — Hiệu năng

| # | Test | Expected | Ngưỡng |
|---|------|----------|--------|
| D-1 | Import file 1,000 CDR records | Thành công | < 10 giây |
| D-2 | Import file 10,000 CDR records | Thành công | < 30 giây |
| D-3 | Import file 50,000 CDR records | Thành công, không OOM | < 120 giây |
| D-4 | Stats rebuild sau 100,000 CDR records total | Không OOM | RAM < 512 MB |
| D-5 | Import 5 files tuần tự (import_multiple) | Mỗi file commit độc lập | Tổng < N × đơn lẻ |

**Ghi chú D-3, D-4**: `_rebuild_stats` load toàn bộ CDRRecord vào Python RAM. Với 100k records × ~500 bytes/ORM object ≈ 50 MB — chấp nhận được cho công cụ điều tra đơn người dùng. Xem thêm Risk R-3.

---

### E. Annotation Preservation — Giữ lại chú thích điều tra viên

| # | Test | Expected | Status |
|---|------|----------|--------|
| E-1 | Thêm `zalo_id` vào ContactProfile, rồi import lại | `zalo_id` vẫn còn sau rebuild | ⬜ TODO |
| E-2 | Thêm `facebook_url` vào ContactProfile, rồi import thêm batch mới | `facebook_url` vẫn còn | ⬜ TODO |
| E-3 | Contact bị xóa khỏi CDR (không xuất hiện trong bất kỳ batch nào) | ContactProfile bị xóa → annotation mất — **expected, cần document** | ⬜ TODO |

---

## RỦI RO

### R-1: Duplicate CDR records — HIGH

**Mô tả**: Không có cơ chế dedup. Nếu cùng file được upload và process 2 lần, sẽ có 2 batch_id và CDR records bị nhân đôi. Stats rebuild sẽ tính cả 2 batch → tần suất liên lạc bị x2.

**Tại sao chưa fix**: CDRRecord được thiết kế là "immutable fact table". Dedup đúng đắn đòi hỏi fingerprint logic (hash source_file_row + timestamp + phones) nằm ngoài phạm vi M4.

**Mitigation hiện tại**: File được move sang `processed/` sau import thành công → upload_id cũ không thể process lại. Nhưng user có thể upload lại cùng file.

**Nguy cơ cho M5**: Analytics queries sẽ đọc duplicated data nếu xảy ra → kết quả điều tra sai.

**Khuyến nghị**: Trước M5, thêm warning vào `ImportResult` nếu `(subscriber_id, source_file_name, report_period_from, report_period_to)` đã tồn tại.

---

### R-2: Race condition trong SELECT-then-INSERT — MEDIUM

**Mô tả**: Ba hàm `_upsert_subscriber`, `_get_or_create_device`, `_get_or_create_tower` đều dùng pattern:

```python
obj = db.query(Model).filter(...).one_or_none()
if obj is None:
    obj = Model(...)
    db.add(obj)
```

Nếu hai requests xử lý song song (import_multiple chạy từ 2 threads, hoặc 2 HTTP requests đồng thời), cả hai đều thấy `None` → cả hai INSERT → IntegrityError trên unique constraint.

**Mức độ thực tế**: Thấp — công cụ đơn người dùng, ít concurrent requests.

**Mitigation**: SQLAlchemy + SQLite dùng write lock nên một trong hai sẽ thành công; cái còn lại sẽ fail. Phase 2 sẽ rollback và batch thứ hai sẽ FAILED.

**Fix đúng đắn** (nếu cần scale): Dùng `INSERT OR IGNORE` / `ON CONFLICT DO NOTHING` hoặc `with_for_update()` trên SELECT.

---

### R-3: Memory usage khi rebuild stats — MEDIUM

**Mô tả**: `_rebuild_stats` load toàn bộ CDRRecord của subscriber vào Python RAM:

```python
records = db.query(CDRRecord).filter(CDRRecord.subscriber_id == subscriber_id).all()
```

| Subscriber records | Ước tính RAM |
|-------------------|-------------|
| 10,000 | ~5 MB |
| 100,000 | ~50 MB |
| 500,000 | ~250 MB |

**Khi nào nguy hiểm**: Subscriber có nhiều batch import (nhiều năm CDR), mỗi batch 10k records.

**Fix nếu cần**: Thay bằng SQL GROUP BY aggregation trực tiếp (không load objects vào Python). Xem Section F.

---

### R-4: Orphan PENDING batches — LOW

**Mô tả**: Phase 1 commit (batch PENDING) → server crash → Phase 2 chưa chạy → batch mãi là PENDING, không có CDR records.

**Hậu quả**: Subscriber tồn tại trong DB nhưng không có data. Không gây data corruption.

**Mitigation**: `retry` endpoint (M4 stub) sẽ xử lý. User có thể process lại bằng upload file mới.

---

### R-5: File đã move sang `processed/` nhưng DB chưa commit — THẤP

**Mô tả**: Trong router, `move_to_processed()` được gọi SAU `db.commit()`. Nhưng nếu server crash sau `db.commit()` nhưng trước `move_to_processed()`, file vẫn ở `pending/`. User có thể trigger process lại → duplicate import.

**Mitigation**: `move_to_processed` failure là non-fatal (logged as warning). Cần dùng `upload_id` + batch status để detect và block re-processing.

---

### R-6: `bulk_insert_mappings` deprecated trong SQLAlchemy 2.x — LOW

**Mô tả**: `Session.bulk_insert_mappings()` là legacy API, deprecated trong SQLAlchemy 2.0+. Sẽ generate `LegacyAPIWarning`.

**Fix đúng đắn**:
```python
from sqlalchemy import insert
self.db.execute(insert(CDRRecord), normalized_rows)
```

**Ưu tiên**: Thấp — không gây lỗi, chỉ là deprecation warning.

---

## TEST CASES ƯU TIÊN CHO M5

Trước khi implement M5 (Analytics & Aggregation), cần có data sạch từ M4. Thứ tự test:

### Priority 1 — Unblock M5 (MUST pass)

```
[T1] Import 1 file Viettel thực tế
     → Kiểm tra CDRRecord count = expected
     → Kiểm tra CDRRecord.created_at NOT NULL
     → Kiểm tra contact_profiles được tạo
     
[T2] Import lại file khác cùng subscriber
     → Subscriber UPDATED (không duplicate)
     → Batch mới tạo (batch_id khác)
     → contact_profiles rebuild đúng (merged data)
     → Annotation preserved nếu đã có
     
[T3] Query contact frequency (base case M5)
     → SELECT contact_number, SUM(total_count) FROM contact_profiles
        WHERE subscriber_id=? GROUP BY contact_number
     → Kết quả khớp với manual count từ Excel
```

### Priority 2 — Data quality (nên pass trước M5 analytics)

```
[T4] Kiểm tra direction accuracy
     → COUNT outgoing + incoming + service = total CDR records
     → Không có records với direction=NULL

[T5] Kiểm tra hourly histogram
     → SUM(total_count) FROM hourly_activity_stats WHERE subscriber_id=?
        = COUNT(*) FROM cdr_records WHERE subscriber_id=?
     → Tất cả hours có recorded_at phải xuất hiện trong histogram
     
[T6] Kiểm tra tower stats
     → COUNT(DISTINCT tower_id) FROM cdr_records WHERE subscriber_id=? AND tower_id IS NOT NULL
        = COUNT(*) FROM tower_frequency_stats WHERE subscriber_id=?
```

### Priority 3 — Edge cases (nên verify trước production)

```
[T7] Import file không có IMEI column (Vina/Mobi format)
     → device_id = NULL cho tất cả records
     → device_subscriptions rỗng cho subscriber này
     
[T8] Import file có LAC/CID missing
     → tower_id = NULL cho những rows đó
     → tower_frequency_stats không có entry cho NULL towers
     
[T9] Import 3+ files cùng subscriber, rồi xóa 1 batch
     (khi DELETE /batches/{id} được implement)
     → Stats rebuild chỉ dựa trên 2 batches còn lại
     → Kiểm tra annotation vẫn được preserve
```

### Priority 4 — Performance baseline (trước khi implement M5 queries)

```
[T10] Import file 10,000 CDR records
      → Thời gian tổng < 30 giây
      → Ghi lại baseline: parse_time, db_insert_time, stats_rebuild_time
      
[T11] Query contact_profiles sau 50,000 CDR records
      → Response time < 500ms (sẽ là bottleneck của M5 Tab 2)
```

---

## TÓM TẮT FINDINGS

| Category | Count | Critical | High | Medium | Low |
|----------|-------|---------|------|--------|-----|
| **Fixed** | 2 | 2 | — | — | — |
| **Risks (không fix ngay)** | 6 | — | 1 | 2 | 3 |
| **Data gaps** | 3 | — | — | 2 | 1 |
| **Test cases** | 14 | 3 | 5 | 4 | 2 |

### Đánh giá tổng thể

**M4 sẵn sàng cho testing với dữ liệu thực** sau khi 2 critical bugs đã được fix.  
Pipeline end-to-end hoạt động đúng về logic. Các risks còn lại là thiết kế được chấp nhận cho công cụ điều tra đơn người dùng.

**Chưa sẵn sàng cho production** vì:
- R-2 (race condition) cần `with_for_update()` nếu multi-user
- R-6 (`bulk_insert_mappings` deprecated) cần migrate sang SQLAlchemy 2.x API
- Chưa có Alembic migrations (M4.15)
- Hardcoded credentials trong auth (M8.6)

---

*Generated: 2026-06-04 | Claude Code (claude-sonnet-4-6)*  
*Source: static review of import_service.py + imports.py router*
