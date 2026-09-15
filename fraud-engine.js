/**
 * fraud-engine.js v2 — Multi-Layer Fraud Scoring Model (Forensic Grade)
 *
 * v2 Upgrades:
 *   Layer 1 (unchanged): Transaction-level tag scoring (max 50 raw pts)
 *   Layer 2 (NEW): Behavioral Drift Score — deviation from account's own baseline
 *   Layer 3 (FIXED): Graph Risk Amplification — propagated risk from network neighbors
 *   Layer 4 (NEW): Temporal Burst Detection — sudden activity spikes
 *
 * FINAL SCORE FORMULA (v2 corrected):
 *   FINAL = 0.40 * txLayerScore + 0.30 * graphLayerScore + 0.30 * behavioralDriftScore
 *
 * Deterministic: no random() calls, consistent sort order tiebreakers.
 */
const FraudEngine = (() => {

  // ─── WEIGHTS ─────────────────────────────────────────────────────────────────

  const TAG_WEIGHTS = {
    GAMBLING_SIGNAL:      30,
    RISK_PATTERN:         20,
    VERY_LARGE_AMOUNT:    20,
    SMALL_SPLIT_TRANSFER: 15,
    HIGH_FREQUENCY:       12,
    LARGE_AMOUNT:         10,
    OFF_HOURS:             8,
    ROUND_AMOUNT:          5,
    REPEATED_AMOUNT:       5,
    HIGH_DAILY_FREQUENCY:  6,
    CASH_WITHDRAWAL:       4,
    LOAN_RELATED:          3,
    // v2 additions from NLP
    FRAUD_LANGUAGE:       18,
    INTENT_SHIFT:         12,
    ANOMALOUS_INTENT:      8,
  };

  const GRAPH_WEIGHTS = {
    IN_SUSPICIOUS_CLUSTER:   15,
    NETWORK_HUB:             12,
    HIGH_INFLUENCE_NODE:     10,
    MANY_COUNTERPARTIES:      8,
    PROPAGATED_RISK:          8,  // v2: risk received via propagation
  };

  const BEHAVIORAL_WEIGHTS = {
    HIGH_NIGHT_RATIO:        15,
    INCONSISTENT_AMOUNTS:    10,
    HIGH_INTENT_ENTROPY:      8,
    RAPID_LARGE_TRANSFERS:   15,
    // v2 behavioral drift
    AMOUNT_DRIFT:            12,  // recent amounts deviate from baseline
    FREQUENCY_DRIFT:         10,  // recent frequency deviate from baseline
    HOUR_DRIFT:               8,  // recent activity hours shifted
  };

  // ─── HELPERS ─────────────────────────────────────────────────────────────────

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function parseHour(dateStr) {
    const m = String(dateStr || '').match(/[T\s](\d{2}):/);
    return m ? parseInt(m[1], 10) : -1;
  }

  function parseDateMs(dateStr) {
    const s = String(dateStr || '');
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}:00`).getTime();
    const ts = new Date(s).getTime();
    return isNaN(ts) ? 0 : ts;
  }

  function getRiskLevel(score) {
    if (score >= 75) return 'CRITICAL';
    if (score >= 50) return 'HIGH';
    if (score >= 25) return 'MEDIUM';
    return 'LOW';
  }

  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  function stdDev(arr) {
    if (arr.length < 2) return 0;
    const avg = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);
  }

  // ─── LAYER 1: TRANSACTION-LEVEL SCORE ────────────────────────────────────────

  function txLayerScore(tx) {
    let raw = 0;
    const reasons = [];

    (tx.tags || []).forEach(tag => {
      const w = TAG_WEIGHTS[tag];
      if (w) { raw += w; reasons.push(tag); }
    });

    // v2: boost from NLP signals
    if ((tx.fraudLanguageSignals || []).length > 0) {
      raw += TAG_WEIGHTS.FRAUD_LANGUAGE;
      reasons.push('FRAUD_LANGUAGE');
    }
    if (tx.hasIntentShift) {
      raw += TAG_WEIGHTS.INTENT_SHIFT;
      reasons.push('INTENT_SHIFT');
    }
    if (tx.anomalousIntent) {
      raw += TAG_WEIGHTS.ANOMALOUS_INTENT;
      reasons.push('ANOMALOUS_INTENT');
    }

    return { raw: clamp(raw, 0, 50), reasons };
  }

  // ─── LAYER 2: BEHAVIORAL DRIFT SCORE (v2 NEW) ────────────────────────────────
  // Splits account history into BASELINE (first 50%) and RECENT (last 50%).
  // Flags significant deviations in amount, frequency, or hours.

  function behavioralDriftScore(accountTxs) {
    if (accountTxs.length < 4) return { raw: 0, reasons: [] };
    let raw = 0;
    const reasons = [];

    const sorted = [...accountTxs].sort((a, b) =>
      parseDateMs(a.transactionDate || a.date) - parseDateMs(b.transactionDate || b.date)
    );
    const split    = Math.floor(sorted.length / 2);
    const baseline = sorted.slice(0, split);
    const recent   = sorted.slice(split);

    // Amount drift: recent mean vs baseline mean
    const baselineAmts = baseline.map(t => t.amount).filter(a => a > 0);
    const recentAmts   = recent.map(t => t.amount).filter(a => a > 0);
    if (baselineAmts.length > 0 && recentAmts.length > 0) {
      const baseMean   = mean(baselineAmts);
      const recentMean = mean(recentAmts);
      const amtDrift   = baseMean > 0 ? Math.abs(recentMean - baseMean) / baseMean : 0;
      if (amtDrift > 1.5) {   // 150% deviation
        raw += BEHAVIORAL_WEIGHTS.AMOUNT_DRIFT;
        reasons.push('AMOUNT_DRIFT');
      }
    }

    // Frequency drift: recent transaction rate vs baseline rate
    const baselineDays = Math.max(1, _daySpan(baseline));
    const recentDays   = Math.max(1, _daySpan(recent));
    const baselineRate = baseline.length / baselineDays;
    const recentRate   = recent.length   / recentDays;
    if (baselineRate > 0 && recentRate / baselineRate > 2.5) {  // 2.5x frequency spike
      raw += BEHAVIORAL_WEIGHTS.FREQUENCY_DRIFT;
      reasons.push('FREQUENCY_DRIFT');
    }

    // Hour drift: dominant hour window shifted
    const baselineHourMean = mean(baseline.map(t => parseHour(t.transactionDate || t.date)).filter(h => h >= 0));
    const recentHourMean   = mean(recent.map(t => parseHour(t.transactionDate || t.date)).filter(h => h >= 0));
    if (!isNaN(baselineHourMean) && !isNaN(recentHourMean)) {
      const hourShift = Math.abs(recentHourMean - baselineHourMean);
      if (hourShift > 6) {  // shifted by >6 hours
        raw += BEHAVIORAL_WEIGHTS.HOUR_DRIFT;
        reasons.push('HOUR_DRIFT');
      }
    }

    // Legacy behavioral checks (from v1, kept)
    const nightCount = accountTxs.filter(t => { const h = parseHour(t.transactionDate || t.date); return h >= 0 && [23,0,1,2,3,4].includes(h); }).length;
    if (nightCount / accountTxs.length > 0.35) {
      raw += BEHAVIORAL_WEIGHTS.HIGH_NIGHT_RATIO;
      reasons.push('HIGH_NIGHT_RATIO');
    }

    const amounts = accountTxs.map(t => t.amount).filter(a => a > 0);
    if (amounts.length >= 3) {
      const cv = mean(amounts) > 0 ? stdDev(amounts) / mean(amounts) : 0;
      if (cv > 2.5) { raw += BEHAVIORAL_WEIGHTS.INCONSISTENT_AMOUNTS; reasons.push('INCONSISTENT_AMOUNTS'); }
    }

    const intentCounts = {};
    accountTxs.forEach(t => { const k = t.nlpIntent || 'unknown'; intentCounts[k] = (intentCounts[k] || 0) + 1; });
    if (Object.keys(intentCounts).length >= 5) { raw += BEHAVIORAL_WEIGHTS.HIGH_INTENT_ENTROPY; reasons.push('HIGH_INTENT_ENTROPY'); }

    // Rapid large transfers (2+ large OUTs within 10 min)
    const largeOuts = accountTxs
      .filter(t => t.transactionType === 'OUT' && t.amount >= 50_000_000)
      .sort((a, b) => parseDateMs(a.transactionDate || a.date) - parseDateMs(b.transactionDate || b.date));
    for (let i = 0; i < largeOuts.length - 1; i++) {
      const diff = parseDateMs(largeOuts[i+1].transactionDate || largeOuts[i+1].date)
                 - parseDateMs(largeOuts[i].transactionDate   || largeOuts[i].date);
      if (diff > 0 && diff < 10 * 60 * 1000) {
        raw += BEHAVIORAL_WEIGHTS.RAPID_LARGE_TRANSFERS;
        reasons.push('RAPID_LARGE_TRANSFERS');
        break;
      }
    }

    return { raw: clamp(raw, 0, 40), reasons };
  }

  function _daySpan(txs) {
    const ms = txs.map(t => parseDateMs(t.transactionDate || t.date)).filter(d => d > 0);
    if (ms.length < 2) return 1;
    return Math.max(1, (Math.max(...ms) - Math.min(...ms)) / 86400000);
  }

  // ─── LAYER 3: GRAPH RISK AMPLIFICATION (v2 ENHANCED) ────────────────────────
  // Now includes propagated risk received from neighbors (set by GraphEngine.applyRiskPropagation).

  function graphLayerScore(nodeId, graphResult) {
    if (!graphResult) return { raw: 0, reasons: [] };
    const node = graphResult.nodes[nodeId];
    if (!node) return { raw: 0, reasons: [] };

    let raw = 0;
    const reasons = [];

    const inSuspicious = (graphResult.suspiciousClusters || []).some(c => c.isSuspicious && c.community.includes(nodeId));
    if (inSuspicious) { raw += GRAPH_WEIGHTS.IN_SUSPICIOUS_CLUSTER; reasons.push('IN_SUSPICIOUS_CLUSTER'); }

    const isHub = (graphResult.hubs || []).some(h => h.id === nodeId);
    if (isHub) { raw += GRAPH_WEIGHTS.NETWORK_HUB; reasons.push('NETWORK_HUB'); }

    const prVals = Object.values(graphResult.pageRank || {});
    if (prVals.length > 0) {
      const maxPR = Math.max(...prVals);
      if (maxPR > 0 && node.pageRank > maxPR * 0.8) { raw += GRAPH_WEIGHTS.HIGH_INFLUENCE_NODE; reasons.push('HIGH_INFLUENCE_NODE'); }
    }

    if (node.degree > 5) { raw += GRAPH_WEIGHTS.MANY_COUNTERPARTIES; reasons.push('MANY_COUNTERPARTIES'); }

    // v2: propagated risk from neighbors (set by GraphEngine.applyRiskPropagation)
    if ((node.propagatedRisk || 0) > 20) { raw += GRAPH_WEIGHTS.PROPAGATED_RISK; reasons.push('PROPAGATED_RISK'); }

    return { raw: clamp(raw, 0, 40), reasons };
  }

  // ─── LAYER 4: TEMPORAL BURST DETECTION (v2 NEW) ──────────────────────────────
  // Detects sudden spikes in transaction frequency or volume within short windows.

  function temporalBurstScore(accountTxs) {
    if (accountTxs.length < 5) return { raw: 0, reasons: [] };
    let raw = 0;
    const reasons = [];

    const sorted = [...accountTxs]
      .map(t => ({ ...t, ms: parseDateMs(t.transactionDate || t.date) }))
      .filter(t => t.ms > 0)
      .sort((a, b) => a.ms - b.ms);

    if (sorted.length < 5) return { raw: 0, reasons: [] };

    const WINDOWS = [
      { hours: 1,  label: 'BURST_1H',  freqThresh: 5,  volThresh: 100_000_000 },
      { hours: 6,  label: 'BURST_6H',  freqThresh: 10, volThresh: 300_000_000 },
      { hours: 24, label: 'BURST_24H', freqThresh: 20, volThresh: 500_000_000 },
    ];

    // Global average: txs per day
    const totalDays = Math.max(1, _daySpan(accountTxs));
    const avgPerDay = accountTxs.length / totalDays;

    for (const win of WINDOWS) {
      const winMs = win.hours * 3600_000;
      let maxFreq = 0, maxVol = 0;

      for (let i = 0; i < sorted.length; i++) {
        let freq = 1, vol = sorted[i].amount || 0;
        for (let j = i + 1; j < sorted.length && sorted[j].ms - sorted[i].ms <= winMs; j++) {
          freq++;
          vol += sorted[j].amount || 0;
        }
        if (freq > maxFreq) maxFreq = freq;
        if (vol  > maxVol)  maxVol  = vol;
      }

      // Frequency burst: >3x normal rate for this window
      const expectedForWindow = avgPerDay * (win.hours / 24);
      const isFreqBurst = maxFreq > Math.max(win.freqThresh, expectedForWindow * 3);
      const isVolBurst  = maxVol  > win.volThresh;

      if (isFreqBurst || isVolBurst) {
        raw += 12;
        reasons.push(win.label);
      }
    }

    return { raw: clamp(raw, 0, 25), reasons };
  }

  // ─── MAIN SCORING ORCHESTRATOR ────────────────────────────────────────────────

  /**
   * Score all transactions and accounts using 4-layer model.
   * FORMULA: FINAL = 0.40 * txLayer + 0.30 * graphLayer + 0.30 * behavioralDrift
   * Temporal burst score is added as a modifier (capped at +10).
   */
  function scoreAllTransactions(transactions, graphResult) {
    // Group by account
    const byAccount = {};
    transactions.forEach((tx, i) => {
      const acc = tx.accountNumber || '_unknown';
      if (!byAccount[acc]) byAccount[acc] = [];
      byAccount[acc].push({ tx, idx: i });
    });

    // ── Compute account-level scores ──────────────────────────────────────────
    const accountScores = {};

    Object.entries(byAccount).forEach(([acc, items]) => {
      const txsForAcc = items.map(it => it.tx);

      // Layer 1: average transaction tag score
      const txRawAvg = txsForAcc.reduce((s, t) => s + txLayerScore(t).raw, 0) / Math.max(1, txsForAcc.length);

      // Layer 2: behavioral drift
      const { raw: bRaw, reasons: bReasons } = behavioralDriftScore(txsForAcc);

      // Layer 3: graph
      const { raw: gRaw, reasons: gReasons } = graphLayerScore(acc, graphResult);

      // Layer 4: temporal burst (modifier)
      const { raw: burstRaw, reasons: burstReasons } = temporalBurstScore(txsForAcc);

      // v2 formula: 0.40 * tx + 0.30 * graph + 0.30 * behavioral + burst modifier
      const base  = 0.40 * txRawAvg + 0.30 * gRaw + 0.30 * bRaw;
      const score = Math.round(clamp(base + Math.min(burstRaw, 10), 0, 100));

      // Aggregate tag reasons
      const aggTags = {};
      txsForAcc.flatMap(t => t.tags || []).forEach(tag => { aggTags[tag] = (aggTags[tag] || 0) + 1; });
      const topTags = Object.entries(aggTags).sort((a,b) => b[1]-a[1]).slice(0, 4).map(([t]) => t);

      accountScores[acc] = {
        account:     acc,
        score,
        riskLevel:   getRiskLevel(score),
        reasons:     [...topTags, ...bReasons, ...gReasons, ...burstReasons].filter((v,i,a) => a.indexOf(v)===i).slice(0, 8),
        txCount:     txsForAcc.length,
        totalVolume: txsForAcc.reduce((s, t) => s + t.amount, 0),
        // v2 detailed breakdown
        breakdown: { txScore: Math.round(txRawAvg), graphScore: gRaw, behavioralScore: bRaw, burstScore: burstRaw },
      };

      // Propagate score to graph node
      if (graphResult && graphResult.nodes[acc]) {
        graphResult.nodes[acc].fraudScore = score;
        graphResult.nodes[acc].riskLevel  = getRiskLevel(score);
      }
    });

    // ── Score individual transactions ─────────────────────────────────────────
    const scoredTransactions = transactions.map(tx => {
      const { raw: txRaw, reasons: txReasons } = txLayerScore(tx);
      const accScore  = accountScores[tx.accountNumber || '_unknown']?.score || 0;

      // Blend: tx contributes 60% (individual risk) + account 40% (systemic risk)
      const blended   = Math.round(clamp(txRaw * 0.6 + accScore * 0.4, 0, 100));

      const allReasons = [
        ...(tx.tags || []).filter(t => TAG_WEIGHTS[t]),
        ...txReasons,
        ...(accountScores[tx.accountNumber || '_unknown']?.reasons || []),
      ].filter((v,i,a) => a.indexOf(v)===i).slice(0, 6);

      return {
        ...tx,
        fraudScore:   blended,
        riskLevel:    getRiskLevel(blended),
        fraudReasons: allReasons,
        // v2 extras
        hasFraudLanguage: (tx.fraudLanguageSignals || []).length > 0,
      };
    });

    return { scoredTransactions, accountScores };
  }

  // ─── PUBLIC HELPERS ──────────────────────────────────────────────────────────

  function buildRiskLeaderboard(accountScores) {
    return Object.values(accountScores)
      .sort((a, b) => b.score - a.score || a.account.localeCompare(b.account))
      .map((entry, rank) => ({ rank: rank + 1, ...entry }));
  }

  return {
    scoreAllTransactions,
    buildRiskLeaderboard,
    getRiskLevel,
    // exposed for investigation engine
    txLayerScore,
    behavioralDriftScore,
    graphLayerScore,
    temporalBurstScore,
    TAG_WEIGHTS,
  };

})();
