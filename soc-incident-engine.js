/**
 * soc-incident-engine.js — SOC Incident Management Layer (Phase 4)
 *
 * Transforms fraud detection results into structured SOC incident workflow.
 *
 * AUTO-GENERATES INCIDENTS WHEN:
 *   • FraudScore >= 50 (HIGH / CRITICAL accounts)
 *   • NLP SUSPICIOUS_PROXY pattern detected (≥3 transactions)
 *   • Money laundering chain detected (suspicionScore >= 30)
 *   • Temporal burst anomaly (BURST_* tags present)
 *   • Suspicious cluster detected (size ≥ 3, density threshold exceeded)
 *
 * LIFECYCLE STATES:
 *   OPEN → UNDER_INVESTIGATION → ESCALATED → RESOLVED
 *                                          → FALSE_POSITIVE_CONFIRMED
 */
const SOCIncidentEngine = (() => {

  const STATES = ['OPEN','UNDER_INVESTIGATION','ESCALATED','RESOLVED','FALSE_POSITIVE_CONFIRMED'];
  const STATE_LABELS_VI = {
    OPEN:                      'Mở — Chưa xử lý',
    UNDER_INVESTIGATION:       'Đang điều tra',
    ESCALATED:                 'Đã leo thang',
    RESOLVED:                  'Đã giải quyết',
    FALSE_POSITIVE_CONFIRMED:  'Xác nhận dương tính giả',
  };
  const SEVERITY_COLORS = {
    CRITICAL: '#ff3b30', HIGH: '#ff8800', MEDIUM: '#ffcc00', LOW: '#4ade80',
  };

  const THRESHOLDS = {
    criticalScore:    75,
    highScore:        50,
    proxyMinTxs:      3,
    chainSuspicion:   30,
    burstTag:         'BURST',
    clusterMinSize:   3,
  };

  let _incidentSeq = 0;

  function _nextId() {
    _incidentSeq++;
    return `INC-${String(_incidentSeq).padStart(5, '0')}`;
  }

  // ─── AUTO-INCIDENT GENERATION ────────────────────────────────────────────────

  function generateIncidents(caseId, transactions, accountScores, graphResult) {
    _incidentSeq = 0;  // reset per case for determinism
    const incidents = [];

    // Build account → transaction index
    const byAccount = {};
    transactions.forEach(t => {
      const acc = t.accountNumber || '_unknown';
      if (!byAccount[acc]) byAccount[acc] = [];
      byAccount[acc].push(t);
    });

    // ── 1. ACCOUNT FRAUD SCORE INCIDENTS ─────────────────────────────────────
    Object.entries(accountScores)
      .filter(([, e]) => e.score >= THRESHOLDS.highScore)
      .sort(([, a], [, b]) => b.score - a.score)
      .forEach(([acc, entry]) => {
        const severity   = entry.score >= THRESHOLDS.criticalScore ? 'CRITICAL' : 'HIGH';
        const txsForAcc  = byAccount[acc] || [];
        const highRiskTxs = txsForAcc.filter(t => (t.fraudScore || 0) >= 50);

        const triggers = [
          { type: 'FRAUD_SCORE', detail: `Điểm tổng hợp: ${entry.score}/100`, value: entry.score },
        ];
        (entry.reasons || []).slice(0, 3).forEach(r => {
          if (r.includes('BURST'))     triggers.push({ type: 'TEMPORAL_BURST',  detail: r, value: 0 });
          if (r.includes('CLUSTER'))   triggers.push({ type: 'GRAPH_ANOMALY',   detail: r, value: 0 });
          if (r.includes('FRAUD_LANG'))triggers.push({ type: 'NLP_PROXY',       detail: r, value: 0 });
        });

        incidents.push({
          incidentId:     _nextId(),
          caseId,
          state:          'OPEN',
          severity,
          type:           'ACCOUNT_RISK',
          title:          `[${severity}] TK ${acc} — ${entry.score}/100`,
          description:    `Tài khoản ${acc} kích hoạt ngưỡng ${severity}: ${entry.txCount} GD, ` +
                          `tổng ${(entry.totalVolume/1e6).toFixed(0)}M VND.`,
          triggers,
          primaryAccount: acc,
          accounts: [{
            accountId:  acc,
            fraudScore: entry.score,
            riskLevel:  entry.riskLevel,
            reasons:    (entry.reasons || []).slice(0, 3),
          }],
          evidenceTxIds:  highRiskTxs.map(t => t.transactionId).slice(0, 6),
          topEvidence:    highRiskTxs.slice(0, 3).map(t => ({
            txId:   t.transactionId,
            amount: t.amount,
            date:   (t.transactionDate || t.date || '').slice(0, 16),
            reason: (t.fraudReasons || [])[0] || '',
          })),
          clusterId:      null,
          createdAt:      Date.now(),
          updatedAt:      Date.now(),
        });
      });

    // ── 2. NLP PROXY TRANSFER NETWORK ────────────────────────────────────────
    const proxyTxs = transactions.filter(t =>
      (t.fraudLanguageSignals || []).length > 0 ||
      t.nlpIntent === 'SUSPICIOUS_PROXY'
    );

    if (proxyTxs.length >= THRESHOLDS.proxyMinTxs) {
      const proxyAccounts = [...new Set(proxyTxs.map(t => t.accountNumber))];
      const uniqueSignals = [...new Set(proxyTxs.flatMap(t => t.fraudLanguageSignals || []))];

      incidents.push({
        incidentId:     _nextId(),
        caseId,
        state:          'OPEN',
        severity:       proxyTxs.length >= 10 ? 'CRITICAL' : 'HIGH',
        type:           'NLP_PROXY_NETWORK',
        title:          `Mạng chuyển hộ — ${proxyTxs.length} GD / ${proxyAccounts.length} TK`,
        description:    `Phát hiện ${proxyTxs.length} giao dịch có ngôn ngữ chuyển hộ/trung gian từ ` +
                        `${proxyAccounts.length} tài khoản. Tín hiệu: ${uniqueSignals.slice(0,3).join(', ')}.`,
        triggers: [{
          type:   'NLP_PROXY',
          detail: `${proxyTxs.length} proxy GD, tín hiệu: ${uniqueSignals.join(',')}`,
          value:  proxyTxs.length,
        }],
        primaryAccount: proxyAccounts[0] || null,
        accounts: proxyAccounts.slice(0, 5).map(acc => ({
          accountId:  acc,
          fraudScore: accountScores[acc]?.score || 0,
          riskLevel:  accountScores[acc]?.riskLevel || 'MEDIUM',
          reasons:    [],
        })),
        evidenceTxIds:  proxyTxs.map(t => t.transactionId).slice(0, 8),
        topEvidence:    proxyTxs.slice(0, 3).map(t => ({
          txId:   t.transactionId,
          amount: t.amount,
          date:   (t.transactionDate || t.date || '').slice(0, 16),
          reason: (t.fraudLanguageSignals || []).join(', '),
        })),
        clusterId:      null,
        createdAt:      Date.now(),
        updatedAt:      Date.now(),
      });
    }

    // ── 3. MONEY LAUNDERING CHAIN INCIDENTS ──────────────────────────────────
    const launderingChains = (graphResult?.moneyFlowChains || [])
      .filter(c => c.isLayering && (c.suspicionScore || 0) >= THRESHOLDS.chainSuspicion)
      .slice(0, 4);

    launderingChains.forEach((chain, idx) => {
      const chainAccounts = chain.path.map(id => ({
        accountId:  id,
        fraudScore: accountScores[id]?.score || 0,
        riskLevel:  accountScores[id]?.riskLevel || 'HIGH',
        reasons:    [],
      }));

      incidents.push({
        incidentId:     _nextId(),
        caseId,
        state:          'OPEN',
        severity:       (chain.suspicionScore || 0) >= 50 ? 'CRITICAL' : 'HIGH',
        type:           'LAUNDERING_CHAIN',
        title:          `Chuỗi rửa tiền #${idx+1} — ${chain.hops} bước, ${(chain.chainVolume/1e6).toFixed(0)}M VND`,
        description:    `Phát hiện chuỗi chuyển tiền đa cấp: ${chain.path.slice(0,5).join(' → ')}` +
                        `${chain.path.length > 5 ? ' ...' : ''}. ` +
                        `${chain.isRapid ? 'Chuyển tiền rapid (<48h).' : ''}`,
        triggers: [{
          type:   'GRAPH_ANOMALY',
          detail: `${chain.hops} hops, suspicion ${chain.suspicionScore || 0}`,
          value:  chain.suspicionScore || 0,
        }],
        primaryAccount: chain.path[0] || null,
        accounts:       chainAccounts.slice(0, 6),
        evidenceTxIds:  [],
        chainPath:      chain.path,
        chainVolume:    chain.chainVolume,
        clusterId:      null,
        createdAt:      Date.now(),
        updatedAt:      Date.now(),
      });
    });

    // ── 4. TEMPORAL BURST INCIDENT ───────────────────────────────────────────
    const burstAccounts = Object.entries(accountScores)
      .filter(([, e]) => (e.reasons || []).some(r => r.startsWith('BURST')))
      .map(([id, e]) => ({ accountId: id, fraudScore: e.score, riskLevel: e.riskLevel, reasons: e.reasons }));

    if (burstAccounts.length > 0) {
      incidents.push({
        incidentId:     _nextId(),
        caseId,
        state:          'OPEN',
        severity:       burstAccounts.some(a => a.riskLevel === 'CRITICAL') ? 'CRITICAL' : 'MEDIUM',
        type:           'TEMPORAL_BURST',
        title:          `Đột biến hoạt động — ${burstAccounts.length} tài khoản`,
        description:    `${burstAccounts.length} tài khoản có giao dịch dồn dập bất thường trong ` +
                        `khoảng thời gian ngắn (phát hiện qua cửa sổ 1h/6h/24h).`,
        triggers: [{
          type:   'TEMPORAL_BURST',
          detail: `${burstAccounts.length} accounts with burst pattern`,
          value:  burstAccounts.length,
        }],
        primaryAccount: burstAccounts[0]?.accountId || null,
        accounts:       burstAccounts.slice(0, 5),
        evidenceTxIds:  [],
        clusterId:      null,
        createdAt:      Date.now(),
        updatedAt:      Date.now(),
      });
    }

    // ── 5. SUSPICIOUS CLUSTER INCIDENTS ──────────────────────────────────────
    const suspClusters = (graphResult?.suspiciousClusters || [])
      .filter(c => c.isSuspicious && c.size >= THRESHOLDS.clusterMinSize)
      .slice(0, 3);

    suspClusters.forEach((cluster, idx) => {
      incidents.push({
        incidentId:     _nextId(),
        caseId,
        state:          'OPEN',
        severity:       cluster.avgFraud >= THRESHOLDS.criticalScore ? 'CRITICAL' : 'HIGH',
        type:           'CLUSTER_ANOMALY',
        title:          `Cụm giao dịch đáng ngờ #${idx+1} — ${cluster.size} TK, ${(cluster.totalVolume/1e6).toFixed(0)}M VND`,
        description:    `Cụm ${cluster.size} tài khoản với mật độ ${(cluster.density*100).toFixed(0)}%, ` +
                        `điểm TB ${cluster.avgFraud.toFixed(0)}/100. Tổng dòng tiền: ${(cluster.totalVolume/1e6).toFixed(0)}M VND.`,
        triggers: [{
          type:   'GRAPH_ANOMALY',
          detail: `Density ${(cluster.density*100).toFixed(0)}%, size ${cluster.size}`,
          value:  cluster.avgFraud,
        }],
        primaryAccount: cluster.community[0] || null,
        accounts: cluster.community.slice(0, 5).map(id => ({
          accountId:  id,
          fraudScore: accountScores[id]?.score || 0,
          riskLevel:  accountScores[id]?.riskLevel || 'HIGH',
          reasons:    [],
        })),
        evidenceTxIds:  [],
        clusterId:      `CLU-${idx+1}`,
        createdAt:      Date.now(),
        updatedAt:      Date.now(),
      });
    });

    // ── 6. CLUSTER RELATED INCIDENTS ─────────────────────────────────────────
    _clusterRelatedIncidents(incidents, graphResult, accountScores);

    return incidents;
  }

  /** Group incidents that share accounts or are in same graph community */
  function _clusterRelatedIncidents(incidents, graphResult, accountScores) {
    const accountToInc = {};
    incidents.forEach(inc => {
      (inc.accounts || []).forEach(a => {
        if (!accountToInc[a.accountId]) accountToInc[a.accountId] = [];
        accountToInc[a.accountId].push(inc.incidentId);
      });
    });

    let clusterSeq = 0;
    const assigned = new Set();

    incidents.forEach(inc => {
      if (assigned.has(inc.incidentId) || inc.clusterId) return;
      const related = new Set([inc.incidentId]);
      (inc.accounts || []).forEach(a => {
        (accountToInc[a.accountId] || []).forEach(id => related.add(id));
      });
      if (related.size > 1) {
        clusterSeq++;
        const cId = `ICLU-${String(clusterSeq).padStart(3,'0')}`;
        related.forEach(id => {
          const target = incidents.find(i => i.incidentId === id);
          if (target && !target.clusterId) {
            target.clusterId = cId;
            assigned.add(id);
          }
        });
      }
    });
  }

  // ─── INCIDENT LIFECYCLE ───────────────────────────────────────────────────────

  function updateState(incident, newState) {
    if (!STATES.includes(newState)) return false;
    incident.state     = newState;
    incident.updatedAt = Date.now();
    return true;
  }

  function getSeveritySummary(incidents) {
    const s = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, OPEN: 0, RESOLVED: 0, total: 0 };
    incidents.forEach(inc => {
      s[inc.severity] = (s[inc.severity] || 0) + 1;
      if (inc.state === 'OPEN')                                           s.OPEN++;
      if (['RESOLVED','FALSE_POSITIVE_CONFIRMED'].includes(inc.state))   s.RESOLVED++;
      s.total++;
    });
    return s;
  }

  function getStateLabel(state)     { return STATE_LABELS_VI[state] || state; }
  function getSeverityColor(sev)    { return SEVERITY_COLORS[sev] || '#64748b'; }

  return {
    generateIncidents,
    updateState,
    getSeveritySummary,
    getStateLabel,
    getSeverityColor,
    STATES,
    THRESHOLDS,
  };

})();
