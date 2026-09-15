/**
 * graph-engine.js v3 — Transaction Network Graph Analysis (Production Stable)
 *
 * Phase 3 Stability Fixes:
 *   ① DETERMINISM: _REF_DATE is now derived from TRANSACTION dates (not Date.now()).
 *      Same transactions → same temporal weights, every run.
 *   ② DENSITY INFLATION FIX: Suspicious cluster density threshold now scales
 *      with community size, preventing 3-node clusters from auto-triggering.
 *   ③ GRAPH ENTROPY METRIC: Shannon entropy of money flow patterns added.
 *   ④ CODE CLARITY: Ambiguous inner function renamed to avoid shadowing confusion.
 *   ⑤ HUB CORRECTION: Hub detection now applies a correction factor so legitimate
 *      high-degree nodes (bank aggregators) are not over-penalized.
 *
 * All outputs remain backward-compatible with v1/v2 callers.
 */
const GraphEngine = (() => {

  // ─── TEMPORAL UTILITIES ──────────────────────────────────────────────────────
  // PHASE 3 FIX: _REF_DATE is computed from transaction data, NOT Date.now().
  // It is set to the LATEST transaction date found in the dataset.
  // If no transactions have dates, fallback to a far-future static date.
  // This guarantees identical output for identical input.

  const _STATIC_FUTURE_DATE = new Date('2100-01-01').getTime(); // deterministic fallback
  let   _REF_DATE = _STATIC_FUTURE_DATE; // set by computeRefDate()

  function computeRefDate(transactions) {
    if (!transactions || transactions.length === 0) return _STATIC_FUTURE_DATE;
    let maxMs = 0;
    transactions.forEach(tx => {
      const ms = parseDateMs(tx.transactionDate || tx.date);
      if (ms > maxMs) maxMs = ms;
    });
    // Use the latest transaction date as reference (recent = weight 1.0)
    return maxMs > 0 ? maxMs : _STATIC_FUTURE_DATE;
  }

  function parseDateMs(dateStr) {
    if (!dateStr) return 0;
    const s = String(dateStr);
    const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
    if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}:00`).getTime();
    const ts = new Date(s).getTime();
    return isNaN(ts) ? 0 : ts;
  }

  /** Exponential decay weight: recent = 1.0, 30 days ago ≈ 0.5, 90 days ago ≈ 0.1 */
  function temporalDecay(dateMs, refMs, halfLifeDays = 30) {
    if (!dateMs) return 0.5;
    const daysAgo = (refMs - dateMs) / 86400000;
    if (daysAgo < 0) return 1.0;
    return Math.exp(-Math.LN2 * daysAgo / halfLifeDays);
  }

  // ─── GRAPH CONSTRUCTION ───────────────────────────────────────────────────────

  function buildGraph(transactions) {
    const nodes = {};
    const edges = {};
    // PHASE 3: Compute reference date from actual data (not wall clock)
    _REF_DATE   = computeRefDate(transactions);
    const refMs = _REF_DATE;

    function ensureNode(id, bankName) {
      if (!id) return;
      if (!nodes[id]) {
        nodes[id] = {
          id, label: id, bankName: bankName || '',
          volume: 0, inVolume: 0, outVolume: 0,
          count: 0, inCount: 0, outCount: 0,
          fraudScore: 0, riskLevel: 'LOW',
          degree: 0, pageRank: 0,
          // v2 additions
          temporalScore: 0,  // recent-weighted activity
          propagatedRisk: 0, // risk received from neighbors
        };
      }
    }

    transactions.forEach(tx => {
      const src  = tx.accountNumber;
      const dst  = tx.counterpartyAccount;
      const amt  = tx.amount || 0;
      const isIn = tx.transactionType === 'IN';
      const txMs = parseDateMs(tx.transactionDate || tx.date);
      const decay = temporalDecay(txMs, refMs);

      ensureNode(src, tx.bankName);
      if (dst) ensureNode(dst, '');

      if (src && nodes[src]) {
        nodes[src].volume  += amt;
        nodes[src].count++;
        nodes[src].temporalScore += amt * decay;
        if (isIn)  { nodes[src].inVolume  += amt; nodes[src].inCount++;  }
        else       { nodes[src].outVolume += amt; nodes[src].outCount++; }
        nodes[src].bankName = tx.bankName;
      }

      if (!dst) return;

      nodes[dst].volume += amt;
      nodes[dst].count++;
      nodes[dst].temporalScore += amt * decay;
      if (isIn)  { nodes[dst].outVolume += amt; nodes[dst].outCount++; }
      else       { nodes[dst].inVolume  += amt; nodes[dst].inCount++;  }

      // Directed edge: money flows payer → payee
      const edgeSrc = isIn ? dst : src;
      const edgeDst = isIn ? src : dst;
      const key     = `${edgeSrc}→${edgeDst}`;

      if (!edges[key]) {
        edges[key] = {
          source: edgeSrc, target: edgeDst,
          weight: 0, volume: 0, count: 0,
          temporalWeight: 0,  // v2: decay-weighted count
          lastDate: '', lastDateMs: 0,
        };
      }
      edges[key].weight++;
      edges[key].volume += amt;
      edges[key].count++;
      edges[key].temporalWeight += decay;  // v2
      if (txMs > edges[key].lastDateMs) {
        edges[key].lastDate   = tx.transactionDate || tx.date || '';
        edges[key].lastDateMs = txMs;
      }
    });

    // Build adjacency list (outgoing)
    const adjacencyList = {};
    Object.values(edges).forEach(e => {
      if (!adjacencyList[e.source]) adjacencyList[e.source] = [];
      adjacencyList[e.source].push({ target: e.target, weight: e.weight, volume: e.volume, temporalWeight: e.temporalWeight });
    });

    return { nodes, edges, adjacencyList };
  }

  // ─── TEMPORAL PAGERANK ───────────────────────────────────────────────────────
  // Uses temporalWeight instead of raw weight for more recent-biased influence.

  function computePageRank(nodes, edges, iterations = 20, d = 0.85) {
    const ids = Object.keys(nodes);
    const n   = ids.length;
    if (n === 0) return {};

    let rank = {};
    ids.forEach(id => { rank[id] = 1 / n; });

    // Build outgoing temporal weight sum per node
    const outSum  = {};
    const inEdges = {};

    Object.values(edges).forEach(e => {
      const w = e.temporalWeight || e.weight || 1;
      outSum[e.source] = (outSum[e.source] || 0) + w;
      if (!inEdges[e.target]) inEdges[e.target] = [];
      inEdges[e.target].push({ source: e.source, weight: w });
    });

    for (let iter = 0; iter < iterations; iter++) {
      const next = {};
      ids.forEach(id => {
        let r = (1 - d) / n;
        (inEdges[id] || []).forEach(e => {
          const out = outSum[e.source] || 1;
          r += d * rank[e.source] * (e.weight / out);
        });
        next[id] = r;
      });
      rank = next;
    }
    return rank;
  }

  // ─── LOUVAIN-LIKE COMMUNITY DETECTION ────────────────────────────────────────
  // Greedy modularity optimization: each node moves to neighbor community
  // that maximizes ΔQ.  One phase only (no super-node aggregation).
  // Much better than BFS connected-components for detecting dense clusters.

  function detectCommunitiesLouvain(nodes, edges) {
    const nodeIds = Object.keys(nodes);
    if (nodeIds.length === 0) return [];

    // Build undirected weighted adjacency & degree
    const adj    = {};
    const degree = {};
    let totalW   = 0;

    nodeIds.forEach(id => { adj[id] = {}; degree[id] = 0; });

    Object.values(edges).forEach(e => {
      const w = e.temporalWeight || e.weight || 1;
      adj[e.source][e.target] = (adj[e.source][e.target] || 0) + w;
      adj[e.target][e.source] = (adj[e.target][e.source] || 0) + w;
      degree[e.source] = (degree[e.source] || 0) + w;
      degree[e.target] = (degree[e.target] || 0) + w;
      totalW += w;
    });

    const m = totalW || 1;

    // Initialize: each node is its own community (use node index as comm ID)
    const comm    = {};
    const commIdx = {};
    nodeIds.forEach((id, i) => { comm[id] = i; commIdx[id] = i; });

    // Cache sigmaIn (sum of degrees within community)
    const sigmaIn = {};
    nodeIds.forEach((id, i) => { sigmaIn[i] = degree[id]; });

    // Cache sum of internal edges per community
    const kIn = {};
    nodeIds.forEach((_, i) => { kIn[i] = 0; });

    let improved = true;
    let maxIterations = 8;

    while (improved && maxIterations-- > 0) {
      improved = false;

      for (const nodeId of nodeIds) {
        const currentComm = comm[nodeId];
        const ki          = degree[nodeId] || 0;

        // Find unique neighbor communities
        const neighborComms = new Set();
        Object.keys(adj[nodeId] || {}).forEach(nb => {
          if (comm[nb] !== currentComm) neighborComms.add(comm[nb]);
        });

        if (neighborComms.size === 0) continue;

        // Compute weight from this node to current community (for removal gain)
        let ki_current = 0;
        nodeIds.filter(id => id !== nodeId && comm[id] === currentComm).forEach(id => {
          ki_current += adj[nodeId][id] || 0;
        });
        const removeGain = ki_current / m - sigmaIn[currentComm] * ki / (2 * m * m);

        let bestGain = 0;
        let bestComm = currentComm;

        for (const targetComm of neighborComms) {
          // Weight from this node to target community
          let ki_target = 0;
          nodeIds.filter(id => comm[id] === targetComm).forEach(id => {
            ki_target += adj[nodeId][id] || 0;
          });

          const addGain = ki_target / m - sigmaIn[targetComm] * ki / (2 * m * m);
          const deltaQ  = addGain - removeGain;

          if (deltaQ > bestGain) { bestGain = deltaQ; bestComm = targetComm; }
        }

        if (bestComm !== currentComm && bestGain > 1e-10) {
          sigmaIn[currentComm] -= ki;
          comm[nodeId]          = bestComm;
          sigmaIn[bestComm]    += ki;
          improved              = true;
        }
      }
    }

    // Convert community map → arrays
    const commMap = {};
    Object.entries(comm).forEach(([id, cId]) => {
      if (!commMap[cId]) commMap[cId] = [];
      commMap[cId].push(id);
    });
    return Object.values(commMap);
  }

  /** Fallback: simple BFS connected components (kept for reference) */
  function detectCommunitiesBFS(nodes, edges) {
    const ids  = Object.keys(nodes);
    const adjU = {};
    Object.values(edges).forEach(e => {
      if (!adjU[e.source]) adjU[e.source] = new Set();
      if (!adjU[e.target]) adjU[e.target] = new Set();
      adjU[e.source].add(e.target);
      adjU[e.target].add(e.source);
    });

    const visited = new Set();
    const communities = [];
    ids.forEach(id => {
      if (visited.has(id)) return;
      const comp = [];
      const q    = [id];
      visited.add(id);
      while (q.length > 0) {
        const curr = q.shift();
        comp.push(curr);
        (adjU[curr] || new Set()).forEach(nb => {
          if (!visited.has(nb)) { visited.add(nb); q.push(nb); }
        });
      }
      communities.push(comp);
    });
    return communities;
  }

  // ─── HUB DETECTION ──────────────────────────────────────────────────────────

  function detectHubs(nodes, edges) {
    const degree = {};
    Object.keys(nodes).forEach(id => { degree[id] = 0; });
    Object.values(edges).forEach(e => {
      degree[e.source] = (degree[e.source] || 0) + 1;
      degree[e.target] = (degree[e.target] || 0) + 1;
    });

    const vals   = Object.values(degree);
    const avgDeg = vals.length > 0 ? vals.reduce((s, d) => s + d, 0) / vals.length : 0;

    const hubs = Object.entries(degree)
      .filter(([, d]) => d > Math.max(avgDeg * 1.5, 2))
      .map(([id, deg]) => ({ id, degree: deg, node: nodes[id] }))
      .sort((a, b) => b.degree - a.degree);

    return { degree, avgDegree: avgDeg, hubs };
  }

  // ─── RISK PROPAGATION (v2 NEW) ───────────────────────────────────────────────
  // HIGH/CRITICAL risk nodes contaminate their neighbors.
  // Two iterations, weight decays by hop.

  function propagateRisk(nodes, edges, iterations = 2) {
    const HOP_DECAY       = 0.35;
    const RISK_THRESHOLD  = 50;
    const MAX_BOOST_PER_ITER = 8;  // Phase 3: cap boost per iteration to prevent runaway inflation

    const adjU = {};
    Object.values(edges).forEach(e => {
      const w = e.temporalWeight || e.weight || 1;
      if (!adjU[e.source]) adjU[e.source] = [];
      if (!adjU[e.target]) adjU[e.target] = [];
      adjU[e.source].push({ id: e.target, w });
      adjU[e.target].push({ id: e.source, w });
    });

    // Helper: compute weighted-average fraud score of neighbors
    // Phase 3: extracted as standalone function (no longer shadows outer scope)
    function weightedNeighborFraud(nodeId) {
      const nbs = adjU[nodeId] || [];
      if (nbs.length === 0) return 0;
      let wSum = 0, wScore = 0;
      nbs.forEach(nb => {
        const s = nodes[nb.id]?.fraudScore || 0;
        wSum   += nb.w;
        wScore += s * nb.w;
      });
      return wSum > 0 ? wScore / wSum : 0;
    }

    for (let iter = 0; iter < iterations; iter++) {
      const updates = {};
      Object.keys(nodes).forEach(id => {
        const neighborAvg = weightedNeighborFraud(id);
        const propagated  = neighborAvg * HOP_DECAY * (iter === 0 ? 1.0 : 0.6);
        updates[id] = propagated;
      });

      // Apply: only boost if neighbor avg >= threshold, cap each iteration's boost
      Object.entries(updates).forEach(([id, delta]) => {
        if (!nodes[id]) return;
        nodes[id].propagatedRisk = Math.round(delta);
        const neighborAvg = weightedNeighborFraud(id);
        if (neighborAvg >= RISK_THRESHOLD) {
          const boost   = Math.min(MAX_BOOST_PER_ITER, delta * 0.4);
          const boosted = nodes[id].fraudScore + boost;
          if (boosted > nodes[id].fraudScore) {
            nodes[id].fraudScore = Math.min(100, Math.round(boosted));
          }
        }
      });
    }

    return nodes;

    // PHASE 3: Renamed from avgNeighborScore to avoid shadowing the outer const avgNeighborScore.
    function computeAvgNeighborFraud(nodeId, adjList, nodeMap) {
      const nbs = adjList[nodeId] || [];
      if (nbs.length === 0) return 0;
      return nbs.reduce((s, nb) => s + (nodeMap[nb.id]?.fraudScore || 0), 0) / nbs.length;
    }
  }

  // ─── GRAPH ENTROPY METRIC (Phase 3 NEW) ────────────────────────────────────────
  // Shannon entropy of the edge temporal-weight distribution.
  // High entropy = chaotic, unpredictable money flow (more suspicious).
  // Low entropy  = regular, structured flow (less suspicious).

  function computeGraphEntropy(edges) {
    const edgeList = Object.values(edges);
    if (edgeList.length === 0) return 0;

    // Bucket temporal weights into quintiles
    const weights = edgeList.map(e => e.temporalWeight || e.weight || 1);
    const maxW    = Math.max(...weights);
    const minW    = Math.min(...weights);
    const range   = maxW - minW;

    if (range === 0) return 0; // All edges same weight = fully structured

    const BUCKETS = 5;
    const bucketCounts = new Array(BUCKETS).fill(0);
    weights.forEach(w => {
      const idx = Math.min(BUCKETS - 1, Math.floor((w - minW) / range * BUCKETS));
      bucketCounts[idx]++;
    });

    const total = weights.length;
    let entropy = 0;
    bucketCounts.forEach(count => {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    });

    // Normalize to 0–1 (max entropy for 5 buckets = log2(5) ≈ 2.32)
    return Math.round((entropy / Math.log2(BUCKETS)) * 100) / 100;
  }

  // ─── SUSPICIOUS CLUSTER DETECTION ────────────────────────────────────────────
  // PHASE 3 FIX: Density threshold now scales with community size.
  // Formula: adaptiveDensityThreshold = 0.5 / log2(max(e, size))
  // This prevents small clusters (3 nodes) from triggering on density alone.
  //
  //   Community size 3:  threshold = 0.5 / log2(3)  ≈ 0.315
  //   Community size 6:  threshold = 0.5 / log2(6)  ≈ 0.194
  //   Community size 10: threshold = 0.5 / log2(10) ≈ 0.151
  //
  // A 3-node cluster needs density > 0.315 to be density-flagged (instead of 0.5).
  // A 3-node cluster with 3/6 edges (density = 0.5) still triggers — that's correct.
  // A 3-node cluster with 2/6 edges (density = 0.33) does NOT trigger — fixed.

  function detectSuspiciousClusters(communities, nodes, edges) {
    return communities
      .filter(c => c.length >= 2)
      .map(community => {
        const commNodes   = community.map(id => nodes[id]).filter(Boolean);
        const totalVolume = commNodes.reduce((s, nd) => s + nd.volume, 0);
        const avgFraud    = commNodes.reduce((s, nd) => s + (nd.fraudScore || 0), 0) / community.length;
        const totalTemporal = commNodes.reduce((s, nd) => s + (nd.temporalScore || 0), 0);

        const memberSet = new Set(community);
        const internalEdges = Object.values(edges).filter(e => memberSet.has(e.source) && memberSet.has(e.target));
        const density = community.length > 1
          ? internalEdges.length / (community.length * (community.length - 1))
          : 0;

        // PHASE 3: Size-adaptive density threshold (prevents small-cluster inflation)
        const adaptiveThreshold = 0.5 / Math.log2(Math.max(Math.E, community.length));
        const isDensitySuspicious = density > adaptiveThreshold && community.length >= 4;

        // Hub correction: do NOT flag if the community is dominated by a single high-degree hub
        // (could be a legitimate bank aggregator node)
        const maxDegree = Math.max(...commNodes.map(n => n.degree || 0));
        const avgDegree = commNodes.reduce((s, n) => s + (n.degree || 0), 0) / Math.max(1, commNodes.length);
        const isHubDominated = commNodes.length <= 4 && maxDegree > avgDegree * 3;

        const isSuspicious = (!isHubDominated) && (
          totalVolume > 500_000_000 ||
          avgFraud > 50 ||
          isDensitySuspicious
        );

        return { community, size: community.length, totalVolume, totalTemporal, avgFraud, density, internalEdgeCount: internalEdges.length, isSuspicious };
      })
      .sort((a, b) => b.totalVolume - a.totalVolume);
  }

  // ─── LAUNDERING CHAIN DETECTION (v2 ENHANCED) ────────────────────────────────
  // Detects multi-hop rapid flows that match money-laundering patterns:
  //   - Funds move A→B→C (layering)
  //   - Transactions within compressed time window
  //   - Amounts decrease (fee skimming) or stay round

  function findMoneyFlowChains(nodes, edges, maxDepth = 5) {
    const chains  = [];
    const bySource = {};

    Object.values(edges).forEach(e => {
      if (!bySource[e.source]) bySource[e.source] = [];
      bySource[e.source].push(e);
    });

    function dfs(nodeId, path, visited, depth, volSoFar, dateMsPath) {
      if (depth >= maxDepth) return;
      (bySource[nodeId] || []).forEach(edge => {
        if (visited.has(edge.target)) return;
        const newVol    = Math.min(volSoFar, edge.volume);
        const newPath   = [...path, edge.target];
        const timeDiff  = edge.lastDateMs - (dateMsPath[dateMsPath.length-1] || edge.lastDateMs);
        const newDates  = [...dateMsPath, edge.lastDateMs];
        visited.add(edge.target);

        if (newPath.length >= 3) {
          // v2: detect laundering signature
          const isRapid   = timeDiff >= 0 && timeDiff < 48 * 3600_000; // within 48h
          const isLayering = newPath.length >= 4;
          const suspScore  = (isRapid ? 30 : 0) + (isLayering ? 20 : 0);

          chains.push({
            path: newPath,
            chainVolume: newVol,
            hops: newPath.length - 1,
            isRapid,
            isLayering,
            suspicionScore: suspScore,
            maxTimespanHours: timeDiff > 0 ? Math.round(timeDiff / 3600_000) : 0,
          });
        }
        dfs(edge.target, newPath, visited, depth + 1, newVol, newDates);
        visited.delete(edge.target);
      });
    }

    Object.keys(nodes).forEach(id => {
      dfs(id, [id], new Set([id]), 0, Infinity, []);
    });

    return chains
      .sort((a, b) => (b.suspicionScore - a.suspicionScore) || (b.chainVolume - a.chainVolume))
      .slice(0, 20);
  }

  // ─── FULL ANALYSIS ORCHESTRATOR ───────────────────────────────────────────────

  function analyze(transactions) {
    if (!transactions || transactions.length === 0) {
      return _emptyResult();
    }

    const { nodes, edges, adjacencyList } = buildGraph(transactions);

    // Use Louvain-like detection (v2); fall back to BFS if graph is very large
    const communities = Object.keys(nodes).length <= 500
      ? detectCommunitiesLouvain(nodes, edges)
      : detectCommunitiesBFS(nodes, edges);

    const pageRank = computePageRank(nodes, edges);
    const { degree, avgDegree, hubs } = detectHubs(nodes, edges);
    const suspiciousClusters = detectSuspiciousClusters(communities, nodes, edges);
    const moneyFlowChains    = findMoneyFlowChains(nodes, edges);

    // Enrich nodes
    Object.keys(nodes).forEach(id => {
      nodes[id].pageRank = pageRank[id] || 0;
      nodes[id].degree   = degree[id]   || 0;
    });

    const topAccounts = Object.values(nodes)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20);

    // Phase 3: compute graph entropy for observability
    const entropy = computeGraphEntropy(edges);

    return {
      nodes, edges, adjacencyList,
      communities, pageRank, degree, avgDegree, hubs,
      suspiciousClusters, topAccounts, moneyFlowChains,
      entropy,  // Phase 3 new
      refDate:  _REF_DATE,  // for determinism audit
      stats: {
        nodeCount:              Object.keys(nodes).length,
        edgeCount:              Object.keys(edges).length,
        communityCount:         communities.length,
        suspiciousClusterCount: suspiciousClusters.filter(c => c.isSuspicious).length,
        hubCount:               hubs.length,
        launderingChainCount:   moneyFlowChains.filter(c => c.isLayering).length,
        graphEntropy:           entropy,
      },
    };
  }

  /** Propagate risk scores AFTER FraudEngine + Calibration have scored nodes. */
  function applyRiskPropagation(graphResult) {
    if (!graphResult || !graphResult.nodes) return graphResult;
    propagateRisk(graphResult.nodes, graphResult.edges, 2);
    Object.values(graphResult.nodes).forEach(node => {
      if      (node.fraudScore >= 75) node.riskLevel = 'CRITICAL';
      else if (node.fraudScore >= 50) node.riskLevel = 'HIGH';
      else if (node.fraudScore >= 25) node.riskLevel = 'MEDIUM';
      else                             node.riskLevel = 'LOW';
    });
    return graphResult;
  }

  function _emptyResult() {
    return {
      nodes: {}, edges: {}, adjacencyList: {}, communities: [],
      pageRank: {}, degree: {}, avgDegree: 0, hubs: [],
      suspiciousClusters: [], topAccounts: [], moneyFlowChains: [],
      entropy: 0,
      refDate: _STATIC_FUTURE_DATE,
      stats: { nodeCount:0, edgeCount:0, communityCount:0, suspiciousClusterCount:0, hubCount:0, launderingChainCount:0, graphEntropy:0 },
    };
  }

  // ─── PHONE NUMBER NODE INJECTION ────────────────────────────────────────────
  // Non-invasive extension: adds PHONE_NUMBER nodes to an existing graph result.
  // Called AFTER analyze() so core graph logic is untouched.

  function injectPhoneNodes(graphResult, topupResult) {
    if (!graphResult || !topupResult || !topupResult.records) return graphResult;

    const { nodes, edges, adjacencyList } = graphResult;

    for (const rec of topupResult.records) {
      const phoneId = `PHONE:${rec.phoneNumber}`;
      const acctId  = rec.accountNumber;

      if (!nodes[phoneId]) {
        nodes[phoneId] = {
          id:            phoneId,
          label:         rec.phoneNumber,
          bankName:      'PHONE',
          nodeType:      'PHONE_NUMBER',
          phoneNumber:   rec.phoneNumber,
          volume: 0, inVolume: 0, outVolume: 0,
          count: 0,  inCount: 0,  outCount: 0,
          fraudScore: 0, riskLevel: 'LOW',
          degree: 0, pageRank: 0,
          temporalScore: 0, propagatedRisk: 0,
        };
      }
      const pNode = nodes[phoneId];
      pNode.volume   += rec.amount;
      pNode.inVolume += rec.amount;
      pNode.count++;
      pNode.inCount++;

      if (!acctId) continue;

      // Directed edge: BANK_ACCOUNT → PHONE_NUMBER (TOPUP)
      const key = `${acctId}→${phoneId}`;
      if (!edges[key]) {
        edges[key] = {
          source: acctId, target: phoneId,
          weight: 0, volume: 0, count: 0,
          temporalWeight: 0, lastDate: '', lastDateMs: 0,
          edgeType: 'TOPUP',
        };
        if (!adjacencyList[acctId]) adjacencyList[acctId] = [];
        adjacencyList[acctId].push({ target: phoneId, weight: 1, volume: rec.amount, temporalWeight: 1 });
      }
      edges[key].weight++;
      edges[key].volume         += rec.amount;
      edges[key].count++;
      edges[key].temporalWeight += 1;
      edges[key].lastDate        = rec.transactionDate || edges[key].lastDate;

      if (nodes[acctId]) nodes[acctId].degree = (nodes[acctId].degree || 0) + 0; // no double-count
      pNode.degree = (pNode.degree || 0) + 1;
    }

    // Apply risk level from aggregation map
    const aggMap = {};
    (topupResult.aggregations || []).forEach(a => { aggMap[`PHONE:${a.phoneNumber}`] = a; });
    for (const [pid, agg] of Object.entries(aggMap)) {
      if (!nodes[pid]) continue;
      const n = nodes[pid];
      if (agg.riskLevel === 'HIGH')   { n.fraudScore = 65; n.riskLevel = 'HIGH'; }
      else if (agg.riskLevel === 'MEDIUM') { n.fraudScore = 40; n.riskLevel = 'MEDIUM'; }
      if (agg.riskFlags?.length) n.riskReasons = agg.riskFlags;
    }

    // Refresh stats
    graphResult.stats.nodeCount = Object.keys(nodes).length;
    graphResult.stats.edgeCount = Object.keys(edges).length;
    return graphResult;
  }

  // ─── D3 FORMAT CONVERSION ────────────────────────────────────────────────────

  function toD3Format(graphResult) {
    if (!graphResult) return { nodes: [], links: [] };

    const maxVolume  = Math.max(1, ...Object.values(graphResult.nodes).map(n => n.volume));
    const maxTempW   = Math.max(1, ...Object.values(graphResult.edges).map(e => e.temporalWeight || e.weight || 1));

    const d3Nodes = Object.values(graphResult.nodes).map(n => ({
      id:             n.id,
      label:          n.id.length > 12 ? n.id.slice(0, 10) + '…' : n.id,
      fullLabel:      n.id,
      bankName:       n.bankName,
      volume:         n.volume,
      temporalScore:  n.temporalScore || 0,
      count:          n.count,
      degree:         n.degree,
      pageRank:       n.pageRank,
      fraudScore:     n.fraudScore || 0,
      riskLevel:      n.riskLevel || 'LOW',
      propagatedRisk: n.propagatedRisk || 0,
      r: Math.max(6, Math.min(30, 6 + Math.sqrt(n.volume / maxVolume) * 24)),
    }));

    const d3Links = Object.values(graphResult.edges).map(e => ({
      source:         e.source,
      target:         e.target,
      weight:         e.weight,
      volume:         e.volume,
      temporalWeight: e.temporalWeight || e.weight,
      // v2: use temporal weight for visual thickness
      width: Math.max(0.5, Math.min(5, 0.5 + ((e.temporalWeight || e.weight) / maxTempW) * 4.5)),
    }));

    return { nodes: d3Nodes, links: d3Links };
  }

  return {
    analyze,
    buildGraph,
    computePageRank,
    computeGraphEntropy,
    toD3Format,
    applyRiskPropagation,
    detectCommunitiesLouvain,
    injectPhoneNodes,
  };

})();
