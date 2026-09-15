/**
 * nlp-engine.js v3 — Advanced Semantic Intelligence (Production Stable)
 *
 * Phase 3 Stability Fixes:
 *   ① TAXONOMY STANDARDIZATION: Internal 8-intent taxonomy is now mapped to a
 *      7-intent canonical taxonomy required by governance layer:
 *      TRANSFER | PAYMENT | SALARY | BUSINESS | LOAN | UNKNOWN | SUSPICIOUS_PROXY
 *   ② CONTRADICTION DETECTION: Per-account detection of incompatible intent patterns
 *      (e.g., SALARY + SUSPICIOUS_PROXY within same account).
 *   ③ CONSISTENCY ENFORCEMENT: All outputs now use canonical taxonomy strings.
 *
 * v2 capabilities retained:
 *   Context-aware classification, fraud language detection, intent shift analysis,
 *   TF-IDF semantic clustering, entity extraction.
 */
const NLPEngine = (() => {

  // ─── NORMALIZATION ───────────────────────────────────────────────────────────

  function norm(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s\d]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // ─── INTENT CLASSIFICATION (v1 kept, enhanced with context in processAll) ────

  const INTENT_RULES = [
    {
      // Phone top-up: highest priority so it is not mis-classified as generic payment
      intent: 'phone_topup', weight: 130,
      patterns: [
        'topup','top up','nap tien dien thoai','nap the dien thoai',
        'nap tien dt','nap cuoc','mobile topup','vnpay topup',
        'momo topup','viettel topup','vinaphone topup','mobifone topup',
        'vietnamobile topup','gmobile topup','tt cuoc dt','recharge airtime',
      ],
    },
    {
      intent: 'salary', weight: 100,
      patterns: ['luong','tien luong','chi luong','thu nhap','thu nhap tang them','salary','wage','payroll','luong thang','phu cap','thuong','chi thuong','thu nhap khac'],
    },
    {
      intent: 'gambling', weight: 120,
      patterns: ['casino','game bai','co bac','xo so','cuoc','bet','jackpot','lo de','giai','doi thuong','giai thuong','bao cao game'],
    },
    {
      intent: 'loan', weight: 90,
      patterns: ['vay','tra no','tra goc','tra lai','lai suat','thu no','loan','debt','borrow','credit','goc','du no','bao lanh','the tin dung','overdraft','thu hoi'],
    },
    {
      intent: 'investment', weight: 80,
      patterns: ['dau tu','chung khoan','co phieu','trai phieu','fund','quy','investment','invest','sinh loi','loi nhuan','ky han','tiet kiem','ccgt','cctg','bao loc','tich luy'],
    },
    {
      intent: 'payment', weight: 70,
      patterns: ['thanh toan','pay','payment','phi','hoa don','bill','dich vu','tien dien','tien nuoc','tien nha','internet','truyen hinh','dien thoai','bao hiem','thue','phi dich vu','pos','mua hang','mua do','online','ecommerce','shopee','lazada','tiki','vnpay','momo','zalopay'],
    },
    {
      intent: 'cash', weight: 85,
      patterns: ['rut tien','doi tien mat','tien mat','atm','cash','rut','withdraw','nap tien','nap the'],
    },
    {
      intent: 'business', weight: 60,
      patterns: ['doanh thu','ban hang','thu tien','thu phi','revenue','income','hop dong','hop tac','kinh doanh','thuong mai','xuat nhap khau','cong ty','doanh nghiep','nha hang','khach san','giao hang','hang hoa','san pham','dich vu thuong mai'],
    },
    {
      intent: 'transfer', weight: 10,
      patterns: ['chuyen tien','chuyen khoan','ck','ct','napas','transfer','remit','nhan tien','gui tien','nhan tu','chuyen tu','thanh toan lien ngan hang'],
    },
  ];

  function classifyIntent(description) {
    if (!description) return 'transfer';
    const n = norm(description);
    let bestIntent = 'transfer', bestScore = 0;
    for (const rule of INTENT_RULES) {
      for (const p of rule.patterns) {
        if (n.includes(norm(p))) {
          if (rule.weight > bestScore) { bestScore = rule.weight; bestIntent = rule.intent; }
          break;
        }
      }
    }
    return bestIntent;
  }

  // ─── FRAUD LANGUAGE DETECTION (v2 NEW) ───────────────────────────────────────
  // Detects Vietnamese proxy/informal transfer language used in layering schemes.

  const FRAUD_LANGUAGE_RULES = [
    // Proxy transfer signals — "on behalf of someone else"
    { signal: 'PROXY_TRANSFER',   patterns: ['chuyen ho','gui ho','nho chuyen','nho gui','the ho','ho tro','gio ho','giup chuyen','nhan ho','giup gui'] },
    // Disguised purpose — vague or deceptive descriptions
    { signal: 'VAGUE_PURPOSE',    patterns: ['linh tinh','phat sinh','cac khoan','thu chi','bo sung','ho tro them','xin nhan','xin gui','nhan lai','gui lai'] },
    // Informal repayment language
    { signal: 'INFORMAL_REPAY',   patterns: ['tien cu','tra cu','gui lai','hoan tra','boi thuong','thu hoi lai','tl lai','nhan boi'] },
    // Shell / pass-through language
    { signal: 'PASS_THROUGH',     patterns: ['giu ho','truong hop','gio tam','luu tam','qua tay','chuyen tiep','thu ho','nop ho'] },
    // Urgency/pressure language
    { signal: 'URGENCY_SIGNAL',   patterns: ['gap','khan','ngay','luc','khan cap','can ngay','nhanh','ngay hom nay','truoc','can gap'] },
    // Structuring indicators (amounts designed to avoid thresholds)
    { signal: 'STRUCTURING_HINT', patterns: ['chia ra','chia nho','chia thanh','tung phan','nhieu lan','nhieu chuyen','lan luot','tu tung'] },
  ];

  function detectFraudLanguage(description) {
    if (!description) return [];
    const n = norm(description);
    const signals = [];
    for (const rule of FRAUD_LANGUAGE_RULES) {
      for (const p of rule.patterns) {
        if (n.includes(norm(p))) {
          signals.push({ signal: rule.signal, trigger: p });
          break;
        }
      }
    }
    return signals;
  }

  // ─── ENTITY EXTRACTION ───────────────────────────────────────────────────────

  function extractEntities(description) {
    if (!description) return [];
    const d = description;
    const entities = [];
    const seen = new Set();

    function addEnt(type, value) {
      const key = `${type}:${value}`;
      if (!seen.has(key)) { seen.add(key); entities.push({ type, value, label: `[${type}] ${value}` }); }
    }

    // Vietnamese phones
    const phones = d.match(/\b(0[35789]\d{8}|1[89]00\d{4}|\+84\d{9}|84\d{9})\b/g);
    (phones || []).forEach(p => addEnt('PHONE', p));

    // Bank accounts (6–20 digits)
    const accs = d.match(/(?<!\d)\d{6,20}(?!\d)/g);
    (accs || []).forEach(a => {
      if (!(phones || []).includes(a) && !/^(19|20)\d{6}$/.test(a)) addEnt('ACCOUNT', a);
    });

    // Vietnamese organizations
    const orgVN = /\b(CONG TY|CO PHAN|TNHH|DOANH NGHIEP|NGAN HANG|TRUONG|BENH VIEN|VIEN|TRUNG TAM|UY BAN|SO |BO |TAP DOAN)\s+[A-Z\s]{3,40}/gi;
    (d.match(orgVN) || []).forEach(m => addEnt('ORG', m.trim().slice(0, 60)));

    // English organizations
    const orgEN = /\b(BANK|COMPANY|CORP|CO\.|LTD|JSC|GROUP|FUND|HOSPITAL|SCHOOL)\b.{0,30}/gi;
    (d.match(orgEN) || []).forEach(m => addEnt('ORG', m.trim().slice(0, 60)));

    // Reference codes
    const refs = d.match(/\b(FT|TT|CT|GD|REF|TRACE|NAPAS|MB|VCB|TCB|BID|STK)\s*[\dA-Z]{6,}/gi);
    (refs || []).forEach(r => addEnt('REF', r.trim()));

    // Amount mentions
    const amts = d.match(/\b\d+[\.,]?\d*\s*(trieu|ty|tr|k|vnd|dong)\b/gi);
    (amts || []).forEach(a => addEnt('AMOUNT_MENTION', a));

    // Personal names (all-caps multi-word)
    const names = d.match(/\b([A-Z]{2,12}\s){1,3}[A-Z]{2,12}\b/g);
    (names || []).slice(0, 3).forEach(n => {
      if (!/^(BANK|CONG|DICH|NGAN|CHUYEN|NHAN|THANH|TOAN|PHAT|SINH|CHUYEN TIEN)$/.test(n.trim())) {
        addEnt('PERSON', n);
      }
    });

    return entities;
  }

  // ─── CONTEXT-AWARE INTENT ANALYSIS (v2 NEW) ──────────────────────────────────
  // Analyzes each account's full transaction history to:
  //   1. Detect primary vs secondary intents
  //   2. Identify intent shifts (behavioral discontinuities)
  //   3. Return context-enriched classification per account

  function analyzeAccountContext(transactions) {
    // Group by account
    const byAccount = {};
    transactions.forEach((tx, idx) => {
      const acc = tx.accountNumber;
      if (!byAccount[acc]) byAccount[acc] = [];
      byAccount[acc].push({ tx, idx });
    });

    const accountContexts = {};

    Object.entries(byAccount).forEach(([acc, items]) => {
      if (items.length < 2) {
        accountContexts[acc] = { primaryIntent: items[0]?.tx.nlpIntent || 'transfer', shifts: [], anomalousIntents: [] };
        return;
      }

      // Sort by date
      const sorted = [...items].sort((a, b) => {
        const da = _parseDateMs(a.tx.transactionDate || a.tx.date);
        const db = _parseDateMs(b.tx.transactionDate || b.tx.date);
        return da - db;
      });

      const intents = sorted.map(it => it.tx.nlpIntent || 'transfer');

      // Primary intent = most frequent
      const intentFreq = {};
      intents.forEach(i => { intentFreq[i] = (intentFreq[i] || 0) + 1; });
      const primaryIntent = Object.entries(intentFreq).sort((a,b) => b[1]-a[1])[0]?.[0] || 'transfer';

      // Intent shifts — detect where sequence changes significantly
      const shifts = detectIntentShifts(sorted);

      // Anomalous intents — high-risk intents that are isolated (not the norm)
      const anomalousIntents = Object.entries(intentFreq)
        .filter(([intent, count]) => {
          const isHighRisk = ['gambling', 'cash'].includes(intent);
          const isMinority = count < items.length * 0.2; // < 20% of transactions
          return isHighRisk && isMinority;
        })
        .map(([intent]) => intent);

      accountContexts[acc] = { primaryIntent, shifts, anomalousIntents, intentFreq };
    });

    return accountContexts;
  }

  /** Detect sharp transitions in intent sequence (≥2 consecutive new intents) */
  function detectIntentShifts(sortedItems) {
    const shifts = [];
    const HIGH_RISK_INTENTS = new Set(['gambling', 'cash', 'loan']);
    const windowSize = 3;

    for (let i = windowSize; i < sortedItems.length; i++) {
      const before = sortedItems.slice(Math.max(0, i - windowSize), i).map(it => it.tx.nlpIntent);
      const after  = sortedItems.slice(i, Math.min(sortedItems.length, i + windowSize)).map(it => it.tx.nlpIntent);

      const beforeSet = new Set(before);
      const afterSet  = new Set(after);

      const newIntents = [...afterSet].filter(intent => !beforeSet.has(intent));
      const hasHighRiskShift = newIntents.some(intent => HIGH_RISK_INTENTS.has(intent));

      if (hasHighRiskShift) {
        shifts.push({
          shiftIndex:   i,
          txId:         sortedItems[i].tx.transactionId || '',
          date:         sortedItems[i].tx.transactionDate || '',
          fromIntents:  [...beforeSet],
          toIntents:    [...afterSet],
          newHighRisk:  newIntents.filter(intent => HIGH_RISK_INTENTS.has(intent)),
        });
      }
    }

    return shifts;
  }

  function _parseDateMs(dateStr) {
    if (!dateStr) return 0;
    const s  = String(dateStr);
    const m  = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}:00`).getTime();
    const ts = new Date(s).getTime();
    return isNaN(ts) ? 0 : ts;
  }

  // ─── SEMANTIC CLUSTERING v2 ──────────────────────────────────────────────────
  // Uses TF-IDF-weighted Jaccard for better discrimination.
  // Also merges groups that share the same intent (even if wording differs).

  function buildIDF(transactions) {
    const docCount = transactions.length;
    const df = {};
    transactions.forEach(tx => {
      const words = new Set(norm(tx.description || tx.content || '').split(/\s+/).filter(w => w.length > 3));
      words.forEach(w => { df[w] = (df[w] || 0) + 1; });
    });
    const idf = {};
    Object.entries(df).forEach(([w, count]) => {
      idf[w] = Math.log((docCount + 1) / (count + 1)) + 1; // smooth IDF
    });
    return idf;
  }

  function tfidfJaccard(desc1, desc2, idf) {
    const words1 = new Set(norm(desc1).split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(norm(desc2).split(/\s+/).filter(w => w.length > 3));
    if (words1.size === 0 && words2.size === 0) return 0;

    let interW = 0, unionW = 0;
    const all = new Set([...words1, ...words2]);
    all.forEach(w => {
      const weight = idf[w] || 1;
      const in1 = words1.has(w), in2 = words2.has(w);
      if (in1 && in2) interW += weight;
      unionW += weight;
    });
    return unionW > 0 ? interW / unionW : 0;
  }

  function groupSimilarTransactions(transactions, threshold = 0.4) {
    const n   = transactions.length;
    if (n === 0) return [];

    const idf      = buildIDF(transactions);
    const assigned = new Array(n).fill(-1);
    const groups   = [];
    let groupId    = 0;

    for (let i = 0; i < n; i++) {
      if (assigned[i] >= 0) continue;
      assigned[i] = groupId;
      const group = [i];
      for (let j = i + 1; j < n; j++) {
        if (assigned[j] >= 0) continue;
        // v2: combine intent equality + TF-IDF Jaccard
        const sameIntent = transactions[i].nlpIntent === transactions[j].nlpIntent;
        const sim        = tfidfJaccard(transactions[i].description || '', transactions[j].description || '', idf);
        if (sim >= threshold || (sameIntent && sim >= threshold * 0.6)) {
          assigned[j] = groupId;
          group.push(j);
        }
      }
      groups.push({ id: groupId, indices: group, representativeDesc: transactions[i].description || transactions[i].content || '' });
      groupId++;
    }

    return groups;
  }

  // ─── BATCH PROCESSING ────────────────────────────────────────────────────────

  function processAll(transactions) {
    // Step 1: single-row classification + entity extraction + fraud language
    const step1 = transactions.map(tx => {
      const desc           = tx.description || tx.content || '';
      const nlpIntent      = classifyIntent(desc);
      const entities       = extractEntities(desc);
      const fraudLanguage  = detectFraudLanguage(desc);  // v2

      return {
        ...tx,
        nlpIntent,
        nlpEntities:    entities.map(e => e.label),
        nlpEntitiesRaw: entities,
        fraudLanguage,                                    // v2
        fraudLanguageSignals: fraudLanguage.map(f => f.signal), // v2
      };
    });

    // Step 2: Context-aware analysis per account (v2)
    const accountContexts = analyzeAccountContext(step1);

    // Step 3: Contradiction detection per account (Phase 3 new)
    const contradictions = detectAccountContradictions(step1, accountContexts);

    // Step 4: Enrich with context + canonical taxonomy
    return step1.map(tx => {
      const ctx = accountContexts[tx.accountNumber] || {};
      const raw = tx.nlpIntent;
      return {
        ...tx,
        nlpIntent:            toCanonical(raw),            // Phase 3: canonical taxonomy
        nlpIntentRaw:         raw,                         // preserve original for debugging
        contextPrimaryIntent: toCanonical(ctx.primaryIntent || raw),
        hasIntentShift:       ctx.shifts?.some(s => s.txId === tx.transactionId) || false,
        anomalousIntent:      (ctx.anomalousIntents || []).includes(raw),
        hasFraudLanguage:     (tx.fraudLanguage || []).length > 0,
        hasContradiction:     !!(contradictions[tx.accountNumber]),   // Phase 3
        contradictionType:    contradictions[tx.accountNumber] || null, // Phase 3
      };
    });
  }

  // ─── CANONICAL TAXONOMY MAPPING (Phase 3) ────────────────────────────────────
  // Maps internal 8-intent taxonomy → 7-intent canonical taxonomy.
  //
  //   CANONICAL: TRANSFER | PAYMENT | SALARY | BUSINESS | LOAN | UNKNOWN | SUSPICIOUS_PROXY
  //
  // 'gambling' → SUSPICIOUS_PROXY (inherently proxy-suspicious, highest risk intent)
  // 'cash'     → TRANSFER (sub-type of movement; cash withdrawal is still a transfer)
  // 'investment' → BUSINESS (investment income is commercial activity)

  const CANONICAL_INTENT_MAP = {
    transfer:    'TRANSFER',
    payment:     'PAYMENT',
    phone_topup: 'PAYMENT',   // phone top-up is a payment sub-type
    salary:      'SALARY',
    business:    'BUSINESS',
    investment:  'BUSINESS',  // merged into BUSINESS
    loan:        'LOAN',
    cash:        'TRANSFER',  // merged into TRANSFER
    gambling:    'SUSPICIOUS_PROXY',
    unknown:     'UNKNOWN',
  };

  function toCanonical(intent) {
    return CANONICAL_INTENT_MAP[intent] || CANONICAL_INTENT_MAP[intent?.toLowerCase()] || 'UNKNOWN';
  }

  // ─── CONTRADICTION DETECTION (Phase 3) ───────────────────────────────────────
  // Detects incompatible intent combinations within the same account.
  // These combinations indicate account is being used for multiple purposes
  // inconsistent with a legitimate financial profile.

  const CONTRADICTION_PAIRS = [
    { a: 'SALARY', b: 'SUSPICIOUS_PROXY', label: 'SALARY_WITH_PROXY' },
    { a: 'SALARY', b: 'LOAN',             label: 'SALARY_WITH_LOAN_SPIRAL' },
    { a: 'BUSINESS', b: 'SUSPICIOUS_PROXY', label: 'BUSINESS_WITH_PROXY' },
    { a: 'PAYMENT', b: 'SUSPICIOUS_PROXY', label: 'PAYMENT_WITH_PROXY' },
  ];

  function detectAccountContradictions(transactions, accountContexts) {
    const result = {};
    Object.entries(accountContexts || {}).forEach(([acc, ctx]) => {
      const intentFreq = ctx.intentFreq || {};
      // Convert to canonical
      const canonicalIntents = {};
      Object.entries(intentFreq).forEach(([raw, count]) => {
        const canonical = toCanonical(raw);
        canonicalIntents[canonical] = (canonicalIntents[canonical] || 0) + count;
      });

      for (const pair of CONTRADICTION_PAIRS) {
        if (canonicalIntents[pair.a] > 0 && canonicalIntents[pair.b] > 0) {
          result[acc] = pair.label;
          break;
        }
      }
    });
    return result;
  }

  function getIntentSummary(transactions) {
    const counts = {};
    transactions.forEach(tx => {
      const k = tx.nlpIntent || 'UNKNOWN';
      counts[k] = (counts[k] || 0) + 1;
    });
    return counts;
  }

  const INTENT_LABELS_VI = {
    // Canonical taxonomy labels (Phase 3)
    TRANSFER:          'Chuyển khoản',
    PAYMENT:           'Thanh toán / Dịch vụ',
    SALARY:            'Lương / Thu nhập',
    BUSINESS:          'Kinh doanh / Đầu tư',
    LOAN:              'Vay / Trả nợ',
    UNKNOWN:           'Không xác định',
    SUSPICIOUS_PROXY:  'Cờ bạc / Chuyển hộ đáng ngờ',
    // Legacy raw intents (keep for backward compat)
    phone_topup:'Nạp tiền điện thoại',
    PHONE_TOPUP:'Nạp tiền điện thoại',
    salary:     'Lương / Thu nhập',
    gambling:   'Cờ bạc / Cá cược',
    loan:       'Vay / Trả nợ',
    investment: 'Đầu tư / Tiết kiệm',
    payment:    'Thanh toán / Dịch vụ',
    cash:       'Rút / Nạp tiền mặt',
    business:   'Kinh doanh / Thương mại',
    transfer:   'Chuyển khoản',
    unknown:    'Không xác định',
  };

  const FRAUD_SIGNAL_LABELS_VI = {
    PROXY_TRANSFER:   'Chuyển hộ / Giữ hộ',
    VAGUE_PURPOSE:    'Mục đích mập mờ',
    INFORMAL_REPAY:   'Hoàn trả không chính thức',
    PASS_THROUGH:     'Qua tay / Chuyển tiếp',
    URGENCY_SIGNAL:   'Giao dịch khẩn cấp',
    STRUCTURING_HINT: 'Chia nhỏ giao dịch',
  };

  const CONTRADICTION_LABELS_VI = {
    SALARY_WITH_PROXY:      'Lương kết hợp chuyển hộ đáng ngờ',
    SALARY_WITH_LOAN_SPIRAL:'Lương kết hợp vay nợ bất thường',
    BUSINESS_WITH_PROXY:    'Kinh doanh kết hợp chuyển hộ',
    PAYMENT_WITH_PROXY:     'Thanh toán kết hợp chuyển hộ',
  };

  function getIntentLabel(intent)         { return INTENT_LABELS_VI[intent]         || intent; }
  function getFraudSignalLabel(signal)    { return FRAUD_SIGNAL_LABELS_VI[signal]    || signal; }
  function getContradictionLabel(type)    { return CONTRADICTION_LABELS_VI[type]     || type; }

  return {
    processAll,
    classifyIntent,
    extractEntities,
    detectFraudLanguage,
    analyzeAccountContext,
    detectIntentShifts,
    detectAccountContradictions,
    groupSimilarTransactions,
    getIntentSummary,
    getIntentLabel,
    getFraudSignalLabel,
    getContradictionLabel,
    toCanonical,
    norm,
  };

})();
