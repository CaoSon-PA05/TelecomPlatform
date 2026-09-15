/**
 * risk-calibration-engine.js — Global Risk Calibration Layer (Phase 3)
 *
 * PURPOSE:
 *   Normalizes outputs from ALL four engines (NLP, Graph, Behavioral, Temporal)
 *   into a single coherent 0–1 probability space.
 *
 *   Replaces the fixed 0.40/0.30/0.30 formula with a DYNAMIC confidence-weighted
 *   combination that adapts based on data availability per account.
 *
 * GUARANTEES:
 *   • Fully deterministic — no Date.now() or Math.random()
 *   • Conflict detection + reconciliation with audit trail
 *   • Score never inflated beyond evidence quality permits
 *   • Same input → same output always
 */
const RiskCalibrationEngine = (() => {

  // ─── RAW SCORE NORMALIZATION CEILINGS ────────────────────────────────────────
  // Each engine has a known maximum raw output. Used to map to [0,1].
  const CEILING = {
    tx:          50,   // fraud-engine txLayerScore max
    graph:       40,   // fraud-engine graphLayerScore max
    behavioral:  40,   // fraud-engine behavioralDriftScore max
    burst:       25,   // fraud-engine temporalBurstScore max
  };

  // ─── CONFIDENCE COMPUTATION ──────────────────────────────────────────────────

  /**
   * NLP confidence: how reliable is the NLP classification for this account?
   * Drops with few transactions or all-generic descriptions.
   */
  function computeNLPConfidence(accountTxs) {
    if (!accountTxs || accountTxs.length === 0) return 0.05;
    const n = accountTxs.length;

    // Data volume confidence (saturates at 20 transactions)
    const volumeConf = Math.min(1, n / 20);

    // Description richness: proportion with >15 char descriptions
    const richDescs = accountTxs.filter(t => (t.description || t.content || '').length > 15).length;
    const richnessConf = richDescs / n;

    // Intent variety: more than one intent type = better NLP signal
    const intents = new Set(accountTxs.map(t => t.nlpIntent || 'transfer').filter(i => i !== 'transfer'));
    const varietyConf = Math.min(1, intents.size / 3);

    // Fraud language presence boosts NLP confidence
    const fraudLangConf = accountTxs.some(t => (t.fraudLanguageSignals || []).length > 0) ? 0.2 : 0;

    return Math.min(1, volumeConf * 0.35 + richnessConf * 0.35 + varietyConf * 0.20 + fraudLangConf);
  }

  /**
   * Graph confidence: how reliable is the graph score for this node?
   * Requires sufficient connections to be meaningful.
   */
  function computeGraphConfidence(nodeId, graphResult) {
    if (!graphResult || !graphResult.nodes[nodeId]) return 0.05;
    const node = graphResult.nodes[nodeId];

    // Need connections to have graph signal
    const degreeConf = Math.min(1, (node.degree || 0) / 6);

    // Need multiple transactions
    const countConf = Math.min(1, (node.count || 0) / 12);

    // PageRank significance: above baseline is more confident
    const nodeIds = Object.keys(graphResult.nodes);
    const prVals  = nodeIds.map(id => graphResult.pageRank[id] || 0);
    const avgPR   = prVals.reduce((s, v) => s + v, 0) / Math.max(1, prVals.length);
    const prConf  = node.pageRank > avgPR * 1.5 ? 0.3 : 0;

    return Math.min(1, degreeConf * 0.5 + countConf * 0.3 + prConf + 0.05);
  }

  /**
   * Behavioral confidence: how reliable is behavioral drift analysis?
   * Requires sufficient history to split into baseline + recent windows.
   */
  function computeBehavioralConfidence(accountTxs) {
    if (!accountTxs || accountTxs.length < 4) return 0.05;
    const n = accountTxs.length;

    // At least 8 transactions for meaningful baseline vs recent split
    const historyConf = Math.min(1, n / 30);

    // Date diversity: transactions spanning multiple days = better baseline
    const dates = accountTxs
      .map(t => (t.transactionDate || t.date || '').slice(0, 10))
      .filter(Boolean);
    const uniqueDays   = new Set(dates).size;
    const diversityConf = Math.min(1, uniqueDays / 10);

    return Math.min(1, historyConf * 0.6 + diversityConf * 0.4);
  }

  /**
   * Transaction anomaly confidence: how confident is the tag-based tx score?
   */
  function computeTxConfidence(accountTxs) {
    if (!accountTxs || accountTxs.length === 0) return 0.1;

    const risky = accountTxs.filter(t => {
      const tags = t.tags || [];
      return tags.some(tag => !['NORMAL_BEHAVIOR', 'RECURRING_PAYMENT', 'SALARY_INCOME', 'INVESTMENT'].includes(tag));
    }).length;

    // More risky-tagged transactions = clearer signal
    const signalConf = Math.min(1, risky / Math.max(1, accountTxs.length));

    // Presence of fraud language signals = high confidence
    const flConf = accountTxs.some(t => (t.fraudLanguageSignals || []).length > 0) ? 0.3 : 0;

    return Math.min(1, signalConf * 0.7 + flConf + 0.1);
  }

  // ─── CONFLICT DETECTION ───────────────────────────────────────────────────────

  /**
   * Detect disagreement between engine scores.
   * Each score is first normalized to 0–100 for comparison.
   */
  function detectConflict(nlpScore100, graphScore100, behavScore100, txScore100) {
    const scores = [nlpScore100, graphScore100, behavScore100, txScore100].filter(s => s != null && !isNaN(s));
    if (scores.length < 2) return null;

    const max    = Math.max(...scores);
    const min    = Math.min(...scores);
    const spread = max - min;
    const mean   = scores.reduce((s, v) => s + v, 0) / scores.length;

    if (spread <= 15) return null; // No meaningful conflict

    const severity = spread > 45 ? 'HIGH' : 'MEDIUM';

    const labelled = [
      { label: 'NLP/Giao Dịch', score: nlpScore100 },
      { label: 'Đồ Thị',        score: graphScore100 },
      { label: 'Hành Vi',       score: behavScore100 },
      { label: 'Giao Dịch',     score: txScore100 },
    ].filter(x => x.score != null && !isNaN(x.score))
     .sort((a, b) => b.score - a.score);

    return {
      severity,
      spread:        Math.round(spread),
      maxEngine:     labelled[0].label,
      minEngine:     labelled[labelled.length - 1].label,
      allScores:     labelled,
      mean:          Math.round(mean),
      reconciliation: severity === 'HIGH' ? 'CONSERVATIVE_MEDIAN' : 'WEIGHTED_MEAN',
    };
  }

  // ─── MAIN CALIBRATION FUNCTION ───────────────────────────────────────────────

  /**
   * Calibrate scores for a single account.
   *
   * @param {Object} rawBreakdown  — { tx, graph, behavioral, burst } raw scores from FraudEngine
   * @param {number} txConf        — computed NLP/tx confidence [0,1]
   * @param {number} graphConf     — computed graph confidence [0,1]
   * @param {number} behavConf     — computed behavioral confidence [0,1]
   * @returns {CalibrationResult}
   */
  function calibrateAccount(rawBreakdown, txConf, graphConf, behavConf) {
    const { tx: txRaw = 0, graph: graphRaw = 0, behavioral: behavRaw = 0, burst: burstRaw = 0 } = rawBreakdown;

    // ── Step 1: Normalize raw scores to [0,1] probability space ─────────────────
    const txProb    = clamp01(txRaw    / CEILING.tx);
    const graphProb = clamp01(graphRaw / CEILING.graph);
    const behavProb = clamp01(behavRaw / CEILING.behavioral);
    const burstProb = clamp01(burstRaw / CEILING.burst);

    // Burst confidence is always moderate (data always available, but signal can be noisy)
    const burstConf = 0.4;

    // ── Step 2: Total confidence weight ─────────────────────────────────────────
    const totalConf = txConf + graphConf + behavConf + burstConf;
    // Guard: if all confidences are near-zero (very sparse data), apply floor
    const effectiveConf = Math.max(totalConf, 0.4);

    // ── Step 3: Weighted calibrated probability ──────────────────────────────────
    const calibratedProb = (
      txProb    * txConf +
      graphProb * graphConf +
      behavProb * behavConf +
      burstProb * burstConf
    ) / effectiveConf;

    // ── Step 4: Normalize each to 0–100 for conflict detection ─────────────────
    const txScore100    = Math.round(txProb    * 100);
    const graphScore100 = Math.round(graphProb * 100);
    const behavScore100 = Math.round(behavProb * 100);

    // ── Step 5: Conflict detection ───────────────────────────────────────────────
    const conflict = detectConflict(txScore100, graphScore100, behavScore100, txScore100);

    // ── Step 6: Conflict reconciliation ──────────────────────────────────────────
    let finalProb = calibratedProb;
    let conflictAdjustment = 0;

    if (conflict && conflict.severity === 'HIGH') {
      // Conservative: blend calibrated + median to reduce outlier pull
      const probs  = [txProb, graphProb, behavProb, burstProb].sort((a, b) => a - b);
      const median = (probs[1] + probs[2]) / 2; // middle two elements
      const blended = calibratedProb * 0.55 + median * 0.45;
      conflictAdjustment = Math.round((calibratedProb - blended) * 100);
      finalProb = blended;
    }

    // ── Step 7: Scale to 0–100 ───────────────────────────────────────────────────
    const calibratedScore = Math.round(clamp01(finalProb) * 100);

    // ── Contribution breakdown in 0–100 space ────────────────────────────────────
    const breakdown = {
      nlpContribution:        Math.round((txProb    * txConf    / effectiveConf) * 100),
      graphContribution:      Math.round((graphProb * graphConf / effectiveConf) * 100),
      behavioralContribution: Math.round((behavProb * behavConf / effectiveConf) * 100),
      temporalContribution:   Math.round((burstProb * burstConf / effectiveConf) * 100),
    };

    // Overall calibration confidence: how reliable is this final score?
    const overallConfidence = Math.min(100, Math.round(
      (txConf * 0.35 + graphConf * 0.30 + behavConf * 0.25 + burstConf * 0.10) * 100
    ));

    return {
      calibratedScore,
      overallConfidence,
      breakdown,
      conflict,
      conflictAdjustment,
      confidenceWeights: {
        tx:         Math.round(txConf    * 100),
        graph:      Math.round(graphConf * 100),
        behavioral: Math.round(behavConf * 100),
        burst:      Math.round(burstConf * 100),
      },
      rawProbabilities: {
        tx:    Math.round(txProb    * 100),
        graph: Math.round(graphProb * 100),
        behav: Math.round(behavProb * 100),
        burst: Math.round(burstProb * 100),
      },
    };
  }

  // ─── BATCH CALIBRATION ───────────────────────────────────────────────────────

  /**
   * Calibrate ALL accounts and update transaction scores.
   * Called AFTER FraudEngine.scoreAllTransactions().
   *
   * @param {Array}  transactions  — scored transactions from FraudEngine
   * @param {Object} accountScores — FraudEngine account scores with .breakdown
   * @param {Object} graphResult   — GraphEngine result
   * @returns {{ calibratedTransactions, calibratedAccountScores, calibrationMeta }}
   */
  function calibrateAll(transactions, accountScores, graphResult) {
    // Group transactions by account
    const byAccount = {};
    transactions.forEach(tx => {
      const acc = tx.accountNumber || '_unknown';
      if (!byAccount[acc]) byAccount[acc] = [];
      byAccount[acc].push(tx);
    });

    const calibratedAccountScores = {};
    const accountCalibrations     = {};

    // Calibrate each account
    Object.entries(accountScores).forEach(([acc, entry]) => {
      const txsForAcc = byAccount[acc] || [];

      // Compute confidence per engine
      const txConf    = computeTxConfidence(txsForAcc);
      const graphConf = computeGraphConfidence(acc, graphResult);
      const behavConf = computeBehavioralConfidence(txsForAcc);
      const nlpConf   = computeNLPConfidence(txsForAcc);

      // Use higher of tx/nlp confidence (they share the same evidence source)
      const combinedTxConf = Math.max(txConf, nlpConf);

      const rawBreakdown = entry.breakdown || { tx: 0, graph: 0, behavioral: 0, burst: 0 };
      const calibration  = calibrateAccount(rawBreakdown, combinedTxConf, graphConf, behavConf);

      calibratedAccountScores[acc] = {
        ...entry,
        score:              calibration.calibratedScore,
        riskLevel:          getRiskLevel(calibration.calibratedScore),
        calibration,        // full calibration object for governance layer
        overallConfidence:  calibration.overallConfidence,
      };

      accountCalibrations[acc] = calibration;

      // Propagate calibrated score back to graph node
      if (graphResult && graphResult.nodes[acc]) {
        graphResult.nodes[acc].fraudScore = calibration.calibratedScore;
        graphResult.nodes[acc].riskLevel  = getRiskLevel(calibration.calibratedScore);
      }
    });

    // Re-score individual transactions using calibrated account scores
    const calibratedTransactions = transactions.map(tx => {
      const accEntry = calibratedAccountScores[tx.accountNumber || '_unknown'];
      if (!accEntry) return tx;

      // Blend: individual tx tag score (60%) + calibrated account score (40%)
      const txRaw     = FraudEngine.txLayerScore(tx).raw;
      const txProb    = txRaw / CEILING.tx;
      const accScore  = accEntry.score;
      const blended   = Math.round(clamp01(txProb * 0.6 + accScore / 100 * 0.4) * 100);

      return {
        ...tx,
        fraudScore:             blended,
        riskLevel:              getRiskLevel(blended),
        calibrationConfidence:  accEntry.overallConfidence,
        hasConflict:            !!(accEntry.calibration?.conflict),
      };
    });

    // Calibration metadata for observability
    const allConf = Object.values(accountCalibrations).map(c => c.overallConfidence);
    const conflicts = Object.values(accountCalibrations).filter(c => c.conflict).length;

    const calibrationMeta = {
      accountsCalibrated: Object.keys(calibratedAccountScores).length,
      conflictsDetected:  conflicts,
      conflictRate:       allConf.length > 0 ? Math.round(conflicts / allConf.length * 100) : 0,
      avgConfidence:      allConf.length > 0 ? Math.round(allConf.reduce((s,v)=>s+v,0) / allConf.length) : 0,
      minConfidence:      allConf.length > 0 ? Math.min(...allConf) : 0,
      maxConfidence:      allConf.length > 0 ? Math.max(...allConf) : 0,
    };

    return { calibratedTransactions, calibratedAccountScores, calibrationMeta };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  function clamp01(v) { return Math.min(1, Math.max(0, v)); }

  function getRiskLevel(score) {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MEDIUM';
    return 'LOW';
  }

  return {
    calibrateAll,
    calibrateAccount,
    computeNLPConfidence,
    computeGraphConfidence,
    computeBehavioralConfidence,
    computeTxConfidence,
    detectConflict,
  };

})();
