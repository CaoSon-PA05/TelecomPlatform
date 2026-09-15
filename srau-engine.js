/* srau-engine.js — IP Logger API client for TelecomPlatform SRAU module */
const _SRAU = (() => {
  const CONFIG = {
    get apiBase() { return localStorage.getItem('srau_apiBase') || 'http://localhost:5000'; },
    set apiBase(v) { localStorage.setItem('srau_apiBase', v); },
    get apiKey()  { return localStorage.getItem('srau_apiKey')  || 'sentinel-dev-key'; },
    set apiKey(v) { localStorage.setItem('srau_apiKey', v); },
    pollInterval: 5000,
  };

  let _pollTimers  = {};   // token -> timerId
  let _hitCounts   = {};   // token -> last seen count
  let _retryTimer  = null; // reconnect timer when offline
  let _apiOnline   = false;

  // ── API layer ────────────────────────────────────────────────────────────

  async function _api(method, path, body) {
    const opts = {
      method,
      headers: {
        'X-API-Key': CONFIG.apiKey,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(CONFIG.apiBase + path, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadTokens(caseId) {
    const qs = caseId ? `?case_id=${encodeURIComponent(caseId)}` : '';
    return _api('GET', `/api/tokens${qs}`);
  }

  async function createBeacon({ label, mode, lat, lng, zoom, gifSource, caseId }) {
    return _api('POST', '/api/tokens', {
      label, mode,
      lat: lat || '21.0285', lng: lng || '105.8542', zoom: zoom || '14',
      gif_source: gifSource || '',
      case_id: caseId || '',
    });
  }

  async function loadHits(token) {
    return _api('GET', `/api/hits/${token}`);
  }

  async function deleteBeacon(token) {
    return _api('DELETE', `/api/tokens/${token}`);
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  function startPolling(token, onNewHits) {
    stopPolling(token);
    _pollTimers[token] = setInterval(async () => {
      try {
        const hits    = await loadHits(token);
        const prev    = _hitCounts[token] ?? hits.length;
        const newOnes = hits.slice(0, hits.length - prev);
        if (newOnes.length > 0) {
          _hitCounts[token] = hits.length;
          onNewHits(newOnes, hits.length);
        }
      } catch (_) {}
    }, CONFIG.pollInterval);
  }

  function stopPolling(token) {
    if (_pollTimers[token]) {
      clearInterval(_pollTimers[token]);
      delete _pollTimers[token];
    }
  }

  function stopAllPolling() {
    Object.keys(_pollTimers).forEach(stopPolling);
  }

  // ── DOM init ──────────────────────────────────────────────────────────────

  function _setApiStatus(online) {
    _apiOnline = online;
    const el = document.getElementById('srau-stat-api-status');
    if (!el) return;
    if (online) {
      el.textContent = 'ONLINE';
      el.style.color = '#50dc96';
    } else {
      el.textContent = 'OFFLINE';
      el.style.color = 'var(--accent-red, #e53e3e)';
    }
  }

  function init() {
    _bindCreateForm();
    _loadAndRenderTokens();
    _updateCaseBadge();
  }

  function _updateCaseBadge() {
    const el = document.getElementById('srau-active-case');
    if (!el) return;
    const id = window._flaActiveCaseId;
    if (id && typeof InvestigationCaseEngine !== 'undefined') {
      const meta = InvestigationCaseEngine.getCaseMeta(id);
      el.textContent = meta ? `🗂 ${meta.name}` : `🗂 ${id}`;
      el.style.color  = 'var(--accent-cyan)';
    } else {
      el.textContent = '(Chưa có vụ án đang mở)';
      el.style.color  = 'var(--text-muted)';
    }
  }

  function _bindCreateForm() {
    const btn = document.getElementById('srau-btn-create');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      const label = (document.getElementById('srau-form-label')?.value || '').trim();
      const mode  = document.querySelector('input[name="srau-mode"]:checked')?.value || 'gif';

      if (!label) { _consoleLog('⚠ Nhập nhãn beacon trước.', 'warn'); return; }

      const caseId = window._flaActiveCaseId || '';
      btn.disabled    = true;
      btn.textContent = 'Đang tạo...';
      try {
        const { token, track_url } = await createBeacon({ label, mode, caseId });
        _hitCounts[token] = 0;
        const caseTag = caseId ? ` · case:${caseId.slice(-6)}` : '';
        _consoleLog(`✓ Beacon [${label}] · ${mode.toUpperCase()}${caseTag} tạo thành công`, 'success');
        _appendBeaconItem({ token, label, mode, track_url, hit_count: 0 });
        _updateStats();
        const lbl = document.getElementById('srau-form-label');
        if (lbl) lbl.value = '';
      } catch (e) {
        const msg = e.message === 'Failed to fetch'
          ? `✗ Logger API offline. Chạy: python app.py`
          : `✗ Lỗi tạo beacon: ${e.message}`;
        _consoleLog(msg, 'error');
      } finally {
        btn.disabled    = false;
        btn.textContent = 'Tạo Beacon';
      }
    });
  }

  async function _loadAndRenderTokens() {
    _consoleLog(`[SYSTEM] Kết nối Logger API tại ${CONFIG.apiBase}…`, 'system');
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
    try {
      const tokens = await loadTokens();
      _setApiStatus(true);
      const list = document.getElementById('srau-beacon-list');
      if (list) list.innerHTML = '';
      tokens.forEach(t => {
        _hitCounts[t.token] = t.hit_count;
        _appendBeaconItem(t);
      });
      _updateStats(tokens);
      _consoleLog(`[SYSTEM] Tải ${tokens.length} beacon. Hệ thống sẵn sàng.`, 'system');
    } catch (e) {
      _setApiStatus(false);
      const is401     = e.message.includes('401');
      const isNetwork = e.message === 'Failed to fetch' || e.message.includes('NetworkError') || e.message.includes('ERR_CONNECTION_REFUSED');
      if (is401) {
        _consoleLog(`[ERROR] Xác thực thất bại (HTTP 401) — API Key không đúng.`, 'error');
        _consoleLog(`[HINT] Kiểm tra API Key trong ô bên phải. Key mặc định: "sentinel-dev-key"`, 'warn');
      } else if (isNetwork) {
        _consoleLog(`[ERROR] Không kết nối được Logger API tại ${CONFIG.apiBase}`, 'error');
        _consoleLog(`[HINT] Chạy: cd logger && python app.py   (port ${CONFIG.apiBase.split(':').pop()})`, 'warn');
      } else {
        _consoleLog(`[ERROR] Lỗi không xác định — ${e.message}`, 'error');
      }
      _retryTimer = setTimeout(_loadAndRenderTokens, 30000);
      _consoleLog('[SYSTEM] Tự thử lại sau 30 giây...', 'system');
    }
  }

  function _appendBeaconItem(t) {
    const list = document.getElementById('srau-beacon-list');
    if (!list) return;
    const existing = document.getElementById(`beacon-item-${t.token}`);
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'beacon-item';
    el.id = `beacon-item-${t.token}`;
    el.innerHTML = `
      <div class="beacon-item-header">
        <span class="beacon-label">${_esc(t.label || t.token)}</span>
        <span class="beacon-badge badge-${_esc(t.mode)}">${_esc(t.mode.toUpperCase())}</span>
        <span class="beacon-hits" id="hits-count-${_esc(t.token)}">${t.hit_count || 0} hits</span>
      </div>
      <div class="beacon-url-row">
        <code class="beacon-url">${_esc(t.track_url)}</code>
        <button class="btn-beacon-copy" data-url="${_esc(t.track_url)}" title="Copy URL">⎘</button>
        <button class="btn-beacon-watch" data-token="${_esc(t.token)}" data-label="${_esc(t.label || '')}" title="Theo dõi">◉</button>
        <button class="btn-beacon-del" data-token="${_esc(t.token)}" data-label="${_esc(t.label || '')}" title="Xóa">✕</button>
      </div>`;

    el.querySelector('.btn-beacon-copy').addEventListener('click', e => {
      navigator.clipboard.writeText(e.currentTarget.dataset.url);
      _consoleLog(`📋 Copy URL [${t.label || t.token}]`, 'info');
    });

    el.querySelector('.btn-beacon-watch').addEventListener('click', e => {
      const { token: tok, label: lbl } = e.currentTarget.dataset;
      _watchBeacon(tok, lbl);
    });

    el.querySelector('.btn-beacon-del').addEventListener('click', async e => {
      const { token: tok, label: lbl } = e.currentTarget.dataset;
      if (!confirm(`Xóa beacon [${lbl || tok}]?`)) return;
      try {
        await deleteBeacon(tok);
        stopPolling(tok);
        el.remove();
        delete _hitCounts[tok];
        _consoleLog(`🗑 Đã xóa beacon [${lbl || tok}]`, 'warn');
        _updateStats();
      } catch (err) {
        _consoleLog(`✗ Không xóa được: ${err.message}`, 'error');
      }
    });

    list.prepend(el);
  }

  function _watchBeacon(token, label) {
    stopAllPolling();
    _hitCounts[token] = _hitCounts[token] ?? 0;

    const indicator = document.getElementById('srau-poll-indicator');
    if (indicator) {
      indicator.textContent = `● Polling: ${label || token}`;
      indicator.className   = 'poll-indicator active';
    }
    _consoleLog(`◉ Bắt đầu polling beacon [${label || token}] · mỗi 5s`, 'system');

    startPolling(token, (newHits, total) => {
      const cntEl = document.getElementById(`hits-count-${token}`);
      if (cntEl) cntEl.textContent = `${total} hits`;

      const totalHitsEl = document.getElementById('srau-stat-total-hits');
      if (totalHitsEl) totalHitsEl.textContent = String(
        parseInt(totalHitsEl.textContent || '0') + newHits.length
      );

      newHits.forEach(h => {
        const ts      = _formatTs(h.timestamp);
        const dev     = _parseUA(h.user_agent);
        const geo     = [h.geo_city, h.geo_isp].filter(Boolean).join(' / ');
        const geoTag  = geo ? ` · 📍${geo}` : '';
        const scr     = (h.screen_w && h.screen_h) ? ` · 🖥${h.screen_w}×${h.screen_h}` : '';
        const tzTag   = h.tz ? ` · ${h.tz}` : '';
        _consoleLog(`🔔 HIT · ${h.ip}${geoTag}${scr}${tzTag} · ${dev} · ${ts}`, 'hit');

        const itemEl = document.getElementById(`beacon-item-${token}`);
        if (itemEl) {
          itemEl.classList.remove('hit-flash');
          void itemEl.offsetWidth;
          itemEl.classList.add('hit-flash');
        }
      });
    });
  }

  function _updateStats(tokens) {
    if (!tokens) {
      tokens = Array.from(document.querySelectorAll('.beacon-item')).map(el => {
        const hitsEl = el.querySelector('.beacon-hits');
        return { hit_count: hitsEl ? parseInt(hitsEl.textContent) || 0 : 0 };
      });
    }
    const totalBeaconsEl = document.getElementById('srau-stat-total-beacons');
    const totalHitsEl    = document.getElementById('srau-stat-total-hits');
    if (totalBeaconsEl) totalBeaconsEl.textContent = tokens.length;
    if (totalHitsEl)    totalHitsEl.textContent    = tokens.reduce((s, t) => s + (t.hit_count || 0), 0);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _consoleLog(msg, type = 'info') {
    const container = document.getElementById('srau-console-stream');
    if (!container) return;
    const entry = document.createElement('div');
    entry.className = `console-entry console-${type}`;
    const now = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    entry.innerHTML = `<span class="console-ts">[${now}]</span> ${_esc(msg)}`;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _parseUA(ua) {
    if (!ua) return 'Unknown';
    if (/iPhone|iPad/i.test(ua))  return 'iOS';
    if (/Android/i.test(ua))      return 'Android';
    if (/Windows/i.test(ua))      return 'Windows';
    if (/Mac OS X/i.test(ua))     return 'macOS';
    if (/Linux/i.test(ua))        return 'Linux';
    return 'Unknown';
  }

  function _formatTs(ts) {
    if (!ts) return '';
    try {
      // SQLite stores "YYYY-MM-DD HH:MM:SS" (space, no T, no Z).
      // new Date() parsing of this format is browser-dependent and fails on Safari.
      // Replace space with T and append Z to get valid ISO 8601 UTC string.
      const iso = ts.includes('T') ? ts : ts.replace(' ', 'T');
      const d = new Date(iso + 'Z');
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    } catch (_) { return ts; }
  }

  function reconnect() {
    _consoleLog('[SYSTEM] Thử kết nối lại Logger API…', 'system');
    _loadAndRenderTokens();
  }

  function setApiBase(url) {
    const clean = url.trim().replace(/\/$/, '');
    CONFIG.apiBase = clean;
    _consoleLog(`[CONFIG] apiBase → ${clean}`, 'system');
    _loadAndRenderTokens();
  }

  function setApiKey(key) {
    const clean = key.trim();
    if (!clean) return;
    CONFIG.apiKey = clean;
    _consoleLog(`[CONFIG] API Key đã cập nhật.`, 'system');
    _loadAndRenderTokens();
  }

  return {
    init, reconnect, setApiBase, setApiKey, updateCaseBadge: _updateCaseBadge,
    loadTokens, createBeacon, loadHits,
    deleteBeacon, startPolling, stopPolling, stopAllPolling,
    get currentBase() { return CONFIG.apiBase; },
    get currentKey()  { return CONFIG.apiKey; },
  };
})();
