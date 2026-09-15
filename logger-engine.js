/**
 * logger-engine.js — Logger Dashboard Module (Hybrid Zero-Cost)
 * Sentinel Platform v4.2.1-SECURE — Gravity Intelligence Lab
 *
 * Architecture:
 *  Layer 1 — Logger API (Flask/VPS): primary, optional, on-demand
 *  Layer 2 — Cloud (Supabase): passive storage, free tier
 *  Layer 3 — Local cache (localStorage): always available, offline-first
 *  Layer 4 — Investigation Mode: triggers VPS spin-up via webhook
 */

const _LOGGER = (() => {
  'use strict';

  // ── Config (persisted in localStorage) ────────────────────────────────────
  const CFG = {
    get apiBase()    { return localStorage.getItem('srau_apiBase')       || 'http://localhost:5000'; },
    get apiKey()     { return localStorage.getItem('srau_apiKey')        || 'sentinel-dev-key'; },
    get cloudUrl()   { return localStorage.getItem('logger_cloudUrl')    || ''; },
    get cloudKey()   { return localStorage.getItem('logger_cloudKey')    || ''; },
    get vpsWebhook() { return localStorage.getItem('logger_vpsWebhook')  || ''; },
    set cloudUrl(v)  { localStorage.setItem('logger_cloudUrl', v); },
    set cloudKey(v)  { localStorage.setItem('logger_cloudKey', v); },
    set vpsWebhook(v){ localStorage.setItem('logger_vpsWebhook', v); },
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const STATE = {
    apiOnline:      false,
    cloudOnline:    false,
    allHits:        [],        // flat array: {token, label, ...hit}
    allTokens:      [],
    filter:         { range: 'all', type: 'all', source: 'all' },
    investigationMode: false,
    lastSyncTs:     null,
    pollTimer:      null,
    CACHE_KEY:      'logger_hits_cache',
    CACHE_TS_KEY:   'logger_hits_cache_ts',
  };

  // ── DOM helpers ────────────────────────────────────────────────────────────
  const $  = id => document.getElementById(id);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

  // ── API calls ──────────────────────────────────────────────────────────────
  async function apiCall(path, opts = {}) {
    const res = await fetch(CFG.apiBase + path, {
      ...opts,
      headers: { 'X-API-Key': CFG.apiKey, 'ngrok-skip-browser-warning': '1', ...(opts.headers || {}) },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // ── Load all hits (unified timeline) ──────────────────────────────────────
  async function loadTimeline() {
    try {
      const tokens = await apiCall('/api/tokens');
      STATE.allTokens = tokens;
      STATE.apiOnline = true;

      const hitArrays = await Promise.all(
        tokens.map(t => apiCall(`/api/hits/${t.token}`).then(hits =>
          hits.map(h => ({ ...h, token: t.token, label: t.label, mode: t.mode }))
        ).catch(() => []))
      );

      STATE.allHits = hitArrays.flat().sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
      );

      // Persist cache for offline use
      localStorage.setItem(STATE.CACHE_KEY, JSON.stringify(STATE.allHits));
      localStorage.setItem(STATE.CACHE_TS_KEY, new Date().toISOString());
      STATE.lastSyncTs = new Date();

      setStatus('api', 'online');
    } catch {
      STATE.apiOnline = false;
      setStatus('api', 'offline');
      // Load from cache
      const cached = localStorage.getItem(STATE.CACHE_KEY);
      if (cached) STATE.allHits = JSON.parse(cached);
    }

    renderStats();
    renderTimeline();
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  function applyFilter(hits) {
    const { range, type, source } = STATE.filter;

    return hits.filter(h => {
      // Time range
      if (range !== 'all') {
        const hours = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 }[range] || Infinity;
        const age = (Date.now() - new Date(h.timestamp)) / 3600000;
        if (age > hours) return false;
      }
      // Source (referer)
      if (source !== 'all') {
        const ref = (h.referer || '').toLowerCase();
        const sourceMap = { zalo: 'zalo', telegram: 'telegram', gmail: 'mail.google', direct: '' };
        if (source === 'direct') { if (ref) return false; }
        else if (!ref.includes(sourceMap[source] || source)) return false;
      }
      return true;
    });
  }

  // ── Bot detection ──────────────────────────────────────────────────────────
  function _isBot(ua) {
    return /facebookexternalhit|Googlebot|bingbot|YandexBot|Twitterbot|LinkedInBot|crawler|spider/i.test(ua || '');
  }

  function _deviceIcon(ua) {
    if (!ua) return '💻';
    if (/iPhone|iPad/i.test(ua)) return '📱';
    if (/Android/i.test(ua))     return '📱';
    if (/Windows/i.test(ua))     return '🖥';
    if (/Mac OS X/i.test(ua))    return '💻';
    return '💻';
  }

  function _esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Copy to clipboard (HTTP + HTTPS + file://) ────────────────────────────
  function _copyText(text, btn) {
    const done = () => {
      const orig = btn.textContent;
      btn.textContent = '✓'; btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => _copyFallback(text, done));
    } else { _copyFallback(text, done); }
  }

  function _copyFallback(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta); cb?.();
  }

  // ── Render single hit row with expandable detail ───────────────────────────
  function _renderRow(h) {
    const isBot  = _isBot(h.user_agent);
    const ip     = h.ip || '—';
    const ipShort = ip.length > 22 ? ip.slice(0, 9) + '…' + ip.slice(-7) : ip;
    const source = detectSource(h.referer);
    const device = parseUA(h.user_agent || '');
    const geo    = [h.geo_city, h.geo_isp].filter(Boolean).join(' · ') || '—';
    const screen = (h.screen_w && h.screen_h) ? `${h.screen_w}×${h.screen_h}` : '';
    const label  = h.label || (h.token ? h.token.slice(0, 8) : '—');

    const row  = el('div', `logger-hit-row${isBot ? ' logger-bot-row' : ''}`);
    const main = el('div', 'logger-hit-main');

    main.innerHTML = `
      <span class="lc-time logger-ts">${_esc(formatTS(h.timestamp))}</span>
      <span class="lc-ip">
        <span class="logger-ip-val" title="${_esc(ip)}">${_esc(ipShort)}</span>
        <button class="logger-copy-ip" title="Copy IP">⬡</button>
        <span class="logger-device-inline">${isBot ? '🤖' : _deviceIcon(h.user_agent)} ${_esc(device)}</span>
      </span>
      <span class="lc-src"><span class="logger-src-badge ${source.cls}">${source.icon} ${_esc(source.label)}</span></span>
      <span class="lc-geo logger-geo-val">${_esc(geo)}</span>
      <span class="lc-beacon"><span class="logger-beacon-chip" title="${_esc(h.token || '')}">${_esc(label)}</span></span>
      <span class="lc-expand logger-expand-icon">▸</span>`;

    const detail = el('div', 'logger-hit-detail');
    detail.innerHTML = `
      <div class="logger-detail-grid">
        <div class="logger-detail-row">
          <span class="logger-dl">IP ĐẦY ĐỦ</span>
          <span class="logger-dv"><code>${_esc(ip)}</code><button class="logger-copy-sm" data-val="${_esc(ip)}">copy</button></span>
        </div>
        <div class="logger-detail-row">
          <span class="logger-dl">USER AGENT</span>
          <span class="logger-dv"><code class="logger-ua-code">${_esc(h.user_agent || '—')}</code></span>
        </div>
        ${screen ? `<div class="logger-detail-row"><span class="logger-dl">MÀN HÌNH</span><span class="logger-dv">${_esc(screen)}</span></div>` : ''}
        ${h.tz ? `<div class="logger-detail-row"><span class="logger-dl">MÚI GIỜ</span><span class="logger-dv">${_esc(h.tz)}</span></div>` : ''}
        <div class="logger-detail-row">
          <span class="logger-dl">REFERER</span>
          <span class="logger-dv">${_esc(h.referer || 'Không có (Direct)')}</span>
        </div>
        ${h.accept_language ? `<div class="logger-detail-row"><span class="logger-dl">NGÔN NGỮ</span><span class="logger-dv">${_esc(h.accept_language)}</span></div>` : ''}
      </div>`;

    row.appendChild(main);
    row.appendChild(detail);

    // Expand/collapse on row click
    main.addEventListener('click', () => {
      const open = row.classList.toggle('expanded');
      main.querySelector('.logger-expand-icon').textContent = open ? '▾' : '▸';
    });

    // Copy IP button
    main.querySelector('.logger-copy-ip').addEventListener('click', e => {
      e.stopPropagation();
      _copyText(ip, e.currentTarget);
    });

    // Copy buttons inside detail
    detail.querySelectorAll('.logger-copy-sm[data-val]').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); _copyText(btn.dataset.val, btn); });
    });

    return row;
  }

  // ── Render timeline ────────────────────────────────────────────────────────
  function renderTimeline() {
    const container = $('logger-timeline-body');
    if (!container) return;

    const filtered = applyFilter(STATE.allHits);

    if (!filtered.length) {
      container.innerHTML = `<div class="logger-empty-state">${
        STATE.apiOnline ? '[ KHÔNG CÓ SỰ KIỆN TRONG BỘ LỌC ]' : '[ OFFLINE — ĐANG DÙNG CACHE ]'
      }</div>`;
      return;
    }

    container.innerHTML = '';
    filtered.slice(0, 200).forEach(h => container.appendChild(_renderRow(h)));

    if (filtered.length > 200) {
      const hint = el('div', 'logger-more-hint');
      hint.textContent = `… ${filtered.length - 200} sự kiện nữa — thu hẹp bộ lọc để xem`;
      container.appendChild(hint);
    }
  }

  // ── Render stats ───────────────────────────────────────────────────────────
  function renderStats() {
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    const hits = STATE.allHits;
    const today = hits.filter(h => {
      const age = (Date.now() - new Date(h.timestamp)) / 3600000;
      return age < 24;
    });
    const sources = new Set(hits.map(h => detectSource(h.referer).label));

    set('logger-stat-total-hits',    hits.length);
    set('logger-stat-beacons',       STATE.allTokens.length);
    set('logger-stat-hits-today',    today.length);
    set('logger-stat-unique-sources',sources.size);
    set('logger-stat-last-sync',     STATE.lastSyncTs
      ? formatTS(STATE.lastSyncTs.toISOString()) : '—');
  }

  // ── Status indicators ──────────────────────────────────────────────────────
  function setStatus(layer, status) {
    const el = $(`logger-status-${layer}`);
    if (!el) return;
    const map = {
      online:  { text: 'ONLINE',  color: 'var(--accent-green)' },
      offline: { text: 'OFFLINE', color: 'var(--accent-red)' },
      syncing: { text: 'SYNCING', color: 'var(--accent-yellow)' },
      unknown: { text: '—',       color: 'var(--text-muted)' },
    };
    const s = map[status] || map.unknown;
    el.textContent = s.text;
    el.style.color = s.color;
  }

  // ── Investigation Mode ─────────────────────────────────────────────────────
  async function triggerInvestigationMode() {
    if (!CFG.vpsWebhook) {
      _logConsole('[WARN] Chưa cấu hình VPS webhook. Nhập webhook URL trong phần Cài đặt.', 'warn');
      return;
    }

    STATE.investigationMode = true;
    const btn = $('logger-btn-investigate');
    if (btn) { btn.disabled = true; btn.textContent = 'ĐANG KHỞI ĐỘNG VPS...'; }

    _logConsole('[SYSTEM] Gửi yêu cầu khởi động VPS forensic...', 'system');

    try {
      const payload = {
        action:    'spin_up',
        timestamp: new Date().toISOString(),
        hits:      STATE.allHits.length,
        tokens:    STATE.allTokens.length,
      };
      const res = await fetch(CFG.vpsWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        _logConsole('[OK] VPS đang khởi động. Kiểm tra trạng thái sau 2–3 phút.', 'success');
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      _logConsole(`[ERR] Không kết nối được webhook: ${e.message}`, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '⚡ KÍCH HOẠT ĐIỀU TRA'; }
    }
  }

  // ── Cloud sync (Supabase) ──────────────────────────────────────────────────
  async function syncToCloud() {
    if (!CFG.cloudUrl || !CFG.cloudKey) {
      _logConsole('[WARN] Chưa cấu hình Cloud (Supabase URL + Key).', 'warn');
      return;
    }

    setStatus('cloud', 'syncing');
    _logConsole('[SYSTEM] Đang đồng bộ lên cloud...', 'system');

    try {
      const res = await fetch(`${CFG.cloudUrl}/rest/v1/logger_hits`, {
        method: 'POST',
        headers: {
          'apikey': CFG.cloudKey,
          'Authorization': `Bearer ${CFG.cloudKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=ignore-duplicates',
        },
        body: JSON.stringify(STATE.allHits.map(h => ({
          token:     h.token,
          label:     h.label,
          ip:        h.ip,
          user_agent: h.user_agent,
          referer:   h.referer,
          geo_city:  h.geo_city,
          geo_isp:   h.geo_isp,
          timestamp: h.timestamp,
          synced_at: new Date().toISOString(),
        }))),
      });

      if (res.ok || res.status === 201) {
        setStatus('cloud', 'online');
        _logConsole(`[OK] Đã đồng bộ ${STATE.allHits.length} sự kiện lên cloud.`, 'success');
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      setStatus('cloud', 'offline');
      _logConsole(`[ERR] Cloud sync thất bại: ${e.message}`, 'error');
    }
  }

  // ── Console log (reuse SRAU pattern) ──────────────────────────────────────
  function _logConsole(msg, type = 'info') {
    const body = $('logger-console-body');
    if (!body) return;
    const colors = { system: 'var(--text-muted)', success: 'var(--accent-green)',
                     warn: 'var(--accent-yellow)', error: 'var(--accent-red)', info: 'var(--text-secondary)' };
    const entry = el('div', 'logger-console-entry');
    entry.style.color = colors[type] || colors.info;
    entry.textContent = `[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`;
    body.prepend(entry);
    // Keep max 50 entries
    while (body.children.length > 50) body.removeChild(body.lastChild);
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  function formatTS(iso) {
    if (!iso) return '—';
    try {
      // SQLite stores "YYYY-MM-DD HH:MM:SS" without T separator — non-standard for new Date().
      // Replace space with T and append Z (UTC) for consistent cross-browser parsing.
      const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return iso; }
  }

  function detectSource(referer = '') {
    const r = referer.toLowerCase();
    if (r.includes('zalo'))          return { label: 'Zalo',     icon: '●', cls: 'src-zalo' };
    if (r.includes('t.me') || r.includes('telegram')) return { label: 'Telegram', icon: '●', cls: 'src-telegram' };
    if (r.includes('mail.google'))   return { label: 'Gmail',    icon: '●', cls: 'src-gmail' };
    if (r.includes('facebook'))      return { label: 'Facebook', icon: '●', cls: 'src-facebook' };
    if (!referer)                    return { label: 'Direct',   icon: '●', cls: 'src-direct' };
    return                                  { label: 'Other',    icon: '●', cls: 'src-other' };
  }

  function parseUA(ua) {
    if (!ua) return '—';
    if (/iPhone|iPad/i.test(ua))  return ua.match(/iPhone OS ([\d_]+)/i)?.[0] || 'iOS';
    if (/Android/i.test(ua))      return 'Android ' + (ua.match(/Android ([\d.]+)/i)?.[1] || '');
    if (/Windows/i.test(ua))      return 'Windows';
    if (/Mac/i.test(ua))          return 'macOS';
    return ua.slice(0, 40);
  }

  // ── Settings modal ─────────────────────────────────────────────────────────
  function openSettings() {
    const modal = $('logger-settings-modal');
    if (!modal) return;
    $('logger-settings-cloud-url').value   = CFG.cloudUrl;
    $('logger-settings-cloud-key').value   = CFG.cloudKey;
    $('logger-settings-vps-webhook').value = CFG.vpsWebhook;
    modal.style.display = 'flex';
  }

  function saveSettings() {
    CFG.cloudUrl   = ($('logger-settings-cloud-url')   ?.value || '').trim();
    CFG.cloudKey   = ($('logger-settings-cloud-key')   ?.value || '').trim();
    CFG.vpsWebhook = ($('logger-settings-vps-webhook') ?.value || '').trim();
    closeSettings();
    _logConsole('[OK] Đã lưu cài đặt Cloud + VPS webhook.', 'success');
  }

  function closeSettings() {
    const modal = $('logger-settings-modal');
    if (modal) modal.style.display = 'none';
  }

  // ── Filter event handlers ──────────────────────────────────────────────────
  function bindFilters() {
    ['logger-filter-range', 'logger-filter-source'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('change', () => {
        STATE.filter[id.replace('logger-filter-', '')] = el.value;
        renderTimeline();
      });
    });
  }

  // ── Polling ────────────────────────────────────────────────────────────────
  function startPolling(intervalMs = 30000) {
    stopPolling();
    STATE.pollTimer = setInterval(() => {
      if (document.getElementById('logger-screen')?.classList.contains('active')) {
        loadTimeline();
      }
    }, intervalMs);
  }

  function stopPolling() {
    if (STATE.pollTimer) { clearInterval(STATE.pollTimer); STATE.pollTimer = null; }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    bindFilters();
    setStatus('api',   'unknown');
    setStatus('cloud', 'unknown');
    loadTimeline();
    startPolling(30000);
    _logConsole(`[SYSTEM] Logger khởi động — API: ${CFG.apiBase}`, 'system');

    // System log toggle
    const sysToggle = $('logger-syslog-toggle');
    const sysBody   = $('logger-console-body');
    if (sysToggle && sysBody) {
      sysToggle.addEventListener('click', () => {
        const open = sysBody.classList.toggle('open');
        sysToggle.querySelector('.logger-syslog-icon').textContent = open ? '▼' : '▶';
      });
    }

    // Expose button handlers
    const btnRefresh    = $('logger-btn-refresh');
    const btnInvestigate = $('logger-btn-investigate');
    const btnSync       = $('logger-btn-sync-cloud');
    const btnSettings   = $('logger-btn-settings');

    if (btnRefresh)     btnRefresh.onclick     = loadTimeline;
    if (btnInvestigate) btnInvestigate.onclick = triggerInvestigationMode;
    if (btnSync)        btnSync.onclick        = syncToCloud;
    if (btnSettings)    btnSettings.onclick    = openSettings;

    $('logger-settings-save')?.addEventListener('click', saveSettings);
    $('logger-settings-cancel')?.addEventListener('click', closeSettings);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return { init, loadTimeline, renderTimeline, triggerInvestigationMode, syncToCloud, openSettings };
})();
