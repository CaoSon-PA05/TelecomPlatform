/**
 * phone-topup-engine.js — Phone Number Top-up Intelligence Module
 *
 * Scans transaction descriptions for Vietnamese phone-top-up payments.
 * Extracts phone numbers, builds aggregations, and generates risk indicators.
 *
 * Public API:
 *   PhoneTopupEngine.analyze(transactions)          → TopupResult
 *   PhoneTopupEngine.buildExcelRows(topupResult)    → Row[]
 *   PhoneTopupEngine.buildInvestigationSection(tr)  → Section | null
 */

const PhoneTopupEngine = (() => {
  'use strict';

  // ─── NORMALIZATION ───────────────────────────────────────────────────────────

  function norm(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s\d]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // ─── TOPUP KEYWORD DETECTION ─────────────────────────────────────────────────
  // Explicit topup signals in transaction descriptions.

  const TOPUP_KEYWORDS = [
    'topup', 'top up', 'nap tien dien thoai', 'nap the dien thoai',
    'nap tien dt', 'nap cuoc', 'mobile topup', 'vnpay topup',
    'momo topup', 'viettel topup', 'vinaphone topup', 'mobifone topup',
    'vietnamobile topup', 'gmobile topup', 'nap the', 'nap tien cho so',
    'thanh toan cuoc dien thoai', 'tt cuoc dt', 'tt dien thoai',
    'recharge', 'airtime', 'prepaid topup',
  ];

  // Softer signals — phone context (used when a number is also present)
  const SOFT_TOPUP_KEYWORDS = [
    'thanh toan cho', 'nhan tien tu', 'chuyen cho', 'tt cho so',
    'topup', 'nap', 'cuoc', 'sim',
  ];

  function hasHardTopupSignal(description) {
    const n = norm(description);
    return TOPUP_KEYWORDS.some(kw => n.includes(kw));
  }

  function hasSoftTopupSignal(description) {
    const n = norm(description);
    return SOFT_TOPUP_KEYWORDS.some(kw => n.includes(kw));
  }

  // ─── PHONE NUMBER EXTRACTION ─────────────────────────────────────────────────
  // Vietnamese mobile: 10 digits starting with 03x, 05x, 07x, 08x, 09x.
  // Accepts separators: space, dot, dash between digit groups.

  // Match 10-digit Vietnamese mobile numbers (with optional separators)
  const PHONE_PATTERN = /\b(0[3-9]\d)[\s.\-]?(\d{3})[\s.\-]?(\d{4})\b/g;

  function normalizePhone(raw) {
    const digits = raw.replace(/\D/g, '');
    return (digits.length === 10 && /^0[3-9]/.test(digits)) ? digits : null;
  }

  /**
   * Extract all Vietnamese mobile phone numbers from a description.
   * Returns array of normalized 10-digit strings.
   */
  function extractPhones(description) {
    if (!description) return [];
    const found = new Set();
    PHONE_PATTERN.lastIndex = 0;
    let m;
    while ((m = PHONE_PATTERN.exec(description)) !== null) {
      const normalized = normalizePhone(m[0]);
      if (normalized) found.add(normalized);
    }
    return [...found];
  }

  /**
   * Typical Vietnamese phone top-up denominations (VND).
   * Used to confirm topup intent when no keyword is present.
   */
  const TOPUP_AMOUNTS = new Set([
    10000, 20000, 30000, 50000, 100000, 150000, 200000, 300000, 500000, 1000000,
  ]);

  /**
   * Determine whether a transaction is a phone top-up.
   * Returns { phoneNumber, confidence: 'HIGH'|'MEDIUM' } or null.
   */
  function extractTopup(tx) {
    const raw = tx.description || tx.content || '';
    if (!raw) return null;

    const phones = extractPhones(raw);
    if (phones.length === 0) return null;

    const hasHard = hasHardTopupSignal(raw);
    const hasSoft = hasSoftTopupSignal(raw);
    const isTypicalAmount = TOPUP_AMOUNTS.has(tx.amount || 0);

    let confidence;
    if (hasHard) {
      confidence = 'HIGH';
    } else if (hasSoft && (isTypicalAmount || (tx.amount || 0) <= 1_000_000)) {
      confidence = 'MEDIUM';
    } else {
      // No keyword context and unusual amount → skip
      return null;
    }

    return { phoneNumber: phones[0], confidence };
  }

  // ─── RISK DETECTION ──────────────────────────────────────────────────────────

  function detectRisk(agg) {
    const flags = [];
    const acctCount = agg.fundingAccounts.size;
    const txCount   = agg.totalCount;
    const total     = agg.totalAmount;

    if (acctCount >= 3)             flags.push('PHONE_SHARED_ACROSS_ACCOUNTS');
    else if (acctCount >= 2)        flags.push('MULTI_ACCOUNT_TOPUP');

    if (txCount >= 5)               flags.push('HIGH_TOPUP_FREQUENCY');
    if (total >= 5_000_000)         flags.push('HIGH_VALUE_TOPUP');

    // Burst pattern: 3+ topups within 24 h
    if (txCount >= 3 && agg.lastDateMs > 0 && agg.firstDateMs < Infinity) {
      const hours = (agg.lastDateMs - agg.firstDateMs) / 3_600_000;
      if (hours <= 24) flags.push('REPEATED_TOPUP_PATTERN');
    }

    return [...new Set(flags)];
  }

  // ─── MAIN ANALYSIS ───────────────────────────────────────────────────────────

  function analyze(transactions) {
    if (!transactions || transactions.length === 0) return _empty();

    const records = [];
    const byPhone = {};

    for (const tx of transactions) {
      const hit = extractTopup(tx);
      if (!hit) continue;

      const phone = hit.phoneNumber;
      const rec = {
        phoneNumber:     phone,
        accountNumber:   tx.accountNumber  || '',
        bankName:        tx.bankName || tx.bank || '',
        transactionDate: tx.transactionDate || tx.date || '',
        amount:          tx.amount         || 0,
        transactionId:   tx.transactionId  || tx.code || '',
        rawDescription:  tx.description    || tx.content || '',
        confidence:      hit.confidence,
      };
      records.push(rec);

      if (!byPhone[phone]) {
        byPhone[phone] = {
          phoneNumber:    phone,
          totalCount:     0,
          totalAmount:    0,
          firstDate:      '',
          lastDate:       '',
          firstDateMs:    Infinity,
          lastDateMs:     0,
          fundingAccounts: new Set(),
          fundingBanks:   new Set(),
          transactions:   [],
        };
      }
      const agg = byPhone[phone];
      agg.totalCount++;
      agg.totalAmount += rec.amount;
      agg.fundingAccounts.add(rec.accountNumber);
      agg.fundingBanks.add(rec.bankName);
      agg.transactions.push(rec);

      const ms = _parseDateMs(rec.transactionDate);
      if (ms > 0 && ms < agg.firstDateMs) { agg.firstDateMs = ms; agg.firstDate = rec.transactionDate; }
      if (ms > agg.lastDateMs)            { agg.lastDateMs  = ms; agg.lastDate  = rec.transactionDate; }
    }

    const aggregations = Object.values(byPhone).map(agg => {
      const accts = [...agg.fundingAccounts].filter(Boolean);
      const flags = detectRisk(agg);
      const rl    = flags.includes('PHONE_SHARED_ACROSS_ACCOUNTS') || flags.includes('MULTI_ACCOUNT_TOPUP')
                    ? 'HIGH'
                    : flags.length > 0 ? 'MEDIUM' : 'LOW';
      return {
        phoneNumber:     agg.phoneNumber,
        totalCount:      agg.totalCount,
        totalAmount:     agg.totalAmount,
        firstDate:       agg.firstDate,
        lastDate:        agg.lastDate,
        fundingAccounts: accts,
        fundingBanks:    [...agg.fundingBanks].filter(Boolean),
        accountCount:    accts.length,
        transactions:    agg.transactions,
        riskFlags:       flags,
        riskLevel:       rl,
      };
    }).sort((a, b) => b.totalCount - a.totalCount || b.totalAmount - a.totalAmount);

    return {
      records,
      aggregations,
      totalTopupCount:  records.length,
      uniquePhoneCount: aggregations.length,
      highRiskPhones:   aggregations.filter(a => a.riskLevel === 'HIGH').length,
    };
  }

  // ─── EXCEL ROW BUILDER ───────────────────────────────────────────────────────

  function buildExcelRows(topupResult) {
    if (!topupResult || !topupResult.aggregations) return [];
    return topupResult.aggregations.map(a => ({
      'So Dien Thoai':      a.phoneNumber,
      'So Lan Nap':         a.totalCount,
      'Tong Tien (VND)':   a.totalAmount,
      'So TK Cap Von':      a.accountCount,
      'Danh Sach TK':       a.fundingAccounts.join(', '),
      'Ngan Hang':          a.fundingBanks.join(', '),
      'Lan Dau Tien':       a.firstDate,
      'Lan Cuoi Cung':      a.lastDate,
      'Muc Do Rui Ro':      a.riskLevel,
      'Co Hieu Rui Ro':     a.riskFlags.join(' | ') || 'NONE',
    }));
  }

  // ─── INVESTIGATION SECTION ───────────────────────────────────────────────────

  function buildInvestigationSection(topupResult) {
    if (!topupResult || topupResult.uniquePhoneCount === 0) return null;
    const suspicious = topupResult.aggregations.filter(a => a.riskLevel !== 'LOW');
    return {
      totalPhones:     topupResult.uniquePhoneCount,
      totalTopups:     topupResult.totalTopupCount,
      highRiskCount:   topupResult.highRiskPhones,
      suspiciousPhones: suspicious.slice(0, 10).map(a => ({
        phone:    a.phoneNumber,
        count:    a.totalCount,
        amount:   a.totalAmount,
        accounts: a.accountCount,
        flags:    a.riskFlags,
        riskLevel: a.riskLevel,
      })),
    };
  }

  // ─── UTILITIES ───────────────────────────────────────────────────────────────

  function _parseDateMs(dateStr) {
    if (!dateStr) return 0;
    const s = String(dateStr);
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}:00`).getTime();
    const ts = new Date(s).getTime();
    return isNaN(ts) ? 0 : ts;
  }

  function _empty() {
    return { records: [], aggregations: [], totalTopupCount: 0, uniquePhoneCount: 0, highRiskPhones: 0 };
  }

  return { analyze, extractTopup, extractPhones, buildExcelRows, buildInvestigationSection };
})();
