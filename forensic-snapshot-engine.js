/**
 * forensic-snapshot-engine.js — Immutable Forensic Snapshot System (Phase 4)
 *
 * Creates verifiable, tamper-detectable snapshots of the full pipeline state.
 *
 * HASHING ALGORITHM: FNV-1a 32-bit (browser-compatible, no Node.js crypto needed)
 *   - Deterministic: same input always → same hash
 *   - Fast: O(n) where n = string length
 *   - Collision-resistant enough for forensic audit purposes
 *
 * SNAPSHOT LAYERS:
 *   1. inputHash      — file names + tx counts (source files fingerprint)
 *   2. txDataHash     — transaction IDs + amounts + dates (normalized data)
 *   3. graphHash      — node + edge keys (graph structure)
 *   4. nlpHash        — intent classifications per transaction
 *   5. fraudHash      — account scores (calibrated)
 *   6. calibrationHash— calibration metadata (engine configuration)
 *   7. systemHash     — master hash chaining all 6 above
 */
const ForensicSnapshotEngine = (() => {

  // ─── FNV-1a 32-BIT HASH ──────────────────────────────────────────────────────

  function fnv1a(str) {
    let h = 2166136261 >>> 0;  // FNV offset basis (unsigned)
    for (let i = 0; i < str.length; i++) {
      h  = (h ^ str.charCodeAt(i)) >>> 0;
      h  = Math.imul(h, 16777619) >>> 0;  // FNV prime
    }
    return h.toString(16).padStart(8, '0').toUpperCase();
  }

  function hashObject(obj) {
    return fnv1a(JSON.stringify(obj, Object.keys(obj).sort()));
  }

  /** Chain two hashes deterministically */
  function chainHash(h1, h2) {
    return fnv1a(`${h1}|${h2}`);
  }

  // ─── SNAPSHOT CREATION ────────────────────────────────────────────────────────

  /**
   * Create a complete forensic snapshot for a case.
   * All hashes are deterministic given the same inputs.
   */
  function createSnapshot(caseId, { files, transactions, graphResult, accountScores, calibrationMeta }) {

    // ── Stage 1: Input hash (source file fingerprint) ─────────────────────────
    const inputHash = fnv1a(
      (files || [])
        .map(f => `${f.name || ''}:${f.bankName || ''}:${f.txCount || 0}`)
        .sort()
        .join('||')
    );

    // ── Stage 2: Transaction data hash (normalized data fingerprint) ──────────
    // Sort transactions deterministically by ID to ensure consistent ordering
    const txDataHash = fnv1a(
      (transactions || [])
        .map(t => `${t.transactionId || ''}:${Math.round(t.amount || 0)}:${(t.transactionDate||'').slice(0,10)}:${t.accountNumber || ''}`)
        .sort()
        .join('||')
    );

    // ── Stage 3: Graph structure hash ─────────────────────────────────────────
    const graphHash = graphResult
      ? fnv1a(
          Object.keys(graphResult.nodes || {}).sort().join(',') +
          '|' +
          Object.keys(graphResult.edges || {}).sort().join(',') +
          '|' +
          String(Math.round((graphResult.entropy || 0) * 1000))
        )
      : 'NO_GRAPH_00000000';

    // ── Stage 4: NLP output hash (intent classifications) ─────────────────────
    const nlpHash = fnv1a(
      (transactions || [])
        .map(t => `${t.transactionId || ''}:${t.nlpIntent || 'UNKNOWN'}`)
        .sort()
        .join('||')
    );

    // ── Stage 5: Fraud score hash (calibrated account scores) ─────────────────
    const fraudHash = fnv1a(
      Object.entries(accountScores || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, s]) => `${id}:${s.score || 0}:${s.riskLevel || 'LOW'}`)
        .join('||')
    );

    // ── Stage 6: Calibration config hash ─────────────────────────────────────
    const calibrationHash = fnv1a(
      JSON.stringify({
        avgConfidence: calibrationMeta?.avgConfidence || 0,
        conflictRate:  calibrationMeta?.conflictRate  || 0,
        conflicts:     calibrationMeta?.conflictsDetected || 0,
      })
    );

    // ── Stage 7: System master hash (chain all stage hashes) ─────────────────
    const systemHash = fnv1a([
      inputHash, txDataHash, graphHash, nlpHash, fraudHash, calibrationHash
    ].join('::'));

    const engineVersion = typeof FraudGovernanceLayer !== 'undefined'
      ? FraudGovernanceLayer.ENGINE_VERSION : '3.0.0';
    const versionHash = typeof FraudGovernanceLayer !== 'undefined'
      ? FraudGovernanceLayer.VERSION_HASH : 'UNKNOWN';

    return {
      caseId,
      snapshotId:       `SNAP-${systemHash}`,
      createdAt:        'DETERMINISTIC',  // never store real timestamps in snapshots

      // Engine metadata
      engineVersion,
      engineVersionHash: versionHash,

      // Stage hashes (immutable fingerprints of each pipeline stage)
      stages: {
        inputHash,
        txDataHash,
        graphHash,
        nlpHash,
        fraudHash,
        calibrationHash,
      },

      // Master hash
      systemHash,

      // Quick-verify counts (for fast consistency check)
      txCount:       (transactions || []).length,
      accountCount:  Object.keys(accountScores || {}).length,
      graphNodes:    Object.keys((graphResult || {}).nodes || {}).length,
      graphEdges:    Object.keys((graphResult || {}).edges || {}).length,

      // Reproducibility guarantee
      isReproducible: true,
      deterministicGuarantee: 'FNV-1a-32 hash of sorted deterministic inputs',
    };
  }

  // ─── SNAPSHOT VERIFICATION ────────────────────────────────────────────────────

  /**
   * Recompute snapshot and compare stage-by-stage.
   * Returns detailed check results for each pipeline stage.
   */
  function verifySnapshot(existingSnapshot, payload) {
    if (!existingSnapshot || !payload) {
      return { verified: false, checks: {}, reason: 'Missing snapshot or data' };
    }

    const recomputed = createSnapshot(existingSnapshot.caseId, payload);

    const checks = {
      inputHash:        recomputed.stages.inputHash        === existingSnapshot.stages.inputHash,
      txDataHash:       recomputed.stages.txDataHash       === existingSnapshot.stages.txDataHash,
      graphHash:        recomputed.stages.graphHash        === existingSnapshot.stages.graphHash,
      nlpHash:          recomputed.stages.nlpHash          === existingSnapshot.stages.nlpHash,
      fraudHash:        recomputed.stages.fraudHash        === existingSnapshot.stages.fraudHash,
      calibrationHash:  recomputed.stages.calibrationHash  === existingSnapshot.stages.calibrationHash,
      systemHash:       recomputed.systemHash              === existingSnapshot.systemHash,
      engineVersion:    recomputed.engineVersion           === existingSnapshot.engineVersion,
    };

    const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const verified = failed.length === 0;

    return {
      verified,
      checks,
      failedStages:     failed,
      recomputedHash:   recomputed.systemHash,
      expectedHash:     existingSnapshot.systemHash,
    };
  }

  // ─── SNAPSHOT DISPLAY HELPERS ─────────────────────────────────────────────────

  function formatSnapshotSummary(snapshot) {
    if (!snapshot) return 'Chưa có snapshot';
    return [
      `ID: ${snapshot.snapshotId}`,
      `Engine: v${snapshot.engineVersion}`,
      `TX: ${snapshot.txCount} | Accounts: ${snapshot.accountCount} | Nodes: ${snapshot.graphNodes}`,
      `Hash: ${snapshot.systemHash}`,
    ].join(' · ');
  }

  function getStageStatusIcon(stageHash) {
    return stageHash && stageHash !== 'NO_GRAPH_00000000' ? '✓' : '○';
  }

  // ─── HASH UTILITIES ───────────────────────────────────────────────────────────

  function hashString(s)  { return fnv1a(String(s)); }
  function hashArray(arr) { return fnv1a(arr.sort().join('|')); }

  return {
    createSnapshot,
    verifySnapshot,
    formatSnapshotSummary,
    getStageStatusIcon,
    fnv1a,
    hashObject,
    chainHash,
    hashString,
    hashArray,
  };

})();
