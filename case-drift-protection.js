/**
 * case-drift-protection.js — Cross-Case Statistical Drift Detection (Phase 4)
 *
 * Prevents systematic drift in fraud scoring across multiple investigation cases.
 * Maintains a rolling baseline from the first 3 cases, then flags when subsequent
 * cases deviate significantly from that baseline.
 *
 * MONITORED METRICS:
 *   • Average fraud score across accounts
 *   • Graph entropy (flow chaos level)
 *   • Critical account rate (fraction of CRITICAL accounts)
 *   • NLP intent distribution (Shannon entropy)
 *   • Transaction volume distribution
 */
const CaseDriftProtection = (() => {

  const MAX_HISTORY     = 15;   // rolling window of case statistics
  const BASELINE_MIN    = 3;    // min cases needed to establish baseline

  let _history  = [];           // array of CaseStats
  let _baseline = null;         // computed from first BASELINE_MIN cases

  // ─── STATISTICS HELPERS ───────────────────────────────────────────────────────

  function _mean(arr) {
    return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  }

  function _stdDev(arr) {
    if (arr.length < 2) return 0;
    const m = _mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
  }

  function _shannonEntropy(countMap) {
    const total = Object.values(countMap).reduce((s, v) => s + v, 0);
    if (!total) return 0;
    let e = 0;
    Object.values(countMap).forEach(c => {
      const p = c / total;
      if (p > 0) e -= p * Math.log2(p);
    });
    return Math.round(e * 100) / 100;
  }

  // ─── CASE STATS EXTRACTION ────────────────────────────────────────────────────

  function extractStats(caseId, transactions, accountScores, graphResult) {
    const scores      = Object.values(accountScores).map(a => a.score);
    const critCount   = scores.filter(s => s >= 75).length;
    const highCount   = scores.filter(s => s >= 50 && s < 75).length;
    const amounts     = transactions.map(t => t.amount || 0).filter(a => a > 0);

    // NLP intent distribution entropy
    const intentCounts = {};
    transactions.forEach(t => {
      const k = t.nlpIntent || 'UNKNOWN';
      intentCounts[k] = (intentCounts[k] || 0) + 1;
    });
    const nlpEntropy = _shannonEntropy(intentCounts);

    return {
      caseId,
      avgFraudScore:  Math.round(_mean(scores) * 10) / 10,
      stdFraudScore:  Math.round(_stdDev(scores) * 10) / 10,
      graphEntropy:   graphResult?.entropy || 0,
      criticalRate:   scores.length > 0 ? critCount  / scores.length : 0,
      highRiskRate:   scores.length > 0 ? highCount  / scores.length : 0,
      nlpEntropy,
      txCount:        transactions.length,
      accountCount:   scores.length,
      avgAmount:      Math.round(_mean(amounts)),
      hubCount:       (graphResult?.hubs || []).length,
      launderChains:  (graphResult?.moneyFlowChains || []).filter(c => c.isLayering).length,
      intentCounts,
    };
  }

  // ─── BASELINE COMPUTATION ─────────────────────────────────────────────────────

  function _computeBaseline(stats) {
    return {
      avgFraudScore: _mean(stats.map(s => s.avgFraudScore)),
      graphEntropy:  _mean(stats.map(s => s.graphEntropy)),
      criticalRate:  _mean(stats.map(s => s.criticalRate)),
      nlpEntropy:    _mean(stats.map(s => s.nlpEntropy)),

      // Standard deviations for dynamic thresholds
      stdFraudScore: _stdDev(stats.map(s => s.avgFraudScore)),
      stdEntropy:    _stdDev(stats.map(s => s.graphEntropy)),
      stdCritRate:   _stdDev(stats.map(s => s.criticalRate)),

      fromCaseCount: stats.length,
    };
  }

  // ─── RECORD A CASE ────────────────────────────────────────────────────────────

  function recordCase(caseStats) {
    _history.push(caseStats);
    if (_history.length > MAX_HISTORY) _history.shift();

    // Re-compute baseline from earliest N cases
    if (_history.length >= BASELINE_MIN && !_baseline) {
      _baseline = _computeBaseline(_history.slice(0, BASELINE_MIN));
    }
    // Continuously update baseline with all available cases up to BASELINE_MIN
    if (_history.length >= BASELINE_MIN) {
      _baseline = _computeBaseline(_history.slice(0, Math.min(BASELINE_MIN, _history.length)));
    }
  }

  // ─── DRIFT DETECTION ──────────────────────────────────────────────────────────

  function detectDrift(currentStats) {
    if (!_baseline) {
      return {
        hasDrift: false,
        alerts:   [],
        message:  `Cần ít nhất ${BASELINE_MIN} vụ án để thiết lập baseline.`,
        baseline: null,
      };
    }

    const b      = _baseline;
    const c      = currentStats;
    const alerts = [];

    // ── Fraud score drift (> 2σ + 10 from baseline mean) ─────────────────────
    const fraudDrift = Math.abs(c.avgFraudScore - b.avgFraudScore);
    const fraudThreshold = Math.max(b.stdFraudScore * 2, 10);
    if (fraudDrift > fraudThreshold) {
      alerts.push({
        type:      'FRAUD_SCORE_DRIFT',
        severity:  fraudDrift > fraudThreshold * 2 ? 'HIGH' : 'MEDIUM',
        direction: c.avgFraudScore > b.avgFraudScore ? 'UP' : 'DOWN',
        magnitude: Math.round(fraudDrift * 10) / 10,
        detail:    `Điểm TB: ${c.avgFraudScore} vs baseline ${b.avgFraudScore.toFixed(1)} (±${fraudThreshold.toFixed(1)})`,
      });
    }

    // ── Graph entropy drift (> 0.5 absolute change) ───────────────────────────
    const entropyDrift = Math.abs(c.graphEntropy - b.graphEntropy);
    if (entropyDrift > 0.5) {
      alerts.push({
        type:      'GRAPH_ENTROPY_DRIFT',
        severity:  entropyDrift > 1.0 ? 'HIGH' : 'MEDIUM',
        direction: c.graphEntropy > b.graphEntropy ? 'UP' : 'DOWN',
        magnitude: Math.round(entropyDrift * 100) / 100,
        detail:    `Entropy đồ thị: ${c.graphEntropy.toFixed(2)} vs baseline ${b.graphEntropy.toFixed(2)}`,
      });
    }

    // ── Critical rate spike (> 2.5x baseline) ────────────────────────────────
    if (b.criticalRate > 0.001 && c.criticalRate > b.criticalRate * 2.5) {
      const pctIncrease = Math.round((c.criticalRate / b.criticalRate - 1) * 100);
      alerts.push({
        type:      'CRITICAL_RATE_SPIKE',
        severity:  'HIGH',
        direction: 'UP',
        magnitude: pctIncrease,
        detail:    `Tỷ lệ CRITICAL: ${(c.criticalRate*100).toFixed(1)}% vs baseline ${(b.criticalRate*100).toFixed(1)}%`,
      });
    }

    // ── NLP entropy drift (intent distribution changed significantly) ─────────
    const nlpDrift = Math.abs(c.nlpEntropy - b.nlpEntropy);
    if (nlpDrift > 0.8) {
      alerts.push({
        type:      'NLP_DISTRIBUTION_DRIFT',
        severity:  'MEDIUM',
        direction: c.nlpEntropy > b.nlpEntropy ? 'UP' : 'DOWN',
        magnitude: Math.round(nlpDrift * 100) / 100,
        detail:    `Entropy phân phối mục đích: ${c.nlpEntropy.toFixed(2)} vs baseline ${b.nlpEntropy.toFixed(2)}`,
      });
    }

    return {
      hasDrift:     alerts.length > 0,
      alerts,
      baseline:     b,
      currentStats: c,
      casesInBaseline: b.fromCaseCount,
      message: alerts.length > 0
        ? `Phát hiện ${alerts.length} chỉ số trôi dạt thống kê so với ${b.fromCaseCount} vụ án cơ sở`
        : `Phân phối ổn định trong ngưỡng cho phép (baseline từ ${b.fromCaseCount} vụ án)`,
    };
  }

  // ─── HISTORY & BASELINE QUERY ─────────────────────────────────────────────────

  function getHistory()  { return [..._history]; }
  function getBaseline() { return _baseline; }
  function caseCount()   { return _history.length; }

  function getDriftSummaryForUI() {
    if (!_baseline) return null;
    return {
      caseCount:     _history.length,
      baselineReady: _history.length >= BASELINE_MIN,
      baselineMean:  Math.round(_baseline.avgFraudScore * 10) / 10,
      baselineEntropy: Math.round(_baseline.graphEntropy * 100) / 100,
      baselineCritRate: Math.round(_baseline.criticalRate * 100),
    };
  }

  return {
    recordCase,
    detectDrift,
    extractStats,
    getHistory,
    getBaseline,
    caseCount,
    getDriftSummaryForUI,
  };

})();
