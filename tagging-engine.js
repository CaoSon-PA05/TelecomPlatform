/**
 * tagging-engine.js — Behavioral auto-tagging engine
 * Hybrid: rule-based + NLP-intent-aware.
 * Assigns structured tags to each transaction and computes legacy `flag` string.
 */
const TaggingEngine = (() => {

  const LARGE_AMOUNT   = 150_000_000;   // 150M VND
  const MEDIUM_AMOUNT  =  50_000_000;   //  50M VND
  const VERY_LARGE     = 500_000_000;   // 500M VND
  const SUSPICIOUS_HOURS = new Set([23, 0, 1, 2, 3, 4]);
  const ROUND_DIVISORS = [1_000_000_000, 500_000_000, 100_000_000, 50_000_000, 10_000_000, 5_000_000, 1_000_000, 500_000];

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  function parseHour(dateStr) {
    if (!dateStr) return -1;
    const m = String(dateStr).match(/[T\s](\d{2}):/);
    return m ? parseInt(m[1], 10) : -1;
  }

  function parseDateMs(dateStr) {
    if (!dateStr) return 0;
    // DD/MM/YYYY HH:mm:ss
    const m = String(dateStr).match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}:00`).getTime();
    return new Date(dateStr).getTime() || 0;
  }

  function isRound(amount) {
    return ROUND_DIVISORS.some(d => d <= amount && amount % d === 0);
  }

  // ─── BUILD LOOKUP MAPS ───────────────────────────────────────────────────────

  function buildMaps(transactions) {
    // Map: accountNumber → all transactions of that account
    const byAccount = {};
    // Map: accountNumber → { amount → count }
    const amountFreq = {};
    // Map: accountNumber+date(day) → transactions in that day
    const byAccountDay = {};

    transactions.forEach((tx, idx) => {
      const acc = tx.accountNumber;
      const amt = tx.amount;

      if (!byAccount[acc]) byAccount[acc] = [];
      byAccount[acc].push(idx);

      if (!amountFreq[acc]) amountFreq[acc] = {};
      amountFreq[acc][amt] = (amountFreq[acc][amt] || 0) + 1;

      const dayKey = `${acc}|${(tx.transactionDate || tx.date || '').slice(0, 10)}`;
      if (!byAccountDay[dayKey]) byAccountDay[dayKey] = [];
      byAccountDay[dayKey].push(idx);
    });

    return { byAccount, amountFreq, byAccountDay };
  }

  // ─── TAG A SINGLE TRANSACTION ────────────────────────────────────────────────

  function tagOne(tx, idx, transactions, maps) {
    const tags = [];
    const { amount, transactionType, nlpIntent } = tx;
    const hour = parseHour(tx.transactionDate || tx.date);
    const acc  = tx.accountNumber;
    const { amountFreq, byAccountDay } = maps;

    // ── Amount thresholds
    if (amount >= VERY_LARGE)   tags.push('VERY_LARGE_AMOUNT');
    else if (amount >= LARGE_AMOUNT) tags.push('LARGE_AMOUNT');
    else if (amount >= MEDIUM_AMOUNT) tags.push('MEDIUM_AMOUNT');

    // ── Time-based
    if (hour >= 0 && SUSPICIOUS_HOURS.has(hour)) tags.push('OFF_HOURS');

    // ── Round amount
    if (amount > 0 && isRound(amount)) tags.push('ROUND_AMOUNT');

    // ── Repeated same amount for same account
    const freq = (amountFreq[acc] || {})[amount] || 0;
    if (freq >= 5) tags.push('HIGH_FREQUENCY');
    else if (freq >= 2) tags.push('REPEATED_AMOUNT');

    // ── Split transactions: many same-direction txs in same hour window
    const txMs = parseDateMs(tx.transactionDate || tx.date);
    if (txMs > 0 && amount > 0 && amount < LARGE_AMOUNT) {
      const sameHourSameDir = transactions.filter((t, j) => {
        if (j === idx || t.transactionType !== transactionType || t.accountNumber !== acc) return false;
        const diff = Math.abs(parseDateMs(t.transactionDate || t.date) - txMs);
        return diff <= 60 * 60 * 1000; // within 1 hour
      });
      if (sameHourSameDir.length >= 2) tags.push('SMALL_SPLIT_TRANSFER');
    }

    // ── Many transactions in same day
    const dayKey = `${acc}|${(tx.transactionDate || tx.date || '').slice(0, 10)}`;
    const dayCount = ((byAccountDay[dayKey] || []).length);
    if (dayCount >= 10) tags.push('HIGH_DAILY_FREQUENCY');

    // ── NLP intent-based tags
    if (nlpIntent === 'gambling')    tags.push('GAMBLING_SIGNAL');
    if (nlpIntent === 'cash')        tags.push('CASH_WITHDRAWAL');
    if (nlpIntent === 'loan')        tags.push('LOAN_RELATED');
    if (nlpIntent === 'salary')      tags.push('SALARY_INCOME');
    if (nlpIntent === 'investment')  tags.push('INVESTMENT');

    // ── Recurring payment (same intent, same amount, occurs at least twice)
    if (nlpIntent === 'payment' && freq >= 2) tags.push('RECURRING_PAYMENT');

    // ── Risk pattern compositions
    if (tags.includes('LARGE_AMOUNT') && tags.includes('OFF_HOURS')) tags.push('RISK_PATTERN');
    if (tags.includes('VERY_LARGE_AMOUNT')) tags.push('RISK_PATTERN');
    if (tags.includes('HIGH_FREQUENCY') && tags.includes('ROUND_AMOUNT')) tags.push('RISK_PATTERN');
    if (tags.includes('SMALL_SPLIT_TRANSFER') && tags.includes('ROUND_AMOUNT')) tags.push('RISK_PATTERN');
    if (tags.includes('GAMBLING_SIGNAL')) tags.push('RISK_PATTERN');

    // ── Default
    if (tags.length === 0) tags.push('NORMAL_BEHAVIOR');

    return tags;
  }

  // ─── LEGACY FLAG STRING ──────────────────────────────────────────────────────

  const FLAG_PRIORITY = [
    ['GAMBLING_SIGNAL',       'Dấu hiệu cờ bạc'],
    ['RISK_PATTERN',          'Dấu hiệu rủi ro cao'],
    ['VERY_LARGE_AMOUNT',     'Lượng tiền rất lớn'],
    ['SMALL_SPLIT_TRANSFER',  'Chia nhỏ giao dịch'],
    ['HIGH_FREQUENCY',        'Tần suất dồn dập'],
    ['OFF_HOURS',             'Khung giờ nhạy cảm'],
    ['LARGE_AMOUNT',          'Lượng tiền lớn'],
    ['REPEATED_AMOUNT',       'Số tiền lặp lại'],
    ['HIGH_DAILY_FREQUENCY',  'Tần suất cao trong ngày'],
    ['RECURRING_PAYMENT',     'Thanh toán định kỳ'],
    ['ROUND_AMOUNT',          'Số tiền tròn'],
    ['LOAN_RELATED',          'Liên quan vay nợ'],
  ];

  function toLegacyFlag(tags) {
    for (const [tag, label] of FLAG_PRIORITY) {
      if (tags.includes(tag)) return label;
    }
    return 'N/A';
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────────

  function tagAll(transactions) {
    const maps = buildMaps(transactions);
    return transactions.map((tx, idx) => {
      const tags = tagOne(tx, idx, transactions, maps);
      const flag = toLegacyFlag(tags);
      return { ...tx, tags, flag };
    });
  }

  function getTagSummary(transactions) {
    const counts = {};
    transactions.forEach(tx => {
      (tx.tags || ['NORMAL_BEHAVIOR']).forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count, label: getTagLabel(tag) }));
  }

  const TAG_LABELS = {
    VERY_LARGE_AMOUNT:     'Lượng tiền rất lớn (>500M)',
    LARGE_AMOUNT:          'Lượng tiền lớn (>150M)',
    MEDIUM_AMOUNT:         'Lượng tiền trung bình (>50M)',
    OFF_HOURS:             'Giao dịch ngoài giờ (23h–4h)',
    ROUND_AMOUNT:          'Số tiền tròn',
    HIGH_FREQUENCY:        'Tần suất rất cao (≥5 lần)',
    REPEATED_AMOUNT:       'Số tiền lặp lại',
    SMALL_SPLIT_TRANSFER:  'Chia nhỏ chuyển khoản',
    HIGH_DAILY_FREQUENCY:  'Dồn dập trong ngày',
    GAMBLING_SIGNAL:       'Dấu hiệu cờ bạc',
    CASH_WITHDRAWAL:       'Rút tiền mặt',
    LOAN_RELATED:          'Liên quan vay nợ',
    SALARY_INCOME:         'Thu nhập lương',
    INVESTMENT:            'Đầu tư / Tiết kiệm',
    RECURRING_PAYMENT:     'Thanh toán định kỳ',
    RISK_PATTERN:          'Mẫu rủi ro (tổng hợp)',
    NORMAL_BEHAVIOR:       'Hành vi bình thường',
  };

  function getTagLabel(tag) {
    return TAG_LABELS[tag] || tag;
  }

  return { tagAll, getTagSummary, getTagLabel, toLegacyFlag };

})();
