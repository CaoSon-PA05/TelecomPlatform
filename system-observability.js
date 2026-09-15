/**
 * system-observability.js — SOC Pipeline Health Monitoring (Phase 3)
 *
 * PURPOSE:
 *   Track system behavior across runs to enable SOC-level pipeline monitoring.
 *
 * METRICS TRACKED:
 *   • Score distribution (mean, median, std, p90)
 *   • Graph entropy level
 *   • NLP intent distribution & contradiction rate
 *   • Fraud alert volume and rate
 *   • Calibration confidence scores
 *   • Score stability index (how much scores change run-to-run)
 *
 * DESIGN:
 *   In-memory only (client-side, zero server dependency).
 *   Keeps last 20 run snapshots for trend detection.
 *   All computation is deterministic given the same input.
 */
const SystemObservabilityEngine = (() => {

  // ─── STATE ───────────────────────────────────────────────────────────────────
  const _MAX_HISTORY  = 20;
  let   _runHistory   = [];  // Array of RunSnapshot objects
  let   _latestMetrics = null;

  // ─── STATISTICAL HELPERS ─────────────────────────────────────────────────────

  function stats(arr) {
    if (!arr || arr.length === 0) return { mean: 0, median: 0, std: 0, p90: 0, min: 0, max: 0 };
    const sorted = [...arr].sort((a, b) => a - b);
    const n      = sorted.length;
    const mean   = sorted.reduce((s, v) => s + v, 0) / n;
    const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const p90idx = Math.min(n - 1, Math.floor(n * 0.9));
    return {
      mean:   Math.round(mean * 10) / 10,
      median: sorted[Math.floor(n / 2)],
      std:    Math.round(Math.sqrt(variance) * 10) / 10,
      p90:    sorted[p90idx],
      min:    sorted[0],
      max:    sorted[n - 1],
    };
  }

  function shannonEntropy(countMap) {
    const total  = Object.values(countMap).reduce((s, v) => s + v, 0);
    if (total === 0) return 0;
    let entropy  = 0;
    Object.values(countMap).forEach(count => {
      const p = count / total;
      if (p > 0) entropy -= p * Math.log2(p);
    });
    return Math.round(entropy * 100) / 100;
  }

  // ─── METRIC COMPUTATIONS ─────────────────────────────────────────────────────

  function computeScoreDistribution(accountScores) {
    const scores = Object.values(accountScores).map(a => a.score);
    const dist   = stats(scores);
    const levels = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    Object.values(accountScores).forEach(a => { levels[a.riskLevel] = (levels[a.riskLevel] || 0) + 1; });
    return { ...dist, levels, total: scores.length };
  }

  function computeNLPMetrics(transactions) {
    if (!transactions || transactions.length === 0) return {};

    // Intent distribution
    const intentCounts = {};
    transactions.forEach(t => {
      const k = t.nlpIntent || 'unknown';
      intentCounts[k] = (intentCounts[k] || 0) + 1;
    });
    const intentEntropy = shannonEntropy(intentCounts);

    // Fraud language rate
    const fraudLangCount = transactions.filter(t => (t.fraudLanguageSignals || []).length > 0).length;
    const fraudLangRate  = transactions.length > 0 ? Math.round(fraudLangCount / transactions.length * 100) : 0;

    // Contradiction rate: accounts with SALARY + SUSPICIOUS_PROXY
    const byAccount = {};
    transactions.forEach(t => {
      const acc = t.accountNumber || '_';
      if (!byAccount[acc]) byAccount[acc] = new Set();
      byAccount[acc].add(t.nlpIntent || 'unknown');
    });
    let contradictions = 0;
    Object.values(byAccount).forEach(intentSet => {
      const hasSalary  = intentSet.has('SALARY') || intentSet.has('salary');
      const hasProxy   = intentSet.has('SUSPICIOUS_PROXY') || intentSet.has('gambling') || intentSet.has('cash');
      if (hasSalary && hasProxy) contradictions++;
    });
    const totalAccounts    = Object.keys(byAccount).length;
    const contradictionRate = totalAccounts > 0 ? Math.round(contradictions / totalAccounts * 100) : 0;

    return { intentCounts, intentEntropy, fraudLangRate, contradictionRate, contradictions };
  }

  function computeGraphMetrics(graphResult) {
    if (!graphResult) return {};

    // Edge weight entropy (distribution of transaction volumes across edges)
    const edgeVolumes = Object.values(graphResult.edges || {}).map(e => Math.round(e.volume / 1_000_000));
    const volBuckets  = {};
    edgeVolumes.forEach(v => {
      const bucket = Math.floor(v / 10) * 10; // bucket by 10M
      volBuckets[bucket] = (volBuckets[bucket] || 0) + 1;
    });
    const graphEntropy = shannonEntropy(volBuckets);

    // Avg degree
    const degrees = Object.values(graphResult.nodes || {}).map(n => n.degree || 0);
    const avgDeg  = degrees.length > 0 ? degrees.reduce((s, v) => s + v, 0) / degrees.length : 0;

    // Density of the whole graph
    const n       = Object.keys(graphResult.nodes || {}).length;
    const e       = Object.keys(graphResult.edges || {}).length;
    const maxEdges = n > 1 ? n * (n - 1) : 1;
    const globalDensity = Math.round(e / maxEdges * 100) / 100;

    // Hub concentration: what fraction of edges go through hubs?
    const hubIds  = new Set((graphResult.hubs || []).map(h => h.id));
    const hubEdges = Object.values(graphResult.edges || {}).filter(e => hubIds.has(e.source) || hubIds.has(e.target)).length;
    const hubConcentration = e > 0 ? Math.round(hubEdges / e * 100) : 0;

    return {
      graphEntropy,
      avgDegree:       Math.round(avgDeg * 10) / 10,
      globalDensity,
      hubConcentration,
      nodeCount:       n,
      edgeCount:       e,
      communityCount:  graphResult.stats?.communityCount || 0,
      launderingChains: graphResult.stats?.launderingChainCount || 0,
    };
  }

  function computeAlertMetrics(transactions, accountScores) {
    const total    = transactions.length;
    const anomalies = transactions.filter(t => (t.fraudScore || 0) >= 50).length;
    const critical  = Object.values(accountScores).filter(a => a.riskLevel === 'CRITICAL').length;
    const high      = Object.values(accountScores).filter(a => a.riskLevel === 'HIGH').length;

    return {
      anomalyRate:  total > 0 ? Math.round(anomalies / total * 100) : 0,
      criticalCount: critical,
      highCount:     high,
      totalAccounts: Object.keys(accountScores).length,
      alertVolume:   critical + high,
    };
  }

  function computeCalibrationMetrics(calibrationMeta) {
    if (!calibrationMeta) return {};
    return {
      avgConfidence:    calibrationMeta.avgConfidence || 0,
      conflictRate:     calibrationMeta.conflictRate  || 0,
      conflictsFound:   calibrationMeta.conflictsDetected || 0,
    };
  }

  // ─── STABILITY INDEX ─────────────────────────────────────────────────────────
  // Measures how much scores change between consecutive runs.
  // 100 = perfectly stable, 0 = completely different.

  function computeStabilityIndex(currentDist, previousDist) {
    if (!previousDist || !currentDist) return 100;
    const deltaMode   = Math.abs((currentDist.median || 0) - (previousDist.median || 0));
    const deltaSpread = Math.abs((currentDist.std   || 0) - (previousDist.std   || 0));
    const instability = Math.min(100, deltaMode * 2 + deltaSpread * 1.5);
    return Math.max(0, Math.round(100 - instability));
  }

  // ─── MAIN RECORD FUNCTION ─────────────────────────────────────────────────────

  /**
   * Record a full pipeline run and compute all system health metrics.
   * Call this AFTER calibration + governance processing.
   */
  function recordRun(transactions, graphResult, accountScores, calibrationMeta) {
    const previousRun    = _runHistory[_runHistory.length - 1];
    const prevScoreDist  = previousRun?.metrics?.scoreDistribution;

    const scoreDistribution = computeScoreDistribution(accountScores);
    const nlpMetrics        = computeNLPMetrics(transactions);
    const graphMetrics      = computeGraphMetrics(graphResult);
    const alertMetrics      = computeAlertMetrics(transactions, accountScores);
    const calibrationStats  = computeCalibrationMetrics(calibrationMeta);
    const stabilityIndex    = computeStabilityIndex(scoreDistribution, prevScoreDist);

    // Drift alert: if stability drops sharply
    const driftAlert = stabilityIndex < 60;

    const metrics = {
      scoreDistribution,
      nlpMetrics,
      graphMetrics,
      alertMetrics,
      calibrationStats,
      stabilityIndex,
      driftAlert,
      txCount:        transactions.length,
      accountCount:   Object.keys(accountScores).length,
    };

    const runSnapshot = {
      runId:   _runHistory.length + 1,
      metrics,
    };

    _runHistory.push(runSnapshot);
    if (_runHistory.length > _MAX_HISTORY) _runHistory.shift();
    _latestMetrics = metrics;

    return metrics;
  }

  // ─── HEALTH SUMMARY FOR UI ────────────────────────────────────────────────────

  function getHealthSummary() {
    if (!_latestMetrics) return null;
    const m = _latestMetrics;
    return {
      stabilityIndex:       m.stabilityIndex,
      driftAlert:           m.driftAlert,
      graphEntropy:         m.graphMetrics?.graphEntropy || 0,
      nlpContradictionRate: m.nlpMetrics?.contradictionRate || 0,
      fraudAlertVolume:     m.alertMetrics?.alertVolume || 0,
      anomalyRate:          m.alertMetrics?.anomalyRate || 0,
      calibrationConfidence: m.calibrationStats?.avgConfidence || 0,
      conflictRate:         m.calibrationStats?.conflictRate || 0,
      scoreDistribution:    m.scoreDistribution,
    };
  }

  function getLatestMetrics() { return _latestMetrics; }
  function getRunHistory()    { return [..._runHistory]; }

  // ─── HEALTH STATUS CLASSIFIER ────────────────────────────────────────────────

  /**
   * Classify overall system health from GREEN to RED.
   */
  function classifySystemHealth(summary) {
    if (!summary) return { status: 'UNKNOWN', color: '#64748b', label: 'Chưa chạy' };

    let issues = 0;
    if (summary.stabilityIndex   < 60)  issues += 2;
    if (summary.graphEntropy      > 4.0) issues++;
    if (summary.conflictRate      > 30)  issues++;
    if (summary.calibrationConfidence < 40) issues++;
    if (summary.driftAlert)             issues++;

    if (issues === 0) return { status: 'GREEN',  color: '#4ade80', label: 'Hệ thống ổn định' };
    if (issues <= 2)  return { status: 'YELLOW', color: '#ffcc00', label: 'Cần theo dõi' };
    if (issues <= 4)  return { status: 'ORANGE', color: '#ff8800', label: 'Bất ổn định' };
    return           { status: 'RED',    color: '#ff3b30', label: 'Cần can thiệp' };
  }

  return {
    recordRun,
    getHealthSummary,
    getLatestMetrics,
    getRunHistory,
    classifySystemHealth,
    computeScoreDistribution,
    computeNLPMetrics,
    computeGraphMetrics,
    computeAlertMetrics,
    shannonEntropy,
  };

})();
