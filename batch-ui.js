/**
 * batch-ui.js — Sentinel Core Batch UI Controller
 *
 * Renders and manages the Batch CDR Processing screen.
 * Wires file/folder inputs, dropzone, filter controls, and session table.
 *
 * Depends on: BatchProcessor, CDRAnalyzer, ExportManager
 * Called from: app.js initBatchModule() on screen activation
 */

const BatchUI = (() => {
  'use strict';

  // ── Carrier badge config ───────────────────────────────────
  const CARRIER_META = {
    VTL: { label: 'Viettel',      color: '#e53e3e', bg: 'rgba(229,62,62,0.12)' },
    MBF: { label: 'Mobiphone',    color: '#d69e2e', bg: 'rgba(214,158,46,0.12)' },
    VNP: { label: 'Vinaphone',    color: '#3182ce', bg: 'rgba(49,130,206,0.12)' },
    VNM: { label: 'Vietnamobile', color: '#48bb78', bg: 'rgba(72,187,120,0.12)' },
    GMB: { label: 'Gmobile',      color: '#9f7aea', bg: 'rgba(159,122,234,0.12)' },
  };

  const STATUS_META = {
    pending:    { icon: '⏸', label: 'Chờ',         cls: 'status-pending'    },
    processing: { icon: '⏳', label: 'Đang xử lý',  cls: 'status-processing' },
    done:       { icon: '✅', label: 'Hoàn thành',  cls: 'status-done'       },
    error:      { icon: '❌', label: 'Lỗi',         cls: 'status-error'      },
    exported:   { icon: '📤', label: 'Đã xuất',     cls: 'status-done'       },
  };

  // ── Filter state ───────────────────────────────────────────
  let _filterText       = '';
  let _filterCarrier    = '';
  let _filterStatus     = '';
  let _selectedSessionId = null;

  // ── Virtual render state (S7.3) ────────────────────────────
  const PAGE_SIZE      = 100;   // rows rendered per page
  let   _displayPage   = 1;     // current page (1-indexed)

  // ── Init ───────────────────────────────────────────────────

  function init() {
    _bindFileInputs();
    _bindDropzone();
    _bindFilters();
    render();
  }

  // ── Input bindings ─────────────────────────────────────────

  function _bindFileInputs() {
    const fi = document.getElementById('batch-file-input');
    fi?.addEventListener('change', e => {
      BatchProcessor.addFiles(e.target.files);
      fi.value = '';
    });

    const folder = document.getElementById('batch-folder-input');
    folder?.addEventListener('change', e => {
      const xlsxOnly = Array.from(e.target.files).filter(f => /\.(xlsx|xls)$/i.test(f.name));
      BatchProcessor.addFiles(xlsxOnly);
      folder.value = '';
    });
  }

  function _bindDropzone() {
    const dz = document.getElementById('batch-dropzone');
    if (!dz) return;

    dz.addEventListener('click', () => triggerFileInput());

    dz.addEventListener('dragover', e => {
      e.preventDefault();
      dz.classList.add('drag-over');
    });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));

    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('drag-over');

      const items = Array.from(e.dataTransfer?.items || []);
      const files = [];

      // Collect files (flat — directory traversal not used for simplicity)
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        files.push(...Array.from(e.dataTransfer.files));
      } else {
        items.forEach(item => {
          if (item.kind === 'file') {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        });
      }

      BatchProcessor.addFiles(files);
    });
  }

  function _bindFilters() {
    document.getElementById('batch-search')
      ?.addEventListener('input', applyFilter);
    document.getElementById('batch-carrier-filter')
      ?.addEventListener('change', applyFilter);
    document.getElementById('batch-status-filter')
      ?.addEventListener('change', applyFilter);
  }

  // ── Public: triggerFileInput / triggerFolderInput ──────────

  function triggerFileInput() {
    document.getElementById('batch-file-input')?.click();
  }

  function triggerFolderInput() {
    document.getElementById('batch-folder-input')?.click();
  }

  // ── Public: applyFilter ────────────────────────────────────

  function applyFilter() {
    _filterText    = (document.getElementById('batch-search')?.value || '').toLowerCase().trim();
    _filterCarrier = document.getElementById('batch-carrier-filter')?.value || '';
    _filterStatus  = document.getElementById('batch-status-filter')?.value  || '';
    _displayPage   = 1; // S7.3: reset to first page on filter change
    render();
  }

  // ── Public: render ─────────────────────────────────────────

  function render() {
    const all      = BatchProcessor.getAllSessions();
    const stats    = BatchProcessor.getStats();
    const filtered = _applyFilters(all);

    _renderStats(stats);
    _renderTable(filtered, all.length);
    _updateRunButton(stats);
    _updateProgressWrap(stats);
  }

  // ── Public: updateRow ──────────────────────────────────────

  function updateRow(sessionId) {
    const session = BatchProcessor.getSession(sessionId);
    if (!session) return;

    const existing = document.querySelector(`tr[data-session-id="${sessionId}"]`);
    if (!existing) {
      render();
      return;
    }
    const newRow = _buildRow(session);
    existing.outerHTML = newRow;
  }

  // ── Public: clearAllConfirm ────────────────────────────────

  function clearAllConfirm() {
    const stats = BatchProcessor.getStats();
    if (stats.total === 0) return;
    if (!confirm(`Xóa tất cả ${stats.total} phiên khỏi Batch? Dữ liệu sẽ mất.`)) return;
    BatchProcessor.clearAll();
  }

  // ── Internal: filter ───────────────────────────────────────

  function _applyFilters(sessions) {
    return sessions.filter(s => {
      if (_filterCarrier && s.carrier !== _filterCarrier) return false;
      if (_filterStatus  && s.status  !== _filterStatus)  return false;
      if (_filterText) {
        const haystack = [
          s.fileName, s.carrierName, s.carrier,
          s.subscriber?.phone, s.subscriber?.name, s.error,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(_filterText)) return false;
      }
      return true;
    });
  }

  // ── Internal: _renderStats ─────────────────────────────────

  function _renderStats(stats) {
    const row = document.getElementById('batch-stats-row');
    if (!row) return;
    row.innerHTML = [
      { label: 'Tổng phiên',  val: stats.total,      color: 'var(--text-secondary)', span2: true },
      { label: 'Hoàn thành',  val: stats.done,        color: 'var(--accent-cyan)' },
      { label: 'Lỗi',         val: stats.error,       color: 'var(--accent-red)' },
      { label: 'Chờ xử lý',   val: stats.pending,     color: 'var(--text-secondary)' },
      { label: 'Đang chạy',   val: stats.processing,  color: '#d69e2e' },
    ].map(({ label, val, color, span2 }) =>
      `<div class="mini-stat-card" style="${span2 ? 'grid-column:1/-1;' : ''}padding:6px 8px;">
        <span class="mini-stat-label">${label}</span>
        <span class="mini-stat-value" style="font-size:1rem;color:${color};">${val}</span>
      </div>`
    ).join('');
  }

  // ── Internal: _renderTable (S7.3 — paginated) ─────────────

  function _renderTable(sessions, totalCount) {
    const tbody = document.getElementById('batch-tbody');
    if (!tbody) return;

    if (sessions.length === 0) {
      tbody.innerHTML = `
        <tr id="batch-empty-row">
          <td colspan="7" style="text-align:center;padding:40px;
              color:var(--text-secondary);font-style:italic;">
            ${totalCount === 0
              ? 'Chưa có file nào. Kéo thả hoặc chọn file XLSX để bắt đầu.'
              : 'Không có kết quả khớp với bộ lọc hiện tại.'}
          </td>
        </tr>`;
      _renderFooter(0, totalCount, 0);
      return;
    }

    // S7.3: slice to current page window
    const endIdx   = _displayPage * PAGE_SIZE;
    const visible  = sessions.slice(0, endIdx);
    const hasMore  = sessions.length > endIdx;

    tbody.innerHTML = visible.map(s => _buildRow(s)).join('');

    // "Load more" sentinel row if there are more pages
    if (hasMore) {
      const remaining = sessions.length - endIdx;
      const sentinel  = document.createElement('tr');
      sentinel.id     = 'batch-load-more-row';
      sentinel.innerHTML = `
        <td colspan="7" style="text-align:center;padding:12px;">
          <button class="btn-page" onclick="BatchUI.loadMore()" style="padding:6px 20px;">
            ↓ Tải thêm ${Math.min(remaining, PAGE_SIZE)} / ${remaining} phiên còn lại
          </button>
        </td>`;
      tbody.appendChild(sentinel);
    }

    _renderFooter(visible.length, sessions.length, totalCount);
  }

  function _renderFooter(shown, filtered, total) {
    const footer = document.getElementById('batch-footer');
    if (!footer) return;
    if (total === 0) { footer.textContent = ''; return; }
    const filterNote = filtered < total ? ` (lọc từ ${total} phiên)` : '';
    footer.textContent = `Hiển thị ${shown} / ${filtered}${filterNote}`;
  }

  // ── Internal: _buildRow ────────────────────────────────────

  function _buildRow(s) {
    const cmeta = CARRIER_META[s.carrier] || { label: s.carrier || '?', color: '#666', bg: 'rgba(100,100,100,0.1)' };
    const smeta = STATUS_META[s.status]   || { icon: '?', label: s.status, cls: '' };

    const carrierBadge = `
      <span style="display:inline-block;padding:2px 7px;border-radius:3px;
                   font-family:var(--font-mono);font-size:0.72rem;font-weight:600;
                   color:${cmeta.color};background:${cmeta.bg};border:1px solid ${cmeta.color}44;">
        ${_esc(s.carrier || '?')}
      </span>
      <span style="font-size:0.8rem;color:var(--text-secondary);margin-left:5px;">
        ${_esc(cmeta.label)}
      </span>`;

    const statusCell = s.status === 'error'
      ? `<span class="batch-status ${smeta.cls}" title="${_esc(s.error || '')}">
           ${smeta.icon} Lỗi
         </span>`
      : `<span class="batch-status ${smeta.cls}">${smeta.icon} ${smeta.label}</span>`;

    const confidencePct = s.confidence != null && s.status === 'done'
      ? ` <span style="color:var(--text-secondary);font-size:0.7rem;">(${Math.round(s.confidence * 100)}%)</span>`
      : '';

    const phone = s.subscriber?.phone || (s.status === 'done' ? '—' : '');

    const actionBtns = s.status === 'done' ? `
      <button class="btn-page btn-sm"
          onclick="event.stopPropagation();CDRAnalyzer.activateSession('${s.sessionId}')"
          title="Xem trong CDR Analyzer">👁 Xem</button>
      <button class="btn-page btn-sm btn-export"
          onclick="event.stopPropagation();BatchProcessor.exportSession('${s.sessionId}')"
          title="Xuất Excel">💾 Xuất</button>
      <button class="btn-page btn-sm btn-danger-sm"
          onclick="event.stopPropagation();BatchProcessor.removeSession('${s.sessionId}')"
          title="Xóa phiên này">✕</button>
    ` : s.status === 'error' ? `
      <button class="btn-page btn-sm btn-danger-sm"
          onclick="event.stopPropagation();BatchProcessor.removeSession('${s.sessionId}')"
          title="Xóa phiên này">✕</button>
    ` : `
      <span style="color:var(--text-secondary);font-size:0.75rem;">—</span>
    `;

    const fileShort = s.fileName.length > 28
      ? s.fileName.slice(0, 25) + '…'
      : s.fileName;

    return `
      <tr class="batch-row ${smeta.cls}" data-session-id="${s.sessionId}"
          onclick="BatchUI.selectSession('${s.sessionId}')">
        <td class="col-file" title="${_esc(s.fileName)}">
          <span style="font-family:var(--font-mono);font-size:0.78rem;">${_esc(fileShort)}</span>
        </td>
        <td class="col-carrier">${s.status === 'done' ? carrierBadge : '<span style="color:var(--text-secondary);">—</span>'}</td>
        <td class="col-format" style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-secondary);">
          ${s.status === 'done' ? _esc(s.format || s.carrier || '—') + confidencePct : '—'}
        </td>
        <td class="col-records" style="text-align:right;font-family:var(--font-mono);font-size:0.8rem;">
          ${s.status === 'done' ? (s.records || []).length.toLocaleString() : '—'}
        </td>
        <td class="col-phone" style="font-family:var(--font-mono);font-size:0.78rem;">
          ${_esc(phone)}
        </td>
        <td class="col-status">${statusCell}</td>
        <td class="col-actions" style="white-space:nowrap;">${actionBtns}</td>
      </tr>`;
  }

  // ── Internal: helpers ──────────────────────────────────────

  function _updateRunButton(stats) {
    const btn = document.getElementById('batch-run-btn');
    if (!btn) return;
    if (stats.processing > 0) {
      btn.disabled = true;
      btn.textContent = '⏳ Đang xử lý…';
    } else {
      btn.disabled = stats.pending === 0;
      btn.textContent = '▶ Xử Lý Tất Cả';
    }
  }

  function _updateProgressWrap(stats) {
    const wrap = document.getElementById('batch-progress-wrap');
    if (!wrap) return;
    if (stats.processing > 0 || (stats.total > 0 && stats.pending === 0)) {
      wrap.style.display = '';
    } else if (stats.total === 0) {
      wrap.style.display = 'none';
    }
  }

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Public: loadMore (S7.3) ───────────────────────────────

  function loadMore() {
    _displayPage++;
    render();
    document.getElementById('batch-load-more-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Public: selectSession ──────────────────────────────────
  // Called when user clicks a row — highlights it and shows quick preview

  function selectSession(id) {
    _selectedSessionId = id;

    // Highlight selected row, clear others
    document.querySelectorAll('#batch-tbody .batch-row').forEach(r =>
      r.classList.remove('batch-row-selected')
    );
    document.querySelector(`#batch-tbody tr[data-session-id="${id}"]`)
      ?.classList.add('batch-row-selected');

    const session = BatchProcessor.getSession(id);
    if (!session || session.status !== 'done') {
      _clearPreview();
      return;
    }
    _renderPreview(session);
  }

  function _clearPreview() {
    const empty   = document.getElementById('batch-preview-empty');
    const content = document.getElementById('batch-preview-content');
    if (empty)   empty.style.display   = 'flex';
    if (content) content.style.display = 'none';
  }

  // ── Internal: _renderPreview ───────────────────────────────

  function _renderPreview(session) {
    const empty   = document.getElementById('batch-preview-empty');
    const content = document.getElementById('batch-preview-content');
    if (!empty || !content) return;

    empty.style.display   = 'none';
    content.style.display = 'flex';

    const el = id => document.getElementById(id);
    const phone = session.subscriber?.phone
      || session.fileName.replace(/\.xlsx?$/i, '');

    // ── Header info ──────────────────────────────────────────
    if (el('batch-preview-phone'))
      el('batch-preview-phone').textContent = phone;
    if (el('batch-preview-carrier'))
      el('batch-preview-carrier').textContent =
        `${session.carrierName || session.carrier} · ${(session.records || []).length.toLocaleString()} bản ghi`;

    // ── Stats ────────────────────────────────────────────────
    if (el('bprev-records'))
      el('bprev-records').textContent = (session.records || []).length.toLocaleString();
    if (el('bprev-contacts'))
      el('bprev-contacts').textContent = Object.keys(session.contactsData || {}).length.toLocaleString();
    if (el('bprev-imeis'))
      el('bprev-imeis').textContent = Object.keys(session.imeiData || {}).length.toLocaleString();
    if (el('bprev-locs'))
      el('bprev-locs').textContent = Object.keys(session.locationData || {}).length.toLocaleString();

    // ── Action buttons ────────────────────────────────────────
    const viewBtn   = el('bprev-view-btn');
    const exportBtn = el('bprev-export-btn');
    if (viewBtn)   viewBtn.onclick   = () => { if (typeof CDRAnalyzer !== 'undefined') CDRAnalyzer.activateSession(session.sessionId); };
    if (exportBtn) exportBtn.onclick = () => BatchProcessor.exportSession(session.sessionId);

    // ── Top BTS location table ───────────────────────────────
    const locTbody = el('bprev-locs-tbody');
    if (locTbody) {
      const locData  = session.locationData || {};
      const topLocs  = Object.values(locData)
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 6);
      locTbody.innerHTML = topLocs.length
        ? topLocs.map(loc => `
            <tr>
              <td style="padding:4px 8px;font-family:var(--font-mono);font-size:0.69rem;color:var(--accent-cyan);">${_esc(String(loc.lac || '—'))}</td>
              <td style="padding:4px 8px;font-family:var(--font-mono);font-size:0.69rem;">${_esc(String(loc.cell || '—'))}</td>
              <td style="padding:4px 8px;text-align:right;color:var(--accent-yellow);font-family:var(--font-mono);font-size:0.69rem;">${(loc.count || 0).toLocaleString()}</td>
              <td style="padding:4px 8px;font-size:0.68rem;color:var(--text-secondary);max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(loc.province || loc.bts || '—')}</td>
            </tr>`).join('')
        : `<tr><td colspan="4" style="padding:10px;text-align:center;color:var(--text-muted);font-size:0.68rem;">Không có dữ liệu vị trí</td></tr>`;
    }

    // ── Timeline slider (populate with time range) ────────────
    const slider   = el('bprev-timeline-slider');
    const timeInfo = el('bprev-timeline-info');
    const records  = session.records || [];
    if (slider && records.length > 0) {
      slider.min      = 0;
      slider.max      = records.length - 1;
      slider.value    = 0;
      slider.disabled = false;

      const formatTime = r => {
        const t = r.time || r.datetime || r.timestamp || r.date || '';
        return t ? String(t).slice(0, 16) : '—';
      };

      const updateTimeInfo = idx => {
        const r = records[Math.min(idx, records.length - 1)];
        if (timeInfo) timeInfo.textContent = r ? formatTime(r) : '—';
      };

      updateTimeInfo(0);
      slider.oninput = () => updateTimeInfo(Number(slider.value));
    } else if (slider) {
      slider.disabled = true;
      if (timeInfo) timeInfo.textContent = '— LỊCH TRÌNH —';
    }

    // ── Draw radar (GTP integration) ─────────────────────────
    try {
      if (records.length > 0 && typeof CellLacParser !== 'undefined') {
        const gtpData = CellLacParser.toGtpFormat(records, session.carrierName || session.carrier);
        _drawMiniRadar(gtpData, 'batch-mini-radar');
      }
    } catch (e) {
      console.warn('[BatchUI] Mini radar:', e);
    }
  }

  // ── Internal: _drawMiniRadar ───────────────────────────────
  // Standalone radar drawing for any SVG element — mirrors drawRadarPath()

  function _drawMiniRadar(data, svgId) {
    const svg = document.getElementById(svgId);
    if (!svg) return;

    svg.innerHTML = `
      <circle cx="50%" cy="50%" r="40%" stroke="rgba(0,240,255,0.06)" stroke-width="1" fill="none"/>
      <circle cx="50%" cy="50%" r="27%" stroke="rgba(0,240,255,0.10)" stroke-width="1" fill="none"/>
      <circle cx="50%" cy="50%" r="13%" stroke="rgba(0,240,255,0.07)" stroke-width="1" fill="none"/>
      <line x1="10%" y1="50%" x2="90%" y2="50%" stroke="rgba(0,240,255,0.05)" stroke-width="1"/>
      <line x1="50%" y1="10%" x2="50%" y2="90%" stroke="rgba(0,240,255,0.05)" stroke-width="1"/>`;

    if (!data || data.length === 0) return;

    const lats = data.map(p => p.lat).filter(v => v != null && !isNaN(v));
    const lngs = data.map(p => p.lng).filter(v => v != null && !isNaN(v));
    if (!lats.length) return;

    const minLat = Math.min(...lats) - 0.005, maxLat = Math.max(...lats) + 0.005;
    const minLng = Math.min(...lngs) - 0.008, maxLng = Math.max(...lngs) + 0.008;
    const latR = maxLat - minLat || 0.08;
    const lngR = maxLng - minLng || 0.12;

    const coords = data.map(p => ({
      x: 10 + ((p.lng - minLng) / lngR) * 80,
      y: 90 - ((p.lat - minLat) / latR) * 80,
    }));

    // Draw path
    if (coords.length > 1) {
      let d = `M ${coords[0].x.toFixed(1)}% ${coords[0].y.toFixed(1)}%`;
      for (let i = 1; i < coords.length; i++)
        d += ` L ${coords[i].x.toFixed(1)}% ${coords[i].y.toFixed(1)}%`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'radar-path');
      path.style.opacity = '0.75';
      svg.appendChild(path);
    }

    // Draw nodes — subsample to max 60 for performance
    const step = Math.max(1, Math.floor(coords.length / 60));
    coords.forEach((c, idx) => {
      if (idx % step !== 0 && idx !== 0 && idx !== coords.length - 1) return;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', `${c.x.toFixed(1)}%`);
      circle.setAttribute('cy', `${c.y.toFixed(1)}%`);
      circle.setAttribute('r', idx === 0 ? '5' : idx === coords.length - 1 ? '4' : '2.5');
      circle.setAttribute('fill',
        idx === 0             ? '#ff3b30'            :
        idx === coords.length - 1 ? '#ffcc00'        :
        'var(--accent-cyan)'
      );
      circle.setAttribute('opacity', idx === 0 || idx === coords.length - 1 ? '1' : '0.65');
      svg.appendChild(circle);
    });
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    init,
    render,
    updateRow,
    applyFilter,
    loadMore,
    selectSession,
    triggerFileInput,
    triggerFolderInput,
    clearAllConfirm,
  };
})();
