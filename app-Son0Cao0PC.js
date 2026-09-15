/* Project Sentinel - Core Application JS Controller */

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initGtpModule();
  initFlaModule();
  initSrauModule();
  initWorkspaceUX();
  initChartDefaults();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);

  // Init CDR Analyzer module + expose toast bridge
  window._sentinelToast = (msg, type) => _showToast(msg, type === 'ok' ? 'success' : type);
  if (typeof CDRAnalyzer !== 'undefined') CDRAnalyzer.init();

  // Init Batch CDR module
  initBatchModule();
});

/* 1. Navigation Controller */
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const screens = document.querySelectorAll('.screen');
  const pageTitle = document.getElementById('page-display-title');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      const targetScreen = item.getAttribute('data-screen');
      if (!targetScreen) return;

      // Update Active Navigation Item
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Update Screen Visibility
      screens.forEach(screen => {
        screen.classList.remove('active');
        if (screen.id === `${targetScreen}-screen`) {
          screen.classList.add('active');
        }
      });

      // Update Page Title
      const screenTitle = item.querySelector('span').innerText;
      pageTitle.innerText = screenTitle.toUpperCase();
    });
  });

  // Home Card Navigation Quick-Links
  const quickLinks = {
    'btn-gtp-init': 'gtp',
    'btn-fla-init': 'fla',
    'btn-srau-init': 'srau'
  };

  Object.entries(quickLinks).forEach(([btnId, screenKey]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        const correspondingNav = document.querySelector(`.nav-item[data-screen="${screenKey}"]`);
        if (correspondingNav) correspondingNav.click();
      });
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
  if (_gtpTimelineInfo) _gtpTimelineInfo.innerText = `NÚT: ${data.cell} @ ${data.time}`;
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

/* 4. Phân Hệ B - FLA: Financial Ledger Analyzer */
const MOCK_BANK_LEDGER = [
  { id: '1', date: '28/05/2026 02:14:05', code: 'N/A', amount: 150000000, content: 'CHUYEN TIEN THANH TOAN NHO LE', bank: 'Techcombank', flag: 'Khung giờ nhạy cảm & Lượng tiền lớn' },
  { id: '2', date: '28/05/2026 02:14:32', code: 'N/A', amount: 150000000, content: 'CHUYEN TIEN CAN DAU CHU CO', bank: 'Techcombank', flag: 'Tần suất dồn dập & Lượng tiền lớn' },
  { id: '3', date: '28/05/2026 02:15:10', code: 'N/A', amount: 150000000, content: 'CHUYEN TIEN DAU TU BO PHAN', bank: 'Techcombank', flag: 'Tần suất dồn dập & Lượng tiền lớn' },
  { id: '4', date: '28/05/2026 09:30:12', code: 'A921B', amount: 2000000, content: 'QUAN CAFE A1 AN SANG', bank: 'Vietcombank', flag: 'N/A' },
  { id: '5', date: '28/05/2026 12:45:00', code: 'C523D', amount: 450000000, content: 'HO TRO PHI AN NINH DU AN', bank: 'Agribank', flag: 'Lượng tiền lớn bất minh' },
  { id: '6', date: '28/05/2026 15:10:22', code: 'N/A', amount: 500000, content: 'MUA DO DUNG CA NHAN ONLINE', bank: 'Vietcombank', flag: 'N/A' },
  { id: '7', date: '28/05/2026 17:55:40', code: 'E842G', amount: 300000000, content: 'DON TIEN MUA THIET BI MOI-INOX', bank: 'Techcombank', flag: 'Lượng tiền lớn bất minh' }
];

function initFlaModule() {
  const loadBtn = document.getElementById('fla-load-demo');
  if (!loadBtn) return;
  _flaVT = new VirtualTable('fla-flow-body', 'fla-table-wrapper');

  _initDropzone('fla-dropzone', 'fla-file-input', async (file) => {
    showProcessing();
    _showToast(`Đang tải lên sao kê: ${file.name}`, 'info');
    try {
      const result = await API.uploadFile(file);
      const d = result.data;
      _showToast(
        `✓ Tải lên thành công — ${d.original_filename}\n` +
        `~${d.estimated_records} giao dịch | Đang chờ phân tích...`,
        'success'
      );
    } catch (err) {
      _showToast(`Lỗi tải lên: ${err.message}`, 'error');
    } finally {
      hideProcessing();
    }
  });

  loadBtn.addEventListener('click', () => {
    loadBtn.classList.add('btn-loading');
    loadBtn.textContent = 'ĐANG PHÂN TÍCH SAO KÊ...';
    showTableSkeleton('fla-flow-body', 6, 3);
    showChartSkeleton('fla-charts', 'grid', 10);
    showProcessing();
    setTimeout(() => {
      flaLoadData(MOCK_BANK_LEDGER);
      loadBtn.classList.remove('btn-loading');
      loadBtn.textContent = 'NẠP SAO KÊ THỬ NGHIỆM';
      hideProcessing();
    }, 420);
  });
}

/* 4b. FLA Filter / Search / Sort / Paginate */
const _flaState = { data: [], filtered: [], sortKey: null, sortDir: 1, page: 0, pageSize: 5000 };

function flaLoadData(data) {
  _flaState.data = data;
  _flaState.sortKey = null;
  _flaState.sortDir = 1;

  const bankSel = document.getElementById('fla-filter-bank');
  const banks = [...new Set(data.map(d => d.bank))];
  bankSel.innerHTML = '<option value="all">Tất cả ngân hàng</option>' +
    banks.map(b => `<option value="${b}">${b}</option>`).join('');

  document.getElementById('fla-adv-filters').style.display = 'block';
  document.getElementById('fla-filter-select').disabled = false;

  ['fla-search','fla-filter-select','fla-filter-bank','fla-amount-min','fla-amount-max','fla-hour-from','fla-hour-to'].forEach(id => {
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

  document.getElementById('fla-prev').onclick = () => { _flaState.page--; flaRenderPage(); };
  document.getElementById('fla-next').onclick = () => { _flaState.page++; flaRenderPage(); };

  flaApplyFilters();

  // ── Render intelligence tabs ────────────────────────────────────────
  _renderAccountFlowTab(data);
  _renderFintechTab(data);
}

/* ─── RENDER: Tab 02 — Đối Ứng TK ──────────────────────────────────────── */
function _renderAccountFlowTab(data) {
  const matrix = buildAccountFlowMatrix(data);
  const tbody   = document.getElementById('fla-account-flow-body');
  const counter = document.getElementById('fla-account-flow-count');
  if (!tbody) return;

  if (matrix.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);font-family:var(--font-mono);padding:32px;">KHÔNG CÓ DỮ LIỆU TÀI KHOẢN ĐỐI ỨNG</td></tr>';
    if (counter) counter.textContent = '0 cặp';
    return;
  }

  tbody.innerHTML = matrix.map(g => {
    const net      = g.sumIN - g.sumOUT;
    const netColor = net >= 0 ? '#4ade80' : '#f87171';
    const isHigh   = (g.sumIN + g.sumOUT) >= 100_000_000;
    const cpDisplay = g.counterpartyAccount === 'CHUA_XAC_DINH'
      ? '<span class="af-unknown">Không rõ</span>'
      : `<span class="af-cp">${g.counterpartyAccount}</span>`;
    return `<tr class="${isHigh ? 'row-danger' : ''}">
      <td><span class="af-account">${g.accountNumber}</span></td>
      <td>${cpDisplay}</td>
      <td style="font-size:0.67rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(g.counterpartyName||'').replace(/"/g,'')}">${g.counterpartyName || '<span style="color:#475569;">—</span>'}</td>
      <td style="text-align:center;font-family:var(--font-mono);font-weight:600;">${g.totalCount}</td>
      <td style="text-align:right;" class="af-mono fla-net-positive">${g.sumIN > 0 ? g.sumIN.toLocaleString('vi-VN') : '—'}</td>
      <td style="text-align:right;" class="af-mono fla-net-negative">${g.sumOUT > 0 ? g.sumOUT.toLocaleString('vi-VN') : '—'}</td>
      <td style="text-align:right;color:${netColor};font-family:var(--font-mono);font-weight:600;">${net.toLocaleString('vi-VN')}</td>
      <td style="font-size:0.62rem;color:#64748b;">${g.firstDate ? g.firstDate.slice(0,10) : '—'}</td>
      <td style="font-size:0.62rem;color:#64748b;">${g.lastDate  ? g.lastDate.slice(0,10)  : '—'}</td>
      <td style="font-size:0.67rem;">${g.bankName}</td>
    </tr>`;
  }).join('');

  if (counter) counter.textContent = `${matrix.length} cặp TK · ${data.length} giao dịch`;
}

/* ─── RENDER: Tab 04 — Ví Điện Tử ──────────────────────────────────────── */
function _renderFintechTab(data) {
  const { hits, summary } = analyzeFintechTransactions(data);

  // Summary cards
  const sumEl = document.getElementById('fla-fintech-summary');
  if (sumEl) {
    if (summary.length === 0) {
      sumEl.innerHTML = '<div style="font-family:var(--font-mono);font-size:0.65rem;color:var(--text-muted);padding:8px 0;">KHÔNG PHÁT HIỆN GIAO DỊCH QUA VÍ ĐIỆN TỬ / FINTECH</div>';
    } else {
      sumEl.innerHTML = summary.map(s => `
        <div class="fintech-summary-card" style="border-left-color:${s.color};">
          <div class="fsc-name" style="color:${s.color};">${s.name}</div>
          <div class="fsc-count">${s.totalCount} GD</div>
          <div class="fsc-detail">
            <span style="color:#4ade80;">▲ ${(s.totalIN /1e6).toFixed(1)}tr</span>
            &nbsp;
            <span style="color:#f87171;">▼ ${(s.totalOUT/1e6).toFixed(1)}tr</span>
            ${s.suspiciousCount > 0 ? `<span style="color:#ef4444;margin-left:6px;">⚠ ${s.suspiciousCount}</span>` : ''}
          </div>
        </div>`).join('');
    }
  }

  // Detail table
  const tbody = document.getElementById('fla-fintech-body');
  if (!tbody) return;
  if (hits.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);font-family:var(--font-mono);padding:32px;">KHÔNG CÓ DỮ LIỆU</td></tr>';
    return;
  }
  tbody.innerHTML = hits.map(h => {
    const dirColor = h.transactionType === 'IN' ? '#4ade80' : h.transactionType === 'OUT' ? '#f87171' : '#64748b';
    const dirLabel = h.transactionType === 'IN' ? '▲ VÀO' : h.transactionType === 'OUT' ? '▼ RA' : '—';
    return `<tr class="${h.isSuspicious ? 'row-danger' : ''}">
      <td><span class="fintech-badge" style="color:${h.color};border-color:${h.color}44;background:${h.color}15;">${h.fintechName}</span></td>
      <td><span class="af-mono" style="color:#94a3b8;">${h.accountNumber || '—'}</span></td>
      <td style="text-align:center;font-family:var(--font-mono);font-size:0.6rem;color:${dirColor};">${dirLabel}</td>
      <td style="text-align:right;font-family:var(--font-mono);">${(h.amount||0).toLocaleString('vi-VN')}</td>
      <td style="font-size:0.65rem;color:#64748b;">${h.date ? h.date.slice(0,16) : '—'}</td>
      <td style="font-size:0.65rem;">${h.bankName}</td>
      <td style="font-size:0.65rem;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(h.description||'').replace(/"/g,'')}">${h.description}</td>
      <td style="text-align:center;">${h.isSuspicious ? '<span style="color:#ef4444;">⚠</span>' : ''}</td>
    </tr>`;
  }).join('');
}

function flaApplyFilters() {
  const search     = (document.getElementById('fla-search')?.value || '').toLowerCase().trim();
  const filterType = document.getElementById('fla-filter-select')?.value || 'all';
  const bank       = document.getElementById('fla-filter-bank')?.value || 'all';
  const amtMinRaw  = document.getElementById('fla-amount-min')?.value;
  const amtMaxRaw  = document.getElementById('fla-amount-max')?.value;
  const amtMin     = amtMinRaw !== '' && amtMinRaw != null ? parseFloat(amtMinRaw) * 1_000_000 : 0;
  const amtMax     = amtMaxRaw !== '' && amtMaxRaw != null ? parseFloat(amtMaxRaw) * 1_000_000 : Infinity;
  const hrFromRaw  = document.getElementById('fla-hour-from')?.value;
  const hrToRaw    = document.getElementById('fla-hour-to')?.value;
  const hrFrom     = hrFromRaw !== '' && hrFromRaw != null ? parseInt(hrFromRaw) : 0;
  const hrTo       = hrToRaw  !== '' && hrToRaw  != null ? parseInt(hrToRaw)  : 23;

  let result = _flaState.data.filter(d => {
    if (search && !`${d.content} ${d.bank} ${d.code} ${d.flag} ${d.date}`.toLowerCase().includes(search)) return false;
    if (filterType === 'anomaly' && d.flag === 'N/A') return false;
    if (filterType === 'large'   && d.amount < 150_000_000) return false;
    if (bank !== 'all' && d.bank !== bank) return false;
    if (d.amount < amtMin || d.amount > amtMax) return false;
    const m = d.date.match(/\s(\d{2}):/);
    if (m) { const hr = parseInt(m[1]); if (hr < hrFrom || hr > hrTo) return false; }
    return true;
  });

  if (_flaState.sortKey) {
    const { sortKey: k, sortDir: dir } = _flaState;
    result.sort((a, b) => {
      let va = a[k], vb = b[k];
      if (k === 'amount') { va = +va; vb = +vb; }
      return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
    });
  }

  _flaState.filtered = result;
  _flaState.page = 0;
  showProcessing();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    flaRenderPage();
    flaUpdateStats(result);
    renderFlaCharts(result.length > 0 ? result : _flaState.data);
    hideProcessing();
  }));
}

function flaRenderPage() {
  const { filtered, pageSize } = _flaState;
  const total      = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  _flaState.page   = Math.min(_flaState.page, totalPages - 1);
  const start      = _flaState.page * pageSize;
  const rows       = filtered.slice(start, start + pageSize);

  const htmlRows = rows.map(item => {
    const badgeClass   = item.flag !== 'N/A' ? 'badge danger' : 'badge cyan';
    const formattedAmt = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.amount);
    const amtColor     = item.amount >= 150_000_000 ? 'var(--accent-red)' : 'var(--text-primary)';
    return `<td style="font-family:var(--font-mono);color:var(--text-secondary);">${item.date}</td>` +
      `<td><strong>${item.bank}</strong></td>` +
      `<td style="font-family:var(--font-mono);font-weight:bold;color:${amtColor};">${formattedAmt}</td>` +
      `<td style="font-size:0.75rem;font-family:var(--font-mono);color:var(--text-muted);">${item.code}</td>` +
      `<td>${item.content}</td>` +
      `<td><span class="${badgeClass}">${item.flag !== 'N/A' ? item.flag : 'Bình thường'}</span></td>`;
  });
  _flaVT.load(htmlRows, `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);font-family:var(--font-mono);padding:30px;">KHÔNG CÓ KẾT QUẢ PHÙ HỢP</td></tr>`);

  const pag = document.getElementById('fla-pagination');
  if (pag) {
    pag.style.display = 'flex';
    document.getElementById('fla-page-info').innerText    = `${_flaState.page + 1} / ${totalPages}`;
    document.getElementById('fla-record-count').innerText = `${total} giao dịch`;
    document.getElementById('fla-prev').disabled = _flaState.page === 0;
    document.getElementById('fla-next').disabled = _flaState.page >= totalPages - 1;
  }
}

function flaUpdateStats(data) {
  const totalFlow   = data.reduce((acc, d) => acc + d.amount, 0);
  const totalAnomaly = data.filter(d => d.flag !== 'N/A').length;
  const el = id => document.getElementById(id);
  if (el('stat-total-flow'))    el('stat-total-flow').innerText    = `${data.length} gd`;
  if (el('stat-total-inflow'))  el('stat-total-inflow').innerText  = (totalFlow / 1_000_000).toFixed(1) + ' tr';
  if (el('stat-total-anomaly')) el('stat-total-anomaly').innerText = `${totalAnomaly} gd`;
}

/* ─── FLA INTELLIGENCE ANALYTICS ENGINE ──────────────────────────────────── */

/* Tần suất dòng tiền theo cặp TK nguồn × TK đối ứng */
function buildAccountFlowMatrix(transactions) {
  const groups = {};
  for (const tx of transactions) {
    const src = (tx.accountNumber || '').trim() || 'UNKNOWN';
    const cp  = (tx.counterpartyAccount || '').trim() || 'CHUA_XAC_DINH';
    const key = src + '||' + cp;
    if (!groups[key]) {
      groups[key] = {
        accountNumber: src, counterpartyAccount: cp,
        counterpartyName: tx.counterpartyName || '',
        bankName: tx.bankName || tx.bank || '',
        totalCount: 0, sumIN: 0, sumOUT: 0,
        firstDate: '', lastDate: '', firstMs: Infinity, lastMs: 0,
      };
    }
    const g = groups[key];
    g.totalCount++;
    if (tx.transactionType === 'IN')       g.sumIN  += (tx.amount || 0);
    else if (tx.transactionType === 'OUT') g.sumOUT += (tx.amount || 0);
    if (!g.counterpartyName && tx.counterpartyName) g.counterpartyName = tx.counterpartyName;
    const ms = _flaDateMs(tx.transactionDate || tx.date || '');
    if (ms > 0 && ms < g.firstMs) { g.firstMs = ms; g.firstDate = tx.transactionDate || tx.date || ''; }
    if (ms > g.lastMs)            { g.lastMs  = ms; g.lastDate  = tx.transactionDate || tx.date || ''; }
  }
  return Object.values(groups)
    .sort((a, b) => b.totalCount - a.totalCount || (b.sumIN + b.sumOUT) - (a.sumIN + a.sumOUT));
}

/* Parse date string → milliseconds (shared utility) */
function _flaDateMs(dateStr) {
  if (!dateStr) return 0;
  const s = String(dateStr);
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/);
  if (m) {
    const ts = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}:00`).getTime();
    return isNaN(ts) ? 0 : ts;
  }
  const ts = new Date(s).getTime();
  return isNaN(ts) ? 0 : ts;
}

/* Phát hiện ví điện tử / fintech gateway */
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
const _FINTECH_DANGER_HOURS = new Set([23, 0, 1, 2, 3, 4]);

function _normFintech(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function _detectFintechType(tx) {
  const hay = _normFintech(
    (tx.description || tx.content || '') + ' ' +
    (tx.counterpartyName || '') + ' ' +
    (tx.bankName || tx.bank || '')
  );
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
    const hrMatch = dateStr.match(/\s(\d{2}):/);
    const hour = hrMatch ? parseInt(hrMatch[1]) : -1;
    const isSuspicious = (tx.amount || 0) >= 50_000_000 || _FINTECH_DANGER_HOURS.has(hour);
    hits.push({
      fintechName: ft.name, color: ft.color,
      accountNumber: tx.accountNumber || '',
      transactionType: tx.transactionType || (tx.flag && tx.flag !== 'N/A' ? tx.flag : '—'),
      amount: tx.amount || 0,
      date: dateStr,
      description: tx.description || tx.content || '',
      bankName: tx.bankName || tx.bank || '',
      isSuspicious,
    });
    if (!summaryMap[ft.name]) summaryMap[ft.name] = { name: ft.name, color: ft.color, totalCount: 0, totalIN: 0, totalOUT: 0, suspiciousCount: 0 };
    const sm = summaryMap[ft.name];
    sm.totalCount++;
    if (tx.transactionType === 'IN')  sm.totalIN  += (tx.amount || 0);
    if (tx.transactionType === 'OUT') sm.totalOUT += (tx.amount || 0);
    if (isSuspicious) sm.suspiciousCount++;
  }
  hits.sort((a, b) => b.amount - a.amount);
  const summary = Object.values(summaryMap).sort((a, b) => b.totalCount - a.totalCount);
  return { hits, summary };
}

/* 4c. FLA Export */
function exportFlaXlsx() {
  if (typeof XLSX === 'undefined') { alert('Thư viện XLSX chưa tải xong. Thử lại sau.'); return; }
  const data = _flaState.filtered.length > 0 ? _flaState.filtered : _flaState.data;
  if (!data.length) { alert('Không có dữ liệu FLA để xuất.'); return; }

  const wb = XLSX.utils.book_new();

  // Sheet 1: full transaction list
  const ws1 = XLSX.utils.json_to_sheet(data.map(d => ({
    'Ngay Gio':       d.date,
    'Ngan Hang':      d.bank,
    'So Tien (VND)':  d.amount,
    'Ma Lenh':        d.code,
    'Noi Dung':       d.content,
    'Canh Bao':       d.flag,
  })));
  XLSX.utils.book_append_sheet(wb, ws1, 'Giao Dich');

  // Sheet 2: summary statistics
  const total      = data.length;
  const anomalies  = data.filter(d => d.flag !== 'N/A').length;
  const largeTxns  = data.filter(d => d.amount >= 150_000_000).length;
  const totalAmt   = data.reduce((acc, d) => acc + d.amount, 0);
  const bankMap    = {};
  data.forEach(d => { bankMap[d.bank] = (bankMap[d.bank] || 0) + 1; });
  const statsRows  = [
    { 'Chi So': 'Tong so giao dich',            'Gia Tri': total },
    { 'Chi So': 'Giao dich bat thuong',           'Gia Tri': anomalies },
    { 'Chi So': 'Giao dich gia tri lon (>150M)',  'Gia Tri': largeTxns },
    { 'Chi So': 'Tong gia tri (VND)',             'Gia Tri': totalAmt },
    ...Object.entries(bankMap)
      .sort((a, b) => b[1] - a[1])
      .map(([bank, count]) => ({ 'Chi So': `So giao dich - ${bank}`, 'Gia Tri': count })),
  ];
  const ws2 = XLSX.utils.json_to_sheet(statsRows);
  XLSX.utils.book_append_sheet(wb, ws2, 'Thong Ke');

  // Sheet 3: hourly distribution
  const hourBuckets  = new Array(24).fill(0);
  const hourAnomalies = new Array(24).fill(0);
  data.forEach(d => {
    const m = d.date.match(/\s(\d{2}):/);
    if (m) {
      const hr = parseInt(m[1]);
      hourBuckets[hr]++;
      if (d.flag !== 'N/A') hourAnomalies[hr]++;
    }
  });
  const ws3 = XLSX.utils.json_to_sheet(
    hourBuckets.map((count, hr) => ({
      'Gio':            `${String(hr).padStart(2, '0')}:00`,
      'So Giao Dich':   count,
      'Co Bat Thuong':  hourAnomalies[hr],
    }))
  );
  XLSX.utils.book_append_sheet(wb, ws3, 'Phan Tich Gio');

  XLSX.writeFile(wb, `FLA_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
  section.style.display = 'grid';

  hideChartSkeleton('fla-charts');
  _destroyCharts(_flaCharts);

  const GRID = 'rgba(255,255,255,0.04)';
  const DANGER_HOURS = new Set([23, 0, 1, 2, 3, 4]);

  // --- Hourly Distribution ---
  const hourBuckets = new Array(24).fill(0);
  data.forEach(d => {
    const m = d.date.match(/\s(\d{2}):/);
    if (m) hourBuckets[parseInt(m[1])]++;
  });

  _flaCharts.hourly = new Chart(document.getElementById('chart-hourly'), {
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
        x: {
          grid: { display: false },
          ticks: { callback: v => `${v}h`, maxTicksLimit: 12 }
        },
        y: {
          grid: { color: GRID },
          ticks: { stepSize: 1 },
          beginAtZero: true
        }
      }
    }
  });

  // --- Transaction Amounts ---
  _flaCharts.amounts = new Chart(document.getElementById('chart-amounts'), {
    type: 'bar',
    data: {
      labels: data.map((_, i) => `#${i + 1}`),
      datasets: [{
        data: data.map(d => Math.round(d.amount / 1_000_000)),
        backgroundColor: data.map(d =>
          d.flag !== 'N/A' ? 'rgba(255,59,48,0.5)' : 'rgba(0,240,255,0.22)'
        ),
        borderColor: data.map(d =>
          d.flag !== 'N/A' ? '#ff3b30' : '#00f0ff'
        ),
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
              const item = data[ctx.dataIndex];
              return `${(item.amount / 1_000_000).toFixed(1)}tr — ${item.bank}`;
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

/* === Workspace UX: Panels / Resize / Notes / Pins / Focus === */

function initWorkspaceUX() {
  _wsInitCollapsible();
  _wsInitResize();
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
  ['gtp', 'fla'].forEach(mod => {
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
  ['gtp', 'fla'].forEach(mod => {
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
let simInterval = null;

function initSrauModule() {
  const generateBtn = document.getElementById('srau-btn-generate');
  const inputDecoy = document.getElementById('srau-input-decoy');
  const beaconResultBox = document.getElementById('srau-result-box');
  const beaconUrlDisplay = document.getElementById('srau-url-display');
  const copyBtn = document.getElementById('srau-btn-copy');
  
  const consoleContainer = document.getElementById('srau-console-logs');
  const statVisitsVal = document.getElementById('srau-stat-visits');
  const statActiveVal = document.getElementById('srau-stat-active');
  const statFailedVal = document.getElementById('srau-stat-failed');

  if (!generateBtn) return;

  generateBtn.addEventListener('click', () => {
    const decoyUrl = inputDecoy.value || 'https://news.chinhphu.vn';
    const fakeToken = Math.random().toString(36).substring(2, 8);
    const targetUrl = `https://secureservers-cdn.net/auth/validation/token=${fakeToken}`;

    beaconUrlDisplay.innerText = targetUrl;
    beaconResultBox.style.display = 'block';

    // Start Simulation Stream
    startLogSimulation();
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(beaconUrlDisplay.innerText);
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = '<span style="color: var(--accent-cyan);">✓</span>';
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
    }, 1500);
  });

  const MOCK_TARGETS = [
    { ip: '113.190.231.42', country: 'Hà Nội, VN', isp: 'Viettel Mobile', os: 'iOS 17.4', browser: 'Safari Mobile', type: 'Apple iPhone' },
    { ip: '115.79.40.112', country: 'TP. Hồ Chí Minh, VN', isp: 'FPT Telecom', os: 'Android 14', browser: 'Chrome Mobile', type: 'Samsung Galaxy S24' },
    { ip: '14.162.90.5', country: 'Đà Nẵng, VN', isp: 'VNPT', os: 'Windows 11', browser: 'Edge', type: 'PC' },
    { ip: '171.244.135.19', country: 'Bắc Ninh, VN', isp: 'Viettel', os: 'iOS 16.2', browser: 'Facebook InApp', type: 'Apple iPad' }
  ];

  let visitCount = 0;
  let activeBeacons = 1;

  function startLogSimulation() {
    // Clear old interval
    if (simInterval) clearInterval(simInterval);
    consoleContainer.innerHTML = `<li class="console-log-item" style="color: var(--accent-cyan)">[SYSTEM] Khởi động phiên giám sát kênh truyền Beacon... OK.</li>`;
    
    visitCount = 0;
    statVisitsVal.innerText = '0';
    statActiveVal.innerText = '1';

    simInterval = setInterval(() => {
      if (visitCount >= MOCK_TARGETS.length) {
        clearInterval(simInterval);
        consoleContainer.innerHTML += `<li class="console-log-item" style="color: var(--text-muted)">[SYSTEM] Phiên kiểm toán hoàn tất. Không ghi nhận thêm kết nối.</li>`;
        return;
      }

      const target = MOCK_TARGETS[visitCount];
      visitCount++;
      
      statVisitsVal.innerText = visitCount;

      const logItem = document.createElement('li');
      logItem.className = 'console-log-item active-pulse';
      
      const timeNow = new Date().toLocaleTimeString('vi-VN', { hour12: false });
      
      logItem.innerHTML = `
        <span class="log-time">[${timeNow}]</span>
        <span class="log-ip">${target.ip}</span>
        <span class="log-device">(${target.type} - ${target.os})</span>
        <span style="color: var(--text-primary);">kết nối từ</span>
        <span style="color: var(--accent-cyan); font-weight: 500;">${target.country}</span>
        <span style="color: var(--text-muted);">qua mạng ${target.isp}</span>
      `;

      consoleContainer.appendChild(logItem);
      consoleContainer.scrollTop = consoleContainer.scrollHeight;
    }, 4000);
  }
}

/* Batch CDR Module */
function initBatchModule() {
  if (typeof BatchUI === 'undefined' || typeof BatchProcessor === 'undefined') return;

  // Init UI (binds inputs + dropzone + renders empty table)
  BatchUI.init();

  // Re-render table whenever user navigates to Batch screen
  const batchNavItem = document.querySelector('.nav-item[data-screen="batch"]');
  batchNavItem?.addEventListener('click', () => {
    BatchUI.render();
  });
}
