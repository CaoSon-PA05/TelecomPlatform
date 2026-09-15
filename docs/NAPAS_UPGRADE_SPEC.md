# NAPAS Upgrade Specification — Đối soát giao dịch tài khoản ngân hàng

> **Trạng thái tài liệu:** Khảo sát + đặc tả hoàn chỉnh (§1-15). **Phase 1-24 đã IMPLEMENT và validate** — detection, parsing (single+multi-group), file pairing, bank identity normalization, counterparty resolver, UI summary table, hardening/security, transaction-level reconciliation engine, forensic data audit, evidence-based matching governance, dedicated regression suites, panel đối soát chi tiết trong UI (tách biệt trạng thái đối soát vs. độ tin cậy tên đối ứng), export XLSX mở rộng (Sheet 4 "Doi Soat NAPAS" + chống mất số 0 đầu + sheet-count UI text nay lấy động từ workbook thật, không hardcode), browser E2E thật qua CDP (33/33 PASS, 0 console error/exception), robustness/UX hardening (empty/dirty/injection data, 300-row cap vs export, leading-zero round-trip), và final forensic audit trên TOÀN BỘ 27 file mẫu thật (Phase 24). **Kết quả thật đo trên toàn bộ 27 file (21.344 giao dịch: 16.396 CHUYEN + 4.948 NHAN): 0 MATCHED** — đây là bản chất dữ liệu (mỗi file CHUYEN/NHAN là 1 kết quả truy vấn độc lập, không phải sổ cái ghép cặp — xem "Phase 12–15 Implementation Status" §12.8), không phải lỗi hay thiếu sót thuật toán, và được UI/export phản ánh trung thực; bảo toàn dữ liệu đầy đủ đã xác nhận (0 dropped/fabricated/reused/duplicate). Settlement/reversal matching vẫn CHƯA IMPLEMENT — ranh giới cứng chưa có phase nào chạm tới.
> **Lưu ý về 2 baseline khác phạm vi:** tài liệu này nhắc tới hai tổng số giao dịch khác nhau ở các chỗ khác nhau — **5.312** (phạm vi hẹp: chỉ 7 cặp nhóm đã ghép trong 4 fixture bắt buộc, dùng cho audit forensic sâu Phase 12-15) và **21.344** (phạm vi đầy đủ: toàn bộ 27 file mẫu, dùng cho audit Phase 24). Cả hai đều ĐÚNG cho phạm vi riêng của mình, không có lỗi đếm — xem giải thích đầy đủ tại "Phase 24 Addendum — Scope Reconciliation" ở cuối tài liệu.
> **Nguồn sự thật dữ liệu NAPAS:** `C:\Users\ASUS\Downloads\3261_CSDT.THANHHOA.O_1` (27 file Excel mẫu thật).
> **Nguồn sự thật kiến trúc:** `D:\Phần mềm lập trình dự án 2\1. TelecomPlatform` (module FLA — legacy JS, đang hoạt động thật; xem `docs/PROJECT_CHECKPOINT.md`).
> **Quy ước gắn nhãn:** mỗi kết luận quan trọng được gắn `FACT` (đã kiểm chứng trực tiếp trên dữ liệu/code), `INFERENCE` (suy luận hợp lý nhưng chưa chắc chắn 100%), hoặc `UNKNOWN` (chưa đủ dữ liệu, cần xác nhận thêm trước khi code).

---

## Phase 1 Implementation Status (2026-09-14)

**STATUS: COMPLETE** — detection + single-bank-group parser implemented and validated; no regression on the 9 existing bank parsers.

### Actual implementation

File modified: **`bank-parser.js` only** (as planned in §13 — no `app.js`, no backend, no schema/DB touched; `app.js` had pre-existing unrelated uncommitted changes from before this session, left untouched).

| Change | Location | What |
|---|---|---|
| `detectBank(rows, sheetName)` | new **Phase 0** block, before existing Phase 1-6 | Fingerprint: `normalizeStr(sheetName).includes('ket qua tim kiem')` AND `/CV-NAPAS\.KSTT/i` found in the first 10 rows → returns `'NAPAS'`. Second parameter is additive/optional — the one existing call site (`parseFile()`) now passes `sheetName`; no other caller of `detectBank` exists in the codebase (verified by grep), so this is not a breaking signature change. |
| `parseNapas(rows)` | new function, placed after `parseAgribank`, before the Generic fallback section | Locates the single metadata block (`Tên ngân hàng chuyển/nhận:` + `Tài khoản nguồn/đích:`) by scanning all cells of all rows (not a hardcoded column/row index) — see `napasFindMeta()`. Throws if 0 or **>1** metadata blocks are found (multi-group files are explicitly refused, not silently merged — verified, see Validation). Direction (CHUYEN/NHAN) is read from the metadata text itself (`chuyển` vs `nhận`), not from the filename. Header row located dynamically via `findRow(['ngay gd','gio gd','so tien'])`; columns below it use the fixed layout confirmed across all 27 sample files (spec §2/§5). Row filter = numeric STT **and** `dd/mm/yyyy` date on the same row — this single check correctly excludes blank rows, the group-header row, the `Tài khoản nguồn/đích:` row, the `"Tổng số giao dịch phát sinh theo..."` subtotal footer, **and** the trailing signature block (`Người lập biểu` / `Lãnh đạo phòng` + names) found at the tail of both fixture files — this signature block was not documented in §2 during discovery; documented here now. |
| `napasTime(v)` | new small helper next to `parseNapas` | Zero-pads `Giờ GD` (integer `hhmmss`, sometimes missing a leading zero, e.g. `94149`) to 6 digits before splitting into `HH:MM:SS`. |
| `makeTx()` | extended | Added 4 optional fields per spec §8: `counterpartyBankName`, `counterpartyNameConfidence`, `sourceFormat`, `groupIndex`. All default to `null` when not passed — the 9 existing parsers do not pass them, so their output objects are unchanged in every existing key/value; only new keys are added. |
| `parseFile()` switch | one line added | `case 'NAPAS': transactions = parseNapas(rows); break;` — reuses the existing try/catch, so a thrown multi-group/no-metadata error becomes the same `{ error, errorDetail }` shape every other parser failure already produces. No new error-handling mechanism introduced. |
| Header JSDoc | one line | "Supported:" comment updated to mention NAPAS and its Phase 1 single-group limitation. |

**Counterparty name resolution: NOT implemented in Phase 1**, exactly as scoped — `counterpartyName` and `counterpartyNameConfidence` are always `null` for NAPAS transactions right now. Reason (verified, not assumed): the two Phase 1 fixture files (`860320_9818`) contain **no instance** of the CONFIRMED-tier `MBVCB....CT tu <acc> <name> toi <acc> <name> tai <bank>` pattern (own bank here is Agribank, not Vietcombank). The fixtures do contain content that looks like the weaker INFERRED-tier `<TÊN> chuyen tien` pattern from §6/§7 (e.g. NHAN row STT=71: `"JUAN CHIN YING chuyen tien"`), but per explicit Phase 1 scope this was **not** implemented — it is real signal for **Phase 2's counterparty resolver**, noted here rather than coded speculatively.

### Validation (against real fixture files, not synthetic data)

Harness: a temporary Node.js script (`vm` sandbox providing the browser-global `XLSX` from the project's own `node_modules/xlsx`, so `bank-parser.js` runs completely unmodified) — not committed, lived under the OS temp dir, deleted after validation.

| Fixture | Expected (from discovery §2) | Actual | Result |
|---|---|---|---|
| `860320_9818_..._CHUYEN.xlsx` | 29 transactions | 29 | **PASS** |
| `860320_9818_..._NHAN.xlsx` | 71 transactions | 71 | **PASS** |

Field-level spot check (first / middle / last transaction of each fixture, cross-checked by hand against the raw Excel cells read via `openpyxl`):
- CHUYEN: `accountNumber=8603205129818`, `bankName=Ngân hàng Nông Nghiệp và Phát Triển Nông Thôn Việt Nam`, `transactionType=OUT` for all rows, first tx `id=355764785554 date="12/01/2025 11:44:03" amount=200000000 counterpartyAccount=339202938 counterpartyBankName=Ngân hàng TMCP Quốc Tế Việt Nam`, last tx `id=353214552658 date="25/03/2026 10:45:25" amount=9460000` — all match the raw cells exactly, including the `hhmmss` → `HH:MM:SS` conversion (`114403`→`11:44:03`, `104525`→`10:45:25`).
- NHAN: `accountNumber=8603205129818` (same account, confirming pairing), `transactionType=IN` for all rows, first tx `id=501204581556 date="12/01/2025 11:32:29" counterpartyAccount=19073594898018 counterpartyBankName=Ngân hàng TMCP Kỹ Thương Việt Nam`, last tx `counterpartyAccount=02963` (an unusually short 5-digit account — preserved as-is, not mangled/padded) — all match.
- Multi-group refusal test: ran the same parser against `371010_5678_..._CHUYEN.xlsx` (3 bank groups per §4.E) — `parseNapas` threw as designed, `parseFile()`'s existing catch turned it into `{ error: "NAPAS: file chứa nhiều nhóm ngân hàng (3 khối metadata)...", transactions: [] }`. **Confirmed: no silent merge into a single wrong account.**

### Regression — existing 9 bank parsers

No real bank-statement sample files were found on this machine in this session (the path recorded in earlier project memory, `Downloads\File mau NH\Mau 2`, no longer exists — searched, not present). Given that constraint, regression was verified at the `detectBank()` level using minimal synthetic row/sheetName inputs built directly from each bank's own documented fingerprint condition in the existing code (Sacombank, VPBank, Eximbank, Techcombank, Agribank, MB Bank, BIDV, Vietcombank, Vietinbank — 9/9). All 9 still resolve to their correct bank name, unaffected by the new Phase 0 NAPAS branch. Two additional adversarial cases were run to confirm the new NAPAS fingerprint requires **both** conditions (sheet name alone, or the `CV-NAPAS.KSTT` text alone, must each independently resolve to `'Unknown'`) — both passed. **11/11 regression checks pass.**
This is a fingerprint-level regression check, not a full parse-level one (no real files to parse) — if real bank-statement fixtures become available later, re-running `parseFile()` end-to-end on them is still recommended before shipping.

### Known Limitations (unchanged from spec, confirmed still accurate)

- **Multi-group parsing → Phase 2**, per plan (§14). Phase 1 detects and refuses rather than mis-parsing.
- **Full counterparty-name resolver (CONFIRMED/INFERRED/AMBIGUOUS/UNKNOWN tiers) → later phase**, per plan (§14 Phase 5-6). `counterpartyName`/`counterpartyNameConfidence` are `null` for every NAPAS transaction today.
- **File pairing (CHUYEN/NHAN) + UI validation warning → Phase 3**, not implemented — `parseFiles()` already merges both files' transactions into one pool correctly (verified: same `accountNumber` on both fixtures), but there is no code yet that warns when only one half of a pair is uploaded.
- **Bank name alias/normalization registry → Phase 4**, not implemented — `parseNapas` currently stores the raw bank-name string from the metadata/columns as-is (e.g. `bankName`, `counterpartyBankName`), with no canonicalization against the variant list documented in §4.B.
- **UI columns in `_renderAccountFlowTab` (Tab "Đối Ứng TK") → Phase 7**, not implemented — `app.js` was not touched this session. The new canonical fields (`counterpartyBankName`, `counterpartyNameConfidence`, `sourceFormat`) are populated in the transaction objects but have no dedicated column/badge in the UI yet; they will simply be ignored by the existing render code until Phase 7 adds them.

---

## Phase 2 Implementation Status (2026-09-14)

**STATUS: COMPLETE** — multi-group parsing implemented and validated on all 3 designated multi-group fixtures (3 groups, 2 groups, and an asymmetric 2-vs-1 group case), with zero regression on Phase 1's single-group behavior and zero regression on the 9 existing bank parsers.

### What changed

File modified: **`bank-parser.js` only** (same as Phase 1 — no `app.js`, no backend, no schema/DB touched).

`parseNapas(rows)` was refactored from "1 metadata block or throw" into a group-based pipeline, replacing the Phase 1 body but keeping every Phase 1 field/behavior for the single-group case identical:

| Function | Role |
|---|---|
| `napasMatchRowCell(row, re)` | **New helper**, factored out of the old `napasFindMeta` — scans one row's cells for the first match of a regex. Column-position agnostic, same style as the existing BIDV/Agribank cell scans. |
| `napasFindMeta(rows, re)` | Unchanged in output shape (`{row, match}[]`), now implemented on top of `napasMatchRowCell` instead of duplicating the cell-scan loop. |
| `napasBuildGroups(rows)` | **New.** Finds every `"Tên ngân hàng chuyển/nhận:"` line in the file (in row order → that order becomes `groupIndex` 0, 1, 2, ...). For each one, requires its paired `"Tài khoản nguồn/đích:"` line on the very next row (verified deterministic across all 12 real group-header occurrences in the 6 Phase 2 fixtures — see Validation). Computes each group's row range as `[thisBlock.row, nextBlock.row)` (or `rows.length` for the last group) — **not** a fixed size, **not** derived from the filename, **not** assumed equal across groups. Throws if 0 blocks are found, or if any block's account line is missing — never guesses. |
| `parseNapasGroupTransactions(rows, group)` | **New**, holds the exact same per-row transaction logic Phase 1 had (STT+date row filter, direction→IN/OUT, counterparty account/bank resolution, `napasTime` formatting, `makeTx()` call) — only reads rows inside `[group.rowStart, group.rowEnd)`, so a row physically inside group N's range can only ever be tagged with group N's own `accountNumber`/`bankName`/`direction`/`groupIndex`. This is what makes account/bank/direction isolation structural rather than a post-hoc check. |
| `parseNapas(rows)` | Now just: locate the header row once (unchanged from Phase 1 — same 14-column layout is shared by every group in a file), call `napasBuildGroups`, then `parseNapasGroupTransactions` per group and concatenate. |

`makeTx()`, `detectBank()`'s NAPAS fingerprint, and the `case 'NAPAS'` switch entry in `parseFile()` are **unchanged from Phase 1**.

### Group-boundary algorithm (what makes it deterministic, not heuristic)

```
find every row matching "Tên ngân hàng chuyển/nhận: <bank>"   → bankMeta[] (row-ordered)
for each bankMeta[g]:
    require "Tài khoản nguồn/đích: <acct>" on row bankMeta[g].row + 1   → else THROW (no guessing)
    group[g].rowStart = bankMeta[g].row
    group[g].rowEnd   = bankMeta[g+1].row   (or rows.length for the last group)
within [rowStart, rowEnd): the existing "numeric STT + dd/mm/yyyy date" row
    filter (unchanged from Phase 1) already excludes this group's own metadata
    rows, the "Tổng số giao dịch phát sinh theo..." subtotal footer, and (for
    the last group) the trailing signature block — no additional footer-
    specific logic was needed because that filter was already sufficient
```
The "account line immediately follows the bank-name line" rule is not an assumption — it was independently verified (via a throwaway Python/openpyxl script, not committed) to hold on **all 12 group-header occurrences** across the 6 Phase 2 fixtures before writing the JS, then re-confirmed by the JS output matching that independent count exactly (see Validation table below).

### Validation (real fixture files, cross-checked against an independently computed baseline)

Harness: same Node.js `vm` sandbox approach as Phase 1 (temporary script, not committed, deleted after use). A **second, independent** baseline was computed directly in Python (`openpyxl`, read-only) using the same group-boundary rule, *before* writing any JS, specifically so the JS implementation could be checked against a source that wasn't derived from the JS itself.

| File | Expected groups | Actual groups | Per-group tx counts (Python baseline == JS output) | Result |
|---|---|---|---|---|
| `371010_5678_CHUYEN` | 3 | 3 | 880 / 145 / 1104 (sum 2129) | **PASS** |
| `371010_5678_NHAN` | 3 | 3 | 428 / 374 / 224 (sum 1026) | **PASS** |
| `882503_1992_CHUYEN` | 2 | 2 | 114 / 36 (sum 150) | **PASS** |
| `882503_1992_NHAN` | 2 | 2 | 128 / 17 (sum 145) | **PASS** |
| `979494_9999_CHUYEN` | 2 | 2 | 1376 / 1 (sum 1377) | **PASS** |
| `979494_9999_NHAN` | **1** (asymmetric vs. CHUYEN's 2) | **1** | 386 | **PASS — asymmetry correctly preserved, no group-count symmetry assumed** |
| `860320_9818_CHUYEN` (Phase 1 regression) | 1 | 1 | 29 | **PASS** |
| `860320_9818_NHAN` (Phase 1 regression) | 1 | 1 | 71 | **PASS** |

For every group in every file above, the automated checks additionally confirmed: `groupIndex` values are exactly `0..N-1` with no gaps; every transaction within one group has a single consistent `accountNumber`, a single consistent `bankName`, and a single consistent `transactionType` (i.e. no cross-group bleed); `sum(per-group counts) === total transactions`; and no duplicate `transactionId` within the file. All held on every one of the 8 files above.

**Group-transition spot check** (§17 of the task brief): `371010_5678_CHUYEN` group 0 (ACB, rows up to STT 880) and group 1 (Vietcombank, STT resets to 1) share the **same** `accountNumber` (`3710105678`) but were still kept as separate groups with different `bankName` (`Ngân hàng TMCP Á Châu` vs `Ngân hàng TMCP Ngoại Thương Việt Nam`) and different `groupIndex` (0 vs 1) — confirms groups are never merged just because their account number matches.

**Malformed-input path** (adversarial, synthetic): a hand-built 2-block NAPAS-shaped file where the second block's `"Tên ngân hàng chuyển:"` line has no `"Tài khoản nguồn:"` line after it → `parseNapas` threw, `parseFile()`'s existing catch turned it into `{ error, transactions: [] }` — **no partial/silent merge**, consistent with the "stop instead of guessing" requirement.

### Regression

- **Phase 1 single-group fixtures**: `860320_9818` still 29/71 — see table above.
- **9 existing bank parsers**: re-ran the same 11 synthetic `detectBank()` fingerprint checks from Phase 1 (9 banks + 2 NAPAS false-positive guards) — **11/11 pass**, unaffected (Phase 2 did not touch `detectBank()` at all).

### Known Limitations (updated)

- **Counterparty-name resolver → later phase**, still not implemented — unchanged from Phase 1. `counterpartyName`/`counterpartyNameConfidence` are `null` for every NAPAS transaction, in every group.
- **File pairing (CHUYEN/NHAN) + UI validation warning → Phase 3**, not implemented — explicitly out of scope for Phase 2 per plan. Each parsed group now carries full identity (`accountNumber`, `bankName`, `direction`, `groupIndex`), which is what a future pairing/reconciliation phase needs, but no code yet matches a CHUYEN group to its corresponding NHAN group (there is also no assumption that `groupIndex` correlates between the two sides of a pair — confirmed necessary by the 979494_9999 asymmetric case, and explicitly not assumed anywhere in this implementation).
- **Bank name alias/normalization registry → Phase 4**, not implemented — unchanged from Phase 1.
- **UI columns in `_renderAccountFlowTab` → Phase 7**, not implemented — unchanged from Phase 1, `app.js` untouched.
- **Error message row numbers**: `napasBuildGroups`'s thrown error reports `bm.row + 1` as "dòng Excel". This was correct against all real fixtures (cross-checked against direct `openpyxl` reads during Phase 1/2 validation) but was observed to be potentially inaccurate in one purely synthetic adversarial test involving hand-built leading blank rows written through `XLSX.utils.aoa_to_sheet` (a round-trip artifact of that specific test construction, not of any real file) — cosmetic only, does not affect the group-count/isolation guarantees, not worth chasing further without a real malformed sample to validate against.

---

## Phase 3 Implementation Status (2026-09-14)

**STATUS: COMPLETE** — CHUYEN/NHAN group pairing by content identity implemented and validated, including the asymmetric-group case, a genuine reversed-group-order real fixture, and a real orphan file; zero regression on Phase 1, Phase 2, or the 9 existing bank parsers. A minimal, isolated UI warning was also added.

### Pairing model

- **File identity**: not a new object — reused the existing `parseFile()` result (`{ filename, detectedBank, error, napasGroups, ... }`), which `parseFiles()` already collects into `fileResults`. No new "FileIdentity" wrapper was introduced; the task explicitly allowed reusing canonical-model shapes where they already suffice, and they did here.
- **Group identity**: `parseFile()` now also returns `napasGroups: [{ groupIndex, direction, bankName, accountNumber }]` when `detectedBank === 'NAPAS'` (`null` otherwise). This is produced by calling the existing `napasBuildGroups(rows)` (Phase 2) a second time inside `parseFile()`, after the main `parseNapas(rows)` call has already succeeded without throwing — so this second call is guaranteed not to throw either (same deterministic function, same `rows`). Doing it this way means **group identity survives even for a group that produced zero transactions** (e.g. every row in that group happened to have `amount === 0` and got filtered) — deriving group identity from the flat `transactions` array alone would have silently lost such a group.
- **Pairing key**: `accountNumber + '||' + bankName`, where `bankName` is the group's own declared bank (the metadata line's bank, never the per-transaction `counterpartyBankName`).

### Why this pairing key (evidence, not assumption)

- `accountNumber` alone is insufficient — proven by `371010_5678`, where the exact same account number string appears under 3 different banks (ACB, Vietcombank, Techcombank) inside one file. Pairing on account alone would cross-match a CHUYEN group at one bank with an unrelated NHAN group at a different bank.
- `bankName` alone is insufficient — nothing prevents two different real accounts at the same bank from appearing together in one uploaded batch.
- `accountNumber + bankName` (raw string equality, no normalization) was checked against **all 12 group-header occurrences across the 6 multi-group fixtures**: the group's own declared bank-name string was found **byte-identical** between the CHUYEN side and the NHAN side of every real matched pair. This is different from the *counterparty* bank-name column, which does have documented spelling variants (spec §4.B) — the two are different data paths in the source file, and only the counterparty one was ever observed to vary. Raw string equality is therefore safe for Phase 3 without needing the bank-name alias registry planned for Phase 4 — this was verified, not assumed, and is called out as a residual risk below for any future non-demo NAPAS export that might behave differently.

### Validation

Harness: same Node.js `vm` sandbox as Phase 1/2 (temporary, not committed, deleted after use), now also calling the new `BankParser.pairNapasGroups(fileResults)`.

| Case (test matrix §20 of the task) | Fixture(s) | Result |
|---|---|---|
| 1 CHUYEN + 1 NHAN | `860320_9818` (real) | 1 matched pair, both `groupIndex=0` — **PASS** |
| Multi-group, identity-based pairing | `882503_1992` (real, 2 groups, same order both sides) | 2 matched pairs (BIDV, Techcombank), 0 orphans/ambiguous — **PASS** |
| Same account / different bank → not merged | `371010_5678` (real, 3 groups) | 3 matched pairs with **3 distinct `bankName` values** confirmed, not collapsed into one — **PASS** |
| Reversed group order still matches correctly | `371010_5678` (real — genuinely reversed in the actual data: CHUYEN order is ACB/VCB/Techcombank = groupIndex 0/1/2, NHAN order is Techcombank/ACB/VCB = groupIndex 0/1/2) | ACB paired as chuyen=0↔nhan=1, Vietcombank as chuyen=1↔nhan=2, Techcombank as chuyen=2↔nhan=0 — **exact identity-based match, position never used — PASS** |
| Asymmetric groups → partial matching | `979494_9999` (real, 2 CHUYEN groups vs 1 NHAN group) | Techcombank matched (chuyen=0↔nhan=0); Vietcombank correctly reported as **orphan CHUYEN** (groupIndex=1, no NHAN counterpart exists) — nothing truncated/dropped/force-merged — **PASS** |
| Missing NHAN (orphan CHUYEN) | `979494_9999` Vietcombank group, above | Same as above — **PASS** |
| Missing CHUYEN (orphan NHAN) | `098669_0534_..._NHAN.xlsx` (real — the genuine Discovery-documented orphan, no CHUYEN file exists anywhere in the 27-file sample) — paired alone, with no other file uploaded | 1 orphan NHAN reported, account `0986690534`, nothing else — **PASS** |
| Duplicate identity → ambiguous | Synthetic (2 fake `fileResults` both declaring CHUYEN groups with the identical `accountNumber`+`bankName`, no real fixture exercises this) | 0 matched pairs produced from that key; 1 `ambiguous` entry retaining **both** raw CHUYEN candidates plus the NHAN side, for a human/later phase to resolve — never silently first-matched — **PASS** |
| Filename mismatch, content identity still matches | Synthetic (fake `fileResults` with arbitrary unrelated filenames, matching `napasGroups` identity) | Paired successfully; `chuyenFile`/`nhanFile` trace fields correctly carry the (mismatched) filenames through — filenames were never compared as part of the pairing logic — **PASS** |

Per the task's explicit permission, the two cases with no natural real-fixture coverage (duplicate identity; filename mismatch) were tested with hand-built in-memory `fileResults`-shaped objects — no sample `.xlsx` file was created, modified, or touched for this.

### File-level vs. group-level pairing

Confirmed distinct, as required (§13): `pairNapasGroups` operates entirely at the **group** level. A "file pair" is never treated as implying "all groups paired" — `979494_9999_CHUYEN.xlsx` and `979494_9999_NHAN.xlsx` are clearly a related file pair (same case), yet one of their groups (Vietcombank) is correctly reported as unpaired while the other (Techcombank) is matched. No code anywhere checks or assumes group-count equality between a file pair.

### UI warning

- **Implemented**: yes, minimally.
- **Location**: `app.js`, `flaProcessFiles()`, immediately after the existing per-file error/empty-transaction toast block (~line 1457), before the existing "stamp sourceFilename" step. This was the only integration point read in `app.js` this phase — no other part of the file was opened or touched.
- **Behavior**: after `BankParser.parseFiles()` returns, if at least one uploaded file was detected as NAPAS, calls the new `BankParser.pairNapasGroups(fileResults)` and shows one `_showToast(..., 'info')` per orphan-CHUYEN group ("không tìm thấy file NHAN tương ứng"), per orphan-NHAN group ("không tìm thấy file CHUYEN tương ứng"), and per ambiguous identity ("không thể xác định cặp CHUYEN/NHAN duy nhất") — three distinct, specific messages per §18, never a generic "NAPAS pairing error". Uses the existing `_showToast` mechanism and its established `'info'`/`'error'`/`'success'` vocabulary (no new toast type invented) — `'info'` was chosen because parsing itself already succeeded; this is a data-quality heads-up, not a failure. Purely additive: does not change any existing toast, does not alter the upload/parse/case-creation flow, does not touch any other function in `app.js`.

### Regression

- **Phase 1**: `860320_9818` still 29/71 transactions.
- **Phase 2**: `371010_5678` still 2129/1026 total transactions across 3 `groupIndex` values on the CHUYEN side.
- **9 existing bank parsers**: same 11 synthetic `detectBank()` checks (9 banks + 2 NAPAS false-positive guards) — 11/11 pass, unaffected (Phase 3 did not touch `detectBank()`, `napasBuildGroups`, or `parseNapasGroupTransactions`).

### Known Limitations (updated)

- **Counterparty-name resolver → later phase**, still not implemented — unchanged from Phase 1/2.
- **Bank-name alias/normalization registry → Phase 4**, still not implemented. Phase 3's pairing key uses raw `bankName` string equality, verified safe against all 27 sample files' own-bank-name metadata lines (see "Why this pairing key" above) — but this is a verified-on-current-data fact, not a structural guarantee. If a future real (non-demo) NAPAS export ever spells a case's own bank name differently between its CHUYEN and NHAN file, `pairNapasGroups` would report that pair as two orphans instead of one match, until Phase 4's alias registry is applied to the pairing key too.
- **Transaction-level reconciliation (amount/date/reference/counterparty matching within a matched pair) → later phase**, explicitly out of scope for Phase 3 per plan — `pairNapasGroups` only establishes which CHUYEN group corresponds to which NHAN group; it does not look at individual transactions at all.
- **UI summary-table columns (`counterpartyBankName`, `counterpartyNameConfidence`, `sourceFormat`, and now a possible "pairing status" column) in `_renderAccountFlowTab` → Phase 7**, still not implemented — only the toast warning was added this phase, no table/column changes.
- **`pairNapasGroups` has no top-level `status` field** (e.g. `'COMPLETE'`/`'PARTIAL'`/`'NONE'`) — the task's proposed shape said this wasn't mandatory ("Không nhất thiết phải dùng chính xác object trên"), and a caller can already derive it trivially from the 4 array lengths returned. Skipped deliberately to avoid inventing an enum without a concrete current consumer that needs it; can be added later if a real UI need for it appears.

---

## 1. Executive Summary

**NAPAS** (Công ty CP Thanh toán Quốc gia Việt Nam) là đơn vị trung gian chuyển mạch — không phải một ngân hàng. Sao kê "NAPAS" trong bộ mẫu này thực chất là **kết quả truy vấn giao dịch liên ngân hàng của Cục/Phòng nghiệp vụ** (công văn NAPAS.KSTT — "Kiểm soát tuân thủ"), khác về bản chất so với sao kê ngân hàng trực tiếp (BIDV, VCB, ACB…) mà module FLA hiện đang xử lý qua `bank-parser.js`.

**Khác biệt cốt lõi so với bank statement hiện có** (FACT, đối chiếu `bank-parser.js`):

| | Bank statement hiện có | NAPAS statement |
|---|---|---|
| Số file / tài khoản | 1 file = 1 tài khoản = 1 ngân hàng | 1 file có thể chứa **nhiều nhóm ngân hàng** cho cùng 1 số tài khoản đang bị điều tra |
| Chiều giao dịch | Trong cùng 1 file (cột Ghi Nợ/Ghi Có) | **Tách thành 2 file riêng**: `_CHUYEN` (đi) và `_NHAN` (đến) |
| Cột "tên đối ứng" | Có sẵn ở hầu hết ngân hàng (VPBank, Sacombank, MB Bank, Agribank, Vietinbank) | **Không có cột này** — phải suy luận từ "Nội dung chuyển" |
| Cột "ngân hàng đối ứng" | Không có field riêng trong canonical model hiện tại | **Có sẵn**, dạng text tự do, nhiều biến thể tên cho cùng 1 ngân hàng |

**Vấn đề kỹ thuật chính cần giải quyết:**
1. Nhận diện file NAPAS (khác 9 định dạng ngân hàng đã hỗ trợ).
2. Xác định đúng (ngân hàng, số tài khoản) cho từng "nhóm" dữ liệu bên trong file — **không dựa vào tên file làm nguồn sự thật**, dù tên file có tương quan mạnh với nội dung (xem §4).
3. Ghép cặp file CHUYEN/NHAN của cùng một đối tượng.
4. Suy luận "Tên tài khoản đối ứng" từ nội dung chuyển khoản với cơ chế độ tin cậy rõ ràng (CONFIRMED/INFERRED/AMBIGUOUS/UNKNOWN), tránh gán bừa một chuỗi ký tự làm tên người.
5. Tái sử dụng tối đa kiến trúc `BankParser` + `buildAccountFlowMatrix` hiện có thay vì tạo module song song.

**Mục tiêu nâng cấp:** thêm một parser NAPAS mới vào `bank-parser.js` (theo đúng pattern các parser hiện có), mở rộng canonical transaction model thêm field ngân hàng đối ứng + độ tin cậy tên đối ứng, và bổ sung các cột tương ứng vào bảng "Đối Ứng TK" (`_renderAccountFlowTab` trong `app.js`) — không phá vỡ dữ liệu 9 ngân hàng đang hoạt động.

---

## 2. NAPAS Sample Dataset

**Thư mục mẫu:** `C:\Users\ASUS\Downloads\3261_CSDT.THANHHOA.O_1`

**Số lượng file:** 27 file `.xlsx` (FACT, `ls` trực tiếp thư mục).

**Quy luật đặt tên (FACT, quan sát trên toàn bộ 27 file):**
```
3261_CSDT.THANHHOA.O_<P1>_<P2>_<HEX8>_<CHUYEN|NHAN>.xlsx
```
- `3261_CSDT.THANHHOA.O` — mã hồ sơ/vụ việc + đơn vị công an (Thanh Hóa), cố định cho toàn bộ lô.
- `P1` (6 chữ số), `P2` (4 chữ số) — xem §4, có tương quan với số tài khoản thật nhưng **không phải nguồn sự thật**.
- `HEX8` — mã hex 8 ký tự, giống nhau giữa 2 file CHUYEN/NHAN của cùng 1 đối tượng → là khóa ghép cặp ở cấp độ tên file (xem §3).
- Hậu tố `CHUYEN` (giao dịch đi) hoặc `NHAN` (giao dịch đến).

**Danh sách 13 cặp + 1 file lẻ (FACT):**

| # | P1_P2 | HEX8 | CHUYEN | NHAN | Ngân hàng chủ tài khoản (từ metadata) |
|---|---|---|---|---|---|
| 1 | 001010_8007 | F0353CE8 | ✓ (1346 dòng GD) | ✓ (448 dòng) | Ngân hàng TMCP Phương Đông (OCB) |
| 2 | 011001_3233 | 4F5FA75A | ✓ (410) | ✓ (177) | Ngân hàng TMCP Bắc Á |
| 3 | 050121_6439 | CAB4C7D7 | ✓ (1170) | ✓ (542) | Sacombank |
| 4 | 050160_2543 | D45D148A | ✓ (577) | ✓ (164) | Sacombank |
| 5 | 070136_7131 | BC470685 | ✓ (5224) | ✓ (855) | Sacombank |
| 6 | 098669_0534 | BEF43F06 | **✗ (thiếu)** | ✓ (127) | TPBank |
| 7 | 190356_2013 | F8C21D2E | ✓ (1630) | ✓ (324) | Techcombank |
| 8 | 190752_8012 | 9926019E | ✓ (525) | ✓ (111) | Techcombank |
| 9 | 240992_4567 | D5888F5D | ✓ (789) | ✓ (249) | Techcombank |
| 10 | 371010_5678 | 96A2D98A | ✓ (2129, **3 nhóm ngân hàng**) | ✓ (1026, 3 nhóm) | ACB / VCB / Techcombank |
| 11 | 860320_9818 | E0485E9A | ✓ (29) | ✓ (71) | Agribank |
| 12 | 882503_1992 | 2DC7C4B5 | ✓ (150, **2 nhóm**) | ✓ (145, 2 nhóm) | BIDV / Techcombank |
| 13 | 931010_7567 | 49EF56FE | ✓ (1040) | ✓ (323) | Sacombank |
| 14 | 979494_9999 | 38750149 | ✓ (1377, **2 nhóm**) | ✓ (386, **1 nhóm — bất đối xứng**) | Techcombank (+VCB chỉ ở chiều CHUYEN) |

Tổng ~21.344 dòng giao dịch thật đã quét (script Python, `openpyxl`).

**Cấu trúc file (FACT, giống hệt nhau ở mọi file đã kiểm tra):**
- 1 sheet duy nhất, tên `KET QUA TIM KIEM`.
- Dòng 1-3: trống.
- Dòng 4: tiêu đề `PHỤ LỤC SỐ 01: THÔNG TIN CHI TIẾT`.
- Dòng 5: tham chiếu công văn `.../CV-NAPAS.KSTT ngày .../.../...`.
- Dòng 6: trống.
- Dòng 7: **header cột** (cột B→N): `STT | Thẻ/TK nguồn | Thẻ/TK đích | Ngày GD | Giờ GD | Số tiền | Số Trace | Số REF | Mã thiết bị | Ngân hàng chuyển | Ngân hàng nhận | Nội dung chuyển | Cấp đệ quy`.
- Dòng 8: **metadata nhóm** — `Tên ngân hàng chuyển: <tên>` (file CHUYEN) hoặc `Tên ngân hàng nhận: <tên>` (file NHAN), STT = số La Mã (`I`, `II`, …).
- Dòng 9: `Tài khoản nguồn: <số>` (CHUYEN) hoặc `Tài khoản đích: <số>` (NHAN).
- Dòng 10 trở đi: dữ liệu giao dịch thật, STT là số nguyên tăng dần trong nhóm.
- **Dòng footer trước mỗi nhóm tiếp theo:** `Tổng số giao dịch phát sinh theo tài khoản nguồn: N` + `Tổng số giao dịch phát sinh theo ngân hàng chuyển: N`, rồi lặp lại khối metadata (nhóm `II`, `III`, …).

Bằng chứng chi tiết: xem §3 và §4.

---

## 3. File Pairing Model

```
INCOMING file (_NHAN)          OUTGOING file (_CHUYEN)
        \                              /
         \____ cùng HEX8 trong tên ___/
                        |
                        v
         Account Statement Pair (1 đối tượng điều tra)
```

**Khóa ghép cặp (FACT):** đoạn `HEX8` trong tên file giống hệt nhau giữa file CHUYEN và NHAN của cùng một đối tượng (evidence: cả 13 cặp trong bảng §2 đều có HEX8 trùng khớp). Đây là bằng chứng ở **cấp độ tên file**.

**Xác nhận ở cấp độ nội dung (FACT):** với mọi cặp đã kiểm tra, giá trị `Tài khoản nguồn` (dòng 9, file CHUYEN) và `Tài khoản đích` (dòng 9, file NHAN) là **chuỗi số giống hệt nhau** (evidence: cặp `001010_8007` → cả hai file đều khai `0010100010058007`; cặp `011001_3233` → `011001060003233`; tương tự cho toàn bộ 13 cặp — xem bảng trích trong `headers_all.txt`, đã đối chiếu thủ công).

**Thuật toán ghép cặp đề xuất (ưu tiên nội dung, filename chỉ là gợi ý tăng tốc):**
1. Mở từng file, đọc toàn bộ khối metadata (`Tên ngân hàng chuyển/nhận` + `Tài khoản nguồn/đích`) ở mọi nhóm trong file (không chỉ dòng 8-9 đầu tiên — xem §4 về multi-group).
2. Tập hợp **account identity** = tập hợp các số tài khoản khai báo trong file (thường chỉ 1 số duy nhất, lặp lại ở mọi nhóm — FACT, xem §4).
3. Hai file được coi là 1 cặp nếu: (a) một file có ít nhất 1 nhóm khai `Tên ngân hàng chuyển` + `Tài khoản nguồn`, còn file kia có ít nhất 1 nhóm khai `Tên ngân hàng nhận` + `Tài khoản đích`, VÀ (b) account identity trùng nhau.
4. Dùng HEX8 trong tên file làm **chỉ báo phụ** để tăng tốc độ ghép cặp / cảnh báo bất thường (ví dụ HEX8 trùng nhưng account identity đọc được từ nội dung lại khác nhau → phải cảnh báo, không được tự động ghép).

**Trường hợp không đủ cặp (FACT, đã quan sát trong bộ mẫu):**
- `098669_0534_BEF43F06_NHAN.xlsx` **không có file CHUYEN tương ứng** trong bộ mẫu này. Quan trọng: file NHAN đơn lẻ này **vẫn tự khai đầy đủ** ngân hàng (`Tên ngân hàng nhận: Ngân hàng TMCP Tiên Phong`) và số tài khoản (`Tài khoản đích: 0986690534`) ở dòng 8-9 của chính nó.

**→ Điều chỉnh giả định ban đầu (quan trọng):** brief ban đầu giả định "phải mở file CHUYỂN ĐI mới xác định được tài khoản/ngân hàng". Dữ liệu thực tế cho thấy **FACT ngược lại**: cả file CHUYEN và file NHAN đều tự mô tả đầy đủ (ngân hàng, số tài khoản) của tài khoản đang bị điều tra trong chính khối metadata của nó — không file nào phụ thuộc vào file kia để xác định danh tính tài khoản chủ. Điều **thực sự** cần file CHUYEN (hoặc đúng hơn, cần đọc "Nội dung chuyển") là để suy luận **tên đối ứng ở chiều đi** (xem §6), không phải để xác định chính tài khoản đang điều tra.
Design vẫn nên giữ khả năng dự phòng (defensive fallback) cho trường hợp một file NAPAS thực tế nào đó thiếu khối metadata — nhưng đây là `UNKNOWN / NEED CONFIRMATION`, chưa quan sát được trong 27 file mẫu.

**Trường hợp nhiều nhóm ngân hàng trong 1 file (FACT — xem đầy đủ ở §4):** file `371010_5678_96A2D98A_CHUYEN.xlsx` chứa 3 nhóm (ACB tại dòng 8, VCB tại dòng 892, Techcombank tại dòng 1042), tất cả cùng khai `Tài khoản nguồn: 3710105678`. Thuật toán ghép cặp và bóc tách phải lặp qua **toàn bộ file**, không dừng ở nhóm đầu tiên.

**Bất đối xứng số nhóm giữa 2 chiều (FACT, edge case quan trọng):** cặp `979494_9999`: file CHUYEN có 2 nhóm (Techcombank + VCB), nhưng file NHAN cùng cặp chỉ có 1 nhóm (Techcombank) — không có giao dịch nhận nào ghi nhận tại VCB. Đây là **dữ liệu hợp lệ**, không phải lỗi thiếu file — logic ghép cặp không được yêu cầu số nhóm bằng nhau giữa 2 chiều.

---

## Phase 4 Implementation Status (2026-09-14)

**STATUS: COMPLETE** — bank identity normalization (registry + `normalizeBankName()`) và counterparty resolver (4-tier confidence, `resolveCounterparty()`) đã implement và validate; một phát hiện quan trọng từ Discovery đã được **sửa lại** với bằng chứng rộng hơn (xem "Phát hiện cần sửa" bên dưới). Không có regression trên Phase 1/2/3 hay 9 bank parser cũ.

### A. Bank Identity Normalization

**File sửa:** `bank-parser.js` (duy nhất).

- **`NAPAS_BANK_ALIASES`** — registry dạng whitelist, mỗi entry `{ id, aliases: [...] }`. Xây dựng từ 2 nguồn bằng chứng thật:
  1. 9 label canonical đã có sẵn của `detectBank()`/các parser cũ (`'BIDV'`, `'Vietcombank'`, `'Techcombank'`, `'Vietinbank'`, `'VPBank'`, `'Eximbank'`, `'Sacombank'`, `'Agribank'`, `'MB Bank'`) — tái sử dụng nguyên trạng, không tạo label song song, để một giao dịch NAPAS tại VCB và một sao kê VCB tải trực tiếp cùng chuẩn hoá về `'Vietcombank'`.
  2. **Quét lại toàn bộ 27 file mẫu** (script Python tạm, đọc-only, đã xoá sau khi dùng) lấy đúng 47 chuỗi tên ngân hàng thô riêng biệt xuất hiện ở cột `Ngân hàng chuyển`/`Ngân hàng nhận` trên các dòng giao dịch thật — không dùng danh sách nhớ lại từ Discovery (khi đối chiếu, phát hiện Discovery nhớ nhầm 1 biến thể PVcomBank không tồn tại trong dữ liệu thật — đã sửa dùng danh sách quét lại).
- **Matching:** exact string sau `normalizeStr()` (đã có sẵn trong file, xử lý hoa/thường + dấu + khoảng trắng) — **không** substring-match, vì `"Ngân hàng TMCP Sài Gòn"` (SCB) và `"Ngân hàng TMCP Sài Gòn Thương Tín"` (Sacombank) có chung cụm "Sài Gòn" nhưng là 2 ngân hàng khác nhau (spec §4.B) — validate bằng unit test riêng, PASS.
- **Alias nhiều biến thể thật sự merge (có ≥2 chuỗi thô khác nhau quan sát được):** VPBank (2), PVcomBank (2, không phải 3 như Discovery nhớ nhầm), Bản Việt/Timo (2), OCB/Liobank (2, chuỗi Liobank tự khai `"...trực thuộc Ngân hàng TMCP Phương Đông (OCB)"` nên đây là bằng chứng tự thân, không phải suy đoán). Toàn bộ ngân hàng còn lại (SCB, ACB, VIB, MSB, SHB, TPBank, v.v.) chỉ có 1 chuỗi thô quan sát được — vẫn được đăng ký (để có id chuẩn dùng chung) nhưng không có "biến thể" nào để hợp nhất.
- **Không có bằng chứng → `null`, không đoán.** `normalizeBankName('Some Completely Unknown Bank Name Not In Registry')` → `null` — test PASS.
- **Giữ nguyên `bankName` thô** trên transaction/group (spec §8 backward-compat) — `normalizeBankName()` là một hàm/field **cộng thêm** (`bankId`), không thay thế field cũ ở bất kỳ đâu.

**Ảnh hưởng lên pairing key (§10 nhiệm vụ Phase 4):** `pairNapasGroups()` đổi key từ `accountNumber + rawBankName` sang `accountNumber + (normalizeBankName(rawBankName) || rawBankName)`. Fallback dùng **chuỗi thô gốc**, không dùng literal `'unknown'` — tránh 2 ngân hàng khác nhau nhưng đều chưa có trong registry bị gộp nhầm vào cùng 1 key. Do Phase 3 đã chứng minh chuỗi tên ngân hàng riêng (own bank) giống hệt nhau giữa 2 phía CHUYEN/NHAN trên toàn bộ 27 file mẫu, thay đổi này **không đổi kết quả pairing** trên dữ liệu hiện có (xem Regression bên dưới) — được áp dụng để tăng độ bền cho trường hợp tương lai, không phải sửa lỗi đã quan sát.

### B. Counterparty Resolver

**Kiến trúc:** `resolveCounterparty(tx)` — pure function độc lập, input tối thiểu `{ description, transactionType, accountNumber, counterpartyAccount }` (không cần đọc Excel), output `{ name, confidence, source, evidence }`. Wired vào `parseNapasGroupTransactions()` ngay sau khi `counterpartyAccount` đã được resolve từ cột (không đổi field đó — spec §16). Export ra `BankParser.resolveCounterparty` để test độc lập.

**4 tier, tổng hợp trên 5.440 giao dịch thật (9 file: `860320_9818`, `371010_5678`, `882503_1992`, `979494_9999` × CHUYEN/NHAN, `098669_0534_NHAN`):**

| Tier | Số lượng | Tỷ lệ | Nguồn pattern |
|---|---|---|---|
| CONFIRMED | 216 | 4.0% | 100% pattern MBVCB (Vietcombank), cả 2 chiều |
| INFERRED | 840 | 15.4% | `<TÊN> chuyen tien/chuyen khoan/chuyen tien ho`, chỉ chiều NHAN |
| AMBIGUOUS | 213 | 3.9% | fragment ngắn dạng tên (`ck`, `Thang M`, `An`...) |
| UNKNOWN | 4.171 | 76.7% | phần lớn — không có tín hiệu tên đáng tin cậy |

**Không đặt mục tiêu tối đa hoá CONFIRMED/INFERRED** — tỷ lệ UNKNOWN chiếm đa số là kết quả trung thực (đúng theo yêu cầu "100% kết quả phải trung thực về confidence", không phải "100% giao dịch phải có tên").

#### Phát hiện cần sửa (quan trọng — self-correction có bằng chứng)

Discovery/spec §6 gốc từng trích `'IBFT NGUYEN VAN TUNG chuyen tien'` (từ file `070136_7131_..._CHUYEN.xlsx`) làm ví dụ cho 1 pattern INFERRED áp dụng được ở **cả 2 chiều**. Phase 4 kiểm chứng lại rộng hơn (quét toàn bộ nội dung khớp pattern `<TÊN> + chuyen tien/chuyen khoan` trên 13 file, phân loại theo chiều) và phát hiện: trong chính file `070136_7131_..._CHUYEN.xlsx`, **4974/5114 (97%)** dòng khớp pattern này đều là **CÙNG MỘT TÊN** (`NGUYEN VAN TUNG`) lặp lại trên **hàng nghìn tài khoản đối ứng khác nhau** — tức đây là tên **chủ tài khoản nguồn**, không phải đối ứng (khớp hoàn toàn với phát hiện "Phát hiện quan trọng" đã có sẵn ở §6, nhưng bảng pattern INFERRED gốc đã trích dẫn sai ví dụ cho trường hợp ngược lại). Tương tự 100% ở `371010_5678_CHUYEN` (1354/1354 = `LE VAN AN`) và `979494_9999_CHUYEN` (790/790 = `LE VAN LONG`). Ngược lại, cùng pattern ở phía **NHAN** biến đổi thật sự theo từng đối ứng (VD `371010_5678_NHAN`: 174 tên khác nhau trên 588 dòng khớp, mỗi tên gắn với 1 tài khoản nguồn khác nhau).

**Kết luận sửa (đã áp dụng trong code):** Tier INFERRED **chỉ áp dụng khi `transactionType === 'IN'`**. Ở chiều OUT, pattern này **không bao giờ** được nâng lên INFERRED/CONFIRMED — validate bằng unit test riêng (`'IBFT NGUYEN VAN TUNG chuyen tien'` với `transactionType:'OUT'` → phải `UNKNOWN`, PASS) và bằng chính 4171 dòng UNKNOWN thật trong bảng tổng hợp trên (phần lớn là nội dung dạng này ở chiều OUT). Đây là ví dụ trực tiếp cho nguyên tắc "không được biến inference thành fact" — sai lầm nằm ở phiên bản bằng chứng ban đầu (4 dòng, đủ để phát hiện pattern nhưng KHÔNG đủ để phát hiện nó chỉ đúng 1 chiều), Phase 4 mở rộng bằng chứng (2700+ dòng, 9 file) mới lộ ra giới hạn thật của pattern.

#### Tier 1 — CONFIRMED (pattern MBVCB, direction-aware + cross-check)

Regex: `/^MBVCB\.\d+\.\d+\..+?\.CT tu (\S+)\s+(.+?)\s+toi\s+(\S+)\s+(.+?)\s+tai\s+(.+)$/` → 5 nhóm: sender account, sender name, receiver account, receiver name, bank (không lấy nguyên văn phần sau "CT tu" làm tên — theo đúng yêu cầu §12).

- Chiều OUT (own = sender): counterparty = phía "toi" (receiver account + name).
- Chiều IN (own = receiver): counterparty = phía "tu" (sender account + name).
- **Cross-check bắt buộc:** account trích từ regex phải khớp với `accountNumber`/`counterpartyAccount` đã resolve từ cột trước đó — nếu lệch, **không** gắn CONFIRMED, rơi xuống tier thấp hơn (unit test: account cố ý cho sai → kết quả `UNKNOWN`, PASS).
- **Validate bằng chứng thật (không chỉ 4 dòng cũ):** quét toàn bộ 27 file → 218 dòng khớp pattern (9 file khác nhau, cả 2 chiều); trong phạm vi 5.440 dòng của bộ evidence chính thức (9 file) → 216 dòng, **0 lần cross-check thất bại** trên dữ liệu thật (chỉ thất bại khi test cố ý cho sai — synthetic).
- **Không overwrite `counterpartyBankName`:** phần "tai <bank>" trong MBVCB (dạng viết tắt: "TECHCOMBANK", "HD BANK"...) chỉ giữ trong `evidence` để truy vết, **không** ghi đè field `counterpartyBankName` (vốn đã lấy từ cột `Ngân hàng chuyển/nhận`, đáng tin cậy hơn) — đúng yêu cầu §18 "không overwrite own bank" áp dụng mở rộng: cũng không tạo nguồn bank-name thứ 2 xung đột.

#### Tier 2 — INFERRED (chỉ chiều NHAN)

Regex: `/^(?:IBFT\s+)?([A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+){1,4})\s+(?:chuyen tien|chuyen khoan|chuyen tien ho)\b/i` — gộp chung các template theo ngân hàng (MB, ACB, Techcombank, nhóm "IBFT", MoMo) thành 1 regex duy nhất thay vì per-bank riêng lẻ, vì yếu tố phân biệt rủi ro thật sự là **chiều giao dịch**, không phải ngân hàng nguồn (xem "Phát hiện cần sửa" ở trên) — đơn giản hoá hợp lý so với đề xuất per-bank ban đầu trong spec §6, dựa trên bằng chứng mới.

#### Tier 3 — AMBIGUOUS

Fragment ≤30 ký tự, chỉ chữ cái (không số) + khoảng trắng, ≤3 từ, không khớp tier 1/2. Loại digit ra khỏi điều kiện để tránh mã giao dịch/số tài khoản dạng chữ+số (`'GQ77P2URU97LROO90THF'`) bị nhận nhầm — những chuỗi này rơi xuống UNKNOWN thay vì AMBIGUOUS (validate bằng unit test riêng).

#### Tier 4 — UNKNOWN

Gồm: nội dung rỗng, khai báo rõ "không ghi nội dung" (`NAPAS_NO_CONTENT_PHRASES`, hiện có 1 chuỗi bằng chứng thật `'KO GHI NOI DUNG CHUYEN KHOAN'`), mã hệ thống/QR, câu tự do dài không có cấu trúc tên, và (quan trọng) mọi nội dung dạng `<TÊN> chuyen tien` xuất hiện ở chiều OUT.

### False-positive testing (§23 nhiệm vụ) — kết quả

| Loại nội dung test | Input mẫu | Kỳ vọng | Kết quả |
|---|---|---|---|
| Tên + chiều OUT (rủi ro chính) | `'IBFT NGUYEN VAN TUNG chuyen tien'`, `transactionType:'OUT'` | không CONFIRMED/INFERRED | PASS |
| Tên viết tắt | `'An'`, `'Minh'`, `'Ainh'`, `'An M'` | AMBIGUOUS, name=null | PASS |
| Câu tự do dài, không tên | `'Anh cho ba chu nha em tien'` | UNKNOWN | PASS |
| Account số xuất hiện nhiều lần | `'3710105678 73152361'` | UNKNOWN (không phải AMBIGUOUS) | PASS |
| Mã QR/hệ thống opaque | `'GQ77P2URU97LROO90THF'` | UNKNOWN | PASS |
| Khai báo rõ không ghi | `'KO GHI NOI DUNG CHUYEN KHOAN'` | UNKNOWN, source=explicit_no_content | PASS |
| MBVCB nhưng account cross-check sai | (regex khớp, account cố ý sai) | rơi xuống, không CONFIRMED | PASS |
| Ghi chú nghiệp vụ ngắn | `'CK'` | không CONFIRMED/INFERRED (rơi vào AMBIGUOUS do ngắn/toàn chữ — chấp nhận được vì name vẫn null) | PASS |

### Regression

- **Phase 1:** `860320_9818` vẫn 29/71.
- **Phase 2:** `371010_5678` vẫn 2129/1026 (3 groupIndex CHUYEN); `882503_1992` vẫn 150/145; `979494_9999` vẫn 1377/386.
- **Phase 3 (bankId key mới):** `860320_9818` vẫn 1 matched pair; `371010_5678` vẫn 3 matched pairs, 3 bank khác nhau **không** bị gộp (ACB≠VCB≠Techcombank), reversed group order vẫn match đúng theo identity; `979494_9999` vẫn 1 matched + 1 orphanChuyen (bất đối xứng); `098669_0534` vẫn orphan NHAN thật.
- **9 bank parser cũ:** 11/11 `detectBank()` check (9 ngân hàng + 2 NAPAS guard) — PASS, không đổi vì Phase 4 không sửa `detectBank()`.

### Known Limitations (cập nhật)

- **UI summary-table columns → Phase 5**, chưa implement — không sửa `app.js` trong phase này (đúng yêu cầu §26), field mới đã có trên transaction nhưng chưa có cột/badge hiển thị.
- **Transaction-level reconciliation (amount/date/reference matching trong 1 matched pair) → phase sau**, chưa động tới — Phase 4 chỉ enrich identity (đúng yêu cầu §27).
- **Registry 47+9 alias chỉ phủ ngân hàng thật sự xuất hiện trong 27 file mẫu** — một ngân hàng NAPAS thật khác (không có trong mẫu) sẽ tự động `normalizeBankName()` → `null`, không vỡ (an toàn), nhưng sẽ không được chuẩn hoá cho tới khi có bằng chứng mới bổ sung vào registry.
- **`bankId` là nhãn hiển thị, không phải bất biến kiểm chứng độc lập** — tên viết tắt gán cho các ngân hàng ngoài 9 ngân hàng đã có parser (VD `'ACB'`, `'VIB'`, `'MSB'`...) dựa trên kiến thức phổ thông về hệ thống ngân hàng Việt Nam (cùng bản chất với các nhãn `'BIDV'`/`'Vietcombank'` đã có sẵn trong `detectBank()` từ trước), không phải trích xuất trực tiếp từ dữ liệu — nếu sai chính tả/viết tắt thì chỉ ảnh hưởng hiển thị, không ảnh hưởng tính đúng của việc gộp/tách nhóm (điều đó phụ thuộc vào chuỗi thô, đã kiểm chứng).
- **CONFIRMED tier chỉ có 1 pattern (MBVCB)** — nếu các ngân hàng khác cũng có narrative tự sinh tương tự (chưa quan sát được trong 27 file mẫu), sẽ cần bổ sung pattern mới với cùng mức độ bằng chứng + cross-check, không suy rộng từ MBVCB.
- **`resolveCounterparty` không dùng `counterpartyBankName`** — thiết kế có chủ đích (tách biệt 2 mối quan tâm: định danh ngân hàng vs. định danh tên), không phải thiếu sót.

---

## Phase 5–7 Implementation Status (2026-09-14)

**STATUS: COMPLETE** — UI summary table exposes Phase 4's canonical fields trung thực (không fabricate tên, không đồng nhất 4 mức confidence, không rò rỉ nhãn NAPAS sang giao dịch cũ), đã validate bằng dữ liệu thật (không chỉ visual) và bằng bộ test hardening/false-presentation/security. Không regression trên Phase 1–4.

### Sửa 1 nhầm lẫn trước khi code (quan trọng)

Nhiệm vụ giả định `index-Son0Cao0PC.html` (đã xác nhận ở Phase 1) là shell HTML đang hoạt động thật. Kiểm tra lại trước khi sửa UI phát hiện: `index-Son0Cao0PC.html` (1030 dòng) là một trang **rút gọn chỉ phục vụ CDR**, thậm chí **không nạp `bank-parser.js`** — không thể chạy được module FLA/NAPAS. File thật sự chứa đầy đủ markup FLA (bao gồm bảng `#fla-account-flow-table` cần sửa ở Phase 5) là **`Khoi_chay_du_an.html`** (2141 dòng, nạp đủ `bank-parser.js` + toàn bộ engine điều tra). Cả 2 file đều nạp `app.js` (không đổi kết luận của Phase 1 về file JS), nhưng Phase 5 phải sửa markup `<thead>` trong `Khoi_chay_du_an.html`, không phải `index-Son0Cao0PC.html`. Đây là FACT xác minh trực tiếp (đếm dòng + đối chiếu danh sách `<script src>`), không phải suy đoán.

### File sửa

- `app.js` — duy nhất phần logic (`buildAccountFlowMatrix`, `_renderAccountFlowTab` + 3 helper mới: `_escHtml`, `_flaConfidenceRank`, `_flaConfidenceBadgeHtml`).
- `Khoi_chay_du_an.html` — thêm 1 cột `<th>` ("NH Đối Ứng"), cập nhật `colspan="10"` → `colspan="11"` ở trạng thái rỗng.
- `bank-parser.js` — **không đổi** (đúng yêu cầu §12 "KHÔNG REBUILD PHASE 4" — không phát hiện regression nào cần sửa ở data layer).

### Phase 5 — UI Summary Table

**Trường được hiển thị (không thêm cả 5 field thành cột riêng — theo đúng khuyến nghị "không blindly thêm"):**

| Field Phase 4 | Cách hiển thị | Vị trí |
|---|---|---|
| `counterpartyName` | text trong ô "Tên Đối Ứng" (giữ nguyên vị trí cột cũ) | cột 3 |
| `counterpartyNameConfidence` | badge màu inline ngay cạnh tên (4 màu/nhãn khác biệt) | cột 3, cạnh tên |
| `counterpartyBankName` | **cột mới** "NH Đối Ứng" | cột 11 (mới) |
| `sourceFormat` | tag nhỏ "NAPAS" trước tên ngân hàng chủ — **chỉ khi `sourceFormat==='NAPAS'`** | cột 10 (Ngân Hàng, cột cũ) |
| `bankId` | tooltip (`title=`) trên ô ngân hàng chủ — không chiếm thêm không gian cột | cột 10, thuộc tính `title` |

**Badge confidence (không đánh đồng 4 mức, không suy ra xác suất số):**

| Tier | Nhãn | Màu |
|---|---|---|
| CONFIRMED | "XÁC NHẬN" | xanh lá (`#4ade80`) |
| INFERRED | "SUY LUẬN" | vàng hổ phách (`#fbbf24`) |
| AMBIGUOUS | "CHƯA RÕ" | cam (`#fb923c`) |
| UNKNOWN | "KHÔNG XÁC ĐỊNH" | xám (`#64748b`) |

**Bug thật phát hiện và sửa trong lúc implement (không phải giả định lý thuyết):** `buildAccountFlowMatrix` gốc nhóm theo `accountNumber + counterpartyAccount`, **không có thành phần ngân hàng** trong key. Với dữ liệu NAPAS multi-bank-same-account (§4.E), điều này có thể khiến 2 giao dịch từ **2 ngân hàng chủ khác nhau** nhưng vô tình cùng account+counterparty bị gộp nhầm vào 1 dòng — đúng kịch bản "Case 7" trong yêu cầu Phase 6. Kiểm tra thật trên `371010_5678` xác nhận: **255 cặp (account, counterparty) thật sự bị trùng giữa ≥2 ngân hàng chủ khác nhau** trong dữ liệu — đây không phải rủi ro lý thuyết mà là bug thật sẽ xảy ra ngay khi người dùng nạp file NAPAS multi-group. **Đã sửa:** key nhóm cho giao dịch NAPAS đổi thành `accountNumber + counterpartyAccount + bankId` (dùng `BankParser.normalizeBankName()` đã có từ Phase 4). **Chỉ áp dụng khi `sourceFormat==='NAPAS'`** — key của giao dịch ngân hàng cũ giữ **y nguyên** `accountNumber + counterpartyAccount` như trước, đảm bảo zero behavior change cho dữ liệu cũ (verify bằng test riêng).

**Chọn tên khi 1 nhóm có nhiều giao dịch với confidence khác nhau:** không lấy "giao dịch đầu tiên" (như code cũ làm cho ngân hàng truyền thống) — với NAPAS, chọn tên từ giao dịch có **confidence cao nhất** trong nhóm (`CONFIRMED > INFERRED > AMBIGUOUS > UNKNOWN`), tránh việc thứ tự ngẫu nhiên của mảng quyết định tên hiển thị.

**Tương thích ngược (bắt buộc, đã verify bằng test riêng dùng dữ liệu tổng hợp vì máy không có sẵn file sao kê ngân hàng thường):** mọi nhánh logic mới đều rẽ theo `sourceFormat==='NAPAS'` — giao dịch không phải NAPAS đi đúng nhánh code **y hệt trước Phase 5** (cùng key nhóm, cùng cách chọn tên "giao dịch đầu tiên thắng", không tag NAPAS, không badge confidence).

**Bảo mật (yêu cầu §10 nhiệm vụ):** chưa có helper escape HTML nào tồn tại trong `app.js` trước Phase 5 (đã grep xác nhận) — nội dung ô bảng trước đây chèn thẳng `${g.counterpartyName}` v.v. vào template string không escape (rủi ro HTML injection từ nội dung spreadsheet, vốn có sẵn từ trước). Đã thêm `_escHtml()` tối thiểu, áp dụng cho **các ô mà Phase 5 đang sửa** trong `_renderAccountFlowTab` (tên đối ứng, tài khoản, tên ngân hàng chủ, tên ngân hàng đối ứng) — không refactor toàn bộ file (đúng yêu cầu "không broad security refactor"). Validate bằng test injection thật (`<script>`, `onerror=`, `onload=`, thẻ `<b>`) — không có chuỗi độc hại nào sống sót vào HTML output.

### Phase 6 — Real-Data Integration Validation

Harness: Node `vm`, trích xuất **nguyên văn** (không gõ lại) đúng dải dòng chứa code Phase 5 trực tiếp từ `app.js` trên đĩa (kèm assertion tự kiểm tra nếu số dòng bị lệch thì dừng thay vì test nhầm code), nạp `bank-parser.js` thật, stub tối thiểu `document.getElementById`. Không cài framework browser-test lớn (Playwright/Selenium...) — đúng yêu cầu "không thêm dependency lớn không cần thiết", vì mục tiêu chỉ là verify logic JS thuần + chuỗi HTML sinh ra, không cần render engine thật.

**5 fixture bắt buộc — toàn bộ PASS, có assertion lập trình (không chỉ visual):**

| Fixture | Kỳ vọng | Kết quả |
|---|---|---|
| A: `860320_9818` | 1 nhóm, Agribank, 29+71=100 GD | PASS — bankId nhất quán, tag NAPAS xuất hiện, counter đúng |
| B: `371010_5678` | 3 ngân hàng (ACB/Vietcombank/Techcombank) cùng 1 số TK, thứ tự nhóm đảo ngược | PASS — 3 `bankId` phân biệt được; **255 cặp (account,cp) trùng thật giữa các bank vẫn được giữ tách dòng** (529 dòng matrix bao phủ, xem bug fix ở trên) |
| C: `882503_1992` | 2 nhóm (BIDV/Techcombank) | PASS — không sập, 2 bankId phân biệt |
| D: `979494_9999` | Bất đối xứng (2 CHUYEN/1 NHAN), 1 orphan CHUYEN | PASS — render không sập dù có orphan; `buildAccountFlowMatrix` hoạt động độc lập với trạng thái pairing (đúng thiết kế — bảng tổng hợp không phụ thuộc `pairNapasGroups`) |
| E: `098669_0534_NHAN` | Orphan NHAN thật, chỉ 1 file | PASS — render không sập; xác nhận không có text "matched"/"paired"/"ghép cặp" nào bị rò rỉ vào bảng (bảng này không hiển thị trạng thái pairing) |

### Phase 6 — False-Presentation Testing (§8 nhiệm vụ, 8/8 case)

| Case | Kịch bản | Kết quả |
|---|---|---|
| 1 | UNKNOWN | không tên giả — PASS |
| 2 | AMBIGUOUS | không tự chọn candidate đầu tiên (không có text dạng tên nào gần ô AMBIGUOUS) — PASS |
| 3 | INFERRED | badge "SUY LUẬN" hiển thị, khác biệt với CONFIRMED — PASS |
| 4 | CONFIRMED | badge "XÁC NHẬN" hiển thị — PASS |
| 5 | Nội dung OUT chứa tên chủ tài khoản | tên đó **không** xuất hiện ở đâu trong dòng render (verify bằng regex tìm chuỗi tên trong toàn bộ HTML output — không tìm thấy); ô hiển thị "KHÔNG XÁC ĐỊNH" | PASS |
| 6 | Ngân hàng đối ứng khác ngân hàng chủ | cả 2 tên ngân hàng cùng xuất hiện, ở 2 ô riêng biệt | PASS |
| 7 | Cùng account, khác ngân hàng chủ | phân biệt được qua `bankId` (xem bug fix ở trên) | PASS |
| 8 | Giao dịch ngân hàng cũ | không có tag NAPAS, không có badge confidence nào trong HTML | PASS |

### Phase 7 — Hardening

| Nhóm test | Kết quả |
|---|---|
| Mảng rỗng `[]` | không throw, counter "0 cặp" |
| Transaction object tối giản/thiếu field (kể cả object rỗng `{}`) | không throw |
| `counterpartyNameConfidence` giá trị lạ không nằm trong 4 tier | không throw, không rò rỉ `undefined`/`NaN`/`[object Object]` vào HTML |
| Tên/tên ngân hàng rất dài (500/300 ký tự) | không throw, dữ liệu đầy đủ trong DOM, CSS (`max-width`+ellipsis đã có sẵn) xử lý tràn khi hiển thị |
| Object giao dịch canonical có bị mutate không | **không** — `JSON.stringify` trước/sau `buildAccountFlowMatrix`+`_renderAccountFlowTab` giống hệt nhau |
| `counterpartyName` rỗng `''` dù confidence=CONFIRMED | fallback đúng về dấu gạch ngang, không hiển thị ô trống trông giống đã xác nhận |
| Mảng trộn lẫn legacy + NAPAS trong 1 lần render | không throw; dòng legacy trong batch trộn vẫn không bị gắn tag NAPAS |

**Code-quality review (§14 nhiệm vụ):** không refactor lớn ngoài phạm vi (chỉ 2 hàm + 3 helper mới trong `app.js`, `bank-parser.js` không đổi 1 dòng nào ở Phase 5-7); không duplicate logic resolver/normalize (UI chỉ **gọi** `BankParser.normalizeBankName`/đọc field đã có sẵn từ `resolveCounterparty`, không viết regex MBVCB hay pattern-matching nào trong `app.js`); không hard-code số tài khoản/tên ngân hàng mẫu vào production code (chỉ xuất hiện trong file test tạm, đã xoá sau khi dùng); không sửa file mẫu; không đổi dependency; toast Phase 3 (`app.js` dòng 1457) xác nhận còn nguyên, không bị đụng tới.

### Regression toàn bộ (Test Matrix §13 nhiệm vụ)

| Nhóm | Kết quả |
|---|---|
| Detection (9 bank + 2 NAPAS guard) | 11/11 PASS |
| Phase 1 (`860320_9818`) | 29/71 PASS |
| Phase 2 (3 fixture multi-group) | 2129/1026, 150/145, 1377/386 — PASS |
| Phase 3 (pairing, 5 fixture) | 1/3/2 matched, 1 matched+1 orphanChuyen, 1 orphanNhan — PASS |
| Phase 4 (alias registry + resolver) | VPBank alias merge, SCB/Sacombank tách biệt, OUT-side UNKNOWN, IN-side INFERRED — PASS |
| Phase 5–7 (UI, 5 fixture thật + legacy tổng hợp + 8 false-presentation case + 7 hardening case + 5 security case) | tất cả PASS |

### Known Limitations (Phase 5–7)

- **Transaction-level reconciliation vẫn CHƯA BẮT ĐẦU** — đúng ranh giới cứng của nhiệm vụ (§11), `pairNapasGroups`/bảng tổng hợp chỉ dừng ở cấp group/account, không so khớp amount/date/reference.
- **Xuất Excel (XLSX export) của tab Đối Ứng TK chưa cập nhật** thêm cột mới — nằm ngoài phạm vi acceptance criteria Phase 5 (chỉ yêu cầu `_renderAccountFlowTab`), có thể bổ sung ở phase UI sau nếu cần đồng bộ.
- **HTML-escaping chỉ áp dụng cho các ô Phase 5 sửa trong `_renderAccountFlowTab`** — các hàm render khác trong `app.js` (hàng chục tab/bảng khác, có trước Phase 5) chưa được audit escaping — đây là lỗ hổng đã tồn tại từ trước, không phải do Phase 5 gây ra, nhưng vẫn CHƯA được khắc phục toàn diện (nằm ngoài phạm vi "không broad security refactor" của nhiệm vụ này).
- **`Khoi_chay_du_an.html` là bản HTML duy nhất được sửa** — nếu trong tương lai `index-Son0Cao0PC.html` được nâng cấp để hỗ trợ FLA đầy đủ, `<thead>` của nó cũng cần thêm cột "NH Đối Ứng" tương ứng (hiện tại file đó không có bảng này nên không cần sửa).
- **Badge/tag dùng inline `style=`** theo đúng convention hiện có của file (không có design-token/CSS-class system riêng cho badge ngoài `.fintech-badge`/`.row-danger` đã có) — nhất quán với phần còn lại của bảng, không giới thiệu framework CSS mới.

---

## 4. Account Identification

```
file
  ↓ (đọc toàn bộ, không chỉ dòng 8-9 đầu)
quét mọi khối metadata dạng
  "Tên ngân hàng (chuyển|nhận): <X>"  +  "Tài khoản (nguồn|đích): <Y>"
  ↓
mỗi khối = 1 (bank, account, direction) segment, có row-range riêng
  ↓
account identity của cả file = tập các Y quan sát được (thường chỉ 1 giá trị, lặp lại)
```

### A. Số tài khoản

- **Nguồn dữ liệu (FACT):** nằm trong dòng metadata dạng text tự do ở cột C (index 2 trong mảng 0-based openpyxl): `"Tài khoản nguồn: 0010100010058007"` (file CHUYEN) hoặc `"Tài khoản đích: 0010100010058007"` (file NHAN). Regex trích xuất: `^(Tài khoản (nguồn|đích)):\s*(.+)$`.
- **Không nằm ở transaction row** dưới dạng cột riêng — cột "Thẻ/TK nguồn"/"Thẻ/TK đích" ở mỗi dòng giao dịch chứa **số tài khoản của CẢ HAI phía** (nguồn và đích cho từng giao dịch cụ thể), không phải một cột "tài khoản chủ" cố định.
- **Định dạng không cố định về độ dài** (FACT, quan sát 13 giá trị thật): từ 10 chữ số (`0986690534`, `3710105678`, `9794949999`) đến 17 chữ số (`0010100010058007`). Không được giả định độ dài cố định khi validate.
- **Có thể xác định độc lập từ CẢ file CHUYEN lẫn file NHAN** — không bắt buộc phải có file CHUYEN (xem §3).
- **Một file có thể khai cùng 1 account identity qua nhiều nhóm ngân hàng khác nhau** (xem phần B) — cần đối chiếu nhiều dòng/nhiều nhóm để chắc chắn không có mâu thuẫn (ví dụ nhóm II lại khai account số khác → phải cảnh báo AMBIGUOUS, không tự ý chọn 1 giá trị).

### B. Ngân hàng

- **Nguồn dữ liệu (FACT):** cùng dòng metadata nói trên — `"Tên ngân hàng chuyển: Ngân hàng TMCP Phương Đông"` / `"Tên ngân hàng nhận: ..."`. Đây là tên ngân hàng của **chính tài khoản đang bị điều tra**, KHÔNG phải ngân hàng đối ứng.
- **Tên ngân hàng đối ứng cho từng giao dịch** nằm ở cột riêng trên mỗi dòng: `Ngân hàng chuyển` (cột K) và `Ngân hàng nhận` (cột L) — cột nào tương ứng với "phía không phải tài khoản chủ" thì đó là ngân hàng đối ứng của giao dịch đó.
- **Không có mã ngân hàng/BIN chuẩn hóa trong metadata** — chỉ có tên đầy đủ dạng tiếng Việt tự do.
- **Cột "Mã thiết bị" KHÔNG đáng tin cậy làm mã định danh ngân hàng** (FACT, quan sát tần suất giá trị trên ~21k dòng): giá trị hỗn loạn — có lúc là mã số (`00009999`, `00000001`, `97042205` giống NAPAS bank code thật của MB Bank), có lúc là chuỗi chữ (`ACB`, `BACABANK`, `BA`, `DIGIM000`), có lúc giống ngày (`20250000`, `20260000`). **Không dùng cột này để xác định ngân hàng** — chỉ dùng cột text `Ngân hàng chuyển`/`Ngân hàng nhận`.
- **Nhiều biến thể tên cho cùng 1 ngân hàng thật** (FACT, cần bảng alias khi implement) — ví dụ đã quan sát:
  - VPBank: `"Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)"` **và** `"Ngân hàng Thương Mại Cổ Phần Việt Nam Thịnh Vượng"` (2 chuỗi khác nhau, cùng 1 ngân hàng).
  - PVcomBank: `"Ngân hàng TMCP Đại Chúng Việt Nam"` **và** `"NH TMCP Đại Chúng Việt Nam"` **và** `"Ngân hàng TMCP Đại Chúng Việt Nam - PVcomBank Pay"`.
  - `"Ngân hàng TMCP Sài Gòn"` (SCB) khác hẳn `"Ngân hàng TMCP Sài Gòn Thương Tín"` (Sacombank) — **CẢNH BÁO:** không được match theo kiểu "chứa chuỗi con", 2 tên này có chung từ "Sài Gòn" nhưng là 2 ngân hàng hoàn toàn khác nhau.
  - Content narrative (VCB) còn dùng tên viết tắt kiểu tiếng Anh khác nữa: `"tai TECHCOMBANK"`, `"tai HD BANK"`, `"tai Viet Capital Bank"`, `"tai TPBANK"` — một tầng biến thể tên thứ ba, xuất hiện trong nội dung chứ không phải cột ngân hàng.
  - **Khuyến nghị:** cần bảng alias ngân hàng chuẩn hóa (canonical bank code ↔ danh sách alias) dùng chung cho mọi nguồn (cột `Ngân hàng chuyển/nhận` + narrative trong `Nội dung chuyển`) — hiện `bank-parser.js` chưa có bảng này (mỗi bank parser tự detect qua regex riêng lẻ, không có registry alias tập trung).
- **Không thể suy ra ngân hàng từ số tài khoản** — bắt buộc lấy từ metadata text. Không có quy luật prefix số tài khoản ↔ ngân hàng nào được quan sát (BIDV bắt đầu bằng `8825...`, nhưng không có gì đảm bảo mọi số bắt đầu bằng `88` là BIDV — `UNKNOWN`, chưa đủ mẫu để kết luận).

### C. Tương quan với tên file (INFERENCE có bằng chứng mạnh, KHÔNG dùng làm nguồn sự thật)

Đối chiếu toàn bộ 13 cặp (bảng §2), phần `P1_P2` trong tên file **luôn khớp** với 6 số đầu + 4 số cuối của số tài khoản đọc được từ nội dung:

| Tên file | P1_P2 | Tài khoản (từ nội dung) | 6 đầu | 4 cuối |
|---|---|---|---|---|
| 001010_8007 | 001010 / 8007 | 0010100010058007 | 001010 ✓ | 8007 ✓ |
| 011001_3233 | 011001 / 3233 | 011001060003233 | 011001 ✓ | 3233 ✓ |
| 098669_0534 | 098669 / 0534 | 0986690534 | 098669 ✓ | 0534 ✓ |
| 371010_5678 | 371010 / 5678 | 3710105678 | 371010 ✓ | 5678 ✓ |
| *(10 cặp còn lại đều khớp tương tự)* | | | | |

**FACT:** tương quan này đúng 100% trên 13/13 cặp kiểm tra được. **INFERENCE:** tên file rất có thể được hệ thống tra cứu NAPAS tự sinh ra TỪ số tài khoản (không phải ngược lại). **Không được dùng làm nguồn sự thật** theo đúng yêu cầu — lý do: (1) chưa kiểm chứng được cơ chế sinh tên file ở phía NAPAS, có thể thay đổi theo phiên bản hệ thống hoặc đơn vị xuất báo cáo; (2) một file có nhiều nhóm ngân hàng nhưng tên file chỉ mã hóa 1 account identity, không phản ánh việc file chứa 2-3 ngân hàng khác nhau. **Cách dùng đúng:** parse tên file làm gợi ý/validation nhanh (cross-check với nội dung, cảnh báo nếu lệch), tuyệt đối không dùng để gán account/bank khi chưa mở nội dung file.

### D. Số điện thoại làm số tài khoản (INFERENCE, cần xác nhận thêm)

Account `0986690534` (cặp lẻ TPBank) trùng khớp định dạng số điện thoại di động Việt Nam (`09xxxxxxxx`). TPBank (và một số ngân hàng số khác) cho phép dùng số điện thoại làm bí danh tài khoản (VA/alias). `UNKNOWN / NEED CONFIRMATION`: không thể xác nhận chỉ từ 1 mẫu liệu đây là account thật 10 số hay alias theo số điện thoại — cần thêm dữ liệu mẫu TPBank khác để kết luận. Không ảnh hưởng logic parser (vẫn xử lý như chuỗi số tài khoản bình thường), chỉ cần lưu ý khi hiển thị/validate độ dài.

### E. Nhiều nhóm ngân hàng cho cùng 1 account identity trong 1 file (FACT quan trọng nhất mục này)

Bằng chứng — `3261_CSDT.THANHHOA.O_371010_5678_96A2D98A_CHUYEN.xlsx`:

```
Dòng 8:  "Tên ngân hàng chuyển: Ngân hàng TMCP Á Châu" (nhóm I)
Dòng 9:  "Tài khoản nguồn: 3710105678"
Dòng 10-889: 880 giao dịch
Dòng 890: "Tổng số giao dịch phát sinh theo tài khoản nguồn: 880"
Dòng 891: "Tổng số giao dịch phát sinh theo ngân hàng chuyển: 880"
Dòng 892: "II" | "Tên ngân hàng chuyển: Ngân hàng TMCP Ngoại Thương Việt Nam" (nhóm II)
Dòng 893: "Tài khoản nguồn: 3710105678"   ← CÙNG số tài khoản, KHÁC ngân hàng
Dòng 894+: giao dịch nhóm II, STT reset về 1
Dòng 1042: "III" | "Tên ngân hàng chuyển: Ngân hàng TMCP Kỹ Thương Việt Nam" (nhóm III)
```

Tương tự với `882503_1992_2DC7C4B5` (BIDV + Techcombank) và `979494_9999_38750149` (Techcombank + VCB).

**INFERENCE quan trọng cần cảnh báo:** việc 3 ngân hàng hoàn toàn khác nhau (ACB, VCB, Techcombank — mỗi ngân hàng có quy tắc sinh số tài khoản riêng) lại báo cáo **CHÍNH XÁC cùng một chuỗi số tài khoản** là bất thường về mặt nghiệp vụ ngân hàng thực tế. Có 2 khả năng: (a) đây là **dữ liệu demo/giả lập** dùng lại 1 placeholder cho nhiều nhóm khi sinh dữ liệu mẫu (khả năng cao — nhiều số tài khoản trong bộ mẫu có dạng số đẹp/lặp: `...9999`, `...5678`, `...1992`, gợi ý dữ liệu tổng hợp), hoặc (b) hệ thống NAPAS thật sự nhóm theo một định danh khác (CCCD/số điện thoại liên kết) rồi hiển thị nhầm nhãn "Tài khoản nguồn" giống nhau. **`UNKNOWN / NEED CONFIRMATION`** — cần xác nhận với dữ liệu NAPAS thật (không phải mẫu demo) trước khi cứng hóa quy tắc "1 account-string có thể trải nhiều ngân hàng" thành bất biến nghiệp vụ. Tuy nhiên, **phát hiện ở cấp độ FORMAT FILE thì chắc chắn là FACT** — bất kể ý nghĩa dữ liệu — parser bắt buộc phải hỗ trợ nhiều khối metadata lặp lại trong 1 file.

---

## Phase 8–11 Implementation Status (2026-09-14)

**STATUS: COMPLETE** — reconciliation engine architecture designed, matching engine implemented, validated against real data + 12 false-match test cases, minimally integrated into the existing upload flow. **Headline finding (evidence, not assumption): on this NAPAS export format, a CHUYEN group's transactions and its paired NHAN group's transactions are disjoint real-world events (money the investigated account sent out vs money it received) — there is no deterministic transaction-level relationship between them in the 27 sample files.** The engine honestly reports 0 MATCHED across every real fixture tested. This is the correct, evidence-backed result for this dataset, not an implementation shortfall — see the research below.

### Bug fixed before starting: a missing document heading

Trước khi bắt đầu Phase 8, phát hiện tiêu đề `## 4. Account Identification` đã bị mất trong một lần edit ở phiên Phase 5–7 trước đó (nội dung mục 4 A–E vẫn còn nguyên vẹn 100%, chỉ mất dòng heading) — đã khôi phục lại heading, không có nội dung nào bị mất hay viết lại.

### Phase 8 — Reconciliation Architecture & Research

**File đọc trước khi code:** `docs/PROJECT_CHECKPOINT.md` (không đổi từ 2026-06-30), `docs/NAPAS_UPGRADE_SPEC.md` Phase 1-7, `bank-parser.js` (toàn bộ, không đổi từ Phase 4), `app.js` (targeted: toast integration block Phase 3, dòng ~1457).

**Canonical transaction identity đã xác nhận (không tạo model song song):** `transactionId` (= Số REF, fallback Số Trace, xem makeTx §8), `transactionDate` (ghép Ngày GD+Giờ GD), `amount`, `accountNumber`, `counterpartyAccount`, `counterpartyBankName`, `bankName`, `groupIndex`, `sourceFormat`. Tất cả đã có sẵn từ Phase 1-4, không cần field mới.

**Nghiên cứu dữ liệu thật (bắt buộc trước khi thiết kế signal) — kết quả quyết định toàn bộ thiết kế Phase 9:**

| Tín hiệu kiểm tra | `860320_9818` (1 cặp) | `371010_5678` (3 cặp, mỗi bank riêng) |
|---|---|---|
| `transactionId` trùng giữa CHUYEN và NHAN | 0/29 | 0/880, 0/145, 0/1104 (cả 3 bank) |
| amount + ngày (theo ngày) trùng | 0/29 | *(không lặp lại — xu hướng đã rõ từ fixture đơn giản)* |
| amount + ngày giờ chính xác trùng | 0/29 | 0 |
| `counterpartyAccount` (CHUYEN) giao với `counterpartyAccount` (NHAN) | 0 (24 vs 63 distinct) | 17/558, 7/89, 32/754 — thấp, giải thích được bằng trùng hợp (1 người vừa gửi vừa nhận từ cùng 1 đối tác ở 2 dịp khác nhau, không chứng minh là "cùng 1 giao dịch") |
| amount-only (bỏ qua ngày) trùng | — | 181/880 (20.6%), 33/145 (22.8%), 345/1104 (31.2%) — cao nhưng **đã chứng minh là trùng hợp** (rớt về 0 khi thêm điều kiện ngày giờ chính xác) |
| CHUYEN tự tham chiếu (`counterpartyAccount === accountNumber`, dấu hiệu tự chuyển khoản giữa các ngân hàng của cùng 1 người) | 0 | **49/2129** (27 ACB + 7 VCB + 15 Techcombank) — tín hiệu thật, không trùng hợp (nội dung "LE VAN AN chuyen khoan..." xác nhận) |
| NHAN tự tham chiếu tương ứng | 0 | **0/1026** — không có giao dịch "đến" nào tự tham chiếu để khớp với 49 giao dịch tự chuyển khoản phía CHUYEN |
| Quét rộng cả 27 file: tổng tự tham chiếu | — | 49/21.344 (chỉ xuất hiện ở `371010_5678`, chỉ phía CHUYEN) |

**Kết luận (evidence-based, không phải giả định):** không tồn tại quan hệ giao dịch-với-giao dịch xác định (deterministic) nào giữa 2 phía của 1 cặp nhóm đã ghép, ngoại trừ 1 tín hiệu tự-chuyển-khoản thật (49 giao dịch) nhưng **không có "nửa kia" để khớp trong chính bộ dữ liệu mẫu này**. Theo đúng nguyên tắc §26 của nhiệm vụ ("Correctness takes priority over coverage... honest 70% matched may be better than 98% from unsafe guesses") và stop-condition §23.1 ("no deterministic relationship → đừng đoán"), quyết định: **chỉ implement 2 tier khớp, cả hai đều yêu cầu tín hiệu duy nhất (unique) ở cả 2 phía — tuyệt đối không dùng amount+date hay amount+date+counterparty làm bằng chứng đủ**, vì đã chứng minh bằng dữ liệu thật rằng tín hiệu này KHÔNG đáng tin cho định dạng NAPAS này (tỷ lệ trùng hợp 20-31% chỉ vì số tiền tròn/lặp phổ biến trong bộ mẫu, không phản ánh quan hệ thật).

### Phase 9 — Matching Engine

**File sửa:** `bank-parser.js` (thêm mới, không sửa gì của Phase 1-4).

**Kiến trúc:** `reconcileGroupPair(chuyenTx, nhanTx)` — pure function, nhận 2 mảng transaction đã được scope đúng (1 group CHUYEN + 1 group NHAN đã ghép cặp), không tự biết gì về file/pairing — test độc lập được. `reconcileAllPairs(fileResults, pairingResult)` — wrapper tiện dụng, tái sử dụng `pairNapasGroups()`'s output để scope đúng theo `chuyenFile/chuyenGroupIndex/nhanFile/nhanGroupIndex`, không parse lại Excel, không suy luận lại pairing.

**2 tier khớp (TIER duy nhất tạo ra `MATCHED`, xem bảng bằng chứng ở Phase 8):**

| Tier | Điều kiện | Confidence | Ghi chú |
|---|---|---|---|
| A — TRANSACTION_ID | `transactionId` (Số REF/Trace) giống hệt nhau, **duy nhất ở cả 2 phía** trong nhóm đang xét | CONFIRMED | Kèm sanity-check `amount` phải khớp — nếu id khớp nhưng amount xung đột → **AMBIGUOUS với reason `CONFLICTING_EVIDENCE`**, không âm thầm tin hay âm thầm bỏ qua (Phase 10 Case 11) |
| B — SELF_TRANSFER_AMOUNT_DATETIME | Giao dịch tự tham chiếu (`counterpartyAccount === accountNumber`) + amount + `transactionDate` chính xác, **duy nhất ở cả 2 phía**, chỉ áp dụng cho phần Tier A chưa giải quyết được | INFERRED | Không áp dụng cho quần thể chung (chỉ áp dụng cho tập con tự-tham-chiếu) nên không kế thừa rủi ro false-positive của amount+date đã chứng minh ở Phase 8 |

**Ràng buộc 1-1 (bắt buộc, thiết kế cấu trúc chứ không phải kiểm tra hậu kỳ):** thuật toán đếm số lượng ứng viên ở CẢ 2 PHÍA theo từng key TRƯỚC KHI gán kết quả (`_reconTierMatch`), không xử lý tuần tự theo thứ tự mảng — nếu key có >1 ứng viên ở bất kỳ phía nào, TOÀN BỘ ứng viên (cả 2 phía) → `AMBIGUOUS`, không có khái niệm "ứng viên đầu tiên thắng". Điều này giải quyết chính xác Case 9/10 của Phase 10 mà không cần logic đặc biệt riêng.

**Complexity/Indexing (§12 nhiệm vụ):** O(n) theo `Map`, lập chỉ mục theo `transactionId` (tier A) và `amount|date` (tier B) — không có vòng lặp lồng nhau O(n²). Đã đo với nhóm lớn nhất thật (Techcombank, 1104 giao dịch CHUYEN + 428 NHAN) — chạy tức thời trong bộ test Node.

**Kết quả 12 test case chống-khớp-sai (Phase 10 §9 nhiệm vụ) — 12/12 PASS**, dùng dữ liệu tổng hợp dựng tay (transaction object thật shape, không phải file mẫu):

| Case | Kịch bản | Kỳ vọng | Kết quả |
|---|---|---|---|
| 1 | Cùng amount+date, khác counterparty | không tự động khớp | PASS — 0 matched |
| 2 | Cùng amount+date+counterparty, nhiều ứng viên (dựng qua cơ chế Tier B tự-chuyển-khoản, vì đây là tier DUY NHẤT có dùng amount+date) | AMBIGUOUS, không chọn 1 | PASS — cả 3 ứng viên AMBIGUOUS |
| 3 | Amount khác nhau (dù cùng id) | không khớp | PASS — 0 matched, AMBIGUOUS với reason CONFLICTING_EVIDENCE |
| 4 | Cùng REF nhưng khác account identity, ở 2 cặp không liên quan | không khớp chéo | PASS — mỗi cặp reconcile độc lập qua `reconcileAllPairs`, 0 rò rỉ chéo |
| 5 | Cùng số TK nhưng khác ngân hàng chủ | không khớp chéo ngân hàng | PASS — transaction ở group/bank khác hoàn toàn vô hình với cặp đang xét (do scope theo `groupIndex`+file, cấu trúc, không phải điều kiện lọc) |
| 6 | Thứ tự nhóm đảo ngược | không ảnh hưởng | PASS — `reconcileGroupPair` không phụ thuộc thứ tự nhóm ở tầng nào |
| 7 | 1 CHUYEN, không NHAN | UNMATCHED_CHUYEN | PASS |
| 8 | 1 NHAN, không CHUYEN | UNMATCHED_NHAN | PASS |
| 9 | Nhiều ứng viên NHAN trùng transactionId | AMBIGUOUS, không first-match | PASS |
| 10 | 1 giao dịch NHAN bị 2 CHUYEN tranh chấp | chỉ 1 (hoặc không ai) được MATCHED, phần tranh chấp AMBIGUOUS | PASS — cả 2 CHUYEN + giao dịch NHAN bị tranh chấp đều AMBIGUOUS |
| 11 | Định danh mạnh khớp nhưng amount/date xung đột | không âm thầm bỏ qua, có conflict behavior rõ ràng | PASS — amount conflict → AMBIGUOUS/CONFLICTING_EVIDENCE; date conflict (không phải gate cứng) → vẫn MATCHED nhưng `evidence.date` trung thực báo `false` |
| 12 | Field thiếu/malformed | không crash, không fabricate | PASS — object rỗng `{}`, `undefined`, `null` trong mảng đều được xử lý an toàn |

### Phase 10 — Real-Data Validation (5 fixture bắt buộc)

| Fixture | Cặp nhóm | CHUYEN | NHAN | MATCHED | UNMATCHED_C | UNMATCHED_N | AMBIGUOUS |
|---|---|---|---|---|---|---|---|
| `860320_9818` | 1 | 29 | 71 | **0** | 29 | 71 | 0 |
| `371010_5678` — ACB | 1 | 880 | 374 | **0** | 880 | 374 | 0 |
| `371010_5678` — Vietcombank | 1 | 145 | 224 | **0** | 145 | 224 | 0 |
| `371010_5678` — Techcombank | 1 | 1104 | 428 | **0** | 1104 | 428 | 0 |
| `882503_1992` — BIDV | 1 | 114 | 128 | **0** | 114 | 128 | 0 |
| `882503_1992` — Techcombank | 1 | 36 | 17 | **0** | 36 | 17 | 0 |
| `979494_9999` — Techcombank (nhóm khớp) | 1 | 1376 | 386 | **0** | 1376 | 386 | 0 |
| `979494_9999` — Vietcombank (orphan CHUYEN) | — | 1 | — | *(không reconcile — orphan, không có cặp)* | | | |
| `098669_0534` | 0 | — | 127 | *(không reconcile — không có cặp nào)* | | | |

**Mỗi giao dịch được kiểm tra "đúng 1 trạng thái"** — assertion tự động xác nhận `unmatchedChuyen + ambiguousChuyen + matched === tổng CHUYEN` và tương tự cho NHAN, đúng trên mọi fixture (không mất giao dịch nào).

**SPECIAL AUDIT §16 (371010_5678, bắt buộc theo nhiệm vụ):** với mọi kết quả `MATCHED` (0 trong dữ liệu thật, nhưng cơ chế được audit qua test tổng hợp ở trên), assertion xác nhận `CHUYEN.accountNumber === NHAN.accountNumber` VÀ `normalizeBankName(CHUYEN.bankName) === normalizeBankName(NHAN.bankName)` — **0 vi phạm cross-bank** trên toàn bộ 371010_5678 (3 cặp). Đồng thời xác nhận **255 collision case đã tìm thấy ở Phase 5-7 vẫn còn nguyên (255/255)** — đã trở thành regression test cố định như nhiệm vụ yêu cầu (§2 CRITICAL BUG ALREADY FOUND), và **không có collision nào trong số đó gây cross-bank match** (vì Tier A/B không dùng account+counterparty làm key mà dùng transactionId/self-transfer — tự động an toàn).

**Không có % match mục tiêu định trước** — kết quả 0% MATCHED trên toàn bộ dữ liệu mẫu là kết quả trung thực, đã kiểm chứng kỹ (không phải bug), theo đúng nguyên tắc §26.

### Phase 11 — Integration

**File sửa:** `app.js` (chỉ 1 khối nhỏ, ~25 dòng); `bank-parser.js` không đổi thêm ở Phase 11 (chỉ Phase 9 đã sửa); `Khoi_chay_du_an.html` **không đổi** (không thêm UI table mới — xem lý do dưới).

**Vị trí tích hợp:** ngay trong khối toast Phase 3 đã có sẵn (`app.js`, `flaProcessFiles()`, ~dòng 1457) — đúng luồng `parse → group → pair → reconcile → UI` nhiệm vụ yêu cầu, tái sử dụng `pairing` đã tính sẵn, không tính lại.

**Quyết định thiết kế UI (lý do không sửa `buildAccountFlowMatrix`/`_renderAccountFlowTab`):** bảng "Đối Ứng TK" hiện có nhóm theo `(accountNumber, counterpartyAccount, bankId)` — một trục hoàn toàn khác với "trạng thái đối soát giao dịch" (vốn là thuộc tính của TỪNG giao dịch, gắn với 1 cặp nhóm CHUYEN/NHAN cụ thể). Nhồi trạng thái đối soát vào bảng tổng hợp đã có sẽ (a) không có vị trí tự nhiên vì 1 dòng trong bảng đó có thể gộp nhiều giao dịch với trạng thái đối soát khác nhau, (b) vi phạm "existing structure must remain compatible / do not overload" của nhiệm vụ, và (c) vì kết quả thật là 0 MATCHED trên toàn bộ dữ liệu mẫu, một bảng chi tiết mới sẽ chỉ hiển thị "chưa khớp" ở mọi nơi — giá trị thông tin thấp so với chi phí thêm 1 bảng lớn. **Quyết định:** dùng 1 toast tổng hợp gọn (tái sử dụng `_showToast` đã có, cùng cách Phase 3 đã làm), báo số liệu tổng số cặp/khớp/chưa khớp/chưa rõ ngay sau khi upload — đủ để người dùng biết engine đã chạy và biết kết quả trung thực, không cần bảng mới.

**Tương thích ngược:** khối code nằm hoàn toàn trong `if (fileResults.some(r => r.detectedBank === 'NAPAS'))` đã có từ Phase 3 — không chạy nếu không có file NAPAS nào, giao dịch ngân hàng cũ hoàn toàn không bị ảnh hưởng (verify bằng test: guard rẽ nhánh xác nhận không thực thi khi `detectedBank` toàn bộ khác `'NAPAS'`).

**Validate tích hợp:** trích xuất nguyên văn khối code mới từ `app.js` (không gõ lại), chạy với `fileResults` thật từ `860320_9818` và `371010_5678` — toast sinh ra đúng nội dung, đúng số liệu (`0 khớp · 29 CHUYEN chưa khớp · 71 NHAN chưa khớp` và `3 cặp nhóm` tương ứng); xác nhận không có toast nào sinh ra khi không có cặp nào được ghép (098669_0534 một mình).

### Regression toàn bộ (§14 nhiệm vụ)

| Nhóm | Kết quả |
|---|---|
| Detection | 11/11 PASS |
| Phase 1 (`860320_9818`) | 29/71 PASS |
| Phase 2 (3 fixture) | 2129/1026, 150/145, 1377/386 PASS |
| Phase 3 (pairing, 5 fixture) | 1/3/2 matched, 1 matched+1 orphanChuyen, 1 orphanNhan PASS |
| Phase 4 (alias + resolver) | VPBank merge, SCB/Sacombank tách biệt, OUT→UNKNOWN, IN→INFERRED PASS |
| Phase 5–7 (UI + 255-collision) | 255/255 collision baseline vẫn giữ nguyên PASS |
| Phase 8–11 (reconciliation) | 12/12 false-match case, 5/5 fixture thật, special audit 0 cross-bank, integration toast đúng nội dung — PASS |

### Data Integrity Checklist (§24 nhiệm vụ Final Audit)

| Câu hỏi | Trả lời |
|---|---|
| Mọi match có giải thích được không? | Có — mỗi record `MATCHED` có `matchMethod` + `evidence` breakdown (transactionId/amount/date/counterpartyAccount/selfTransfer) |
| Ambiguous case có được giữ lại không? | Có — `ambiguousChuyen`/`ambiguousNhan`/`ambiguousGroups` đầy đủ, không bị âm thầm resolve |
| Unmatched có được giữ lại không? | Có — không giao dịch nào bị drop, verify bằng assertion tổng số trên mọi fixture |
| 1 giao dịch có thể bị khớp 2 lần không? | Không — `resolved` Map chỉ set 1 lần/giao dịch, verify bằng test "no NHAN transaction reused" |
| 2 ngân hàng khác nhau chung 1 số TK có bị khớp chéo không? | Không — special audit §16 xác nhận 0/0, cơ chế test qua Case 4/5 tổng hợp |
| Amount trùng có gây false match không? | Không — amount không bao giờ là key/điều kiện đủ một mình |
| Field gốc (raw) có bị ghi đè không? | Không — reconciliation chỉ đọc, không mutate transaction gốc (verify ở Phase 7, không lặp lại nhưng logic reconcile cũng chỉ đọc, không gán field mới lên transaction object) |
| Ngân hàng cũ (legacy) có bị ảnh hưởng không? | Không — toàn bộ Phase 8-11 nằm sau guard `sourceFormat/detectedBank==='NAPAS'` |
| Thuật toán có deterministic không? | Có — không RNG, không threshold tuỳ ý, không ML/API ngoài |
| Performance có hợp lý không? | Có — O(n) Map-index, đã chạy nhóm 1104+428 giao dịch tức thời |

### Known Limitations (Phase 8–11)

- **Kết quả thật trên 27 file mẫu là 0 MATCHED ở mọi cặp** — đây KHÔNG phải giới hạn của thuật toán mà là bản chất dữ liệu (CHUYEN/NHAN của 1 tài khoản là 2 tập sự kiện độc lập). Nếu dữ liệu NAPAS thật (không phải demo) có REF/Trace chia sẻ giữa 2 chiều, Tier A sẽ tự động tìm thấy — không cần sửa code, chỉ cần dữ liệu có tín hiệu.
- **Tier B (self-transfer) chưa có "nửa kia" để khớp trong 27 file mẫu** — cơ chế đã implement và test đầy đủ (Case 2 test) nhưng chưa được validate bằng 1 match thật nào — cần dữ liệu NAPAS có cả 2 chiều của 1 self-transfer để xác nhận thực tế.
- **Không có UI bảng chi tiết cho reconciliation** — chỉ có toast tổng hợp (quyết định có chủ đích, xem Phase 11 ở trên) — nếu tương lai có dữ liệu thật cho tỷ lệ match cao hơn, nên cân nhắc thêm 1 bảng/tab riêng thay vì nhồi vào bảng Đối Ứng TK hiện có.
- **`evidence.date` ở Tier A không phải gate cứng** — 1 giao dịch có thể `MATCHED` dù ngày khác nhau, miễn `transactionId` trùng và duy nhất + amount khớp — quyết định có chủ đích (REF là định danh mạnh hơn ngày, có thể lệch múi giờ/ngày xử lý giữa 2 chiều settlement) nhưng cần lưu ý khi đọc evidence.
- **Reversal/settlement matching KHÔNG implement** — đúng ranh giới §11 nhiệm vụ, không có field "đảo giao dịch" nào tồn tại trong NAPAS raw data để làm căn cứ.

---

## 5. Transaction Data Model (NAPAS raw fields)

| Field (cột Excel) | Ý nghĩa | Ví dụ thực tế | Source | Required | Confidence |
|---|---|---|---|---|---|
| STT | Số thứ tự trong nhóm (reset về 1 mỗi nhóm mới) | `'1'`, `'218'` | RAW | có | FACT |
| Thẻ/TK nguồn | Số tài khoản/thẻ bên **gửi** của giao dịch này | `'0010100010058007'` | RAW | có | FACT |
| Thẻ/TK đích | Số tài khoản/thẻ bên **nhận** của giao dịch này | `'41340437'` | RAW | có | FACT |
| Ngày GD | Ngày giao dịch, `dd/mm/yyyy` (chuỗi text, không phải Excel date) | `'01/01/2025'` | RAW | có | FACT |
| Giờ GD | Giờ giao dịch dạng số nguyên `hhmmss` (không có dấu `:`) | `125658` (=12:56:58) | RAW | có | FACT |
| Số tiền | Số tiền giao dịch (VND), số nguyên dương | `129100000` | RAW | có | FACT |
| Số Trace | Mã trace nội bộ hệ thống chuyển mạch | `100226` | RAW | có | FACT |
| Số REF | Mã tham chiếu giao dịch, thường **kết thúc bằng đúng giá trị Số Trace** | `'500105100226'` (đuôi = trace `100226`) | RAW | có | FACT (quan sát nhiều dòng, ý nghĩa phần tiền tố `UNKNOWN`) |
| Mã thiết bị | Hỗn hợp — không nhất quán ý nghĩa (xem §4.B) | `'00000001'`, `'ACB'`, `'20250000'` | RAW | không tin cậy | FACT (là dữ liệu bẩn/không đồng nhất) |
| Ngân hàng chuyển | Tên ngân hàng phía gửi (text tự do) | `'Ngân hàng TMCP Á Châu'` | RAW | có | FACT |
| Ngân hàng nhận | Tên ngân hàng phía nhận (text tự do) | `'Ngân hàng TMCP Ngoại Thương Việt Nam'` | RAW | có | FACT |
| Nội dung chuyển | Nội dung tự do người chuyển nhập | xem §7 | RAW | có (có thể rỗng/vô nghĩa) | FACT |
| Cấp đệ quy | Cấp truy vết đệ quy (hop level) | luôn `1` trong 21.344 dòng đã quét | RAW | có | FACT (giá trị luôn 1 trong mẫu; field tồn tại nên khả năng hệ thống hỗ trợ hop >1 khi mở rộng truy vết — `UNKNOWN` chưa quan sát được) |

**RAW vs DERIVED vs DISPLAY:**

- **RAW** = 13 cột trên, đọc trực tiếp từ Excel, không biến đổi.
- **DERIVED** (suy ra bằng logic, không có sẵn trong RAW):
  - `direction` (IN/OUT) — suy từ: file là CHUYEN hay NHAN, **và/hoặc** so khớp cột `Thẻ/TK nguồn`/`đích` với account identity của nhóm hiện tại (đối chiếu chéo để phát hiện mâu thuẫn).
  - `ownAccountNumber`, `ownBankName` — lấy từ metadata nhóm (§4), gán cho mọi giao dịch thuộc nhóm đó.
  - `counterpartyAccountNumber`, `counterpartyBankName` — lấy từ cột còn lại (không phải phía own).
  - `counterpartyNameCandidate` + `confidence` — suy luận từ `Nội dung chuyển` (§6, §7).
  - `transactionDateTime` chuẩn ISO — ghép `Ngày GD` + `Giờ GD` (parse `hhmmss` thành `HH:MM:SS`).
- **DISPLAY** = giá trị đã format cho bảng phân tích (§10): số tiền có dấu phẩy, tên ngân hàng đã chuẩn hóa qua bảng alias, badge độ tin cậy tên đối ứng, v.v.

---

## Phase 12–15 Implementation Status (2026-09-14)

**STATUS: COMPLETE** — forensic audit thực hiện trên toàn bộ 7 cặp nhóm đã ghép (không chỉ 1 fixture như Phase 8), kết luận **Option C** (không đủ bằng chứng cho matching rule mới) được xác nhận với biên độ rất rộng — không giữ nguyên engine vì "đã lỡ viết code", mà vì bằng chứng thật sự không đủ. Một điểm hardening nhỏ (defense-in-depth) được thêm vào engine dựa trên yêu cầu hard-constraint của Phase 13. 18/18 test case + 10/10 invariant + 255-collision + real-data baseline + full regression đều PASS.

**Sửa lỗi tài liệu phát hiện đầu phiên:** heading `## 5. Transaction Data Model (NAPAS raw fields)` cũng bị mất theo đúng kiểu lỗi giống `## 4. Account Identification` ở phiên trước (nội dung bảng field vẫn nguyên vẹn, chỉ mất dòng heading, xảy ra khi chèn section "Phase 8–11 Implementation Status" ở phiên trước) — đã khôi phục. Ghi nhận: đây là lỗi lặp lại 2 lần liên tiếp khi dùng kỹ thuật "old_string/new_string kết thúc ngay trước heading kế tiếp" — các phiên sau nên kiểm tra lại toàn bộ heading `## ` bằng grep ngay sau khi chèn section mới.

### Phase 12 — Reconciliation Forensic Data Audit

**Nguyên tắc phiên này:** KHÔNG sửa matching engine trước khi audit xong (đúng yêu cầu §3 nhiệm vụ). Audit chạy trên **toàn bộ 7 cặp nhóm thật** (Phase 8 trước đây chỉ audit sâu 1 fixture + 1 fixture rộng) — script Python đọc trực tiếp từ 4 file CHUYEN+NHAN mẫu (`860320_9818`, `371010_5678` ×3 bank, `882503_1992` ×2 bank, `979494_9999` ×1 bank có cặp), không chỉnh sửa/ghi đè file mẫu.

**12.1 Inventory + 12.2 REF/Trace audit — kết quả trên TOÀN BỘ 7 cặp, không ngoại lệ:**

| Cặp nhóm | CHUYEN | NHAN | REF overlap | Trace overlap | REF↔Trace chéo |
|---|---|---|---|---|---|
| `860320_9818` / Agribank | 29 | 71 | **0** | **0** | 0/0 |
| `371010_5678` / ACB | 880 | 374 | **0** | **0** | 0/0 |
| `371010_5678` / Vietcombank | 145 | 224 | **0** | **0** | 0/0 |
| `371010_5678` / Techcombank | 1104 | 428 | **0** | **1** (trong ~1.760 giá trị — trùng hợp ngẫu nhiên, không kèm bằng chứng nào khác) | 0/0 |
| `882503_1992` / BIDV | 114 | 128 | **0** | **0** | 0/0 |
| `882503_1992` / Techcombank | 36 | 17 | **0** | **0** | 0/0 |
| `979494_9999` / Techcombank | 1376 | 386 | **0** | **0** | 0/0 |

**Kết luận 12.2 (FACT, không phải suy đoán):** `Số REF` không bao giờ trùng giữa 2 phía trên cả 7 cặp. `Số Trace` trùng đúng 1 lần duy nhất (trong Techcombank/371010_5678), không kèm bất kỳ tín hiệu củng cố nào khác (amount/date khác nhau hoàn toàn khi kiểm tra) → xác nhận là trùng hợp ngẫu nhiên giữa 2 số nguyên ngắn trong tập ~1.760 giá trị, không phải bridge thật.

**12.3 Amount audit:** với mỗi cặp, đếm số lượng amount "unique ở cả 2 phía" (ứng viên khớp lý tưởng nếu chỉ dùng amount) — dao động 0-11 tùy cặp (VD: ACB 10/34, Techcombank/371010 11/51, Techcombank/882503 2/5). Con số này KHÔNG được dùng làm bằng chứng khớp — xem 12.4.

**12.4 Date/time audit (quan trọng nhất để bác bỏ amount+date làm signal):** với từng ứng viên "amount unique cả 2 phía" ở trên, so sánh ngày giờ THẬT:
- Phần lớn cặp: tỷ lệ trùng ngày trong số ứng viên chỉ 0-27% (VD ACB: 1/10, Vietcombank: 0/5, BIDV: 0/2, Techcombank/371010: 1/11, Techcombank/979494: 3/9) — và ngay cả khi "trùng ngày" cũng không trùng giờ (chênh lệch hàng giờ).
- Trường hợp cá biệt: `882503_1992`/Techcombank có 2/2 ứng viên trùng ngày, giờ khá gần nhau (74713 vs 3507 giây; 90404 vs 90320 giây) — NHƯNG đây là nhóm cực nhỏ (36+17=53 giao dịch), 2/2 hoàn toàn có thể là trùng hợp thống kê khi tổng thể chỉ có 5 ứng viên "unique cả 2 phía" và amount là số tròn phổ biến (700.000₫, 37.000.000₫). **`AMBIGUOUS EVIDENCE — không đủ mạnh để kết luận là bridge thật`, không dùng làm căn cứ.**
- **Kết luận:** không tồn tại quan hệ ngày-giờ ổn định giữa 2 phía. Không có tolerance window nào (±phút, cùng ngày...) được rút ra từ dữ liệu vì dữ liệu không cho thấy pattern nhất quán để đo tolerance — tự chọn 1 con số sẽ là suy đoán, không phải evidence-based.

**12.5 Counterparty-account audit:** `CHUYEN.counterpartyAccount` (bên nhận) giao với `NHAN.counterpartyAccount` (bên gửi) trên mỗi cặp: 0, 17/558, 7/89, 32/754, 1/61, 2/23, 28/530 — tỷ lệ thấp (0-6%), giải thích được bằng việc 1 người thật có thể vừa gửi vừa nhận từ cùng 1 đối tác ở 2 dịp hoàn toàn khác nhau — **không tự nó chứng minh 2 giao dịch cụ thể nào liên quan**, không dùng làm matching signal (đã quyết định từ Phase 8, tái xác nhận ở đây với phạm vi audit rộng hơn).

**12.6 Description/reference bridge audit:** tìm ID nhúng trong nội dung MBVCB (VD `"8171085576"` trong `"MBVCB.8171085576.448839...."`) và cross-check với REF/Trace của phía đối diện — **0 overlap trên mọi cặp có nội dung MBVCB** (ACB, Vietcombank, Techcombank×2, 979494). Không tìm thấy bridge ẩn nào khác qua nội dung tự do.

**12.7 Self-transfer audit (Tier B) — mở rộng so với Phase 8:**

| Cặp | CHUYEN tự tham chiếu | NHAN tự tham chiếu | Trong số CHUYEN tự tham chiếu, có ỨNG VIÊN NHAN nào cùng amount+date không (kể cả không tự tham chiếu)? |
|---|---|---|---|
| ACB | 27 | 0 | 0/27 |
| Vietcombank | 7 | 0 | 0/7 |
| Techcombank/371010 | 15 | 0 | **1/15** |
| Các cặp còn lại | 0 | 0 | N/A |

Tổng: 49/21.344 giao dịch tự tham chiếu trên toàn bộ 27 file mẫu, tất cả ở `371010_5678`, tất cả ở phía CHUYEN. Ngay cả khi NỚI LỎNG điều kiện (bỏ yêu cầu tự-tham-chiếu ở phía NHAN, chỉ cần "có giao dịch NHAN nào cùng amount+date"), chỉ 1/49 có ứng viên — và tỷ lệ này (~2%) nằm trong biên độ trùng hợp ngẫu nhiên đã đo được ở 12.4 (0-27%), **không phân biệt được với nhiễu**. **Kết luận:** đánh dấu Tier B là **IMPLEMENTED BUT NOT VALIDATED** (không phải sai về semantic — logic tự-chuyển-khoản vẫn đúng về mặt nghiệp vụ ngân hàng nếu dữ liệu thật có cả 2 chiều — chỉ là bộ mẫu 27 file không có "nửa kia" để xác nhận). Giữ nguyên Tier B, không loại bỏ (đúng lựa chọn nhánh nhiệm vụ đưa ra cho trường hợp evidence chưa đủ nhưng logic vẫn sound).

**12.8 Sample-bias analysis:** mọi file trong bộ mẫu đều mang tiêu đề `"PHỤ LỤC SỐ 01: THÔNG TIN CHI TIẾT"` gắn với 1 công văn `CV-NAPAS.KSTT`, sheet tên `"KET QUA TIM KIEM"` (= "KẾT QUẢ TÌM KIẾM" / search results). Đây là bằng chứng **cấu trúc** (không chỉ thống kê) cho thấy mỗi file CHUYEN/NHAN là **kết quả 1 truy vấn độc lập** ("tìm mọi giao dịch ĐI của TK X" / "tìm mọi giao dịch ĐẾN của TK X"), không phải 1 bản export giao dịch dạng sổ cái ghép cặp thiết kế sẵn cho reconciliation. Điều này giải thích **TẠI SAO** REF/Trace không bao giờ trùng: 2 truy vấn độc lập không có lý do gì để chia sẻ 1 hệ REF/Trace tham chiếu chéo.

### Phase 13 — Evidence-Based Matching Decision

**Quyết định: OPTION C — không đủ bằng chứng đáng tin cậy để thêm matching rule mới.** Căn cứ: 0/7 cặp có REF/Trace overlap thật; các "ứng viên" amount+date đã kiểm tra riêng lẻ và xác nhận là trùng hợp (ngày giờ thực tế sai lệch lớn ở phần lớn trường hợp); Tier B (self-transfer) có tín hiệu thật (49 giao dịch) nhưng không có "nửa kia" để xác nhận; bằng chứng cấu trúc (12.8) giải thích được lý do thiếu tương quan mà không cần suy đoán. Không mở rule mới (không có Tier C) — giữ nguyên 2 tier hiện tại.

**13.1 Matching Rule Governance (ghi nhận chính thức cho 2 tier hiện có, theo đúng format nhiệm vụ yêu cầu):**

**MATCH_TIER_A**
- Signal: `transactionId` (Số REF, fallback Số Trace) giống hệt nhau
- Requires: duy nhất ở CẢ 2 phía trong phạm vi 1 cặp nhóm đã ghép; `amount` phải khớp; `accountNumber` phải khớp; `normalizeBankName(bankName)` phải khớp (2 điều kiện sau mới thêm ở Phase 13, xem dưới)
- Reject when: >1 ứng viên ở 1 trong 2 phía (duplicate identity)
- Ambiguous when: id trùng+duy nhất nhưng amount hoặc account/bank identity xung đột (`CONFLICTING_EVIDENCE`)
- Evidence: `{transactionId, amount, date, counterpartyAccount, selfTransfer:false}`
- Validated: chưa có match thật nào trên 27 file mẫu (0/7 cặp); cơ chế xác nhận đúng qua 18 test case tổng hợp

**MATCH_TIER_B — SELF_TRANSFER_AMOUNT_DATETIME**
- Signal: `counterpartyAccount === accountNumber` (tự tham chiếu) + `amount` + `transactionDate` chính xác
- Requires: duy nhất ở CẢ 2 phía trong phần Tier A chưa xử lý; `accountNumber` + `normalizeBankName(bankName)` phải khớp (mới thêm Phase 13)
- Reject when: >1 ứng viên ở 1 trong 2 phía
- Ambiguous when: như trên
- Evidence: như trên, `selfTransfer:true`
- Validated: **IMPLEMENTED BUT NOT VALIDATED** — 0 match thật, nhưng 18 test case tổng hợp xác nhận cơ chế hoạt động đúng khi có dữ liệu

**Không có MATCH_TIER_C** — không đủ evidence theo đúng Option C.

### Phase 13 — Conflict Resolution / Hard Constraint (đã implement)

**File sửa:** `bank-parser.js` — thêm `_reconSameOwnIdentity(c, n)`, áp dụng làm `validate` callback cho CẢ Tier A và Tier B (Tier B trước đây chưa có validate riêng).

**HARD CONSTRAINT (bắt buộc cho mọi match cuối cùng):** `chuyen.accountNumber === nhan.accountNumber` **VÀ** `normalizeBankName(chuyen.bankName) === normalizeBankName(nhan.bankName)` **VÀ** ràng buộc 1-1 (đã có từ Phase 9) **VÀ** bằng chứng riêng của tier. Đây là **defense-in-depth**: trong luồng bình thường qua `reconcileAllPairs()`, ràng buộc này đã được đảm bảo cấu trúc (do `pairNapasGroups()` chỉ ghép các nhóm cùng account+bank), nhưng `reconcileGroupPair()` là hàm public/test-độc-lập, có thể bị gọi trực tiếp với mảng dựng tay — hard constraint đảm bảo an toàn ngay cả khi caller không tuân thủ đúng.

**Test case mới xác nhận (Test 8, xem Phase 14):** REF trùng + amount trùng nhưng `accountNumber` khác nhau → **AMBIGUOUS/CONFLICTING_EVIDENCE**, không match — trước Phase 13 đây là 1 lỗ hổng lý thuyết (không có bằng chứng bị khai thác trong dữ liệu thật, nhưng đúng theo yêu cầu "HARD REJECT" của nhiệm vụ).

### Phase 14 — Dedicated Reconciliation Regression Suite

**18/18 test case PASS** (Node harness tạm, dùng `bank-parser.js` thật không sửa đổi, đã xoá sau khi chạy):

| # | Kịch bản | Kỳ vọng | Kết quả |
|---|---|---|---|
| 1 | Khớp xác định chính xác | MATCHED | PASS |
| 2 | Chỉ cùng amount | NOT MATCHED | PASS |
| 3 | Cùng amount+date, nhiều ứng viên | AMBIGUOUS, không first-match | PASS |
| 4 | Cùng account, khác own bank | HARD REJECT | PASS |
| 5 | Khác parent group | HARD REJECT / không rò rỉ chéo | PASS |
| 6 | 1 giao dịch bị 2 ứng viên tranh chấp (reuse attempt) | không ai được match arbitrarily | PASS |
| 7 | Định danh mạnh + amount xung đột | conflict rõ ràng, không silent | PASS |
| 8 | Định danh mạnh + account identity xung đột (MỚI, Phase 13) | HARD REJECT | PASS |
| 9 | Thiếu transactionId | không fabricate match | PASS |
| 10 | Thiếu amount | không crash | PASS |
| 11 | Thiếu date | không crash | PASS |
| 12 | Transaction malformed | không crash, không fabricate | PASS |
| 13 | Duplicate cả 2 phía (qua Tier A) | AMBIGUOUS | PASS |
| 14 | Nhóm CHUYEN rỗng | an toàn | PASS |
| 15 | Nhóm NHAN rỗng | an toàn | PASS |
| 16 | Nhóm orphan | không bao giờ được reconcile | PASS |
| 17 | Thứ tự nhóm đảo ngược | không ảnh hưởng | PASS |
| 18 | Giao dịch legacy | không bị corrupt bởi code NAPAS | PASS |

**10/10 invariant PASS** (kiểm tra trên toàn bộ 7 cặp nhóm thật + 1 kiểm tra mutate bằng snapshot JSON trước/sau):

INVARIANT 1 (match thuộc đúng 1 parent group) · 2 (không giao dịch nào match 2 lần, kiểm tra global qua tất cả fixture) · 3/4 (mọi giao dịch CHUYEN/NHAN được tính đúng 1 lần) · 5 (không cross-bank) · 6 (không cross-account) · 7 (orphan không bao giờ reconcile) · 8 (ambiguous không tự promote — qua Test 3/6b/13) · 9 (không fabricate evidence) · 10 (không mutate dữ liệu gốc) — **tất cả PASS**.

**255-collision permanent regression (yêu cầu §2 nhiệm vụ trước + §7 nhiệm vụ này):** re-run xác nhận **255/255** vẫn còn nguyên trên `371010_5678`, và xác nhận thêm: **0 trong số 255 collision này tạo ra cross-bank match** (vì Tier A/B không bao giờ dùng `accountNumber+counterpartyAccount` làm key).

**Real-data baseline (Phase 14 §9 nhiệm vụ, không giấu số 0):**

| Cặp | CHUYEN | NHAN | MATCHED | UNMATCHED_C | UNMATCHED_N | AMBIGUOUS |
|---|---|---|---|---|---|---|
| `860320_9818`/Agribank | 29 | 71 | 0 | 29 | 71 | 0 |
| `371010_5678`/ACB | 880 | 374 | 0 | 880 | 374 | 0 |
| `371010_5678`/Vietcombank | 145 | 224 | 0 | 145 | 224 | 0 |
| `371010_5678`/Techcombank | 1104 | 428 | 0 | 1104 | 428 | 0 |
| `882503_1992`/BIDV | 114 | 128 | 0 | 114 | 128 | 0 |
| `882503_1992`/Techcombank | 36 | 17 | 0 | 36 | 17 | 0 |
| `979494_9999`/Techcombank | 1376 | 386 | 0 | 1376 | 386 | 0 |
| **TỔNG** | **3684** | **1628** | **0** | **3684** | **1628** | **0** |

**REAL-DATA VALIDATED:** toàn bộ bảng trên (chạy trực tiếp qua `reconcileAllPairs()` trên 27 file mẫu thật). **SYNTHETICALLY VALIDATED:** 18 test case + 10 invariant (dữ liệu dựng tay, vì dữ liệu thật không có ca MATCHED/AMBIGUOUS nào để test bằng dữ liệu thật). **NOT VALIDATED:** Tier B chưa có 1 match thật nào để chứng minh (xem 12.7).

### Phase 15 — Integration Hardening

**File sửa thêm:** không có (toast Phase 11 giữ nguyên, chỉ re-verify với engine đã hardening).

**Verify:** trích xuất nguyên văn khối toast từ `app.js`, chạy lại với `bank-parser.js` đã cập nhật (hard constraint mới) — toast vẫn sinh đúng, vẫn trung thực ("0 khớp", không có chữ "thành công"/"success" nào — verify bằng regex tường minh). Test synthetic bổ sung xác nhận nhánh "chưa rõ" (ambiguous > 0) hoạt động đúng khi thật sự có ambiguous (dựng 1 ca duplicate transactionId tổng hợp) — trước đây nhánh này chưa từng được thực thi trên dữ liệu thật (vì ambiguous luôn = 0) nên cần test tổng hợp riêng để chứng minh code path không có bug tiềm ẩn.

**Legacy:** xác nhận lại guard `fileResults.some(r => r.detectedBank === 'NAPAS')` vẫn chặn đúng — dataset chỉ có ngân hàng cũ không kích hoạt bất kỳ code Phase 8-15 nào.

**Performance (§12 nhiệm vụ):** đo trực tiếp bằng `process.hrtime.bigint()` trên nhóm thật lớn nhất (Techcombank/371010_5678, 1104+428=1.532 giao dịch): `reconcileGroupPair()` chạy **0.9ms**. Toàn bộ 3 cặp của `371010_5678` (3.155 giao dịch): `reconcileAllPairs()` chạy **1.28ms**. Xác nhận O(n) Map-index, không có rủi ro hiệu năng.

**Security:** không có thay đổi rendering HTML mới ở Phase 12-15 (chỉ toast text đã có từ Phase 11, đã qua kiểm tra escaping gián tiếp vì `_showToast` không dùng `innerHTML` cho nội dung message theo quan sát ở Phase 5-7).

### Data Integrity Checklist (final audit §24 nhiệm vụ trước, tái xác nhận)

| Câu hỏi | Trả lời |
|---|---|
| Match nào có thể giải thích được không? | Có (nhưng thật sự = 0 match trên dữ liệu thật; cơ chế evidence đã test đủ qua synthetic) |
| Ambiguous có bị âm thầm resolve không? | Không (invariant 8) |
| Unmatched có bị drop không? | Không (invariant 3/4) |
| 1 giao dịch match 2 lần? | Không (invariant 2) |
| Cross-bank match? | Không (invariant 5, 255-collision re-verify) |
| Cross-account match? | Không (invariant 6, Test 8 mới) |
| Duplicate amount gây false match? | Không (12.3/12.4 đã bác bỏ amount/amount+date làm signal đủ) |
| Raw field bị ghi đè? | Không (invariant 10) |
| Legacy bị ảnh hưởng? | Không (Test 18, guard NAPAS-only) |
| Deterministic? | Có (không RNG/threshold tùy ý/ML/API ngoài) |
| Performance hợp lý? | Có (0.9-1.3ms cho nhóm/case lớn nhất thật) |
| UI có nói dối không (VD "reconciled successfully" khi 0 match)? | Không — verify bằng test regex tường minh |

### Known Limitations (Phase 12–15)

- **0% match rate trên 27 file mẫu vẫn là kết quả cuối cùng sau audit sâu** — không phải do thiếu tìm kiếm, mà do bản chất dữ liệu (12.8: 2 truy vấn độc lập, không phải sổ cái ghép cặp).
- **Tier B chính thức gắn nhãn IMPLEMENTED BUT NOT VALIDATED** trong tài liệu lẫn code comment — cần dữ liệu NAPAS thật có tình huống tự-chuyển-khoản đầy đủ 2 chiều để xác nhận.
- **Không có UI bảng chi tiết** — vẫn giữ nguyên quyết định Phase 11 (toast tổng hợp), chưa có lý do mới để mở rộng vì match rate vẫn = 0.
- **Tolerance ngày/giờ KHÔNG được định nghĩa** — dữ liệu không đủ nhất quán để rút ra 1 con số cụ thể (12.4), đúng theo yêu cầu "không tự chọn ±5 phút" của nhiệm vụ.
- **`_reconSameOwnIdentity` là hardening phòng thủ, không phải fix cho lỗi đã quan sát** — trong luồng `reconcileAllPairs()` bình thường, điều kiện này luôn đúng sẵn do cách `pairNapasGroups()` hoạt động; chỉ có giá trị khi `reconcileGroupPair()` được gọi trực tiếp với dữ liệu không chuẩn.

---

## 6. Counterparty Resolution

Đây là bài toán nghiệp vụ trọng tâm. NAPAS **không có cột "tên tài khoản đối ứng"**. Phải suy luận từ `Nội dung chuyển`, với mức độ tin cậy khác nhau tùy ngân hàng nguồn của nội dung.

**Trạng thái đề xuất (4 mức, dùng cho field `counterpartyNameConfidence`):**

| Trạng thái | Điều kiện | Ví dụ |
|---|---|---|
| `CONFIRMED` | Nội dung khớp một pattern có cấu trúc rõ ràng tách được cả tên **và** số tài khoản đối ứng, do chính hệ thống ngân hàng sinh ra (không phải tự nhập tay) | Pattern MBVCB — xem bên dưới |
| `INFERRED` | Nội dung khớp pattern `"<TÊN> chuyen tien"` / `"<TÊN> chuyen khoan..."` — tên nằm ở đầu chuỗi, viết hoa, theo sau bởi cụm động từ chuyển tiền cố định | `'NGUYEN HOANG NAM chuyen tien'` |
| `AMBIGUOUS` | Nội dung chứa 1 cụm giống tên nhưng ngắn/không chắc chắn, hoặc có thể là tên viết tắt/nickname | `'An'`, `'Minh'`, `'Ainh'`, `'An M'` |
| `UNKNOWN` | Nội dung không chứa dấu hiệu tên nào (mã giao dịch thuần, ghi chú nghiệp vụ, nội dung QR/ví điện tử, hoặc rỗng) | `'CK'`, `'MomoQR'`, `'GQ77P2URU97LROO90THF'`, `'KO GHI NOI DUNG CHUYEN KHOAN'` |

### Pattern CONFIRMED — Vietcombank message template (bằng chứng mạnh nhất tìm được)

Evidence — `3261_CSDT.THANHHOA.O_371010_5678_96A2D98A_CHUYEN.xlsx`, dòng 894 (nhóm II, ngân hàng nguồn = VCB):
```
Nội dung chuyển:
"MBVCB.8171085576.448839.LE VAN AN chuyen tien.CT tu 3710105678 LE VAN AN toi
99MM24302M43004812 MOMO_TAP HOA TONG HOP NONG THU tai Viet Capital Bank"
```
Dòng 895, 896, 897 (cùng file) lặp lại đúng cấu trúc với người/tài khoản khác:
```
"...CT tu 3710105678 LE VAN AN toi 19035177675015 DO THI LIEN tai TECHCOMBANK"
"...CT tu 3710105678 LE VAN AN toi 0813106661 TRAN DANG THANH tai HD BANK"
"...CT tu 3710105678 LE VAN AN toi 11124011990 PHAM VAN HIEU tai TPBANK"
```

**Cấu trúc tổng quát (FACT, quan sát ≥4 lần lặp lại nhất quán):**
```
MBVCB.<id1>.<id2>.<TÊN_NGUỒN> chuyen tien.CT tu <STK_nguồn> <TÊN_NGUỒN> toi <STK_đích> <TÊN_ĐÍCH> tai <NGÂN_HÀNG_ĐÍCH_dạng_viết_tắt>
```
Regex đề xuất: `/^MBVCB\.\d+\.\d+\..+?\.CT tu (\S+)\s+(.+?)\s+toi\s+(\S+)\s+(.+?)\s+tai\s+(.+)$/`

Pattern này cho **CONFIRMED** cả 2 chiều (tên+số tài khoản nguồn VÀ đích) trong cùng 1 lần match — chỉ xuất hiện khi ngân hàng nguồn phát sinh nội dung là VCB (cột `Ngân hàng chuyển`/`Ngân hàng nhận` = "Ngân hàng TMCP Ngoại Thương Việt Nam"). **Ghi chú kiến trúc:** `bank-parser.js` hiện tại (`parseVCB`, dòng 285-318) **chưa khai thác pattern này** — `counterpartyName` luôn bị set `null` cho VCB dù dữ liệu VCB thật có thể chứa narrative dạng MBVCB tương tự. Đây là điểm có thể cải thiện chung cho cả bank statement VCB thường, không chỉ riêng NAPAS — nên đề cập khi implement nhưng không bắt buộc trong phase NAPAS.

### Pattern INFERRED — theo ngân hàng nguồn (per-bank, KHÔNG dùng 1 regex chung)

Bằng chứng: cùng account, cùng loại giao dịch, nhưng **format nội dung khác nhau tuỳ ngân hàng đối ứng** — không được hard-code 1 pattern từ vài dòng, phải phân loại theo `Ngân hàng chuyển`/`Ngân hàng nhận` của phía gửi. Bằng chứng thu thập được (nhiều dòng, nhiều file):

| Ngân hàng phát sinh nội dung | Pattern quan sát | Số lần quan sát |
|---|---|---|
| Quân Đội (MB Bank) | `"<TÊN> chuyen tien"` | Nhiều (VD: `NGUYEN HONG THAI AN chuyen tien`) |
| Á Châu (ACB) | `"<TÊN> chuyen khoan-ddmmyy-HH:MM:SS <ref>"` hoặc biến thể dấu cách thay `:` | `MA THI DIEU LINH chuyen khoan-010125-16:02:38 790322`; `LE VAN AN CHUYEN KHOAN-290326-18 30 56 6088ASCB02YQVVM1` |
| Kỹ Thương (Techcombank) | `"<TÊN> FT<ref>"` hoặc `"<TÊN> chuyen tien FT<ref>"` hoặc `"<TÊN>  chuyen FT<ref>"` (2 khoảng trắng) | `NGUYEN HONG THAI AN FT25002744677802`; `BUI XUAN MINH  chuyen FT25014200734084` |
| VPBank / Sài Gòn - Hà Nội / An Bình / Đông Á / Bắc Á (nhóm dùng chung 1 template "IBFT") | `"IBFT <TÊN> chuyen tien"` hoặc `"IBFT Ck"` (không tên) | `IBFT NGUYEN VAN TUNG chuyen tien` (lặp lại hàng chục lần, khác ngân hàng đối ứng) |
| Đại Chúng / Việt Nam Thương Tín / HSBC | `"<TÊN> CHUYEN TIEN"` (viết hoa toàn bộ hoặc Title case) | `DOAN MINH ANH CHUYEN TIEN`, `NGUYEN TIEN NGUYEN Chuyen tien` |
| MOMO (ví điện tử, không phải ngân hàng) | `"<TÊN> chuyen tien ho FT<ref>"` hoặc nội dung merchant/QR không có tên | `TRIEU QUE MI chuyen tien ho FT26083263445408`; nhưng cũng có `'MomoQR'`, `'Store 107 Duong Nguyen V'` (merchant, không phải tên cá nhân) |
| NAPAS-ECOM | Nội dung dịch vụ công, không có tên cá nhân | `'Thanh toan ho so DVC G01. FT25219300020206'` |

**Kết luận thiết kế:** cần **registry pattern theo ngân hàng** (tương tự `_FINTECH_REGISTRY` đã có trong `app.js` dòng 3616) thay vì 1 regex toàn cục. Với mỗi registry entry: `{ bankMatch, regex, confidence, extractName, extractRef }`.

### Pattern AMBIGUOUS / UNKNOWN

- Fragment quá ngắn không đủ để phân biệt tên người với từ thường: `'An'`, `'An M'`, `'Ainh'`, `'Minh'`, `'o'`, `'CK'`, `'xin loi'`, `'to brick'` — **không được tự động coi là tên**, gắn `AMBIGUOUS` nếu ≥2 ký tự viết hoa liên tiếp có dạng tên, ngược lại `UNKNOWN`.
- Nội dung là mã hệ thống/QR opaque: `'GQ77P2URU97LROO90THF'`, `'25121300102110233AIP'` → `UNKNOWN`.
- Nội dung khai báo rõ ràng "không ghi": `'KO GHI NOI DUNG CHUYEN KHOAN'` → `UNKNOWN`, không cố suy luận thêm.
- Nội dung là ghi chú nghiệp vụ không liên quan đến danh tính: `'CK'`, `'xin loi'`, `'Anh cho ba chu nha em tien'` → `UNKNOWN` (câu có ý nghĩa nhưng không chứa tên định danh).

### Phát hiện quan trọng: nội dung **CHUYEN** (đi) thường chứa tên **CHỦ TÀI KHOẢN NGUỒN**, không phải đối ứng

Bằng chứng thống kê (file `001010_8007_CHUYEN.xlsx`, lấy mẫu 6 dòng/từng trong số 18 ngân hàng đối ứng khác nhau xuất hiện trong file): nội dung `'HSU I AN transfer'` xuất hiện lặp lại ở **hầu hết mọi ngân hàng đối ứng khác nhau** (Á Châu, Ngoại Thương, BIDV, Vietinbank, Sacombank, Quân Đội, Kỹ Thương, Hàng Hải, Quốc Tế, Tiên Phong, Xuất Nhập Khẩu, Đông Nam Á, Agribank, Woori, Shinhan, Bản Việt, VPBank, Standard Chartered, Nam Á, Đại Chúng, Đại Dương…) — biến số duy nhất không đổi giữa các dòng này là **tài khoản nguồn** (luôn `0010100010058007`), không phải ngân hàng đích. → nội dung này gắn với **người khởi tạo giao dịch (chủ tài khoản nguồn)**, không phải người nhận.

**Hệ quả thiết kế quan trọng:** ở chiều **CHUYEN**, `Nội dung chuyển` chủ yếu mô tả **chủ tài khoản đang điều tra**, không phải đối ứng — resolver không nên cố suy luận "tên đối ứng" từ nội dung ở chiều CHUYEN trừ khi nội dung khớp 1 trong các pattern có cấu trúc (MBVCB, "IBFT tên", v.v. — những pattern này do NGÂN HÀNG ĐÍCH sinh ra và thực chất phản ánh tên người NHẬN, ngay cả khi xuất hiện trong file CHUYEN của người gửi — cần phân biệt "nội dung do bên gửi tự gõ" và "nội dung do hệ thống ngân hàng của bên nhận tự sinh thêm").
Ở chiều **NHAN**, nội dung có xu hướng phản ánh **người gửi (đối ứng)** rõ hơn nhiều — phù hợp với mục tiêu "tên đối ứng" của bảng phân tích, và nên là nguồn ưu tiên khi 1 giao dịch xuất hiện ở cả 2 phía (nếu ghép được với giao dịch tương ứng bên kia — xem §11 duplicate).

---

## 7. Transaction Content Parsing — phân loại deterministic / heuristic / unknown

| Loại | Mô tả | Ví dụ | Độ tin cậy |
|---|---|---|---|
| **Deterministic** | Pattern do hệ thống ngân hàng sinh tự động, cấu trúc cố định, tách được field | `MBVCB.<id>.<id>.<tên> chuyen tien.CT tu <acc> <tên> toi <acc> <tên> tai <bank>` | CONFIRMED |
| **Deterministic (yếu hơn)** | Cấu trúc `<TÊN> + cụm cố định`, nhưng chỉ có tên (không có acc đối ứng kèm theo) | `<TÊN> chuyen tien`, `<TÊN> FT<ref>`, `IBFT <TÊN> chuyen tien` | INFERRED |
| **Heuristic** | Có dấu hiệu tên (chữ hoa liên tiếp, 2-4 từ) nhưng không theo cụm cố định nào | `An M`, `Ainh` | AMBIGUOUS |
| **Unknown** | Mã hệ thống/QR, ghi chú nghiệp vụ chung chung, hoặc khai báo "không ghi nội dung" | `CK`, `MomoQR`, `KO GHI NOI DUNG CHUYEN KHOAN` | UNKNOWN |

**Đặc điểm chữ viết quan sát được (FACT):** đa số tên trong nội dung viết **KHÔNG DẤU** (`LE VAN AN`, `NGUYEN VAN TUNG`) — nhất quán với thói quen nhập liệu chuyển khoản tại Việt Nam. Một số ít có dấu hoặc chữ nước ngoài (`HSU I AN` — có thể là tên phiên âm Hán/Đài Loan, `YeYe Lau` — tên tiếng Anh/HK). Viết hoa không nhất quán: có `ALL CAPS` (`NGUYEN HOANG NAM`), có `Title Case` (`Nguyen Van Dep`), có `lowercase` (`yeye lau`) — chuẩn hóa so khớp phải dùng case-insensitive + bỏ dấu (đã có sẵn hàm `normalizeStr()` trong `bank-parser.js` dòng 16-22, tái sử dụng được).

**Không hard-code chỉ từ 1 giao dịch** — mọi pattern trong bảng trên đều được xác nhận bằng ≥3 lần lặp lại ở các dòng/file khác nhau (xem §6 để đối chiếu evidence).

---

## 8. Canonical Data Model — đề xuất mở rộng

Canonical transaction hiện tại (`makeTx()` trong `bank-parser.js` dòng 196-220):
```js
{
  transactionId, transactionDate, amount, description, accountNumber,
  counterpartyAccount, counterpartyName, bankName, transactionType, balance, rawSource,
  // back-compat aliases (KHÔNG được xóa — dùng bởi flaRenderPage và các engine khác):
  date, code, content, bank, flag,
}
```

**Field cần bổ sung (mới, không phá vỡ field cũ):**

| Field mới | Ý nghĩa | Bắt buộc cho NAPAS? | Ảnh hưởng ngược (backward compat) |
|---|---|---|---|
| `counterpartyBankName` | Ngân hàng đối ứng (NAPAS luôn có; bank statement thường KHÔNG có → để `null`) | Có | An toàn — field mới, mặc định `null` cho 9 parser cũ |
| `counterpartyNameConfidence` | `'CONFIRMED' \| 'INFERRED' \| 'AMBIGUOUS' \| 'UNKNOWN'` | Có | An toàn — mặc định có thể để `'UNKNOWN'` khi `counterpartyName` null, hoặc bổ sung dần cho parser cũ sau (không bắt buộc trong phase NAPAS) |
| `sourceFormat` | Nguồn dữ liệu, VD `'NAPAS'` vs tên ngân hàng hiện có trong `bankName`/`rawSource` | Khuyến nghị | Giúp UI phân biệt "sao kê NAPAS" khỏi "sao kê ngân hàng trực tiếp" ở cột "Nguồn dữ liệu" (§10) |
| `groupIndex` / `recursionLevel` | Số nhóm (I/II/III…) và giá trị `Cấp đệ quy` gốc | Khuyến nghị, phục vụ audit/traceability | Field nội bộ, không hiển thị bắt buộc |

**Nguyên tắc thiết kế (để đi chung pipeline với bank statement hiện có):**
- `parseNapas(rows)` trả về đúng shape `makeTx()` như mọi parser khác → không cần sửa `buildAccountFlowMatrix`, `_detectFintechType`, `_renderAccountFlowTab`, hay bất kỳ engine downstream nào (fraud-engine, graph-engine, tagging-engine) — tất cả đã hoạt động trên field `accountNumber`/`counterpartyAccount`/`counterpartyName`/`transactionType`/`amount`/`description` có sẵn.
- `direction` (IN/OUT) suy ra ngay trong `parseNapas` (dựa vào file CHUYEN/NHAN + so khớp cột nguồn/đích với account identity của nhóm) rồi map thẳng vào `transactionType`, giữ đúng convention `'IN' | 'OUT'` đã dùng.
- Vì `parseFiles()` (dòng 861-879 trong `bank-parser.js`) merge phẳng transaction từ nhiều file, **file CHUYEN và file NHAN của cùng 1 đối tượng khi upload cùng lúc sẽ tự động gộp đúng vào chung 1 pool giao dịch** — không cần thay đổi cơ chế merge hiện có, chỉ(cần) parser mới xử lý đúng từng file độc lập.

---

## 9. Reconciliation Integration

```
NAPAS files (CHUYEN + NHAN, upload cùng lúc)
        ↓
BankParser.parseFiles()  ← đã có, merge phẳng, không cần sửa
        ↓
detectBank() cần thêm nhánh nhận diện NAPAS (xem §13)
        ↓
parseNapas(rows) — MỚI: quét mọi nhóm, sinh N transaction canonical / nhóm
        ↓
(giống 9 parser hiện có) transactions[] đổ chung vào 1 mảng
        ↓
buildAccountFlowMatrix() ← ĐÃ CÓ, không cần sửa vì đã group theo (accountNumber, counterpartyAccount)
        ↓
_renderAccountFlowTab() ← CẦN THÊM cột mới (xem §10), giữ nguyên cột cũ
```

**Kết luận:** điểm neo (integration point) là hàm `parseNapas()` mới bên trong `bank-parser.js` — mọi thứ pipeline phía sau (`buildAccountFlowMatrix`, fraud/graph/tagging/NLP engine, export XLSX) **tái sử dụng nguyên trạng** vì chúng vận hành trên canonical transaction, không quan tâm nguồn gốc là ngân hàng nào. Việc ghép cặp CHUYEN/NHAN (§3) chỉ cần thiết ở tầng **UI/validation khi upload** (cảnh báo "thiếu 1 nửa cặp", không phải yêu cầu cứng của pipeline phân tích).

---

## 10. Summary / Analysis Table — cột đề xuất bổ sung

Bảng hiện có: **Tab 02 "Đối Ứng TK"** (`_renderAccountFlowTab`, `app.js` dòng 3670+), cột hiện tại: `TK Nguồn | TK Đối Ứng | Tên Đối Ứng | Tổng Số GD | Tiền Vào | Tiền Ra | Net | Ngày đầu | Ngày cuối | Ngân hàng`.

**Cột cần bổ sung (không đổi tên cột cũ, thêm mới ở cuối hoặc dùng làm tooltip/badge):**

| Cột mới | Nguồn field | Ghi chú hiển thị |
|---|---|---|
| Ngân hàng đối ứng | `counterpartyBankName` | Trống/`—` nếu null (giữ tương thích bank statement cũ) |
| Độ tin cậy tên đối ứng | `counterpartyNameConfidence` | Badge màu: xanh=CONFIRMED, vàng=INFERRED, cam=AMBIGUOUS, xám=UNKNOWN |
| Nguồn dữ liệu | `sourceFormat` (hoặc field tương đương) | "NAPAS" vs tên ngân hàng — giúp phân biệt khi trộn nhiều nguồn trong 1 phiên phân tích |
| Trạng thái đối soát (tuỳ chọn, phase sau) | mới, dựa trên §3 (ghép cặp CHUYEN/NHAN) | "Đủ cặp" / "Thiếu file CHUYEN" / "Thiếu file NHAN" — hiển thị cấp FILE, không phải cấp giao dịch |

Cột `Ngày GD`/`Giờ GD`/`Chiều GD`/`Số tiền`/`Số tài khoản đối ứng`/`Nội dung chuyển`/`Mã giao dịch` liệt kê trong brief gốc **đã có sẵn** dưới các tên hiện hành (`firstDate/lastDate`, `transactionType` (ẩn trong sumIN/sumOUT), `counterpartyAccount`, description ở tab giao dịch chi tiết khác, `transactionId`) — không cần đặt tên mới trùng lặp, chỉ cần đảm bảo `parseNapas` điền đúng các field này.

---

## 11. Edge Cases

| # | Trường hợp | Trạng thái trong bộ mẫu | Xử lý đề xuất |
|---|---|---|---|
| 1 | Thiếu file CHUYEN (chỉ có NHAN) | **FACT — đã xảy ra** (`098669_0534`) | Vẫn parse độc lập được (metadata tự đủ) — cảnh báo UI "thiếu nửa cặp", không chặn phân tích |
| 2 | Thiếu file NHAN | Không quan sát được trong mẫu này | Xử lý đối xứng với #1 (`UNKNOWN`, chưa có ví dụ thật nhưng logic phải symmetric) |
| 3 | Nhiều nhóm ngân hàng trong 1 file, cùng account identity | **FACT** (`371010_5678`: 3 nhóm; `882503_1992`, `979494_9999`: 2 nhóm) | Parser lặp qua toàn bộ file, không dừng ở nhóm đầu; gắn `groupIndex` cho từng giao dịch |
| 4 | Số nhóm bất đối xứng giữa CHUYEN/NHAN cùng 1 cặp | **FACT** (`979494_9999`: CHUYEN 2 nhóm, NHAN 1 nhóm) | Hợp lệ, không phải lỗi — không ép buộc số nhóm bằng nhau |
| 5 | Giao dịch trùng lặp (duplicate) giữa 2 file cùng cặp | `UNKNOWN` — chưa kiểm chứng cụ thể dòng nào trùng giữa CHUYEN/NHAN của 2 tài khoản khác nhau trong bộ mẫu (mỗi file chỉ chứa 1 chiều của 1 account, nên trùng lặp — nếu có — sẽ là giữa file NHAN của account A và file CHUYEN của account B, nếu cả 2 đều nằm trong lô 27 file) | Khi implement: match theo `Số Trace`/`Số REF` (không phải STT, STT reset theo nhóm) để phát hiện cùng 1 giao dịch xuất hiện ở 2 phía — nếu match, ưu tiên tên đối ứng từ phía NHAN (xem §6) |
| 6 | Giao dịch đảo/hoàn tiền (reversal) | `UNKNOWN` — không thấy field đánh dấu đảo giao dịch trong 13 cột RAW | Không tự suy luận — nếu cần, phải dựa vào cặp (cùng REF, số tiền bằng nhau, chiều ngược nhau) — để phase sau, không có bằng chứng đủ để thiết kế chắc chắn ở phase này |
| 7 | Giao dịch không có đối ứng xác định | Không xảy ra ở cấp NAPAS (luôn có cả 2 cột TK nguồn/đích) | N/A cho NAPAS — khác với bank statement thường (nơi field này có thể null) |
| 8 | Nội dung không chứa tên | **FACT**, phổ biến (`CK`, `MomoQR`, mã QR opaque) | `UNKNOWN`, không suy luận |
| 9 | Nội dung chứa nhiều tên (cả nguồn lẫn đích) | **FACT** (pattern MBVCB, §6) | Regex tách riêng 2 nhóm tên, gán đúng field nguồn/đích |
| 10 | Tên không chắc chắn (fragment ngắn) | **FACT** (`An`, `Minh`, `Ainh`) | `AMBIGUOUS`, hiển thị nhưng có badge cảnh báo, không dùng để auto-match danh tính |
| 11 | Số tài khoản không xác định | Không quan sát (mọi dòng đều có đủ 2 cột TK) | N/A trong mẫu này |
| 12 | Ngân hàng không xác định | Không quan sát ở cột `Ngân hàng chuyển/nhận` (luôn có giá trị) | Cột `Mã thiết bị` thì THƯỜNG không xác định được ý nghĩa — không dùng cột này (xem §4.B) |
| 13 | Định dạng file thay đổi theo thời gian | `UNKNOWN` — chỉ có 1 "phiên bản" định dạng trong bộ mẫu này (cùng cấu trúc 14 cột, cùng thứ tự) | Parser nên dùng `findRow`/dò header theo từ khóa (như các parser khác đã làm) thay vì offset cột cứng tuyệt đối, để chịu được sai lệch nhỏ |
| 14 | Encoding | Không phát hiện lỗi encoding (UTF-8/Unicode tiếng Việt đọc đúng qua openpyxl) | Không cần xử lý đặc biệt |
| 15 | Định dạng ngày/giờ | **FACT**: `Ngày GD` = text `dd/mm/yyyy`; `Giờ GD` = số nguyên `hhmmss` KHÔNG có dấu `:` (VD `125658` = 12:56:58) — dễ nhầm với Excel time serial nếu không kiểm tra kỹ | Parse riêng: nếu độ dài ≤6 chữ số và toàn số, tách 2-2-2 thành giờ:phút:giây; nếu ít hơn 6 chữ số (VD `94149`), left-pad về 6 số trước khi tách (`094149` → 09:41:49) |
| 16 | Phân cách thập phân/nghìn | Số tiền là số nguyên thuần (kiểu `int`/`float` Python khi đọc qua openpyxl), không có dấu phẩy/chấm phân cách trong RAW cell | Không cần xử lý phân cách — khác với 1 số bank statement dạng text có dấu phẩy |
| 17 | Số tiền âm/dương | Toàn bộ `Số tiền` quan sát được là số dương; chiều (+/-) được thể hiện qua việc file là CHUYEN hay NHAN, không qua dấu số | Không dựa vào dấu số để xác định chiều — dựa vào file gốc + cột nguồn/đích |
| 18 | Giao dịch ngoài kỳ báo cáo | Không có field "kỳ báo cáo" tường minh trong RAW; khoảng thời gian giao dịch trải dài ít nhất từ 01/2025 đến 03/2026 (evidence: dòng đầu file `371010` = `09/01/2025`, dòng cuối nhóm I cùng file = `29/03/2026`... `30/03/2026`) | `UNKNOWN` phạm vi kỳ chính thức — nếu cần validate "trong kỳ yêu cầu", phải lấy từ công văn/metadata bên ngoài file (không có trong Excel) |
| 19 | STT reset theo nhóm, dễ nhầm là ID toàn cục | **FACT** (§4.E) | Không dùng STT làm `transactionId` — dùng tổ hợp `Số REF` (đã gần như duy nhất) hoặc `${filename}_${groupIndex}_${STT}` |
| 20 | Dòng footer/tổng kết lẫn vào giữa dữ liệu | **FACT** (`"Tổng số giao dịch phát sinh theo..."`, §2 và §4.E) | Bắt buộc lọc bỏ bằng kiểm tra cột `Ngày GD` phải khớp regex ngày hợp lệ trước khi coi là dòng giao dịch (kỹ thuật đã dùng trong script khảo sát, tái sử dụng được) |

---

## 12. Backward Compatibility

```
9 bank statement parser hiện có (BIDV, VCB, Techcombank, Vietinbank,
VPBank, Eximbank, Sacombank, MB Bank, Agribank, + Generic fallback)
                        +
        parseNapas() — MỚI, cùng chuẩn makeTx()
                        ↓
        cùng 1 canonical reconciliation pipeline
        (buildAccountFlowMatrix, fraud/graph/NLP/tagging engine,
         export XLSX, UI Tab 02 Đối Ứng TK)
```

**Đảm bảo (dựa trên kiến trúc đã đọc, §8-§9):**
- Field mới (`counterpartyBankName`, `counterpartyNameConfidence`, `sourceFormat`, `groupIndex`) đều **optional/nullable**, mặc định `null`/`'UNKNOWN'` cho transaction từ 9 parser cũ → không phá vỡ dữ liệu hiện có.
- Không đổi tên/xóa bất kỳ field nào trong `makeTx()`, kể cả 5 alias back-compat (`date, code, content, bank, flag`) — đúng theo ràng buộc đã ghi nhận trong bộ nhớ dự án ("Protected surfaces — `_flaState` shape").
- `detectBank()` chỉ **thêm nhánh mới**, không sửa logic phát hiện 9 ngân hàng hiện có — quan trọng vì `detectBank()` dùng thứ tự ưu tiên theo phase (Phase 1→6) để tránh nhầm lẫn; nhánh NAPAS nên đặt ở vị trí có fingerprint đặc trưng nhất, tránh xung đột (xem §13).
- `buildAccountFlowMatrix()` và `_renderAccountFlowTab()` **không cần sửa logic gộp nhóm** — chỉ cần render thêm cột optional nếu field tồn tại.

---

## 13. Proposed Architecture (chưa implement)

```
NAPAS .xlsx file
       ↓
[1] Parser — parseNapas(rows)
    - Quét toàn bộ rows tìm mọi khối "Tên ngân hàng (chuyển|nhận): X" + "Tài khoản (nguồn|đích): Y"
    - Lọc dòng giao dịch hợp lệ bằng regex ngày (loại bỏ dòng footer "Tổng số...")
    - Sinh danh sách segment: [{ groupIndex, ownBank, ownAccount, direction, rowStart, rowEnd }]
       ↓
[2] Normalizer
    - Chuẩn hóa Ngày GD + Giờ GD (hhmmss) → ISO datetime
    - Chuẩn hóa tên ngân hàng qua bảng alias chung (registry mới, dùng lại cho cả cột
      Ngân hàng chuyển/nhận VÀ tên ngân hàng rút gọn xuất hiện trong Nội dung chuyển)
       ↓
[3] Account/Bank Resolver
    - Với mỗi dòng: so khớp Thẻ/TK nguồn hoặc đích với ownAccount của segment hiện tại
      → xác định transactionType (IN/OUT) + gán own vs counterparty cho account/bank
    - Cảnh báo nếu không dòng nào khớp ownAccount (dữ liệu bất thường trong segment)
       ↓
[4] Counterparty Resolver
    - Registry pattern theo ngân hàng nguồn nội dung (§6, §7): thử CONFIRMED trước
      (MBVCB), rồi INFERRED (per-bank template), rồi AMBIGUOUS (heuristic tên ngắn),
      còn lại UNKNOWN
       ↓
[5] Canonical Transaction (makeTx() mở rộng — §8)
       ↓
[6] Reconciliation (buildAccountFlowMatrix — TÁI SỬ DỤNG, không sửa)
       ↓
[7] Analysis / Summary Table (_renderAccountFlowTab — mở rộng cột, §10)
```

Ưu tiên tái sử dụng: bước [6][7] và cấu trúc `makeTx()` giữ nguyên; chỉ [1]-[4] là code mới, và [2] một phần (bảng alias ngân hàng) nên tách thành module dùng chung, có thể cải thiện ngược cho 9 parser cũ trong tương lai (không bắt buộc phase này).

**Vị trí thêm mã nguồn (theo đúng cấu trúc file hiện có, không tạo module song song):**
- `bank-parser.js`: thêm `parseNapas(rows)`, thêm nhánh nhận diện vào `detectBank()` (fingerprint đề xuất: sheet name `KET QUA TIM KIEM` + có dòng chứa `CV-NAPAS.KSTT` trong 10 dòng đầu — rất đặc trưng, không trùng với fingerprint 9 ngân hàng hiện có), thêm case `'NAPAS'` vào switch trong `parseFile()`.
- `app.js`: mở rộng `_renderAccountFlowTab` thêm cột optional (§10); không đổi `buildAccountFlowMatrix`.

---

## 14. Implementation Plan (đề xuất, có thể điều chỉnh khi bắt tay code)

- **Phase 1 — NAPAS parser cơ bản:** nhận diện file NAPAS trong `detectBank()`; parse 1 nhóm/file (giả định đơn giản: chỉ nhóm I) → canonical transaction, transactionType suy từ CHUYEN/NHAN. Test với 2 file đơn giản nhất (`860320_9818`, 29+71 dòng).
- **Phase 2 — Multi-group support:** mở rộng parser lặp qua toàn bộ file, xử lý dòng footer "Tổng số giao dịch...", gắn `groupIndex`. Test với `371010_5678` (3 nhóm), `882503_1992` (2 nhóm), `979494_9999` (2 nhóm, bất đối xứng).
- **Phase 3 — File pairing & validation UI:** ghép CHUYEN/NHAN theo account identity (nội dung, không phải filename), cảnh báo cặp thiếu (test với `098669_0534`).
- **Phase 4 — Bank name alias registry:** bảng chuẩn hóa tên ngân hàng dùng chung, áp dụng cho cột `Ngân hàng chuyển/nhận`.
- **Phase 5 — Counterparty resolver (CONFIRMED tier):** implement regex MBVCB trước (impact cao nhất, ít rủi ro nhất vì cấu trúc rõ ràng).
- **Phase 6 — Counterparty resolver (INFERRED + AMBIGUOUS tier):** registry pattern theo từng ngân hàng nguồn nội dung (§6, §7), threshold rõ ràng để phân AMBIGUOUS/UNKNOWN.
- **Phase 7 — Canonical model + UI:** thêm field mới vào `makeTx()`, mở rộng `_renderAccountFlowTab` (cột mới, badge độ tin cậy).
- **Phase 8 — Validation & regression:** chạy lại toàn bộ 27 file mẫu, đối chiếu số dòng/giao dịch với kết quả khảo sát trong tài liệu này (bảng §2); chạy regression trên ít nhất 1 file mỗi ngân hàng cũ (9 loại) để đảm bảo không phá vỡ.

---

## 15. Validation Strategy

- **Fixture test:** dùng chính 27 file trong `C:\Users\ASUS\Downloads\3261_CSDT.THANHHOA.O_1` làm fixture cố định (copy vào thư mục test riêng của project, không phụ thuộc đường dẫn Downloads của máy dev).
- **Parser test:** so khớp số dòng giao dịch parse được với bảng §2 (VD: `001010_8007_CHUYEN` phải ra đúng 1346 giao dịch, không tính dòng metadata/footer).
- **Pairing test:** `098669_0534` phải được nhận diện là "thiếu file CHUYEN"; 13 cặp còn lại phải ghép đúng theo account identity từ nội dung (không dùng filename).
- **Multi-group test:** `371010_5678` phải tách đúng 3 nhóm (ACB/VCB/TCB) ở cả 2 file CHUYEN và NHAN, với đúng account identity `3710105678` ở mọi nhóm.
- **Account/bank resolution test:** đối chiếu ownBank/ownAccount trích xuất được với bảng §2 cho toàn bộ 14 hồ sơ.
- **Counterparty resolution test:** test riêng cho từng tier — ít nhất 1 assertion CONFIRMED (MBVCB pattern), 1 INFERRED (ACB/MB/Techcombank pattern), 1 AMBIGUOUS (`'Minh'`), 1 UNKNOWN (`'CK'`, `'MomoQR'`).
- **Reconciliation test:** transaction NAPAS đi qua `buildAccountFlowMatrix` phải nhóm đúng theo `(accountNumber, counterpartyAccount)`, cộng dồn `sumIN`/`sumOUT` chính xác so với tổng thủ công trên 1 file nhỏ (VD `860320_9818`, chỉ 29+71 giao dịch — đủ nhỏ để đối chiếu tay).
- **Regression test cho bank statement cũ:** chạy lại `parseFile()` với ít nhất 1 file mẫu mỗi ngân hàng trong 9 ngân hàng cũ (dùng file mẫu đã có tại `C:\Users\ASUS\Downloads\File mau NH\Mau 2` theo ghi chú dự án trước đó — cần xác nhận đường dẫn này còn tồn tại trước khi dùng), đảm bảo `transactions.length` và các field không đổi so với trước khi thêm `parseNapas`.
- **UI test:** mở Tab "Đối Ứng TK" với dữ liệu NAPAS đã parse, xác nhận cột mới hiển thị đúng badge độ tin cậy và không làm vỡ layout khi `counterpartyBankName`/`counterpartyNameConfidence` là `null` (trường hợp trộn lẫn với bank statement cũ trong cùng 1 phiên phân tích).

---

## Phụ lục: Nhật ký khảo sát (traceability)

**Công cụ dùng để khảo sát:** script Python tạm (`openpyxl`, read-only, không ghi/sửa file gốc) chạy trong `scratchpad` của phiên làm việc — không sửa/xóa/upload bất kỳ file nào trong `C:\Users\ASUS\Downloads\3261_CSDT.THANHHOA.O_1`.

**File project đã đọc (ngoài danh sách được giao sẵn):**
1. `docs/PROJECT_CHECKPOINT.md` — điểm khởi động bắt buộc theo quy ước dự án đã thiết lập trước đó; cho biết FLA (module đối soát) hiện chỉ tồn tại ở legacy JS, Python backend 0%.
2. `bank-parser.js` (toàn bộ, 884 dòng) — kiến trúc parser/canonical model hiện tại, lý do đọc: đây chính là module cần mở rộng cho NAPAS theo yêu cầu "tái sử dụng kiến trúc hiện có".
3. `app.js`, đoạn dòng 1418-1438 (luồng upload/gọi `BankParser.parseFiles`), dòng 2443-2449 (export XLSX cột đối ứng), dòng 3560-3700 (toàn bộ khối FLA: `buildAccountFlowMatrix`, `_FINTECH_REGISTRY`, `_detectFintechType`, `_renderAccountFlowTab`) — lý do đọc: xác định chính xác bảng phân tích/tổng hợp hiện có mà NAPAS cần đổ dữ liệu vào, tránh tạo bảng song song.
4. `index-Son0Cao0PC.html`, dòng 1028 — xác nhận `app.js` (không phải `app-Son0Cao0PC.js`) là file đang được load thật, để không trích dẫn nhầm file backup.

**Không đọc:** toàn bộ `modules/telecom_analysis` (CDR, không liên quan đối soát ngân hàng), toàn bộ `backend/` FastAPI (đã xác nhận qua checkpoint là 0% cho FLA), `Mau/script.js` / `reference/script.js` (monolith legacy gốc, đã được port sang các file hiện tại theo checkpoint), các engine không liên quan trực tiếp bảng tổng hợp (`graph-engine.js`, `nlp-engine.js`, `fraud-engine.js`, `risk-calibration-engine.js`, v.v. — chỉ cần biết chúng tồn tại và tiêu thụ cùng canonical transaction, không cần đọc chi tiết cho phase đặc tả này).

---

## Phase 16 Implementation Status (2026-09-14)

**Mục tiêu:** Thiết kế cách hiển thị kết quả đối soát (reconciliation engine, Phase 8-15) trong UI FLA hiện có, không tái kiến trúc.

**Quyết định UX (FACT, đã khảo sát trước khi code):** Không tạo tab mới, không dùng modal. Đã tìm pattern `logger-modal-backdrop`/`logger-modal-box` được tham chiếu trong `Khoi_chay_du_an.html` nhưng không tìm thấy định nghĩa CSS tương ứng trong `styles.css` — pattern rủi ro, không phụ thuộc vào. Thay vào đó: một panel gấp/mở (collapsible) chèn ngay trong tab "ĐỐI ỨNG TK" (tab 02) đã có sẵn, tái sử dụng class `.tactical-table` và quy ước inline-style của file — không thêm CSS/framework mới.

**Nguyên tắc trung thực bắt buộc:** khi `matched.length === 0`, panel hiển thị "Đã phân tích X giao dịch CHUYỂN và Y giao dịch NHẬN. Không tìm thấy giao dịch đối ứng xác định trong dữ liệu hiện tại." — không dùng chữ "thất bại"/"lỗi" trừ khi có lỗi thực thi thật.

**Vấn đề data-flow đã giải quyết:** `_flaState.data` (mảng phẳng) không giữ cấu trúc theo file cần cho `pairNapasGroups`/`reconcileAllPairs`. Giải pháp: thêm global mới `_flaNapasFileResults` (theo đúng quy ước global hiện có của file, ví dụ `_flaUploadedFiles`), gán trong `flaProcessFiles()`, đọc trực tiếp trong hàm render mới — tránh phải luồn thêm tham số xuyên suốt `flaRunPipeline`.

## Phase 17 Implementation Status (2026-09-14)

**Đã implement (`app.js`):** `_FLA_RECON_STATUS_CFG`, `_flaReconStatusBadgeHtml(status)`, `_flaReconEvidenceText(evidence)`, `_flaBuildReconRows(reconciliation)`, `_FLA_RECON_ROW_CAP = 300`, `_flaReconDetailTableHtml(reconciliation, domId)`, `_flaToggleNapasDetail(domId)`, `_flaNapasPairCardHtml(pair, reconciliation, idx)`, `_flaNapasOrphanCardHtml(orphan, direction)`, `_renderNapasReconciliationPanel()`. Container `<div id="fla-napas-recon-panel">` thêm vào `Khoi_chay_du_an.html` (ẩn mặc định, chỉ hiện khi có ≥1 file NAPAS).

**Tách biệt 2 khái niệm độc lập (yêu cầu bắt buộc):** trạng thái đối soát (`_flaReconStatusBadgeHtml` — MATCHED/UNMATCHED/AMBIGUOUS) và độ tin cậy tên đối ứng (`_flaConfidenceBadgeHtml`, có từ Phase 5-7 — CONFIRMED/INFERRED/AMBIGUOUS/UNKNOWN) là hai badge riêng biệt, không gộp, không suy ra cái này từ cái kia.

**Bằng chứng khớp lấy trực tiếp từ engine:** mọi giá trị hiển thị trong cột "Giao dịch khớp" (mã GD đối ứng, phương pháp khớp, bằng chứng) đọc thẳng từ `reconciliation.matched[].evidence`/`.matchMethod` do `bank-parser.js` trả về — UI không tính toán lại.

**Hiệu năng:** nhóm thật có thể >1000 giao dịch (VD: Techcombank trong 371010_5678: 1104 CHUYỂN + 428 NHẬN). Giới hạn hiển thị `_FLA_RECON_ROW_CAP = 300` dòng/nhóm kèm ghi chú rõ ràng số lượng bị ẩn — không âm thầm cắt bớt.

**Bảo mật:** mọi trường dữ liệu người dùng (transactionId, bankName, counterpartyAccount, counterpartyName, counterpartyBankName...) đều qua `_escHtml()` (helper duy nhất, có từ Phase 5-7) — không tạo helper escape thứ hai.

## Phase 18 Implementation Status (2026-09-14)

**Sheet 1 "1. Doi Ung TK" mở rộng thêm 4 cột NAPAS:** Do Tin Cay Ten Doi Ung, Ma Dinh Danh NH, NH Doi Ung, Nguon Du Lieu — hành vi export cũ (dữ liệu non-NAPAS) giữ nguyên vì các cột mới đọc field có thể `undefined`/rỗng.

**Sheet 4 "4. Doi Soat NAPAS" — hoàn toàn mới**, thêm vào cuối workbook (không đánh số lại các sheet cũ, tránh rủi ro cho công cụ downstream có thể phụ thuộc tên/thứ tự sheet hiện có). Nguồn dữ liệu: `_flaBuildReconRows()` lọc theo tài khoản đang export. Khi tài khoản không có dữ liệu NAPAS để đối soát: 1 dòng placeholder "Tai khoan nay khong co du lieu NAPAS de doi soat." (theo đúng quy ước empty-state đã có ở Sheet 2).

**Chống mất số 0 đầu (yêu cầu bắt buộc):** hàm mới `_flaForceTextColumns(ws, headerNames)` ép `cell.t = 's'` + `cell.z = '@'` (định dạng Text) cho các cột dạng số tài khoản/mã giao dịch (`TK Nguon`, `TK Doi Ung`, `So Tai Khoan`, `Ma Giao Dich`, `GD Doi Ung Khop`) sau khi `json_to_sheet` — đã xác minh bằng round-trip write→`sheet_to_json` trên dữ liệu thật (`"0853160555"` giữ nguyên số 0 đầu, không bị Excel tự suy luận thành số).

**Ghi chú lệch pha có sẵn (ngoài phạm vi sửa):** một thông báo toast ở nơi khác trong code claim "(9 sheet)" trong khi `_buildAccountWorkbook` thực tế tạo 3 sheet cũ + 1 sheet mới = 4 — lệch pha tài liệu/code có từ trước, không phải do phase này gây ra, không sửa vì ngoài phạm vi yêu cầu.

## Phase 19 Implementation Status (2026-09-14)

**Phạm vi kiểm thử:** toàn bộ pipeline (parse → group → pair → normalize → resolve → reconcile → UI panel render → export XLSX) chạy end-to-end thật (không mock `bank-parser.js`) trên cả 5 fixture bắt buộc, cộng bộ regression toàn phần Phase 1-15. Harness: Node `vm`, trích xuất nguyên văn theo dòng từ `app.js`/`bank-parser.js` (không gõ lại), DOM stub tối thiểu.

**Kết quả: 33/33 assertion PASS**, bao gồm:
- 860320_9818 (đơn nhóm): parse 29+71=100 đúng; panel UI render không lỗi; matrix tổng hợp + Sheet 4 export nhất quán với 0 matched thật.
- 371010_5678 (đa ngân hàng cùng số TK, thứ tự nhóm đảo ngược): 3 thẻ ngân hàng riêng biệt trong UI (không gộp nhầm); baseline va chạm 255 cặp (accountNumber, counterpartyAccount) qua ≥2 ngân hàng khác nhau **vẫn giữ nguyên 255** và không gây khớp chéo ngân hàng nào trong UI/export; export Sheet 4 đủ 3155 giao dịch của cả 3 ngân hàng.
- 882503_1992 (2 ngân hàng): toàn bộ pipeline UI+export chạy không lỗi.
- 979494_9999 (bất đối xứng — 1 cặp khớp + 1 nhóm mồ côi Vietcombank): UI hiển thị đúng "1 nhóm thiếu cặp", không tạo khớp giả; export Sheet 4 chỉ chứa 1762 giao dịch của cặp Techcombank đã ghép, **không** bao gồm giao dịch của nhóm mồ côi.
- 098669_0534 (file mồ côi thuần, không có file CHUYEN tương ứng tồn tại): UI không crash; export hiển thị placeholder "không có dữ liệu NAPAS để đối soát" — không ghép cặp giả.
- Edge case ngân hàng chưa đăng ký alias: `buildAccountFlowMatrix` fallback về tên gốc làm `bankId` (không null, không crash, không gộp nhầm với ngân hàng khác); `normalizeBankName` trả `null` đúng như thiết kế cho input không khớp registry.
- Regression toàn phần: detectBank 11/11; Phase 1 (29/71); Phase 2 (3 fixture: 2129/1026, 150/145, 1377/386); Phase 3 (pairing 860320_9818=1, 371010_5678=3, 882503_1992=2, 979494_9999 matched=1+orphanChuyen=1, 098669_0534 orphanNhan=1); Phase 4 (VPBank alias merge, SCB/Sacombank phân biệt, OUT-side UNKNOWN); Phase 8-15 (engine vẫn khớp đúng case exact sạch).

**Kết luận:** không có regression nào từ Phase 16-18 trên bất kỳ baseline nào của Phase 1-15; hành vi trung thực (0 matched thật) được bảo toàn xuyên suốt UI và export.

## Phase 20 Implementation Status (2026-09-14)

**Phạm vi:** audit chất lượng/diff cuối kỳ, không thêm tính năng mới. Kiểm tra trên toàn bộ vùng code mới của `app.js` (dòng ~1300-4180) và `Khoi_chay_du_an.html`.

**Kết quả audit — không phát hiện vi phạm nào:**
- Không có dữ liệu mẫu hardcode (grep số tài khoản của cả 5 fixture bắt buộc trong `app.js`: 0 kết quả).
- Không có ghép cặp theo tên file hay theo `groupIndex` xuyên file — 2 lần dùng `filename`/`groupIndex` còn lại trong `app.js` chỉ là nhãn hiển thị trong toast cảnh báo (có từ Phase 8-11, không phải logic mới), không dùng để khớp giao dịch.
- Không có từ khóa `fuzzy`/`nearest`/`tolerance`/`first candidate` trong toàn bộ `app.js`.
- Không có logic `resolveCounterparty`/`normalizeBankName` bị nhân bản trong `app.js` — chỉ gọi qua `BankParser.*`.
- Không có HTML không escape: mọi trường dữ liệu động trong các hàm UI mới đều qua `_escHtml()`; giá trị nội suy không escape (VD: `ambigTotal`) đều là số tính toán, không phải dữ liệu người dùng.
- Không có `console.log`/`console.debug` trong vùng code mới.
- Không có TODO/FIXME/XXX/temp/hack marker trong vùng code mới.
- Không có file test tạm còn sót lại (đã xóa `napas_phase17_panel_validate.js`, `napas_phase18_export_validate.js`, `napas_phase19_e2e.js` sau khi dùng xong).
- Không có sửa đổi ngoài ý muốn lên file mẫu: mtime của cả 27 file trong `C:\Users\ASUS\Downloads\3261_CSDT.THANHHOA.O_1` vẫn là 2026-09-13 (trước khi phiên làm việc Phase 16-20 bắt đầu).
- `bank-parser.js` không bị chạm tới trong Phase 16-20 (vẫn 1696 dòng, đúng như cuối Phase 12-15) — toàn bộ thay đổi là UI/export layer, đúng phạm vi được giao.

**Kết luận Phase 16-20:** HOÀN THÀNH. UI đối soát chi tiết + export XLSX mở rộng đã implement, kiểm thử thật (không mock engine), không có manufactured match, không regression, không lộ HTML injection, không sót code tạm.

---

## Phase 21 Implementation Status (2026-09-14)

**Mục tiêu:** xử lý technical debt "9 sheet" — toast/preview text ở 3 nơi trong `app.js` (dòng export single-account, export ZIP, export preview panel) tuyên bố workbook có 9 sheet trong khi `_buildAccountWorkbook` thực tế chỉ tạo 4 sheet. Xác nhận: đây là lệch pha có từ TRƯỚC cả NAPAS work (workbook luôn chỉ có 3 sheet, Phase 18 thêm sheet 4), không phải do Phase 16-20 gây ra.

**Fix:** thêm hằng số nguồn sự thật duy nhất `_FLA_ACCOUNT_WORKBOOK_SHEET_NAMES = ['1. Doi Ung TK', '2. Nap Tien DT', '3. Vi Dien Tu', '4. Doi Soat NAPAS']` ngay trước `_buildAccountWorkbook`. Cả 4 lệnh `book_append_sheet` bên trong hàm này giờ đọc tên sheet từ mảng đó (không hardcode chuỗi trực tiếp nữa), và cả 3 vị trí hiển thị "9 sheet" (2 toast + 1 dòng preview panel) đổi sang `${_FLA_ACCOUNT_WORKBOOK_SHEET_NAMES.length} sheet` — số lượng và mô tả sheet giờ luôn khớp thực tế vì lấy trực tiếp từ cùng một nguồn dùng để build workbook, không hardcode số mới. Không đổi thứ tự/tên các sheet cũ, không đánh số lại.

**Kiểm thử:** workbook thật (fixture 860320_9818) xác nhận `wb.SheetNames` khớp chính xác hằng số; tài khoản legacy (non-NAPAS) vẫn tạo đúng 4 sheet với Sheet 4 là placeholder trung thực "không có dữ liệu NAPAS". 6/6 assertion PASS.

## Phase 22 Implementation Status (2026-09-14)

**Mục tiêu:** browser E2E thật trên shell thực tế (`Khoi_chay_du_an.html`) — các phase trước chỉ có Node `vm` harness, chưa xác nhận trong trình duyệt thật.

**Công cụ:** không có Playwright/Puppeteer cài sẵn trong môi trường — viết driver CDP (Chrome DevTools Protocol) thuần bằng Node's built-in `fetch`/`WebSocket` (Node 24), điều khiển Chrome hệ thống đã cài sẵn, không thêm dependency mới vào dự án.

**Sự cố phát hiện và xử lý:** lần chạy đầu tiên bị treo (hang) vô thời hạn ở Fixture C. Điều tra xác nhận root cause: `DOM.getDocument({depth:-1})` — gọi TRƯỚC mỗi lần upload fixture, yêu cầu serialize toàn bộ cây DOM không giới hạn độ sâu; sau khi Fixture B render xong (bảng 3155 dòng), lệnh này với DOM lớn bị treo, và `cdp.send()` không có timeout nên Promise không bao giờ resolve. Đã terminate tiến trình treo an toàn (xác nhận qua `Get-CimInstance`/`taskkill`, port giải phóng), sau đó hardening harness: sửa `depth:-1` → `depth:0` (không cần thiết, `DOM.querySelector` tự resolve phía server), thêm timeout hữu hạn cho MỌI CDP request (20s), timeout tổng cho mỗi fixture (60s outer guard), timeout cho export/download (15s, kèm sửa lỗi phát hiện file mới dựa vào mtime thay vì chỉ tên file), logging từng bước `[PHASE22] <fixture> <step>`, và cleanup `finally` dùng `taskkill /T /F` (Node's `.kill()` không cascade xuống tiến trình con Chrome trên Windows — xác nhận qua thực tế tiến trình treo để lại các con orphan).

**Kết quả sau hardening:** Fixture C/D/E chạy riêng lẻ đều PASS (không treo), sau đó full suite A→E chạy lại từ Chrome sạch: **33/33 assertion PASS** — 0 console error, 0 uncaught exception, 0 timeout. Bao gồm real round-trip: export thật trong trình duyệt → file .xlsx tải về đĩa → đọc lại bằng Node xlsx → xác nhận đúng 4 sheet, đúng nội dung (860320_9818: 100 giao dịch; 371010_5678: 3155 giao dịch, 3 thẻ ngân hàng riêng biệt, disclosure cap 300 dòng trên UI nhưng export đầy đủ 3155 dòng không bị cắt).

## Phase 23 Implementation Status (2026-09-15)

**Phạm vi:** audit robustness/UX release-hardening trên toàn bộ chức năng NAPAS (Phase 1-22) — không sửa reconciliation logic (Tier A/B, bank normalization, pairing, counterparty resolution đều giữ nguyên).

**23.1 (sheet count):** xác nhận lại fix Phase 21 vẫn nguyên vẹn, không bị revert.

**23.2-23.7:** harness Node `vm` mới (không cần browser vì không có thay đổi hành vi browser-facing) kiểm tra: empty/edge data (không có file NAPAS, kết quả rỗng, transaction thiếu field/null/undefined, confidence/status không rõ giá trị — tất cả không crash, không lộ "[object Object]"/"undefined"); chuỗi dài/bẩn + injection payload (`<script>`, `<img onerror>`, `<svg onload>`, dấu ngoặc kép, tiếng Việt có dấu, HTML-looking string) trên MỌI field động (transactionId, accountNumber, counterpartyAccount, counterpartyName, counterpartyBankName, bankName, evidence) — tất cả qua `_escHtml()` an toàn, không tạo helper escape thứ hai; độc lập confidence-vs-status (15 tổ hợp confidence × status render độc lập, xác nhận 2 hàm khác nhau); 300-row UI cap (disclosure đúng, export KHÔNG bị cắt — 3155/3155 dòng thật); orphan/asymmetric (979494_9999, 098669_0534 — không fabricate cặp); leading zero (round-trip write→read giữ nguyên số 0 đầu ở cả Sheet 1 và Sheet 4, xác nhận trên một cặp matched thật do test tự dựng).

**Kết quả:** 64/64 assertion PASS. Duy nhất 1 FAIL ban đầu (transactionId không tìm thấy ở Sheet 4) hóa ra là lỗi thiết lập test (chỉ đưa 1 file CHUYEN mồ côi, không có file NHAN ghép cặp — đúng theo thiết kế, Sheet 4 chỉ chứa giao dịch thuộc cặp đã ghép, không fabricate orphan vào báo cáo) — sửa test để dựng đúng 1 cặp matched thật, PASS sau đó. Không sửa code sản phẩm nào trong Phase 23.

**23.8 Legacy regression:** detectBank 11/11, Phase 1 (29/71), Phase 2 (3 fixture), Phase 3 (pairing baseline), Phase 4 (normalization), Phase 8-15 (reconciliation sanity), Phase 16-20 (cấu trúc sheet không đổi), 255-collision (255/255, 0 cross-bank) — tất cả PASS. Vì Phase 23 không đổi hành vi browser-facing, baseline Phase 22 (33/33) vẫn hợp lệ, không cần chạy lại.

## Phase 24 Implementation Status (2026-09-15)

**Phạm vi:** audit forensic cuối kỳ trên TOÀN BỘ 27 file mẫu thật (không chỉ 5 fixture bắt buộc).

**24.1 Data integrity — phát hiện quan trọng:** tổng số giao dịch thật đo được trên cả 27 file là **CHUYEN=16.396, NHAN=4.948, TỔNG=21.344** — con số này được xác nhận từng-file-một khớp chính xác 100% với mọi baseline đã validate trước đó trong các phase 1-20 (860320_9818: 29/71; 371010_5678: 2129/1026, 3 nhóm; 882503_1992: 150/145, 2 nhóm; 979494_9999: 1377/386, 2 nhóm CHUYEN; 098669_0534: orphan NHAN). Con số "CHUYEN=3.684/NHAN=1.628/TỔNG=5.312" xuất hiện trong đặc tả nhiệm vụ Phase 21-24 **không khớp với dữ liệu thật đầy đủ 27 file** — đây là sai lệch trong tài liệu nhiệm vụ (có khả năng là tổng từ một tập con file trước đó), không phải lỗi code hay mất dữ liệu. Kiểm tra bảo toàn dữ liệu đầy đủ (`accounted for = reconciled-scope + orphan = 21.344/21.344`) xác nhận: 0 dropped, 0 fabricated, 0 reused, 0 duplicate assignment, 0 ambiguous — trên toàn bộ 21.344 giao dịch thật, MATCHED vẫn = 0 (đúng baseline trung thực đã biết).

**24.2 255-collision:** 255/255 xác nhận lại, 0 cross-bank merge trong reconciliation layer.

**24.3 Matching safety:** audit source-level `bank-parser.js` — Tier A/Tier B label không đổi, `_reconSameOwnIdentity` vẫn còn, không có Tier C, không có tolerance logic thật. Một false-positive ban đầu (grep "fuzzy" khớp 4 dòng) điều tra kỹ xác nhận cả 4 đều VÔ HẠI: 2 dòng là code column-header-mapping cho 9 ngân hàng legacy (tính năng có từ trước NAPAS, không liên quan reconciliation), 2 dòng là comment PHỦ ĐỊNH fuzzy matching ("never guessed/fuzzy-matched", "not a fuzzy search... deterministic"). `bank-parser.js` mtime xác nhận không bị chạm trong suốt Phase 21-24.

**24.7 Performance (27 file thật):** parse 1353ms (21.344 giao dịch), pairing 1ms, reconcile 9ms toàn bộ corpus; nhóm lớn nhất (Techcombank, 1532 giao dịch) reconcile <1ms — không có regression O(n²), nhất quán với baseline Phase 12-15 (0.9-1.3ms).

**Kết luận Phase 21-24:** HOÀN THÀNH. Không có STOP condition nào bị kích hoạt. Không sửa reconciliation/matching logic. Duy nhất phát hiện đáng chú ý là sai lệch số liệu baseline trong tài liệu nhiệm vụ (§24.1) — đã ghi nhận trung thực, không "sửa" dữ liệu thật để khớp số sai.

---

## Phase 24 Addendum — Scope Reconciliation (2026-09-15)

**Bối cảnh:** §24.1 ở trên (viết lúc kết thúc Phase 24) kết luận tạm thời rằng con số "CHUYEN=3.684/NHAN=1.628/TỔNG=5.312" trong tài liệu nhiệm vụ **không khớp** dữ liệu thật và gọi đó là "sai lệch". Kết luận đó là trung thực với bằng chứng có tại thời điểm đó (chưa điều tra sâu scope), nhưng **chưa đầy đủ**. Một phiên điều tra forensic riêng, sau đó, đã xác định chính xác scope của con số 5.312 — giữ nguyên nội dung §24.1 ở trên (không xoá/viết lại lịch sử), bổ sung kết luận chính xác hơn tại đây.

**Bằng chứng forensic (tính toán lại từ dữ liệu thật, không suy đoán):**

Con số 5.312 khớp **CHÍNH XÁC TUYỆT ĐỐI** (không sai một đơn vị nào) với: **tổng số giao dịch thuộc các CẶP NHÓM ĐÃ GHÉP (matched pairs) trong đúng 4 file cặp CHUYEN/NHAN đã được chỉ định làm fixture bắt buộc từ Phase 1** (`860320_9818`, `371010_5678`, `882503_1992`, `979494_9999`) — đây chính xác là phạm vi "7 cặp nhóm thật" mà audit forensic sâu Phase 12-15 đã kiểm tra (xem "Phase 12–15 Implementation Status" §12: "extended... to all 7 real matched group pairs across the 4 multi/single-bank fixtures").

Chi tiết từng fixture (matched-pair-scope, KHÔNG tính giao dịch thuộc nhóm orphan):

| Fixture | CHUYEN (matched-scope) | NHAN (matched-scope) | Số cặp đã ghép |
|---|---|---|---|
| 860320_9818 | 29 | 71 | 1 |
| 371010_5678 | 2.129 | 1.026 | 3 |
| 882503_1992 | 150 | 145 | 2 |
| 979494_9999 | 1.376 *(loại trừ 1 giao dịch thuộc nhóm CHUYEN mồ côi Vietcombank)* | 386 | 1 |
| **Tổng** | **3.684** | **1.628** | **7** |

3.684 + 1.628 = **5.312** — khớp tuyệt đối, kể cả từng con số CHUYEN/NHAN riêng lẻ.

**Con số 21.344 là gì:** tổng toàn bộ 27 file mẫu (CHUYEN=16.396, NHAN=4.948) — bao gồm: (a) 4 fixture bắt buộc ở trên tính ĐẦY ĐỦ kể cả nhóm mồ côi (5.313, tức 5.312 + 1 giao dịch mồ côi Vietcombank vừa loại trừ ở trên), CỘNG (b) 9 cặp file CHUYEN/NHAN khác trong thư mục mẫu (`001010_8007`, `011001_3233`, `050121_6439`, `050160_2543`, `070136_7131`, `190356_2013`, `190752_8012`, `240992_4567`, `931010_7567`) và file mồ côi `098669_0534` — tổng cộng 19 file, 16.031 giao dịch — **chưa từng được đưa vào audit forensic sâu ở Phase 12-15** (chỉ dùng cho các mục đích khác: đếm tổng dataset ở Phase 1 discovery, danh sách file mẫu). Kiểm tra cộng dồn: 5.313 + 16.031 = 21.344 — khớp tuyệt đối.

**KẾT LUẬN CHÍNH XÁC (thay thế kết luận tạm thời ở §24.1 phía trên, không phải vì §24.1 sai hoàn toàn mà vì nó thiếu bối cảnh scope):**

> **Cả hai con số đều ĐÚNG, cho hai phạm vi dữ liệu khác nhau — không có lỗi đếm dữ liệu nào cả.**
> - **"5.312" = Phase 12–15 deep-forensic-audit baseline** — chỉ phạm vi 7 cặp nhóm đã ghép, trong đúng 4 fixture bắt buộc, KHÔNG bao gồm nhóm mồ côi hay 9 cặp file khác.
> - **"21.344" = Full 27-file corpus baseline** — toàn bộ giao dịch thật trong tất cả 27 file mẫu, không giới hạn phạm vi.
>
> Không có bản ghi nào bị đếm sai, đếm thiếu, đếm trùng. Đây thuần tuý là hai định nghĩa phạm vi (scope) khác nhau được dùng ở hai giai đoạn khác nhau của dự án — Phase 12-15 cố ý thu hẹp phạm vi vào các cặp đã ghép để audit forensic sâu (feasible để kiểm tra thủ công từng giao dịch), còn Phase 24 mở rộng ra toàn bộ corpus để xác nhận tính toàn vẹn dữ liệu ở quy mô đầy đủ.

**Không có thay đổi nào đối với `bank-parser.js`, `app.js`, `Khoi_chay_du_an.html`, hay bất kỳ logic parsing/pairing/reconciliation nào trong phiên điều tra này — đây thuần túy là công việc đối chiếu/làm rõ tài liệu.**

---

## Current Status Summary (2026-09-15) — Technical Readiness & Business Acceptance

*(Mục này tổng hợp một chỗ duy nhất trạng thái hiện tại; không thay thế các log Phase 1-24 phía trên — xem các mục Phase riêng lẻ để biết chi tiết/bằng chứng từng phase.)*

**Phạm vi đã hoàn thành (Phase 1 → 24):** NAPAS detection → parsing (single + multi-group) → bank identity normalization → group pairing → counterparty resolution → transaction-level reconciliation → UI (bảng tổng hợp + panel đối soát chi tiết) → XLSX export (Sheet 4 "Doi Soat NAPAS") → browser E2E thật (CDP) → robustness/UX hardening → final forensic audit toàn corpus → scope reconciliation tài liệu.

**Current technical status: TECHNICALLY READY**
**Current production status: CONDITIONALLY PRODUCTION READY — PENDING BUSINESS ACCEPTANCE**

### Kiểm chứng kỹ thuật (technical readiness — đã PASS)
- Phase 1-20: parsing/pairing/normalization/reconciliation/UI/export — COMPLETE.
- Phase 21: "9 sheet" UI-text inconsistency (pre-existing, pre-NAPAS) — FIXED, số sheet nay lấy động từ `_FLA_ACCOUNT_WORKBOOK_SHEET_NAMES`, không hardcode.
- Phase 22: browser E2E thật qua CDP trên shell thật `Khoi_chay_du_an.html` — **33/33 PASS**, 0 console error, 0 uncaught exception.
- Phase 23: robustness/UX hardening (empty/dirty/injection data, 300-row cap vs export uncapped, leading-zero round-trip, confidence-vs-status độc lập) — **64/64 PASS**.
- Phase 24: forensic audit toàn bộ 27 file mẫu thật (21.344 giao dịch) — 0 dropped/fabricated/reused/duplicate/cross-bank/silent-ambiguity; 255/255 collision invariant giữ nguyên; Tier A/Tier B không đổi, không có Tier C, không fuzzy/tolerance logic thật.

### Bất biến đã xác nhận giữ nguyên xuyên suốt Phase 1-24
- **255/255 collision protection** (371010_5678): mọi cặp (accountNumber, counterpartyAccount) va chạm across ≥2 ngân hàng vẫn tách biệt an toàn.
- **0 cross-bank collision merge** ở mọi layer (matrix tổng hợp, reconciliation, export).
- **Không ghép cặp theo tên file** — pairing key = accountNumber + normalized bank identity (metadata trong nội dung file, không phải filename hay "Mã thiết bị"/device code trong tên file).
- **Own bank/account metadata là nguồn sự thật duy nhất** cho identity — không suy đoán từ filename.
- **Độ tin cậy tên đối ứng (confidence) và trạng thái đối soát (reconciliation status) là 2 khái niệm độc lập**, không bao giờ gộp — 2 badge riêng biệt trong UI (`_flaConfidenceBadgeHtml` vs `_flaReconStatusBadgeHtml`).
- **UI cap:** 300 dòng/nhóm hiển thị, có ghi chú rõ ràng khi bị cắt.
- **Export:** không giới hạn — luôn đầy đủ 100% dữ liệu thật, không phụ thuộc UI cap.
- **Leading-zero identifiers:** giữ nguyên dạng text qua write→read round-trip (đã xác minh Sheet 1 và Sheet 4).
- **Dynamic HTML:** luôn qua `_escHtml()` — không có helper escape thứ hai.

### Reconciliation governance (giữ nguyên, không đổi)
- **Tier A** — `TRANSACTION_ID`: unique transactionId trùng khớp cả 2 chiều + amount sanity check + cùng accountNumber + cùng normalized bank identity (`_reconSameOwnIdentity`).
- **Tier B** — `SELF_TRANSFER_AMOUNT_DATETIME`: self-transfer marker (`counterpartyAccount === accountNumber`) + unique amount + exact datetime trùng khớp + cùng identity constraint.
- **Không có Tier C.** Không fuzzy matching, không amount-only, không date-only, không arbitrary tolerance, không counterparty-only, không settlement/reversal matching.
- **Tier B hiện CHƯA được validate trên một match thật** — vì corpus thật hiện tại (21.344 giao dịch) không có match thật nào (0 MATCHED xuyên suốt). Đây là **giới hạn (limitation)**, không phải lỗi (failure) — engine đã sẵn sàng, chỉ chưa có dữ liệu thật để chứng minh Tier B hoạt động đúng trên một positive case thật.

### Known Limitations (hiện tại, đã xác minh — chỉ 3 mục)
1. **Tier B chưa có validation trên match thật** (xem trên).
2. **Settlement/reversal matching chưa implement** — ranh giới cứng chưa có phase nào chạm tới, chưa có yêu cầu nghiệp vụ cụ thể.
3. **Business acceptance đối với quy trình nghiệp vụ NAPAS vận hành thật chưa diễn ra** (xem mục Business Acceptance bên dưới).

*(Lưu ý: sai lệch số liệu 5.312 vs 21.344 đã được giải quyết hoàn toàn ở "Phase 24 Addendum — Scope Reconciliation" phía trên — đây KHÔNG còn là limitation, chỉ là làm rõ phạm vi tài liệu.)*

### Business Acceptance
- **Technical readiness:** READY.
- **Operational/business acceptance:** **PENDING.**
- 27 file mẫu NAPAS là dữ liệu thật, dùng để validate kỹ thuật (parsing/pairing/reconciliation/UI/export/browser E2E) — nhưng **chưa được xác nhận là đại diện chính xác cho quy trình nghiệp vụ NAPAS đang vận hành thật**, và **chưa có xác nhận (sign-off) từ chủ sở hữu nghiệp vụ**.
- Trước khi Go-Live chính thức, chủ sở hữu nghiệp vụ cần xác nhận:
  - định danh tài khoản (account identity) đúng theo quy trình thật;
  - định danh ngân hàng (bank identity) đúng theo quy trình thật;
  - ngữ nghĩa CHUYỂN/NHẬN (CHUYEN/NHAN semantics) đúng như kỳ vọng nghiệp vụ;
  - cấu trúc nhóm (group structure) đúng như dữ liệu NAPAS thật sẽ có;
  - ngữ nghĩa ghép cặp (pairing semantics) phù hợp quy trình thật;
  - cách diễn giải đối ứng (counterparty interpretation) đúng nghiệp vụ;
  - báo cáo export (exported report) đáp ứng yêu cầu sử dụng thật;
  - hành vi 0-match (expected 0-match behavior) được chấp nhận là kết quả đúng, không phải lỗi hệ thống, đối với quy trình nghiệp vụ thật.

> **KẾT LUẬN:** Hệ thống NAPAS **TECHNICALLY READY / PENDING BUSINESS ACCEPTANCE**. Chưa có xác nhận Go-Live chính thức.

---

## Phase 25 — Excel Export UX & Account Investigation (2026-09-16)

**Phạm vi:** nâng cấp UX export Excel (`_buildAccountWorkbook` trong `app.js`) — 3 yêu cầu nghiệp vụ, KHÔNG chạm vào `bank-parser.js`/parsing/pairing/normalization/reconciliation/Tier A/Tier B.

### 1. Việt hóa "Độ tin cậy tên đối ứng"
Header giữ nguyên (đã là tiếng Việt không dấu, đúng convention toàn dự án). Giá trị ô đổi từ mã kỹ thuật sang nhãn tiếng Việt qua hàm mới `_flaConfidenceVnLabel()`:
`CONFIRMED → "Xác nhận"`, `INFERRED → "Suy luận"`, `AMBIGUOUS → "Chưa rõ"`, `UNKNOWN → "Không xác định"`; giá trị null/rỗng/không nhận diện được → chuỗi rỗng (không tự động biến thành "Xác nhận"). Mapping trùng khớp 1:1 về ý nghĩa với nhãn UI hiện có (`_flaConfidenceBadgeHtml`: XÁC NHẬN/SUY LUẬN/CHƯA RÕ/KHÔNG XÁC ĐỊNH) — chỉ khác case chữ cho phù hợp ngữ cảnh ô Excel so với badge màu trên UI; không tạo thuật ngữ mới. Áp dụng cho cả Sheet 1 và Sheet 4 (cùng cột, cùng vấn đề ở cả 2 nơi).

### 2. Sắp xếp lại cột Sheet 1 "1. Doi Ung TK"
Thứ tự mới (14 cột, không mất trường nào): **A=TK Nguon, B=Ngan Hang, C=TK Doi Ung, D=NH Doi Ung**, sau đó Ten Doi Ung, Do Tin Cay Ten Doi Ung, Ma Dinh Danh NH, Tong So GD, Tien Vao (VND), Tien Ra (VND), Net (VND), Lan Giao Dich Dau, Lan Giao Dich Cuoi, Nguon Du Lieu. A-B luôn là own identity (TK Nguon + Ngan Hang lấy từ `accountNumber`/`bankName` của giao dịch, KHÔNG lấy từ counterparty, KHÔNG lấy từ filename/mã thiết bị). C-D luôn là cặp counterparty identity.

### 3. Sheet 5 "5. Truy Tim Tai Khoan" — Account Owner Name Investigation
**Bản chất:** báo cáo điều tra độc lập, KHÔNG phải reconciliation. Không can thiệp `pairNapasGroups`/`resolveCounterparty`/Tier A/Tier B/kết quả MATCHED-UNMATCHED-AMBIGUOUS.

**Nguồn dữ liệu tên chủ tài khoản (quyết định thiết kế quan trọng):** KHÔNG có field "ownerName" trực tiếp cho tài khoản đang phân tích trong canonical model hiện tại. Giải pháp không-fabricate: xây **Owner Name Index** (`_flaBuildOwnerNameIndex`) bằng cách quét TOÀN BỘ giao dịch NAPAS trong dataset đang phân tích (`_flaState.data`), tìm mọi nơi một tài khoản X được ai đó khác ghi nhận là `counterpartyAccount` kèm `counterpartyName` đã resolve — đây là cách DUY NHẤT có dữ liệu thật để suy ra "tên chủ tài khoản X" mà không cần sửa parser/resolver. Mỗi identity (accountNumber + normalized bank) lấy tên có confidence cao nhất khi có nhiều tham chiếu (cùng convention `_flaConfidenceRank` đã dùng ở `buildAccountFlowMatrix`).

**Giới hạn phạm vi dữ liệu (quan trọng, đã xác minh qua source code):** CHỈ dùng tham chiếu nguồn NAPAS (`tx.sourceFormat === 'NAPAS'`). Sao kê legacy (9 định dạng ngân hàng cũ) KHÔNG BAO GIỜ có field `counterpartyBankName` (xác nhận qua grep `bank-parser.js` — chỉ path NAPAS gán giá trị này) nên không thể phân loại an toàn "cùng ngân hàng hay khác ngân hàng" cho một tham chiếu legacy — dùng liều sẽ có rủi ro khẳng định sai "khác ngân hàng". Đây là limitation thật, đã ghi nhận, không fabricate.

**Chuẩn hóa tên (`_flaNormalizeOwnerName`):** Unicode NFC canonicalization (gộp 2 cách encode Unicode khác byte nhưng cùng hiển thị — KHÔNG phải fuzzy) + trim + collapse whitespace + uppercase. KHÔNG bỏ dấu, KHÔNG bỏ tên đệm, KHÔNG fuzzy/Levenshtein/substring. Exact match sau chuẩn hóa.

**Luật cross-bank + self-exclusion (`_flaBuildOwnerInvestigationRows`):** identity = accountNumber + normalized bank identity (không dùng riêng accountNumber). Chỉ đưa vào candidate khi: cùng normalizedName + KHÁC bankId. Cùng accountNumber nhưng khác bankId vẫn được đưa vào (đúng case thật của 371010_5678 — 1 số tài khoản tại 3 ngân hàng), nhưng được đánh dấu rõ ở cột Ghi Chu. Một accId có thể có NHIỀU own-identity trong 1 workbook (vì `AccountExportGrouping.group()` gom theo accountNumber thuần, không theo bank — xác nhận qua source `account-export-grouping.js`) — Sheet 5 xét độc lập từng own-identity.

**Cột Sheet 5:** Tai Khoan Sao Ke, Ngan Hang Sao Ke, Ten Chu Tai Khoan Sao Ke, Tai Khoan Nghi Van, Ngan Hang Nghi Van, Ten Chu Tai Khoan Nghi Van, Ket Qua Doi Chieu Ten ("Cung ten sau chuan hoa"), Muc Do ("NGHI VAN"), Nguon Du Lieu, Ghi Chu. Disclaimer 3 dòng ở đầu sheet (trước header) nêu rõ đây chỉ là gợi ý điều tra, không chứng minh cùng chủ thể. Sắp xếp theo: ngân hàng nghi vấn → tài khoản nghi vấn (nguồn/tài khoản sao kê không đổi trong 1 block). Trạng thái rỗng ("Khong co du lieu truy tim tai khoan doi ung theo ten.") khi own-identity không tìm được tên hoặc không có candidate — không fabricate hàng giả.

### Sheet count
`_FLA_ACCOUNT_WORKBOOK_SHEET_NAMES` thêm phần tử thứ 5, mọi UI/toast text vẫn tự động lấy `.length` — không có "4 sheet"/"9 sheet" nào còn sót (đã grep xác nhận, kể cả trong comment code).

### Security
Thêm `_flaSafeExcelText()` — mitigation CSV/Excel formula injection theo chuẩn OWASP: giá trị bắt đầu bằng `= + - @` được prefix bằng dấu nháy đơn (không đổi nội dung hiển thị). Áp dụng cho Ten Doi Ung/NH Doi Ung (Sheet 1, Sheet 4) và tên chủ tài khoản (Sheet 5). Không tạo helper escape HTML thứ hai — `_escHtml()` không đổi (Sheet 5 không sinh HTML, chỉ XLSX).

### Kiểm thử
67/67 assertion Node `vm` PASS: 4 nhãn tiếng Việt + fallback rỗng; thứ tự cột A-D + không mất dữ liệu (14 cột) trên fixture thật; Owner Name Index (đồng nhất confidence-cao-nhất-thắng, loại legacy); chuẩn hóa tên (case/whitespace/NFC-NFD match, false-positive safety "NGUYEN VAN A" vs "NGUYEN VAN AN"/"ANH" không match); toàn bộ 9 case A-I từ đặc tả; formula-injection end-to-end trên workbook thật; 5 fixture bắt buộc build đủ 5 sheet không lỗi; **audit khả dụng tên chủ tài khoản trên TOÀN BỘ 27 file thật: 865 identity có tên, 599 tên chuẩn hóa duy nhất, 120 nhóm tên trải ≥2 ngân hàng, 1.404 candidate pair có thể xuất hiện** (số liệu thật, không fabricate, không suy ra "X đối tượng"); 255/255 collision invariant giữ nguyên; leading-zero round-trip Sheet 1 + Sheet 5; legacy regression (detectBank 11/11, Phase 1-4, Phase 8-15) không đổi.

**Browser E2E (Phase 22 harness, hardened, chạy lại có mục tiêu vì export UI đổi):** Fixture A (860320_9818, đơn nhóm) + Fixture B (371010_5678, đa ngân hàng) chạy trên Chrome thật — **25/25 PASS**, workbook tải về thật có đúng 5 sheet đúng thứ tự, cột A-D Sheet 1 đúng, **Sheet 5 tìm thấy 8 candidate thật** trên fixture B (dữ liệu thật, không giả lập). Không rerun Fixture C/D/E vì các fixture đó không trigger export trong harness (đã có Node vm coverage tương đương); không có thay đổi hành vi ngoài export nên không cần rerun toàn bộ suite.

### Known Limitations (Phase 25, xác minh)
1. Owner Name Index chỉ hoạt động trên tham chiếu NAPAS — sao kê legacy không có counterparty-bank field nên không tham gia được.
2. Một identity chỉ hiện DUY NHẤT tên có confidence cao nhất nếu có nhiều tên khác nhau tham chiếu tới cùng identity (không hiển thị đa danh sách) — hợp lý với dữ liệu thật hiện có nhưng là một lựa chọn thiết kế, không phải quy tắc nghiệp vụ bắt buộc.
3. Kết quả Sheet 5 là gợi ý điều tra, không phải bằng chứng — đã có disclaimer rõ ràng trong sheet.

### Kết luận Phase 25
HOÀN THÀNH. Không đổi reconciliation/pairing/matching logic. Không có STOP condition nào bị kích hoạt (255/255 giữ nguyên, 0 cross-bank, 0 fabricate, không fuzzy, formula-injection an toàn).

---

## Post-Phase-25 Fix — Export NAPAS-only workbook + Refresh button (2026-09-16)

**Bối cảnh:** 3 vấn đề thực tế phát sinh sau khi dùng Phase 25.

### Vấn đề 1 — Sheet "1. Doi Ung TK" chưa áp dụng logic như Sheet 4

**Root cause thực tế sau khi audit code (không đoán):** Sheet 1 **đã** có đúng thứ tự cột A-N (TK Nguon/Ngan Hang/TK Doi Ung/NH Doi Ung/Ten Doi Ung/Do Tin Cay Ten Doi Ung/Ma Dinh Danh NH/Tong So GD/Tien Vao/Tien Ra/Net/Lan Giao Dich Dau/Cuoi/Nguon Du Lieu) và nhãn tiếng Việt cho confidence — **đây chính là kết quả của Phase 25**, đã implement đúng từ trước. Audit + test thực tế (fixture 860320_9818 và 371010_5678) xác nhận: 14/14 cột đúng thứ tự, không có mã CONFIRMED/INFERRED/AMBIGUOUS/UNKNOWN nào lộ ra, "Tong So GD" tính đúng theo tổng số giao dịch thật (không đếm nhóm, không đếm sai CHUYEN/NHAN), 255/255 collision baseline giữ nguyên trên 371010_5678. **Không cần sửa code cho vấn đề 1** — chỉ xác nhận lại bằng test thật, tránh sửa những gì đã đúng.

### Vấn đề 2 — Workbook NAPAS phải còn 3 sheet, không phải 5

**Root cause:** `_FLA_ACCOUNT_WORKBOOK_SHEET_NAMES` (5 phần tử) được dùng cho MỌI export không phân biệt nguồn dữ liệu — sao kê NAPAS (không thể có giao dịch nạp tiền ĐT/ví điện tử vì cấu trúc định dạng NAPAS chỉ chứa CHUYỂN/NHẬN liên ngân hàng) vẫn luôn tạo đủ 5 sheet, trong đó Sheet 2/3 luôn là placeholder rỗng.

**Thay đổi (`app.js`):**
- Thêm hằng số thứ hai `_FLA_ACCOUNT_WORKBOOK_SHEET_NAMES_NAPAS_ONLY = ['1. Doi Ung TK', '2. Doi Soat NAPAS', '3. Truy Tim Tai Khoan']`.
- Thêm `_flaIsPureNapasExport(txSubset)` — trả `true` chỉ khi **TOÀN BỘ** giao dịch trong tập export có `sourceFormat === 'NAPAS'`. Nếu có bất kỳ giao dịch legacy nào trộn lẫn (mixed-source, kể cả cùng accountNumber), hàm trả `false` — **an toàn theo hướng bảo thủ**, không bao giờ làm mất dữ liệu legacy thật (đã test rõ case này).
- Thêm `_flaGetExportSheetNames(isPureNapas)` — trả về đúng 1 trong 2 mảng trên, KHÔNG hardcode số sheet ở nơi khác.
- `_buildAccountWorkbook`: tính `isPureNapas` một lần đầu hàm; Sheet 1 luôn build; **Sheet 2/3 (Nạp Tiền ĐT / Ví Điện Tử) chỉ build + append khi `!isPureNapas`** — logic `PhoneTopupEngine.analyze`/`analyzeFintechTransactions` **không bị xóa, không bị sửa**, chỉ bị bỏ qua lời gọi khi biết chắc không cần; Sheet 4 (Doi Soat NAPAS) và Sheet 5 (Truy Tim Tai Khoan) luôn build, nhưng dùng tên/vị trí lấy từ `sheetNames[isPureNapas ? 1 : 3]` và `sheetNames[isPureNapas ? 2 : 4]` — với export NAPAS thuần, tab hiển thị đúng liền mạch 1/2/3, không nhảy số.
- **3 vị trí message UI** từng hardcode `_FLA_ACCOUNT_WORKBOOK_SHEET_NAMES.length` nay sửa: (a) toast xuất 1 tài khoản dùng trực tiếp `wb.SheetNames.length` (số thật từ workbook vừa build); (b) toast xuất ZIP nhiều tài khoản đổi từ "N × M sheet" (giả định sai khi có tài khoản NAPAS trộn tài khoản legacy trong cùng batch) sang tổng cộng dồn thật `tổng ${totalSheetsAcrossAccounts} sheet` (cộng dồn `wb.SheetNames.length` thật của từng tài khoản trong vòng lặp); (c) preview panel trước khi xuất dùng `_flaGetExportSheetNames(_flaIsPureNapasExport(data))` — hiển thị đúng 3 sheet khi toàn bộ dữ liệu đang xem là NAPAS thuần, 5 sheet khi legacy/mixed.
- Không đánh số lại Sheet 2/3 legacy — mảng `_FLA_ACCOUNT_WORKBOOK_SHEET_NAMES` gốc (5 phần tử) giữ nguyên 100%, dùng cho mọi export legacy/mixed.

### Vấn đề 3 — Nút "Refresh"

**Vị trí:** top-bar, khu vực `.system-status-indicator` (luôn hiển thị ở mọi màn hình), cạnh nút FOCUS/GHI CHÚ có sẵn — tái dùng class `btn-ws`, không tạo CSS mới. Label hiển thị đúng "Refresh" theo yêu cầu, kèm tooltip tiếng Việt.

**Thiết kế:** Refresh reset **module đang active** (xác định qua `.screen.active`), không reset toàn bộ mọi module cùng lúc — tránh đụng tới config/dữ liệu của module người dùng KHÔNG đang thao tác.
- **FLA (bao gồm NAPAS, vì panel NAPAS sống trong cùng state FLA):** hàm mới `_flaResetSession()` — có `confirm()` xác nhận, reset toàn bộ global FLA (`_flaGraphResult`, `_flaAccountScores`, `_flaUploadedFiles`, `_flaInvestigReport`, `_flaAuditStore`, `_flaCalibrationMeta`, `_flaObsMetrics`, `_flaTopupResult`, `_flaNapasFileResults`, `_flaActiveCaseId` — chỉ con trỏ case đang active, **KHÔNG xóa lịch sử case đã lưu trong InvestigationCaseEngine** vì đó là dữ liệu persistent người dùng có thể cần xem lại), dừng D3 simulation + destroy Chart.js instances đúng cách (theo pattern đã có ở dòng 2352), xóa DOM (file list, pipeline status, NAPAS recon panel, export preview/bar), reset tab về "01 GIAO DỊCH", rồi **tái sử dụng `flaLoadData([])`** (hàm render pipeline đã có sẵn, đã test) để tự động render lại đúng trạng thái rỗng cho các tab dữ liệu trực tiếp (giao dịch/fraud/NLP/tags/đối ứng TK/NAPAS/ví điện tử) — không viết lại logic render. Các tab bị guard bởi `if (_flaXxxResult)` bên trong `flaLoadData` (đồ thị mạng, điều tra, sức khỏe hệ thống, nạp tiền ĐT) sẽ KHÔNG tự render lại khi biến bị null — xử lý riêng bằng cách xóa trực tiếp DOM của các tab này (SVG đồ thị, danh sách tài khoản/chuỗi nghi vấn, số liệu tổng hợp).
- **CDR:** tái sử dụng nguyên vẹn `CDRAnalyzer.clearAll()` đã có sẵn từ trước (không sửa `cdr-analyzer.js`) — hàm này đã có `confirm()` riêng, Refresh gọi trực tiếp nên không bị hỏi xác nhận 2 lần.
- **Màn hình khác (GTP/SRAU/batch/cases/logger/home):** hiện toast thông báo, không làm gì — an toàn tuyệt đối vì không chạm vào state của các module này (chưa có yêu cầu nghiệp vụ cụ thể để implement).

### Kiểm thử

**Node `vm` (Yêu cầu 1 + 2):** 31/31 PASS — 14 cột đúng thứ tự trên fixture thật, Tong So GD khớp tổng giao dịch thật, 255/255 collision giữ nguyên, workbook NAPAS thuần đúng 3 sheet đúng tên/thứ tự, không còn "Nap Tien DT"/"Vi Dien Tu", legacy vẫn đủ 5 sheet với Sheet 2/3 còn nguyên, **mixed-source (legacy+NAPAS cùng accountNumber) đúng ra 5 sheet (bảo thủ, không mất dữ liệu)**, leading-zero + formula-injection vẫn an toàn sau thay đổi, legacy regression (detectBank/parse/pairing/reconciliation) không đổi.

**Browser E2E thật (Yêu cầu 3, harness CDP hardened riêng, viết mới theo đúng pattern Phase 22 đã cứng hóa — timeout hữu hạn mọi CDP call, xử lý dialog `confirm()` qua `Page.javascriptDialogOpening`, cleanup `taskkill /T /F`):** 22/22 PASS sau khi sửa 1 lỗi trong chính test harness (không phải lỗi sản phẩm) — phát hiện: điều kiện "đã xử lý xong" ban đầu chỉ kiểm tra cờ busy + độ dài dữ liệu, nhưng việc render các tab nặng (panel NAPAS 3 ngân hàng) được `flaLoadData` hoãn lại một `requestAnimationFrame` nên có thể vẫn đang chạy đồng bộ (chặn cả `eval('1+1')` trong vài giây) dù cờ busy đã tắt — sửa bằng cách chờ thêm cho tới khi luồng chính thực sự rảnh trước khi coi là hoàn tất. Test thật: nút Refresh tồn tại + label đúng; upload fixture NAPAS 1 (860320_9818) → xác nhận có dữ liệu → click Refresh → `confirm()` được xử lý tự động qua CDP → `_flaState.data`/`_flaNapasFileResults` về rỗng, file list + panel NAPAS ẩn/rỗng, tab về "01 GIAO DỊCH", file input rỗng → upload fixture NAPAS 2 (371010_5678, khác hẳn) → xác nhận đúng 3155 giao dịch, chỉ có accountNumber của fixture 2, **không còn dấu vết fixture 1**; màn hình CDR: Refresh gọi đúng `CDRAnalyzer.clearAll()`, dialog xử lý đúng, không crash; màn hình GTP (chưa implement): click Refresh không lỗi. 0 console error, 0 uncaught exception xuyên suốt.

### Known Limitations (Post-Phase-25 fix)
1. Refresh hiện chỉ implement đầy đủ cho FLA/NAPAS và CDR (qua hàm có sẵn) — GTP/SRAU/batch/cases/logger chỉ hiện thông báo, chưa có reset logic riêng (chưa có yêu cầu nghiệp vụ cụ thể).
2. `_flaResetSession()` xóa DOM trực tiếp cho 4 tab bị guard (đồ thị/điều tra/sức khỏe/nạp tiền ĐT) thay vì tái dùng render pipeline — nếu các tab này có thêm sub-widget mới trong tương lai, cần bổ sung thủ công vào danh sách xóa.
3. Test CDR chỉ xác nhận routing + không crash (không có fixture CDR thật khả dụng trong môi trường để test full upload→refresh→upload thứ 2 như đã làm với NAPAS).

### Kết luận Post-Phase-25 Fix
HOÀN THÀNH. Không sửa `bank-parser.js`, không sửa `cdr-analyzer.js`, không sửa `index-Son0Cao0PC.html`. Không đổi reconciliation/pairing/matching logic. Không có STOP condition nào bị kích hoạt (255/255 giữ nguyên, 0 cross-bank merge, legacy Sheet 2/3 giữ nguyên hành vi, formula-injection + leading-zero vẫn an toàn).

---

## Owner-Name Inference + Suspicious Account Investigation + Export Restructure (2026-09-16)

**Phạm vi:** (A) suy luận tên chủ tài khoản trực tiếp từ nội dung CHUYEN, nâng cấp Sheet "Truy Tim Tai Khoan" thành báo cáo có bằng chứng cấp giao dịch; (B) thiết kế lại Sheet "1. Doi Ung TK" và "Doi Soat NAPAS" (NAPAS-only) dễ đọc hơn. KHÔNG sửa `bank-parser.js`, KHÔNG sửa Tier A/B, KHÔNG sửa `resolveCounterparty()`.

### Xác minh raw cell value (bắt buộc trước khi code, docs §5/§23)
Ảnh mẫu người dùng cung cấp cho thấy nội dung "NGUYEN / TIEN / NGUYEN / Chuyen tien" tách thành nhiều dòng — kiểm tra trực tiếp raw XLSX cell (không qua bất kỳ transform nào) trên fixture `882503_1992_CHUYEN` xác nhận: **raw value thực tế là "NGUYEN TIEN NGUYEN Chuyen tien" — KHÔNG có `\n`/`\r` nào trong toàn bộ 3.685 giao dịch CHUYEN có nội dung của 4 fixture bắt buộc.** Việc xuống dòng chỉ là hiệu ứng hiển thị do độ rộng cột trong trình xem Excel, không phải dữ liệu thật.

### Pattern discovery thực tế (trước khi viết parser)
Quét toàn bộ nội dung CHUYEN của 4 fixture bắt buộc (860320_9818, 371010_5678, 882503_1992, 979494_9999), phát hiện **2 pattern có cấu trúc đáng tin cậy, không hard-code 1 pattern duy nhất**:
1. **MBVCB narrative** (cùng họ pattern đã dùng cho counterparty CONFIRMED tier sẵn có trong `bank-parser.js`): `"MBVCB....CT tu <TK> <TÊN> toi <TK> <TÊN> tai <NH>"` — đọc phía "tu" (own/sender) thay vì "toi" (counterparty), đối chiếu chéo với `accountNumber` thật của giao dịch.
2. **"<TÊN> chuyen..."**: tên 2-5 token viết hoa chữ cái đầu, ngay trước từ "chuyen" (bare, hoặc "chuyen tien"/"chuyen khoan"/"chuyen thanh toan"/"chuyen hoc phi"/"chuyen FT250..." — tất cả đều chứa "chuyen" nên 1 anchor duy nhất phủ hết).

Coverage thật trên 4 fixture: **88,1% (146 CONFIRMED + 3.099 INFERRED / 3.685 giao dịch có nội dung)**. Đã review thủ công toàn bộ mẫu KHÔNG match (residual): xác nhận không có tên thật nào bị bỏ sót — nội dung không match là mã QR/tham chiếu hệ thống ("P4XAVEWS FT25..."), cụm mô tả chung ("Chuyen cho me"), chữ số/ký tự đơn lẻ — đúng như nguyên tắc "không đủ bằng chứng thì để UNKNOWN".

### Model dữ liệu — 2 khái niệm tách biệt (docs §3)
- **`ownerName` / `ownerNameConfidence` / `ownerNameSource` / `ownerNameEvidence`** — MỚI, chỉ tồn tại trong index tính toán ở `app.js` (`_flaBuildAccountOwnerIndex`), KHÔNG thêm field mới vào canonical `makeTx()`/`bank-parser.js`. Suy luận từ nội dung CHUYEN (OUT-direction) của CHÍNH tài khoản đang xét.
- **`counterpartyName` / `counterpartyNameConfidence`** — giữ nguyên 100%, vẫn là field trên `tx` do `resolveCounterparty()` (bank-parser.js, không đổi) tạo ra, đại diện cho phía ĐỐI TÁC trong 1 giao dịch cụ thể.

Quyết định kiến trúc: không sửa `bank-parser.js` để giữ nhất quán với toàn bộ Phase 1-25 (mọi logic suy luận owner-name là derived/pure-function ở `app.js`, giống hệt cách Sheet 5 gốc của Phase 25 đã làm).

### Owner Name Index — `_flaBuildAccountOwnerIndex()`
- Chỉ quét giao dịch CHUYEN (`transactionType === 'OUT'`) của nguồn NAPAS (`sourceFormat === 'NAPAS'`) — giao dịch NHAN và legacy KHÔNG bao giờ đóng góp ownerName (đúng docs §4).
- Identity = `accountNumber + '||' + normalizedBankId` — cùng số tài khoản khác ngân hàng luôn là 2 identity riêng biệt (không đổi từ mọi phase trước).
- Không lấy giao dịch đầu tiên tùy tiện (docs §8) — tally MỌI candidate theo từng giao dịch, resolve theo: **confidence tier cao nhất trước, sau đó tần suất cao nhất trong tier đó** (khớp ví dụ cụ thể trong đặc tả nhiệm vụ, cùng convention `_flaConfidenceRank` đã có từ Phase 5). Nếu 2 candidate hàng đầu trong cùng tier chênh nhau dưới 2 lần → **AMBIGUOUS**, không chọn liều — có test tổng hợp riêng xác nhận nhánh này hoạt động đúng (dữ liệu thật của 4 fixture không có ca nào chạm ngưỡng này, các owner-name thắng áp đảo: 111 vs 15, 1.015 vs 1, 2.075 một mình, 28/29).
- O(n) một lượt qua giao dịch + O(k) resolve k identity — không nested scan.

### Suspicious Account — logic cross-reference NHAN (docs §10-14)
Phát hiện quan trọng: `tx.counterpartyName` trên giao dịch NHAN **đã sẵn** được `resolveCounterparty()` (không đổi) trích xuất từ chính nội dung NHAN đó — tức "quét nội dung NHAN tìm tên người gửi" mà đặc tả yêu cầu **đã được implement từ Phase 4/25**, không cần viết lại. `_flaBuildOwnerNameIndex()` (Phase 25, nay bổ sung lưu evidence giao dịch) chính là index NHAN-side đó.

Cơ chế mới chỉ thay phía SOURCE: `_flaBuildOwnerInvestigationRows()` nay lấy tên chủ tài khoản nguồn từ `_flaBuildAccountOwnerIndex()` (CHUYEN-direct, MỚI) thay vì cơ chế Phase 25 cũ (chỉ tìm được tên nếu tài khoản đó TÌNH CỜ cũng là counterparty của ai khác). Toàn bộ luật lọc giữ nguyên, đã re-test:
- Self-exclusion theo identity (accountNumber+bank), không chỉ accountNumber.
- Same-bank candidate bị loại (docs §14).
- Same-accountNumber-khác-bank vẫn được đưa vào, gắn cờ rõ ràng trong cột Ghi Chu (docs §13).
- AMBIGUOUS source owner name (§8) không bao giờ sinh candidate (tránh đoán tên nào là "đúng" rồi tìm theo tên sai).
- Exact-normalized-name match (NFC + trim + collapse whitespace + uppercase) — không bỏ dấu, không fuzzy, không substring ("AN" không match "NGUYEN VAN AN"; "NGUYEN VAN A" không match "NGUYEN VAN AN").

### Excel — Sheet "1. Doi Ung TK" (chỉ pure-NAPAS export, docs §17)
13 cột (bớt 2 so với 14 cột trước): **A=Tai Khoan Nguon, B=Ten Chu TK Nguon (MỚI), C=Ngan Hang (Nguon), D=Tai Khoan Doi Ung, E=Ten Chu TK Doi Ung, F=Ngan Hang Doi Ung, G=Do Tin Cay Ten Doi Ung, H=Tong So GD, I=Tien Vao (VND), J=Tien Ra (VND), K=Lan Giao Dich Dau, L=Lan Giao Dich Cuoi, M=Nguon Du Lieu.** Bỏ "Ma Dinh Danh NH" và "Net (VND)" khỏi sheet này — `bankId` vẫn tính đầy đủ nội bộ (dùng để tra owner name), Net vẫn tính được nếu cần (`sumIN-sumOUT`), chỉ không xuất ra 2 cột này. **Export legacy/mixed-source giữ nguyên 100% layout 14 cột cũ, byte-for-byte** (xác nhận bằng test).

### Excel — Sheet "Doi Soat NAPAS" (docs §18)
Cùng nguyên tắc: owner-name lên đầu (A=Tai Khoan Nguon, B=Ten Chu TK Nguon, C=Ngan Hang (Nguon), D=Tai Khoan Doi Ung, E=Ten Chu TK Doi Ung, F=Ngan Hang Doi Ung, G=Do Tin Cay Ten Doi Ung), sau đó Chieu/Ngay Gio GD/So Tien/Ma Giao Dich/Nguon Du Lieu, rồi đầy đủ 4 trường reconciliation cũ (Trang Thai Doi Soat/GD Doi Ung Khop/Phuong Phap Khop/Bang Chung Khop — **không mất trường nào**). Bỏ "Ma Dinh Danh NH" (sheet này vốn không có cột Net).

### Excel — Sheet "Truy Tim Tai Khoan" nâng cấp (docs §16)
Chuyển từ 1-dòng-mỗi-cặp-tên sang **1 dòng mỗi giao dịch NHAN làm bằng chứng**, đúng yêu cầu "account → owner → bank → suspicious account → evidence": Tai Khoan Dang Phan Tich, Ten Chu Tai Khoan, Ngan Hang Dang Phan Tich, Tai Khoan Nghi Van, Ten Chu TK Nghi Van, Ngan Hang Nghi Van, **Noi Dung Giao Dich, So REF, Ngay GD, So Tien, Huong Giao Dich** (MỚI — bằng chứng cấp giao dịch), Muc Do Tin Cay, Ly Do/Bang Chung, Ghi Chu. Giới hạn tối đa 3 giao dịch bằng chứng/candidate (tránh bùng nổ dòng, tương tự `_FLA_RECON_ROW_CAP` đã dùng ở Sheet Doi Soat NAPAS). Disclaimer đầu sheet cập nhật câu đầu tiên đúng nguyên văn docs §15: "Day la dau moi nghi van dua tren noi dung giao dich trung ten; khong phai bang chung xac dinh cung chu tai khoan."

### Không thay đổi
`bankId`/normalized bank identity/bank pairing/collision protection **không hề bị xóa khỏi canonical model** (docs §19) — chỉ không xuất "Ma Dinh Danh NH" ra 2 sheet Excel theo yêu cầu. Logic tính Net nội bộ (`sumIN - sumOUT`) vẫn nguyên (docs §20) — chỉ bỏ khỏi export. Không có UI mới hiển thị owner-name/suspicious-account nên không phát sinh bề mặt `_escHtml()` mới (docs §22 — điều kiện "nếu có màn hình hiển thị" không xảy ra lần này).

### Kiểm thử
**50/50 Node `vm` assertion PASS** (1 lỗi ban đầu do bug trong chính test — dùng account number không phải số cho pattern MBVCB vốn yêu cầu `\d+` đúng với dữ liệu thật — đã sửa test, không sửa code): toàn bộ test case A-J owner-extraction (docs §24, gồm case H "NGUYEN VAN A" vs "NGUYEN VAN AN" KHÔNG match, case I substring "AN" KHÔNG match, case J formula-injection an toàn); raw-cell verification trên 882503_1992; account-owner-index aggregation (dominant-wins, AMBIGUOUS trên near-tie 2-vs-2, confidence-tier thắng frequency, legacy/IN-direction không đóng góp); toàn bộ 10 case suspicious-account (docs §25); cấu trúc Excel 3 sheet (13 cột Sheet 1, cột reorder Sheet Doi Soat NAPAS, cột bằng chứng Sheet Truy Tim Tai Khoan) trên fixture thật; legacy export không đổi (14 cột, 5 sheet); 255/255 collision; hiệu năng (3155 giao dịch + owner-index build: 230-278ms, không O(n²)).

**Real-data statistics (4 fixture bắt buộc, docs §26):** 8 account identity có ownerName suy luận được (2 CONFIRMED + 6 INFERRED + 0 AMBIGUOUS), 6 tên chuẩn hóa duy nhất, 463 identity phía NHAN (counterparty) với 324 tên duy nhất, **66 dòng bằng chứng suspicious-account thật** được sinh ra (không fabricate) — ví dụ thật: "HOANG DUC THANG" (860320_9818) và "LE VAN AN" (371010_5678) xuất hiện tại nhiều tài khoản/ngân hàng khác nhau trong nội dung giao dịch NHAN của các tài khoản khác trong bộ dữ liệu.

**Browser E2E thật (Phase 22 harness, hardened, chạy lại có mục tiêu):** Fixture A (860320_9818) + Fixture B (371010_5678) — **28/28 PASS** trên Chrome thật. Xác nhận: cả 2 fixture đều pure-NAPAS nên workbook tải về thật chỉ còn 3 sheet; Sheet 1 đúng 13 cột, không còn Ma Dinh Danh NH/Net; owner name thật resolve đúng ("HOANG DUC THANG"); Sheet 3 (Truy Tim Tai Khoan) sinh **55 dòng bằng chứng thật** trên fixture B.

### Known Limitations
1. Owner Name Index chỉ dùng dữ liệu NAPAS (như Phase 25) — legacy statement không có counterparty-bank field nên không tham gia được ở phía candidate; phía owner (CHUYEN) cũng chỉ áp dụng cho NAPAS vì pattern "<TÊN> chuyen..." được phát hiện/xác minh riêng cho NAPAS.
2. Coverage owner-name 88,1% trên 4 fixture bắt buộc — 11,9% còn lại (mã QR/tham chiếu hệ thống/cụm mô tả không chứa tên) là giới hạn thật của dữ liệu, không phải lỗi parser — không mở rộng pattern-whitelist quá những gì đã xác minh từ fixture thật.
3. Mỗi identity chỉ giữ DUY NHẤT tên có confidence+frequency cao nhất nếu có nhiều tên cạnh tranh (không hiển thị đa danh sách trong Excel) — evidence đầy đủ (allCandidates) có trong index nội bộ nhưng không export ra Excel.
4. Giới hạn tối đa 3 giao dịch bằng chứng/candidate trong Sheet Truy Tim Tai Khoan — nếu 1 cặp có nhiều hơn 3 giao dịch trùng tên, chỉ 3 đầu tiên được xuất (không âm thầm — nhưng chưa có dòng disclosure số lượng bị ẩn như đã làm ở Sheet Doi Soat NAPAS's 300-row cap).

### Kết luận
HOÀN THÀNH. Không sửa `bank-parser.js`. Không đổi Tier A/B/pairing/resolveCounterparty(). Không có STOP condition nào bị kích hoạt: 255/255 collision giữ nguyên, 0 cross-bank merge, 0 fabricate (mọi ownerName/candidate không đủ bằng chứng đều để UNKNOWN/loại), legacy export không đổi 1 cột nào, formula-injection + leading-zero vẫn an toàn.

---

## Fix — Sắp Xếp Lại "Ngan Hang (Nguon)" Trong Sheet "1. Doi Ung TK" (2026-09-16)

**Vấn đề người dùng báo cáo:** Sheet "1. Doi Ung TK" hiển thị tài khoản `3710105678` với cột "Ngan Hang (Nguon)" đổi liên tục qua từng dòng (VCB, VCB, TCB, VCB, ACB, ACB...) — trông giống dữ liệu bị lẫn ngân hàng.

### Root cause (xác minh bằng code + dữ liệu thật, không đoán — docs §26)
- **Field trước đây dùng cho source bank:** `tx.bankName`, đọc trong `buildAccountFlowMatrix()` (`app.js`).
- **Nguồn sự thật thật sự:** ĐÃ ĐÚNG từ trước — `bank-parser.js` dòng `parseNapasGroupTransactions()` gán `bankName: ownBankName` (biến lấy trực tiếp từ `group.bankName`, tức metadata "Tên ngân hàng chuyển/nhận" của group), **hoàn toàn độc lập** với 2 cột raw "Ngân hàng chuyển"/"Ngân hàng nhận" theo từng dòng giao dịch — 2 cột đó CHỈ được dùng để gán `counterpartyBankName` (có đảo chiều đúng theo CHUYEN/NHAN, dòng 1101-1116 `bank-parser.js`). Đã verify bằng script kiểm tra trực tiếp: cả 6 group NAPAS của 371010_5678 đều có `bankNames.size === 1` nội bộ, không group nào bị lẫn.
- **Grouping key sai:** KHÔNG — `key = src + '||' + cp + '||' + bankId` (Phase 5) đã bao gồm `bankId`, xác nhận qua test: 83/83 giao dịch góp vào 1 dòng ma trận mẫu đều có cùng `tx.bankName` thật.
- **Root cause thật sự: SORT ORDER, không phải grouping/data.** `buildAccountFlowMatrix()`'s dòng cuối `.sort((a,b) => b.totalCount - a.totalCount || ...)` sắp xếp TOÀN CỤC theo tần suất giao dịch, không nhóm theo (accountNumber, bankId) trước — với 3710105678 có hàng trăm dòng (mỗi dòng = 1 cặp tài khoản-đối-ứng riêng biệt across 3 ngân hàng), việc sort thuần theo tần suất làm các dòng của 3 ngân hàng khác nhau interleave lẫn nhau khi xuất ra Excel — đúng y hệt hiện tượng người dùng chụp ảnh báo cáo, dù dữ liệu từng dòng vẫn 100% chính xác.

### Fix
Sửa **duy nhất 1 chỗ**: thứ tự sort cuối `buildAccountFlowMatrix()` (dùng chung bởi CẢ Excel export `_buildAccountWorkbook` LẪN UI tab `_renderAccountFlowTab` — sửa 1 nơi, đúng cho cả 2):
```
.sort((a, b) =>
  a.accountNumber.localeCompare(b.accountNumber) ||
  (a.bankId || '').localeCompare(b.bankId || '') ||
  b.totalCount - a.totalCount ||
  (b.sumIN + b.sumOUT) - (a.sumIN + a.sumOUT));
```
Nhóm theo tài khoản → ngân hàng trước, giữ nguyên thứ tự tần suất/khối lượng làm tiêu chí phụ TRONG mỗi cụm. Không đổi grouping key, không đổi field nguồn, không đổi header (đã đúng từ Post-Phase-25 Fix trước) — chỉ đổi thứ tự hiển thị để 3 identity không còn bị trộn lẫn khi đọc từ trên xuống.

### 371010_5678 — xác nhận 3 source identity độc lập
`unique(accountNumber + '||' + bankId)` cho 3710105678 = **3** (`3710105678||ACB`, `3710105678||Techcombank`, `3710105678||Vietcombank`) — mỗi identity nay xuất hiện thành **1 khối liên tục** (contiguous, không xen kẽ) trong cả Node test lẫn file Excel thật tải về từ trình duyệt thật. Tổng theo từng ngân hàng khớp chính xác dữ liệu thô: ACB=1254, Vietcombank=369, Techcombank=1532 (giống hệt số giao dịch thật đếm trực tiếp từ file gốc).

### Kiểm thử
**Node `vm`: ALL PASS** (toàn bộ §15-19/§24 của yêu cầu) — 3 identity độc lập cho 371010_5678; mỗi identity có đúng 1 sourceBank nhất quán; dòng liên tục không xen kẽ (3 block, không tái xuất hiện); Tong So GD tổng đúng theo từng identity và theo từng ngân hàng; 255/255 collision giữ nguyên; 0 cross-bank merge; header Sheet 1 đúng nguyên văn yêu cầu (13 cột); 3 fixture còn lại (860320_9818/882503_1992/979494_9999) không regression; legacy grouping (không có bankId trong key) hoàn toàn không đổi; leading-zero/pairing/reconciliation không đổi.

**Browser E2E thật (harness hardened, fixture B = 371010_5678): 17/17 PASS** — file Excel thật tải về từ Chrome thật xác nhận Sheet "1. Doi Ung TK" hiển thị đúng 3 ngân hàng nguồn phân biệt cho 3710105678, các dòng liên tục không xen kẽ — xác nhận trực tiếp lỗi người dùng báo cáo đã được khắc phục trên chính file export thật.

### Known Limitations
Không phát sinh limitation mới — đây là fix thuần về thứ tự hiển thị, không đổi bất kỳ nguồn dữ liệu/logic tính toán nào.

### Kết luận
HOÀN THÀNH. Root cause là sort order, không phải data/grouping bug — `bank-parser.js` và grouping key trong `buildAccountFlowMatrix` đã đúng từ trước. Fix tối thiểu, đúng 1 vị trí, áp dụng đồng nhất cho cả Excel export và UI tab. Không sửa `bank-parser.js`. 255/255 collision + 0 cross-bank merge xác nhận giữ nguyên. Không regression trên 4 fixture bắt buộc, legacy, security.
