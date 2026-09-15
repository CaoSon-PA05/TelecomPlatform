/* Project Sentinel - Core Application JS Controller */

/* ═══════════════════════════════════════════════════════════════
   LOGIN AUTHENTICATION GATE
   ═══════════════════════════════════════════════════════════════
   Tài khoản mặc định (chỉnh sửa tại đây để thay đổi):
     - canbo        / ca@2024
     - sentinel     / anm@2024
     - admin        / Sentinel@2026
     - haalo        / 121995
     - quynhcut1988 / Quynhcut1988@
   ═══════════════════════════════════════════════════════════════ */
function initLoginScreen() {
  const overlay = document.getElementById('login-overlay');
  if (!overlay) return;

  // Bỏ qua đăng nhập nếu phiên vẫn còn hiệu lực
  if (sessionStorage.getItem('_sentinel_session') === 'granted') {
    overlay.style.display = 'none';
    overlay.remove();
    return;
  }

  const usernameEl = document.getElementById('login-username');
  const passwordEl = document.getElementById('login-password');
  const loginBtn   = document.getElementById('login-btn');
  const btnText    = document.getElementById('login-btn-text');
  const errorEl    = document.getElementById('login-error');
  const card       = document.getElementById('login-card');

  // ─── Danh sách tài khoản hợp lệ ─────────────────────────────────
  const _ACCOUNTS = {
    'canbo':    'ca@2024',
    'sentinel': 'anm@2024',
    'admin':    'Sentinel@2026',
    'haalo':    '121995',
    'quynhcut1988': 'Quynhcut1988@',
  };
  // ─────────────────────────────────────────────────────────────────

  const STEPS = [
    'ĐANG KIỂM TRA KẾT NỐI BẢO MẬT...',
    'ĐANG XÁC THỰC DANH TÍNH CÁN BỘ...',
    'ĐANG THIẾT LẬP PHIÊN LÀM VIỆC...',
  ];

  function tryLogin() {
    const username = usernameEl.value.trim().toLowerCase();
    const password = passwordEl.value;
    errorEl.textContent = '';

    if (!username || !password) {
      errorEl.textContent = '✗ Vui lòng nhập đầy đủ mã định danh và mã xác thực.';
      return;
    }

    loginBtn.classList.add('loading');
    btnText.textContent = STEPS[0];

    let step = 0;
    const stepTimer = setInterval(() => {
      step++;
      if (step >= STEPS.length) {
        clearInterval(stepTimer);
        if (_ACCOUNTS[username] === password) {
          btnText.textContent = '✓ XÁC THỰC THÀNH CÔNG — ĐANG KHỞI TẠO...';
          loginBtn.classList.remove('loading');
          loginBtn.classList.add('success');
          sessionStorage.setItem('_sentinel_session', 'granted');
          setTimeout(() => {
            overlay.classList.add('exiting');
            setTimeout(() => { overlay.style.display = 'none'; overlay.remove(); }, 680);
          }, 480);
        } else {
          loginBtn.classList.remove('loading');
          btnText.textContent = 'XÁC THỰC VÀ ĐĂNG NHẬP';
          errorEl.textContent = '✗ Mã định danh hoặc mã xác thực không đúng. Vui lòng thử lại.';
          passwordEl.value = '';
          card.classList.remove('is-shaking');
          void card.offsetWidth;
          card.classList.add('is-shaking');
          setTimeout(() => card.classList.remove('is-shaking'), 550);
          usernameEl.focus();
        }
      } else {
        btnText.textContent = STEPS[step];
      }
    }, 380);
  }

  loginBtn.addEventListener('click', tryLogin);
  passwordEl.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
  usernameEl.addEventListener('keydown', e => { if (e.key === 'Enter') passwordEl.focus(); });
  // Focus username field
  setTimeout(() => usernameEl?.focus(), 80);
}

document.addEventListener('DOMContentLoaded', () => {
  initGravitySplash();     // Layer 1: Splash Screen
  initGravityAbout();      // Layer 3: About Dialog

  initLoginScreen();
  initNavigation();
  initRefreshButton();
  initGtpModule();
  initFlaModule();
  initSrauModule();
  if (typeof _LOGGER !== 'undefined') _LOGGER.init();
  initCasesModule();   // Phase 4
  initWorkspaceUX();
  initChartDefaults();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // Init CDR Analyzer module + expose toast bridge
  window._sentinelToast = (msg, type) => _showToast(msg, type === 'ok' ? 'success' : type);
  if (typeof CDRAnalyzer !== 'undefined') CDRAnalyzer.init();

  // Init Batch CDR module
  if (typeof BatchUI !== 'undefined' && typeof BatchProcessor !== 'undefined') {
    BatchUI.init();
    // Re-render handled inside navigateTo() now
  }
});

/* ═══════════════════════════════════════════════════════════════
   GRAVITY AUTHOR BRANDING SYSTEM — JS Controllers
   Designed & Architected by: Cao_Son_Hinh su_CNC
   Organization: Gravity Intelligence Lab
   ═══════════════════════════════════════════════════════════════ */

/* Layer 1 — Splash Screen */
function initGravitySplash() {
  const splash = document.getElementById('gravity-splash');
  if (!splash) return;

  const DURATION = 1800;
  const FADE    = 550;

  setTimeout(() => {
    splash.classList.add('gravity-splash--fade');
    setTimeout(() => {
      splash.style.display = 'none';
      splash.remove();
    }, FADE);
  }, DURATION);
}

/* Layer 3 — About Dialog */
function initGravityAbout() {
  const overlay  = document.getElementById('gravity-about');
  const openBtn  = document.getElementById('btn-about-open');
  const closeBtn = document.getElementById('about-close-btn');

  if (!overlay) return;

  function openAbout() {
    overlay.style.display = 'flex';
    document.addEventListener('keydown', onEscape);
  }

  function closeAbout() {
    overlay.style.display = 'none';
    document.removeEventListener('keydown', onEscape);
  }

  function onEscape(e) {
    if (e.key === 'Escape') closeAbout();
  }

  if (openBtn) openBtn.addEventListener('click', openAbout);
  if (closeBtn) closeBtn.addEventListener('click', closeAbout);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeAbout(); });
}

/* 1. Navigation Controller */
function initNavigation() {
  const screens   = document.querySelectorAll('.screen');
  const pageTitle = document.getElementById('page-display-title');

  // ── Navigate to a screen by key ──────────────────────────
  function navigateTo(screenKey) {
    const allNavItems = document.querySelectorAll('.nav-item, .nav-parent-item');

    // Clear all active states
    allNavItems.forEach(i => i.classList.remove('active'));

    // Mark the matching nav item(s) active
    // (parent "home" also gets active when its own screen is selected)
    const matchItem = document.querySelector(`[data-screen="${screenKey}"]`);
    if (matchItem) matchItem.classList.add('active');

    // Also highlight parent when a sub-item is navigated to
    const parentBtn = document.getElementById('nav-home-btn');
    if (screenKey !== 'home' && parentBtn) {
      // parent doesn't get active class for sub-items (sub-item itself does)
    } else if (screenKey === 'home' && parentBtn) {
      parentBtn.classList.add('active');
    }

    // Switch screens
    screens.forEach(screen => {
      screen.classList.remove('active');
      screen.style.display = 'none';
      if (screen.id === `${screenKey}-screen`) {
        screen.classList.add('active');
        screen.style.display = 'flex';
      }
    });

    // Update page title from the matching item's label span
    if (matchItem) {
      const labelEl = matchItem.querySelector('span:not(.nav-tree-con):not(.nav-parent-glyph):not(.nav-chevron-btn)');
      if (labelEl) pageTitle.innerText = labelEl.innerText.toUpperCase();
    }

    // Batch screen: trigger re-render
    if (screenKey === 'batch' && typeof BatchUI !== 'undefined') {
      BatchUI.render();
    }

    // SRAU: stop polling khi rời; refresh case badge khi vào
    if (typeof _SRAU !== 'undefined') {
      if (screenKey === 'srau') {
        _SRAU.updateCaseBadge();
      } else {
        _SRAU.stopAllPolling();
        const indicator = document.getElementById('srau-poll-indicator');
        if (indicator) { indicator.textContent = '● IDLE'; indicator.className = 'poll-indicator idle'; }
      }
    }

    // Logger: refresh timeline on enter, stop poll on leave
    if (typeof _LOGGER !== 'undefined') {
      if (screenKey === 'logger') {
        _LOGGER.loadTimeline();
      }
    }
  }

  // ── Wire nav-item clicks ─────────────────────────────────
  document.querySelectorAll('.nav-item, .nav-parent-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const key = item.getAttribute('data-screen');
      if (key) navigateTo(key);
    });
  });

  // ── Chevron toggle for sub-list ──────────────────────────
  const chevronBtn = document.getElementById('nav-chevron-btn');
  const subList    = document.getElementById('nav-sub-list');
  if (chevronBtn && subList) {
    chevronBtn.addEventListener('click', e => {
      e.stopPropagation();
      const collapsed = subList.classList.toggle('collapsed');
      chevronBtn.classList.toggle('collapsed', collapsed);
      chevronBtn.textContent = collapsed ? '▸' : '▾';
    });
  }

  // ── Dashboard quick-links (card buttons → navigate) ──────
  const quickLinks = {
    'btn-gtp-init':   'gtp',
    'btn-fla-init':   'fla',
    'btn-srau-init':  'srau',
    'btn-cdr-init':   'cdr',
    'btn-batch-init': 'batch',
  };
  Object.entries(quickLinks).forEach(([btnId, screenKey]) => {
    document.getElementById(btnId)?.addEventListener('click', () => navigateTo(screenKey));
  });

  // Expose navigateTo globally so other modules can use it
  window._sentinelNav = navigateTo;
}

// Post-Phase-25 fix: single "Refresh" button in the always-visible top bar
// (works from any screen) that resets the CURRENTLY ACTIVE module's session
// state — chosen over resetting every module at once so switching to a
// screen the user isn't using is never touched (its persistent config and
// unrelated in-progress work stay intact). Currently wired for FLA
// (including its NAPAS sub-panel, which shares FLA's state) and CDR (via
// the existing CDRAnalyzer.clearAll(), unchanged, reused as-is — its own
// built-in confirm() dialog IS the confirmation for that path, so no
// second prompt is shown). Screens without an explicit reset defined here
// (GTP/SRAU/batch/cases/logger/home) show an informational toast instead of
// silently doing nothing or erroring — safe by construction, since nothing
// is touched for them.
function initRefreshButton() {
  const btn = document.getElementById('btn-refresh-session');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const activeScreen = document.querySelector('.screen.active');
    const screenKey = activeScreen ? activeScreen.id.replace(/-screen$/, '') : null;
    if (screenKey === 'fla') {
      _flaResetSession();
    } else if (screenKey === 'cdr') {
      if (typeof CDRAnalyzer !== 'undefined') CDRAnalyzer.clearAll();
      else _showToast('Module CDR chưa sẵn sàng.', 'error');
    } else {
      _showToast('Refresh hiện chỉ áp dụng cho màn hình FLA/NAPAS và CDR.', 'info');
    }
  });
}

/* 2. Clock Telemetry Display */
function updateLiveClock() {
  const clockElement = document.getElementById('live-clock');
  if (clockElement) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
    const dateStr = now.toLocaleDateString('vi-VN');
    clockElement.innerText = `UTC+7 [ ${dateStr} - ${timeStr} ]`;
  }
}

/* === Skeleton & Loading State Utilities === */

function showTableSkeleton(tbodyId, cols, rowCount) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const pcts = ['35%', '55%', '70%', '45%', '75%', '50%', '62%', '40%'];
  tbody.innerHTML = Array.from({ length: rowCount }, (_, ri) =>
    `<tr>${Array.from({ length: cols }, (_, ci) =>
      `<td class="skeleton-cell"><span style="width:${pcts[(ri * cols + ci) % pcts.length]}"></span></td>`
    ).join('')}</tr>`
  ).join('');
}

function showChartSkeleton(sectionId, displayStyle, barCount) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.style.display = displayStyle;
  const pcts = [30, 55, 70, 45, 80, 60, 50, 65, 40, 72, 58, 35];
  section.querySelectorAll('.chart-canvas-wrap').forEach(wrap => {
    wrap.querySelector('.chart-skeleton-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'chart-skeleton-overlay';
    Array.from({ length: barCount }, (_, i) => {
      const bar = document.createElement('div');
      bar.className = 'chart-skeleton-bar';
      bar.style.height = pcts[i % pcts.length] + '%';
      overlay.appendChild(bar);
    });
    wrap.appendChild(overlay);
  });
}

function hideChartSkeleton(sectionId) {
  document.getElementById(sectionId)
    ?.querySelectorAll('.chart-skeleton-overlay')
    .forEach(el => el.remove());
}

function showProcessing() {
  document.getElementById('processing-indicator')?.classList.add('visible');
}

function hideProcessing() {
  document.getElementById('processing-indicator')?.classList.remove('visible');
}

/* === Virtual Table Scroller === */

const _VT_ROW_H  = 38;
const _VT_BUFFER = 6;

class VirtualTable {
  constructor(tbodyId, wrapperId) {
    this.tbody   = document.getElementById(tbodyId);
    this.wrapper = document.getElementById(wrapperId);
    this._rows   = [];
    this._empty  = '';
    this._anchor = -1;
    this._raf    = 0;
    if (this.wrapper) {
      this.wrapper.addEventListener('scroll', () => {
        if (this._raf) return;
        this._raf = requestAnimationFrame(() => { this._raf = 0; this._tick(); });
      }, { passive: true });
    }
  }

  load(rowHtmls, emptyHtml) {
    this._rows   = rowHtmls;
    this._empty  = emptyHtml || '';
    this._anchor = -1;
    if (this.wrapper) this.wrapper.scrollTop = 0;
    this._render(0);
  }

  _tick() {
    const top    = this.wrapper?.scrollTop || 0;
    const anchor = Math.max(0, Math.floor(top / _VT_ROW_H) - _VT_BUFFER);
    if (anchor !== this._anchor) { this._anchor = anchor; this._render(anchor); }
  }

  _render(anchor) {
    const total = this._rows.length;
    if (!this.tbody) return;
    if (total === 0) { this.tbody.innerHTML = this._empty; return; }

    const wrapH = this.wrapper?.clientHeight || 320;
    const win   = Math.ceil(wrapH / _VT_ROW_H) + _VT_BUFFER * 2;
    const end   = Math.min(total, anchor + win);
    const topPx = anchor * _VT_ROW_H;
    const botPx = (total - end) * _VT_ROW_H;

    const frag = document.createDocumentFragment();
    if (topPx > 0) { const s = document.createElement('tr'); s.style.height = topPx + 'px'; frag.appendChild(s); }
    for (let i = anchor; i < end; i++) { const tr = document.createElement('tr'); tr.innerHTML = this._rows[i]; frag.appendChild(tr); }
    if (botPx > 0) { const s = document.createElement('tr'); s.style.height = botPx + 'px'; frag.appendChild(s); }

    this.tbody.innerHTML = '';
    this.tbody.appendChild(frag);
  }
}

let _gtpVT, _flaVT;

/* 3. Phân Hệ A - GTP: Geospatial Telemetry Processor */
const MOCK_CELL_PATH = [
  { time: '10:00:23', lac: '5421', cell: '23912', ip: 'Vinaphone', lat: 21.0285, lng: 105.8542, label: 'Trạm Ba Đình 01', strength: 'Cực tốt (-62 dBm)' },
  { time: '10:15:45', lac: '5421', cell: '23945', ip: 'Vinaphone', lat: 21.0223, lng: 105.8456, label: 'Trạm Hoàn Kiếm 03', strength: 'Tốt (-71 dBm)' },
  { time: '10:32:10', lac: '5422', cell: '11052', ip: 'Vinaphone', lat: 21.0112, lng: 105.8367, label: 'Trạm Hai Bà Trưng 12', strength: 'Trung bình (-85 dBm)' },
  { time: '10:55:02', lac: '5422', cell: '11090', ip: 'Vinaphone', lat: 20.9984, lng: 105.8123, label: 'Trạm Thanh Xuân 08', strength: 'Tốt (-68 dBm)' },
  { time: '11:15:30', lac: '5489', cell: '08542', ip: 'Vinaphone', lat: 20.9751, lng: 105.7842, label: 'Trạm Hà Đông 05', strength: 'Yếu (-94 dBm)' }
];

function _initDropzone(dropzoneId, fileInputId, onFilePicked) {
  const dropzone = document.getElementById(dropzoneId);
  const fileInput = document.getElementById(fileInputId);
  if (!dropzone || !fileInput) return;

  dropzone.style.cursor = 'pointer';

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', e => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) onFilePicked(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) onFilePicked(file);
    fileInput.value = '';
  });
}

function _showToast(message, type) {
  let toast = document.getElementById('_sentinel-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '_sentinel-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'right:24px', 'z-index:9999',
      'padding:12px 18px', 'border-radius:4px', 'font-family:var(--font-mono)',
      'font-size:0.78rem', 'max-width:400px', 'line-height:1.5',
      'box-shadow:0 4px 20px rgba(0,0,0,0.5)', 'transition:opacity 0.3s',
    ].join(';');
    document.body.appendChild(toast);
  }
  const colors = {
    success: { bg: 'rgba(0,240,255,0.12)', border: 'var(--accent-cyan)', color: 'var(--accent-cyan)' },
    error:   { bg: 'rgba(255,59,48,0.12)',  border: 'var(--accent-red)',  color: 'var(--accent-red)'  },
    info:    { bg: 'rgba(18,22,30,0.95)',    border: 'var(--border-color)', color: 'var(--text-primary)' },
  };
  const c = colors[type] || colors.info;
  toast.style.background = c.bg;
  toast.style.border = `1px solid ${c.border}`;
  toast.style.color = c.color;
  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.style.opacity = '0'; }, 4000);
}

/* ─── GTP State: lưu ParseResult hiện tại để export ─── */
let _gtpParseResult = null;

/* ─── GTP DOM refs — cần ở module scope để drawRadarPath dùng được ─── */
let _gtpSvgMap       = null;
let _gtpTimelineInfo = null;

/* ─── clearRadarMap / drawRadarPath / updateTimelineStep
       Đặt ở MODULE scope để gtpFilterBySubscriber có thể gọi ─── */

function clearRadarMap() {
  if (!_gtpSvgMap) _gtpSvgMap = document.getElementById('gtp-radar-svg');
  if (_gtpSvgMap) _gtpSvgMap.innerHTML = `
    <circle cx="50%" cy="50%" r="40%" stroke="rgba(0,240,255,0.05)" stroke-width="1" fill="none"/>
    <circle cx="50%" cy="50%" r="30%" stroke="rgba(0,240,255,0.10)" stroke-width="1" fill="none"/>
    <circle cx="50%" cy="50%" r="20%" stroke="rgba(0,240,255,0.07)" stroke-width="1" fill="none"/>
    <circle cx="50%" cy="50%" r="10%" stroke="rgba(0,240,255,0.12)" stroke-width="1" fill="none"/>
    <line x1="10%" y1="50%" x2="90%" y2="50%" stroke="rgba(0,240,255,0.05)" stroke-width="1"/>
    <line x1="50%" y1="10%" x2="50%" y2="90%" stroke="rgba(0,240,255,0.05)" stroke-width="1"/>`;
}

function drawRadarPath(pathData) {
  if (!_gtpSvgMap) _gtpSvgMap = document.getElementById('gtp-radar-svg');
  clearRadarMap();
  if (!pathData || pathData.length === 0 || !_gtpSvgMap) return;

  const lats = pathData.map(p => p.lat).filter(Boolean);
  const lngs = pathData.map(p => p.lng).filter(Boolean);
  const minLat = lats.length ? Math.min(...lats) - 0.005 : 20.96;
  const maxLat = lats.length ? Math.max(...lats) + 0.005 : 21.04;
  const minLng = lngs.length ? Math.min(...lngs) - 0.008 : 105.76;
  const maxLng = lngs.length ? Math.max(...lngs) + 0.008 : 105.88;
  const latR = maxLat - minLat || 0.08;
  const lngR = maxLng - minLng || 0.12;

  const coords = pathData.map(p => ({
    x: 10 + ((p.lng - minLng) / lngR) * 80,
    y: 90 - ((p.lat - minLat) / latR) * 80,
    ...p,
  }));

  if (coords.length > 1) {
    let d = `M ${coords[0].x.toFixed(1)}% ${coords[0].y.toFixed(1)}%`;
    for (let i = 1; i < coords.length; i++)
      d += ` L ${coords[i].x.toFixed(1)}% ${coords[i].y.toFixed(1)}%`;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'radar-path');
    _gtpSvgMap.appendChild(path);
  }

  coords.forEach((c, idx) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'radar-node-group');
    g.setAttribute('id', `radar-node-${idx}`);
    g.style.opacity = '0.5';

    const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    pulse.setAttribute('cx', `${c.x.toFixed(1)}%`); pulse.setAttribute('cy', `${c.y.toFixed(1)}%`);
    pulse.setAttribute('r', '8'); pulse.setAttribute('fill', 'rgba(0,240,255,0.2)');
    pulse.setAttribute('class', 'radar-node-pulse');
    g.appendChild(pulse);

    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    center.setAttribute('cx', `${c.x.toFixed(1)}%`); center.setAttribute('cy', `${c.y.toFixed(1)}%`);
    center.setAttribute('r', '4'); center.setAttribute('class', 'radar-target');
    g.appendChild(center);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', `${(c.x + 2).toFixed(1)}%`); text.setAttribute('y', `${(c.y - 2).toFixed(1)}%`);
    text.setAttribute('fill', '#94a3b8'); text.setAttribute('font-size', '10px');
    text.setAttribute('font-family', 'Roboto Mono');
    text.textContent = c.cell || String(idx + 1);
    g.appendChild(text);
    _gtpSvgMap.appendChild(g);
  });
}

function updateTimelineStep(step, pathData) {
  if (!_gtpTimelineInfo) _gtpTimelineInfo = document.getElementById('gtp-timeline-info');
  const src  = pathData || MOCK_CELL_PATH;
  const data = src[step];
  if (!data) return;
  if (_gtpTimelineInfo) _gtpTimelineInfo.innerText = `NÚT: ${data.cell} @ ${data.time} · LAC ${data.lac}`;
  const playDisplay = document.getElementById('gtp-play-step-display');
  if (playDisplay) playDisplay.textContent = `${step + 1} / ${src.length}`;
  for (let i = 0; i < src.length; i++) {
    const node = document.getElementById(`radar-node-${i}`);
    if (!node) continue;
    const pulse = node.querySelector('.radar-node-pulse');
    if (i === step) {
      node.style.opacity = '1';
      pulse?.setAttribute('fill', 'var(--accent-cyan)');
      pulse?.classList.add('radar-target');
    } else {
      node.style.opacity = i < step ? '0.8' : '0.3';
      pulse?.setAttribute('fill', 'rgba(0,240,255,0.2)');
      pulse?.classList.remove('radar-target');
    }
  }
}

function initGtpModule() {
  const loadBtn = document.getElementById('gtp-load-demo');
  const slider  = document.getElementById('gtp-timeline-slider');
  _gtpSvgMap       = document.getElementById('gtp-radar-svg');
  _gtpTimelineInfo = document.getElementById('gtp-timeline-info');
  const svgMap     = _gtpSvgMap;

  if (!loadBtn) return;

  _gtpVT = new VirtualTable('gtp-detail-body', 'gtp-table-wrapper');

  /* ── Upload handler — parse Excel bằng CellLacParser ── */
  _initDropzone('gtp-dropzone', 'gtp-file-input', async (file) => {
    const carrierKey = document.getElementById('gtp-carrier-select')?.value || 'auto';

    // --- Cập nhật UI: đang phân tích ---
    _gtpSetStatusParsing(file.name, carrierKey);
    showProcessing();

    try {
      if (typeof CellLacParser === 'undefined' || typeof XLSX === 'undefined') {
        throw new Error('Thư viện parse chưa tải. Vui lòng tải lại trang.');
      }

      const result = await CellLacParser.parseFile(file, carrierKey);
      _gtpParseResult  = result;

      /* ── Báo lỗi cột thiếu nếu có ── */
      if (result.missing_columns.length > 0) {
        _gtpShowColWarning(
          `Cảnh báo: Không tìm được cột ${result.missing_columns.join(', ')} ` +
          `— kết quả có thể không đầy đủ`
        );
      }

      /* ── Convert → GTP format → nạp vào bảng + radar ── */
      const gtpData = CellLacParser.toGtpFormat(result.records, result.carrier_name);

      /* ── Vinaphone: hiển thị subscriber filter ── */
      if (result.multi_subscriber && result.subscribers) {
        _gtpBuildSubscriberFilter(result.subscribers);
      } else {
        const subFilter = document.getElementById('gtp-subscriber-filter');
        if (subFilter) subFilter.style.display = 'none';
      }

      /* ── Cập nhật stats UI ── */
      _gtpSetStatusOk(result);

      /* ── Cập nhật Radar map ── */
      if (gtpData.length > 0) {
        slider.disabled = false;
        slider.max      = gtpData.length - 1;
        slider.value    = 0;
        drawRadarPath(gtpData);
        updateTimelineStep(0, gtpData);
        gtpLoadData(gtpData);
      }

      _showToast(
        `✓ ${result.carrier_name} — ${result.valid_count} bản ghi hợp lệ` +
        (result.auto_detected ? ' (tự nhận diện)' : ''),
        'success'
      );

    } catch (err) {
      console.error('[GTP Upload]', err);
      _gtpSetStatusError(file.name, err.message);
      _showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      hideProcessing();
      // Reset icon dropzone
      const icon = document.getElementById('gtp-dropzone-icon');
      const text = document.getElementById('gtp-dropzone-text');
      if (icon) icon.textContent = '✓';
      if (text) text.textContent = file.name;
    }
  });

  // Render empty radar map on init
  clearRadarMap();

  loadBtn.addEventListener('click', () => {
    loadBtn.classList.add('btn-loading');
    loadBtn.textContent = 'ĐANG NẠP DỮ LIỆU...';
    showTableSkeleton('gtp-detail-body', 5, 3);
    showChartSkeleton('gtp-charts', 'flex', 8);
    showProcessing();
    setTimeout(() => {
      slider.disabled = false;
      slider.max      = MOCK_CELL_PATH.length - 1;
      slider.value    = 0;
      drawRadarPath(MOCK_CELL_PATH);
      updateTimelineStep(0, MOCK_CELL_PATH);
      gtpLoadData(MOCK_CELL_PATH);
      loadBtn.classList.remove('btn-loading');
      loadBtn.textContent = 'NẠP BẢN GHI DEMO HANOI';
      hideProcessing();
    }, 420);
  });

  /* Slider dùng _gtpState.data hiện tại (demo hoặc upload thật) */
  slider.addEventListener('input', (e) => {
    const step = parseInt(e.target.value);
    const src  = _gtpState.data.length > 0 ? _gtpState.data : MOCK_CELL_PATH;
    updateTimelineStep(step, src);
  });

  // clearRadarMap / drawRadarPath / updateTimelineStep đã được
  // chuyển lên module scope (trên function initGtpModule)
}

/* ─── GTP Upload Status Helpers ─────────────────────────────── */

function _gtpSetStatusParsing(fileName, carrierKey) {
  const el = document.getElementById('gtp-upload-status');
  const bar = document.getElementById('gtp-status-bar');
  if (!el || !bar) return;
  el.style.display = 'block';
  bar.style.borderColor = 'rgba(0,240,255,0.3)';
  bar.style.color = 'var(--text-secondary)';
  bar.innerHTML = `⏳ Đang phân tích: <strong style="color:var(--accent-cyan)">${fileName}</strong><br>` +
    `Nhà mạng: ${carrierKey === 'auto' ? 'Tự động nhận diện...' : carrierKey.toUpperCase()}`;
  document.getElementById('gtp-parse-stats')?.setAttribute('hidden', '');
  const warnEl = document.getElementById('gtp-col-warnings');
  if (warnEl) warnEl.style.display = 'none';
}

function _gtpSetStatusOk(result) {
  const bar = document.getElementById('gtp-status-bar');
  if (bar) {
    const autoTag = result.auto_detected
      ? ` <span style="color:var(--text-muted)">(tự nhận diện)</span>` : '';
    bar.style.borderColor = 'rgba(0,240,255,0.5)';
    bar.style.color = 'var(--accent-cyan)';
    bar.innerHTML =
      `✓ <strong>${result.carrier_name}</strong>${autoTag}<br>` +
      `File: ${result.file_name} · Sheet: ${result.sheet_name} · Header: dòng ${result.header_row + 1}`;
  }

  // Stats
  const statsEl = document.getElementById('gtp-parse-stats');
  if (statsEl) {
    statsEl.removeAttribute('hidden');
    document.getElementById('gtp-stat-total').textContent  = result.total_data_rows;
    document.getElementById('gtp-stat-valid').textContent  = result.valid_count;
    document.getElementById('gtp-stat-errors').textContent = result.error_count;
  }

  // Export buttons
  const exportEl = document.getElementById('gtp-export-btns');
  if (exportEl) exportEl.style.display = 'flex';
}

function _gtpSetStatusError(fileName, message) {
  const el  = document.getElementById('gtp-upload-status');
  const bar = document.getElementById('gtp-status-bar');
  if (!el || !bar) return;
  el.style.display = 'block';
  bar.style.borderColor = 'rgba(255,59,48,0.5)';
  bar.style.color = 'var(--accent-red)';
  bar.innerHTML =
    `✗ Lỗi xử lý: <strong>${fileName}</strong><br>` +
    `<span style="color:var(--text-secondary)">${message}</span>`;
  document.getElementById('gtp-parse-stats')?.setAttribute('hidden', '');
}

function _gtpShowColWarning(message) {
  const warnEl = document.getElementById('gtp-col-warnings');
  if (!warnEl) return;
  warnEl.style.display = 'block';
  warnEl.textContent = `⚠ ${message}`;
}

/* ─── Vinaphone Subscriber Filter ───────────────────────────── */

function _gtpBuildSubscriberFilter(subscriberMap) {
  const container = document.getElementById('gtp-subscriber-filter');
  const select    = document.getElementById('gtp-subscriber-select');
  const countEl   = document.getElementById('gtp-subscriber-count');
  if (!container || !select) return;

  const phones = Object.keys(subscriberMap);
  select.innerHTML = '<option value="all">Tất cả thuê bao</option>' +
    phones.map(p => {
      const count = subscriberMap[p].length;
      return `<option value="${p}">${p} (${count} bản ghi)</option>`;
    }).join('');

  if (countEl) {
    countEl.textContent = `${phones.length} thuê bao | ${
      phones.reduce((s, p) => s + subscriberMap[p].length, 0)
    } bản ghi tổng`;
  }

  container.style.display = 'block';
}

/**
 * Filter GTP table & radar theo subscriber (Vinaphone).
 * Gọi từ <select onchange="gtpFilterBySubscriber(this.value)">
 */
function gtpFilterBySubscriber(phone) {
  if (!_gtpParseResult) return;

  const records = phone === 'all'
    ? _gtpParseResult.records
    : (_gtpParseResult.subscribers?.[phone] || []);

  const gtpData = CellLacParser.toGtpFormat(records, _gtpParseResult.carrier_name);

  const slider = document.getElementById('gtp-timeline-slider');
  if (slider) {
    slider.disabled = gtpData.length === 0;
    slider.max      = Math.max(0, gtpData.length - 1);
    slider.value    = 0;
  }

  if (gtpData.length > 0) {
    drawRadarPath(gtpData);
    updateTimelineStep(0, gtpData);
    gtpLoadData(gtpData);
  }

  // Update count badge
  const countEl = document.getElementById('gtp-subscriber-count');
  if (countEl) {
    countEl.textContent = phone === 'all'
      ? `${Object.keys(_gtpParseResult.subscribers || {}).length} thuê bao | ${records.length} bản ghi tổng`
      : `${records.length} bản ghi của ${phone}`;
  }

  _showToast(
    phone === 'all'
      ? `Hiển thị tất cả ${records.length} bản ghi`
      : `Lọc: ${phone} — ${records.length} bản ghi`,
    'info'
  );
}

/* ─── GTP Export functions (gọi từ HTML onclick) ─────────────── */

function _requireParseResult() {
  if (!_gtpParseResult?.records?.length) {
    _showToast('Chưa có dữ liệu để xuất — vui lòng upload file trước', 'error');
    return false;
  }
  return true;
}

function gtpExportCSV() {
  if (!_requireParseResult()) return;
  const phone = _gtpParseResult.pii?.phone_raw
    || Object.keys(_gtpParseResult.subscribers || {})[0]
    || _gtpParseResult.carrier;
  const csv  = CellLacParser.exportCSV(_gtpParseResult.records);
  const name = `${phone}_CDR_${new Date().toISOString().slice(0,10)}.csv`;
  CellLacParser.downloadText(csv, name, 'text/csv;charset=utf-8;');
  _showToast(`Đã xuất CSV ${_gtpParseResult.records.length} bản ghi → ${name}`, 'success');
}

function gtpExportJSON() {
  if (!_requireParseResult()) return;
  const phone = _gtpParseResult.pii?.phone_raw
    || Object.keys(_gtpParseResult.subscribers || {})[0]
    || _gtpParseResult.carrier;
  const json = CellLacParser.exportJSON(_gtpParseResult.records);
  const name = `${phone}_CDR_${new Date().toISOString().slice(0,10)}.json`;
  CellLacParser.downloadText(json, name, 'application/json');
  _showToast(`Đã xuất JSON → ${name}`, 'success');
}

/**
 * Download Excel multi-sheet: RAW_PARSED + SUMMARY + ERRORS + per-subscriber
 * Tên file: <phone>_export_all.xlsx
 */
function gtpDownloadExcel() {
  if (!_requireParseResult()) return;
  try {
    const filename = CellLacParser.downloadExcel(_gtpParseResult);
    _showToast(`✓ Đã tạo ${filename} (RAW_PARSED + SUMMARY + ERRORS)`, 'success');
  } catch (err) {
    console.error('[Export Excel]', err);
    _showToast(`Lỗi export Excel: ${err.message}`, 'error');
  }
}

/**
 * Download ZIP bundle:
 *   - <phone>_export_all.xlsx
 *   - <phone>_CDR.csv
 *   - <phone>_CDR.json
 *   → exports_bundle_<date>.zip
 *
 * Sử dụng JSZip (loaded từ CDN).
 * Fallback: download từng file riêng nếu JSZip chưa load.
 */
async function gtpDownloadZip() {
  if (!_requireParseResult()) return;

  const phone    = _gtpParseResult.pii?.phone_raw
    || Object.keys(_gtpParseResult.subscribers || {})[0]
    || _gtpParseResult.carrier;
  const dateStr  = new Date().toISOString().slice(0, 10);
  const zipName  = `exports_bundle_${dateStr}.zip`;

  if (typeof JSZip === 'undefined') {
    // Fallback: download 3 file riêng biệt
    _showToast('JSZip chưa load — đang tải từng file riêng...', 'info');
    gtpExportCSV();
    setTimeout(gtpExportJSON, 300);
    setTimeout(gtpDownloadExcel, 600);
    return;
  }

  _showToast('Đang tạo ZIP bundle...', 'info');
  showProcessing();

  try {
    const zip = new JSZip();

    // Excel multi-sheet
    const wb       = CellLacParser.exportToExcel(_gtpParseResult);
    const xlsxBuf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    zip.file(`${phone}_export_all.xlsx`, xlsxBuf);

    // CSV
    const csvContent = CellLacParser.exportCSV(_gtpParseResult.records);
    zip.file(`${phone}_CDR.csv`, '﻿' + csvContent);

    // JSON
    const jsonContent = CellLacParser.exportJSON(_gtpParseResult.records);
    zip.file(`${phone}_CDR.json`, jsonContent);

    // Vinaphone: per-subscriber CSV
    if (_gtpParseResult.subscribers) {
      for (const [subPhone, recs] of Object.entries(_gtpParseResult.subscribers)) {
        const subCsv = CellLacParser.exportCSV(recs);
        zip.file(`vinaphone_${subPhone}.csv`, '﻿' + subCsv);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: zipName });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);

    _showToast(`✓ ZIP bundle: ${zipName} (${(blob.size / 1024).toFixed(0)} KB)`, 'success');
  } catch (err) {
    console.error('[ZIP Bundle]', err);
    _showToast(`Lỗi tạo ZIP: ${err.message}`, 'error');
  } finally {
    hideProcessing();
  }
}

/* 3b. GTP Filter / Search / Sort / Paginate */
const _gtpState = { data: [], filtered: [], sortKey: null, sortDir: 1, page: 0, pageSize: 5000 };

function gtpLoadData(data) {
  _gtpState.data = data;
  _gtpState.sortKey = null;
  _gtpState.sortDir = 1;

  const lacSel = document.getElementById('gtp-filter-lac');
  const lacs = [...new Set(data.map(d => d.lac))];
  lacSel.innerHTML = '<option value="all">Tất cả LAC</option>' +
    lacs.map(l => `<option value="${l}">${l}</option>`).join('');

  document.getElementById('gtp-filter-block').style.display = 'block';

  ['gtp-search', 'gtp-filter-lac', 'gtp-filter-signal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.oninput = gtpApplyFilters; el.onchange = gtpApplyFilters; }
  });

  document.querySelectorAll('#gtp-screen .sortable-th').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.sortKey;
      _gtpState.sortDir = _gtpState.sortKey === key ? _gtpState.sortDir * -1 : 1;
      _gtpState.sortKey = key;
      document.querySelectorAll('#gtp-screen .sortable-th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(_gtpState.sortDir === 1 ? 'sort-asc' : 'sort-desc');
      gtpApplyFilters();
    };
  });

  document.getElementById('gtp-prev').onclick = () => { _gtpState.page--; gtpRenderPage(); };
  document.getElementById('gtp-next').onclick = () => { _gtpState.page++; gtpRenderPage(); };

  gtpApplyFilters();

  // Phase 1: PHÂN TÍCH KHÔNG GIAN VIỄN THÔNG
  gtpBuildAiSummary(data);
  gtpRenderStayPoints(data);
  gtpInitPlayback(data);
  gtpRenderJourneyTimeline(data);
}

function gtpApplyFilters() {
  const search = (document.getElementById('gtp-search')?.value || '').toLowerCase().trim();
  const lac    = document.getElementById('gtp-filter-lac')?.value || 'all';
  const signal = document.getElementById('gtp-filter-signal')?.value || 'all';

  let result = _gtpState.data.filter(d => {
    if (search && !`${d.cell} ${d.label} ${d.lac} ${d.ip} ${d.time}`.toLowerCase().includes(search)) return false;
    if (lac !== 'all' && d.lac !== lac) return false;
    if (signal !== 'all') {
      const m = d.strength.match(/-(\d+)/);
      const dbm = m ? parseInt(m[1]) : 80;
      if (signal === 'good'   && dbm > 75)               return false;
      if (signal === 'medium' && (dbm <= 75 || dbm > 90)) return false;
      if (signal === 'weak'   && dbm <= 90)              return false;
    }
    return true;
  });

  if (_gtpState.sortKey) {
    const { sortKey: k, sortDir: dir } = _gtpState;
    result.sort((a, b) => {
      let va = a[k], vb = b[k];
      if (k === 'strength') {
        const ma = va.match(/-(\d+)/), mb = vb.match(/-(\d+)/);
        va = ma ? parseInt(ma[1]) : 99; vb = mb ? parseInt(mb[1]) : 99;
      }
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }

  _gtpState.filtered = result;
  _gtpState.page = 0;
  showProcessing();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    gtpRenderPage();
    renderGtpCharts(result.length > 0 ? result : _gtpState.data);
    hideProcessing();
  }));
}

function gtpRenderPage() {
  const { filtered, pageSize } = _gtpState;
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  _gtpState.page   = Math.min(_gtpState.page, totalPages - 1);
  const start      = _gtpState.page * pageSize;
  const rows       = filtered.slice(start, start + pageSize);

  const htmlRows = rows.map(item =>
    `<td style="font-family:var(--font-mono);color:var(--accent-cyan);">${item.time}</td>` +
    `<td style="font-family:var(--font-mono);">${item.lac}</td>` +
    `<td style="font-family:var(--font-mono);font-weight:500;">${item.cell}</td>` +
    `<td>${item.label}</td>` +
    `<td><span class="badge cyan">${item.strength}</span></td>`
  );
  _gtpVT.load(htmlRows, `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);font-family:var(--font-mono);padding:20px;">KHÔNG CÓ KẾT QUẢ PHÙ HỢP</td></tr>`);

  const pag = document.getElementById('gtp-pagination');
  if (pag) {
    pag.style.display = 'flex';
    document.getElementById('gtp-page-info').innerText    = `${_gtpState.page + 1} / ${totalPages}`;
    document.getElementById('gtp-record-count').innerText = `${total} bản ghi`;
    document.getElementById('gtp-prev').disabled = _gtpState.page === 0;
    document.getElementById('gtp-next').disabled = _gtpState.page >= totalPages - 1;
  }
}

/* ═══════════════════════════════════════════════════════════════
   GTP PHASE 1 — PHÂN TÍCH KHÔNG GIAN VIỄN THÔNG
   1. AI Summary Box
   2. Stay Point Analysis
   3. Travel Path Engine
   4. Playback Mode
   5. Journey Timeline
   ═══════════════════════════════════════════════════════════════ */

let _gtpPlaybackTimer = null;

/* 1. AI Summary Box */
function gtpBuildAiSummary(data) {
  const el     = document.getElementById('gtp-ai-summary');
  const textEl = document.getElementById('gtp-ai-summary-text');
  if (!el || !textEl || !data || data.length === 0) return;

  const lacGroups = {};
  let weakCount = 0;
  const signals = [];

  data.forEach(d => {
    lacGroups[d.lac] = (lacGroups[d.lac] || 0) + 1;
    const m = (d.strength || '').match(/-(\d+)/);
    if (m) {
      const dbm = parseInt(m[1]);
      signals.push(-dbm);
      if (dbm > 90) weakCount++;
    }
  });

  const topLac    = Object.entries(lacGroups).sort((a, b) => b[1] - a[1])[0];
  const avgDbm    = signals.length
    ? (signals.reduce((a, b) => a + b, 0) / signals.length).toFixed(1)
    : 'N/A';
  const lacCount    = Object.keys(lacGroups).size !== undefined
    ? Object.keys(lacGroups).length
    : 0;
  const uniqueCells = new Set(data.map(d => d.cell)).size;
  const firstTime   = data[0]?.time || '';
  const lastTime    = data[data.length - 1]?.time || '';
  const weakPct     = data.length ? ((weakCount / data.length) * 100).toFixed(0) : 0;
  const lacCountVal = Object.keys(lacGroups).length;

  const lines = [
    `▸ Tổng <strong style="color:var(--accent-cyan)">${data.length}</strong> bản ghi · <strong style="color:var(--accent-cyan)">${lacCountVal}</strong> vùng LAC · <strong style="color:var(--accent-cyan)">${uniqueCells}</strong> trạm BTS`,
    `▸ Khoảng thời gian: <strong>${firstTime}</strong> → <strong>${lastTime}</strong>`,
    topLac
      ? `▸ Vùng chủ đạo: LAC <strong style="color:var(--accent-cyan)">${topLac[0]}</strong> — ${topLac[1]} lần (${((topLac[1] / data.length) * 100).toFixed(0)}%)`
      : '',
    `▸ Tín hiệu TB: <strong>${avgDbm} dBm</strong> · Vùng yếu: <strong style="color:${weakCount > data.length * 0.3 ? 'var(--accent-red)' : 'var(--text-primary)'}">${weakPct}%</strong>`,
    lacCountVal > 5
      ? `▸ <span style="color:var(--accent-yellow)">Hành vi di động cao</span> — ${lacCountVal} vùng LAC khác nhau`
      : `▸ Hoạt động tập trung trong ${lacCountVal} vùng LAC`,
    weakCount > data.length * 0.3
      ? `⚠ <span style="color:var(--accent-red)">Cảnh báo:</span> Tỷ lệ tín hiệu yếu cao — thiết bị có thể ở vùng hẻo lánh hoặc gặp sự cố`
      : '',
  ].filter(Boolean);

  textEl.innerHTML = lines.map(l => `<div style="margin-bottom:3px;">${l}</div>`).join('');
  gtpRenderTravelInfo(data);
  el.style.display = 'block';
}

/* 3. Travel Path Engine (called from inside gtpBuildAiSummary) */
function gtpBuildTravelPath(data) {
  const transitions = [];
  let lacChanges = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i].lac !== data[i - 1].lac) {
      lacChanges++;
      transitions.push({ from: data[i - 1].lac, to: data[i].lac, time: data[i].time });
    }
  }
  return { hops: lacChanges, transitions };
}

function gtpRenderTravelInfo(data) {
  const el = document.getElementById('gtp-travel-info');
  if (!el || data.length < 2) return;
  const travel      = gtpBuildTravelPath(data);
  const uniqueLacs  = new Set(data.map(d => d.lac)).size;
  el.innerHTML =
    `🛤 Lộ trình: <strong style="color:var(--accent-cyan)">${travel.hops}</strong> lần đổi vùng LAC · ` +
    `<strong style="color:var(--accent-cyan)">${uniqueLacs}</strong> vùng phủ sóng`;
  el.style.display = 'block';
}

/* 2. Stay Point Analysis */
function gtpComputeStayPoints(data) {
  const runs = [];
  let cur = null;
  data.forEach((d, i) => {
    if (!cur || cur.lac !== d.lac) {
      if (cur) runs.push(cur);
      cur = { lac: d.lac, cell: d.cell, label: d.label, count: 1, start: d.time, end: d.time, startIdx: i };
    } else {
      cur.count++;
      cur.end = d.time;
    }
  });
  if (cur) runs.push(cur);
  return runs.filter(r => r.count >= 2).sort((a, b) => b.count - a.count).slice(0, 5);
}

function gtpRenderStayPoints(data) {
  const el   = document.getElementById('gtp-stay-points');
  const body = document.getElementById('gtp-stay-points-body');
  if (!el || !body) return;

  const stays = gtpComputeStayPoints(data);
  if (stays.length === 0) { el.style.display = 'none'; return; }

  body.innerHTML = stays.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;"
         onclick="gtpJumpToStep(${s.startIdx})">
      <span style="color:var(--accent-cyan);font-family:var(--font-mono);font-size:0.65rem;min-width:18px;">#${i + 1}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:0.73rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          LAC <strong>${s.lac}</strong>${s.label ? ` · ${s.label}` : (s.cell ? ` · Cell ${s.cell}` : '')}
        </div>
        <div style="font-size:0.62rem;color:var(--text-muted);">${s.start}${s.end !== s.start ? ' → ' + s.end : ''}</div>
      </div>
      <span style="font-family:var(--font-mono);font-size:0.75rem;color:var(--accent-cyan);flex-shrink:0;">${s.count}×</span>
    </div>
  `).join('');

  el.style.display = 'block';
}

/* 4. Playback Mode */
function gtpInitPlayback(data) {
  const playBtn  = document.getElementById('gtp-play-btn');
  const controls = document.getElementById('gtp-playback-controls');
  const display  = document.getElementById('gtp-play-step-display');
  if (!playBtn || !controls) return;

  controls.style.display = 'flex';

  if (_gtpPlaybackTimer) { clearInterval(_gtpPlaybackTimer); _gtpPlaybackTimer = null; }
  playBtn.textContent = '▶ PHÁT';

  const slider = document.getElementById('gtp-timeline-slider');
  if (display && slider) display.textContent = `1 / ${data.length}`;

  playBtn.onclick = () => {
    if (_gtpPlaybackTimer) {
      clearInterval(_gtpPlaybackTimer);
      _gtpPlaybackTimer = null;
      playBtn.textContent = '▶ PHÁT';
      return;
    }
    const speed = parseInt(document.getElementById('gtp-play-speed')?.value || '1000');
    let step = parseInt(slider?.value || '0');
    const max = data.length - 1;

    playBtn.textContent = '⏸ DỪNG';
    _gtpPlaybackTimer = setInterval(() => {
      if (step >= max) {
        clearInterval(_gtpPlaybackTimer);
        _gtpPlaybackTimer = null;
        playBtn.textContent = '▶ PHÁT';
        return;
      }
      step++;
      if (slider) slider.value = step;
      updateTimelineStep(step, data);
      if (display) display.textContent = `${step + 1} / ${data.length}`;
    }, speed);
  };
}

/* 5. Journey Timeline */
function gtpRenderJourneyTimeline(data) {
  const el    = document.getElementById('gtp-journey-timeline');
  const track = document.getElementById('gtp-journey-track');
  if (!el || !track || data.length === 0) return;

  const lacs    = [...new Set(data.map(d => d.lac))];
  const palette = ['#00f0ff', '#f6ad55', '#68d391', '#fc8181', '#76e4f7', '#b794f4', '#f687b3', '#fbd38d'];
  const lacColors = {};
  lacs.forEach((lac, i) => { lacColors[lac] = palette[i % palette.length]; });

  const runs = [];
  let cur = null;
  data.forEach((d, i) => {
    if (!cur || cur.lac !== d.lac) {
      if (cur) runs.push(cur);
      cur = { lac: d.lac, label: d.label || d.cell || '', count: 1, time: d.time, idx: i };
    } else {
      cur.count++;
    }
  });
  if (cur) runs.push(cur);

  track.innerHTML = runs.map((r, i) => {
    const color = lacColors[r.lac] || '#94a3b8';
    const w = Math.min(Math.max(34, r.count * 5), 110);
    const connector = i < runs.length - 1
      ? `<div style="flex-shrink:0;width:10px;height:2px;background:rgba(255,255,255,0.1);align-self:flex-start;margin-top:11px;"></div>`
      : '';
    return `
      <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;cursor:pointer;"
           onclick="gtpJumpToStep(${r.idx})" title="LAC ${r.lac} · ${r.count} bản ghi · ${r.time}">
        <div style="width:${w}px;height:22px;background:${color}22;border:1px solid ${color};
             border-radius:3px;display:flex;align-items:center;justify-content:center;
             font-size:0.58rem;font-family:var(--font-mono);color:${color};
             white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 3px;">
          ${r.lac}
        </div>
        <div style="font-size:0.52rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;
             max-width:${w}px;overflow:hidden;text-overflow:ellipsis;text-align:center;">${r.time}</div>
      </div>${connector}
    `;
  }).join('');

  el.style.display = 'block';
}

function gtpJumpToStep(idx) {
  const slider = document.getElementById('gtp-timeline-slider');
  if (slider) slider.value = idx;
  const data = _gtpState.data.length > 0 ? _gtpState.data : MOCK_CELL_PATH;
  updateTimelineStep(idx, data);
  const display = document.getElementById('gtp-play-step-display');
  if (display) display.textContent = `${idx + 1} / ${data.length}`;
}

/* 3c. GTP Export */
function exportGtpXlsx() {
  if (typeof XLSX === 'undefined') { alert('Thư viện XLSX chưa tải xong. Thử lại sau.'); return; }
  const data = _gtpState.filtered.length > 0 ? _gtpState.filtered : _gtpState.data;
  if (!data.length) { alert('Không có dữ liệu GTP để xuất.'); return; }

  const wb = XLSX.utils.book_new();

  // Sheet 1: movement log
  const ws1 = XLSX.utils.json_to_sheet(data.map(d => ({
    'Thoi Gian':    d.time,
    'LAC':          d.lac,
    'Cell ID':      d.cell,
    'Vi Tri Tram':  d.label,
    'Nha Mang':     d.ip,
    'Tin Hieu':     d.strength,
    'Vi Do (Lat)':  d.lat,
    'Kinh Do (Lng)': d.lng,
  })));
  XLSX.utils.book_append_sheet(wb, ws1, 'Lich Trinh Tram');

  // Sheet 2: LAC zone frequency
  const lacMap = {};
  data.forEach(d => { lacMap[d.lac] = (lacMap[d.lac] || 0) + 1; });
  const total = data.length || 1;
  const ws2 = XLSX.utils.json_to_sheet(
    Object.entries(lacMap)
      .sort((a, b) => b[1] - a[1])
      .map(([lac, count]) => ({
        'Vung LAC': lac,
        'So Lan Xuat Hien': count,
        'Ti Le (%)': (count / total * 100).toFixed(1) + '%',
      }))
  );
  XLSX.utils.book_append_sheet(wb, ws2, 'Bao Cao LAC');

  // Sheet 3: signal strength distribution
  let good = 0, medium = 0, weak = 0;
  data.forEach(d => {
    const m = d.strength.match(/-(\d+)/);
    const dbm = m ? parseInt(m[1]) : 80;
    if (dbm <= 75) good++;
    else if (dbm <= 90) medium++;
    else weak++;
  });
  const ws3 = XLSX.utils.json_to_sheet([
    { 'Phan Loai': 'Tot',         'Nguong': '>= -75 dBm',   'So Ban Ghi': good,   'Ti Le (%)': (good   / total * 100).toFixed(1) + '%' },
    { 'Phan Loai': 'Trung Binh',  'Nguong': '-75 ~ -90 dBm', 'So Ban Ghi': medium, 'Ti Le (%)': (medium / total * 100).toFixed(1) + '%' },
    { 'Phan Loai': 'Yeu',         'Nguong': '< -90 dBm',    'So Ban Ghi': weak,   'Ti Le (%)': (weak   / total * 100).toFixed(1) + '%' },
  ]);
  XLSX.utils.book_append_sheet(wb, ws3, 'Thong Ke Tin Hieu');

  XLSX.writeFile(wb, `GTP_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* 4. Phân Hệ B - FLA: Financial Ledger Analyzer + Graph Intelligence */
const MOCK_BANK_LEDGER = [
  { id: '1', date: '28/05/2026 02:14:05', code: 'N/A', amount: 150000000, content: 'CHUYEN TIEN THANH TOAN NHO LE', bank: 'Techcombank', flag: 'Khung giờ nhạy cảm & Lượng tiền lớn', accountNumber: 'DEMO001', counterpartyAccount: 'DEMO002', transactionType: 'OUT', transactionDate: '28/05/2026 02:14:05', description: 'CHUYEN TIEN THANH TOAN NHO LE', bankName: 'Techcombank', rawSource: 'Demo' },
  { id: '2', date: '28/05/2026 02:14:32', code: 'N/A', amount: 150000000, content: 'CHUYEN TIEN CAN DAU CHU CO', bank: 'Techcombank', flag: 'Tần suất dồn dập & Lượng tiền lớn', accountNumber: 'DEMO001', counterpartyAccount: 'DEMO003', transactionType: 'OUT', transactionDate: '28/05/2026 02:14:32', description: 'CHUYEN TIEN CAN DAU CHU CO', bankName: 'Techcombank', rawSource: 'Demo' },
  { id: '3', date: '28/05/2026 02:15:10', code: 'N/A', amount: 150000000, content: 'CHUYEN TIEN DAU TU BO PHAN', bank: 'Techcombank', flag: 'Tần suất dồn dập & Lượng tiền lớn', accountNumber: 'DEMO001', counterpartyAccount: 'DEMO004', transactionType: 'OUT', transactionDate: '28/05/2026 02:15:10', description: 'CHUYEN TIEN DAU TU BO PHAN', bankName: 'Techcombank', rawSource: 'Demo' },
  { id: '4', date: '28/05/2026 09:30:12', code: 'A921B', amount: 2000000, content: 'QUAN CAFE A1 AN SANG', bank: 'Vietcombank', flag: 'N/A', accountNumber: 'DEMO001', counterpartyAccount: null, transactionType: 'OUT', transactionDate: '28/05/2026 09:30:12', description: 'QUAN CAFE A1 AN SANG', bankName: 'Vietcombank', rawSource: 'Demo' },
  { id: '5', date: '28/05/2026 12:45:00', code: 'C523D', amount: 450000000, content: 'HO TRO PHI AN NINH DU AN', bank: 'Agribank', flag: 'Lượng tiền lớn bất minh', accountNumber: 'DEMO001', counterpartyAccount: 'DEMO005', transactionType: 'IN', transactionDate: '28/05/2026 12:45:00', description: 'HO TRO PHI AN NINH DU AN', bankName: 'Agribank', rawSource: 'Demo' },
  { id: '6', date: '28/05/2026 15:10:22', code: 'N/A', amount: 500000, content: 'MUA DO DUNG CA NHAN ONLINE', bank: 'Vietcombank', flag: 'N/A', accountNumber: 'DEMO001', counterpartyAccount: null, transactionType: 'OUT', transactionDate: '28/05/2026 15:10:22', description: 'MUA DO DUNG CA NHAN ONLINE', bankName: 'Vietcombank', rawSource: 'Demo' },
  { id: '7', date: '28/05/2026 17:55:40', code: 'E842G', amount: 300000000, content: 'DON TIEN MUA THIET BI MOI-INOX', bank: 'Techcombank', flag: 'Lượng tiền lớn bất minh', accountNumber: 'DEMO001', counterpartyAccount: 'DEMO006', transactionType: 'IN', transactionDate: '28/05/2026 17:55:40', description: 'DON TIEN MUA THIET BI MOI-INOX', bankName: 'Techcombank', rawSource: 'Demo' },
];

/* ── FLA state ──────────────────────────────────────────────────────────────── */
let _flaGraphResult      = null;   // GraphEngine.analyze() output
let _flaAccountScores    = {};     // calibrated account scores
let _flaD3Simulation     = null;   // D3 force simulation
let _flaUploadedFiles    = [];     // { name, bankName, txCount }
let _flaInvestigReport   = null;   // InvestigationReportEngine output
let _flaAuditStore       = {};     // FraudGovernanceLayer audit snapshots
let _flaCalibrationMeta  = {};     // RiskCalibrationEngine metadata
let _flaObsMetrics       = null;   // SystemObservabilityEngine latest metrics
let _flaTopupResult      = null;   // PhoneTopupEngine.analyze() output
let _flaNapasFileResults = [];     // Phase 16-19: raw fileResults from the last upload, needed to re-scope
                                    // transactions per file/group for NAPAS reconciliation display
                                    // (BankParser.pairNapasGroups/reconcileAllPairs need per-file arrays,
                                    // which the flat _flaState.data used by other tabs does not preserve).
// Phase 4
var _flaActiveCaseId     = null;   // currently active InvestigationCase ID — var intentional: exposes as window._flaActiveCaseId for srau-engine.js

function initFlaModule() {
  const loadBtn = document.getElementById('fla-load-demo');
  if (!loadBtn) return;
  _flaVT = new VirtualTable('fla-flow-body', 'fla-table-wrapper');

  // ── Tab switching ────────────────────────────────────────────────────────────
  document.querySelectorAll('#fla-screen .fla-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('#fla-screen .fla-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('#fla-screen .fla-tab-content').forEach(c => {
        c.style.display = 'none';
        c.classList.remove('active');
      });
      tab.classList.add('active');
      const panel = document.getElementById(`fla-tab-${target}`);
      if (panel) { panel.style.display = 'flex'; panel.classList.add('active'); }

      // Lazy-render graph when tab becomes visible
      if (target === 'graph' && _flaGraphResult && document.getElementById('fla-graph-placeholder')?.style.display !== 'none') {
        flaRenderGraph(_flaGraphResult);
      }
    });
  });

  // ── Graph reset zoom ─────────────────────────────────────────────────────────
  document.getElementById('graph-reset-btn')?.addEventListener('click', () => {
    const svg = d3.select('#fla-graph-svg');
    if (svg && typeof d3 !== 'undefined') {
      svg.transition().duration(400).call(
        d3.zoom().transform, d3.zoomIdentity
      );
    }
  });

  // ── Multi-file dropzone (client-side only) ───────────────────────────────────
  const dropzone  = document.getElementById('fla-dropzone');
  const fileInput = document.getElementById('fla-file-input');

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files).filter(f => /\.xlsx?$/i.test(f.name));
      if (files.length > 0) flaProcessFiles(files);
    });
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files);
      if (files.length > 0) flaProcessFiles(files);
      fileInput.value = '';
    });
  }

  // ── Demo button ──────────────────────────────────────────────────────────────
  loadBtn.addEventListener('click', () => {
    loadBtn.classList.add('btn-loading');
    loadBtn.textContent = 'ĐANG PHÂN TÍCH SAO KÊ...';
    showTableSkeleton('fla-flow-body', 8, 3);
    showProcessing();
    setTimeout(() => {
      const importedAt = new Date().toISOString();
      const demoFiles  = [{ name: 'Demo.xlsx', bankName: 'Demo', txCount: MOCK_BANK_LEDGER.length, importedAt }];
      // Stamp sourceFilename so the Source Files sheet (Sheet 9) is populated
      const demoTxs = MOCK_BANK_LEDGER.map(tx => ({ ...tx, sourceFilename: 'Demo.xlsx' }));
      const caseId = InvestigationCaseEngine.createCase(demoFiles, 'Demo — Sao Kê Mẫu');
      _flaActiveCaseId = caseId;
      InvestigationCaseEngine.setActiveCase(caseId);
      InvestigationCaseEngine.setProcessing(caseId);
      flaRunPipeline(demoTxs, demoFiles);
      loadBtn.classList.remove('btn-loading');
      loadBtn.textContent = 'NẠP SAO KÊ THỬ NGHIỆM';
      hideProcessing();
    }, 350);
  });
}

/* ── FILE PROCESSING PIPELINE ────────────────────────────────────────────────── */

async function flaProcessFiles(files) {
  showProcessing();
  flaPipelineStatus('Đang đọc tệp Excel...');

  try {
    const fileBuffers = await Promise.all(files.map(f => f.arrayBuffer()));
    const fileData    = fileBuffers.map((buf, i) => ({ arrayBuffer: buf, filename: files[i].name }));

    flaPipelineStatus('Nhận diện ngân hàng & chuẩn hoá dữ liệu...');
    const { transactions, fileResults } = await BankParser.parseFiles(fileData);

    if (transactions.length === 0) {
      hideProcessing();
      flaPipelineStatus('⚠ Không đọc được giao dịch nào. Kiểm tra định dạng file.');
      _showToast('Không đọc được giao dịch — kiểm tra định dạng file.', 'error');
      return;
    }

    const importedAt = new Date().toISOString();
    const uploadedFiles = fileResults.map(r => ({
      name: r.filename,
      bankName: r.detectedBank || r.bankName,
      txCount: r.transactions.length,
      error: r.error,
      importedAt,
    }));

    // Show detailed per-file parse errors in UI
    fileResults.forEach(r => {
      if (r.error) {
        _showToast(
          `⚠ ${r.filename}: ${r.errorDetail || r.error}`,
          'error'
        );
      } else if (r.transactions.length === 0 && !r.error) {
        _showToast(
          `⚠ ${r.filename}: Ngân hàng phát hiện [${r.detectedBank}] nhưng không đọc được giao dịch — ` +
          `Sheet: ${r.sheetName || '?'} | Hàng tiêu đề: ${r.headerRow >= 0 ? r.headerRow + 1 : '?'}`,
          'error'
        );
      }
    });

    // Phase 16-19: keep the raw per-file results around so the NAPAS
    // reconciliation detail panel (_renderNapasReconciliationPanel, tab
    // "ĐỐI ỨNG TK") can re-scope transactions per file/group on demand —
    // pairNapasGroups()/reconcileAllPairs() need per-file arrays, which the
    // flat _flaState.data used by every other tab does not preserve.
    // Updated on every upload (including legacy-only ones, so switching
    // datasets correctly clears a stale NAPAS panel from a previous upload).
    _flaNapasFileResults = fileResults;

    // NAPAS-only data-quality hint: warn when a CHUYEN/NHAN group looks
    // incomplete or its pairing can't be determined uniquely. Parsing itself
    // already succeeded — this is informational, not a parse error
    // (docs/NAPAS_UPGRADE_SPEC.md §11/§17).
    if (fileResults.some(r => r.detectedBank === 'NAPAS')) {
      const pairing = BankParser.pairNapasGroups(fileResults);
      pairing.orphanChuyen.forEach(g => {
        _showToast(`⚠ NAPAS [${g.filename}] nhóm ${g.groupIndex + 1} (${g.bankName}, TK ${g.accountNumber}): không tìm thấy file NHAN tương ứng.`, 'info');
      });
      pairing.orphanNhan.forEach(g => {
        _showToast(`⚠ NAPAS [${g.filename}] nhóm ${g.groupIndex + 1} (${g.bankName}, TK ${g.accountNumber}): không tìm thấy file CHUYEN tương ứng.`, 'info');
      });
      pairing.ambiguous.forEach(a => {
        _showToast(`⚠ NAPAS TK ${a.accountNumber} (${a.bankName}): không thể xác định cặp CHUYEN/NHAN duy nhất — có nhiều nhóm trùng định danh.`, 'info');
      });

      // Phase 8-11: transaction-level reconciliation WITHIN each matched
      // CHUYEN/NHAN pair (never across pairs/accounts/banks — see
      // docs/NAPAS_UPGRADE_SPEC.md Phase 8-11 status for the full research).
      // This toast stays as a quick heads-up at upload time; Phase 16-19
      // added the full detailed, per-transaction, audit-able view in the
      // "ĐỐI ỨNG TK" tab itself (_renderNapasReconciliationPanel) — the two
      // are complementary, not redundant: the toast is transient and fires
      // once per upload, the panel is persistent and inspectable any time.
      if (pairing.matchedPairs.length > 0) {
        const recon = BankParser.reconcileAllPairs(fileResults, pairing);
        let matched = 0, unmatchedC = 0, unmatchedN = 0, ambiguous = 0;
        for (const { reconciliation: r } of recon) {
          matched += r.matched.length;
          unmatchedC += r.unmatchedChuyen.length;
          unmatchedN += r.unmatchedNhan.length;
          ambiguous += r.ambiguousChuyen.length + r.ambiguousNhan.length;
        }
        _showToast(
          `ℹ NAPAS đối soát cấp giao dịch (${recon.length} cặp nhóm): ` +
          `${matched} khớp · ${unmatchedC} CHUYEN chưa khớp · ${unmatchedN} NHAN chưa khớp` +
          (ambiguous > 0 ? ` · ${ambiguous} chưa rõ` : ''),
          'info'
        );
      }
    }

    // Stamp sourceFilename on each transaction so the account grouping layer
    // can link transactions back to their originating file (Sheet 9 / RULE 5).
    const stampedTransactions = [];
    for (const fr of fileResults) {
      for (const tx of fr.transactions) {
        stampedTransactions.push({ ...tx, sourceFilename: fr.filename });
      }
    }

    flaRenderFileList(uploadedFiles);
    flaPipelineStatus(`✓ Đọc ${stampedTransactions.length} GD từ ${files.length} file — Đang tạo vụ án...`);
    await new Promise(r => requestAnimationFrame(r));

    // Phase 4: Create isolated case
    const caseId = InvestigationCaseEngine.createCase(
      uploadedFiles,
      `Vụ ${files.map(f => f.name.replace(/\.xlsx?$/i,'')).join(' + ')}`
    );
    _flaActiveCaseId = caseId;
    InvestigationCaseEngine.setActiveCase(caseId);
    InvestigationCaseEngine.setProcessing(caseId);

    flaRunPipeline(stampedTransactions, uploadedFiles);

    // Refresh case management list if open
    if (document.getElementById('cases-screen')?.style.display !== 'none') {
      casesRenderList();
    }

  } catch (err) {
    console.error('[FLA]', err);
    _showToast(`Lỗi xử lý: ${err.message}`, 'error');
    flaPipelineStatus(`✗ Lỗi: ${err.message}`);
  } finally {
    hideProcessing();
  }
}

function flaRunPipeline(rawTransactions, uploadedFiles) {
  // ── Step 1: NLP v3 (canonical taxonomy + fraud language + contradiction) ─────
  flaPipelineStatus('🧠 NLP v3: phân loại chuẩn hoá + phát hiện ngôn ngữ bất thường...');
  let txs = NLPEngine.processAll(rawTransactions);

  // ── Step 2: Behavioral tagging ───────────────────────────────────────────────
  flaPipelineStatus('🏷 Auto-tagging: gán nhãn hành vi...');
  txs = TaggingEngine.tagAll(txs);

  // ── Step 3: Graph v3 (Louvain + deterministic temporal edges + entropy) ──────
  flaPipelineStatus('🔗 Graph v3: Louvain clustering + temporal weights (deterministic)...');
  _flaGraphResult = GraphEngine.analyze(txs);

  // ── Step 4: Fraud scoring (intermediate — 4-layer raw scores) ────────────────
  flaPipelineStatus('⚠ Fraud Engine: chấm điểm thô 4 tầng...');
  const { scoredTransactions: rawScored, accountScores: rawAccountScores } =
    FraudEngine.scoreAllTransactions(txs, _flaGraphResult);

  // ── Step 5: Risk Calibration (Phase 3 NEW) ───────────────────────────────────
  // Replaces fixed 0.4/0.3/0.3 with confidence-weighted dynamic combination.
  flaPipelineStatus('⚖ Calibration Engine: chuẩn hoá điểm theo không gian xác suất...');
  const {
    calibratedTransactions,
    calibratedAccountScores,
    calibrationMeta,
  } = RiskCalibrationEngine.calibrateAll(rawScored, rawAccountScores, _flaGraphResult);
  _flaAccountScores   = calibratedAccountScores;
  _flaCalibrationMeta = calibrationMeta;

  // ── Step 6: Risk propagation (uses calibrated scores) ────────────────────────
  flaPipelineStatus('🔄 Risk propagation: lan truyền điểm rủi ro hiệu chỉnh...');
  GraphEngine.applyRiskPropagation(_flaGraphResult);

  // ── Step 6b: Phone Top-up Intelligence ────────────────────────────────────────
  flaPipelineStatus('📱 Phone Topup Engine: phân tích nạp tiền điện thoại...');
  if (typeof PhoneTopupEngine !== 'undefined') {
    _flaTopupResult = PhoneTopupEngine.analyze(calibratedTransactions);
    if (_flaTopupResult.totalTopupCount > 0) {
      GraphEngine.injectPhoneNodes(_flaGraphResult, _flaTopupResult);
    }
  }

  // ── Step 7: Governance audit snapshots (Phase 3 NEW) ─────────────────────────
  flaPipelineStatus('📌 Governance: tạo audit trail cho từng tài khoản...');
  _flaAuditStore = FraudGovernanceLayer.processAll(
    calibratedAccountScores, calibratedTransactions, _flaGraphResult
  );

  // ── Step 8: Investigation report (v3 — with proof integrity) ─────────────────
  flaPipelineStatus('📋 Investigation Engine: tạo báo cáo forensic với kiểm tra bằng chứng...');
  _flaInvestigReport = InvestigationReportEngine.generateReport(
    calibratedTransactions, _flaGraphResult, calibratedAccountScores
  );

  // ── Step 9: System Observability (Phase 3 NEW) ───────────────────────────────
  flaPipelineStatus('📊 Observability: ghi nhận chỉ số sức khoẻ hệ thống...');
  _flaObsMetrics = SystemObservabilityEngine.recordRun(
    calibratedTransactions, _flaGraphResult, calibratedAccountScores, calibrationMeta
  );

  // ── Step 10: Forensic Snapshot (Phase 4 NEW) ──────────────────────────────────
  flaPipelineStatus('📸 Snapshot Engine: tạo dấu ấn pháp lý...');
  const forensicSnapshot = ForensicSnapshotEngine.createSnapshot(
    _flaActiveCaseId || 'STANDALONE',
    { files: uploadedFiles || [], transactions: calibratedTransactions,
      graphResult: _flaGraphResult, accountScores: calibratedAccountScores,
      calibrationMeta }
  );

  // ── Step 11: SOC Incident Generation (Phase 4 NEW) ───────────────────────────
  flaPipelineStatus('🚨 SOC Incident Engine: tạo sự cố tự động...');
  const incidents = SOCIncidentEngine.generateIncidents(
    _flaActiveCaseId || 'STANDALONE',
    calibratedTransactions, calibratedAccountScores, _flaGraphResult
  );

  // ── Step 12: Cross-case Drift Detection (Phase 4 NEW) ────────────────────────
  flaPipelineStatus('📉 Drift Protection: kiểm tra trôi dạt thống kê...');
  const caseStats  = CaseDriftProtection.extractStats(
    _flaActiveCaseId || '', calibratedTransactions, calibratedAccountScores, _flaGraphResult
  );
  CaseDriftProtection.recordCase(caseStats);
  const driftResult = CaseDriftProtection.detectDrift(caseStats);

  // ── Step 13: System Validation (Phase 4 NEW) ──────────────────────────────────
  flaPipelineStatus('✅ Validation Engine: xác minh tính toàn vẹn hệ thống...');
  const caseDataForValidation = {
    caseId:       _flaActiveCaseId || 'STANDALONE',
    transactions: calibratedTransactions,
    accountScores: calibratedAccountScores,
    graphResult:  _flaGraphResult,
    auditStore:   _flaAuditStore,
    incidents,
  };
  const validationResult = SystemValidationEngine.runValidation(caseDataForValidation, forensicSnapshot);

  // ── Step 14: Store in Case Engine (Phase 4 NEW) ───────────────────────────────
  if (_flaActiveCaseId) {
    try {
      InvestigationCaseEngine.storeAnalysis(_flaActiveCaseId, {
        transactions:    calibratedTransactions,
        accountScores:   calibratedAccountScores,
        graphResult:     _flaGraphResult,
        investigReport:  _flaInvestigReport,
        auditStore:      _flaAuditStore,
        calibrationMeta,
        obsMetrics:      _flaObsMetrics,
        incidents,
        snapshot:        forensicSnapshot,
        validationResult,
        driftResult,
      });
      InvestigationCaseEngine.setReportGenerated(_flaActiveCaseId);
    } catch (caseErr) {
      console.warn('[CaseEngine]', caseErr.message);
    }
  }

  const critCount = Object.values(calibratedAccountScores).filter(a => a.riskLevel === 'CRITICAL').length;
  const stability = _flaObsMetrics?.stabilityIndex ?? 100;
  const confAvg   = calibrationMeta?.avgConfidence ?? 0;
  const integrity = validationResult?.overallIntegrity ?? '—';
  flaPipelineStatus(
    `✓ Hoàn tất: ${calibratedTransactions.length} GD | ${_flaGraphResult.stats.nodeCount} nút | ` +
    `${critCount} CRITICAL | ${incidents.length} sự cố | Tin cậy ${confAvg}% | ${integrity}`
  );

  _flaUploadedFiles = uploadedFiles || [];
  flaLoadData(calibratedTransactions);
}

function flaPipelineStatus(msg) {
  const el = document.getElementById('fla-pipeline-status');
  if (!el) return;
  el.style.display = 'block';
  el.textContent = msg;
}

function flaRenderFileList(files) {
  _flaUploadedFiles = files;
  const el = document.getElementById('fla-file-list');
  if (!el) return;
  const bankColors = {
    BIDV: '#0066cc', Vietcombank: '#009944', Techcombank: '#e30613',
    Vietinbank: '#0066b3', VPBank: '#006db7', Eximbank: '#003087',
    Agribank: '#d32f2f', 'MB Bank': '#1a3a6b', Sacombank: '#c8960c',
    Unknown: '#64748b', Demo: '#00f0ff',
  };
  el.style.display = 'block';
  el.innerHTML = files.map(f => {
    const color = bankColors[f.bankName] || '#64748b';
    const errMsg = f.error ? ` ⚠ ${f.error.slice(0,30)}` : '';
    return `<div class="fla-file-item">
      <span class="file-bank-badge" style="background:${color}20;border:1px solid ${color};color:${color};">${f.bankName}</span>
      <span class="file-name" title="${f.name}">${f.name}</span>
      <span class="file-count">${f.txCount}gd${errMsg}</span>
    </div>`;
  }).join('');
}

// Post-Phase-25 fix — Refresh button: resets the FLA module (including its
// NAPAS sub-panel, which shares this same state) back to its pre-upload
// state, so the next file selection starts as a genuinely fresh session.
//
// Design: reset every FLA global (data, results, active case pointer), then
// call flaLoadData([]) to reuse the EXISTING, already-tested render pipeline
// to correctly re-render every tab that renders directly off `data` or off
// a global this function already zeroed (fraud/NLP/tags/account-flow/NAPAS-
// panel/fintech/export-preview) — no logic duplicated. The remaining tabs
// (graph/investigation/topup/system-health) are gated behind an
// `if (_flaXxxResult)` guard inside flaLoadData, so nulling those globals
// makes flaLoadData skip re-rendering them entirely — cleared explicitly
// below instead, so no stale content from the previous session can be seen
// by clicking into one of those tabs before the next upload.
//
// Deliberately NOT touched: InvestigationCaseEngine's stored case history
// (persistent data the user may want to look up later — only the ACTIVE
// case pointer is cleared), NAPAS parsing/reconciliation logic, and any
// app configuration/runtime settings.
function _flaResetSession() {
  if (!confirm('Làm mới phiên FLA hiện tại? Toàn bộ dữ liệu đã xử lý (giao dịch, đối soát NAPAS, kết quả phân tích) sẽ bị xóa khỏi màn hình.')) return;

  // ── D3 / Chart.js instances must be explicitly stopped/destroyed before
  //    their backing data is discarded (same pattern as CDRAnalyzer.clearAll). ──
  if (_flaD3Simulation) { _flaD3Simulation.stop(); _flaD3Simulation = null; }
  Object.values(_flaCharts || {}).forEach(c => { try { c.destroy(); } catch (_) {} });
  _flaCharts = {};

  // ── Global FLA state (incl. NAPAS — _flaNapasFileResults is FLA-scoped) ──
  _flaGraphResult      = null;
  _flaAccountScores    = {};
  _flaUploadedFiles    = [];
  _flaInvestigReport   = null;
  _flaAuditStore       = {};
  _flaCalibrationMeta  = {};
  _flaObsMetrics       = null;
  _flaTopupResult      = null;
  _flaNapasFileResults = [];
  _flaActiveCaseId     = null; // only the ACTIVE pointer — stored case history is untouched

  // ── Upload area back to "ready for new files" ────────────────────────────
  const fileInput = document.getElementById('fla-file-input');
  if (fileInput) fileInput.value = '';
  const fileListEl = document.getElementById('fla-file-list');
  if (fileListEl) { fileListEl.innerHTML = ''; fileListEl.style.display = 'none'; }
  const pipelineStatusEl = document.getElementById('fla-pipeline-status');
  if (pipelineStatusEl) { pipelineStatusEl.textContent = ''; pipelineStatusEl.style.display = 'none'; }

  // ── NAPAS reconciliation panel (also reset by _renderNapasReconciliationPanel
  //    itself once _flaNapasFileResults is empty, but hide it immediately too) ──
  const napasPanelEl = document.getElementById('fla-napas-recon-panel');
  if (napasPanelEl) { napasPanelEl.innerHTML = ''; napasPanelEl.style.display = 'none'; }

  // ── Export bar / preview back to pre-upload state ────────────────────────
  const exportBar = document.getElementById('fla-export-bar');
  if (exportBar) exportBar.classList.remove('visible');
  const exportPreview = document.getElementById('fla-export-preview');
  if (exportPreview) exportPreview.style.display = 'none';

  // ── Guard-gated tabs that flaLoadData([]) will NOT re-render on its own
  //    (see comment above) — clear their visible content explicitly. ───────
  const graphSvg = document.getElementById('fla-graph-svg');
  if (graphSvg) graphSvg.innerHTML = '';
  ['graph-stat-nodes', 'graph-stat-edges', 'graph-stat-communities', 'graph-stat-hubs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = el.textContent.replace(/:\s*\d+/, ': 0');
  });
  const hubListEl = document.getElementById('graph-hub-list');
  if (hubListEl) hubListEl.innerHTML = '';

  ['inv-critical', 'inv-high', 'inv-anomaly', 'inv-chains', 'inv-fraud-lang'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0';
  });
  const invAccList = document.getElementById('inv-account-list');
  if (invAccList) invAccList.innerHTML = '';
  const invChainList = document.getElementById('inv-chain-list');
  if (invChainList) invChainList.innerHTML = '';

  const healthPanel = document.getElementById('fla-health-panel');
  if (healthPanel) healthPanel.style.display = 'none';

  ['topup-stat-phones', 'topup-stat-count', 'topup-stat-highrisk'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0';
  });
  const topupBody = document.getElementById('topup-leaderboard-body');
  if (topupBody) topupBody.innerHTML = '';

  // ── Reset active tab back to "01 GIAO DỊCH" (the default on first load) ──
  document.querySelector('.fla-tab[data-tab="transactions"]')?.click();

  // ── Reuse the existing, already-tested render pipeline for an empty
  //    dataset — correctly clears the transaction table, fraud/NLP/tags
  //    panels, account-flow + NAPAS panel, and fintech tab in one pass. ────
  flaLoadData([]);

  _showToast('✓ Đã làm mới phiên FLA — sẵn sàng nạp sao kê mới.', 'success');
}

/* ── FLA Filter / Search / Sort / Paginate / AI Render ──────────────────────── */
const _flaState = { data: [], filtered: [], sortKey: null, sortDir: 1, page: 0, pageSize: 2000 };

function flaLoadData(data) {
  _flaState.data    = data;
  _flaState.sortKey = null;
  _flaState.sortDir = 1;

  const bankSel = document.getElementById('fla-filter-bank');
  const banks = [...new Set(data.map(d => d.bank || d.bankName))];
  if (bankSel) bankSel.innerHTML = '<option value="all">Tất cả ngân hàng</option>' +
    banks.map(b => `<option value="${b}">${b}</option>`).join('');

  const advEl = document.getElementById('fla-adv-filters');
  if (advEl) advEl.style.display = 'block';
  const filterSel = document.getElementById('fla-filter-select');
  if (filterSel) filterSel.disabled = false;

  // Hiện nút xuất file standalone (luôn có thể bấm)
  const exportBar = document.getElementById('fla-export-bar');
  if (exportBar) exportBar.classList.add('visible');
  const exportInfo = document.getElementById('fla-export-info');
  if (exportInfo) exportInfo.textContent = `${data.length} giao dịch · 3 sheet · Đối Ứng TK · Nạp Tiền ĐT · Ví Điện Tử`;

  ['fla-search','fla-filter-select','fla-filter-bank','fla-amount-min','fla-amount-max','fla-hour-from','fla-hour-to','fla-filter-tag'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.oninput = flaApplyFilters; el.onchange = flaApplyFilters; }
  });

  document.querySelectorAll('#fla-screen .sortable-th').forEach(th => {
    th.onclick = () => {
      const key = th.dataset.sortKey;
      _flaState.sortDir = _flaState.sortKey === key ? _flaState.sortDir * -1 : 1;
      _flaState.sortKey = key;
      document.querySelectorAll('#fla-screen .sortable-th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(_flaState.sortDir === 1 ? 'sort-asc' : 'sort-desc');
      flaApplyFilters();
    };
  });

  const prevBtn = document.getElementById('fla-prev');
  const nextBtn = document.getElementById('fla-next');
  if (prevBtn) prevBtn.onclick = () => { _flaState.page--; flaRenderPage(); };
  if (nextBtn) nextBtn.onclick = () => { _flaState.page++; flaRenderPage(); };

  flaApplyFilters();

  // Render AI panels (always on full data, not filtered)
  requestAnimationFrame(() => {
    flaUpdateStats(data);
    flaRenderFraudTable(_flaAccountScores);
    flaRenderNLPPanel(data);
    flaRenderTagsPanel(data);
    if (_flaGraphResult) {
      flaUpdateGraphStats(_flaGraphResult);
      const graphPlaceholder = document.getElementById('fla-graph-placeholder');
      if (graphPlaceholder) graphPlaceholder.style.display = 'flex';
    }
    if (_flaInvestigReport) {
      flaRenderInvestigationTab(_flaInvestigReport);
    }
    // Phase 3: System Health panel
    if (_flaObsMetrics) {
      flaRenderSystemHealth(_flaObsMetrics, _flaCalibrationMeta);
    }
    // Account-centric export preview
    flaRenderExportPreview();
    // Phone top-up intelligence tab
    if (_flaTopupResult) flaRenderTopupTab(_flaTopupResult);
    // Intelligence tabs: Đối Ứng TK + Ví Điện Tử
    _renderAccountFlowTab(data);
    _renderNapasReconciliationPanel(); // Phase 16-19 — reads _flaNapasFileResults directly
    _renderFintechTab(data);
  });
}

function flaApplyFilters() {
  const search     = (document.getElementById('fla-search')?.value || '').toLowerCase().trim();
  const filterType = document.getElementById('fla-filter-select')?.value || 'all';
  const bank       = document.getElementById('fla-filter-bank')?.value || 'all';
  const tagFilter  = document.getElementById('fla-filter-tag')?.value || 'all';
  const amtMinRaw  = document.getElementById('fla-amount-min')?.value;
  const amtMaxRaw  = document.getElementById('fla-amount-max')?.value;
  const amtMin     = amtMinRaw !== '' && amtMinRaw != null ? parseFloat(amtMinRaw) * 1_000_000 : 0;
  const amtMax     = amtMaxRaw !== '' && amtMaxRaw != null ? parseFloat(amtMaxRaw) * 1_000_000 : Infinity;
  const hrFromRaw  = document.getElementById('fla-hour-from')?.value;
  const hrToRaw    = document.getElementById('fla-hour-to')?.value;
  const hrFrom     = hrFromRaw !== '' && hrFromRaw != null ? parseInt(hrFromRaw) : 0;
  const hrTo       = hrToRaw  !== '' && hrToRaw  != null ? parseInt(hrToRaw)  : 23;

  let result = _flaState.data.filter(d => {
    const bankName = d.bank || d.bankName || '';
    const desc = `${d.content || ''} ${d.description || ''} ${bankName} ${d.code || ''} ${d.flag || ''} ${d.date || ''}`.toLowerCase();
    if (search && !desc.includes(search)) return false;
    if (filterType === 'anomaly' && (d.flag === 'N/A' || !d.flag)) return false;
    if (filterType === 'large'   && d.amount < 150_000_000) return false;
    if (filterType === 'risk'    && (d.fraudScore || 0) < 50) return false;
    if (filterType === 'in'      && d.transactionType !== 'IN') return false;
    if (filterType === 'out'     && d.transactionType !== 'OUT') return false;
    if (bank !== 'all' && bankName !== bank) return false;
    if (tagFilter !== 'all' && !(d.tags || []).includes(tagFilter)) return false;
    if (d.amount < amtMin || d.amount > amtMax) return false;
    const dateStr = d.transactionDate || d.date || '';
    const m = dateStr.match(/[T\s](\d{2}):/);
    if (m) { const hr = parseInt(m[1]); if (hr < hrFrom || hr > hrTo) return false; }
    return true;
  });

  if (_flaState.sortKey) {
    const { sortKey: k, sortDir: dir } = _flaState;
    result.sort((a, b) => {
      let va = a[k] ?? '', vb = b[k] ?? '';
      if (k === 'amount' || k === 'fraudScore') { va = +va; vb = +vb; }
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }

  _flaState.filtered = result;
  _flaState.page = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    flaRenderPage();
    renderFlaCharts(result.length > 0 ? result : _flaState.data);
    flaRenderTagsTable(result.length > 0 ? result : _flaState.data);
  }));
}

const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const RISK_COLORS = { CRITICAL: '#ff3b30', HIGH: '#ff8800', MEDIUM: '#ffcc00', LOW: '#00f0ff' };
const INTENT_COLORS = {
  salary: '#00f0ff', gambling: '#ff3b30', loan: '#ff8800', investment: '#4ade80',
  payment: '#a78bfa', cash: '#fb923c', business: '#60a5fa', transfer: '#94a3b8', unknown: '#475569',
};

function flaRenderPage() {
  const { filtered, pageSize } = _flaState;
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  _flaState.page   = Math.min(_flaState.page, totalPages - 1);
  const start      = _flaState.page * pageSize;
  const rows       = filtered.slice(start, start + pageSize);

  const htmlRows = rows.map(item => {
    const amtColor  = item.amount >= 500_000_000 ? '#ff3b30' : item.amount >= 150_000_000 ? '#ff8800' : 'var(--text-primary)';
    const hasFlag   = item.flag && item.flag !== 'N/A';
    const typeColor = item.transactionType === 'IN' ? '#4ade80' : item.transactionType === 'OUT' ? '#f87171' : '#64748b';
    const typeLabel = item.transactionType === 'IN' ? '▲ VÀO' : item.transactionType === 'OUT' ? '▼ RA' : '—';

    return `<td style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-secondary);">${item.transactionDate || item.date || ''}</td>` +
      `<td style="font-size:0.75rem;"><strong>${item.bankName || item.bank || ''}</strong></td>` +
      `<td style="font-family:var(--font-mono);font-size:0.62rem;color:#94a3b8;">${item.accountNumber || '—'}</td>` +
      `<td style="font-family:var(--font-mono);font-size:0.62rem;color:#cbd5e1;">${item.counterpartyAccount || '—'}</td>` +
      `<td style="text-align:center;font-family:var(--font-mono);font-size:0.6rem;font-weight:700;color:${typeColor};">${typeLabel}</td>` +
      `<td style="font-family:var(--font-mono);font-weight:700;font-size:0.75rem;color:${amtColor};text-align:right;">${VND.format(item.amount)}</td>` +
      `<td><span class="${hasFlag ? 'badge danger' : 'badge cyan'}" style="font-size:0.6rem;">${hasFlag ? item.flag : 'Bình thường'}</span></td>` +
      `<td style="font-size:0.7rem;color:var(--text-secondary);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(item.description||item.content||'').replace(/"/g,"'")}">${item.description || item.content || ''}</td>`;
  });
  _flaVT.load(htmlRows, `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);font-family:var(--font-mono);padding:30px;">KHÔNG CÓ KẾT QUẢ PHÙ HỢP</td></tr>`);

  const pag = document.getElementById('fla-pagination');
  if (pag) {
    pag.style.display = 'flex';
    const pi = document.getElementById('fla-page-info');
    const rc = document.getElementById('fla-record-count');
    if (pi) pi.innerText = `${_flaState.page + 1} / ${totalPages}`;
    if (rc) rc.innerText = `${total} giao dịch`;
    const prevBtn = document.getElementById('fla-prev');
    const nextBtn = document.getElementById('fla-next');
    if (prevBtn) prevBtn.disabled = _flaState.page === 0;
    if (nextBtn) nextBtn.disabled = _flaState.page >= totalPages - 1;
  }
}

function flaUpdateStats(data) {
  const totalIn      = data.filter(d => d.transactionType === 'IN').reduce((s, d) => s + d.amount, 0);
  const totalAnomaly = data.filter(d => d.flag && d.flag !== 'N/A').length;
  const riskAccounts = Object.values(_flaAccountScores).filter(a => a.score >= 50).length;
  const graphNodes   = _flaGraphResult ? _flaGraphResult.stats.nodeCount : 0;
  const el = id => document.getElementById(id);
  if (el('stat-total-flow'))    el('stat-total-flow').innerText    = `${data.length} gd`;
  if (el('stat-total-inflow'))  el('stat-total-inflow').innerText  = (totalIn / 1_000_000).toFixed(0) + ' tr';
  if (el('stat-total-anomaly')) el('stat-total-anomaly').innerText = `${totalAnomaly} gd`;
  if (el('stat-risk-accounts')) el('stat-risk-accounts').innerText = `${riskAccounts}`;
  if (el('stat-graph-nodes'))   el('stat-graph-nodes').innerText   = `${graphNodes}`;
  // v2: Update investigation summary bar (if already rendered)
  if (_flaInvestigReport) {
    const sm = _flaInvestigReport.summary;
    const is = id => document.getElementById(id);
    if (is('inv-critical'))   is('inv-critical').textContent   = sm.criticalCount;
    if (is('inv-high'))       is('inv-high').textContent       = sm.highRiskCount;
    if (is('inv-anomaly'))    is('inv-anomaly').textContent    = sm.anomalyCount;
    if (is('inv-chains'))     is('inv-chains').textContent     = sm.launderingChains;
    if (is('inv-fraud-lang')) is('inv-fraud-lang').textContent = sm.fraudLanguageCount;
  }
}

/* ── FRAUD TABLE RENDER ───────────────────────────────────────────────────────── */

function flaRenderFraudTable(accountScores) {
  const tbody = document.getElementById('fla-fraud-body');
  if (!tbody) return;
  const leaderboard = FraudEngine.buildRiskLeaderboard(accountScores);
  if (leaderboard.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:30px;font-family:var(--font-mono);">CHƯA CÓ DỮ LIỆU</td></tr>';
    return;
  }
  const RISK_BG = { CRITICAL: 'rgba(255,59,48,0.1)', HIGH: 'rgba(255,136,0,0.08)', MEDIUM: 'rgba(255,204,0,0.06)', LOW: 'rgba(0,240,255,0.04)' };
  tbody.innerHTML = leaderboard.map(entry => {
    const rc = RISK_COLORS[entry.riskLevel] || '#94a3b8';
    const bg = RISK_BG[entry.riskLevel] || '';
    const bar = `<div class="risk-bar"><div class="risk-bar-fill" style="width:${entry.score}%;background:${rc};"></div></div>`;
    const reasons = (entry.reasons || []).slice(0,3).map(r =>
      `<span class="tag-chip ${entry.riskLevel === 'CRITICAL' || entry.riskLevel === 'HIGH' ? 'danger' : ''}">${r}</span>`).join('');
    const vol = (entry.totalVolume / 1_000_000).toFixed(0) + ' tr';
    return `<tr style="background:${bg};">
      <td style="font-family:var(--font-mono);color:var(--text-muted);">${entry.rank}</td>
      <td style="font-family:var(--font-mono);font-size:0.78rem;color:${rc};font-weight:700;">${entry.account}</td>
      <td style="font-size:0.75rem;">${_flaAccountBankName(entry.account)}</td>
      <td style="font-family:var(--font-mono);">${entry.score}${bar}</td>
      <td><span style="font-weight:700;color:${rc};font-family:var(--font-mono);font-size:0.75rem;">${entry.riskLevel}</span></td>
      <td style="font-family:var(--font-mono);">${entry.txCount}</td>
      <td style="font-family:var(--font-mono);font-size:0.75rem;">${vol}</td>
      <td>${reasons}</td>
    </tr>`;
  }).join('');
}

/* ── INVESTIGATION TAB RENDER ────────────────────────────────────────────────── */

function flaRenderInvestigationTab(report) {
  if (!report) return;
  const { summary, suspiciousAccountReports, riskChains, anomalyTimeline } = report;

  // Update header timestamp
  const genEl = document.getElementById('inv-generated-at');
  if (genEl) genEl.textContent = summary.generatedAt;

  // Update summary stats
  const s = id => document.getElementById(id);
  if (s('inv-critical'))   s('inv-critical').textContent   = summary.criticalCount;
  if (s('inv-high'))       s('inv-high').textContent       = summary.highRiskCount;
  if (s('inv-anomaly'))    s('inv-anomaly').textContent    = summary.anomalyCount;
  if (s('inv-chains'))     s('inv-chains').textContent     = summary.launderingChains;
  if (s('inv-fraud-lang')) s('inv-fraud-lang').textContent = summary.fraudLanguageCount;

  // Account list
  const accListEl = document.getElementById('inv-account-list');
  if (accListEl) {
    if (suspiciousAccountReports.length === 0) {
      accListEl.innerHTML = '<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.7rem;">Không phát hiện tài khoản đáng ngờ</div>';
    } else {
      accListEl.innerHTML = suspiciousAccountReports.map(acct => {
        const rc    = RISK_COLORS[acct.riskLevel] || '#94a3b8';
        const rlCls = acct.riskLevel.toLowerCase();
        return `<div class="inv-account-item ${rlCls}" onclick="flaShowAccountDetail('${acct.account}')" data-account="${acct.account}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="color:${rc};font-weight:700;font-size:0.72rem;">${acct.account}</span>
            <span class="inv-account-score" style="color:${rc};">${acct.score}</span>
          </div>
          <div style="color:var(--text-muted);font-size:0.6rem;margin-top:2px;">
            ${_flaAccountBankName(acct.account)||'—'} · ${acct.txCount}GD · ${(acct.totalVolume/1e6).toFixed(0)}M VND
          </div>
          <div style="font-size:0.6rem;color:${rc};margin-top:1px;">${acct.riskLevel}</div>
        </div>`;
      }).join('');
    }
  }

  // Risk chains
  const chainListEl = document.getElementById('inv-chain-list');
  if (chainListEl) {
    if (riskChains.length === 0) {
      chainListEl.innerHTML = '<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.7rem;">Không phát hiện chuỗi đáng ngờ</div>';
    } else {
      chainListEl.innerHTML = riskChains.map((c, i) => `<div class="inv-chain-item">
        <span style="color:#ff8800;font-weight:700;">C${i+1}</span>
        ${c.isLayering ? '<span style="color:#ff3b30;margin-left:4px;">[PHÂN TẦNG]</span>' : ''}
        ${c.isRapid ? '<span style="color:#ffcc00;margin-left:4px;">[RAPID]</span>' : ''}
        <br>${c.pathDisplay}
        <br><span style="color:var(--text-muted);">${c.volumeFmt} · ${c.hops} bước · Score:${c.suspicionScore}</span>
      </div>`).join('');
    }
  }

  // Timeline
  const timelineEl = document.getElementById('inv-timeline');
  if (timelineEl) {
    if (anomalyTimeline.length === 0) {
      timelineEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.7rem;">Không có sự kiện bất thường</div>';
    } else {
      timelineEl.innerHTML = anomalyTimeline.slice(0, 30).map(evt => {
        const rlCls = (evt.riskLevel || 'medium').toLowerCase();
        const typeColor = evt.type === 'IN' ? '#4ade80' : '#fb923c';
        return `<div class="inv-timeline-item ${rlCls}">
          <span style="color:var(--text-muted);">${evt.date.slice(0,16)}</span>
          <span style="color:${typeColor};margin-left:4px;">${evt.type}</span>
          <span style="font-weight:700;margin-left:4px;">${(evt.amount/1e6).toFixed(0)}M</span>
          <span style="color:var(--text-muted);margin-left:4px;">${evt.account.slice(0,10)}</span>
          ${evt.hasFraudLang ? '<span style="color:#ff3b30;margin-left:4px;">⚠FL</span>' : ''}
          <br><span style="color:var(--text-muted);font-size:0.6rem;">${evt.description}</span>
        </div>`;
      }).join('');
    }
  }

  // Auto-select top account for detail view
  if (suspiciousAccountReports.length > 0) {
    flaShowAccountDetail(suspiciousAccountReports[0].account);
  }
}

/** Show detailed narrative + evidence for a clicked account */
function flaShowAccountDetail(accountId) {
  if (!_flaInvestigReport) return;
  const acct = _flaInvestigReport.suspiciousAccountReports.find(a => a.account === accountId);
  if (!acct) return;

  // Highlight selected
  document.querySelectorAll('.inv-account-item').forEach(el => {
    el.classList.toggle('active', el.dataset.account === accountId);
  });
  const selEl = document.getElementById('inv-selected-account');
  if (selEl) selEl.textContent = `(${accountId})`;

  const detail = document.getElementById('inv-detail-panel');
  if (!detail) return;
  const rc = RISK_COLORS[acct.riskLevel] || '#94a3b8';

  // Breakdown bar
  const bd = acct.breakdown || {};
  const breakdownHtml = bd.txScore != null
    ? `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:8px;font-size:0.6rem;">
        <div style="text-align:center;"><div style="color:#00f0ff;font-weight:700;">${bd.txScore}</div><div style="color:var(--text-muted);">TX</div></div>
        <div style="text-align:center;"><div style="color:#ff8800;font-weight:700;">${bd.graphScore}</div><div style="color:var(--text-muted);">GRAPH</div></div>
        <div style="text-align:center;"><div style="color:#ffcc00;font-weight:700;">${bd.behavioralScore}</div><div style="color:var(--text-muted);">BEHAVIOR</div></div>
        <div style="text-align:center;"><div style="color:#ff3b30;font-weight:700;">+${bd.burstScore}</div><div style="color:var(--text-muted);">BURST</div></div>
      </div>` : '';

  // Evidence
  const ev = acct.evidence || {};
  const txEvidHtml = (ev.txEvidence || []).slice(0, 4).map(t =>
    `<div class="inv-evidence-item"><span style="color:#00f0ff;">${t.txId.slice(0,12)}</span> ${t.date} · ${(t.amount/1e6).toFixed(0)}M · Score:${t.fraudScore}<br><span style="color:var(--text-muted);">${t.description}</span></div>`
  ).join('');

  const edgeEvidHtml = (ev.edgeEvidence || []).slice(0, 3).map(e =>
    `<div class="inv-evidence-item"><span style="color:#a78bfa;">${e.from.slice(0,8)}→${e.to.slice(0,8)}</span> · ${e.txCount}GD · ${e.volumeFmt} · TW:${e.temporalWeight}</div>`
  ).join('');

  const nlpEvidHtml = (ev.nlpEvidence || []).slice(0, 3).map(n =>
    `<div class="inv-evidence-item">${n.date} · ${n.nlpIntent}${n.fraudSignals.length ? ' · <span style="color:#ff3b30;">'+n.fraudSignals.join(', ')+'</span>' : ''}<br><span style="color:var(--text-muted);">${n.description}</span></div>`
  ).join('');

  detail.innerHTML = `
    <div style="font-weight:700;color:${rc};font-size:0.82rem;margin-bottom:6px;">${accountId} — ${acct.score}/100 [${acct.riskLevel}]</div>
    ${breakdownHtml}
    <div class="inv-narrative">${acct.narrative}</div>
    ${txEvidHtml || edgeEvidHtml || nlpEvidHtml ? `
    <div class="inv-evidence-section">
      ${txEvidHtml ? `<div class="inv-evidence-title">⊕ GIAO DỊCH BẰNG CHỨNG</div>${txEvidHtml}` : ''}
      ${edgeEvidHtml ? `<div class="inv-evidence-title" style="margin-top:6px;">⊕ CẠNH ĐỒ THỊ</div>${edgeEvidHtml}` : ''}
      ${nlpEvidHtml ? `<div class="inv-evidence-title" style="margin-top:6px;">⊕ TÍN HIỆU NLP</div>${nlpEvidHtml}` : ''}
    </div>` : ''}
  `;
}

/** Export investigation report as Sheet 7 in existing XLSX export */
function flaExportInvestigation() {
  if (!_flaInvestigReport) { alert('Chưa có báo cáo. Nạp dữ liệu trước.'); return; }
  if (typeof XLSX === 'undefined') { alert('XLSX chưa tải.'); return; }
  const wb   = XLSX.utils.book_new();
  const rows = InvestigationReportEngine.buildExcelSheet(_flaInvestigReport);
  const ws   = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '7. Bao Cao Dieu Tra');
  XLSX.writeFile(wb, `FLA_BaoCaoDieuTra_${new Date().toISOString().slice(0,10)}.xlsx`);
  _showToast('Đã xuất Báo Cáo Điều Tra', 'success');
}

/* ── SYSTEM HEALTH PANEL RENDER (Phase 3) ───────────────────────────────────── */

function flaRenderSystemHealth(obsMetrics, calibrationMeta) {
  if (!obsMetrics) return;

  const healthSummary = SystemObservabilityEngine.getHealthSummary();
  if (!healthSummary) return;

  const systemStatus = SystemObservabilityEngine.classifySystemHealth(healthSummary);

  // Status indicator in the pipeline status bar
  const statusEl = document.getElementById('fla-system-status');
  if (statusEl) {
    statusEl.style.color  = systemStatus.color;
    statusEl.textContent  = `● ${systemStatus.label}`;
    statusEl.title        = `Stability: ${healthSummary.stabilityIndex}% | Graph Entropy: ${healthSummary.graphEntropy} | NLP Conflicts: ${healthSummary.nlpContradictionRate}%`;
  }

  // Health panel metrics
  const el = id => document.getElementById(id);
  if (el('sh-stability'))    el('sh-stability').textContent    = `${healthSummary.stabilityIndex}%`;
  if (el('sh-entropy'))      el('sh-entropy').textContent      = healthSummary.graphEntropy?.toFixed(2) ?? '—';
  if (el('sh-conflict-rate'))el('sh-conflict-rate').textContent = `${healthSummary.nlpContradictionRate}%`;
  if (el('sh-alert-vol'))    el('sh-alert-vol').textContent    = healthSummary.fraudAlertVolume;
  if (el('sh-cal-conf'))     el('sh-cal-conf').textContent     = `${healthSummary.calibrationConfidence}%`;
  if (el('sh-engine-ver'))   el('sh-engine-ver').textContent   = FraudGovernanceLayer.ENGINE_VERSION;
  if (el('sh-version-hash')) el('sh-version-hash').textContent = FraudGovernanceLayer.VERSION_HASH.slice(-8);
  if (el('sh-conflicts'))    el('sh-conflicts').textContent    = calibrationMeta?.conflictsDetected ?? 0;
  if (el('sh-conflict-pct')) el('sh-conflict-pct').textContent = `${calibrationMeta?.conflictRate ?? 0}%`;

  // Drift alert
  const driftEl = document.getElementById('sh-drift-alert');
  if (driftEl) {
    driftEl.style.display = healthSummary.driftAlert ? 'block' : 'none';
  }

  // Score distribution sparkline (text-based)
  const dist = healthSummary.scoreDistribution || {};
  if (el('sh-score-dist')) {
    const levels = dist.levels || {};
    el('sh-score-dist').innerHTML =
      `<span style="color:#ff3b30">CRIT:${levels.CRITICAL||0}</span> ` +
      `<span style="color:#ff8800">HIGH:${levels.HIGH||0}</span> ` +
      `<span style="color:#ffcc00">MED:${levels.MEDIUM||0}</span> ` +
      `<span style="color:#4ade80">LOW:${levels.LOW||0}</span> ` +
      `<span style="color:var(--text-muted)">μ=${dist.mean||0} σ=${dist.std||0}</span>`;
  }

  // Show the health panel
  const panel = document.getElementById('fla-health-panel');
  if (panel) panel.style.display = 'block';
}

function _flaAccountBankName(accountId) {
  const tx = _flaState.data.find(t => t.accountNumber === accountId);
  return tx ? (tx.bankName || tx.bank || '') : '';
}

/* ── NLP PANEL RENDER ─────────────────────────────────────────────────────────── */

function flaRenderNLPPanel(transactions) {
  if (!transactions || transactions.length === 0) return;

  // Intent summary chart
  const intentSummary = NLPEngine.getIntentSummary(transactions);
  const intentLabels  = Object.keys(intentSummary).map(k => NLPEngine.getIntentLabel(k));
  const intentValues  = Object.values(intentSummary);
  const intentColors  = Object.keys(intentSummary).map(k => INTENT_COLORS[k] || '#94a3b8');

  renderNLPIntentChart(intentLabels, intentValues, intentColors);

  // Intent list
  const intentListEl = document.getElementById('nlp-intent-list');
  if (intentListEl) {
    const total = transactions.length;
    intentListEl.innerHTML = Object.entries(intentSummary)
      .sort((a,b) => b[1]-a[1])
      .map(([intent, count]) => {
        const pct = ((count/total)*100).toFixed(1);
        const color = INTENT_COLORS[intent] || '#94a3b8';
        return `<div style="display:flex;align-items:center;gap:8px;">
          <span style="color:${color};font-weight:700;min-width:70px;">${NLPEngine.getIntentLabel(intent)}</span>
          <div style="flex:1;height:4px;background:#1a1e28;border-radius:2px;">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:2px;"></div>
          </div>
          <span style="color:var(--text-muted);min-width:50px;text-align:right;">${count} (${pct}%)</span>
        </div>`;
      }).join('');
  }

  // Entity list (top unique entities)
  const entityListEl = document.getElementById('nlp-entity-list');
  if (entityListEl) {
    const allEntities = transactions.flatMap(t => t.nlpEntitiesRaw || []);
    const entityFreq  = {};
    allEntities.forEach(e => { const k = e.label; entityFreq[k] = (entityFreq[k] || 0) + 1; });
    const topEntities = Object.entries(entityFreq).sort((a,b) => b[1]-a[1]).slice(0, 30);
    entityListEl.innerHTML = topEntities.map(([label, count]) =>
      `<div>${label} <span style="color:var(--text-muted);">(×${count})</span></div>`
    ).join('') || '<div style="color:var(--text-muted);">Không tìm thấy thực thể</div>';
  }

  // Semantic groups
  const groupListEl = document.getElementById('nlp-group-list');
  if (groupListEl) {
    const groups = NLPEngine.groupSimilarTransactions(transactions, 0.4);
    const multiGroups = groups.filter(g => g.indices.length >= 2).slice(0, 10);
    groupListEl.innerHTML = multiGroups.map((g, i) =>
      `<div><span style="color:var(--accent-cyan);">G${i+1}</span> (${g.indices.length} gd) — ${(g.representativeDesc||'').slice(0,60)}</div>`
    ).join('') || '<div style="color:var(--text-muted);">Không đủ dữ liệu để nhóm</div>';
  }
}

function renderNLPIntentChart(labels, values, colors) {
  if (typeof Chart === 'undefined') return;
  const ctx = document.getElementById('chart-nlp-intent');
  if (!ctx) return;
  if (_flaCharts.nlpIntent) { try { _flaCharts.nlpIntent.destroy(); } catch(_) {} }
  _flaCharts.nlpIntent = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors.map(c => c + '99'), borderColor: colors, borderWidth: 1.5 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}` } } },
    },
  });
}

/* ── TAGS PANEL RENDER ───────────────────────────────────────────────────────── */

function flaRenderTagsPanel(transactions) {
  if (!transactions || transactions.length === 0) return;

  const tagSummary = TaggingEngine.getTagSummary(transactions);

  // Tags chart
  renderTagsChart(tagSummary.map(t => t.label), tagSummary.map(t => t.count), tagSummary);

  // Tags summary list
  const tagListEl = document.getElementById('tags-summary-list');
  if (tagListEl) {
    const max = tagSummary[0]?.count || 1;
    tagListEl.innerHTML = tagSummary.map(({ tag, count, label }) => {
      const isDanger = ['RISK_PATTERN','GAMBLING_SIGNAL','VERY_LARGE_AMOUNT','SMALL_SPLIT_TRANSFER','HIGH_FREQUENCY'].includes(tag);
      const color = isDanger ? '#ff3b30' : '#00f0ff';
      const pct = (count/max*100).toFixed(0);
      return `<div style="display:flex;align-items:center;gap:8px;">
        <span style="color:${color};min-width:180px;font-size:0.65rem;">${label}</span>
        <div style="flex:1;height:4px;background:#1a1e28;border-radius:2px;">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:2px;"></div>
        </div>
        <span style="color:var(--text-muted);min-width:30px;text-align:right;">${count}</span>
      </div>`;
    }).join('');
  }

  flaRenderTagsTable(transactions);
}

function flaRenderTagsTable(transactions) {
  const tbody = document.getElementById('fla-tags-body');
  if (!tbody) return;
  const rows = transactions.filter(t => t.tags && t.tags.length > 0).slice(0, 200);
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;font-family:var(--font-mono);">KHÔNG CÓ DỮ LIỆU</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(item => {
    const chips = (item.tags || []).map(tag => {
      const isDanger = tag.includes('RISK') || tag.includes('GAMBLING') || tag === 'VERY_LARGE_AMOUNT';
      const isWarn   = tag.includes('LARGE') || tag.includes('OFF_HOURS') || tag.includes('SPLIT');
      return `<span class="tag-chip ${isDanger ? 'danger' : isWarn ? 'warning' : ''}">${tag}</span>`;
    }).join('');
    const intentColor = INTENT_COLORS[item.nlpIntent] || '#94a3b8';
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:0.7rem;">${item.transactionDate || item.date || ''}</td>
      <td style="font-size:0.75rem;">${item.bankName || item.bank || ''}</td>
      <td style="font-family:var(--font-mono);font-size:0.75rem;">${VND.format(item.amount)}</td>
      <td style="max-width:200px;">${chips}</td>
      <td style="font-size:0.7rem;"><span style="color:${intentColor};font-family:var(--font-mono);">${item.nlpIntent || ''}</span></td>
      <td style="font-size:0.7rem;color:var(--text-secondary);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.description || item.content || ''}</td>
    </tr>`;
  }).join('');
}

function renderTagsChart(labels, values, tagSummary) {
  if (typeof Chart === 'undefined') return;
  const ctx = document.getElementById('chart-tags');
  if (!ctx) return;
  if (_flaCharts.tags) { try { _flaCharts.tags.destroy(); } catch(_) {} }
  const DANGER_TAGS  = new Set(['RISK_PATTERN','GAMBLING_SIGNAL','VERY_LARGE_AMOUNT','SMALL_SPLIT_TRANSFER','HIGH_FREQUENCY']);
  const WARNING_TAGS = new Set(['LARGE_AMOUNT','OFF_HOURS','HIGH_DAILY_FREQUENCY','CASH_WITHDRAWAL']);
  const colors = (tagSummary || []).map(t =>
    DANGER_TAGS.has(t.tag)  ? '#ff3b30' :
    WARNING_TAGS.has(t.tag) ? '#ff8800' : '#00f0ff'
  );
  _flaCharts.tags = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(l => l.length > 22 ? l.slice(0,20)+'…' : l),
      datasets: [{ data: values, backgroundColor: colors.map(c => c+'44'), borderColor: colors, borderWidth: 1, borderRadius: 2 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' } }, y: { grid: { display: false }, ticks: { font: { size: 9 } } } },
    },
  });
}

/* ── GRAPH STATS ─────────────────────────────────────────────────────────────── */

function flaUpdateGraphStats(graphResult) {
  const el = id => document.getElementById(id);
  if (el('graph-stat-nodes'))       el('graph-stat-nodes').textContent       = `NODES: ${graphResult.stats.nodeCount}`;
  if (el('graph-stat-edges'))       el('graph-stat-edges').textContent       = `EDGES: ${graphResult.stats.edgeCount}`;
  if (el('graph-stat-communities')) el('graph-stat-communities').textContent = `COMMUNITIES: ${graphResult.stats.communityCount}`;
  if (el('graph-stat-hubs'))        el('graph-stat-hubs').textContent        = `HUBS: ${graphResult.stats.hubCount}`;

  // Hub list
  const hubListEl = document.getElementById('graph-hub-list');
  if (hubListEl && graphResult.hubs.length > 0) {
    hubListEl.innerHTML = graphResult.hubs.slice(0, 8).map(h => {
      const score = (h.node?.fraudScore || 0);
      const rc = RISK_COLORS[h.node?.riskLevel || 'LOW'];
      return `<div><span style="color:${rc};">${h.id.slice(0,16)}</span> — deg:${h.degree} score:<span style="color:${rc};">${score}</span></div>`;
    }).join('');
  } else if (hubListEl) {
    hubListEl.innerHTML = '<div style="color:var(--text-muted);">Không phát hiện hub</div>';
  }

  // Money flow chains
  const chainListEl = document.getElementById('graph-chain-list');
  if (chainListEl && graphResult.moneyFlowChains.length > 0) {
    chainListEl.innerHTML = graphResult.moneyFlowChains.slice(0, 6).map(c =>
      `<div>${c.path.map(id => id.slice(0,8)).join(' → ')} <span style="color:#ff9900;">(${(c.chainVolume/1e6).toFixed(0)}M)</span></div>`
    ).join('');
  } else if (chainListEl) {
    chainListEl.innerHTML = '<div style="color:var(--text-muted);">Không có chuỗi dòng tiền</div>';
  }
}

/* ── D3 FORCE GRAPH RENDER ───────────────────────────────────────────────────── */

function flaRenderGraph(graphResult) {
  if (!graphResult || typeof d3 === 'undefined') return;

  const container = document.getElementById('fla-graph-container');
  if (!container) return;

  const placeholder = document.getElementById('fla-graph-placeholder');
  if (placeholder) placeholder.style.display = 'none';

  const tooltip = document.getElementById('fla-graph-tooltip');
  const { nodes: d3Nodes, links: d3Links } = GraphEngine.toD3Format(graphResult);

  if (d3Nodes.length === 0) {
    if (placeholder) { placeholder.style.display = 'flex'; placeholder.textContent = 'Không đủ dữ liệu để dựng đồ thị'; }
    return;
  }

  const svgEl = document.getElementById('fla-graph-svg');
  const W = container.clientWidth  || 600;
  const H = container.clientHeight || 400;

  // Clear previous simulation
  if (_flaD3Simulation) { _flaD3Simulation.stop(); _flaD3Simulation = null; }
  const svgD3 = d3.select(svgEl).attr('width', W).attr('height', H);
  svgD3.selectAll('*').remove();

  const g = svgD3.append('g');

  // Zoom & pan
  const zoom = d3.zoom().scaleExtent([0.1, 5]).on('zoom', e => g.attr('transform', e.transform));
  svgD3.call(zoom);

  // Arrow marker
  svgD3.append('defs').append('marker')
    .attr('id', 'arrow').attr('viewBox', '0 -4 8 8').attr('refX', 8).attr('refY', 0)
    .attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto')
    .append('path').attr('d', 'M0,-4L8,0L0,4').attr('fill', 'rgba(0,240,255,0.4)');

  // Links
  const link = g.selectAll('.graph-link')
    .data(d3Links).enter().append('line')
    .attr('class', 'graph-link')
    .attr('stroke', 'rgba(0,240,255,0.25)')
    .attr('stroke-width', d => d.width)
    .attr('marker-end', 'url(#arrow)');

  // Nodes group
  const node = g.selectAll('.graph-node')
    .data(d3Nodes).enter().append('g')
    .attr('class', 'graph-node')
    .call(d3.drag()
      .on('start', (ev, d) => { if (!ev.active) _flaD3Simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag',  (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on('end',   (ev, d) => { if (!ev.active) _flaD3Simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    );

  // Node circles
  node.append('circle')
    .attr('r', d => d.r)
    .attr('fill', d => (RISK_COLORS[d.riskLevel] || '#00f0ff') + '33')
    .attr('stroke', d => RISK_COLORS[d.riskLevel] || '#00f0ff')
    .attr('stroke-width', 1.5);

  // Node labels
  node.append('text')
    .attr('class', 'graph-label')
    .attr('text-anchor', 'middle')
    .attr('dy', d => d.r + 10)
    .text(d => d.label);

  // Tooltip
  node.on('mouseover', (ev, d) => {
    if (!tooltip) return;
    tooltip.style.display = 'block';
    tooltip.innerHTML = [
      `<strong style="color:${RISK_COLORS[d.riskLevel]||'#00f0ff'}">${d.fullLabel}</strong>`,
      `Bank: ${d.bankName || 'Unknown'}`,
      `Volume: ${VND.format(d.volume)}`,
      `Tx: ${d.count} | Degree: ${d.degree}`,
      `Risk: <span style="color:${RISK_COLORS[d.riskLevel]||'#00f0ff'};font-weight:700;">${d.riskLevel} (${d.fraudScore})</span>`,
    ].join('<br>');
  }).on('mousemove', ev => {
    if (!tooltip) return;
    const rect = container.getBoundingClientRect();
    tooltip.style.left = (ev.clientX - rect.left + 10) + 'px';
    tooltip.style.top  = (ev.clientY - rect.top  + 10) + 'px';
  }).on('mouseout', () => { if (tooltip) tooltip.style.display = 'none'; });

  // Force simulation
  _flaD3Simulation = d3.forceSimulation(d3Nodes)
    .force('link',    d3.forceLink(d3Links).id(d => d.id).distance(90))
    .force('charge',  d3.forceManyBody().strength(-200))
    .force('center',  d3.forceCenter(W / 2, H / 2))
    .force('collide', d3.forceCollide(d => d.r + 6))
    .on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

  flaUpdateGraphStats(graphResult);
}

/* ── FLA EXPORT ─────────────────────────────────────────────────────────────── */

/** Sanitize an account ID for use in a filename. */
function _sanitizeAccId(accId) {
  return String(accId).replace(/[^\w\-]/g, '_').slice(0, 50) || 'UNKNOWN';
}

/**
 * Sole export entry-point.
 *
 * RULE 1 — 1 account  → Account_<number>.xlsx (no ZIP)
 * RULE 2+ — N accounts → Account_<n>.xlsx each, packaged as Analysis_Export.zip
 *
 * Always exports the FULL dataset (_flaState.data), not the filtered view,
 * so every account's workbook contains its complete forensic record.
 */
function exportFlaXlsx() {
  if (typeof XLSX === 'undefined') { _showToast('Thư viện XLSX chưa tải.', 'error'); return; }

  const data = _flaState.data;
  if (!data.length) { _showToast('Không có dữ liệu để xuất.', 'error'); return; }

  // ── Group by account via the grouping layer ───────────────────────────────
  const groups = AccountExportGrouping.group(data, _flaUploadedFiles);

  // ── Pre-export validation: abort on contamination ─────────────────────────
  const validation = AccountExportGrouping.validate(groups);
  if (!validation.valid) {
    _showToast('⚠ Lỗi toàn vẹn: ' + validation.errors.slice(0, 2).join(' | '), 'error');
    console.error('[Export] Cross-account contamination:', validation.errors);
    return;
  }

  const keys = Object.keys(groups);

  if (keys.length === 1) {
    // ── RULE 1: Single account → single XLSX, no ZIP ─────────────────────────
    const accId = keys[0];
    const entry = groups[accId];
    try {
      const wb = _buildAccountWorkbook(entry.transactions, accId, entry.sourceFiles);
      XLSX.writeFile(wb, `Account_${_sanitizeAccId(accId)}.xlsx`);
      _showToast(`✓ Đã xuất Account_${_sanitizeAccId(accId)}.xlsx (${wb.SheetNames.length} sheet)`, 'success');
    } catch (err) {
      console.error('[Export] Single-account build failed:', err);
      _showToast(`Lỗi xuất file: ${err.message}`, 'error');
    }
  } else {
    // ── RULES 2–5: Multiple accounts → Analysis_Export.zip ───────────────────
    _exportFlaZip(groups, keys);
  }
}

// Phase 21: single source of truth for the account workbook's sheet names.
// _buildAccountWorkbook() appends exactly these sheets (unconditionally, even
// when a sheet's data is empty — see the "Ghi Chu" placeholder rows below);
// several UI/toast strings elsewhere used to hardcode a stale "9 sheet" figure
// left over from an earlier, larger plan (Đồ thị/NLP/Nhãn/Điều tra/Kiểm toán/
// File nguồn were never wired into this workbook). Every display string now
// derives its sheet count/description from this array instead of a re-typed
// number. Phase 25 appended a 5th sheet ("5. Truy Tim Tai Khoan") for the
// owner-name investigation report — the array's .length is still the only
// place any of that count lives.
const _FLA_ACCOUNT_WORKBOOK_SHEET_NAMES = [
  '1. Doi Ung TK',
  '2. Nap Tien DT',
  '3. Vi Dien Tu',
  '4. Doi Soat NAPAS',
  '5. Truy Tim Tai Khoan',
];

// Post-Phase-25 fix: NAPAS-sourced data structurally cannot contain phone-
// topup or e-wallet transactions (the NAPAS interbank-trace format only
// carries CHUYEN/NHAN transfer entries), so Sheets "2. Nap Tien DT" and
// "3. Vi Dien Tu" would always be empty placeholders for a pure-NAPAS
// export. This second sheet-name array is what a pure-NAPAS export uses
// instead — 3 sheets, renumbered so the visible tabs read 1/2/3 with no
// gap. Legacy/mixed exports keep the full 5-sheet array above completely
// unchanged; PhoneTopupEngine/analyzeFintechTransactions themselves are
// NEVER removed or altered — _flaIsPureNapasExport only decides whether
// _buildAccountWorkbook invokes and appends that sheet for THIS export.
const _FLA_ACCOUNT_WORKBOOK_SHEET_NAMES_NAPAS_ONLY = [
  '1. Doi Ung TK',
  '2. Doi Soat NAPAS',
  '3. Truy Tim Tai Khoan',
];
function _flaIsPureNapasExport(txSubset) {
  return Array.isArray(txSubset) && txSubset.length > 0 && txSubset.every(tx => tx.sourceFormat === 'NAPAS');
}
function _flaGetExportSheetNames(isPureNapas) {
  return isPureNapas ? _FLA_ACCOUNT_WORKBOOK_SHEET_NAMES_NAPAS_ONLY : _FLA_ACCOUNT_WORKBOOK_SHEET_NAMES;
}

// Phase 25: Vietnamese labels for counterpartyNameConfidence in exported
// XLSX cells (user-facing spreadsheet, not a colored UI badge — sentence
// case reads better in a cell than the UI's all-caps badge text). Same 4
// canonical tiers as _flaConfidenceBadgeHtml (never renamed/reinterpreted),
// just a different presentation for a different surface. Unrecognized/
// missing confidence intentionally falls through to '' — never silently
// becomes "Xác nhận" or any other specific tier.
const _FLA_CONFIDENCE_VN_LABELS = {
  CONFIRMED: 'Xác nhận',
  INFERRED:  'Suy luận',
  AMBIGUOUS: 'Chưa rõ',
  UNKNOWN:   'Không xác định',
};
function _flaConfidenceVnLabel(confidence) {
  return _FLA_CONFIDENCE_VN_LABELS[confidence] || '';
}

// Phase 25: OWASP-recommended mitigation for CSV/Excel formula injection —
// a text value beginning with =, +, -, or @ can be reinterpreted as a
// formula/command by some spreadsheet tools. Prefixing with a single quote
// forces literal-text interpretation; Excel/LibreOffice both suppress a
// leading apostrophe from the *displayed* content of a text-typed cell, so
// this does not visibly alter what the investigator sees. Applied only to
// free-text fields sourced from parsed transaction content (owner/
// counterparty names) — never to identifier columns, which already go
// through _flaForceTextColumns for a different (leading-zero) reason.
function _flaSafeExcelText(value) {
  const s = value == null ? '' : String(value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// Phase 25: exact-match name normalization for the owner-name investigation
// report ONLY (never used by reconciliation/pairing/resolver logic). Unicode
// NFC canonicalization handles the case where visually-identical Vietnamese
// text differs only in how a diacritic is encoded (precomposed vs base+
// combining-mark) — this is NOT fuzzy matching, it's collapsing two byte-
// distinct encodings of the same characters. Beyond that: trim, collapse
// internal whitespace, case-fold to uppercase. Deliberately does NOT strip
// diacritics, remove middle names, reorder tokens, or tolerate near-misses —
// "NGUYEN VAN A" vs "NGUYEN VAN AN" must never match.
function _flaNormalizeOwnerName(name) {
  if (!name) return '';
  return String(name).normalize('NFC').trim().replace(/\s+/g, ' ').toUpperCase();
}

// ── Owner-name inference from CHUYEN content (post-Phase-25-fix upgrade) ────
//
// TWO DISTINCT CONCEPTS — never merged (see docs/NAPAS_UPGRADE_SPEC.md):
//   - ownerName / ownerNameConfidence / ownerNameSource / ownerNameEvidence:
//     who OWNS the account being analyzed, inferred from THAT account's own
//     CHUYEN (outgoing) transaction content. NEW as of this upgrade.
//   - counterpartyName / counterpartyNameConfidence: who the OTHER PARTY is
//     in one specific transaction, already produced by bank-parser.js's
//     resolveCounterparty() — completely unchanged, never touched here.
//
// Pattern discovery (real data, the 4 mandatory fixtures, 3685 CHUYEN
// transactions with content, see the dedicated discovery pass run before
// writing this code): raw cell values contain NO embedded newlines/CR
// (verified directly against the raw XLSX cells — the wrapped-line
// appearance some spreadsheet viewers show is a column-width display
// artifact only, not real \n/\r characters). Two reliable, evidence-backed
// structural patterns were found:
//   1. VCB's "MBVCB...CT tu <acc> <NAME> toi <acc> <NAME> tai <bank>"
//      narrative — the SAME family already used by bank-parser.js's
//      existing CONFIRMED-tier counterparty resolver, just reading the
//      "tu <acc> <NAME>" (sender/own) side instead of the "toi" side, and
//      cross-validated against this transaction's own accountNumber for
//      the same reliability guarantee.
//   2. "<NAME> chuyen..." — a 2-5 token capitalized name immediately
//      followed by the word "chuyen" (bare, or as part of "chuyen tien",
//      "chuyen khoan", "chuyen thanh toan", "chuyen hoc phi", "chuyen
//      FT250..." — all observed verbatim in the real fixtures; the bare
//      "chuyen" anchor covers every one of these without needing a longer
//      phrase whitelist).
// Validated against the 4 mandatory real fixtures: 88.1% coverage (146
// CONFIRMED + 3099 INFERRED of 3685), with a manual review of every
// unmatched sample confirming no missed real names — unmatched content is
// genuinely name-less (system-generated QR/reference codes, generic phrases
// like "Chuyen cho me", single letters, bare digit strings). No pattern
// beyond these two was hard-coded past what the real data actually showed.
const _FLA_OWNER_NAME_TOKEN = "[A-ZÀ-Ỹ][A-Za-zÀ-ỹ']*";
const _FLA_RE_OWNER_MBVCB = new RegExp(
  `CT\\s+tu\\s+(\\d+)\\s+(${_FLA_OWNER_NAME_TOKEN}(?:\\s+${_FLA_OWNER_NAME_TOKEN}){1,4})\\s+toi\\b`, 'i');
const _FLA_RE_OWNER_NAME_CHUYEN = new RegExp(
  `(${_FLA_OWNER_NAME_TOKEN}(?:\\s+${_FLA_OWNER_NAME_TOKEN}){1,4})\\s+chuyen\\b`, 'i');

// Requires a MINIMUM of 2 name-shaped tokens (rejects single all-caps bank
// codes like "VPB"/"STB"/"VIB" and single-letter fragments like "A"), each
// token starting with an uppercase letter and containing no digits — this
// is why content like "0789067289 DAT VE XE-..." or "NAPLOVE1769" never
// matches: no run of 2+ letter-only capitalized tokens precedes the anchor.
// Returns null (never a guess) when neither pattern is found — exactly the
// "không đủ bằng chứng thì để UNKNOWN" principle.
function _flaExtractOwnerNameCandidate(rawContent, ownAccountNumber) {
  if (!rawContent) return null;
  const mbvcb = rawContent.match(_FLA_RE_OWNER_MBVCB);
  if (mbvcb && mbvcb[1] === ownAccountNumber) {
    return { name: mbvcb[2].trim(), confidence: 'CONFIRMED', source: 'MBVCB_NARRATIVE' };
  }
  const generic = rawContent.match(_FLA_RE_OWNER_NAME_CHUYEN);
  if (generic) {
    return { name: generic[1].trim(), confidence: 'INFERRED', source: 'NAME_BEFORE_CHUYEN' };
  }
  return null;
}

// Builds, per own-account-identity (accountNumber + normalized bank —
// same account number at two different banks is always kept separate, same
// identity model used everywhere else in NAPAS reporting), the resolved
// ownerName from that identity's own CHUYEN (OUT-direction) transactions.
//
// A real account can have MANY CHUYEN transactions and, per docs §8,
// picking the first one arbitrarily is explicitly forbidden — every
// candidate across every transaction is tallied, then resolved by:
//   1. highest confidence tier wins (CONFIRMED beats INFERRED) — matches
//      the worked example in the task spec and the existing
//      _flaConfidenceRank convention already used in buildAccountFlowMatrix;
//   2. within the same top tier, highest transaction-count wins;
//   3. if the top two candidates in that tier are within 2x of each other
//      (never a silent pick), the identity is AMBIGUOUS instead — this
//      threshold was chosen because every real name in the 4 mandatory
//      fixtures resolves with an overwhelming majority (e.g. 111 vs 15,
//      1015 vs 1, 2075 alone) — a real near-tie is exactly the case this
//      guard exists to catch, exercised via a dedicated synthetic test
//      since no real fixture happens to trigger it.
//
// O(n) single pass over allTransactions to tally candidates, O(k) to
// resolve each of the k distinct identities — no nested per-account scans.
function _flaBuildAccountOwnerIndex(allTransactions) {
  const tally = new Map(); // identityKey -> Map<normalizedName, {nameRaw, confidence, count, evidenceTxIds[]}>
  const identityMeta = new Map(); // identityKey -> {accountNumber, bankNameRaw, bankId}

  for (const tx of allTransactions) {
    if (tx.sourceFormat !== 'NAPAS' || tx.transactionType !== 'OUT') continue;
    const accountNumber = (tx.accountNumber || '').trim();
    if (!accountNumber) continue;
    const bankRaw = tx.bankName || tx.bank || '';
    const bankId = BankParser.normalizeBankName(bankRaw) || bankRaw;
    const identityKey = accountNumber + '||' + bankId;
    if (!identityMeta.has(identityKey)) identityMeta.set(identityKey, { accountNumber, bankNameRaw: bankRaw, bankId });

    const cand = _flaExtractOwnerNameCandidate(tx.description || tx.content || '', accountNumber);
    if (!cand) continue;
    const normalizedName = _flaNormalizeOwnerName(cand.name);
    if (!normalizedName) continue;

    if (!tally.has(identityKey)) tally.set(identityKey, new Map());
    const nameMap = tally.get(identityKey);
    if (!nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, { nameRaw: cand.name, confidence: cand.confidence, count: 0, evidenceTxIds: [] });
    }
    const entry = nameMap.get(normalizedName);
    entry.count++;
    // a higher-confidence sighting of the same normalized name upgrades the
    // stored tier/label (e.g. one CONFIRMED MBVCB hit among many INFERRED)
    if (_flaConfidenceRank(cand.confidence) > _flaConfidenceRank(entry.confidence)) {
      entry.confidence = cand.confidence;
      entry.nameRaw = cand.name;
    }
    if (entry.evidenceTxIds.length < 3) entry.evidenceTxIds.push(tx.transactionId);
  }

  const resolved = new Map(); // identityKey -> {accountNumber, bankNameRaw, bankId, ownerName, normalizedOwnerName, ownerNameConfidence, ownerNameSource, ownerNameEvidence, allCandidates}
  for (const [identityKey, nameMap] of tally) {
    const meta = identityMeta.get(identityKey);
    const candidates = [...nameMap.entries()].map(([normalizedName, v]) => ({ normalizedName, ...v }));
    // group by confidence tier, evaluate the highest tier present first
    const byTier = { CONFIRMED: [], INFERRED: [] };
    for (const c of candidates) (byTier[c.confidence] || []).push(c);
    const topTier = byTier.CONFIRMED.length ? 'CONFIRMED' : (byTier.INFERRED.length ? 'INFERRED' : null);
    if (!topTier) continue; // should not happen (candidates always carry a known tier), defensive
    const tierCandidates = byTier[topTier].sort((a, b) => b.count - a.count);
    const winner = tierCandidates[0];
    const runnerUp = tierCandidates[1];
    const isAmbiguous = runnerUp && winner.count < runnerUp.count * 2;

    resolved.set(identityKey, {
      accountNumber: meta.accountNumber, bankNameRaw: meta.bankNameRaw, bankId: meta.bankId,
      ownerName: isAmbiguous ? null : winner.nameRaw,
      normalizedOwnerName: isAmbiguous ? null : winner.normalizedName,
      ownerNameConfidence: isAmbiguous ? 'AMBIGUOUS' : winner.confidence,
      ownerNameSource: isAmbiguous ? null : (winner.confidence === 'CONFIRMED' ? 'MBVCB_NARRATIVE' : 'NAME_BEFORE_CHUYEN'),
      ownerNameEvidence: { supportingTxCount: winner.count, evidenceTxIds: winner.evidenceTxIds },
      allCandidates: candidates,
    });
  }
  return resolved;
}

// Phase 25: builds a cross-account owner-name index from NAPAS-sourced
// counterparty references ONLY. Legacy (non-NAPAS) bank statements never
// carry a counterparty-bank field (makeTx()'s counterpartyBankName stays
// null for all 9 legacy parsers — verified against bank-parser.js), so a
// legacy reference can never be safely classified as same-bank vs
// cross-bank; using one anyway would risk asserting "different bank" on
// unknown data, which this feature must never do. This is a real, documented
// data-scope limitation, not an oversight (see docs/NAPAS_UPGRADE_SPEC.md
// Phase 25 — "Known Limitations").
//
// Does NOT call resolveCounterparty() or any parsing/resolution logic —
// consumes tx.counterpartyName/tx.counterpartyNameConfidence exactly as
// already produced by the untouched bank-parser.js pipeline.
//
// Identity key = accountNumber + '||' + normalized-bank-identity, the same
// identity model used everywhere else in NAPAS reporting (buildAccountFlow-
// Matrix, reconcileAllPairs's _reconSameOwnIdentity) — same accountNumber at
// two different banks is always two different identities, never merged.
//
// O(n) single pass over allTransactions + O(m) grouping pass over the
// resulting distinct identities (m << n) — no nested per-account scans.
//
// Post-Phase-25-fix: now ALSO retains up to 3 evidencing transactions per
// identity (transactionId/date/amount/content, i.e. the specific NHAN
// transaction(s) whose content named this identity) — needed so Sheet 5 can
// show per-transaction evidence (content/REF/date/amount/direction) per
// docs §16, instead of only a summarized name pair as in the original
// Phase 25 version. The identity-resolution logic itself (highest-
// confidence-wins) is unchanged.
function _flaBuildOwnerNameIndex(allTransactions) {
  const byIdentity = new Map();
  for (const tx of allTransactions) {
    if (tx.sourceFormat !== 'NAPAS') continue; // see limitation note above
    const cpAcc     = (tx.counterpartyAccount  || '').trim();
    const cpBankRaw = (tx.counterpartyBankName || '').trim();
    const cpNameRaw = (tx.counterpartyName     || '').trim();
    if (!cpAcc || cpAcc === 'CHUA_XAC_DINH' || !cpBankRaw || !cpNameRaw) continue;
    const normalizedName = _flaNormalizeOwnerName(cpNameRaw);
    if (!normalizedName) continue;
    const cpBankId = BankParser.normalizeBankName(cpBankRaw) || cpBankRaw;
    const identityKey = cpAcc + '||' + cpBankId;
    const existing = byIdentity.get(identityKey);
    const confidence = tx.counterpartyNameConfidence || null;
    const evidence = {
      transactionId: tx.transactionId || '', transactionDate: tx.transactionDate || '',
      amount: tx.amount || 0, content: tx.description || tx.content || '',
    };
    // Highest-confidence name wins per identity — same tie-break convention
    // already established in buildAccountFlowMatrix (_flaConfidenceRank),
    // never "first transaction wins".
    if (!existing || _flaConfidenceRank(confidence) > _flaConfidenceRank(existing.confidence)) {
      byIdentity.set(identityKey, {
        accountNumber: cpAcc, bankNameRaw: cpBankRaw, bankId: cpBankId,
        ownerNameRaw: cpNameRaw, normalizedName, confidence, evidenceList: [evidence],
      });
    } else if (_flaConfidenceRank(confidence) === _flaConfidenceRank(existing.confidence) &&
               _flaNormalizeOwnerName(cpNameRaw) === existing.normalizedName && existing.evidenceList.length < 3) {
      existing.evidenceList.push(evidence);
    }
  }
  const byNormalizedName = new Map();
  for (const [identityKey, entry] of byIdentity) {
    if (!byNormalizedName.has(entry.normalizedName)) byNormalizedName.set(entry.normalizedName, []);
    byNormalizedName.get(entry.normalizedName).push(identityKey);
  }
  return { byIdentity, byNormalizedName };
}

// Post-Phase-25-fix: produces Sheet 5 rows — ONE ROW PER EVIDENCING NHAN
// TRANSACTION (docs §16 explicitly wants per-row content/REF/date/amount/
// direction, not just a summarized name pair) — for every distinct
// own-bank-identity present in this export's own transactions (a single
// accId can legitimately span multiple own banks in one workbook — see the
// 255-collision fixture / docs §4.E).
//
// SOURCE owner name now comes from `accountOwnerIndex`
// (_flaBuildAccountOwnerIndex — inferred DIRECTLY from this identity's own
// CHUYEN content, the new capability added in this upgrade) instead of the
// old Phase 25 mechanism (which could only discover a name if this account
// happened to ALSO be named as someone else's counterparty elsewhere).
// CANDIDATE matching is unchanged — still cross-references NHAN-sourced
// `counterpartyOwnerIndex` (the original _flaBuildOwnerNameIndex, now with
// evidence tracking added), which already reliably captures "who sent this
// NHAN transaction" via the existing, untouched resolveCounterparty().
//
// Self-exclusion, same-bank exclusion, and the same-account/different-bank
// flag are unchanged from Phase 25 (docs §13-15/§27 invariants preserved).
function _flaBuildOwnerInvestigationRows(ownIdentities, accountOwnerIndex, counterpartyOwnerIndex) {
  const rows = [];
  for (const own of ownIdentities) {
    const ownKey = own.accountNumber + '||' + own.bankId;
    const ownerEntry = accountOwnerIndex.get(ownKey);
    // AMBIGUOUS/UNKNOWN source owner names never produce candidates —
    // guessing which of several competing names is "the" owner to then
    // search for matches would compound uncertainty, not resolve it.
    if (!ownerEntry || !ownerEntry.ownerName || ownerEntry.ownerNameConfidence === 'AMBIGUOUS') continue;
    const candidateKeys = counterpartyOwnerIndex.byNormalizedName.get(ownerEntry.normalizedOwnerName) || [];
    for (const candidateKey of candidateKeys) {
      if (candidateKey === ownKey) continue; // self-exclusion — identity, not just accountNumber
      const cand = counterpartyOwnerIndex.byIdentity.get(candidateKey);
      if (!cand || cand.bankId === own.bankId) continue; // same-bank candidates excluded (§14)
      const sameAccountNumber = cand.accountNumber === own.accountNumber;
      for (const ev of cand.evidenceList) {
        rows.push({
          sourceAccount: own.accountNumber,
          sourceOwnerName: ownerEntry.ownerName,
          sourceBank: own.bankNameRaw,
          candidateAccount: cand.accountNumber,
          candidateOwnerName: cand.ownerNameRaw,
          candidateBank: cand.bankNameRaw,
          content: ev.content,
          ref: ev.transactionId,
          date: ev.transactionDate,
          amount: ev.amount,
          direction: 'NHAN',
          confidence: cand.confidence,
          ownerNameConfidence: ownerEntry.ownerNameConfidence,
          note: sameAccountNumber ? 'Cung so tai khoan, khac ngan hang - can xac minh rieng biet' : '',
        });
      }
    }
  }
  // Deterministic sort (docs §27): candidate bank, then candidate account,
  // then transaction date — source bank/account are constant within one
  // own-identity's row block, so the meaningful variation is candidate-side.
  rows.sort((a, b) =>
    a.candidateBank.localeCompare(b.candidateBank) ||
    a.candidateAccount.localeCompare(b.candidateAccount) ||
    (a.date || '').localeCompare(b.date || ''));
  return rows;
}

/**
 * Tạo workbook cho 1 tài khoản cụ thể — 5 sheet ({@link _FLA_ACCOUNT_WORKBOOK_SHEET_NAMES})
 * cho dữ liệu legacy/mixed, hoặc 3 sheet ({@link _FLA_ACCOUNT_WORKBOOK_SHEET_NAMES_NAPAS_ONLY})
 * khi toàn bộ giao dịch của tài khoản là NAPAS ({@link _flaIsPureNapasExport}).
 * @param {Array}  txSubset    - mảng giao dịch thuộc tài khoản này
 * @param {string} accId       - số tài khoản
 * @param {Array}  sourceFiles - [{ filename, bankName, importedAt }] from grouping layer
 */
function _buildAccountWorkbook(txSubset, accId, sourceFiles) {
  const wb   = XLSX.utils.book_new();
  const data = txSubset;
  const isPureNapas = _flaIsPureNapasExport(data);
  const sheetNames  = _flaGetExportSheetNames(isPureNapas);
  // Post-Phase-25-fix: owner-name-from-CHUYEN-content index, built once per
  // workbook over the FULL analyzed dataset (not just this account's own
  // txSubset — an owner name can only be inferred from an identity's own
  // CHUYEN transactions, which may or may not all be inside txSubset
  // depending on how the caller scoped it, so the full dataset is the
  // correct, complete source — see _flaBuildAccountOwnerIndex).
  const accountOwnerIndex = _flaBuildAccountOwnerIndex(_flaState.data || []);
  function _flaOwnerNameFor(accountNumber, bankId) {
    const entry = accountOwnerIndex.get(accountNumber + '||' + bankId);
    return entry && entry.ownerName ? entry.ownerName : '';
  }

  /* ── SHEET 1: Tần Suất Dòng Tiền (TK nguồn × TK đối ứng) ──────────────── */
  const matrix = buildAccountFlowMatrix(data);
  // Phase 18: added NH Doi Ung / Ma Dinh Danh NH / Nguon Du Lieu / Do Tin Cay
  // Ten Doi Ung — these fields already existed on each matrix row since
  // Phase 5 (bankId, counterpartyBankName, counterpartyNameConfidence,
  // sourceFormat) but were never exported; purely additive columns, safe
  // for legacy exports (bankId/sourceFormat already have sensible non-NAPAS
  // defaults from buildAccountFlowMatrix — see docs/NAPAS_UPGRADE_SPEC.md
  // Phase 18 status).
  // Post-Phase-25-fix (docs §17): for a PURE-NAPAS export only, Sheet 1 now
  // uses a 13-column, owner-name-first layout — "Ma Dinh Danh NH" and
  // "Net (VND)" are dropped from THIS EXPORT ONLY (bankId itself and the
  // sumIN-sumOUT computation both remain fully intact internally — matrix
  // rows still carry them, buildAccountFlowMatrix/bank identity/collision
  // logic is completely untouched, only this one sheet's column set
  // changed). Legacy/mixed exports keep the ORIGINAL 14-column layout
  // byte-for-byte (docs §21 — never touched for non-pure-NAPAS data).
  const ws1rows = isPureNapas
    ? matrix.map(g => ({
        'Tai Khoan Nguon':         g.accountNumber,
        'Ten Chu TK Nguon':        _flaSafeExcelText(_flaOwnerNameFor(g.accountNumber, g.bankId)),
        'Ngan Hang (Nguon)':       g.bankName,
        'Tai Khoan Doi Ung':       g.counterpartyAccount === 'CHUA_XAC_DINH' ? '' : g.counterpartyAccount,
        'Ten Chu TK Doi Ung':      _flaSafeExcelText(g.counterpartyName || ''),
        'Ngan Hang Doi Ung':       _flaSafeExcelText(g.counterpartyBankName || ''),
        'Do Tin Cay Ten Doi Ung':  _flaConfidenceVnLabel(g.counterpartyNameConfidence),
        'Tong So GD':              g.totalCount,
        'Tien Vao (VND)':          g.sumIN,
        'Tien Ra (VND)':           g.sumOUT,
        'Lan Giao Dich Dau':       g.firstDate || '',
        'Lan Giao Dich Cuoi':      g.lastDate  || '',
        'Nguon Du Lieu':           g.sourceFormat || '',
      }))
    : matrix.map(g => ({
        'TK Nguon':                g.accountNumber,
        'Ngan Hang':               g.bankName,
        'TK Doi Ung':              g.counterpartyAccount === 'CHUA_XAC_DINH' ? '' : g.counterpartyAccount,
        'NH Doi Ung':              _flaSafeExcelText(g.counterpartyBankName || ''),
        'Ten Doi Ung':             _flaSafeExcelText(g.counterpartyName || ''),
        'Do Tin Cay Ten Doi Ung':  _flaConfidenceVnLabel(g.counterpartyNameConfidence),
        'Ma Dinh Danh NH':         g.bankId || '',
        'Tong So GD':              g.totalCount,
        'Tien Vao (VND)':          g.sumIN,
        'Tien Ra (VND)':           g.sumOUT,
        'Net (VND)':               g.sumIN - g.sumOUT,
        'Lan Giao Dich Dau':       g.firstDate || '',
        'Lan Giao Dich Cuoi':      g.lastDate  || '',
        'Nguon Du Lieu':           g.sourceFormat || '',
      }));
  const ws1 = ws1rows.length
    ? XLSX.utils.json_to_sheet(ws1rows)
    : XLSX.utils.aoa_to_sheet([['Ghi Chu'], ['Khong co du lieu doi ung tai khoan.']]);
  _flaForceTextColumns(ws1, isPureNapas ? ['Tai Khoan Nguon', 'Tai Khoan Doi Ung'] : ['TK Nguon', 'TK Doi Ung']);
  _flaAutoWidth(ws1);
  XLSX.utils.book_append_sheet(wb, ws1, sheetNames[0]);

  /* ── SHEET 2/3: Nạp Tiền Điện Thoại / Ví Điện Tử — LEGACY ONLY ───────────
     Post-Phase-25 fix: skipped entirely for a pure-NAPAS export (see
     _flaIsPureNapasExport above) since NAPAS data can never contain either
     kind of transaction — these sheets would only ever show their empty-
     state placeholder. The underlying engines/logic are untouched and still
     run exactly as before for any legacy or mixed-source export. */
  if (!isPureNapas) {
    /* ── SHEET 2: Nạp Tiền Điện Thoại ───────────────────────────────────── */
    let ws2rows;
    if (typeof PhoneTopupEngine !== 'undefined') {
      // Lọc giao dịch nạp tiền liên quan đến tài khoản này
      const topupAll = PhoneTopupEngine.analyze(data);
      const accAgg   = { aggregations: topupAll.aggregations.filter(a => !accId || accId === 'UNKNOWN' || a.fundingAccounts.includes(accId)) };
      ws2rows = accAgg.aggregations.length
        ? PhoneTopupEngine.buildExcelRows(accAgg)
        : [{ 'Ghi Chu': 'Khong phat hien giao dich nap tien dien thoai.' }];
    } else {
      ws2rows = [{ 'Ghi Chu': 'PhoneTopupEngine chua san sang.' }];
    }
    const ws2 = XLSX.utils.json_to_sheet(ws2rows);
    _flaAutoWidth(ws2);
    XLSX.utils.book_append_sheet(wb, ws2, sheetNames[1]);

    /* ── SHEET 3: Ví Điện Tử & Fintech Gateway ──────────────────────────── */
    const { hits: ftHits, summary: ftSummary } = analyzeFintechTransactions(data);

    // Phần A: Tổng hợp theo loại ví
    const ftSummaryRows = ftSummary.map(s => ({
      'Loai Vi':            s.name,
      'Tong GD':            s.totalCount,
      'Tong Tien Vao (VND)': s.totalIN,
      'Tong Tien Ra (VND)': s.totalOUT,
      'Net (VND)':          s.totalIN - s.totalOUT,
      'GD Nghi Van':        s.suspiciousCount,
    }));

    // Phần B: Chi tiết từng giao dịch
    const ftDetailRows = ftHits.map(h => ({
      'Loai Vi':       h.fintechName,
      'TK Nguon':      h.accountNumber,
      'Chieu GD':      h.transactionType === 'IN' ? 'TIEN VAO' : h.transactionType === 'OUT' ? 'TIEN RA' : h.transactionType,
      'So Tien (VND)': h.amount,
      'Ngay Gio':      h.date,
      'Ngan Hang':     h.bankName,
      'Noi Dung':      h.description,
      'Nghi Van':      h.isSuspicious ? 'CO' : '',
    }));

    const ws3 = ftSummaryRows.length
      ? XLSX.utils.json_to_sheet(ftSummaryRows)
      : XLSX.utils.aoa_to_sheet([['Ghi Chu'], ['Khong phat hien giao dich qua vi dien tu / fintech.']]);

    if (ftDetailRows.length > 0) {
      const detailStart  = ftSummaryRows.length + 3;
      const detailHdrs   = ['Loai Vi','TK Nguon','Chieu GD','So Tien (VND)','Ngay Gio','Ngan Hang','Noi Dung','Nghi Van'];
      XLSX.utils.sheet_add_aoa(ws3, [detailHdrs], { origin: { r: detailStart, c: 0 } });
      XLSX.utils.sheet_add_json(ws3, ftDetailRows, { origin: { r: detailStart + 1, c: 0 }, skipHeader: true, header: detailHdrs });
    }
    _flaAutoWidth(ws3);
    XLSX.utils.book_append_sheet(wb, ws3, sheetNames[2]);
  }

  /* ── SHEET 4 (Phase 18): Đối Soát NAPAS (CHUYỂN ↔ NHẬN) ─────────────────
     Per-transaction reconciliation detail for this account, flattened from
     BankParser.reconcileAllPairs()'s own output (never recomputed here —
     export is presentation only, same principle as the UI panel, Phase 17).
     Always present (consistent sheet count/order across every export,
     matching Sheet 2's established "empty state has a Ghi Chu placeholder
     row" convention) — empty/placeholder for accounts with no NAPAS data. */
  const ws4rows = [];
  if (Array.isArray(_flaNapasFileResults) && _flaNapasFileResults.some(r => r && r.detectedBank === 'NAPAS')) {
    const napasPairing = BankParser.pairNapasGroups(_flaNapasFileResults);
    const napasRecon   = BankParser.reconcileAllPairs(_flaNapasFileResults, napasPairing);
    for (const { pair, reconciliation } of napasRecon) {
      if (pair.accountNumber !== accId) continue; // export only this account's own pairs
      for (const row of _flaBuildReconRows(reconciliation)) {
        const isChuyen = row.tx.transactionType === 'OUT';
        const ownBankId = BankParser.normalizeBankName(row.tx.bankName) || row.tx.bankName || '';
        // Post-Phase-25-fix (docs §18): owner-name-first column order, "Ma
        // Dinh Danh NH" dropped from export (still computed above/used
        // internally for the owner-name lookup — never removed as a concept,
        // only from this sheet's exported columns). Sheet 4 has no "Net"
        // column to begin with, so §18's Net removal is a no-op here.
        ws4rows.push({
          'Tai Khoan Nguon':      row.tx.accountNumber || '',
          'Ten Chu TK Nguon':     _flaSafeExcelText(_flaOwnerNameFor(row.tx.accountNumber || '', ownBankId)),
          'Ngan Hang (Nguon)':    row.tx.bankName || '',
          'Tai Khoan Doi Ung':    row.tx.counterpartyAccount || '',
          'Ten Chu TK Doi Ung':   _flaSafeExcelText(row.tx.counterpartyName || ''),
          'Ngan Hang Doi Ung':    _flaSafeExcelText(row.tx.counterpartyBankName || ''),
          'Do Tin Cay Ten Doi Ung': _flaConfidenceVnLabel(row.tx.counterpartyNameConfidence),
          'Chieu':                isChuyen ? 'CHUYEN' : 'NHAN',
          'Ngay Gio GD':          row.tx.transactionDate || '',
          'So Tien (VND)':        row.tx.amount || 0,
          'Ma Giao Dich':         row.tx.transactionId || '',
          'Nguon Du Lieu':        row.tx.sourceFormat || '',
          'Trang Thai Doi Soat':  row.status === 'MATCHED' ? 'DA KHOP' : row.status === 'AMBIGUOUS' ? 'CHUA XAC DINH DUY NHAT' : 'CHUA KHOP',
          'GD Doi Ung Khop':      row.status === 'MATCHED' ? (row.counterpartId || '') : '',
          'Phuong Phap Khop':     row.status === 'MATCHED' ? (row.matchMethod || '') : '',
          'Bang Chung Khop':      row.status === 'MATCHED' ? _flaReconEvidenceText(row.evidence) : '',
        });
      }
    }
  }
  const ws4 = ws4rows.length
    ? XLSX.utils.json_to_sheet(ws4rows)
    : XLSX.utils.aoa_to_sheet([['Ghi Chu'], ['Tai khoan nay khong co du lieu NAPAS de doi soat.']]);
  _flaForceTextColumns(ws4, ['Tai Khoan Nguon', 'Tai Khoan Doi Ung', 'Ma Giao Dich', 'GD Doi Ung Khop']);
  _flaAutoWidth(ws4);
  XLSX.utils.book_append_sheet(wb, ws4, sheetNames[isPureNapas ? 1 : 3]);

  /* ── SHEET 5 (Phase 25): Truy Tìm Tài Khoản (đầu tư đối tượng theo tên) ──
     INVESTIGATIVE DISCOVERY, not transaction reconciliation. Finds accounts
     at OTHER banks whose owner name — as recorded by some OTHER real NAPAS
     transaction elsewhere in this dataset — exactly matches (after safe
     normalization) an owner name discovered for one of THIS account's own
     bank identities, using the exact same evidence. Never claims the
     accounts belong to the same person; see the disclaimer row below.
     Empty/placeholder for accounts with no NAPAS data or no discoverable
     owner name — same established empty-state convention as Sheets 2/4. */
  const ownIdentitiesSeen = new Map();
  for (const g of matrix) {
    const key = g.accountNumber + '||' + g.bankId;
    if (!ownIdentitiesSeen.has(key)) {
      ownIdentitiesSeen.set(key, { accountNumber: g.accountNumber, bankNameRaw: g.bankName, bankId: g.bankId });
    }
  }
  const counterpartyOwnerIndex = _flaBuildOwnerNameIndex(_flaState.data || []);
  const investigationRows = _flaBuildOwnerInvestigationRows(Array.from(ownIdentitiesSeen.values()), accountOwnerIndex, counterpartyOwnerIndex);

  // Post-Phase-25-fix (docs §16): one row per EVIDENCING NHAN transaction —
  // account → owner → bank → suspicious account → evidence, in that order.
  const ws5DataRows = investigationRows.map(r => ({
    'Tai Khoan Dang Phan Tich':      r.sourceAccount,
    'Ten Chu Tai Khoan':             _flaSafeExcelText(r.sourceOwnerName),
    'Ngan Hang Dang Phan Tich':      r.sourceBank,
    'Tai Khoan Nghi Van':            r.candidateAccount,
    'Ten Chu TK Nghi Van':           _flaSafeExcelText(r.candidateOwnerName),
    'Ngan Hang Nghi Van':            r.candidateBank,
    'Noi Dung Giao Dich':            _flaSafeExcelText(r.content),
    'So REF':                        r.ref,
    'Ngay GD':                       r.date,
    'So Tien':                       r.amount,
    'Huong Giao Dich':               r.direction,
    'Muc Do Tin Cay':                _flaConfidenceVnLabel(r.confidence),
    'Ly Do / Bang Chung':            'Trung ten chu tai khoan nguon (' + _flaConfidenceVnLabel(r.ownerNameConfidence) + ') sau chuan hoa, xuat hien trong noi dung giao dich NHAN nay',
    'Ghi Chu':                       r.note,
  }));

  const SHEET5_DISCLAIMER = [
    ['Day la dau moi nghi van dua tren noi dung giao dich trung ten; khong phai bang chung xac dinh cung chu tai khoan.'],
    ['Chuc nang nay chi phat hien cac tai khoan tai ngan hang khac co cung ten chu tai khoan sau chuan hoa.'],
    ['Ket qua chi mang tinh chat truy tim/nghi van va KHONG chung minh cac tai khoan thuoc cung mot ca nhan/to chuc.'],
    ['Can xac minh bang ho so hoac nguon du lieu nghiep vu phu hop truoc khi su dung ket qua nay lam can cu ket luan.'],
    [],
  ];
  const ws5 = XLSX.utils.aoa_to_sheet(SHEET5_DISCLAIMER);
  if (ws5DataRows.length) {
    const headers = ['Tai Khoan Dang Phan Tich','Ten Chu Tai Khoan','Ngan Hang Dang Phan Tich','Tai Khoan Nghi Van','Ten Chu TK Nghi Van','Ngan Hang Nghi Van','Noi Dung Giao Dich','So REF','Ngay GD','So Tien','Huong Giao Dich','Muc Do Tin Cay','Ly Do / Bang Chung','Ghi Chu'];
    XLSX.utils.sheet_add_aoa(ws5, [headers], { origin: { r: SHEET5_DISCLAIMER.length, c: 0 } });
    XLSX.utils.sheet_add_json(ws5, ws5DataRows, { origin: { r: SHEET5_DISCLAIMER.length + 1, c: 0 }, skipHeader: true, header: headers });
  } else {
    XLSX.utils.sheet_add_aoa(ws5, [['Ghi Chu'], ['Khong co du lieu truy tim tai khoan doi ung theo ten.']], { origin: { r: SHEET5_DISCLAIMER.length, c: 0 } });
  }
  _flaForceTextColumns(ws5, ['Tai Khoan Dang Phan Tich', 'Tai Khoan Nghi Van', 'So REF'], SHEET5_DISCLAIMER.length);
  _flaAutoWidth(ws5);
  XLSX.utils.book_append_sheet(wb, ws5, sheetNames[isPureNapas ? 2 : 4]);

  return wb;
}

/* Phase 18: forces specific columns (matched by exact header text on the
   header row) to Text format (number format '@') so identifier-shaped values
   — account numbers, REF/transaction IDs — are never silently reformatted/
   stripped of leading zeros by Excel on open (e.g. "02963" -> "2963"). The
   source JS values are already strings (SheetJS emits them as string-typed
   cells by default), but Excel's own auto-detection can still reinterpret a
   digits-only string cell as a number unless the cell format is explicitly
   pinned to text — this closes that gap deterministically.
   Phase 25: accepts an optional explicit headerRow index (0-based) for
   sheets whose header isn't on the sheet's very first row — e.g. Sheet 5
   has a few disclaimer lines above its header. Defaults to range.s.r
   (the previous, only behavior), so every existing call site is unaffected. */
function _flaForceTextColumns(ws, headerNames, headerRow) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  if (headerRow === undefined) headerRow = range.s.r;
  const colsToForce = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
    if (cell && headerNames.includes(cell.v)) colsToForce.push(c);
  }
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    for (const c of colsToForce) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        cell.t = 's';
        cell.v = String(cell.v);
        cell.z = '@';
      }
    }
  }
}

/* Auto-width helper cho SheetJS worksheet */
function _flaAutoWidth(ws) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const widths = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    let max = 8;
    for (let R = range.s.r; R <= range.e.r; R++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.v != null) max = Math.max(max, String(cell.v).length);
    }
    widths.push({ wch: Math.min(max + 3, 52) });
  }
  ws['!cols'] = widths;
}

/**
 * Packages N account workbooks into a flat Analysis_Export.zip.
 *
 * ZIP structure (no nested folders):
 *   Analysis_Export.zip
 *   ├── Account_111111.xlsx
 *   ├── Account_222222.xlsx
 *   └── Account_333333.xlsx
 *
 * @param {Object} groups - { [accId]: { transactions, sourceFiles, txCount } }
 * @param {Array}  keys   - account IDs
 */
async function _exportFlaZip(groups, keys) {
  if (typeof JSZip === 'undefined') {
    _showToast('Thư viện JSZip chưa tải — không thể xuất nhiều file.', 'error');
    return;
  }

  showProcessing();
  flaPipelineStatus(`Đang tạo ${keys.length} workbook tài khoản...`);

  try {
    const zip = new JSZip();
    // Post-Phase-25 fix: a NAPAS-only account's workbook has 3 sheets while
    // a legacy/mixed account's has 5 — "N × M sheet" would misreport a mixed
    // batch, so track the real total across whatever each account actually got.
    let totalSheetsAcrossAccounts = 0;

    for (let i = 0; i < keys.length; i++) {
      const accId    = keys[i];
      const entry    = groups[accId];
      const fileName = `Account_${_sanitizeAccId(accId)}.xlsx`;

      flaPipelineStatus(`Xây dựng báo cáo ${i + 1}/${keys.length}: ${accId} (${entry.txCount} GD)...`);
      await new Promise(r => requestAnimationFrame(r));

      const wb  = _buildAccountWorkbook(entry.transactions, accId, entry.sourceFiles);
      totalSheetsAcrossAccounts += wb.SheetNames.length;
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      zip.file(fileName, buf);   // flat — no sub-folders
    }

    flaPipelineStatus('Đang nén ZIP...');
    await new Promise(r => requestAnimationFrame(r));

    const blob = await zip.generateAsync({
      type:               'blob',
      compression:        'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = 'Analysis_Export.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    flaPipelineStatus(`✓ Đã xuất ${keys.length} tài khoản → Analysis_Export.zip`);
    _showToast(
      `✓ Đã xuất ${keys.length} tài khoản → Analysis_Export.zip (tổng ${totalSheetsAcrossAccounts} sheet)`,
      'success'
    );
  } catch (err) {
    console.error('[FLA Export ZIP]', err);
    _showToast(`Lỗi xuất ZIP: ${err.message}`, 'error');
  } finally {
    hideProcessing();
  }
}

/* ── PHONE TOP-UP TAB ────────────────────────────────────────────────────────── */

const VND_TOPUP = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const RISK_COLOR_MAP = { HIGH: '#ff3b30', MEDIUM: '#ff8800', LOW: '#4ade80' };
const FLAG_LABELS = {
  HIGH_TOPUP_FREQUENCY:       'Tần suất cao',
  MULTI_ACCOUNT_TOPUP:        'Nhiều TK',
  HIGH_VALUE_TOPUP:           'Số tiền lớn',
  REPEATED_TOPUP_PATTERN:     'Dồn dập',
  PHONE_SHARED_ACROSS_ACCOUNTS: 'Chia sẻ nhiều TK',
};

function flaRenderTopupTab(topupResult) {
  if (!topupResult) return;

  // Summary stats
  const el = id => document.getElementById(id);
  if (el('topup-stat-phones'))   el('topup-stat-phones').textContent   = topupResult.uniquePhoneCount;
  if (el('topup-stat-count'))    el('topup-stat-count').textContent    = topupResult.totalTopupCount;
  if (el('topup-stat-highrisk')) el('topup-stat-highrisk').textContent = topupResult.highRiskPhones;

  // Leaderboard
  const tbody = el('topup-leaderboard-body');
  if (!tbody) return;
  if (topupResult.aggregations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;font-family:var(--font-mono);">KHÔNG PHÁT HIỆN NẠP TIỀN ĐIỆN THOẠI</td></tr>';
    return;
  }
  tbody.innerHTML = topupResult.aggregations.map(a => {
    const rc = RISK_COLOR_MAP[a.riskLevel] || '#94a3b8';
    const chips = a.riskFlags.map(f =>
      `<span style="font-size:0.55rem;padding:1px 4px;border-radius:2px;background:${rc}22;border:1px solid ${rc}55;color:${rc};margin-right:2px;">${FLAG_LABELS[f] || f}</span>`
    ).join('');
    return `<tr style="cursor:pointer;" onclick="topupShowDetail('${a.phoneNumber}')">
      <td style="font-family:var(--font-mono);color:var(--accent-cyan);font-size:0.7rem;">${a.phoneNumber}</td>
      <td style="font-family:var(--font-mono);font-size:0.7rem;">${a.totalCount}</td>
      <td style="font-family:var(--font-mono);font-size:0.68rem;">${VND_TOPUP.format(a.totalAmount)}</td>
      <td style="font-family:var(--font-mono);font-size:0.7rem;">${a.accountCount}</td>
      <td style="font-size:0.62rem;">${chips || `<span style="color:${rc};font-weight:700;">${a.riskLevel}</span>`}</td>
    </tr>`;
  }).join('');

  // Auto-select top phone
  if (topupResult.aggregations.length > 0) {
    topupShowDetail(topupResult.aggregations[0].phoneNumber);
  }
}

function topupShowDetail(phoneNumber) {
  if (!_flaTopupResult) return;
  const agg = _flaTopupResult.aggregations.find(a => a.phoneNumber === phoneNumber);
  if (!agg) return;

  document.getElementById('topup-selected-phone')?.textContent !== undefined &&
    (document.getElementById('topup-selected-phone').textContent = phoneNumber);

  const rc = RISK_COLOR_MAP[agg.riskLevel] || '#94a3b8';
  const detail = document.getElementById('topup-detail-panel');
  if (!detail) return;

  const txRows = agg.transactions.slice(0, 20).map(t =>
    `<div style="padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="color:var(--text-muted);">${(t.transactionDate||'').slice(0,10)}</span>
      <span style="color:var(--accent-cyan);margin-left:6px;">${t.accountNumber}</span>
      <span style="margin-left:6px;">${t.bankName}</span>
      <span style="color:#ff8800;font-weight:700;margin-left:6px;">${VND_TOPUP.format(t.amount)}</span>
      <div style="color:var(--text-muted);font-size:0.58rem;margin-top:1px;">${(t.rawDescription||'').slice(0,80)}</div>
    </div>`
  ).join('');

  detail.innerHTML = `
    <div style="color:${rc};font-weight:700;margin-bottom:6px;">
      ${phoneNumber} — ${agg.totalCount} lần · ${VND_TOPUP.format(agg.totalAmount)} VND · ${agg.riskLevel}
    </div>
    <div style="font-size:0.62rem;color:var(--text-muted);margin-bottom:4px;">
      Tài khoản: ${agg.fundingAccounts.join(', ')}
      · Ngân hàng: ${agg.fundingBanks.join(', ')}
      · Từ ${agg.firstDate?.slice(0,10)||'—'} đến ${agg.lastDate?.slice(0,10)||'—'}
    </div>
    <div style="font-size:0.6rem;font-weight:700;margin-bottom:6px;color:${rc};">${agg.riskFlags.map(f => FLAG_LABELS[f]||f).join(' · ') || '—'}</div>
    ${txRows}
  `;
}

/* ── EXPORT PREVIEW PANEL ────────────────────────────────────────────────────── */

/**
 * Renders the account export preview table in the export bar.
 * Called from flaLoadData() after account scores are available.
 *
 * Displays:
 *   - Accounts Detected: N
 *   - Export Mode: XLSX (single) / ZIP (multiple)
 *   - Per-account table: account number | tx count | fraud score | risk level | status
 */
function flaRenderExportPreview() {
  const previewEl = document.getElementById('fla-export-preview');
  if (!previewEl) return;

  const data = _flaState.data;
  if (!data || data.length === 0) {
    previewEl.style.display = 'none';
    return;
  }

  const groups  = AccountExportGrouping.group(data, _flaUploadedFiles);
  const preview = AccountExportGrouping.buildPreview(groups, _flaAccountScores);
  const keys    = Object.keys(groups);
  const isMulti = keys.length > 1;

  // ── Account count badge ────────────────────────────────────────────────────
  const countEl = document.getElementById('fla-export-account-count');
  if (countEl) {
    countEl.textContent = `Phát hiện: ${keys.length} tài khoản`;
  }

  // ── Export mode label ──────────────────────────────────────────────────────
  const modeEl = document.getElementById('fla-export-mode');
  if (modeEl) {
    modeEl.textContent = isMulti
      ? `Chế độ: ZIP (${keys.length} tài khoản → Analysis_Export.zip)`
      : `Chế độ: XLSX (1 tài khoản → Account_${_sanitizeAccId(keys[0])}.xlsx)`;
    modeEl.style.color = isMulti ? '#ff8800' : 'var(--accent-cyan)';
  }

  // ── Export button label ────────────────────────────────────────────────────
  const btnEl = document.getElementById('fla-export-btn');
  if (btnEl) {
    btnEl.textContent = isMulti
      ? `⬇  XUẤT ${keys.length} TÀI KHOẢN → Analysis_Export.zip`
      : `⬇  XUẤT Account_${_sanitizeAccId(keys[0])}.xlsx`;
  }

  // ── Preview table rows ─────────────────────────────────────────────────────
  const RISK_C = { CRITICAL: '#ff3b30', HIGH: '#ff8800', MEDIUM: '#ffcc00', LOW: '#4ade80' };
  const tbody  = document.getElementById('fla-export-preview-tbody');
  if (tbody) {
    tbody.innerHTML = preview.map(row => {
      const rc        = RISK_C[row.riskLevel] || '#94a3b8';
      const scoreStr  = row.fraudScore != null ? row.fraudScore : '—';
      const srcNote   = row.sourceCount > 1 ? ` · ${row.sourceCount} file` : '';
      return `<tr>
        <td style="padding:3px 8px;font-family:var(--font-mono);font-size:0.68rem;color:var(--accent-cyan);">${row.accountNumber}</td>
        <td style="padding:3px 8px;font-family:var(--font-mono);font-size:0.68rem;">${row.txCount}</td>
        <td style="padding:3px 8px;font-family:var(--font-mono);font-size:0.68rem;color:${rc};font-weight:700;">${scoreStr}</td>
        <td style="padding:3px 8px;font-size:0.65rem;font-family:var(--font-mono);color:${rc};font-weight:700;">${row.riskLevel}${srcNote}</td>
        <td style="padding:3px 8px;font-size:0.65rem;color:var(--text-muted);font-family:var(--font-mono);">SẴNG SÀNG</td>
      </tr>`;
    }).join('');
  }

  // ── Export info text ───────────────────────────────────────────────────────
  // Post-Phase-25 fix: this preview covers the whole uploaded dataset, which
  // may span multiple accounts of different source formats — report the
  // NAPAS-only 3-sheet layout only when EVERY transaction in view is NAPAS;
  // otherwise fall back to the full (safe, never-understated) 5-sheet layout.
  const infoEl = document.getElementById('fla-export-info');
  if (infoEl) {
    const previewSheetNames = _flaGetExportSheetNames(_flaIsPureNapasExport(data));
    infoEl.textContent =
      `${data.length} GD · ${previewSheetNames.length} sheet · ${keys.length} TK · ` +
      previewSheetNames.join(' + ');
  }

  previewEl.style.display = 'block';
}

/* ══════════════════════════════════════════════════════════════════════════════
   PHASE 4 — CASE MANAGEMENT CENTER
   ══════════════════════════════════════════════════════════════════════════════ */

function initCasesModule() {
  casesRenderList();
  document.getElementById('cases-new-btn')?.addEventListener('click', () => {
    _showToast('Nạp sao kê tại phân hệ FLA để tạo vụ án mới.', 'info');
    // Switch to FLA screen
    document.querySelector('.nav-item[data-screen="fla"]')?.click();
  });
}

/* ── CASE LIST RENDER ─────────────────────────────────────────────────────────── */

function casesRenderList() {
  const listEl = document.getElementById('cases-list');
  if (!listEl) return;

  const cases = InvestigationCaseEngine.listCases();
  if (cases.length === 0) {
    listEl.innerHTML = `<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.7rem;padding:20px;text-align:center;">
      CHƯA CÓ VỤ ÁN NÀO<br>Nạp sao kê tại FLA để bắt đầu.
    </div>`;
    return;
  }

  listEl.innerHTML = cases.map(meta => {
    const stateColor = InvestigationCaseEngine.getStateColor(meta.state);
    const stateLabel = InvestigationCaseEngine.getStateLabel(meta.state);
    const isActive   = meta.caseId === _flaActiveCaseId;
    const isLocked   = meta.state === 'LOCKED';
    const critColor  = meta.criticalCount > 0 ? '#ff3b30' : 'var(--text-muted)';

    return `<div class="case-list-item${isActive ? ' active' : ''}"
      onclick="casesSelectCase('${meta.caseId}')" data-caseid="${meta.caseId}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-family:var(--font-mono);font-size:0.65rem;color:var(--accent-cyan);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px;"
          title="${meta.name}">${meta.name}</span>
        <span style="font-family:var(--font-mono);font-size:0.58rem;color:${stateColor};white-space:nowrap;">●&nbsp;${stateLabel.split('—')[0].trim()}</span>
      </div>
      <div style="font-family:var(--font-mono);font-size:0.6rem;color:var(--text-muted);margin-top:2px;">
        ${meta.txCount} GD · ${meta.accountCount} TK
        <span style="color:${critColor};font-weight:700;">${meta.criticalCount > 0 ? '· '+meta.criticalCount+' CRIT' : ''}</span>
      </div>
      <div style="display:flex;gap:4px;margin-top:4px;">
        ${!isLocked && meta.state === 'REPORT_GENERATED'
          ? `<button class="btn-page" style="font-size:0.55rem;padding:2px 6px;" onclick="event.stopPropagation();casesLockCase('${meta.caseId}')">🔒 KHOÁ</button>` : ''}
        ${!isLocked
          ? `<button class="btn-page" style="font-size:0.55rem;padding:2px 6px;border-color:#ff3b30;color:#ff3b30;" onclick="event.stopPropagation();casesDeleteCase('${meta.caseId}')">✕ XOÁ</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

/* ── CASE DETAIL VIEW ────────────────────────────────────────────────────────── */

function casesSelectCase(caseId) {
  // Highlight selected
  document.querySelectorAll('.case-list-item').forEach(el => {
    el.classList.toggle('active', el.dataset.caseid === caseId);
  });

  const meta = InvestigationCaseEngine.getCaseMeta(caseId);
  const data = InvestigationCaseEngine.getCase(caseId);

  const headerEl = document.getElementById('cases-detail-header');
  if (headerEl && meta) {
    const stateColor = InvestigationCaseEngine.getStateColor(meta.state);
    headerEl.innerHTML = `
      <span style="color:var(--accent-cyan);font-weight:700;">${meta.name}</span>
      <span style="color:${stateColor};font-size:0.65rem;margin-left:8px;">● ${InvestigationCaseEngine.getStateLabel(meta.state)}</span>
      <span style="font-size:0.6rem;color:var(--text-muted);margin-left:12px;">${meta.caseId}</span>
    `;
  }

  // Metrics
  const metricsEl = document.getElementById('cases-metrics');
  if (metricsEl && meta) {
    metricsEl.innerHTML = `
      <div class="sh-metric-box"><div class="sh-label">GIAO DỊCH</div><div class="sh-value cyan">${meta.txCount}</div></div>
      <div class="sh-metric-box"><div class="sh-label">TÀI KHOẢN</div><div class="sh-value">${meta.accountCount}</div></div>
      <div class="sh-metric-box"><div class="sh-label">CRITICAL</div><div class="sh-value danger">${meta.criticalCount}</div></div>
      <div class="sh-metric-box"><div class="sh-label">ĐIỂM CAO NHẤT</div><div class="sh-value danger">${meta.topRiskScore}</div></div>
      <div class="sh-metric-box"><div class="sh-label">SỰ CỐ</div><div class="sh-value warn">${meta.incidentCount}</div></div>
      <div class="sh-metric-box"><div class="sh-label">ENGINE</div><div class="sh-value" style="font-size:0.62rem;">v${meta.engineVersion||'—'}</div></div>
    `;
  }

  // Snapshot info
  const snapEl = document.getElementById('cases-snapshot');
  if (snapEl) {
    const snap = data?.snapshot;
    if (snap) {
      const integrity = data?.validationResult?.overallIntegrity || '—';
      const intColor  = SystemValidationEngine.getIntegrityColor(integrity);
      snapEl.innerHTML = `
        <div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--text-secondary);line-height:1.8;">
          <div><span style="color:var(--text-muted);">SNAPSHOT: </span>${snap.snapshotId}</div>
          <div><span style="color:var(--text-muted);">HASH: </span><span style="color:var(--accent-cyan);">${snap.systemHash}</span></div>
          <div><span style="color:var(--text-muted);">INTEGRITY: </span><span style="color:${intColor};font-weight:700;">${integrity}</span></div>
          <div><span style="color:var(--text-muted);">RE-PRODUCE: </span>${snap.isReproducible ? '✓ Đảm bảo' : '✗ Không đảm bảo'}</div>
        </div>
      `;
    } else {
      snapEl.innerHTML = `<div style="color:var(--text-muted);font-size:0.68rem;font-family:var(--font-mono);">Dữ liệu chưa có trong bộ nhớ — cần tải lại hoặc nạp lại file.</div>`;
    }
  }

  // Incidents
  casesRenderIncidents(data?.incidents || []);

  // Validation checks
  casesRenderValidation(data?.validationResult);

  // Drift
  caseRenderDrift(data?.driftResult);

  // SRAU beacon badge
  _casesLoadBeaconBadge(caseId);
}

async function _casesLoadBeaconBadge(caseId) {
  const badge  = document.getElementById('cases-beacon-badge');
  const gotoBtn = document.getElementById('cases-beacon-goto');
  if (!badge) return;

  if (typeof _SRAU === 'undefined' || !_SRAU) {
    badge.textContent = '—';
    return;
  }

  badge.textContent = '…';
  try {
    const tokens    = await _SRAU.loadTokens(caseId);
    const total     = tokens.length;
    const totalHits = tokens.reduce((s, t) => s + (t.hit_count || 0), 0);

    if (total === 0) {
      badge.textContent = 'Chưa có beacon';
      badge.style.color = 'var(--text-muted)';
      if (gotoBtn) gotoBtn.style.display = 'none';
    } else {
      badge.textContent = `${total} BEACON · ${totalHits} HIT`;
      badge.style.color = totalHits > 0 ? 'var(--accent-cyan)' : 'var(--text-secondary)';
      if (gotoBtn) gotoBtn.style.display = 'inline-block';
    }
  } catch (_) {
    badge.textContent = 'Logger offline';
    badge.style.color = 'var(--text-muted)';
    if (gotoBtn) gotoBtn.style.display = 'none';
  }
}

function casesRenderIncidents(incidents) {
  const el = document.getElementById('cases-incidents');
  if (!el) return;
  if (!incidents.length) {
    el.innerHTML = `<div style="color:var(--text-muted);font-size:0.68rem;font-family:var(--font-mono);">Không có sự cố</div>`;
    return;
  }
  const summary = SOCIncidentEngine.getSeveritySummary(incidents);
  el.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;font-family:var(--font-mono);font-size:0.6rem;">
      <span style="color:#ff3b30;">CRIT:${summary.CRITICAL}</span>
      <span style="color:#ff8800;">HIGH:${summary.HIGH}</span>
      <span style="color:#ffcc00;">MED:${summary.MEDIUM}</span>
      <span style="color:var(--text-muted);">Mở:${summary.OPEN} / Giải quyết:${summary.RESOLVED}</span>
    </div>
    ${incidents.slice(0, 8).map(inc => {
      const sc = SOCIncidentEngine.getSeverityColor(inc.severity);
      return `<div style="padding:5px 8px;margin-bottom:4px;border-left:3px solid ${sc};background:rgba(255,255,255,0.02);font-family:var(--font-mono);font-size:0.62rem;">
        <div style="color:${sc};font-weight:700;">${inc.incidentId} [${inc.severity}]</div>
        <div style="color:var(--text-secondary);">${inc.title}</div>
        <div style="color:var(--text-muted);font-size:0.58rem;">${SOCIncidentEngine.getStateLabel(inc.state)}</div>
      </div>`;
    }).join('')}
  `;
}

function casesRenderValidation(valResult) {
  const el = document.getElementById('cases-validation');
  if (!el) return;
  if (!valResult) { el.innerHTML = `<div style="color:var(--text-muted);font-size:0.68rem;font-family:var(--font-mono);">Chưa xác minh</div>`; return; }
  const color = SystemValidationEngine.getIntegrityColor(valResult.overallIntegrity);
  el.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:0.62rem;">
      <div style="color:${color};font-weight:700;margin-bottom:6px;">${SystemValidationEngine.getIntegrityLabel(valResult.overallIntegrity)}</div>
      <div style="margin-bottom:4px;color:var(--text-muted);">${valResult.passCount}/${valResult.total} kiểm tra qua (${valResult.integrityPct}%)</div>
      ${valResult.checks.map(c =>
        `<div style="color:${c.passed?'#4ade80':'#ff3b30'};font-size:0.58rem;">${c.passed?'✓':'✗'} ${c.name}</div>`
      ).join('')}
    </div>`;
}

function caseRenderDrift(driftResult) {
  const el = document.getElementById('cases-drift');
  if (!el) return;
  if (!driftResult) { el.innerHTML = `<div style="color:var(--text-muted);font-size:0.68rem;font-family:var(--font-mono);">${CaseDriftProtection.caseCount() < 3 ? 'Cần ≥3 vụ án để phát hiện trôi dạt' : 'Không phát hiện trôi dạt'}</div>`; return; }
  el.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:0.62rem;">
      <div style="color:${driftResult.hasDrift?'#ffcc00':'#4ade80'};font-weight:700;margin-bottom:4px;">
        ${driftResult.hasDrift ? '⚠ '+driftResult.message : '✓ '+driftResult.message}
      </div>
      ${(driftResult.alerts||[]).map(a =>
        `<div style="color:#ffcc00;font-size:0.58rem;">▸ ${a.detail} (${a.direction})</div>`
      ).join('')}
    </div>`;
}

/* ── CASE ACTIONS ─────────────────────────────────────────────────────────────── */

function casesLockCase(caseId) {
  if (!confirm(`Khoá vụ án ${caseId}? Sau khi khoá, dữ liệu sẽ không thể sửa đổi.`)) return;
  const ok = InvestigationCaseEngine.lockCase(caseId);
  if (ok) {
    FraudGovernanceLayer.lockAuditStore();
    _showToast(`Vụ án ${caseId} đã khoá (bất biến).`, 'success');
    casesRenderList();
    casesSelectCase(caseId);
  }
}

function casesDeleteCase(caseId) {
  if (!confirm(`Xoá vụ án ${caseId}? Thao tác không thể hoàn tác.`)) return;
  const result = InvestigationCaseEngine.deleteCase(caseId);
  if (result.success) {
    if (_flaActiveCaseId === caseId) _flaActiveCaseId = null;
    _showToast(`Đã xoá vụ án ${caseId}.`, 'success');
    casesRenderList();
    document.getElementById('cases-detail-header')?.innerHTML?.length > 0 &&
      (document.getElementById('cases-detail-header').innerHTML = '<span style="color:var(--text-muted);">Chọn vụ án từ danh sách bên trái</span>');
  } else {
    _showToast(`Không thể xoá: ${result.reason}`, 'error');
  }
}

function casesReplayCase(caseId) {
  const replayData = InvestigationCaseEngine.replayCase(caseId);
  if (!replayData) { _showToast('Vụ án không có dữ liệu trong bộ nhớ. Nạp lại file để tái tạo.', 'error'); return; }
  // Load the stored data back into the active FLA view
  _flaGraphResult     = replayData.graphResult;
  _flaAccountScores   = replayData.accountScores;
  _flaInvestigReport  = replayData.investigReport;
  _flaAuditStore      = replayData.auditStore;
  _flaObsMetrics      = replayData.obsMetrics;
  _flaActiveCaseId    = caseId;
  if (replayData.transactions?.length) flaLoadData(replayData.transactions);
  _showToast(`Đã tái tạo vụ án ${caseId} (${replayData.transactions?.length||0} GD).`, 'success');
}

/* 5. Chart Analytics Engine */
let _gtpCharts = {};
let _flaCharts = {};

function initChartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.color = '#64748b';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
  Chart.defaults.font.family = "'Roboto Mono', monospace";
  Chart.defaults.font.size = 10;
}

function _destroyCharts(registry) {
  Object.values(registry).forEach(c => { try { c.destroy(); } catch (_) {} });
  for (const k in registry) delete registry[k];
}

function renderGtpCharts(data) {
  if (typeof Chart === 'undefined') return;

  const section = document.getElementById('gtp-charts');
  section.style.display = 'flex';

  hideChartSkeleton('gtp-charts');
  _destroyCharts(_gtpCharts);

  const GRID = 'rgba(255,255,255,0.04)';
  const CYAN = '#00f0ff';
  const CYAN_BG = 'rgba(0,240,255,0.18)';

  // --- Signal Strength Timeline ---
  const dBmValues = data.map(d => {
    const m = d.strength.match(/-\d+/);
    return m ? parseInt(m[0]) : null;
  });

  _gtpCharts.signal = new Chart(document.getElementById('chart-signal'), {
    type: 'line',
    data: {
      labels: data.map(d => d.time),
      datasets: [{
        data: dBmValues,
        borderColor: CYAN,
        backgroundColor: 'rgba(0,240,255,0.07)',
        pointBackgroundColor: CYAN,
        pointBorderColor: 'transparent',
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.35,
        fill: true,
        borderWidth: 1.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.raw} dBm` } }
      },
      scales: {
        x: { grid: { color: GRID }, ticks: { maxRotation: 0 } },
        y: { grid: { color: GRID }, min: -110, max: -55 }
      }
    }
  });

  // --- LAC Zone Activity ---
  const lacMap = {};
  data.forEach(d => { lacMap[d.lac] = (lacMap[d.lac] || 0) + 1; });

  _gtpCharts.lac = new Chart(document.getElementById('chart-lac'), {
    type: 'bar',
    data: {
      labels: Object.keys(lacMap),
      datasets: [{
        data: Object.values(lacMap),
        backgroundColor: CYAN_BG,
        borderColor: CYAN,
        borderWidth: 1,
        borderRadius: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: GRID }, ticks: { stepSize: 1 }, beginAtZero: true }
      }
    }
  });

  // --- Movement Timeline (cumulative step count as proxy for activity) ---
  const cumulativeSteps = data.map((_, i) => i + 1);

  _gtpCharts.movement = new Chart(document.getElementById('chart-movement'), {
    type: 'line',
    data: {
      labels: data.map(d => d.time),
      datasets: [{
        data: cumulativeSteps,
        borderColor: 'rgba(0,240,255,0.7)',
        backgroundColor: 'transparent',
        pointBackgroundColor: data.map(d => {
          const m = d.strength.match(/-\d+/);
          const dbm = m ? parseInt(m[0]) : -80;
          return dbm >= -75 ? CYAN : dbm >= -85 ? '#ffcc00' : '#ff3b30';
        }),
        pointBorderColor: 'transparent',
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0,
        fill: false,
        borderWidth: 1,
        borderDash: [4, 3],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = data[ctx.dataIndex];
              return `${d.label} — ${d.strength}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { color: GRID }, ticks: { maxRotation: 0 } },
        y: { display: false }
      }
    }
  });
}

function renderFlaCharts(data) {
  if (typeof Chart === 'undefined') return;

  const section = document.getElementById('fla-charts');
  if (!section) return;
  section.style.display = 'grid';

  hideChartSkeleton('fla-charts');
  // Only destroy transaction-specific charts, not AI charts
  if (_flaCharts.hourly) { try { _flaCharts.hourly.destroy(); } catch(_){} delete _flaCharts.hourly; }
  if (_flaCharts.amounts) { try { _flaCharts.amounts.destroy(); } catch(_){} delete _flaCharts.amounts; }

  const GRID = 'rgba(255,255,255,0.04)';
  const DANGER_HOURS = new Set([23, 0, 1, 2, 3, 4]);

  // --- Hourly Distribution ---
  const hourBuckets = new Array(24).fill(0);
  data.forEach(d => {
    const dateStr = d.transactionDate || d.date || '';
    const m = dateStr.match(/[T\s](\d{2}):/);
    if (m) hourBuckets[parseInt(m[1])]++;
  });

  const hourlyCtx = document.getElementById('chart-hourly');
  if (hourlyCtx) {
    _flaCharts.hourly = new Chart(hourlyCtx, {
      type: 'bar',
      data: {
        labels: Array.from({ length: 24 }, (_, i) => i),
        datasets: [{
          data: hourBuckets,
          backgroundColor: hourBuckets.map((_, i) =>
            DANGER_HOURS.has(i) ? 'rgba(255,59,48,0.55)' : 'rgba(0,240,255,0.22)'
          ),
          borderColor: hourBuckets.map((_, i) =>
            DANGER_HOURS.has(i) ? '#ff3b30' : '#00f0ff'
          ),
          borderWidth: 1,
          borderRadius: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { callback: v => `${v}h`, maxTicksLimit: 12 } },
          y: { grid: { color: GRID }, ticks: { stepSize: 1 }, beginAtZero: true }
        }
      }
    });
  }

  // --- Transaction Amounts (with risk color) ---
  const amountsCtx = document.getElementById('chart-amounts');
  if (amountsCtx) {
    const sample = data.slice(0, 200); // limit for performance
    _flaCharts.amounts = new Chart(amountsCtx, {
      type: 'bar',
      data: {
        labels: sample.map((_, i) => `#${i + 1}`),
        datasets: [{
          data: sample.map(d => Math.round(d.amount / 1_000_000)),
          backgroundColor: sample.map(d => {
            const rl = d.riskLevel;
            if (rl === 'CRITICAL') return 'rgba(255,59,48,0.55)';
            if (rl === 'HIGH') return 'rgba(255,136,0,0.45)';
            if (rl === 'MEDIUM') return 'rgba(255,204,0,0.35)';
            return d.transactionType === 'IN' ? 'rgba(74,222,128,0.25)' : 'rgba(0,240,255,0.22)';
          }),
          borderColor: sample.map(d => {
            const rl = d.riskLevel;
            if (rl === 'CRITICAL') return '#ff3b30';
            if (rl === 'HIGH') return '#ff8800';
            if (rl === 'MEDIUM') return '#ffcc00';
            return d.transactionType === 'IN' ? '#4ade80' : '#00f0ff';
          }),
          borderWidth: 1,
          borderRadius: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const item = sample[ctx.dataIndex];
                return `${(item.amount / 1_000_000).toFixed(1)}tr — ${item.bankName||item.bank} [${item.riskLevel||''}]`;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            grid: { color: GRID },
            ticks: { callback: v => `${v}tr` }
          }
        }
      }
    });
  }
}

/* === Workspace UX: Panels / Resize / Notes / Pins / Focus === */

function _wsInitVerticalResize() {
  const items = [
    // Right panel: radar SVG height
    {
      handleId: 'gtp-vresize-radar',
      targetSel: '#gtp-screen .radar-grid-container',
      storeKey:  'gtp_radar_h',
      defaultH:  220,
      minH: 80,
      maxH: 560,
    },
    // Right panel: table height
    {
      handleId: 'gtp-vresize-table',
      targetSel: '#gtp-table-wrapper',
      storeKey:  'gtp_table_h',
      defaultH:  260,
      minH: 100,
      maxH: 640,
    },
    // Left panel: NẠP TỆP block height
    {
      handleId: 'gtp-vresize-ctrl',
      targetSel: '#gtp-control-panel .panel-block:first-of-type',
      storeKey:  'gtp_ctrl_h',
      defaultH:  null,   // use element's natural height on first drag
      minH: 140,
      maxH: 700,
    },
  ];

  items.forEach(({ handleId, targetSel, storeKey, defaultH, minH, maxH }) => {
    const handle = document.getElementById(handleId);
    const target = document.querySelector(targetSel);
    if (!handle || !target) return;

    // Restore saved height
    const saved = _wsState.get(storeKey, defaultH);
    if (saved !== null) target.style.height = saved + 'px';

    let startY = 0, startH = 0;

    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      startY = e.clientY;
      startH = target.getBoundingClientRect().height;
      handle.classList.add('is-dragging');
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const onMove = ev => {
        const h = Math.min(maxH, Math.max(minH, startH + (ev.clientY - startY)));
        target.style.height = h + 'px';
      };
      const onUp = () => {
        const h = Math.round(target.getBoundingClientRect().height);
        _wsState.set(storeKey, h);
        handle.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

function initWorkspaceUX() {
  _wsInitCollapsible();
  _wsInitResize();
  _wsInitVerticalResize();
  _wsInitDockToggles();
  _wsInitNotes();
  _wsInitPins();
  _wsInitFocusMode();
}

const _wsState = (() => {
  const KEY = 'sentinel_ws';
  let data = {};
  try { data = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (_) {} };
  return {
    get: (k, def) => (data[k] !== undefined ? data[k] : def),
    set: (k, v)  => { data[k] = v; save(); },
  };
})();

function _wsInitCollapsible() {
  ['gtp', 'fla', 'batch'].forEach(mod => {
    const btn   = document.getElementById(`${mod}-collapse-btn`);
    const panel = document.getElementById(`${mod}-control-panel`);
    if (!btn || !panel) return;

    const apply = collapsed => {
      panel.classList.toggle('collapsed', collapsed);
      btn.textContent = collapsed ? '▶' : '◀ THU';
    };

    apply(_wsState.get(`panel_collapsed_${mod}`, false));

    btn.addEventListener('click', () => {
      const next = !panel.classList.contains('collapsed');
      apply(next);
      _wsState.set(`panel_collapsed_${mod}`, next);
    });
  });
}

function _wsInitResize() {
  ['gtp', 'fla', 'batch'].forEach(mod => {
    const handle = document.getElementById(`${mod}-resize-handle`);
    const panel  = document.getElementById(`${mod}-control-panel`);
    if (!handle || !panel) return;

    const saved = _wsState.get(`panel_width_${mod}`, null);
    if (saved) panel.style.width = saved + 'px';

    let startX = 0, startW = 0;

    handle.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      startX = e.clientX;
      startW = panel.getBoundingClientRect().width;
      handle.classList.add('is-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = ev => {
        const w = Math.min(520, Math.max(220, startW + (ev.clientX - startX)));
        panel.style.width = w + 'px';
      };
      const onUp = () => {
        _wsState.set(`panel_width_${mod}`, Math.round(panel.getBoundingClientRect().width));
        handle.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

function _wsInitDockToggles() {
  document.querySelectorAll('#gtp-screen .panel-block .panel-block-title, #fla-screen .panel-block .panel-block-title')
    .forEach((title, idx) => {
      const block  = title.closest('.panel-block');
      const screen = block.closest('.screen')?.id?.replace('-screen', '') || 'x';
      const key    = `dock_${screen}_${idx}`;

      const btn = document.createElement('button');
      btn.className = 'dock-btn';
      btn.title = 'Thu gọn / Mở rộng';
      title.appendChild(btn);

      const apply = docked => {
        block.classList.toggle('is-docked', docked);
        btn.textContent = docked ? '⊕' : '⊟';
      };

      apply(_wsState.get(key, false));

      btn.addEventListener('click', e => {
        e.stopPropagation();
        const next = !block.classList.contains('is-docked');
        apply(next);
        _wsState.set(key, next);
      });
    });
}

function _wsInitNotes() {
  const toggleBtn = document.getElementById('btn-notes-toggle');
  const panel     = document.getElementById('notes-panel');
  const textarea  = document.getElementById('notes-textarea');
  const clearBtn  = document.getElementById('notes-clear-btn');
  const counter   = document.getElementById('notes-char-count');
  if (!toggleBtn || !panel || !textarea) return;

  const updateCount = () => { if (counter) counter.textContent = `${textarea.value.length} ký tự`; };

  textarea.value = _wsState.get('notes', '');
  updateCount();

  const setOpen = open => {
    panel.classList.toggle('open', open);
    toggleBtn.classList.toggle('active', open);
    _wsState.set('notes_open', open);
    if (open) setTimeout(() => textarea.focus(), 60);
  };

  setOpen(_wsState.get('notes_open', false));

  toggleBtn.addEventListener('click', () => setOpen(!panel.classList.contains('open')));

  textarea.addEventListener('input', () => {
    _wsState.set('notes', textarea.value);
    updateCount();
  });

  clearBtn?.addEventListener('click', () => {
    textarea.value = '';
    _wsState.set('notes', '');
    updateCount();
  });
}

function _wsInitPins() {
  const section = document.getElementById('pinned-section');
  const row     = document.getElementById('pinned-cards-row');
  if (!section || !row) return;

  const render = () => {
    const pins = [...document.querySelectorAll('.pin-btn.pinned')];
    row.innerHTML = '';
    section.classList.toggle('visible', pins.length > 0);
    pins.forEach(btn => {
      const key   = btn.dataset.pin;
      const label = btn.dataset.label || key.toUpperCase();
      const chip  = document.createElement('div');
      chip.className = 'pinned-chip';
      chip.innerHTML = `<span class="chip-icon">📌</span><span>${label}</span><span class="chip-close">✕</span>`;
      chip.querySelector('.chip-close').addEventListener('click', e => {
        e.stopPropagation();
        const b = document.querySelector(`.pin-btn[data-pin="${key}"]`);
        if (b) { b.classList.remove('pinned'); _wsState.set(`pin_${key}`, false); }
        render();
      });
      chip.addEventListener('click', e => {
        if (!e.target.classList.contains('chip-close'))
          document.querySelector(`.nav-item[data-screen="${key}"]`)?.click();
      });
      row.appendChild(chip);
    });
  };

  document.querySelectorAll('.pin-btn').forEach(btn => {
    if (_wsState.get(`pin_${btn.dataset.pin}`, false)) btn.classList.add('pinned');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const next = !btn.classList.contains('pinned');
      btn.classList.toggle('pinned', next);
      _wsState.set(`pin_${btn.dataset.pin}`, next);
      render();
    });
  });

  render();
}

function _wsInitFocusMode() {
  const btn = document.getElementById('btn-focus-toggle');
  if (!btn) return;

  const apply = active => {
    document.body.classList.toggle('focus-mode', active);
    btn.classList.toggle('active', active);
    btn.textContent = active ? '⛶ EXIT' : '⛶ FOCUS';
    _wsState.set('focus_mode', active);
  };

  apply(_wsState.get('focus_mode', false));
  btn.addEventListener('click', () => apply(!document.body.classList.contains('focus-mode')));
}

/* 6. Phân Hệ C - SRAU: Secure Endpoint Audit Utility */
function initSrauModule() {
  if (typeof _SRAU === 'undefined') return;
  // Điền giá trị đã lưu vào ô server URL và API key
  const serverInp = document.getElementById('srau-server-input');
  if (serverInp) serverInp.value = _SRAU.currentBase;
  const keyInp = document.getElementById('srau-apikey-input');
  if (keyInp) keyInp.value = _SRAU.currentKey;
  _SRAU.init();
}

function _srauApplyServer() {
  const inp = document.getElementById('srau-server-input');
  if (!inp || !inp.value.trim()) return;
  _SRAU.setApiBase(inp.value.trim());
  inp.blur();
}

function _srauApplyApiKey() {
  const inp = document.getElementById('srau-apikey-input');
  if (!inp || !inp.value.trim()) return;
  _SRAU.setApiKey(inp.value.trim());
  inp.blur();
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLA INTELLIGENCE — Tần suất dòng tiền + Ví điện tử
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Parse date → ms ────────────────────────────────────────────────────── */
function _flaDateMs(s) {
  if (!s) return 0;
  const str = String(s);
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
  if (m) {
    const ts = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}:00`).getTime();
    return isNaN(ts) ? 0 : ts;
  }
  const ts = new Date(str).getTime();
  return isNaN(ts) ? 0 : ts;
}

/* ── Tần suất dòng tiền TK nguồn × TK đối ứng ──────────────────────────── */
/* ── Phase 5: minimal HTML-escaping helper ──────────────────────────────────
   No such helper existed anywhere in app.js before this. Scoped narrowly:
   applied only to the cells this Phase 5 change touches in
   _renderAccountFlowTab (counterparty name/bank, own bank, account numbers
   — all sourced from user-supplied spreadsheet content). Not a project-wide
   security refactor — other render functions are unchanged and out of scope
   (docs/NAPAS_UPGRADE_SPEC.md Phase 5 status, "Security" section). */
function _escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ── Phase 5: counterpartyNameConfidence ordering, for picking the best-
   evidenced name within a group instead of "first transaction wins"
   (never applied to legacy transactions — see buildAccountFlowMatrix). ── */
function _flaConfidenceRank(c) {
  switch (c) {
    case 'CONFIRMED': return 3;
    case 'INFERRED':  return 2;
    case 'AMBIGUOUS': return 1;
    case 'UNKNOWN':   return 0;
    default:          return -1; // null/undefined — no resolution attempted
  }
}

function buildAccountFlowMatrix(transactions) {
  const groups = {};
  for (const tx of transactions) {
    const src = (tx.accountNumber || '').trim() || 'UNKNOWN';
    const cp  = (tx.counterpartyAccount || '').trim() || 'CHUA_XAC_DINH';
    const isNapas = tx.sourceFormat === 'NAPAS';
    const rawBank = tx.bankName || tx.bank || '';
    // Phase 5 fix: the same accountNumber can legitimately appear under
    // several different own banks in one NAPAS case (docs/NAPAS_UPGRADE_SPEC.md
    // §4.E, e.g. 371010_5678 — ACB/Vietcombank/Techcombank). Without the own
    // bank in the key, transactions from different banks that happen to
    // share a counterparty account would wrongly collapse into one row.
    // Gated to NAPAS only — the key for every non-NAPAS (legacy) transaction
    // is left byte-identical to before this change, so existing bank
    // statement behavior is unaffected.
    const bankId = isNapas ? (BankParser.normalizeBankName(rawBank) || rawBank) : rawBank;
    const key = isNapas ? (src + '||' + cp + '||' + bankId) : (src + '||' + cp);
    if (!groups[key]) {
      groups[key] = {
        accountNumber: src, counterpartyAccount: cp,
        counterpartyName: isNapas ? null : (tx.counterpartyName || ''),
        counterpartyNameConfidence: null,
        counterpartyBankName: tx.counterpartyBankName || '',
        bankName: rawBank, bankId,
        sourceFormat: tx.sourceFormat || null,
        totalCount: 0, sumIN: 0, sumOUT: 0,
        firstDate: '', lastDate: '', firstMs: Infinity, lastMs: 0,
      };
    }
    const g = groups[key];
    g.totalCount++;
    if (tx.transactionType === 'IN')       g.sumIN  += (tx.amount || 0);
    else if (tx.transactionType === 'OUT') g.sumOUT += (tx.amount || 0);

    if (isNapas) {
      // Pick the highest-confidence resolved name seen across this group's
      // transactions — never an arbitrary "first transaction wins" pick.
      if (_flaConfidenceRank(tx.counterpartyNameConfidence) > _flaConfidenceRank(g.counterpartyNameConfidence)) {
        g.counterpartyName = tx.counterpartyName || null;
        g.counterpartyNameConfidence = tx.counterpartyNameConfidence || null;
      }
    } else {
      // Legacy bank statements: unchanged pre-Phase-5 behavior — the name
      // came directly from the bank's own dedicated column, not inferred.
      if (!g.counterpartyName && tx.counterpartyName) g.counterpartyName = tx.counterpartyName;
    }
    if (!g.counterpartyBankName && tx.counterpartyBankName) g.counterpartyBankName = tx.counterpartyBankName;

    const ms = _flaDateMs(tx.transactionDate || tx.date || '');
    if (ms > 0 && ms < g.firstMs) { g.firstMs = ms; g.firstDate = tx.transactionDate || tx.date || ''; }
    if (ms > g.lastMs)            { g.lastMs  = ms; g.lastDate  = tx.transactionDate || tx.date || ''; }
  }
  // Source-bank export/UI fix: every row's own accountNumber+bankId was
  // ALWAYS correct (verified against bank-parser.js — tx.bankName is set
  // exclusively from the NAPAS group's own metadata, never from the
  // per-row "Ngân hàng chuyển/nhận" columns; the aggregation key above
  // already includes bankId for NAPAS, so rows never merge across banks).
  // The actual defect was here: sorting purely by totalCount interleaved
  // rows from DIFFERENT own-banks of the SAME account (e.g. 371010_5678 —
  // ACB/Vietcombank/Techcombank rows scattered throughout the sheet by
  // frequency rank instead of grouped together), which is indistinguishable
  // from real data corruption to a human reading the export top-to-bottom.
  // Now clusters by accountNumber, then bankId, so every source identity's
  // rows are contiguous; frequency/volume ordering is preserved as the
  // secondary sort WITHIN each (account, bank) cluster. Affects both the
  // Excel export and the live "Đối Ứng TK" UI tab (both call this same
  // function) — fixed once here rather than patched separately in each.
  return Object.values(groups)
    .sort((a, b) =>
      a.accountNumber.localeCompare(b.accountNumber) ||
      (a.bankId || '').localeCompare(b.bankId || '') ||
      b.totalCount - a.totalCount ||
      (b.sumIN + b.sumOUT) - (a.sumIN + a.sumOUT));
}

/* ── Registry ví điện tử ────────────────────────────────────────────────── */
const _FINTECH_REGISTRY = [
  { name: 'MOMO',          color: '#e91e8c', keywords: ['momo','mo mo','vi momo','momo wallet','momo topup','momo transfer','nap tien momo','chuyen tien momo','tt momo','thanh toan momo'] },
  { name: 'ZaloPay',       color: '#0068ff', keywords: ['zalopay','zalo pay','zalo wallet','vi zalo','zalo bank'] },
  { name: 'VNPay',         color: '#1a5fb4', keywords: ['vnpay','vn pay','thanh toan vnpay','qr vnpay','vnpay qr','cong thanh toan vnpay','vnpay gateway'] },
  { name: 'ShopeePay',     color: '#ee4d2d', keywords: ['shopeepay','shopee pay','airpay','air pay','spay','sea money','seamoney'] },
  { name: 'ViettelMoney',  color: '#cc0000', keywords: ['viettelmoney','viettel money','viettel pay','ngan hang so viettel','viettel digital','vt money'] },
  { name: 'GrabPay/Moca',  color: '#00b14f', keywords: ['grabpay','grab pay','grab wallet','grab finance','moca','vi moca','grab moca'] },
  { name: 'VinID',         color: '#1565c0', keywords: ['vinid','vinpay','vin pay','vi vinid','vingroup pay'] },
  { name: 'Cake/VPBDigi',  color: '#5c67f2', keywords: ['cake bank','cake by vpb','vi cake','vpbank cake','cake digital'] },
  { name: 'Timo',          color: '#00bcd4', keywords: ['timo','vi timo','timo bank','timo by vpb','timo plus'] },
  { name: 'PayOO',         color: '#f57c00', keywords: ['payoo','pay oo','vi payoo','cong thanh toan payoo'] },
  { name: 'MB Wallet',     color: '#1976d2', keywords: ['vi mb','mbb wallet','mb wallet','vi dien tu mb bank','vi mb bank'] },
  { name: 'Ví Khác',       color: '#64748b', keywords: ['e-wallet','ewallet','vi dien tu','digital wallet','ngan luong','baokim','123pay','pay365'] },
];
const _FINTECH_DANGER_HRS = new Set([23, 0, 1, 2, 3, 4]);

function _normFT(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function _detectFintechType(tx) {
  const hay = _normFT((tx.description || tx.content || '') + ' ' + (tx.counterpartyName || '') + ' ' + (tx.bankName || tx.bank || ''));
  for (const ft of _FINTECH_REGISTRY) {
    if (ft.keywords.some(kw => hay.includes(kw))) return ft;
  }
  return null;
}

function analyzeFintechTransactions(transactions) {
  const hits = [], summaryMap = {};
  for (const tx of transactions) {
    const ft = _detectFintechType(tx);
    if (!ft) continue;
    const dateStr = tx.transactionDate || tx.date || '';
    const hrM = dateStr.match(/[T\s](\d{2}):/);
    const hour = hrM ? parseInt(hrM[1]) : -1;
    const isSuspicious = (tx.amount || 0) >= 50_000_000 || _FINTECH_DANGER_HRS.has(hour);
    hits.push({ fintechName: ft.name, color: ft.color, accountNumber: tx.accountNumber || '', transactionType: tx.transactionType || '—', amount: tx.amount || 0, date: dateStr, description: tx.description || tx.content || '', bankName: tx.bankName || tx.bank || '', isSuspicious });
    if (!summaryMap[ft.name]) summaryMap[ft.name] = { name: ft.name, color: ft.color, totalCount: 0, totalIN: 0, totalOUT: 0, suspiciousCount: 0 };
    const sm = summaryMap[ft.name];
    sm.totalCount++;
    if (tx.transactionType === 'IN')  sm.totalIN  += (tx.amount || 0);
    if (tx.transactionType === 'OUT') sm.totalOUT += (tx.amount || 0);
    if (isSuspicious) sm.suspiciousCount++;
  }
  hits.sort((a, b) => b.amount - a.amount);
  return { hits, summary: Object.values(summaryMap).sort((a, b) => b.totalCount - a.totalCount) };
}

/* ── Phase 5: confidence badge for NAPAS counterpartyNameConfidence.
   Deliberately visually distinct per tier — CONFIRMED must never look the
   same as INFERRED, AMBIGUOUS never silently reads as a real name, UNKNOWN
   is spelled out rather than left to look like an empty/legacy row. No
   numeric probability is invented — these are the 4 tiers as resolved by
   BankParser.resolveCounterparty(), verbatim. Never rendered for legacy
   (non-NAPAS) rows, whose counterpartyNameConfidence is always null. ── */
function _flaConfidenceBadgeHtml(confidence) {
  const cfg = {
    CONFIRMED: { label: 'XÁC NHẬN',      bg: '#16653422', fg: '#4ade80', bd: '#4ade8055' },
    INFERRED:  { label: 'SUY LUẬN',      bg: '#78350f22', fg: '#fbbf24', bd: '#fbbf2455' },
    AMBIGUOUS: { label: 'CHƯA RÕ',       bg: '#7c2d1222', fg: '#fb923c', bd: '#fb923c55' },
    UNKNOWN:   { label: 'KHÔNG XÁC ĐỊNH', bg: '#1e293b',   fg: '#64748b', bd: '#33415555' },
  }[confidence];
  if (!cfg) return '';
  return `<span style="display:inline-block;margin-left:6px;padding:1px 5px;border-radius:3px;` +
    `font-family:var(--font-mono);font-size:0.55rem;font-weight:600;letter-spacing:0.02em;` +
    `background:${cfg.bg};color:${cfg.fg};border:1px solid ${cfg.bd};white-space:nowrap;" ` +
    `title="Độ tin cậy tên đối ứng (NAPAS): ${confidence}">${cfg.label}</span>`;
}

/* ── Render Tab 02: Đối Ứng TK ─────────────────────────────────────────── */
function _renderAccountFlowTab(data) {
  const matrix  = buildAccountFlowMatrix(data);
  const tbody   = document.getElementById('fla-account-flow-body');
  const counter = document.getElementById('fla-account-flow-count');
  if (!tbody) return;
  if (!matrix.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text-muted);font-family:var(--font-mono);padding:32px;">KHÔNG CÓ DỮ LIỆU TÀI KHOẢN ĐỐI ỨNG</td></tr>';
    if (counter) counter.textContent = '0 cặp';
    return;
  }
  tbody.innerHTML = matrix.map(g => {
    const net = g.sumIN - g.sumOUT;
    const nc  = net >= 0 ? '#4ade80' : '#f87171';
    const isH = (g.sumIN + g.sumOUT) >= 100_000_000;
    const isNapas = g.sourceFormat === 'NAPAS';
    const cpD = g.counterpartyAccount === 'CHUA_XAC_DINH'
      ? '<span style="color:#475569;font-style:italic;">Không rõ</span>'
      : `<span style="font-family:var(--font-mono);font-size:0.64rem;color:#cbd5e1;">${_escHtml(g.counterpartyAccount)}</span>`;

    // Tên Đối Ứng: legacy rows unchanged; NAPAS rows carry a confidence
    // badge and never fabricate a name for AMBIGUOUS/UNKNOWN (g.counterpartyName
    // is already null for those tiers — see buildAccountFlowMatrix/Phase 4).
    let cpNameCell;
    if (isNapas) {
      const badge = _flaConfidenceBadgeHtml(g.counterpartyNameConfidence);
      cpNameCell = (g.counterpartyName ? _escHtml(g.counterpartyName) : '<span style="color:#475569;">—</span>') + badge;
    } else {
      cpNameCell = g.counterpartyName ? _escHtml(g.counterpartyName) : '<span style="color:#475569;">—</span>';
    }
    const cpNameTitle = _escHtml(g.counterpartyName || '');

    // Ngân Hàng (own bank): NAPAS rows get a small source tag + the
    // normalized bankId as a tooltip; legacy rows render exactly as before
    // (no tag, no tooltip change) — sourceFormat must never leak onto
    // non-NAPAS rows.
    const bankNameEsc = _escHtml(g.bankName);
    const ownBankCell = isNapas
      ? `<span style="display:inline-block;margin-right:4px;padding:0 4px;border-radius:2px;font-family:var(--font-mono);font-size:0.55rem;font-weight:700;background:#0891b222;color:#22d3ee;border:1px solid #22d3ee44;" title="Nguồn dữ liệu: NAPAS">NAPAS</span>` +
        `<span title="Định danh chuẩn hoá: ${_escHtml(g.bankId || g.bankName)}">${bankNameEsc}</span>`
      : bankNameEsc;

    // NH Đối Ứng (counterparty bank) — new column, spec §4.B/§8. Always
    // empty for legacy (field only populated by NAPAS parsing).
    const cpBankCell = g.counterpartyBankName
      ? `<span style="font-size:0.64rem;">${_escHtml(g.counterpartyBankName)}</span>`
      : '<span style="color:#475569;">—</span>';

    return `<tr class="${isH ? 'row-danger' : ''}">
      <td><span style="font-family:var(--font-mono);font-size:0.64rem;color:#00f0ff;">${_escHtml(g.accountNumber)}</span></td>
      <td>${cpD}</td>
      <td style="font-size:0.67rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${cpNameTitle}">${cpNameCell}</td>
      <td style="text-align:center;font-family:var(--font-mono);font-weight:600;">${g.totalCount}</td>
      <td style="text-align:right;font-family:var(--font-mono);color:#4ade80;">${g.sumIN > 0 ? g.sumIN.toLocaleString('vi-VN') : '—'}</td>
      <td style="text-align:right;font-family:var(--font-mono);color:#f87171;">${g.sumOUT > 0 ? g.sumOUT.toLocaleString('vi-VN') : '—'}</td>
      <td style="text-align:right;font-family:var(--font-mono);font-weight:600;color:${nc};">${net.toLocaleString('vi-VN')}</td>
      <td style="font-size:0.62rem;color:#64748b;">${g.firstDate ? g.firstDate.slice(0,10) : '—'}</td>
      <td style="font-size:0.62rem;color:#64748b;">${g.lastDate  ? g.lastDate.slice(0,10)  : '—'}</td>
      <td style="font-size:0.67rem;white-space:nowrap;">${ownBankCell}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${cpBankCell}</td>
    </tr>`;
  }).join('');
  if (counter) counter.textContent = `${matrix.length} cặp TK · ${data.length} giao dịch`;
}

/* ── Phase 16-19: NAPAS transaction-level reconciliation panel ──────────────
   Lives inside the existing Tab 02 "Đối Ứng TK" (no new tab created — task
   explicitly allowed reusing an existing tab/pattern instead). Hidden
   entirely for legacy-only uploads. Pure presentation: reuses
   BankParser.pairNapasGroups()/reconcileAllPairs() directly, never
   recomputes matching/evidence/resolver logic here (docs/
   NAPAS_UPGRADE_SPEC.md Phase 17 "UI chỉ presentation. Data layer là
   source of truth"). ── */

const _FLA_RECON_STATUS_CFG = {
  MATCHED:   { label: 'ĐÃ KHỚP',                bg: '#16653422', fg: '#4ade80', bd: '#4ade8055' },
  UNMATCHED: { label: 'CHƯA KHỚP',              bg: '#1e293b',   fg: '#94a3b8', bd: '#33415555' },
  AMBIGUOUS: { label: 'CHƯA XÁC ĐỊNH DUY NHẤT', bg: '#7c2d1222', fg: '#fb923c', bd: '#fb923c55' },
};

// Deliberately a SEPARATE badge/concept from _flaConfidenceBadgeHtml
// (counterpartyNameConfidence) — reconciliation status and counterparty-name
// confidence are independent axes (spec Phase 17 "CONFIDENCE"): an INFERRED
// counterparty name on an UNMATCHED transaction is a normal, valid
// combination. Never merged into one badge/value.
function _flaReconStatusBadgeHtml(status) {
  const cfg = _FLA_RECON_STATUS_CFG[status];
  if (!cfg) return '';
  return `<span style="display:inline-block;padding:1px 6px;border-radius:3px;` +
    `font-family:var(--font-mono);font-size:0.55rem;font-weight:700;letter-spacing:0.02em;` +
    `background:${cfg.bg};color:${cfg.fg};border:1px solid ${cfg.bd};white-space:nowrap;">${cfg.label}</span>`;
}

function _flaReconEvidenceText(evidence) {
  if (!evidence) return '';
  const parts = [];
  parts.push(evidence.transactionId ? 'Mã GD ✓' : 'Mã GD ✗');
  parts.push(evidence.amount ? 'Số tiền ✓' : 'Số tiền ✗');
  parts.push(evidence.date ? 'Ngày giờ ✓' : 'Ngày giờ ✗');
  parts.push(evidence.counterpartyAccount ? 'TK đối ứng ✓' : 'TK đối ứng ✗');
  if (evidence.selfTransfer) parts.push('Tự chuyển khoản');
  return parts.join(' · ');
}

// Flattens one reconcileGroupPair() result into row objects — a straight
// read of the engine's own output (matched/unmatchedChuyen/unmatchedNhan/
// ambiguousChuyen/ambiguousNhan), never reinterpreted or recalculated.
function _flaBuildReconRows(reconciliation) {
  const rows = [];
  for (const m of reconciliation.matched) {
    rows.push({ tx: m.chuyen, status: 'MATCHED', counterpartId: m.nhanTransactionId, matchMethod: m.matchMethod, evidence: m.evidence });
    rows.push({ tx: m.nhan,   status: 'MATCHED', counterpartId: m.chuyenTransactionId, matchMethod: m.matchMethod, evidence: m.evidence });
  }
  for (const t of reconciliation.unmatchedChuyen) rows.push({ tx: t, status: 'UNMATCHED' });
  for (const t of reconciliation.unmatchedNhan)   rows.push({ tx: t, status: 'UNMATCHED' });
  for (const t of reconciliation.ambiguousChuyen) rows.push({ tx: t, status: 'AMBIGUOUS' });
  for (const t of reconciliation.ambiguousNhan)   rows.push({ tx: t, status: 'AMBIGUOUS' });
  rows.sort((a, b) => _flaDateMs(a.tx.transactionDate) - _flaDateMs(b.tx.transactionDate));
  return rows;
}

// Caps rendered rows to protect DOM/perf on real groups up to ~1,500
// transactions (docs/NAPAS_UPGRADE_SPEC.md Phase 15 performance numbers) —
// truncation is disclosed, never silent.
const _FLA_RECON_ROW_CAP = 300;

function _flaReconDetailTableHtml(reconciliation, domId) {
  const rows = _flaBuildReconRows(reconciliation);
  const shown = rows.slice(0, _FLA_RECON_ROW_CAP);
  const rowsHtml = shown.map(r => {
    const isChuyen = r.tx.transactionType === 'OUT';
    const cpBadge = _flaConfidenceBadgeHtml(r.tx.counterpartyNameConfidence);
    return `<tr>
      <td style="font-size:0.6rem;${isChuyen ? 'color:#f87171' : 'color:#4ade80'};">${isChuyen ? 'CHUYỂN' : 'NHẬN'}</td>
      <td style="font-size:0.6rem;color:#64748b;white-space:nowrap;">${_escHtml(r.tx.transactionDate || '')}</td>
      <td style="text-align:right;font-family:var(--font-mono);font-size:0.62rem;">${(r.tx.amount || 0).toLocaleString('vi-VN')}</td>
      <td style="font-family:var(--font-mono);font-size:0.6rem;color:#94a3b8;">${_escHtml(r.tx.transactionId || '—')}</td>
      <td style="font-family:var(--font-mono);font-size:0.6rem;">${_escHtml(r.tx.counterpartyAccount || '—')}</td>
      <td style="font-size:0.6rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_escHtml(r.tx.counterpartyBankName || '—')}</td>
      <td style="font-size:0.6rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.tx.counterpartyName ? _escHtml(r.tx.counterpartyName) : '<span style="color:#475569;">—</span>'}${cpBadge}</td>
      <td>${_flaReconStatusBadgeHtml(r.status)}</td>
      <td style="font-size:0.58rem;color:#64748b;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_escHtml(_flaReconEvidenceText(r.evidence))}">${r.status === 'MATCHED' ? `↔ ${_escHtml(r.counterpartId || '')} <span style="color:#475569;">(${_escHtml(r.matchMethod || '')})</span>` : ''}</td>
    </tr>`;
  }).join('');
  const truncNote = rows.length > _FLA_RECON_ROW_CAP
    ? `<div style="font-size:0.58rem;color:#64748b;padding:6px 4px;font-family:var(--font-mono);">Hiển thị ${_FLA_RECON_ROW_CAP}/${rows.length} giao dịch đầu tiên (sắp theo ngày).</div>`
    : '';
  return `
    <div id="${domId}" hidden style="margin-top:8px;">
      <div class="table-wrapper" style="max-height:320px;overflow-y:auto;border:1px solid var(--border-color);border-radius:3px;">
        <table class="tactical-table" style="font-size:0.6rem;">
          <thead>
            <tr>
              <th style="font-size:0.58rem;">Chiều</th>
              <th style="font-size:0.58rem;">Ngày giờ</th>
              <th style="text-align:right;font-size:0.58rem;">Số tiền</th>
              <th style="font-size:0.58rem;">Mã GD</th>
              <th style="font-size:0.58rem;">TK đối ứng</th>
              <th style="font-size:0.58rem;">NH đối ứng</th>
              <th style="font-size:0.58rem;">Tên đối ứng</th>
              <th style="font-size:0.58rem;">Trạng thái đối soát</th>
              <th style="font-size:0.58rem;">Giao dịch khớp</th>
            </tr>
          </thead>
          <tbody>${rowsHtml || '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:16px;">Không có giao dịch</td></tr>'}</tbody>
        </table>
      </div>
      ${truncNote}
    </div>`;
}

// Simple show/hide toggle, referenced via inline onclick from the generated
// HTML (same lightweight convention already used elsewhere in this file).
function _flaToggleNapasDetail(domId) {
  const el = document.getElementById(domId);
  if (el) el.hidden = !el.hidden;
}

function _flaNapasPairCardHtml(pair, reconciliation, idx) {
  const domId = `fla-napas-detail-${idx}`;
  const totalC = reconciliation.matched.length + reconciliation.unmatchedChuyen.length + reconciliation.ambiguousChuyen.length;
  const totalN = reconciliation.matched.length + reconciliation.unmatchedNhan.length + reconciliation.ambiguousNhan.length;
  const ambigTotal = reconciliation.ambiguousChuyen.length + reconciliation.ambiguousNhan.length;
  // Truthful, non-alarming 0-match message (spec §3/§18) — never "lỗi đối
  // chiếu"/"reconciliation failed" when the engine ran correctly and the
  // source data simply has no determinable correspondence.
  const zeroMsg = reconciliation.matched.length === 0
    ? `<div style="font-size:0.62rem;color:#94a3b8;margin-top:4px;">Đã phân tích ${totalC} giao dịch CHUYỂN và ${totalN} giao dịch NHẬN. Không tìm thấy giao dịch đối ứng xác định trong dữ liệu hiện tại.</div>`
    : '';
  return `
    <div style="border:1px solid var(--border-color);border-radius:4px;padding:8px 10px;margin-bottom:6px;background:rgba(255,255,255,0.015);">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <div style="font-family:var(--font-mono);font-size:0.65rem;">
          <span style="color:#00f0ff;">TK ${_escHtml(pair.accountNumber)}</span>
          <span style="color:#64748b;"> · </span>
          <span>${_escHtml(pair.bankName)}</span>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.6rem;color:#64748b;">
          CHUYỂN ${totalC} · NHẬN ${totalN} ·
          <span style="color:#4ade80;">${reconciliation.matched.length} khớp</span> ·
          <span style="color:#94a3b8;">${reconciliation.unmatchedChuyen.length + reconciliation.unmatchedNhan.length} chưa khớp</span>
          ${ambigTotal > 0 ? ` · <span style="color:#fb923c;">${ambigTotal} chưa rõ</span>` : ''}
        </div>
        <button onclick="_flaToggleNapasDetail('${domId}')" style="font-family:var(--font-mono);font-size:0.58rem;background:transparent;border:1px solid var(--border-color);color:var(--text-muted);border-radius:3px;padding:2px 8px;cursor:pointer;">XEM CHI TIẾT</button>
      </div>
      ${zeroMsg}
      ${_flaReconDetailTableHtml(reconciliation, domId)}
    </div>`;
}

function _flaNapasOrphanCardHtml(orphan, direction) {
  const label   = direction === 'CHUYEN' ? 'CHUYỂN' : 'NHẬN';
  const missing = direction === 'CHUYEN' ? 'NHẬN'   : 'CHUYỂN';
  return `
    <div style="border:1px dashed var(--border-color);border-radius:4px;padding:8px 10px;margin-bottom:6px;">
      <div style="font-family:var(--font-mono);font-size:0.65rem;">
        <span style="color:#00f0ff;">TK ${_escHtml(orphan.accountNumber)}</span>
        <span style="color:#64748b;"> · </span>
        <span>${_escHtml(orphan.bankName)}</span>
        <span style="color:#64748b;"> · nhóm ${label}</span>
      </div>
      <div style="font-size:0.6rem;color:#94a3b8;margin-top:4px;">Chưa nạp file ${missing} tương ứng cho tài khoản/ngân hàng này — không thể đối soát.</div>
    </div>`;
}

function _renderNapasReconciliationPanel() {
  const panel = document.getElementById('fla-napas-recon-panel');
  if (!panel) return;
  const fileResults = _flaNapasFileResults || [];
  // Legacy-safe: hidden entirely (no markup at all) unless at least one
  // uploaded file was actually detected as NAPAS.
  if (!fileResults.some(r => r && r.detectedBank === 'NAPAS')) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }

  const pairing = BankParser.pairNapasGroups(fileResults);
  const recon = BankParser.reconcileAllPairs(fileResults, pairing);

  const cards = recon.map(({ pair, reconciliation }, idx) => _flaNapasPairCardHtml(pair, reconciliation, idx)).join('');
  const orphanCards =
    pairing.orphanChuyen.map(o => _flaNapasOrphanCardHtml(o, 'CHUYEN')).join('') +
    pairing.orphanNhan.map(o => _flaNapasOrphanCardHtml(o, 'NHAN')).join('');
  const orphanCount = pairing.orphanChuyen.length + pairing.orphanNhan.length;

  panel.style.display = 'block';
  panel.innerHTML = `
    <div style="padding:8px 10px;">
      <div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--text-muted);letter-spacing:0.07em;margin-bottom:8px;">
        ĐỐI SOÁT GIAO DỊCH NAPAS — CHUYỂN ↔ NHẬN (${recon.length} cặp nhóm${orphanCount > 0 ? `, ${orphanCount} nhóm thiếu cặp` : ''})
      </div>
      ${cards || '<div style="font-size:0.62rem;color:#94a3b8;">Không có cặp nhóm NAPAS nào được ghép để đối soát.</div>'}
      ${orphanCards}
    </div>`;
}

/* ── Render Tab 04: Ví Điện Tử ─────────────────────────────────────────── */
function _renderFintechTab(data) {
  const { hits, summary } = analyzeFintechTransactions(data);
  const sumEl = document.getElementById('fla-fintech-summary');
  if (sumEl) {
    sumEl.innerHTML = !summary.length
      ? '<div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-muted);padding:8px 0;">KHÔNG PHÁT HIỆN GIAO DỊCH QUA VÍ ĐIỆN TỬ / FINTECH</div>'
      : summary.map(s => `
          <div class="fintech-summary-card" style="border-left-color:${s.color};">
            <div class="fsc-name" style="color:${s.color};">${s.name}</div>
            <div class="fsc-count">${s.totalCount} GD</div>
            <div class="fsc-detail">
              <span style="color:#4ade80;">▲ ${(s.totalIN/1e6).toFixed(1)}tr</span>&nbsp;
              <span style="color:#f87171;">▼ ${(s.totalOUT/1e6).toFixed(1)}tr</span>
              ${s.suspiciousCount > 0 ? `<span style="color:#ef4444;margin-left:6px;">⚠ ${s.suspiciousCount}</span>` : ''}
            </div>
          </div>`).join('');
  }
  const tbody = document.getElementById('fla-fintech-body');
  if (!tbody) return;
  if (!hits.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);font-family:var(--font-mono);padding:32px;">KHÔNG CÓ DỮ LIỆU</td></tr>';
    return;
  }
  tbody.innerHTML = hits.map(h => {
    const dc = h.transactionType === 'IN' ? '#4ade80' : '#f87171';
    const dl = h.transactionType === 'IN' ? '▲ VÀO' : h.transactionType === 'OUT' ? '▼ RA' : '—';
    return `<tr class="${h.isSuspicious ? 'row-danger' : ''}">
      <td><span class="fintech-badge" style="color:${h.color};border-color:${h.color}44;background:${h.color}15;">${h.fintechName}</span></td>
      <td style="font-family:var(--font-mono);font-size:0.64rem;color:#94a3b8;">${h.accountNumber || '—'}</td>
      <td style="text-align:center;font-family:var(--font-mono);font-size:0.6rem;color:${dc};">${dl}</td>
      <td style="text-align:right;font-family:var(--font-mono);">${(h.amount||0).toLocaleString('vi-VN')}</td>
      <td style="font-size:0.65rem;color:#64748b;">${h.date ? h.date.slice(0,16) : '—'}</td>
      <td style="font-size:0.65rem;">${h.bankName}</td>
      <td style="font-size:0.65rem;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(h.description||'').replace(/"/g,'')}">${h.description}</td>
      <td style="text-align:center;">${h.isSuspicious ? '<span style="color:#ef4444;">⚠</span>' : ''}</td>
    </tr>`;
  }).join('');
}
