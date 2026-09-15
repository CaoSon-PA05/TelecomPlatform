/**
 * bank-parser.js — Multi-bank Excel detection + normalization engine
 * Zero-server-leak: all processing runs client-side in the browser.
 * Supported: BIDV, Vietcombank, Techcombank, Vietinbank, VPBank, Eximbank,
 *            Sacombank, Agribank, MB Bank, NAPAS (interbank tracing export,
 *            multi bank-group per file — see NAPAS PARSER section)
 *            + Generic fallback
 */
const BankParser = (() => {

  // ─── UTILITIES ───────────────────────────────────────────────────────────────

  function cellStr(v) {
    if (v === null || v === undefined) return '';
    return String(v).trim();
  }

  function normalizeStr(s) {
    return (s || '')
      .replace(/[ĐĐ]/g, 'D').replace(/[đ]/g, 'd')  // Đ/đ is not a base+combining, must be handled first
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function containsAny(str, keywords) {
    const n = normalizeStr(str);
    return keywords.some(kw => n.includes(normalizeStr(kw)));
  }

  function parseDate(v) {
    if (!v && v !== 0) return '';
    if (v instanceof Date) return fmtDate(v);
    if (typeof v === 'number') {
      // XLSX serial date → JS Date via XLSX.SSF if available, else manual
      try {
        const d = XLSX.SSF.parse_date_code(v);
        if (d) return `${p2(d.d)}/${p2(d.m)}/${d.y} ${p2(d.H || 0)}:${p2(d.M || 0)}:${p2(d.S || 0)}`;
      } catch (_) {}
      return '';
    }
    const s = String(v).trim();
    // DD/MM/YYYY HH:mm:ss
    let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(\d{2}:\d{2}(?::\d{2})?)?/);
    if (m) return `${p2(m[1])}/${p2(m[2])}/${m[3]}${m[4] ? ' ' + m[4] : ' 00:00:00'}`;
    // YYYY-MM-DD
    m = s.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{2})\s*(\d{2}:\d{2}(?::\d{2})?)?/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ' ' + m[4] : ' 00:00:00'}`;
    return s.slice(0, 20);
  }

  function fmtDate(d) {
    return `${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  }

  function p2(n) { return String(n || 0).padStart(2, '0'); }

  function parseAmount(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return Math.abs(v);
    const s = String(v).replace(/[,\s]/g, '').replace(/[^\d.\-]/g, '');
    return Math.abs(parseFloat(s) || 0);
  }

  function rowText(row) {
    return (row || []).map(cellStr).join(' ');
  }

  function rowNorm(row) {
    return normalizeStr(rowText(row));
  }

  function findRow(rows, keywords, maxScan = 30) {
    for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
      const n = rowNorm(rows[i]);
      if (keywords.every(kw => n.includes(normalizeStr(kw)))) return i;
    }
    return -1;
  }

  // ─── HEADER DISCOVERY ENGINE ─────────────────────────────────────────────────
  // Scores each row for likelihood of being a column-header row.
  // Used by all parsers as a fallback when fixed row offsets are uncertain.

  const _HDR_KEYWORDS = [
    'date','ngay','ngay giao dich','debit','credit','phat sinh no','phat sinh co',
    'so du','balance','noi dung','description','transaction','ghi no','ghi co',
    'so tien','amount','stk','so tai khoan','account',
  ];

  function findHeaderRow(rows, maxScan) {
    const limit = Math.min(maxScan || 100, rows.length);
    let bestIdx = -1, bestScore = 0;
    for (let i = 0; i < limit; i++) {
      const n = rowNorm(rows[i]);
      let score = 0;
      for (const kw of _HDR_KEYWORDS) {
        if (n.includes(kw)) score++;
      }
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    return bestIdx;
  }

  // ─── COLUMN DISCOVERY ENGINE ─────────────────────────────────────────────────
  // Fuzzy-maps normalized header cell values to standard field names.
  // Returns { date, debit, credit, balance, description, account, txId, cpAccount, cpName, cpBank }

  function findColumnMapping(headerRow) {
    const map = { date:-1, debit:-1, credit:-1, balance:-1, description:-1,
                  account:-1, txId:-1, cpAccount:-1, cpName:-1, cpBank:-1 };
    if (!headerRow) return map;
    headerRow.forEach((cell, i) => {
      const h = normalizeStr(cellStr(cell));
      if (map.date<0        && (h.includes('ngay') || h.includes('date')))                          map.date=i;
      if (map.debit<0       && (h.includes('ghi no') || h.includes('phat sinh no') || h==='debit' || h.includes('so tien ghi no'))) map.debit=i;
      if (map.credit<0      && (h.includes('ghi co') || h.includes('phat sinh co') || h==='credit'|| h.includes('so tien ghi co'))) map.credit=i;
      if (map.balance<0     && (h.includes('so du') || h.includes('balance') || h.includes('du cuoi')))                            map.balance=i;
      if (map.description<0 && (h.includes('noi dung') || h.includes('dien giai') || h.includes('description') || h.includes('narrative') || h.includes('mo ta'))) map.description=i;
      if (map.account<0     && (h.includes('so tai khoan') || h.includes('acct_id') || h.includes('account no') || h.includes('foracid')))                         map.account=i;
      if (map.txId<0        && (h.includes('so but toan') || h.includes('transaction no') || h.includes('transaction_id') || h.includes('ma_ft') || h.includes('tran_id'))) map.txId=i;
      if (map.cpAccount<0   && (h.includes('tk doi ung') || h.includes('stk doi ung') || h.includes('tk du lnh') || h==='account')) map.cpAccount=i;
      if (map.cpName<0      && (h.includes('don vi thu huong') || h.includes('don vi chuyen') || h.includes('nguoi phat lenh') || h.includes('beneficiary')))      map.cpName=i;
      if (map.cpBank<0      && (h.includes('ngan hang doi tac') || h.includes('remitter bank') || h.includes('ngan hang doi ung') || h.includes('nh du')))         map.cpBank=i;
    });
    return map;
  }

  // ─── BANK DETECTION ──────────────────────────────────────────────────────────
  // IMPORTANT DESIGN: check new banks against METADATA rows only (before data rows).
  // Existing bank files (BIDV, VCB, Vietinbank) have their bank name in the first
  // few metadata rows. New bank files (Sacombank, MB Bank, Agribank) have unique
  // structural signatures that must be identified before the generic name-checks,
  // because their data rows often contain counterparty bank names (BIDV, VCB, etc.)
  // that would otherwise cause false detection.

  function detectBank(rows, sheetName) {
    // ── Phase 0: NAPAS interbank tracing export ───────────────────────────────
    // Fingerprint: sheet name "KET QUA TIM KIEM" + reference to công văn
    // CV-NAPAS.KSTT in the first ~10 rows (docs/NAPAS_UPGRADE_SPEC.md §2).
    // This is checked before any other phase because it is unambiguous and
    // does not touch data rows (no risk of colliding with the fingerprints
    // below, which all look at transaction/metadata rows of a single-bank
    // statement — a NAPAS file has a completely different row 0-9 shape).
    if (normalizeStr(sheetName || '').includes('ket qua tim kiem')) {
      const meta10raw = rows.slice(0, 10).map(r => rowText(r)).join(' ');
      if (/CV-NAPAS\.KSTT/i.test(meta10raw)) return 'NAPAS';
    }

    // ── Phase 1: unique ROW-0 column-name fingerprints ────────────────────────
    // Only examine row 0 — cannot be contaminated by transaction data.
    const r0norm = normalizeStr(rows[0] ? rowText(rows[0]) : '');
    if (r0norm.includes('acct_id') && r0norm.includes('debit_amt') && r0norm.includes('narrative'))  return 'Sacombank';
    if (r0norm.includes('full_name') && r0norm.includes('acct_id') && r0norm.includes('credit_amt')) return 'Sacombank';
    if (r0norm.includes('ma_ft')   || r0norm.includes('ngay_giao_dich'))       return 'VPBank';
    if (r0norm.includes('sol_id')  || r0norm.includes('phat_sinh_no'))         return 'Eximbank';

    for (const idx of [1, 3]) {
      if (!rows[idx]) continue;
      const h = rows[idx].map(c => normalizeStr(cellStr(c)));
      const hStr = h.join('|');
      if (hStr.includes('ma_ft') || hStr.includes('ngay_giao_dich'))              return 'VPBank';
      if (hStr.includes('sol_id') || hStr.includes('phat_sinh_no'))               return 'Eximbank';
      if (hStr.includes('so tai khoan') && hStr.includes('ngay gia tri') && hStr.includes('but toan')) return 'Techcombank';
    }

    // ── Phase 2: metadata-only scan (rows 0-8, before any data rows) ─────────
    // Agribank metadata block is strictly in rows 0-8.
    const meta8raw = rows.slice(0, 9).map(r => rowText(r)).join(' ');
    if (/agribank/i.test(meta8raw))                                   return 'Agribank';
    if (normalizeStr(meta8raw).includes('ngan hang nong nghiep'))     return 'Agribank';

    // ── Phase 3: metadata scan rows 0-14 (MB Bank header ends at row 14) ──────
    const meta15raw  = rows.slice(0, 15).map(r => rowText(r)).join(' ');
    const meta15norm = normalizeStr(meta15raw);
    // "QUÂN ĐỘI" → after Đ→D fix + NFD strip → "quan doi"; "Military" raw check
    if (meta15norm.includes('quan doi') || /military commercial/i.test(meta15raw)) return 'MB Bank';
    // Also detect via unique column header pattern (rows 15-20 for MB Bank)
    const mbHdrIdx = findRow(rows, ['phat sinh no', 'phat sinh co', 'so but toan'], 20);
    if (mbHdrIdx >= 0) return 'MB Bank';

    // ── Phase 4: existing banks — metadata-limited (rows 0-14, no data rows) ──
    // Using the limited range prevents data-row contamination.
    if (meta15norm.includes('dau tu va phat trien') || /\bbidv\b/i.test(meta15raw))    return 'BIDV';
    if (meta15norm.includes('ngoai thuong')         || /\bvietcombank\b/i.test(meta15raw)) return 'Vietcombank';
    if (meta15norm.includes('cong thuong')          || /\bvietinbank\b/i.test(meta15raw))  return 'Vietinbank';
    if (containsAny(meta15raw, ['liet ke giao dich tai khoan', 'techcombank']))             return 'Techcombank';
    if (/\bvpbank\b/i.test(meta15raw))  return 'VPBank';
    if (/\beximbank\b/i.test(meta15raw)) return 'Eximbank';

    // ── Phase 5: Agribank column-header pattern fallback ─────────────────────
    const agriHdrIdx = findRow(rows, ['ngay giao dich', 'so tien ghi no', 'noi dung giao dich'], 20);
    if (agriHdrIdx >= 0) return 'Agribank';

    // ── Phase 6: wider scan as last resort (original checks, may have noise) ──
    const header20 = rows.slice(0, 20).map(r => rowText(r)).join(' ');
    const n20 = normalizeStr(header20);
    if (n20.includes('dau tu va phat trien'))             return 'BIDV';
    if (n20.includes('ngoai thuong'))                     return 'Vietcombank';
    if (n20.includes('cong thuong'))                      return 'Vietinbank';
    if (containsAny(header20, ['liet ke giao dich tai khoan'])) return 'Techcombank';
    if (/\bvpbank\b/i.test(header20))                    return 'VPBank';
    if (/\beximbank\b/i.test(header20))                  return 'Eximbank';

    return 'Unknown';
  }

  // ─── TRANSACTION BUILDER ─────────────────────────────────────────────────────

  function makeTx(opts) {
    const {
      id, date, amount, description, accountNumber,
      counterpartyAccount, counterpartyName, bankName, txType, balance,
      // NAPAS extension fields (optional — docs/NAPAS_UPGRADE_SPEC.md §8).
      // Always null/undefined for the 9 existing bank parsers; safe additive
      // fields, do not change the shape any existing consumer relies on.
      counterpartyBankName, counterpartyNameConfidence, sourceFormat, groupIndex,
    } = opts;
    return {
      transactionId:       String(id || ''),
      transactionDate:     date || '',
      amount:              Math.round(amount || 0),
      description:         String(description || '').trim().slice(0, 200),
      accountNumber:       String(accountNumber || ''),
      counterpartyAccount: counterpartyAccount || null,
      counterpartyName:    counterpartyName || null,
      bankName:            bankName,
      transactionType:     txType,   // 'IN' | 'OUT'
      balance:             balance != null ? Math.round(parseAmount(balance)) : null,
      rawSource:           bankName,
      counterpartyBankName:       counterpartyBankName || null,
      counterpartyNameConfidence: counterpartyNameConfidence || null,       // 'CONFIRMED'|'INFERRED'|'AMBIGUOUS'|'UNKNOWN'|null
      sourceFormat:               sourceFormat || null,                    // e.g. 'NAPAS'; null = ordinary bank statement
      groupIndex:                 groupIndex != null ? groupIndex : null,  // NAPAS multi bank-group index (Phase 2)
      // Backward-compat aliases (used by existing flaRenderPage etc.)
      date:                date || '',
      code:                String(id || ''),
      content:             String(description || '').trim().slice(0, 200),
      bank:                bankName,
      flag:                'N/A',
    };
  }

  // ─── BIDV PARSER ─────────────────────────────────────────────────────────────
  // Columns (0-indexed): 0=empty, 1=STT, 2=Date, 3=EffDate, 4=Code,
  //   5=Debit, 6=Credit, 7=Balance, 8=SeqNo, 9=TellerID, 10=Branch, 11=Desc, 12=Ref

  function parseBIDV(rows) {
    let accountNumber = '';
    let headerIdx = findRow(rows, ['ngay giao dich', 'phat sinh'], 25);
    if (headerIdx < 0) headerIdx = findRow(rows, ['trans.date', 'debit'], 25);

    // Extract account number
    for (let i = 0; i < Math.min(20, rows.length); i++) {
      const rn = rowNorm(rows[i]);
      if (rn.includes('so tai khoan') && !rn.includes('doi ung')) {
        for (let j = 0; j < rows[i].length; j++) {
          const v = cellStr(rows[i][j]);
          if (/^\d{6,}$/.test(v)) { accountNumber = v; break; }
        }
      }
    }

    if (headerIdx < 0) return [];

    // Skip bilingual header + opening balance rows
    let dataStart = headerIdx + 2;
    while (dataStart < rows.length) {
      const n = rowNorm(rows[dataStart]);
      if (n.includes('so du dau ky') || n.includes('opening balance')) dataStart++;
      else break;
    }

    const txs = [];
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i];
      const stt = cellStr(r[1]);
      if (!stt || !/^\d+$/.test(stt)) continue;

      const debit  = parseAmount(r[5]);
      const credit = parseAmount(r[6]);
      if (debit === 0 && credit === 0) continue;

      const txType = credit > 0 ? 'IN' : 'OUT';
      const amount = credit > 0 ? credit : debit;
      const desc   = cellStr(r[11]);

      // Extract counterparty from BIDV description: "3750313384 NGUYEN TUYET LINH Ch..."
      let cpAcc = null, cpName = null;
      const dm = desc.match(/^(\d{6,})\s+([A-Z][A-Z\s]{2,40})\s/);
      if (dm) { cpAcc = dm[1]; cpName = dm[2].trim(); }

      txs.push(makeTx({
        id: stt,
        date: parseDate(r[2]),
        amount, description: desc, accountNumber,
        counterpartyAccount: cpAcc, counterpartyName: cpName,
        bankName: 'BIDV', txType, balance: r[7],
      }));
    }
    return txs;
  }

  // ─── VIETCOMBANK PARSER ──────────────────────────────────────────────────────
  // Header row contains: STT | Date-DocNo-User | AccNo | AccName | Debit | Credit | CCY | CPAcc | Desc

  function parseVCB(rows) {
    let accountNumber = '';
    let headerIdx = findRow(rows, ['ngay giao dich', 'so tien ghi no'], 25);
    if (headerIdx < 0) return [];

    const txs = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => !c)) continue;
      const stt = cellStr(r[0]);
      if (!stt || !/^\d+/.test(stt)) continue;

      if (!accountNumber) accountNumber = cellStr(r[2]);

      // Date field may be multi-line "date\ndocNo\nUser"
      const dateRaw = cellStr(r[1]).split('\n')[0].trim();
      const debit  = parseAmount(r[4]);
      const credit = parseAmount(r[5]);
      if (debit === 0 && credit === 0) continue;

      const txType = credit > 0 ? 'IN' : 'OUT';
      const amount = credit > 0 ? credit : debit;
      const cpAcc  = cellStr(r[7]) || null;
      const desc   = cellStr(r[8]);

      txs.push(makeTx({
        id: stt, date: parseDate(dateRaw || r[1]),
        amount, description: desc, accountNumber,
        counterpartyAccount: cpAcc, counterpartyName: null,
        bankName: 'Vietcombank', txType, balance: null,
      }));
    }
    return txs;
  }

  // ─── TECHCOMBANK PARSER ──────────────────────────────────────────────────────
  // Header: AccNo | Date | StmtId | TxnRef | Debit(neg) | Credit | CCY | Desc | TxnType | CPAcc

  function parseTechcombank(rows) {
    let accountNumber = '';
    let headerIdx = findRow(rows, ['so tai khoan', 'ngay gia tri'], 8);
    if (headerIdx < 0) headerIdx = findRow(rows, ['account', 'value date', 'debit'], 8);
    if (headerIdx < 0) return [];

    const txs = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => !c)) continue;
      const accNo = cellStr(r[0]);
      if (!accNo || !/\d{4,}/.test(accNo)) continue;
      if (!accountNumber) accountNumber = accNo;

      const debitRaw  = r[4];
      const creditRaw = r[5];
      let amount = 0, txType = 'OUT';

      if (creditRaw !== null && creditRaw !== undefined && creditRaw !== '') {
        const c = parseAmount(creditRaw);
        if (c > 0) { amount = c; txType = 'IN'; }
      }
      if (debitRaw !== null && debitRaw !== undefined && debitRaw !== '') {
        const d = parseAmount(debitRaw);
        if (d > 0 && txType !== 'IN') { amount = d; txType = 'OUT'; }
      }
      if (amount === 0) continue;

      const txnRef = cellStr(r[3]) || String(i);
      const desc   = cellStr(r[7]);
      const cpAcc  = cellStr(r[9]) || null;

      txs.push(makeTx({
        id: txnRef, date: parseDate(r[1]),
        amount, description: desc, accountNumber,
        counterpartyAccount: cpAcc, counterpartyName: null,
        bankName: 'Techcombank', txType, balance: null,
      }));
    }
    return txs;
  }

  // ─── VIETINBANK PARSER ───────────────────────────────────────────────────────
  // Header: STT | Date | Description | Debit | Credit | | | Balance | CPName | CPBank | RefNo

  function parseVietinbank(rows) {
    let accountNumber = '';
    let headerIdx = findRow(rows, ['mo ta giao dich', 'ten doi ung'], 35);
    if (headerIdx < 0) headerIdx = findRow(rows, ['transaction comment', 'offset name'], 35);

    // Try to find account from metadata
    for (let i = 0; i < Math.min(20, rows.length); i++) {
      const line = rowText(rows[i]);
      const m = line.match(/so tai khoan[^\d]*(\d{6,})/i) ||
                line.match(/account\s*no[^\d]*(\d{6,})/i);
      if (m) { accountNumber = m[1]; break; }
    }

    if (headerIdx < 0) return [];

    // Skip bilingual header + opening balance
    let dataStart = headerIdx + 2;
    while (dataStart < rows.length) {
      const n = rowNorm(rows[dataStart]);
      if (n.includes('so du dau ky') || n.includes('beginning balance')) dataStart++;
      else break;
    }

    const txs = [];
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const n = rowNorm(r);
      if (n.includes('so du cuoi ky') || n.includes('ending balance') || n.includes('doanh so')) break;

      const stt = cellStr(r[0]);
      if (!stt || !/^\d+$/.test(stt.trim())) continue;

      const debit  = parseAmount(r[3]);
      const credit = parseAmount(r[4]);
      if (debit === 0 && credit === 0) continue;

      const txType = credit > 0 ? 'IN' : 'OUT';
      const amount = credit > 0 ? credit : debit;
      const desc   = cellStr(r[2]);
      const cpName = cellStr(r[8]) || null;
      const cpBank = cellStr(r[9]) || null;
      const refNo  = cellStr(r[10]) || stt.trim();

      // Extract counterparty account from "NAME – A/C: 12345..."
      let cpAcc = null;
      if (cpName) {
        const am = cpName.match(/A\/C:\s*([\d]+)/i);
        if (am) cpAcc = am[1];
      }

      txs.push(makeTx({
        id: refNo, date: parseDate(r[1]),
        amount,
        description: `${desc}${cpName ? ' | ' + cpName.split('–')[0].trim() : ''}${cpBank ? ' | ' + cpBank : ''}`,
        accountNumber,
        counterpartyAccount: cpAcc, counterpartyName: cpName ? cpName.split('–')[0].trim() : null,
        bankName: 'Vietinbank', txType, balance: r[7],
      }));
    }
    return txs;
  }

  // ─── VPBANK PARSER ───────────────────────────────────────────────────────────
  // Row 0 header: MA_FT | ngay_giao_dich | tk_ghi_co | cif_ghi_co | ten_KH_ghi_co |
  //               so_tien_gd | nguyen_te | noi_dung_gd | stk_ghi_no | cif_ghi_no | ten_KH_ghi_no | ...

  function parseVPBank(rows) {
    if (rows.length < 2) return [];
    const header = rows[0].map(c => normalizeStr(cellStr(c)));

    const idx = {};
    header.forEach((h, i) => { idx[h] = i; });
    const cId      = idx['ma_ft'] ?? 0;
    const cDate    = idx['ngay_giao_dich'] ?? 1;
    const cCrAcc   = idx['tk_ghi_co'] ?? 2;
    const cCrName  = idx['ten_kh_ghi_co'] ?? 4;
    const cAmt     = idx['so_tien_gd'] ?? 5;
    const cDesc    = idx['noi_dung_gd'] ?? 7;
    const cDbAcc   = idx['stk_ghi_no'] ?? 8;
    const cDbName  = idx['ten_kh_ghi_no'] ?? 10;

    // Determine main account (most frequent in credit/debit columns)
    const freq = {};
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const ca = cellStr(r[cCrAcc]); if (ca) freq[ca] = (freq[ca] || 0) + 1;
      const da = cellStr(r[cDbAcc]); if (da) freq[da] = (freq[da] || 0) + 1;
    }
    const accountNumber = Object.entries(freq).sort((a,b) => b[1]-a[1])[0]?.[0] || '';

    const txs = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => !c)) continue;
      const txId = cellStr(r[cId]);
      if (!txId) continue;

      const crAcc = cellStr(r[cCrAcc]);
      const dbAcc = cellStr(r[cDbAcc]);
      const amount = parseAmount(r[cAmt]);
      if (amount === 0) continue;

      let txType = 'IN', cpAcc = null, cpName = null;
      if (crAcc === accountNumber) {
        txType = 'IN'; cpAcc = dbAcc || null; cpName = cellStr(r[cDbName]) || null;
      } else if (dbAcc === accountNumber) {
        txType = 'OUT'; cpAcc = crAcc || null; cpName = cellStr(r[cCrName]) || null;
      } else {
        txType = 'IN'; cpAcc = dbAcc || null; cpName = cellStr(r[cDbName]) || null;
      }

      txs.push(makeTx({
        id: txId, date: parseDate(r[cDate]),
        amount, description: cellStr(r[cDesc]), accountNumber,
        counterpartyAccount: cpAcc, counterpartyName: cpName,
        bankName: 'VPBank', txType, balance: null,
      }));
    }
    return txs;
  }

  // ─── EXIMBANK PARSER ─────────────────────────────────────────────────────────
  // Row 0: SOL_ID | CIF_ID | FORACID | ACCT_NAME | TRAN_DATE | VALUE_DATE |
  //        TRAN_ID | CCY | PHAT_SINH_NO | PHAT_SINH_CO | ...

  function parseEximbank(rows) {
    let accountNumber = '';
    const txs = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => !c)) continue;

      const accNo  = cellStr(r[2]);
      const txId   = cellStr(r[6]) || String(i);
      const debit  = parseAmount(r[8]);
      const credit = parseAmount(r[9]);
      if (!accountNumber && accNo) accountNumber = accNo;
      if (debit === 0 && credit === 0) continue;

      const txType = credit > 0 ? 'IN' : 'OUT';
      const amount = credit > 0 ? credit : debit;
      const extra  = r.slice(10).map(cellStr).filter(Boolean).join(' | ');
      const desc   = cellStr(r[3]) + (extra ? ' | ' + extra : '');

      txs.push(makeTx({
        id: txId, date: parseDate(r[4]),
        amount, description: desc, accountNumber,
        counterpartyAccount: null, counterpartyName: null,
        bankName: 'Eximbank', txType, balance: null,
      }));
    }
    return txs;
  }

  // ─── SACOMBANK PARSER ────────────────────────────────────────────────────────
  // Row 0: machine-readable uppercase headers. Data starts at row 1.
  // Uses findColumnMapping for robustness against column reordering.

  function parseSacombank(rows) {
    if (rows.length < 2) return [];

    // Primary: map by exact column name from row 0
    const exactIdx = {};
    (rows[0] || []).forEach((c, i) => { exactIdx[cellStr(c).trim()] = i; });

    // Fallback: use findColumnMapping for fuzzy match
    const colMap = findColumnMapping(rows[0]);

    const cAcct   = exactIdx['ACCT_ID']           ?? colMap.account      ?? 2;
    const cTxId   = exactIdx['TRANSACTION_ID']     ?? colMap.txId         ?? 3;
    const cDebit  = exactIdx['DEBIT_AMT']          ?? colMap.debit        ?? 4;
    const cCredit = exactIdx['CREDIT_AMT']         ?? colMap.credit       ?? 5;
    const cNarr   = exactIdx['NARRATIVE']          ?? colMap.description  ?? 6;
    const cDate   = exactIdx['VALUE_DT']           ?? colMap.date         ?? 7;
    const cCpAcct = exactIdx['TK_DU_LNH']          ?? colMap.cpAccount    ?? 9;
    const cCpName = exactIdx['CUSTOMER_NAME_DU']   ?? colMap.cpName       ?? 11;

    let accountNumber = '';
    const txs = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => !c)) continue;

      const acctRaw = cellStr(r[cAcct]);
      if (!accountNumber && acctRaw) accountNumber = acctRaw;

      const debit  = parseAmount(r[cDebit]);
      const credit = parseAmount(r[cCredit]);
      if (debit === 0 && credit === 0) continue;

      const txType = credit > 0 ? 'IN' : 'OUT';
      const amount = credit > 0 ? credit : debit;

      txs.push(makeTx({
        id:                  cellStr(r[cTxId]) || String(i),
        date:                parseDate(r[cDate]),
        amount,
        description:         cellStr(r[cNarr]),
        accountNumber:       acctRaw || accountNumber,
        counterpartyAccount: cellStr(r[cCpAcct]) || null,
        counterpartyName:    cellStr(r[cCpName]) || null,
        bankName:            'Sacombank',
        txType,
        balance:             null,
      }));
    }
    return txs;
  }

  // ─── MB BANK PARSER ───────────────────────────────────────────────────────────
  // Header block rows 0-13 (title + metadata); VN col headers at ~row 15, EN at ~row 16.
  // Uses findHeaderRow + findColumnMapping so row offsets are discovered dynamically.

  function parseMBBank(rows) {
    // ── Extract account number: scan all cells in rows 0-15 ──────────────────
    let accountNumber = '';
    for (let i = 0; i < Math.min(16, rows.length) && !accountNumber; i++) {
      for (let j = 0; j < (rows[i] || []).length; j++) {
        const v = cellStr(rows[i][j]);
        if (!v) continue;
        const m = v.match(/Account\s*No\s*[:\s]+(\d{6,})/i)
               || v.match(/Tai khoan[^\d]*(\d{6,})/i)
               || v.match(/So TK[^\d]*(\d{6,})/i);
        if (m) { accountNumber = m[1].trim(); break; }
      }
    }

    // ── Find VN header row: contains "Phát sinh nợ" + "Phát sinh có" ────────
    let vnHdrIdx = findRow(rows, ['phat sinh no', 'phat sinh co', 'so but toan'], 20);
    if (vnHdrIdx < 0) vnHdrIdx = findRow(rows, ['phat sinh no', 'phat sinh co'], 20);
    if (vnHdrIdx < 0) {
      // Fallback: use findHeaderRow to locate the best header row
      vnHdrIdx = findHeaderRow(rows, 25);
    }
    if (vnHdrIdx < 0) return [];

    // Use column mapping from the VN header row
    const colMap = findColumnMapping(rows[vnHdrIdx]);

    // MB Bank-specific hard column positions (confirmed from real file audit):
    // 0=Date, 1=TxNo, 3=Debit, 4=Credit, 5=Description, 8=CpName, 11=CpAccount, 12=CpBank
    const cDate    = colMap.date    >= 0 ? colMap.date    : 0;
    const cTxId    = colMap.txId    >= 0 ? colMap.txId    : 1;
    const cDebit   = colMap.debit   >= 0 ? colMap.debit   : 3;
    const cCredit  = colMap.credit  >= 0 ? colMap.credit  : 4;
    const cDesc    = colMap.description >= 0 ? colMap.description : 5;
    const cCpName  = colMap.cpName  >= 0 ? colMap.cpName  : 8;
    const cCpAcct  = colMap.cpAccount >= 0 ? colMap.cpAccount : 11;

    // Skip the bilingual header row (EN version follows VN row)
    const dataStart = vnHdrIdx + 2;

    const txs = [];
    for (let i = dataStart; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => !c)) continue;

      // Stop at footer (total row or closing balance)
      const rn = rowNorm(r);
      if (rn.includes('tong phat sinh') || rn.includes('closing balance') || rn.includes('so du cuoi')) break;

      // Date column must contain DD/MM/YYYY
      const dateRaw = cellStr(r[cDate]);
      if (!dateRaw || !/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateRaw)) continue;

      const debit  = r[cDebit]  != null ? parseAmount(r[cDebit])  : 0;
      const credit = r[cCredit] != null ? parseAmount(r[cCredit]) : 0;
      if (debit === 0 && credit === 0) continue;

      const txType = credit > 0 ? 'IN' : 'OUT';
      const amount = credit > 0 ? credit : debit;

      txs.push(makeTx({
        id:                  cellStr(r[cTxId]) || String(i),
        date:                parseDate(dateRaw),
        amount,
        description:         cellStr(r[cDesc]),
        accountNumber,
        counterpartyAccount: cellStr(r[cCpAcct]) || null,
        counterpartyName:    cellStr(r[cCpName])  || null,
        bankName:            'MB Bank',
        txType,
        balance:             null,
      }));
    }
    return txs;
  }

  // ─── AGRIBANK PARSER ─────────────────────────────────────────────────────────
  // Metadata rows 0–8; column headers at row 9 (discovered via findHeaderRow).
  // STT | Ngày GD | Ghi nợ | Ghi có | Người PL | STK ĐU | NH ĐU | ND GD

  function parseAgribank(rows) {
    // ── Extract account number from metadata block (rows 0-8) ────────────────
    let accountNumber = '';
    for (let i = 0; i < Math.min(9, rows.length) && !accountNumber; i++) {
      const rn = rowNorm(rows[i]);
      if (rn.includes('so tai khoan') || rn.includes('tai khoan')) {
        const rowStr = rowText(rows[i]);
        const m = rowStr.match(/(\d{8,})/);
        if (m) { accountNumber = m[1]; continue; }
      }
      // Also pick up standalone long digit cell anywhere in the row
      for (let j = 0; j < (rows[i] || []).length; j++) {
        const v = cellStr(rows[i][j]);
        if (/^\d{9,}$/.test(v)) { accountNumber = v; break; }
      }
    }

    // ── Find header row (dynamic — not hardcoded to row 9) ───────────────────
    let headerIdx = findRow(rows, ['ngay giao dich', 'noi dung giao dich'], 20);
    if (headerIdx < 0) headerIdx = findRow(rows, ['so tien ghi no', 'so tien ghi co'], 20);
    if (headerIdx < 0) headerIdx = findHeaderRow(rows, 20);
    if (headerIdx < 0) return [];

    // Use column mapping from header row
    const colMap = findColumnMapping(rows[headerIdx]);
    // Agribank confirmed columns: 0=STT, 1=Date, 2=Debit, 3=Credit, 4=CpName, 5=CpAcct, 6=CpBank, 7=Desc
    const cStt    = 0;
    const cDate   = colMap.date        >= 0 ? colMap.date        : 1;
    const cDebit  = colMap.debit       >= 0 ? colMap.debit       : 2;
    const cCredit = colMap.credit      >= 0 ? colMap.credit      : 3;
    const cCpName = colMap.cpName      >= 0 ? colMap.cpName      : 4;
    const cCpAcct = colMap.cpAccount   >= 0 ? colMap.cpAccount   : 5;
    const cCpBank = colMap.cpBank      >= 0 ? colMap.cpBank      : 6;
    const cDesc   = colMap.description >= 0 ? colMap.description : 7;

    const txs = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => !c)) continue;

      // Stop at footer signatures
      const rn = rowNorm(r);
      if (rn.includes('lap bieu') || rn.includes('giam doc') || rn.includes('ke toan truong') || rn.includes('ke toan')) break;

      // STT must be a number
      const stt = cellStr(r[cStt]);
      if (!stt || !/^\d+\.?\d*$/.test(stt.trim())) continue;

      const dateRaw = cellStr(r[cDate]);
      if (!dateRaw || !/\d{1,2}\/\d{1,2}\/\d{4}/.test(dateRaw)) continue;

      const debit  = parseAmount(r[cDebit]);
      const credit = parseAmount(r[cCredit]);
      if (debit === 0 && credit === 0) continue;

      const txType = credit > 0 ? 'IN' : 'OUT';
      const amount = credit > 0 ? credit : debit;
      const cpBank = cellStr(r[cCpBank]) || null;
      const cpAcct = cellStr(r[cCpAcct]).replace(/\s+/g, '') || null;
      const cpName = cellStr(r[cCpName]) || null;
      const desc   = cellStr(r[cDesc]);

      txs.push(makeTx({
        id:                  `AGR_${dateRaw.replace(/\//g,'')}_${stt.trim()}`,
        date:                parseDate(dateRaw),
        amount,
        description:         desc + (cpBank ? ' | ' + cpBank : ''),
        accountNumber,
        counterpartyAccount: cpAcct && /\d{4,}/.test(cpAcct) ? cpAcct : null,
        counterpartyName:    cpName || null,
        bankName:            'Agribank',
        txType,
        balance:             null,
      }));
    }
    return txs;
  }

  // ─── NAPAS BANK IDENTITY NORMALIZATION ───────────────────────────────────────
  // Raw bank-name text (from NAPAS metadata lines and the per-row Ngân hàng
  // chuyển/nhận columns) has multiple spellings for the same real bank
  // (docs/NAPAS_UPGRADE_SPEC.md §4.B — e.g. VPBank, PVcomBank). This registry
  // is a WHITELIST built only from strings actually observed: the 9 raw
  // metadata-line strings behind the existing bank-statement parsers' own
  // canonical labels (reused as-is, so a NAPAS transaction at e.g. Vietcombank
  // normalizes to the same 'Vietcombank' label a direct VCB statement upload
  // would use) plus every one of the 47 distinct raw bank-name strings found
  // by scanning the "Ngân hàng chuyển"/"Ngân hàng nhận" columns of real
  // transaction rows across all 27 sample NAPAS files. Multi-alias groups
  // (more than one raw string mapped to the same id) were only created where
  // more than one distinct raw spelling was actually observed for that real
  // bank — never invented. Matching is EXACT string equality after
  // normalizeStr() (case/diacritic/whitespace-insensitive) — never substring
  // matching, because e.g. "Ngân hàng TMCP Sài Gòn" (SCB) and "Ngân hàng
  // TMCP Sài Gòn Thương Tín" (Sacombank) share the words "Sài Gòn" but are
  // two different real banks (spec §4.B) — a substring match would wrongly
  // merge them. Anything not in this list normalizes to `null` (UNKNOWN
  // identity) rather than being guessed at.
  const NAPAS_BANK_ALIASES = [
    // Reused from the 9 existing bank-statement parsers' own canonical labels.
    { id: 'BIDV',        aliases: ['Ngân hàng TMCP Đầu tư và Phát triển Việt Nam'] },
    { id: 'Vietcombank', aliases: ['Ngân hàng TMCP Ngoại Thương Việt Nam'] },
    { id: 'Techcombank', aliases: ['Ngân hàng TMCP Kỹ Thương Việt Nam'] },
    { id: 'Vietinbank',  aliases: ['Ngân hàng TMCP Công Thương Việt Nam'] },
    { id: 'VPBank',      aliases: [
        'Ngân hàng Thương Mại Cổ Phần Việt Nam Thịnh Vượng',
        'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)',
    ] },
    { id: 'Eximbank',    aliases: ['Ngân hàng TMCP Xuất Nhập Khẩu'] },
    { id: 'Sacombank',   aliases: ['Ngân hàng TMCP Sài Gòn Thương Tín'] },
    { id: 'Agribank',    aliases: ['Ngân hàng Nông Nghiệp và Phát Triển Nông Thôn Việt Nam'] },
    { id: 'MB Bank',     aliases: ['Ngân hàng TMCP Quân Đội'] },
    // NAPAS-only banks (not covered by any of the 9 bank-statement parsers) —
    // canonical id chosen as the bank's well-known short name; this labeling
    // is a display/cosmetic choice only — correctness depends solely on
    // which raw strings are grouped together, not on the exact id spelling.
    { id: 'ACB',      aliases: ['Ngân hàng TMCP Á Châu'] },
    { id: 'OCB',      aliases: [
        'Ngân hàng TMCP Phương Đông',
        'Ngân hàng số Liobank - Đơn vị trực thuộc Ngân hàng TMCP Phương Đông (OCB)',
    ] },
    { id: 'BacABank',                  aliases: ['Ngân hàng TMCP Bắc Á'] },
    { id: 'TPBank',                    aliases: ['Ngân hàng TMCP Tiên Phong'] },
    { id: 'MSB',                       aliases: ['Ngân hàng TMCP Hàng Hải'] },
    { id: 'VIB',                       aliases: ['Ngân hàng TMCP Quốc Tế Việt Nam'] },
    { id: 'SHB',                       aliases: ['Ngân hàng TMCP Sài Gòn Hà Nội'] },
    { id: 'NamABank',                  aliases: ['Ngân hàng TMCP Nam Á'] },
    { id: 'LPBank',                    aliases: ['Ngân hàng TMCP Lộc Phát Việt Nam'] },
    { id: 'HDBank',                    aliases: ['Ngân hàng TMCP Phát Triển TP Hồ Chí Minh'] },
    { id: 'BVBank', aliases: [
        'Ngân hàng TMCP Bản Việt',
        'Ngân hàng TMCP Bản Việt – Timo by Ban Viet Bank',
    ] },
    { id: 'KienLongBank',              aliases: ['Ngân hàng TMCP Kiên Long'] },
    { id: 'Shinhan Bank Vietnam',      aliases: ['Ngân hàng Trách Nhiệm Hữu Hạn Một Thành Viên SHINHAN Việt Nam'] },
    { id: 'NCB',                       aliases: ['Ngân hàng TMCP Quốc Dân'] },
    { id: 'PGBank',                    aliases: ['Ngân hàng TMCP Thịnh vượng và Phát triển'] },
    { id: 'ABBank',                    aliases: ['Ngân hàng TMCP An Bình'] },
    { id: 'SeABank',                   aliases: ['Ngân hàng TMCP Đông Nam Á'] },
    { id: 'PVcomBank', aliases: [
        'NH TMCP Đại Chúng Việt Nam',
        'Ngân hàng TMCP Đại Chúng Việt Nam - PVcomBank Pay',
    ] },
    { id: 'Co-opBank',                 aliases: ['Ngân hàng Hợp Tác Xã Việt Nam'] },
    { id: 'DongABank',                 aliases: ['Ngân hàng TMCP Đông Á'] },
    { id: 'Woori Bank Vietnam',        aliases: ['Ngân hàng TNHH Một Thành Viên Woori Việt Nam'] },
    { id: 'Saigonbank',                aliases: ['Ngân hàng TMCP Sài Gòn Công Thương'] },
    { id: 'VBSP',                      aliases: ['Ngân hàng chính sách xã hội'] },
    { id: 'Standard Chartered Vietnam', aliases: ['Ngân hàng TNHH Một Thành Viên Standard Chartered(Việt Nam)'] },
    { id: 'OceanBank',                 aliases: ['Ngân hàng TM TNHH Một Thành Viên Đại Dương'] },
    { id: 'VietBank',                  aliases: ['Ngân hàng TMCP Việt Nam Thương Tín'] },
    { id: 'MoMo',                      aliases: ['Công ty cổ phần dịch vụ di động trực tuyến (MOMO)'] },
    { id: 'Indovina Bank',             aliases: ['Ngân hàng TNHH Indovina'] },
    { id: 'VietABank',                 aliases: ['Ngân hàng TMCP Việt Á'] },
    { id: 'BaoVietBank',               aliases: ['Ngân hàng Thương Mại Cổ Phần Bảo Việt(BAOVIET BANK)'] },
    { id: 'SCB',                       aliases: ['Ngân hàng TMCP Sài Gòn'] }, // distinct from Sacombank — never merge
    { id: 'Public Bank Vietnam',       aliases: ['Ngân hàng trách nhiệm hữu hạn Một Thành Viên Public Việt Nam'] },
    { id: 'HSBC Vietnam',              aliases: ['Ngân Hàng Trách Nhiệm Hữu Hạn Một Thành Viên HSBC Việt Nam'] },
    { id: 'NAPAS-ECOM',                aliases: ['NAPAS-ECOM'] },
  ];

  let _napasBankAliasIndex = null;
  function _napasBankAliasIndexBuild() {
    const idx = new Map();
    for (const entry of NAPAS_BANK_ALIASES) {
      for (const alias of entry.aliases) idx.set(normalizeStr(alias), entry.id);
    }
    return idx;
  }

  // Returns the canonical bank id for a raw bank-name string, or `null` if
  // the raw string is not a known alias (never guessed/fuzzy-matched).
  function normalizeBankName(rawName) {
    const raw = cellStr(rawName);
    if (!raw) return null;
    if (!_napasBankAliasIndex) _napasBankAliasIndex = _napasBankAliasIndexBuild();
    return _napasBankAliasIndex.get(normalizeStr(raw)) || null;
  }

  // ─── NAPAS PARSER ─────────────────────────────────────────────────────────────
  // Sheet "KET QUA TIM KIEM" — an interbank TRACING export (công văn
  // CV-NAPAS.KSTT), not a single-bank statement. A metadata block
  // ("Tên ngân hàng chuyển/nhận: <bank>" + "Tài khoản nguồn/đích: <acct>")
  // declares which bank/account a following run of transaction rows belongs
  // to; every transaction row carries BOTH sides (Thẻ/TK nguồn + đích, Ngân
  // hàng chuyển + nhận), so direction/counterparty are resolved from that
  // metadata, never from the CHUYEN/NHAN filename suffix. Full findings:
  // docs/NAPAS_UPGRADE_SPEC.md.
  //
  // MULTI-GROUP (Phase 2): a NAPAS file may legally contain several metadata
  // blocks — the same account traced across multiple banks within one file
  // (spec §4.E), and CHUYEN/NHAN of the same case can have a DIFFERENT
  // number of groups (verified on 979494_9999: 2 groups CHUYEN, 1 group
  // NHAN — not a bug, no group-count symmetry is assumed anywhere here).
  // Each metadata block's own bank/account/direction is carried by every
  // transaction row scanned within that block's row range (own account and
  // bank of group N+1 are NEVER applied to a transaction physically located
  // in group N's row range, even if two groups happen to share the same
  // account number). Group boundaries come only from where each metadata
  // block actually sits in the file — never a fixed row count, never the
  // filename, never an assumption that every group has the same size.
  //
  // Counterparty NAME resolution (CONFIRMED/INFERRED/AMBIGUOUS/UNKNOWN tiers,
  // spec §6) is implemented as of Phase 4 — see resolveCounterparty() below,
  // which is wired into parseNapasGroupTransactions().

  const NAPAS_BANK_META_RE = /^Tên ngân hàng (chuyển|nhận):\s*(.+)$/i;
  const NAPAS_ACCT_META_RE = /^Tài khoản (nguồn|đích):\s*(.+)$/i;

  // Scans every cell of one row for the first match of `re` (column-position
  // agnostic — metadata text has been observed only in one column, but this
  // does not hardcode that, consistent with e.g. the BIDV/Agribank parsers).
  function napasMatchRowCell(row, re) {
    if (!row) return null;
    for (const cell of row) {
      const v = cellStr(cell);
      if (v) {
        const m = v.match(re);
        if (m) return m;
      }
    }
    return null;
  }

  function napasFindMeta(rows, re) {
    const hits = [];
    for (let i = 0; i < rows.length; i++) {
      const m = napasMatchRowCell(rows[i], re);
      if (m) hits.push({ row: i, match: m });
    }
    return hits;
  }

  // "Giờ GD" is an integer hhmmss with no ':' separator, sometimes missing
  // its leading zero (e.g. 94149 = 09:41:49) — zero-pad before splitting.
  function napasTime(v) {
    if (v === null || v === undefined || v === '') return '00:00:00';
    const s = String(Math.trunc(Number(v))).padStart(6, '0');
    if (!/^\d{6}$/.test(s)) return '00:00:00';
    return `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4, 6)}`;
  }

  // ─── NAPAS COUNTERPARTY RESOLVER ──────────────────────────────────────────────
  // NAPAS has no counterparty-name column — it must be inferred from the free-
  // text "Nội dung chuyển", with an explicit confidence tier so a guess is
  // never presented as a fact (docs/NAPAS_UPGRADE_SPEC.md §6/§7, Phase 4).
  //
  // CRITICAL, evidence-corrected finding (Phase 4 — supersedes an earlier,
  // too-optimistic reading of the same evidence during Discovery): on the
  // CHUYEN (OUT) side, "<NAME> chuyen tien"-style content overwhelmingly
  // names the OWN account holder, not the counterparty — verified by
  // scanning 9 real files (2,700+ matched rows): e.g. in
  // 070136_7131_..._CHUYEN.xlsx, 4974/5114 matches (97%) are the SAME name
  // ("NGUYEN VAN TUNG") repeated across thousands of DIFFERENT counterparty
  // accounts; 371010_5678_..._CHUYEN.xlsx and 979494_9999_..._CHUYEN.xlsx
  // were 100% one name each (1354/1354 and 790/790). On the NHAN (IN) side,
  // the same shaped content genuinely varies WITH the counterparty account
  // (e.g. 371010_5678_..._NHAN.xlsx: 174 distinct names across 588 matches,
  // each tied to a different sender account) — a real, usable signal. For
  // this reason Tier 2 (INFERRED) below is gated to `transactionType==='IN'`
  // only; it is never applied on the OUT side.
  //
  // Tier 1 (CONFIRMED) does not have this direction restriction, because the
  // Vietcombank "MBVCB" narrative encodes BOTH sender and receiver (account +
  // name) explicitly, so the correct side is picked by transaction direction
  // and then cross-checked against the already column-resolved
  // accountNumber/counterpartyAccount — verified against 218 real
  // occurrences across 9 files, 0 cross-check mismatches found.

  // Exact strings observed in real data that explicitly declare "no content
  // was recorded" — never attempt name extraction from these.
  const NAPAS_NO_CONTENT_PHRASES = ['KO GHI NOI DUNG CHUYEN KHOAN'];

  // Tier 1 (CONFIRMED): "MBVCB.<id>.<id>.<name> chuyen tien.CT tu <acc> <name>
  // toi <acc> <name> tai <bank>" — captures (senderAcc, senderName,
  // receiverAcc, receiverName, bank). Never take the raw text after "CT tu"
  // as a whole — always these 4 precisely bounded groups.
  const NAPAS_MBVCB_RE = /^MBVCB\.\d+\.\d+\..+?\.CT tu (\S+)\s+(.+?)\s+toi\s+(\S+)\s+(.+?)\s+tai\s+(.+)$/;

  // Tier 2 (INFERRED), NHAN-only: "[IBFT ]<2-5 word name> chuyen tien|chuyen
  // khoan|chuyen tien ho[...]" — covers the MB/ACB/Techcombank/VPBank-group/
  // MoMo per-bank templates catalogued in spec §6, which all share this
  // leading-name-plus-verb-phrase shape regardless of source bank.
  const NAPAS_INFERRED_NAME_RE = /^(?:IBFT\s+)?([A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+){1,4})\s+(?:chuyen tien|chuyen khoan|chuyen tien ho)\b/i;

  // Tier 3 (AMBIGUOUS): short, letters-only, name-shaped fragment (spec §6:
  // 'An', 'Minh', 'Ainh', 'An M') that matched no structural pattern above.
  // Never contains digits — a real Vietnamese given name doesn't, and this
  // keeps opaque codes (e.g. 'GQ77P2URU97LROO90THF') out of this tier.
  const NAPAS_AMBIGUOUS_RE = /^[A-Za-zÀ-ỹ]+(?:\s+[A-Za-zÀ-ỹ]+){0,2}$/;

  /**
   * Resolves the counterparty NAME for one transaction from its free-text
   * content — never its account/bank, which are already resolved from
   * dedicated columns and are not touched here (spec §16).
   * @param {{description, transactionType, accountNumber, counterpartyAccount}} tx
   * @returns {{ name, confidence, source, evidence }}
   *   name: extracted string, or null (null unless confidence==='CONFIRMED'
   *         or 'INFERRED' — AMBIGUOUS/UNKNOWN never populate a name)
   *   confidence: 'CONFIRMED' | 'INFERRED' | 'AMBIGUOUS' | 'UNKNOWN'
   *   source: which pattern matched, for traceability, or null
   *   evidence: the exact content string the result is based on, or null
   */
  function resolveCounterparty(tx) {
    const content = cellStr(tx && tx.description);
    if (!content) return { name: null, confidence: 'UNKNOWN', source: 'empty_content', evidence: null };

    const contentNorm = normalizeStr(content);
    if (NAPAS_NO_CONTENT_PHRASES.some(p => contentNorm === normalizeStr(p))) {
      return { name: null, confidence: 'UNKNOWN', source: 'explicit_no_content', evidence: content };
    }

    // Tier 1 — CONFIRMED (direction-aware, cross-checked against columns)
    const mb = content.match(NAPAS_MBVCB_RE);
    if (mb) {
      const [, senderAcc, senderName, receiverAcc, receiverName] = mb;
      if (tx.transactionType === 'OUT' && senderAcc === tx.accountNumber && receiverAcc === tx.counterpartyAccount) {
        return { name: receiverName.trim(), confidence: 'CONFIRMED', source: 'MBVCB', evidence: content };
      }
      if (tx.transactionType === 'IN' && receiverAcc === tx.accountNumber && senderAcc === tx.counterpartyAccount) {
        return { name: senderName.trim(), confidence: 'CONFIRMED', source: 'MBVCB', evidence: content };
      }
      // Pattern matched but direction/account cross-check failed — do not
      // force CONFIRMED; fall through to the weaker tiers below.
    }

    // Tier 2 — INFERRED, NHAN (IN) side only — see header comment for why.
    if (tx.transactionType === 'IN') {
      const nm = content.match(NAPAS_INFERRED_NAME_RE);
      if (nm) {
        return { name: nm[1].trim(), confidence: 'INFERRED', source: 'name_plus_verb_phrase', evidence: content };
      }
    }

    // Tier 3 — AMBIGUOUS: plausible-looking but not trusted as a name.
    if (content.length <= 30 && NAPAS_AMBIGUOUS_RE.test(content)) {
      return { name: null, confidence: 'AMBIGUOUS', source: 'short_name_like_fragment', evidence: content };
    }

    // Tier 4 — UNKNOWN: no identifiable name signal.
    return { name: null, confidence: 'UNKNOWN', source: null, evidence: null };
  }

  // Builds one entry per metadata block found anywhere in the file, in the
  // order they appear (→ groupIndex 0, 1, 2, ...). Each block's account line
  // ("Tài khoản nguồn/đích: ...") has been confirmed, on every metadata
  // block observed across all 27 sample files (12 multi-group blocks among
  // them), to sit on the row IMMEDIATELY AFTER its bank-name line — this is
  // relied on as a deterministic structural rule, not a fuzzy search: if a
  // bank-name block is ever found without a matching account line on the
  // very next row, that is treated as an unrecognized/changed file format
  // and rejected (thrown), never guessed at.
  function napasBuildGroups(rows) {
    const bankMeta = napasFindMeta(rows, NAPAS_BANK_META_RE);
    if (bankMeta.length === 0) {
      throw new Error('NAPAS: không tìm thấy khối metadata (Tên ngân hàng chuyển/nhận) — không đủ dữ liệu để xác định tài khoản đang điều tra.');
    }

    const groups = [];
    for (let g = 0; g < bankMeta.length; g++) {
      const bm = bankMeta[g];
      const am = napasMatchRowCell(rows[bm.row + 1], NAPAS_ACCT_META_RE);
      if (!am) {
        throw new Error(`NAPAS: nhóm ${g + 1} (dòng Excel ${bm.row + 1}, "Tên ngân hàng...") không có dòng "Tài khoản nguồn/đích:" ngay sau đó — cấu trúc file khác với định dạng đã xác nhận (docs/NAPAS_UPGRADE_SPEC.md §2/§4.E). Dừng thay vì đoán.`);
      }
      groups.push({
        groupIndex:    g,
        direction:     bm.match[1].toLowerCase() === 'chuyển' ? 'CHUYEN' : 'NHAN',
        bankName:      bm.match[2].trim(),
        accountNumber: am[2].trim(),
        // Row range this group owns: from its own metadata block up to (but
        // excluding) the next group's metadata block, or end of file for the
        // last group. Non-transaction rows inside this range (the metadata
        // rows themselves, the "Tổng số giao dịch phát sinh theo..." subtotal
        // footer, the trailing signature block) are filtered out below by
        // row shape, not by trimming the range further here.
        rowStart: bm.row,
        rowEnd:   g + 1 < bankMeta.length ? bankMeta[g + 1].row : rows.length,
      });
    }
    return groups;
  }

  // Parses the transaction rows belonging to exactly one group — never reads
  // outside [group.rowStart, group.rowEnd), so a transaction physically
  // inside group N's range can only ever be tagged with group N's own
  // account/bank/direction, regardless of what other groups declare.
  function parseNapasGroupTransactions(rows, group) {
    const { direction, bankName: ownBankName, accountNumber: ownAccountNumber, groupIndex, rowStart, rowEnd } = group;

    // Fixed column layout confirmed across all 27 sample NAPAS files (spec §2/§5):
    // 1=STT, 2=Thẻ/TK nguồn, 3=Thẻ/TK đích, 4=Ngày GD, 5=Giờ GD, 6=Số tiền,
    // 7=Số Trace, 8=Số REF, 9=Mã thiết bị (unreliable — never used, spec §4.B),
    // 10=Ngân hàng chuyển, 11=Ngân hàng nhận, 12=Nội dung chuyển, 13=Cấp đệ quy.
    const txs = [];
    for (let i = rowStart; i < rowEnd; i++) {
      const r = rows[i];
      if (!r) continue;

      const stt     = cellStr(r[1]);
      const dateRaw = cellStr(r[4]);
      // A real transaction row is the only row type with BOTH a numeric STT
      // AND a dd/mm/yyyy date. This excludes this group's own metadata rows
      // ("Tên ngân hàng..."/"Tài khoản..."), the "Tổng số giao dịch phát
      // sinh theo..." subtotal footer, and (for the last group) the trailing
      // signature block ("Người lập biểu"/"Lãnh đạo phòng" + names).
      if (!/^\d+$/.test(stt) || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateRaw)) continue;

      const amount = parseAmount(r[6]);
      if (amount === 0) continue;

      const srcAcct    = cellStr(r[2]);
      const dstAcct    = cellStr(r[3]);
      const bankChuyen = cellStr(r[10]);
      const bankNhan   = cellStr(r[11]);

      let txType, counterpartyAccount, counterpartyBankName;
      if (direction === 'CHUYEN') {
        txType = 'OUT';
        counterpartyAccount  = dstAcct || null;
        counterpartyBankName = bankNhan || null;
        if (srcAcct && srcAcct !== ownAccountNumber) {
          console.warn('[BankParser][NAPAS] Nhóm', groupIndex, 'STT', stt, ': Thẻ/TK nguồn khác Tài khoản nguồn khai báo ở metadata:', srcAcct, 'vs', ownAccountNumber);
        }
      } else {
        txType = 'IN';
        counterpartyAccount  = srcAcct || null;
        counterpartyBankName = bankChuyen || null;
        if (dstAcct && dstAcct !== ownAccountNumber) {
          console.warn('[BankParser][NAPAS] Nhóm', groupIndex, 'STT', stt, ': Thẻ/TK đích khác Tài khoản đích khai báo ở metadata:', dstAcct, 'vs', ownAccountNumber);
        }
      }

      const refId = cellStr(r[8]) || cellStr(r[7]) || String(i);
      const description = cellStr(r[12]);

      // Counterparty NAME resolution (Phase 4) — pure function, needs only
      // the fields already resolved above; never touches
      // counterpartyAccount/counterpartyBankName themselves (spec §16).
      const resolved = resolveCounterparty({
        description, transactionType: txType,
        accountNumber: ownAccountNumber, counterpartyAccount,
      });

      txs.push(makeTx({
        id: refId,
        date: `${dateRaw} ${napasTime(r[5])}`,
        amount,
        description,
        accountNumber: ownAccountNumber,
        counterpartyAccount,
        counterpartyName: resolved.name,
        bankName: ownBankName,
        txType,
        balance: null,
        counterpartyBankName,
        counterpartyNameConfidence: resolved.confidence,
        sourceFormat: 'NAPAS',
        groupIndex,
      }));
    }
    return txs;
  }

  function parseNapas(rows) {
    // Header row located dynamically once (keyword match, not a hardcoded
    // row number) — the 14-column layout is identical for every group in
    // the file, so this is looked up a single time, not per group.
    const headerIdx = findRow(rows, ['ngay gd', 'gio gd', 'so tien'], 15);
    if (headerIdx < 0) return [];

    const groups = napasBuildGroups(rows);

    let txs = [];
    for (const group of groups) {
      txs = txs.concat(parseNapasGroupTransactions(rows, group));
    }
    return txs;
  }

  // ─── GENERIC FALLBACK PARSER ─────────────────────────────────────────────────

  function parseGeneric(rows) {
    const kwGroups = [
      ['ngay', 'so tien', 'noi dung'],
      ['ngay giao dich', 'ghi no', 'ghi co'],
      ['date', 'amount', 'description'],
      ['date', 'debit', 'credit'],
    ];

    let headerIdx = -1;
    for (const kws of kwGroups) {
      headerIdx = findRow(rows, kws, 30);
      if (headerIdx >= 0) break;
    }
    if (headerIdx < 0) return [];

    const hdr = rows[headerIdx].map(c => normalizeStr(cellStr(c)));
    let cDate=-1, cDebit=-1, cCredit=-1, cDesc=-1, cBal=-1;
    hdr.forEach((h, i) => {
      if (cDate<0 && (h.includes('ngay') || h.includes('date'))) cDate=i;
      if (h.includes('ghi no') || h.includes('phat sinh no') || h.includes('debit')) cDebit=i;
      if (h.includes('ghi co') || h.includes('phat sinh co') || h.includes('credit')) cCredit=i;
      if (h.includes('noi dung') || h.includes('dien giai') || h.includes('mo ta') || h.includes('desc')) cDesc=i;
      if (h.includes('so du') || h.includes('balance')) cBal=i;
    });

    const txs = [];
    for (let i = headerIdx+1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every(c => !c)) continue;
      const debit  = cDebit>=0 ? parseAmount(r[cDebit]) : 0;
      const credit = cCredit>=0 ? parseAmount(r[cCredit]) : 0;
      if (debit===0 && credit===0) continue;
      const txType = credit>0 ? 'IN' : 'OUT';
      const amount = credit>0 ? credit : debit;
      txs.push(makeTx({
        id: String(i),
        date: cDate>=0 ? parseDate(r[cDate]) : '',
        amount,
        description: cDesc>=0 ? cellStr(r[cDesc]) : '',
        accountNumber: '',
        counterpartyAccount: null, counterpartyName: null,
        bankName: 'Unknown', txType,
        balance: cBal>=0 ? r[cBal] : null,
      }));
    }
    return txs;
  }

  // ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────

  /**
   * Parse an Excel/XLS ArrayBuffer from a bank statement file.
   * @param {ArrayBuffer} arrayBuffer
   * @param {string} filename
   * @returns {{ transactions, accountNumber, bankName, detectedBank, filename, sheetName, headerRow, error? }}
   */
  function parseFile(arrayBuffer, filename) {
    let detectedBank = 'Unknown';
    let sheetName    = '';
    let headerRowIdx = -1;

    try {
      const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true, raw: false });
      sheetName = wb.SheetNames[0] || '';
      const ws  = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

      detectedBank = detectBank(rows, sheetName);
      let transactions = [];

      switch (detectedBank) {
        case 'BIDV':        transactions = parseBIDV(rows);        break;
        case 'Vietcombank': transactions = parseVCB(rows);         break;
        case 'Techcombank': transactions = parseTechcombank(rows); break;
        case 'Vietinbank':  transactions = parseVietinbank(rows);  break;
        case 'VPBank':      transactions = parseVPBank(rows);      break;
        case 'Eximbank':    transactions = parseEximbank(rows);    break;
        case 'Sacombank':   transactions = parseSacombank(rows);   break;
        case 'MB Bank':     transactions = parseMBBank(rows);      break;
        case 'Agribank':    transactions = parseAgribank(rows);    break;
        case 'NAPAS':       transactions = parseNapas(rows);       break;
        default:            transactions = parseGeneric(rows);     break;
      }

      // If parser returned 0 transactions, try generic as last resort
      if (transactions.length === 0 && detectedBank !== 'Unknown') {
        const fallback = parseGeneric(rows);
        if (fallback.length > 0) {
          transactions = fallback;
          console.warn('[BankParser] Specific parser returned 0 rows; used generic fallback for', filename);
        }
      }

      const accountNumber = transactions.find(t => t.accountNumber)?.accountNumber || '';
      headerRowIdx = findHeaderRow(rows, 30);

      // NAPAS only: expose each group's own identity (independent of whether
      // it produced any transactions — e.g. a group whose rows all had
      // amount=0 would otherwise vanish from `transactions` entirely) so a
      // later phase (file pairing, reconciliation) can work from this result
      // alone, without re-reading the Excel file. `null` for every other
      // bank, since they have no group concept (docs/NAPAS_UPGRADE_SPEC.md §9).
      // Safe to call again here: parseNapas() above already called
      // napasBuildGroups(rows) once and did not throw, so this repeat call
      // on the same `rows` is guaranteed not to throw either.
      const napasGroups = detectedBank === 'NAPAS'
        ? napasBuildGroups(rows).map(g => ({
            groupIndex: g.groupIndex, direction: g.direction,
            bankName: g.bankName, accountNumber: g.accountNumber,
          }))
        : null;

      return {
        transactions, accountNumber,
        bankName: detectedBank, detectedBank, filename,
        sheetName, headerRow: headerRowIdx,
        napasGroups,
      };

    } catch (err) {
      console.error('[BankParser]', filename, err);
      return {
        transactions: [], accountNumber: '',
        bankName: detectedBank, detectedBank, filename,
        sheetName, headerRow: headerRowIdx,
        error: err.message,
        errorDetail: `Ngân hàng phát hiện: ${detectedBank} | Sheet: ${sheetName || '?'} | Lỗi: ${err.message}`,
      };
    }
  }

  /**
   * Parse multiple files and merge transactions.
   * @param {Array<{arrayBuffer, filename}>} files
   * @returns {{ transactions, fileResults }}
   */
  async function parseFiles(files) {
    const fileResults = [];
    let allTransactions = [];

    for (const { arrayBuffer, filename } of files) {
      const result = parseFile(arrayBuffer, filename);
      fileResults.push(result);
      allTransactions = allTransactions.concat(result.transactions);
    }

    // Assign sequential IDs to avoid collisions across files
    allTransactions = allTransactions.map((tx, idx) => ({
      ...tx,
      transactionId: `${tx.rawSource}_${idx+1}`,
      code: `${tx.rawSource}_${idx+1}`,
    }));

    return { transactions: allTransactions, fileResults };
  }

  // ─── NAPAS FILE PAIRING ───────────────────────────────────────────────────────
  // Pairs CHUYEN groups with NHAN groups that represent the same account
  // statement, using ONLY identity already extracted from file content —
  // never filename, never groupIndex position (docs/NAPAS_UPGRADE_SPEC.md §3
  // established that filename correlates with account number in every sample
  // seen, but is explicitly not a source of truth; §4.E established that the
  // same accountNumber string can legitimately appear under several different
  // banks within one case, so accountNumber alone is not a safe pairing key
  // either — see below).
  //
  // PAIRING KEY: `accountNumber + (normalizeBankName(bankName) || bankName)`
  // — the group's OWN declared bank (never the per-transaction
  // counterpartyBankName), passed through the Phase 4 bank alias registry
  // with a safe fallback to the raw string when the registry has no entry
  // for it. Evidence for this choice:
  //   - accountNumber alone is insufficient: 371010_5678 has the same
  //     account number under 3 different banks (ACB/VCB/Techcombank) within
  //     ONE file — pairing on account alone would wrongly cross-match a
  //     CHUYEN group at bank A with an NHAN group at bank B.
  //   - bankName alone is insufficient: nothing prevents two different real
  //     accounts from being investigated at the same bank in the same batch
  //     of uploaded files.
  //   - Phase 3 verified raw string equality was already byte-identical
  //     between the CHUYEN and NHAN side of every real matched pair's own
  //     bank-name line (all 27 sample files) — so this Phase 4 change is
  //     behavior-preserving on every fixture seen (see regression below),
  //     not a fix for an observed bug. It is applied anyway because it costs
  //     nothing on data already covered, and strengthens the key against a
  //     case whose CHUYEN/NHAN files might one day spell the same bank
  //     differently (not observed, but plausible given §4.B's counterparty-
  //     bank-name variants) — resolved via the SAME alias registry other
  //     bank-name fields now use, not a separate mechanism.
  //   - The fallback is deliberately `normalizeBankName(x) || x`, never
  //     `normalizeBankName(x) || 'unknown'` — collapsing every unregistered
  //     bank name to one literal 'unknown' bucket would wrongly key two
  //     genuinely different, merely-unregistered banks together. Falling
  //     back to the raw string instead reproduces Phase 3's already-proven-
  //     safe behavior exactly for anything the registry doesn't cover.
  //
  // NEVER assumes: same groupIndex on both sides means the same group
  // (disproven by 371010_5678, where the group ORDER genuinely differs
  // between the CHUYEN file — ACB, VCB, Techcombank — and the NHAN file —
  // Techcombank, ACB, VCB); same number of groups on both sides (disproven
  // by 979494_9999: 2 CHUYEN groups, 1 NHAN group).
  //
  // Two or more groups sharing the exact same (accountNumber, bankName) key
  // on the SAME side (e.g. two different uploaded CHUYEN files both somehow
  // declaring the same account+bank) makes that key ambiguous — this is
  // reported, never silently resolved by picking the first match, the
  // largest transaction count, or any other heuristic.
  //
  // @param {Array} fileResults - the array returned by parseFiles()/produced
  //   by repeated parseFile() calls. Only entries with detectedBank==='NAPAS'
  //   and no `error` are considered (an errored file's group identity could
  //   not be established, so it cannot be safely paired).
  // @returns {{ matchedPairs, orphanChuyen, orphanNhan, ambiguous }}
  function pairNapasGroups(fileResults) {
    const records = [];
    for (const fr of (fileResults || [])) {
      if (!fr || fr.error || fr.detectedBank !== 'NAPAS' || !Array.isArray(fr.napasGroups)) continue;
      for (const g of fr.napasGroups) {
        records.push({
          filename: fr.filename, groupIndex: g.groupIndex,
          direction: g.direction, bankName: g.bankName, accountNumber: g.accountNumber,
          // bankId: normalized identity used for the pairing key; raw
          // bankName is preserved untouched alongside it (spec §8) so
          // callers and the toast/UI layer keep seeing the original text.
          bankId: normalizeBankName(g.bankName) || g.bankName,
        });
      }
    }

    const byKey = new Map(); // `${accountNumber}||${bankId}` -> { chuyen: [...], nhan: [...] }
    for (const r of records) {
      const key = `${r.accountNumber}||${r.bankId}`;
      if (!byKey.has(key)) byKey.set(key, { chuyen: [], nhan: [] });
      byKey.get(key)[r.direction === 'CHUYEN' ? 'chuyen' : 'nhan'].push(r);
    }

    const matchedPairs = [];
    const orphanChuyen = [];
    const orphanNhan   = [];
    const ambiguous    = [];

    for (const { chuyen, nhan } of byKey.values()) {
      if (chuyen.length > 1 || nhan.length > 1) {
        // Duplicate identity on at least one side — cannot determine a
        // unique 1:1 pairing. Report as-is; do not guess.
        ambiguous.push({
          accountNumber: (chuyen[0] || nhan[0]).accountNumber,
          bankName:      (chuyen[0] || nhan[0]).bankName,
          chuyen, nhan,
        });
      } else if (chuyen.length === 1 && nhan.length === 1) {
        matchedPairs.push({
          accountNumber:   chuyen[0].accountNumber,
          bankName:        chuyen[0].bankName,
          chuyenFile:      chuyen[0].filename,
          chuyenGroupIndex: chuyen[0].groupIndex,
          nhanFile:        nhan[0].filename,
          nhanGroupIndex:  nhan[0].groupIndex,
        });
      } else if (chuyen.length === 1) {
        orphanChuyen.push(chuyen[0]);
      } else if (nhan.length === 1) {
        orphanNhan.push(nhan[0]);
      }
    }

    return { matchedPairs, orphanChuyen, orphanNhan, ambiguous };
  }

  // ─── NAPAS TRANSACTION-LEVEL RECONCILIATION (Phase 8–11) ──────────────────────
  // Reconciles individual transactions WITHIN one already-matched CHUYEN/NHAN
  // group pair (a pairNapasGroups() matchedPairs entry) — never across
  // different pairs/accounts/own-banks. docs/NAPAS_UPGRADE_SPEC.md has the
  // full research writeup; summary of the evidence this design is built on:
  //
  // RESEARCH FINDING (Phase 8, real data, not assumed): a CHUYEN group's
  // transactions (money OUT of the investigated account) and its paired
  // NHAN group's transactions (money IN to that same account) are, for this
  // NAPAS export format, DISJOINT real-world events — they are not two
  // views of the same transfer. Verified by:
  //   - transactionId (REF/Trace) overlap between the two sides: 0 in every
  //     fixture checked (860320_9818 and all 3 bank groups of 371010_5678).
  //   - amount + exact date+time overlap: 0/29 in 860320_9818.
  //   - counterpartyAccount overlap (CHUYEN recipients vs NHAN senders):
  //     low and explainable by coincidence (a person can genuinely both
  //     send to and receive from the same counterparty on unrelated
  //     occasions) — 17/558, 7/89, 32/754 distinct accounts across
  //     371010_5678's 3 bank groups, none corroborated by amount+datetime.
  //   - amount-ONLY overlap (ignoring date) is high (20–31%) purely because
  //     round transaction amounts repeat often in this dataset — this
  //     confirms amount alone (or amount+date, or amount+date+counterparty)
  //     is NOT safe evidence of a real relationship here; using it as a
  //     matching signal would manufacture false matches at scale.
  //   - The one genuine non-coincidental signal found: some CHUYEN
  //     transactions explicitly self-reference (their `counterpartyAccount`
  //     equals their own `accountNumber` — visible only where the same
  //     account digits are traced across multiple banks, e.g. 371010_5678:
  //     49/2129 CHUYEN transactions, 0 elsewhere). This is evidence of
  //     genuine self-transfers between the investigated person's own
  //     accounts at different banks. However 0 NHAN transactions in the
  //     same dataset self-reference back — so even this signal currently
  //     yields 0 real matches on the 27 sample files. The matching tier for
  //     it is still implemented properly (not fabricated) because the
  //     underlying logic is sound and would correctly find matches on a
  //     NAPAS export where both legs of a self-transfer are present.
  //
  // CONSEQUENCE: only two matching tiers are implemented, both requiring a
  // signal that is unique on both sides — no tier ever uses amount+date (or
  // amount+date+counterparty) alone, because real-data testing proved that
  // combination is not reliable evidence here (Phase 10 false-match Case
  // 1/2). Running this engine on the 27 sample files will honestly report
  // very few or zero MATCHED transactions — this is the CORRECT result
  // given the data, not an implementation shortfall. See docs/
  // NAPAS_UPGRADE_SPEC.md Phase 10 for the exact per-fixture statistics.
  //
  // PHASE 12 FORENSIC AUDIT (deepened, all 7 real matched group pairs across
  // the 4 multi/single-bank fixtures, not just 1): Số REF overlap between
  // CHUYEN and NHAN = 0/0 in every single pair, no exceptions. Số Trace
  // overlap = 0 in every pair except one single coincidental collision (1
  // shared value out of ~1,760 in the 979494_9999/Techcombank pair) —
  // consistent with chance, not a real bridge. Cross-checked REF-vs-Trace
  // (CHUYEN.REF vs NHAN.Trace and vice versa) = 0 everywhere too. The small
  // number of "amount unique on both sides" candidates found per pair (0-11)
  // were individually inspected: their actual CHUYEN/NHAN timestamps are
  // wildly different (e.g. one pair's top candidate: CHUYEN 28/03/2026 vs
  // NHAN 22/06/2025) — confirming coincidence, not a hidden relationship.
  // The MBVCB narrative's embedded numeric IDs (spec §6) were also
  // cross-checked against the other side's REF/Trace — 0 overlap. Sample
  // structural evidence: every file's own header text ("KẾT QUẢ TÌM KIẾM" /
  // "search results", tied to an independent per-direction, per-account
  // NAPAS.KSTT compliance query) is consistent with these being independent
  // search-result reports, not a paired transaction-level export designed
  // for reconciliation. DECISION (Phase 13, per the explicit "Option
  // A/B/C" framework): Option C — no reliable evidence for a new tier.
  // Engine kept exactly as designed; 0% real match rate on this sample set
  // is the correct, evidence-backed answer, not a gap to close.
  //
  // TIER A — unique `transactionId` (Số REF, falling back to Số Trace, see
  // makeTx()) shared by exactly one CHUYEN and exactly one NHAN transaction.
  // If the id is not unique on one/both sides, every transaction sharing it
  // becomes AMBIGUOUS (never "first one wins"). If a unique id pair is
  // found but the amounts disagree, this is a genuine conflict — it is
  // downgraded to AMBIGUOUS with an explicit reason rather than silently
  // trusted (Phase 10 Case 11) or silently discarded.
  //
  // TIER B — explicit self-transfer marker (`counterpartyAccount ===
  // accountNumber`) plus exact amount + exact transactionDate, unique on
  // both sides among whatever Tier A left unresolved. Lower confidence
  // (INFERRED, not CONFIRMED) because it relies on amount+datetime rather
  // than a dedicated identifier — but only ever applied to the self-
  // transfer subset, never to the general population, so it does not
  // inherit the amount+date false-positive risk documented above.
  //
  // Both tiers are duplicate-safe and order-independent: candidates are
  // counted per key BEFORE any assignment, so two transactions racing for
  // one counterpart both become AMBIGUOUS rather than an array-order
  // "first one wins" pick (Phase 10 Case 9/10).

  function _pushMap(map, key, val) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(val);
  }

  function _reconBuildMatchRecord(c, n, matchMethod, confidence) {
    return {
      status: 'MATCHED',
      matchMethod,
      confidence,
      chuyenTransactionId: c.transactionId,
      nhanTransactionId: n.transactionId,
      evidence: {
        transactionId:       !!c.transactionId && c.transactionId === n.transactionId,
        amount:               c.amount === n.amount,
        date:                 c.transactionDate === n.transactionDate,
        counterpartyAccount:  c.counterpartyAccount === n.accountNumber && n.counterpartyAccount === c.accountNumber,
        selfTransfer:         matchMethod === 'SELF_TRANSFER_AMOUNT_DATETIME',
      },
      chuyen: c,
      nhan: n,
    };
  }

  // Generic key-based matcher shared by both tiers. `resolved` (a Map from
  // transaction object -> 'MATCHED'|'AMBIGUOUS') is shared across tiers so a
  // later tier never reconsiders a transaction an earlier tier already
  // settled. `validate(c, n)`, if given, is a sanity check applied to an
  // otherwise-clean unique pair — failing it produces AMBIGUOUS with a
  // conflict reason instead of a silently-trusted MATCHED (Phase 10 Case 11).
  function _reconTierMatch(chuyenTx, nhanTx, keyFn, matchMethod, confidence, resolved, validate) {
    const chuyenByKey = new Map(), nhanByKey = new Map();
    for (const t of chuyenTx) {
      if (resolved.has(t)) continue;
      const k = keyFn(t);
      if (k == null) continue;
      _pushMap(chuyenByKey, k, t);
    }
    for (const t of nhanTx) {
      if (resolved.has(t)) continue;
      const k = keyFn(t);
      if (k == null) continue;
      _pushMap(nhanByKey, k, t);
    }
    const matched = [];
    const ambiguousGroups = [];
    const keys = new Set([...chuyenByKey.keys(), ...nhanByKey.keys()]);
    for (const k of keys) {
      const cList = chuyenByKey.get(k) || [];
      const nList = nhanByKey.get(k) || [];
      if (cList.length === 0 || nList.length === 0) continue; // no candidate on the other side — stays UNMATCHED, nothing to record
      if (cList.length === 1 && nList.length === 1) {
        const c = cList[0], n = nList[0];
        if (validate && !validate(c, n)) {
          resolved.set(c, 'AMBIGUOUS'); resolved.set(n, 'AMBIGUOUS');
          ambiguousGroups.push({ key: String(k), matchMethod, reason: 'CONFLICTING_EVIDENCE', chuyenCandidates: cList, nhanCandidates: nList });
          continue;
        }
        resolved.set(c, 'MATCHED'); resolved.set(n, 'MATCHED');
        matched.push(_reconBuildMatchRecord(c, n, matchMethod, confidence));
      } else {
        // Multiple candidates share this key on at least one side — cannot
        // determine a unique pairing. Never pick a winner by array order.
        for (const t of cList) resolved.set(t, 'AMBIGUOUS');
        for (const t of nList) resolved.set(t, 'AMBIGUOUS');
        ambiguousGroups.push({ key: String(k), matchMethod, reason: 'MULTIPLE_CANDIDATES_SHARE_KEY', chuyenCandidates: cList, nhanCandidates: nList });
      }
    }
    return { matched, ambiguousGroups };
  }

  /**
   * Reconciles individual transactions between one CHUYEN group's
   * transactions and its paired NHAN group's transactions (already scoped
   * to the right groupIndex by the caller — this function has no notion of
   * files/groups/pairing itself, purely a data-layer primitive over two
   * flat transaction arrays, so it is directly unit-testable).
   * @param {Array} chuyenTx
   * @param {Array} nhanTx
   * @returns {{ matched, unmatchedChuyen, unmatchedNhan, ambiguousChuyen, ambiguousNhan, ambiguousGroups }}
   */
  // HARD CONSTRAINT (Phase 13): a final MATCHED pair must share the same own
  // account AND the same normalized own bank identity, in addition to
  // whatever tier-specific evidence is required. `reconcileAllPairs()`
  // already guarantees this by construction (it only ever scopes both sides
  // to one pairNapasGroups() matchedPairs entry, which itself requires
  // account+bank equality — see pairNapasGroups' own key). This check exists
  // as DEFENSE IN DEPTH for `reconcileGroupPair()` called directly with
  // manually-assembled or malformed arrays, where that guarantee would not
  // otherwise hold — never trust the caller alone for a hard constraint.
  function _reconSameOwnIdentity(c, n) {
    return c.accountNumber === n.accountNumber &&
      (normalizeBankName(c.bankName) || c.bankName) === (normalizeBankName(n.bankName) || n.bankName);
  }

  function reconcileGroupPair(chuyenTx, nhanTx) {
    chuyenTx = Array.isArray(chuyenTx) ? chuyenTx : [];
    nhanTx   = Array.isArray(nhanTx)   ? nhanTx   : [];
    const resolved = new Map();

    // Tier A: unique transactionId shared by both sides; amount must also
    // agree, and both sides must share the same own account+bank identity,
    // or the pair is a conflict, not a silent match (Case 11 / Phase 13
    // hard constraint) — never a silently-trusted or silently-dropped match.
    const tierA = _reconTierMatch(
      chuyenTx, nhanTx,
      t => t.transactionId || null,
      'TRANSACTION_ID', 'CONFIRMED', resolved,
      (c, n) => c.amount === n.amount && _reconSameOwnIdentity(c, n),
    );

    // Tier B: explicit self-transfer marker + amount + exact datetime,
    // among whatever Tier A left unresolved only. Real-data audit (Phase 12,
    // docs/NAPAS_UPGRADE_SPEC.md): across all 7 real matched group pairs in
    // the 27 sample files, 49 CHUYEN transactions carry the self-transfer
    // marker and 0 NHAN transactions do — and even relaxing the requirement
    // to "any NHAN transaction with the same amount+date at all" (dropping
    // the self-transfer requirement on the NHAN side) finds a same-day
    // candidate for only 1 of those 49, which is not corroborated by any
    // other signal and is consistent with the general ~0-3% coincidental
    // amount+date overlap rate measured across all 7 pairs — i.e. it is not
    // distinguishable from noise. This tier is therefore IMPLEMENTED BUT NOT
    // VALIDATED against real data: the logic is sound (and includes the same
    // hard-constraint check as Tier A) and would work correctly on a NAPAS
    // export where both legs of a self-transfer are actually present, but no
    // such case exists in the current sample set to prove it against.
    const tierB = _reconTierMatch(
      chuyenTx, nhanTx,
      t => (t.accountNumber && t.counterpartyAccount === t.accountNumber) ? (t.amount + '|' + t.transactionDate) : null,
      'SELF_TRANSFER_AMOUNT_DATETIME', 'INFERRED', resolved,
      _reconSameOwnIdentity,
    );

    return {
      matched: [...tierA.matched, ...tierB.matched],
      unmatchedChuyen: chuyenTx.filter(t => !resolved.has(t)),
      unmatchedNhan:   nhanTx.filter(t => !resolved.has(t)),
      ambiguousChuyen: chuyenTx.filter(t => resolved.get(t) === 'AMBIGUOUS'),
      ambiguousNhan:   nhanTx.filter(t => resolved.get(t) === 'AMBIGUOUS'),
      ambiguousGroups: [...tierA.ambiguousGroups, ...tierB.ambiguousGroups],
    };
  }

  /**
   * Convenience wrapper: runs reconcileGroupPair() for every matched pair in
   * a pairNapasGroups() result, scoping each side's transactions to the
   * right file + groupIndex via `fileResults` (as produced by parseFiles()).
   * Reuses pairing/parsing results as-is — no re-parsing, no re-deriving
   * pairing logic.
   * @param {Array} fileResults - from parseFiles()
   * @param {{matchedPairs}} pairingResult - from pairNapasGroups(fileResults)
   * @returns {Array<{ pair, reconciliation }>}
   */
  function reconcileAllPairs(fileResults, pairingResult) {
    const byFilename = new Map((fileResults || []).map(fr => [fr.filename, fr]));
    const out = [];
    for (const pair of (pairingResult && pairingResult.matchedPairs) || []) {
      const cf = byFilename.get(pair.chuyenFile);
      const nf = byFilename.get(pair.nhanFile);
      const chuyenTx = cf ? cf.transactions.filter(t => t.groupIndex === pair.chuyenGroupIndex) : [];
      const nhanTx   = nf ? nf.transactions.filter(t => t.groupIndex === pair.nhanGroupIndex)   : [];
      out.push({ pair, reconciliation: reconcileGroupPair(chuyenTx, nhanTx) });
    }
    return out;
  }

  return {
    parseFile, parseFiles, detectBank, findHeaderRow, findColumnMapping,
    pairNapasGroups, normalizeBankName, resolveCounterparty,
    reconcileGroupPair, reconcileAllPairs,
  };

})();
