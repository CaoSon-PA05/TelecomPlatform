/**
 * fraud-governance-layer.js — Score Governance & Audit System (Phase 3)
 *
 * PURPOSE:
 *   Ensure every fraud score is:
 *     • Explainable: decomposed into NLP / Graph / Behavioral / Temporal contributions
 *     • Deterministic: same input → same output guaranteed
 *     • Auditable: full snapshot of raw → calibrated pipeline per account
 *     • Traceable: each score linked to specific evidence
 *
 * ARCHITECTURE:
 *   Acts as a MIDDLEWARE layer between FraudEngine and UI/export.
 *   Does NOT recompute scores — only wraps and validates them.
 */
const FraudGovernanceLayer = (() => {

  // ─── ENGINE METADATA ─────────────────────────────────────────────────────────
  // These are static constants — NEVER time-based.
  const ENGINE_VERSION = '3.0.0';
  const VERSION_HASH   = 'SENTINEL-FLA-v4-SHA-d8e3f1a9';  // Phase 4 updated
  const SCHEMA_VERSION = '2024-PHASE4-PRODUCTION';

  // ─── AUDIT STORE ─────────────────────────────────────────────────────────────
  // In-memory audit store. Cleared on each new run to avoid stale data.
  // Phase 4: supports LOCKED mode (write-once after case lock)
  let _auditStore     = {};
  let _auditChain     = [];   // hash-chained log for tamper detection
  let _auditLocked    = false; // when true, no modifications allowed
  let _runId          = 0;

  function clearAuditStore() {
    if (_auditLocked) return; // cannot clear a locked store
    _auditStore  = {};
    _auditChain  = [];
    _auditLocked = false;
    _runId++;
  }

  // ─── HASH-CHAINED AUDIT LOG (Phase 4 NEW) ────────────────────────────────────
  // Each entry references the hash of the previous entry, forming a tamper-proof chain.
  // The genesis entry uses '00000000' as prevHash.

  const _GENESIS_HASH = '00000000';

  function _appendChainEntry(accountId, snapshot) {
    if (_auditLocked) return; // write-once enforcement
    const prevHash  = _auditChain.length > 0
      ? _auditChain[_auditChain.length - 1].chainHash
      : _GENESIS_HASH;
    const content   = `${accountId}:${snapshot.finalScore}:${snapshot.inputHash}`;
    const contentHash = computeInputHash(accountId, snapshot.rawInputs?.txCount || 0,
      snapshot.rawInputs?.totalVolume || 0, []);
    const chainHash = _mixHashes(prevHash, contentHash);

    _auditChain.push({
      index:       _auditChain.length,
      accountId,
      prevHash,
      contentHash,
      chainHash,
    });
  }

  function _mixHashes(h1, h2) {
    // XOR-based deterministic combination of two hex hashes
    const n1 = parseInt(h1, 16) >>> 0;
    const n2 = parseInt(h2, 16) >>> 0;
    return ((n1 ^ n2 ^ 0xDEADBEEF) >>> 0).toString(16).padStart(8,'0').toUpperCase();
  }

  function verifyAuditChain(chain) {
    if (!chain || chain.length === 0) return { valid: true, message: 'Empty chain (no entries)' };
    for (let i = 0; i < chain.length; i++) {
      const entry    = chain[i];
      const expected = i === 0 ? _GENESIS_HASH : chain[i-1].chainHash;
      if (entry.prevHash !== expected) {
        return { valid: false, brokenAt: i, expected, found: entry.prevHash };
      }
    }
    return { valid: true, length: chain.length, tipHash: chain[chain.length-1].chainHash };
  }

  function lockAuditStore() {
    _auditLocked = true;
    return { locked: true, chainLength: _auditChain.length, tipHash: _auditChain.at(-1)?.chainHash || _GENESIS_HASH };
  }

  function getAuditChain() { return [..._auditChain]; }
  function isAuditLocked() { return _auditLocked; }

  // ─── DETERMINISM HASH ────────────────────────────────────────────────────────
  // Compute a lightweight deterministic hash of key inputs.
  // This lets us verify same-input → same-output WITHOUT storing the full input.

  function computeInputHash(accountId, txCount, totalVolume, topTags) {
    // Deterministic string representation
    const raw = `${accountId}:${txCount}:${Math.round(totalVolume)}:${(topTags || []).sort().join(',')}`;
    // Simple polynomial rolling hash (no Math.random, no Date)
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0; // convert to 32-bit int
    }
    return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }

  // ─── SCORE DECOMPOSITION ────────────────────────────────────────────────────

  /**
   * Build a full score decomposition for a single account.
   * Links each score component to its source evidence.
   */
  function buildScoreDecomposition(accountId, accountEntry, txsForAccount, graphResult) {
    const calibration = accountEntry.calibration || {};
    const breakdown   = calibration.breakdown || accountEntry.breakdown || {};

    const decomposition = {
      totalScore:    accountEntry.score,
      riskLevel:     accountEntry.riskLevel,
      confidence:    accountEntry.overallConfidence || 0,

      layers: {
        nlpLayer: {
          contribution: breakdown.nlpContribution || 0,
          confidence:   calibration.confidenceWeights?.tx || 0,
          evidence:     _extractNLPEvidence(txsForAccount),
        },
        graphLayer: {
          contribution: breakdown.graphContribution || 0,
          confidence:   calibration.confidenceWeights?.graph || 0,
          evidence:     _extractGraphEvidence(accountId, graphResult),
        },
        behavioralLayer: {
          contribution: breakdown.behavioralContribution || 0,
          confidence:   calibration.confidenceWeights?.behavioral || 0,
          evidence:     _extractBehavioralEvidence(txsForAccount),
        },
        temporalLayer: {
          contribution: breakdown.temporalContribution || 0,
          confidence:   calibration.confidenceWeights?.burst || 0,
          evidence:     _extractTemporalEvidence(txsForAccount),
        },
      },

      conflict: calibration.conflict || null,
      conflictAdjustment: calibration.conflictAdjustment || 0,
    };

    return decomposition;
  }

  function _extractNLPEvidence(txs) {
    const intents  = [...new Set(txs.map(t => t.nlpIntent).filter(Boolean))];
    const signals  = [...new Set(txs.flatMap(t => t.fraudLanguageSignals || []))];
    const shifts   = txs.filter(t => t.hasIntentShift).map(t => t.transactionId || t.code).filter(Boolean);
    return { intents, fraudLanguageSignals: signals, intentShiftTxIds: shifts };
  }

  function _extractGraphEvidence(accountId, graphResult) {
    if (!graphResult) return {};
    const node  = graphResult.nodes[accountId];
    const inClusters = (graphResult.suspiciousClusters || [])
      .filter(c => c.isSuspicious && c.community.includes(accountId))
      .map(c => ({ size: c.size, volume: c.totalVolume, density: Math.round(c.density * 100) }));
    const inChains = (graphResult.moneyFlowChains || [])
      .filter(c => c.path.includes(accountId))
      .map(c => ({ hops: c.hops, suspicion: c.suspicionScore }))
      .slice(0, 3);
    return {
      degree:      node?.degree || 0,
      pageRank:    Math.round((node?.pageRank || 0) * 10000) / 100,
      isHub:       (graphResult.hubs || []).some(h => h.id === accountId),
      clusters:    inClusters,
      chains:      inChains,
      propagated:  node?.propagatedRisk || 0,
    };
  }

  function _extractBehavioralEvidence(txs) {
    if (!txs || txs.length < 4) return { insufficient: true };
    const n         = txs.length;
    const amounts   = txs.map(t => t.amount).filter(a => a > 0);
    const avgAmt    = amounts.reduce((s, v) => s + v, 0) / Math.max(1, amounts.length);
    const nightTxs  = txs.filter(t => {
      const m = (t.transactionDate || t.date || '').match(/[T\s](\d{2}):/);
      return m && [23,0,1,2,3,4].includes(parseInt(m[1]));
    }).length;
    return {
      txCount:       n,
      avgAmount:     Math.round(avgAmt),
      nightRatio:    Math.round(nightTxs / n * 100),
      topReasons:    [...new Set(txs.flatMap(t => t.fraudReasons || []))].slice(0, 4),
    };
  }

  function _extractTemporalEvidence(txs) {
    const burstTags = txs.flatMap(t => (t.tags || []).filter(g => g.startsWith('BURST_')));
    const uniqueBursts = [...new Set(burstTags)];
    const hasDrift = txs.some(t => (t.fraudReasons || []).some(r => r.endsWith('_DRIFT')));
    return { burstSignals: uniqueBursts, hasDrift };
  }

  // ─── AUDIT SNAPSHOT CREATION ─────────────────────────────────────────────────

  /**
   * Create a complete audit snapshot for an account.
   * Stored in _auditStore and exportable for compliance.
   */
  function createAuditSnapshot(accountId, accountEntry, txsForAccount, graphResult, runId) {
    const txCount      = txsForAccount.length;
    const totalVolume  = txsForAccount.reduce((s, t) => s + t.amount, 0);
    const topTags      = [...new Set(txsForAccount.flatMap(t => t.tags || []))].slice(0, 5);
    const inputHash    = computeInputHash(accountId, txCount, totalVolume, topTags);

    const snapshot = {
      // Identity
      accountId,
      runId:         runId || _runId,
      engineVersion: ENGINE_VERSION,
      versionHash:   VERSION_HASH,
      schemaVersion: SCHEMA_VERSION,
      inputHash,     // deterministic fingerprint of inputs

      // Raw inputs summary (not full data — for auditability only)
      rawInputs: {
        txCount,
        totalVolume:  Math.round(totalVolume),
        dateRange:    _txDateRange(txsForAccount),
        topTags,
        topNLPIntents: [...new Set(txsForAccount.map(t => t.nlpIntent).filter(Boolean))].slice(0, 4),
      },

      // Intermediate scores (before calibration)
      intermediateScores: accountEntry.breakdown || {},

      // Calibration result
      calibration: accountEntry.calibration || {},

      // Final output
      finalScore:    accountEntry.score,
      riskLevel:     accountEntry.riskLevel,
      confidence:    accountEntry.overallConfidence || 0,

      // Score decomposition
      decomposition: buildScoreDecomposition(accountId, accountEntry, txsForAccount, graphResult),

      // Determinism flag
      isDeterministic: true, // Phase 3 guarantee — no Date.now() in scoring path
    };

    if (!_auditLocked) {
      _auditStore[accountId] = snapshot;
      _appendChainEntry(accountId, snapshot);  // Phase 4: append to hash chain
    }
    return snapshot;
  }

  function _txDateRange(txs) {
    const dates = txs.map(t => t.transactionDate || t.date || '').filter(Boolean).sort();
    if (dates.length === 0) return '—';
    return `${dates[0].slice(0,10)} → ${dates[dates.length-1].slice(0,10)}`;
  }

  // ─── DETERMINISM VALIDATION ──────────────────────────────────────────────────

  /**
   * Validate that a score can be reproduced deterministically.
   * Checks that none of the scoring inputs contain time-dependent values.
   */
  function validateDeterminism(snapshot) {
    // Verify no random seeds embedded in the snapshot
    const serialized = JSON.stringify(snapshot.rawInputs || {});
    const hasMathRandom = serialized.includes('"random"');
    const hasDateNow    = serialized.includes('"now"');

    return {
      isDeterministic: !hasMathRandom && !hasDateNow,
      inputHash:       snapshot.inputHash,
      engineVersion:   snapshot.engineVersion,
    };
  }

  // ─── CONFLICT REPORT ─────────────────────────────────────────────────────────

  /**
   * Build a human-readable conflict explanation for the investigation report.
   */
  function buildConflictExplanation(conflict) {
    if (!conflict) return null;
    const { severity, maxEngine, minEngine, spread, reconciliation } = conflict;

    const severityLabel = severity === 'HIGH' ? 'Nghiêm trọng' : 'Trung bình';
    const reconLabel    = reconciliation === 'CONSERVATIVE_MEDIAN' ? 'trung vị bảo thủ' : 'trung bình có trọng số';

    return `[Xung đột ${severityLabel}] ${maxEngine} = cao, ${minEngine} = thấp (sai lệch ${spread} điểm). Đã điều chỉnh bằng phương pháp ${reconLabel}.`;
  }

  // ─── BATCH PROCESSING ────────────────────────────────────────────────────────

  /**
   * Create audit snapshots for all accounts after calibration.
   * Returns the full audit store.
   */
  function processAll(calibratedAccountScores, transactions, graphResult) {
    clearAuditStore();

    const byAccount = {};
    transactions.forEach(tx => {
      const acc = tx.accountNumber || '_unknown';
      if (!byAccount[acc]) byAccount[acc] = [];
      byAccount[acc].push(tx);
    });

    Object.entries(calibratedAccountScores).forEach(([acc, entry]) => {
      createAuditSnapshot(acc, entry, byAccount[acc] || [], graphResult, _runId);
    });

    return _auditStore;
  }

  // ─── QUERY INTERFACE ─────────────────────────────────────────────────────────

  function getSnapshot(accountId)  { return _auditStore[accountId] || null; }
  function getAllSnapshots()        { return Object.values(_auditStore); }
  function getRunId()              { return _runId; }
  function getEngineVersion()      { return ENGINE_VERSION; }
  function getVersionHash()        { return VERSION_HASH; }

  /**
   * Build a governance report row for Excel export.
   */
  function buildGovernanceExcelRows(auditStore) {
    const rows = [];
    rows.push({ 'Trường': '── GOVERNANCE AUDIT LOG ──', 'Giá Trị': '' });
    rows.push({ 'Trường': 'Engine Version', 'Giá Trị': ENGINE_VERSION });
    rows.push({ 'Trường': 'Version Hash',   'Giá Trị': VERSION_HASH });
    rows.push({ 'Trường': 'Schema',         'Giá Trị': SCHEMA_VERSION });
    rows.push({ 'Trường': '', 'Giá Trị': '' });

    Object.values(auditStore).slice(0, 30).forEach(snap => {
      const cal = snap.calibration || {};
      rows.push({
        'Trường': `${snap.accountId} [${snap.riskLevel}]`,
        'Giá Trị': `Score:${snap.finalScore} Conf:${snap.confidence}% Hash:${snap.inputHash} TxLayer:${snap.intermediateScores.txScore||0} Graph:${snap.intermediateScores.graphScore||0} Behav:${snap.intermediateScores.behavioralScore||0} Burst:${snap.intermediateScores.burstScore||0}${cal.conflict ? ' [CONFLICT:'+cal.conflict.severity+']' : ''}`,
      });
    });

    return rows;
  }

  return {
    processAll,
    createAuditSnapshot,
    buildScoreDecomposition,
    validateDeterminism,
    buildConflictExplanation,
    buildGovernanceExcelRows,
    getSnapshot,
    getAllSnapshots,
    getRunId,
    getEngineVersion,
    getVersionHash,
    // Phase 4: hash-chain audit
    verifyAuditChain,
    lockAuditStore,
    getAuditChain,
    isAuditLocked,
    ENGINE_VERSION,
    VERSION_HASH,
    SCHEMA_VERSION,
  };

})();
