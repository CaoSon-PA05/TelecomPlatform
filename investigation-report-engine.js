/**
 * investigation-report-engine.js v3 — Forensic Report with Proof Integrity (Phase 3)
 *
 * Phase 3 Upgrades:
 *   ① PROOF INTEGRITY CHECK: Every narrative claim is validated against actual
 *      evidence before inclusion. Claims without backing evidence are suppressed.
 *   ② EVIDENCE COMPLETENESS SCORING: Each account report receives an integrity
 *      score (0–100%). Low-integrity reports are clearly flagged.
 *   ③ CONFIDENCE DOWNGRADE: If evidence is insufficient, account confidence
 *      is downgraded and the report notes the data quality limitation.
 *   ④ NO HALLUCINATED REASONING: Only reasons directly traceable to specific
 *      transactions, graph edges, or NLP signals are included.
 *
 * Retained from v2: narrative generation, evidence mapping, anomaly timeline,
 * risk chain analysis, Excel export.
 */
const InvestigationReportEngine = (() => {

  // ─── CONSTANTS ───────────────────────────────────────────────────────────────

  const RISK_THRESHOLDS = { CRITICAL: 75, HIGH: 50, MEDIUM: 25 };

  const REASON_NARRATIVES_VI = {
    // Tagging engine signals
    GAMBLING_SIGNAL:      'Phát hiện ngôn ngữ giao dịch liên quan đến cờ bạc/cá cược',
    RISK_PATTERN:         'Tổ hợp dấu hiệu rủi ro (số tiền lớn + giờ nhạy cảm)',
    VERY_LARGE_AMOUNT:    'Giao dịch giá trị cực lớn (>500 triệu VND)',
    LARGE_AMOUNT:         'Giao dịch giá trị lớn (>150 triệu VND)',
    OFF_HOURS:            'Giao dịch ngoài giờ hành chính (23h – 4h sáng)',
    HIGH_FREQUENCY:       'Tần suất giao dịch cao bất thường (>=5 lần cùng số tiền)',
    SMALL_SPLIT_TRANSFER: 'Phát hiện chia nhỏ giao dịch trong cùng khung giờ',
    ROUND_AMOUNT:         'Số tiền chẵn tròn đặc trưng (dấu hiệu cấu trúc)',
    REPEATED_AMOUNT:      'Số tiền lặp lại nhiều lần từ cùng tài khoản',
    HIGH_DAILY_FREQUENCY: 'Số lượng giao dịch trong một ngày vượt ngưỡng',
    // NLP signals
    FRAUD_LANGUAGE:       'Ngôn ngữ giao dịch đặc trưng chuyển hộ/giả mạo mục đích',
    INTENT_SHIFT:         'Thay đổi đột ngột hành vi giao dịch so với lịch sử',
    ANOMALOUS_INTENT:     'Loại giao dịch bất thường so với thói quen tài khoản',
    // Behavioral drift (v2)
    AMOUNT_DRIFT:         'Giá trị giao dịch gần đây lệch >150% so với cơ sở',
    FREQUENCY_DRIFT:      'Tần suất giao dịch gần đây tăng >2.5 lần so với lịch sử',
    HOUR_DRIFT:           'Khung giờ giao dịch chuyển dịch >6 tiếng so với cơ sở',
    // Graph signals
    IN_SUSPICIOUS_CLUSTER:'Thuộc cụm tài khoản đáng ngờ với mật độ giao dịch cao',
    NETWORK_HUB:          'Đây là nút trung tâm trong mạng lưới giao dịch (hub)',
    HIGH_INFLUENCE_NODE:  'Chỉ số PageRank cao — ảnh hưởng lớn trong mạng lưới',
    MANY_COUNTERPARTIES:  'Giao dịch với nhiều tài khoản đối ứng khác nhau (>5)',
    PROPAGATED_RISK:      'Rủi ro lan truyền từ tài khoản liên kết có điểm cao',
    // Behavioral (legacy)
    HIGH_NIGHT_RATIO:     'Hơn 35% giao dịch diễn ra trong đêm khuya',
    INCONSISTENT_AMOUNTS: 'Biến động số tiền giao dịch rất lớn (CV > 2.5)',
    HIGH_INTENT_ENTROPY:  'Nhiều loại mục đích giao dịch khác nhau (>5 nhóm)',
    RAPID_LARGE_TRANSFERS:'Nhiều giao dịch lớn liên tiếp trong khoảng <10 phút',
    // Burst (v2)
    BURST_1H:             'Đột biến hoạt động trong vòng 1 giờ',
    BURST_6H:             'Đột biến hoạt động trong vòng 6 giờ',
    BURST_24H:            'Đột biến hoạt động trong vòng 24 giờ',
  };

  function getReasonNarrative(reason) {
    return REASON_NARRATIVES_VI[reason] || reason;
  }

  // ─── DATE HELPERS ─────────────────────────────────────────────────────────────

  function parseDateMs(dateStr) {
    if (!dateStr) return 0;
    const s = String(dateStr);
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}:00`).getTime();
    const ts = new Date(s).getTime();
    return isNaN(ts) ? 0 : ts;
  }

  function fmtVND(n) {
    if (!n && n !== 0) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + ' tỷ VND';
    if (n >= 1e6) return (n / 1e6).toFixed(0) + ' triệu VND';
    return n.toLocaleString('vi-VN') + ' VND';
  }

  function fmtDate(dateStr) { return (dateStr || '').slice(0, 16); }

  // ─── NARRATIVE GENERATOR ──────────────────────────────────────────────────────

  // ─── PROOF INTEGRITY VALIDATION (Phase 3 NEW) ────────────────────────────────
  // Validates that each claimed reason has backing evidence before including
  // it in the narrative. Returns an integrity assessment.

  function validateProofIntegrity(accountEntry, txsForAccount, graphResult) {
    const reasons       = accountEntry.reasons || [];
    const checkedClaims = [];
    let   evidencedCount = 0;

    // Claim validators: each returns true if there is actual evidence for this claim
    const VALIDATORS = {
      GAMBLING_SIGNAL:     () => txsForAccount.some(t => (t.tags||[]).includes('GAMBLING_SIGNAL')),
      RISK_PATTERN:        () => txsForAccount.some(t => (t.tags||[]).includes('RISK_PATTERN')),
      VERY_LARGE_AMOUNT:   () => txsForAccount.some(t => t.amount >= 500_000_000),
      LARGE_AMOUNT:        () => txsForAccount.some(t => t.amount >= 150_000_000),
      OFF_HOURS:           () => txsForAccount.some(t => {
        const m = (t.transactionDate||t.date||'').match(/[T\s](\d{2}):/);
        return m && [23,0,1,2,3,4].includes(parseInt(m[1]));
      }),
      HIGH_FREQUENCY:      () => txsForAccount.some(t => (t.tags||[]).includes('HIGH_FREQUENCY')),
      SMALL_SPLIT_TRANSFER:() => txsForAccount.some(t => (t.tags||[]).includes('SMALL_SPLIT_TRANSFER')),
      ROUND_AMOUNT:        () => txsForAccount.some(t => (t.tags||[]).includes('ROUND_AMOUNT')),
      FRAUD_LANGUAGE:      () => txsForAccount.some(t => (t.fraudLanguageSignals||[]).length > 0),
      INTENT_SHIFT:        () => txsForAccount.some(t => t.hasIntentShift),
      NETWORK_HUB:         () => graphResult && (graphResult.hubs||[]).some(h => h.id === accountEntry.account),
      IN_SUSPICIOUS_CLUSTER:() => graphResult && (graphResult.suspiciousClusters||[]).some(c => c.isSuspicious && c.community.includes(accountEntry.account)),
      NETWORK_FLOW_CHAIN:  () => graphResult && (graphResult.moneyFlowChains||[]).some(c => c.path.includes(accountEntry.account)),
      AMOUNT_DRIFT:        () => txsForAccount.some(t => (t.fraudReasons||[]).includes('AMOUNT_DRIFT')),
      FREQUENCY_DRIFT:     () => txsForAccount.some(t => (t.fraudReasons||[]).includes('FREQUENCY_DRIFT')),
      HIGH_NIGHT_RATIO:    () => txsForAccount.some(t => (t.fraudReasons||[]).includes('HIGH_NIGHT_RATIO')),
      RAPID_LARGE_TRANSFERS:()=> txsForAccount.some(t => (t.fraudReasons||[]).includes('RAPID_LARGE_TRANSFERS')),
      BURST_1H:            () => txsForAccount.some(t => (t.tags||[]).includes('HIGH_DAILY_FREQUENCY')),
      BURST_6H:            () => txsForAccount.some(t => (t.tags||[]).includes('HIGH_DAILY_FREQUENCY')),
    };

    reasons.forEach(reason => {
      const validator = VALIDATORS[reason];
      const hasEvidence = validator ? validator() : false;
      checkedClaims.push({ reason, hasEvidence, narrative: getReasonNarrative(reason) });
      if (hasEvidence) evidencedCount++;
    });

    const integrityScore = reasons.length > 0
      ? Math.round(evidencedCount / reasons.length * 100)
      : 100; // no claims = fully intact (vacuously true)

    const isHighIntegrity = integrityScore >= 70;

    return {
      integrityScore,
      isHighIntegrity,
      evidencedClaims: checkedClaims.filter(c => c.hasEvidence),
      unsupportedClaims: checkedClaims.filter(c => !c.hasEvidence),
      checkedClaims,
    };
  }

  function buildNarrative(accountEntry, txsForAccount, graphResult) {
    const { account, score, riskLevel, reasons, breakdown } = accountEntry;

    // Phase 3: Validate all claims before including them in narrative
    const integrity = validateProofIntegrity(accountEntry, txsForAccount, graphResult);

    const parts = [];
    const bankName = txsForAccount[0]?.bankName || txsForAccount[0]?.bank || 'Chưa xác định';

    // Header sentence with confidence qualifier
    const riskLabel = { CRITICAL: 'RẤT NGUY HIỂM', HIGH: 'NGUY HIỂM CAO', MEDIUM: 'CẦN THEO DÕI', LOW: 'BÌNH THƯỜNG' }[riskLevel] || riskLevel;
    const confLabel = integrity.integrityScore >= 80 ? '' : ` (độ chắc chắn bằng chứng: ${integrity.integrityScore}%)`;
    parts.push(`Tài khoản ${account} (${bankName}) được chấm điểm ${score}/100 — Mức độ ${riskLabel}${confLabel}.`);

    // Layer breakdown (from calibration)
    const cal = accountEntry.calibration?.breakdown || breakdown;
    if (cal) {
      const txPts    = cal.nlpContribution || cal.txScore || 0;
      const gPts     = cal.graphContribution || cal.graphScore || 0;
      const bPts     = cal.behavioralContribution || cal.behavioralScore || 0;
      const tPts     = cal.temporalContribution || cal.burstScore || 0;
      if (txPts + gPts + bPts + tPts > 0) {
        parts.push(`Cấu thành điểm: NLP/GD ${txPts}pts · Đồ thị ${gPts}pts · Hành vi ${bPts}pts · Đột biến +${tPts}pts.`);
      }
    }

    // Phase 3: Only include EVIDENCED reasons in narrative
    const evidencedReasons = integrity.evidencedClaims.slice(0, 3);
    if (evidencedReasons.length > 0) {
      parts.push('Bằng chứng xác nhận: ' + evidencedReasons.map(c => c.narrative).join('; ') + '.');
    }

    // Note unsupported claims (but don't suppress report)
    if (integrity.unsupportedClaims.length > 0 && !integrity.isHighIntegrity) {
      parts.push(`[Lưu ý: ${integrity.unsupportedClaims.length} yếu tố chưa có bằng chứng trực tiếp — cần điều tra thêm.]`);
    }

    // Anomalous transactions (actual evidence)
    const highRiskTxs = txsForAccount.filter(t => (t.fraudScore || 0) >= 50);
    if (highRiskTxs.length > 0) {
      const biggest = highRiskTxs.sort((a, b) => b.amount - a.amount)[0];
      parts.push(`Giao dịch nguy hiểm nhất: ${fmtVND(biggest.amount)} vào ${fmtDate(biggest.transactionDate || biggest.date)} — "${(biggest.description || biggest.content || '').slice(0, 60)}".`);
    }

    // Graph context (only if graph evidence confirmed)
    if (graphResult) {
      const node = graphResult.nodes[account];
      if (node && node.degree > 5 && integrity.evidencedClaims.some(c => c.reason === 'NETWORK_HUB')) {
        parts.push(`Tài khoản có ${node.degree} kết nối đối ứng — được xác định là nút hub trong mạng lưới.`);
      }
      const cluster = (graphResult.suspiciousClusters || []).find(c => c.isSuspicious && c.community.includes(account));
      if (cluster && integrity.evidencedClaims.some(c => c.reason === 'IN_SUSPICIOUS_CLUSTER')) {
        parts.push(`Thuộc cụm giao dịch đáng ngờ gồm ${cluster.size} tài khoản, tổng giá trị ${fmtVND(cluster.totalVolume)}.`);
      }
      const chains = (graphResult.moneyFlowChains || []).filter(c => c.path.includes(account) && c.isLayering);
      if (chains.length > 0) {
        parts.push(`Tài khoản xuất hiện trong ${chains.length} chuỗi luân chuyển tiền đa cấp (phân tầng).`);
      }
    }

    // NLP fraud language (actual evidence)
    const fraudLangTxs = txsForAccount.filter(t => (t.fraudLanguageSignals || []).length > 0);
    if (fraudLangTxs.length > 0) {
      const signals = [...new Set(fraudLangTxs.flatMap(t => t.fraudLanguageSignals || []))];
      parts.push(`Phát hiện ngôn ngữ giao dịch bất thường: ${signals.map(s => NLPEngine.getFraudSignalLabel(s)).join(', ')}.`);
    }

    // NLP contradiction
    if (txsForAccount.some(t => t.hasContradiction)) {
      const contType = txsForAccount.find(t => t.contradictionType)?.contradictionType;
      const contLabel = contType ? NLPEngine.getContradictionLabel(contType) : 'Mâu thuẫn hành vi';
      parts.push(`Phát hiện mâu thuẫn hành vi: ${contLabel}.`);
    }

    return parts.join(' ');
  }

  // ─── EVIDENCE MAPPER ─────────────────────────────────────────────────────────

  function mapEvidence(accountEntry, txsForAccount, graphResult) {
    const { account } = accountEntry;

    // Transaction evidence: top risky transactions
    const txEvidence = txsForAccount
      .filter(t => (t.fraudScore || 0) >= 25)
      .sort((a, b) => (b.fraudScore || 0) - (a.fraudScore || 0))
      .slice(0, 10)
      .map(t => ({
        txId:        t.transactionId || t.code || '',
        date:        fmtDate(t.transactionDate || t.date),
        amount:      t.amount,
        amountFmt:   fmtVND(t.amount),
        type:        t.transactionType || '',
        description: (t.description || t.content || '').slice(0, 80),
        fraudScore:  t.fraudScore || 0,
        tags:        t.tags || [],
        nlpIntent:   t.nlpIntent || '',
        fraudLanguage: t.fraudLanguageSignals || [],
      }));

    // Graph edge evidence: edges involving this account
    const edgeEvidence = graphResult
      ? Object.entries(graphResult.edges || {})
          .filter(([key, e]) => e.source === account || e.target === account)
          .map(([key, e]) => ({
            edgeKey:        key,
            from:           e.source,
            to:             e.target,
            txCount:        e.count,
            totalVolume:    e.volume,
            volumeFmt:      fmtVND(e.volume),
            temporalWeight: Math.round((e.temporalWeight || 0) * 100) / 100,
            lastDate:       fmtDate(e.lastDate),
          }))
          .sort((a, b) => b.totalVolume - a.totalVolume)
          .slice(0, 8)
      : [];

    // NLP trigger evidence
    const nlpEvidence = txsForAccount
      .filter(t => (t.fraudLanguageSignals || []).length > 0 || t.hasIntentShift || t.anomalousIntent)
      .map(t => ({
        txId:           t.transactionId || t.code || '',
        date:           fmtDate(t.transactionDate || t.date),
        description:    (t.description || t.content || '').slice(0, 80),
        nlpIntent:      t.nlpIntent || '',
        fraudSignals:   (t.fraudLanguageSignals || []).map(s => NLPEngine.getFraudSignalLabel(s)),
        hasIntentShift: t.hasIntentShift || false,
      }))
      .slice(0, 6);

    return { txEvidence, edgeEvidence, nlpEvidence };
  }

  // ─── ANOMALY TIMELINE ─────────────────────────────────────────────────────────

  function buildAnomalyTimeline(transactions) {
    const anomalies = transactions
      .filter(t => (t.fraudScore || 0) >= 50 || (t.tags || []).includes('RISK_PATTERN') || (t.fraudLanguageSignals || []).length > 0)
      .map(t => ({
        date:        t.transactionDate || t.date || '',
        dateMs:      parseDateMs(t.transactionDate || t.date),
        account:     t.accountNumber,
        bank:        t.bankName || t.bank || '',
        amount:      t.amount,
        amountFmt:   fmtVND(t.amount),
        type:        t.transactionType || '',
        fraudScore:  t.fraudScore || 0,
        riskLevel:   t.riskLevel || 'MEDIUM',
        topTag:      (t.tags || [])[0] || '',
        description: (t.description || t.content || '').slice(0, 60),
        hasFraudLang: (t.fraudLanguageSignals || []).length > 0,
      }))
      .sort((a, b) => a.dateMs - b.dateMs)
      .slice(0, 50);  // cap at 50 events for readability

    return anomalies;
  }

  // ─── RISK CHAIN SUMMARY ──────────────────────────────────────────────────────

  function buildRiskChainReport(graphResult, accountScores) {
    if (!graphResult) return [];
    return (graphResult.moneyFlowChains || [])
      .map(chain => {
        const pathScores = chain.path.map(id => accountScores[id]?.score || 0);
        const maxScore   = Math.max(...pathScores);
        const avgScore   = pathScores.reduce((s, v) => s + v, 0) / Math.max(1, pathScores.length);

        return {
          path:          chain.path,
          pathDisplay:   chain.path.map(id => id.slice(0, 12)).join(' → '),
          hops:          chain.hops,
          chainVolume:   chain.chainVolume,
          volumeFmt:     fmtVND(chain.chainVolume),
          isLayering:    chain.isLayering,
          isRapid:       chain.isRapid,
          suspicionScore: chain.suspicionScore || 0,
          maxNodeScore:  maxScore,
          avgNodeScore:  Math.round(avgScore),
          maxTimespan:   chain.maxTimespanHours || 0,
        };
      })
      .sort((a, b) => b.suspicionScore - a.suspicionScore || b.chainVolume - a.chainVolume)
      .slice(0, 10);
  }

  // ─── MAIN REPORT GENERATOR ───────────────────────────────────────────────────

  /**
   * Generate a complete forensic intelligence report.
   * @param {Array}  transactions   — fully scored transactions (after FraudEngine)
   * @param {Object} graphResult    — GraphEngine.analyze() result
   * @param {Object} accountScores  — FraudEngine.accountScores
   * @returns {Object} Full structured report (ReportDocument)
   */
  function generateReport(transactions, graphResult, accountScores) {
    const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // Group transactions by account
    const byAccount = {};
    transactions.forEach(tx => {
      const acc = tx.accountNumber || '_unknown';
      if (!byAccount[acc]) byAccount[acc] = [];
      byAccount[acc].push(tx);
    });

    // ── SUMMARY ────────────────────────────────────────────────────────────────
    const leaderboard = FraudEngine.buildRiskLeaderboard(accountScores);
    const criticalAccounts = leaderboard.filter(a => a.riskLevel === 'CRITICAL');
    const highAccounts     = leaderboard.filter(a => a.riskLevel === 'HIGH');
    const anomalyCount     = transactions.filter(t => (t.fraudScore || 0) >= 50).length;
    const fraudLangCount   = transactions.filter(t => (t.fraudLanguageSignals || []).length > 0).length;
    const chainCount       = (graphResult?.moneyFlowChains || []).filter(c => c.isLayering).length;
    const totalVolume      = transactions.reduce((s, t) => s + t.amount, 0);

    const summary = {
      generatedAt,
      totalTransactions:  transactions.length,
      totalAccounts:      Object.keys(accountScores).length,
      totalVolume,
      totalVolumeFmt:     fmtVND(totalVolume),
      criticalCount:      criticalAccounts.length,
      highRiskCount:      highAccounts.length,
      anomalyCount,
      fraudLanguageCount: fraudLangCount,
      launderingChains:   chainCount,
      graphNodes:         graphResult?.stats?.nodeCount || 0,
      graphEdges:         graphResult?.stats?.edgeCount || 0,
      communities:        graphResult?.stats?.communityCount || 0,
      topRiskAccount:     leaderboard[0]?.account || '—',
      topRiskScore:       leaderboard[0]?.score || 0,
    };

    // ── SUSPICIOUS ACCOUNT REPORTS (with Proof Integrity — Phase 3) ─────────────
    const suspiciousAccountReports = leaderboard
      .filter(a => a.score >= RISK_THRESHOLDS.MEDIUM)
      .slice(0, 20)
      .map(accountEntry => {
        const txsForAccount = byAccount[accountEntry.account] || [];

        // Phase 3: Run proof integrity check BEFORE generating narrative
        const integrityResult = validateProofIntegrity(accountEntry, txsForAccount, graphResult);

        // Downgrade confidence if evidence is low-quality
        const adjustedEntry = integrityResult.integrityScore < 50
          ? { ...accountEntry, overallConfidence: Math.round((accountEntry.overallConfidence || 80) * 0.7) }
          : accountEntry;

        const narrative = buildNarrative(adjustedEntry, txsForAccount, graphResult);
        const evidence  = mapEvidence(adjustedEntry, txsForAccount, graphResult);

        return {
          ...adjustedEntry,
          narrative,
          evidence,
          integrityScore:   integrityResult.integrityScore,
          isHighIntegrity:  integrityResult.isHighIntegrity,
          unsupportedClaims: integrityResult.unsupportedClaims.map(c => c.reason),
          inflow:    fmtVND(txsForAccount.filter(t=>t.transactionType==='IN').reduce((s,t)=>s+t.amount,0)),
          outflow:   fmtVND(txsForAccount.filter(t=>t.transactionType==='OUT').reduce((s,t)=>s+t.amount,0)),
          dateRange: _dateRange(txsForAccount),
        };
      });

    // ── RISK CHAINS ───────────────────────────────────────────────────────────
    const riskChains = buildRiskChainReport(graphResult, accountScores);

    // ── ANOMALY TIMELINE ──────────────────────────────────────────────────────
    const anomalyTimeline = buildAnomalyTimeline(transactions);

    return {
      summary,
      suspiciousAccountReports,
      riskChains,
      anomalyTimeline,
      _generatedAt: generatedAt,
    };
  }

  function _dateRange(txs) {
    const ms = txs.map(t => parseDateMs(t.transactionDate || t.date)).filter(d => d > 0);
    if (ms.length === 0) return '—';
    const lo = new Date(Math.min(...ms)).toLocaleDateString('vi-VN');
    const hi = new Date(Math.max(...ms)).toLocaleDateString('vi-VN');
    return lo === hi ? lo : `${lo} → ${hi}`;
  }

  // ─── EXCEL SHEET BUILDER ─────────────────────────────────────────────────────
  // Returns an array of row objects for XLSX.utils.json_to_sheet()

  function buildExcelSheet(report) {
    const rows = [];

    // Header block
    rows.push({ 'MỤC': '── BÁO CÁO ĐIỀU TRA FORENSIC ──', 'NỘI DUNG': '' });
    rows.push({ 'MỤC': 'Thời gian tạo báo cáo', 'NỘI DUNG': report.summary.generatedAt });
    rows.push({ 'MỤC': '', 'NỘI DUNG': '' });

    // Summary
    rows.push({ 'MỤC': '── TỔNG QUAN ──', 'NỘI DUNG': '' });
    rows.push({ 'MỤC': 'Tổng số giao dịch',             'NỘI DUNG': report.summary.totalTransactions });
    rows.push({ 'MỤC': 'Tổng số tài khoản',             'NỘI DUNG': report.summary.totalAccounts });
    rows.push({ 'MỤC': 'Tổng giá trị dòng tiền',        'NỘI DUNG': report.summary.totalVolumeFmt });
    rows.push({ 'MỤC': 'Tài khoản rủi ro CRITICAL',     'NỘI DUNG': report.summary.criticalCount });
    rows.push({ 'MỤC': 'Tài khoản rủi ro HIGH',         'NỘI DUNG': report.summary.highRiskCount });
    rows.push({ 'MỤC': 'Giao dịch bất thường (>=50đ)',  'NỘI DUNG': report.summary.anomalyCount });
    rows.push({ 'MỤC': 'GD có ngôn ngữ giao dịch bất thường', 'NỘI DUNG': report.summary.fraudLanguageCount });
    rows.push({ 'MỤC': 'Chuỗi rửa tiền phân tầng',      'NỘI DUNG': report.summary.launderingChains });
    rows.push({ 'MỤC': 'Tài khoản rủi ro cao nhất',     'NỘI DUNG': `${report.summary.topRiskAccount} (${report.summary.topRiskScore} điểm)` });
    rows.push({ 'MỤC': '', 'NỘI DUNG': '' });

    // Suspicious accounts
    rows.push({ 'MỤC': '── TÀI KHOẢN ĐÁNG NGHI ──', 'NỘI DUNG': '' });
    rows.push({ 'MỤC': 'Hạng', 'NỘI DUNG': 'Tài Khoản | Ngân Hàng | Điểm | Mức Độ | Số GD | Khối Lượng | Phân Tích' });

    report.suspiciousAccountReports.forEach(acct => {
      rows.push({
        'MỤC': `#${acct.rank}`,
        'NỘI DUNG': `${acct.account} | ${_bankOf(acct)} | ${acct.score} | ${acct.riskLevel} | ${acct.txCount} GD | ${acct.totalVolume/1e6 | 0}M VND | ${acct.narrative}`,
      });
    });

    rows.push({ 'MỤC': '', 'NỘI DUNG': '' });

    // Risk chains
    if (report.riskChains.length > 0) {
      rows.push({ 'MỤC': '── CHUỖI LUÂN CHUYỂN TIỀN ──', 'NỘI DUNG': '' });
      rows.push({ 'MỤC': 'Chuỗi', 'NỘI DUNG': 'Đường đi | Số bước | Khối lượng | Nghi ngờ | Phân tầng | Thời gian' });
      report.riskChains.forEach((c, i) => {
        rows.push({
          'MỤC': `C${i+1}`,
          'NỘI DUNG': `${c.pathDisplay} | ${c.hops} bước | ${c.volumeFmt} | Score ${c.suspicionScore} | ${c.isLayering ? 'Phân tầng ✓' : ''} | ${c.maxTimespan}h`,
        });
      });
      rows.push({ 'MỤC': '', 'NỘI DUNG': '' });
    }

    // Timeline
    if (report.anomalyTimeline.length > 0) {
      rows.push({ 'MỤC': '── DÒNG THỜI GIAN SỰ KIỆN ──', 'NỘI DUNG': '' });
      rows.push({ 'MỤC': 'Thời gian', 'NỘI DUNG': 'Tài khoản | Ngân hàng | Số tiền | Loại | Điểm | Nội dung' });
      report.anomalyTimeline.forEach(evt => {
        rows.push({
          'MỤC': evt.date.slice(0, 16),
          'NỘI DUNG': `${evt.account} | ${evt.bank} | ${evt.amountFmt} | ${evt.type} | ${evt.fraudScore}đ | ${evt.description}`,
        });
      });
    }

    return rows;
  }

  function _bankOf(acct) {
    return acct.evidence?.txEvidence?.[0]
      ? (acct.evidence.txEvidence[0].bankName || acct.evidence.txEvidence[0].bank || '')
      : '';
  }

  return {
    generateReport,
    buildNarrative,
    mapEvidence,
    validateProofIntegrity,
    buildAnomalyTimeline,
    buildRiskChainReport,
    buildExcelSheet,
    getReasonNarrative,
    fmtVND,
  };

})();
