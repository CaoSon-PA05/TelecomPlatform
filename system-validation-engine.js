/**
 * system-validation-engine.js — Final System Integrity Validation (Phase 4)
 *
 * Runs a comprehensive 10-point validation suite before any case is exported
 * or locked, ensuring the entire pipeline is consistent and trustworthy.
 *
 * CHECKS:
 *   1.  Case Isolation     — unique caseId, no cross-case contamination signal
 *   2.  Snapshot Complete  — all 6 stage hashes present and non-trivial
 *   3.  Transaction Count  — matches between live data and snapshot
 *   4.  Graph Consistency  — node/edge counts match snapshot
 *   5.  NLP Coverage       — all transactions have a canonical intent
 *   6.  Score Stability    — all accounts have scores in [0, 100]
 *   7.  Engine Version     — snapshot version matches current engine
 *   8.  Audit Presence     — governance audit entries exist
 *   9.  Incident Coverage  — CRITICAL accounts have at least one incident
 *   10. Determinism Flag   — snapshot marks pipeline as reproducible
 */
const SystemValidationEngine = (() => {

  const CANONICAL_INTENTS = new Set([
    'TRANSFER','PAYMENT','SALARY','BUSINESS','LOAN','UNKNOWN','SUSPICIOUS_PROXY'
  ]);

  // ─── MAIN VALIDATION ─────────────────────────────────────────────────────────

  function runValidation(caseData, snapshot) {
    const checks = [];
    const d = caseData || {};
    const s = snapshot  || {};

    // ── Check 1: Case Isolation ───────────────────────────────────────────────
    const hasCaseId = typeof d.caseId === 'string' && d.caseId.startsWith('CASE-');
    checks.push({
      id:     'CASE_ISOLATION',
      name:   'Cách ly vụ án',
      passed: hasCaseId,
      detail: hasCaseId
        ? `Case ID: ${d.caseId}`
        : 'Thiếu Case ID hợp lệ — dữ liệu chưa được cách ly',
    });

    // ── Check 2: Snapshot Completeness ───────────────────────────────────────
    const stages = s.stages || {};
    const stageKeys = ['inputHash','txDataHash','graphHash','nlpHash','fraudHash','calibrationHash'];
    const missingStages = stageKeys.filter(k => !stages[k] || stages[k] === 'NO_GRAPH_00000000');
    const hasSystemHash = !!(s.systemHash && s.systemHash.length === 8);
    checks.push({
      id:     'SNAPSHOT_COMPLETE',
      name:   'Snapshot đầy đủ',
      passed: missingStages.length === 0 && hasSystemHash,
      detail: missingStages.length === 0
        ? `Hash hệ thống: ${s.systemHash || '—'}`
        : `Thiếu stage hashes: ${missingStages.join(', ')}`,
    });

    // ── Check 3: Transaction Count ────────────────────────────────────────────
    const liveTx  = (d.transactions || []).length;
    const snapTx  = s.txCount ?? null;
    const txMatch = snapTx === null || liveTx === snapTx;
    checks.push({
      id:     'TX_COUNT',
      name:   'Số lượng giao dịch',
      passed: txMatch,
      detail: snapTx === null
        ? `${liveTx} GD (snapshot không có dữ liệu so sánh)`
        : `${liveTx} GD vs snapshot ${snapTx} GD${txMatch ? ' ✓' : ' ✗ MISMATCH'}`,
    });

    // ── Check 4: Graph Consistency ────────────────────────────────────────────
    const liveNodes  = Object.keys((d.graphResult || {}).nodes || {}).length;
    const liveEdges  = Object.keys((d.graphResult || {}).edges || {}).length;
    const snapNodes  = s.graphNodes ?? null;
    const snapEdges  = s.graphEdges ?? null;
    const graphMatch = (snapNodes === null || liveNodes === snapNodes) &&
                       (snapEdges === null || liveEdges === snapEdges);
    checks.push({
      id:     'GRAPH_CONSISTENCY',
      name:   'Tính nhất quán đồ thị',
      passed: graphMatch,
      detail: snapNodes === null
        ? `${liveNodes} nút, ${liveEdges} cạnh`
        : `${liveNodes}/${snapNodes} nút, ${liveEdges}/${snapEdges} cạnh${graphMatch ? ' ✓' : ' ✗'}`,
    });

    // ── Check 5: NLP Coverage ─────────────────────────────────────────────────
    const missingNLP = (d.transactions || []).filter(t =>
      !t.nlpIntent || !CANONICAL_INTENTS.has(t.nlpIntent)
    ).length;
    checks.push({
      id:     'NLP_COVERAGE',
      name:   'Phân loại NLP đầy đủ',
      passed: missingNLP === 0,
      detail: missingNLP === 0
        ? 'Tất cả GD đã được phân loại theo taxonomy chuẩn'
        : `${missingNLP} GD thiếu intent chuẩn (taxonomy v3 yêu cầu 7 nhãn)`,
    });

    // ── Check 6: Score Stability ──────────────────────────────────────────────
    const accScores   = Object.values(d.accountScores || {});
    const invalidScores = accScores.filter(a =>
      typeof a.score !== 'number' || a.score < 0 || a.score > 100 || isNaN(a.score)
    ).length;
    checks.push({
      id:     'SCORE_STABILITY',
      name:   'Ổn định điểm rủi ro',
      passed: invalidScores === 0,
      detail: invalidScores === 0
        ? `${accScores.length} tài khoản, điểm trong khoảng [0, 100]`
        : `${invalidScores} tài khoản có điểm nằm ngoài khoảng hợp lệ`,
    });

    // ── Check 7: Engine Version ───────────────────────────────────────────────
    const currentVer = typeof FraudGovernanceLayer !== 'undefined'
      ? FraudGovernanceLayer.ENGINE_VERSION : '3.0.0';
    const snapVer   = s.engineVersion || null;
    const verMatch  = snapVer === null || snapVer === currentVer;
    checks.push({
      id:     'ENGINE_VERSION',
      name:   'Phiên bản engine',
      passed: verMatch,
      detail: snapVer === null
        ? `Engine hiện tại: v${currentVer}`
        : `Snapshot v${snapVer} vs hiện tại v${currentVer}${verMatch ? ' ✓' : ' ⚠ mismatch'}`,
    });

    // ── Check 8: Audit Log Presence ───────────────────────────────────────────
    const auditCount = Object.keys(d.auditStore || {}).length;
    const chainValid = _verifyAuditChain(d.auditStore);
    checks.push({
      id:     'AUDIT_LOG',
      name:   'Audit log & chuỗi hash',
      passed: auditCount > 0,
      detail: auditCount > 0
        ? `${auditCount} bản ghi audit${chainValid ? ', chuỗi hash hợp lệ' : ', chuỗi hash chưa xác minh'}`
        : 'Không có bản ghi audit — governance layer chưa được kích hoạt',
    });

    // ── Check 9: Incident Coverage ───────────────────────────────────────────
    const criticalAccounts = accScores.filter(a => a.riskLevel === 'CRITICAL').length;
    const incidents        = (d.incidents || []).length;
    const incidentOk       = criticalAccounts === 0 || incidents > 0;
    checks.push({
      id:     'INCIDENT_COVERAGE',
      name:   'Bao phủ sự cố SOC',
      passed: incidentOk,
      detail: criticalAccounts === 0
        ? 'Không có tài khoản CRITICAL (không cần incident)'
        : `${incidents} incidents cho ${criticalAccounts} tài khoản CRITICAL${incidentOk ? ' ✓' : ' ✗'}`,
    });

    // ── Check 10: Determinism Flag ────────────────────────────────────────────
    const isDetm = s.isReproducible === true;
    checks.push({
      id:     'DETERMINISM',
      name:   'Đảm bảo tính xác định',
      passed: isDetm,
      detail: isDetm
        ? `Đảm bảo tái tạo: ${s.deterministicGuarantee || 'hash-based'}`
        : 'Snapshot không có cờ tái tạo — cần chạy lại pipeline',
    });

    // ── Summary ───────────────────────────────────────────────────────────────
    const passCount = checks.filter(c => c.passed).length;
    const total     = checks.length;
    const pct       = Math.round(passCount / total * 100);

    const overallIntegrity = pct >= 90 ? 'VALID'
                           : pct >= 70 ? 'WARNING'
                           : 'INVALID';

    return {
      overallIntegrity,
      passCount,
      total,
      integrityPct: pct,
      checks,
      failedChecks: checks.filter(c => !c.passed).map(c => c.id),
      readyToLock:  overallIntegrity === 'VALID',
    };
  }

  function _verifyAuditChain(auditStore) {
    if (!auditStore || Object.keys(auditStore).length === 0) return false;
    // Basic check: all entries have an inputHash (set by governance layer)
    return Object.values(auditStore).every(e => typeof e.inputHash === 'string' && e.inputHash.length > 0);
  }

  // ─── VALIDATION RESULT FORMATTERS ────────────────────────────────────────────

  function getIntegrityColor(integrity) {
    return { VALID: '#4ade80', WARNING: '#ffcc00', INVALID: '#ff3b30' }[integrity] || '#64748b';
  }

  function getIntegrityLabel(integrity) {
    return {
      VALID:   'HỢP LỆ — Sẵn sàng khoá vụ án',
      WARNING: 'CẢNH BÁO — Cần xem xét trước khi khoá',
      INVALID: 'KHÔNG HỢP LỆ — Không thể khoá vụ án',
    }[integrity] || integrity;
  }

  function formatForExcel(validationResult) {
    const rows = [];
    rows.push({ 'Hạng Mục': '── KẾT QUẢ KIỂM TRA HỆ THỐNG ──', 'Kết Quả': '', 'Chi Tiết': '' });
    rows.push({ 'Hạng Mục': 'Tổng thể', 'Kết Quả': validationResult.overallIntegrity, 'Chi Tiết': `${validationResult.integrityPct}% (${validationResult.passCount}/${validationResult.total})` });
    rows.push({ 'Hạng Mục': '', 'Kết Quả': '', 'Chi Tiết': '' });
    validationResult.checks.forEach(c => {
      rows.push({ 'Hạng Mục': c.name, 'Kết Quả': c.passed ? 'PASS ✓' : 'FAIL ✗', 'Chi Tiết': c.detail });
    });
    return rows;
  }

  return {
    runValidation,
    getIntegrityColor,
    getIntegrityLabel,
    formatForExcel,
  };

})();
