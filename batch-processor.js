/**
 * batch-processor.js — Sentinel Core Multi-Carrier Batch Processor
 *
 * Processes multiple CDR Excel files concurrently using async queue.
 * Sessions are shared with CDRAnalyzer via registerSession().
 *
 * Public API:
 *   BatchProcessor.addFiles(fileList)         → string[]  (added sessionIds)
 *   BatchProcessor.processQueue()             → Promise<void>
 *   BatchProcessor.removeSession(id)          → void
 *   BatchProcessor.exportSession(id)          → Promise<void>
 *   BatchProcessor.exportAll()                → Promise<void>
 *   BatchProcessor.getAllSessions()           → AnalysisSession[]
 *   BatchProcessor.getSession(id)             → AnalysisSession | undefined
 *   BatchProcessor.clearAll()                 → void
 *   BatchProcessor.getStats()                 → {total, done, error, pending, processing}
 */

const BatchProcessor = (() => {
  'use strict';

  // ── Limits (S7.1) ──────────────────────────────────────────
  const MAX_BATCH_FILES   = 500;
  const MAX_TOTAL_SIZE_MB = 2048;
  const WARN_RECORDS      = 100_000;

  // ── Internal state ─────────────────────────────────────────
  const _sessions = new Map();  // Map<sessionId, AnalysisSession>
  const _queue    = [];         // sessionIds awaiting processing
  let   _busy     = false;

  const _SESSION_DEFAULTS = {
    sessionId:    null,
    fileName:     '',
    fileSize:     0,
    carrier:      '',
    carrierName:  '',
    format:       '',
    confidence:   0,
    detection:    null,
    parseResult:  null,
    subscriber:   null,
    subscriberKey: null,
    records:      [],
    contactsData: {},
    imeiData:     {},
    locationData: {},
    compareFiles: [],
    compareResult: [],
    mapHtml:      null,
    charts:       {},
    status:       'pending',
    error:        null,
    createdAt:    null,
    processedAt:  null,
    _file:        null,
  };

  // ── Helpers ────────────────────────────────────────────────

  function _genId() {
    return 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }

  function _isXlsx(file) {
    return /\.(xlsx|xls)$/i.test(file.name);
  }

  function _dedupKey(file) {
    return file.name + '::' + file.size;
  }

  // S7.2: Delegate to CellLacParser.buildDerived() — single canonical implementation
  function _buildDerived(session) {
    const derived = CellLacParser.buildDerived(
      session.records,
      session.parseResult?.pii,
      session.carrierName
    );
    session.imeiData     = derived.imeiData;
    session.contactsData = derived.contactsData;
    session.locationData = derived.locationData;
    if (!session.subscriber) session.subscriber = derived.subscriber;
  }

  function _emitProgress(done, total) {
    const pct = total > 0 ? Math.round(done / total * 100) : 0;
    const bar = document.getElementById('batch-progress-bar');
    if (bar) bar.style.width = pct + '%';
    const txt = document.getElementById('batch-progress-text');
    if (txt) txt.textContent = done + '/' + total + ' (' + pct + '%)';
  }

  // ── Public: addFiles ────────────────────────────────────────

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter(_isXlsx);
    if (files.length === 0) return [];

    // S7.1: File count guard
    if (_sessions.size >= MAX_BATCH_FILES) {
      alert(`Giới hạn ${MAX_BATCH_FILES} files. Xóa bớt phiên trước khi thêm.`);
      return [];
    }

    // S7.1: Total size guard (rough estimate)
    const currentSizeMB = Array.from(_sessions.values())
      .reduce((sum, s) => sum + (s.fileSize || 0), 0) / (1024 * 1024);
    const newSizeMB = files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
    if (currentSizeMB + newSizeMB > MAX_TOTAL_SIZE_MB) {
      alert(`Tổng kích thước vượt giới hạn ${MAX_TOTAL_SIZE_MB} MB.`);
      return [];
    }

    const existingKeys = new Set(
      Array.from(_sessions.values()).map(s => _dedupKey({ name: s.fileName, size: s.fileSize }))
    );

    const added = [];
    for (const file of files) {
      if (_sessions.size >= MAX_BATCH_FILES) break; // safety cap mid-loop

      const key = _dedupKey(file);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);

      const id      = _genId();
      const session = {
        ..._SESSION_DEFAULTS,
        sessionId:  id,
        fileName:   file.name,
        fileSize:   file.size,
        _file:      file,
        status:     'pending',
        createdAt:  new Date(),
      };
      _sessions.set(id, session);

      // Share with CDRAnalyzer so activateSession() can find it
      if (typeof CDRAnalyzer !== 'undefined') {
        CDRAnalyzer.registerSession(id, session);
      }

      _queue.push(id);
      added.push(id);
    }

    if (typeof BatchUI !== 'undefined') BatchUI.render();
    return added;
  }

  // ── Public: processQueue ────────────────────────────────────

  async function processQueue() {
    if (_busy) return;
    _busy = true;

    const pending = _queue.filter(id => {
      const s = _sessions.get(id);
      return s && s.status === 'pending';
    });

    if (pending.length === 0) { _busy = false; return; }

    const progressWrap = document.getElementById('batch-progress-wrap');
    if (progressWrap) progressWrap.style.display = '';

    let done = 0;
    try {
      for (const id of pending) {
        const session = _sessions.get(id);
        if (!session) continue;

        await new Promise(r => setTimeout(r, 0)); // yield to UI thread

        try {
          session.status = 'processing';
          if (typeof BatchUI !== 'undefined') BatchUI.updateRow(id);

          const result = await CellLacParser.parseFile(session._file, 'auto');

          session.parseResult  = result;
          session.carrier      = result.carrier;
          session.carrierName  = result.carrier_name;
          session.format       = result.format || result.carrier;
          session.version      = result.version || 'V1';         // S6: version field
          session.confidence   = result.detection?.confidence || 0;
          session.detection    = result.detection || null;
          session.records      = result.records || [];
          session.processedAt  = new Date();

          // S7.2: delegate to CellLacParser.buildDerived() — single source of truth
          _buildDerived(session);

          // S7.1: warn if record count is high
          if (session.records.length >= WARN_RECORDS) {
            console.warn(`[BatchProcessor] ${session.fileName}: ${session.records.length} records — memory pressure`);
          }

          // Keep CDRAnalyzer's shared reference in sync
          if (typeof CDRAnalyzer !== 'undefined') {
            CDRAnalyzer.registerSession(id, session);
          }

          session.status = 'done';
        } catch (err) {
          session.status = 'error';
          session.error  = err.message || String(err);
          console.error('[BatchProcessor] Error processing', session.fileName, err);
        }

        done++;
        _emitProgress(done, pending.length);
        if (typeof BatchUI !== 'undefined') BatchUI.updateRow(id);
      }
    } finally {
      // S7.1: always reset _busy even if outer loop throws
      _busy = false;
      if (typeof BatchUI !== 'undefined') BatchUI.render();
    }
  }

  // ── Public: removeSession ───────────────────────────────────

  function removeSession(id) {
    _sessions.delete(id);
    const idx = _queue.indexOf(id);
    if (idx >= 0) _queue.splice(idx, 1);
    if (typeof BatchUI !== 'undefined') BatchUI.render();
  }

  // ── Public: exportSession ───────────────────────────────────

  async function exportSession(id) {
    const session = _sessions.get(id);
    if (!session || session.status !== 'done') {
      alert('Phiên chưa hoàn thành hoặc không tìm thấy.');
      return;
    }
    if (typeof ExportManager !== 'undefined') {
      ExportManager.exportSingle(session);
    } else {
      // Fallback: use CellLacParser directly
      const wb   = CellLacParser.exportToExcel(session.parseResult);
      const name = (session.subscriber?.phone || session.fileName.replace(/\.xlsx?$/i, '')) + '_export.xlsx';
      XLSX.writeFile(wb, name);
    }
  }

  // ── Public: exportAll ───────────────────────────────────────

  async function exportAll() {
    const done = Array.from(_sessions.values()).filter(s => s.status === 'done');
    if (done.length === 0) { alert('Không có file nào đã xử lý xong.'); return; }

    if (typeof ExportManager !== 'undefined') {
      const summaryWb = ExportManager.buildSummaryWorkbook(done);
      const blob      = await ExportManager.exportZipBundle(done, summaryWb);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Batch_Export_' + _timestamp() + '.zip';
      a.click();
      URL.revokeObjectURL(a.href);
    } else {
      // Fallback: download individually
      for (const session of done) await exportSession(session.sessionId);
    }
  }

  // ── Public: releaseSession (S7.1) ─────────────────────────
  // Free large arrays after export to reduce memory pressure

  function releaseSession(id) {
    const session = _sessions.get(id);
    if (!session) return;
    session.records      = [];
    session.contactsData = {};
    session.imeiData     = {};
    session.locationData = {};
    session._file        = null;
    session.status       = 'exported';
    if (typeof BatchUI !== 'undefined') BatchUI.updateRow(id);
  }

  // ── Public: clearAll ───────────────────────────────────────

  function clearAll() {
    _sessions.clear();
    _queue.length = 0;
    if (typeof BatchUI !== 'undefined') BatchUI.render();
  }

  // ── Public: stats ──────────────────────────────────────────

  function getStats() {
    const all = Array.from(_sessions.values());
    return {
      total:      all.length,
      done:       all.filter(s => s.status === 'done').length,
      error:      all.filter(s => s.status === 'error').length,
      pending:    all.filter(s => s.status === 'pending').length,
      processing: all.filter(s => s.status === 'processing').length,
    };
  }

  function getAllSessions() { return Array.from(_sessions.values()); }
  function getSession(id)   { return _sessions.get(id); }

  function _timestamp() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
      '_',
      String(d.getHours()).padStart(2, '0'),
      String(d.getMinutes()).padStart(2, '0'),
      String(d.getSeconds()).padStart(2, '0'),
    ].join('');
  }

  // ── Public API ─────────────────────────────────────────────
  return {
    // Limits (read-only reference)
    MAX_BATCH_FILES,
    MAX_TOTAL_SIZE_MB,
    WARN_RECORDS,
    // Operations
    addFiles, processQueue,
    removeSession, releaseSession, exportSession, exportAll,
    getAllSessions, getSession, clearAll, getStats,
  };
})();
