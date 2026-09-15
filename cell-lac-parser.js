/**
 * cell-lac-parser.js — Sentinel Core CDR Excel Parser v3.0
 *
 * BUG FIX v3.0:
 *   - CRITICAL: Removed `blankrows: false` from SheetJS call.
 *     With blankrows:false, 4 blank rows in Viettel.xlsx were stripped,
 *     causing fixedHeaderIdx=21 to point at data row 4 instead of the header.
 *     Now rows array preserves all rows → indices match Excel row numbers - 1.
 *
 * Hỗ trợ: Viettel (VTL), Mobiphone (MBF), Vinaphone (VNP)
 *
 * Public API:
 *   CellLacParser.parseFile(file, carrierKey)     → Promise<ParseResult>
 *   CellLacParser.exportToExcel(parseResult)      → XLSX Workbook (save with XLSX.writeFile)
 *   CellLacParser.downloadExcel(parseResult)      → triggers browser download
 *   CellLacParser.exportCSV(records)              → string
 *   CellLacParser.exportJSON(records)             → string
 *   CellLacParser.downloadText(content, fn, mime) → void
 *   CellLacParser.TEMPLATES                       → object
 */

const CellLacParser = (() => {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // CARRIER TEMPLATES — Xây dựng từ file thật
  // ═══════════════════════════════════════════════════════════════

  const TEMPLATES = {

    viettel: {
      name:           'Viettel VTL',
      code:           'VTL',
      color:          '#e53e3e',
      sheetPriority:  ['Sheet2'],
      // fixedHeaderIdx = 21 = Excel row 22 (0-indexed)
      // REQUIRES blankrows:true (default) to preserve index alignment
      fixedHeaderIdx: 21,
      headerScanRows: 30,
      multiSubscriber: false,

      signatures: {
        sheetNames:  ['sheet2'],
        keywords:    ['báo cáo chi tiết lịch sử', 'số đi', 'địa chỉ trạm bts', 'lac', 'số cell'],
      },

      aliases: {
        timestamp:     ['thời gian', 'thoi gian', 'ngày giờ', 'ngay gio', 'start time', 'datetime', 'time'],
        source_number: ['số đi', 'so di', 'a_subs', 'calling', 'source', 'msisdn a'],
        target_number: ['số đến', 'so den', 'b_subs', 'called', 'destination', 'msisdn b'],
        duration:      ['giây', 'giay', 'seconds', 'duration', 'thời lượng', 'thoi luong'],
        imsi:          ['imsi'],
        imei:          ['imei', 'device id', 'equipment'],
        province:      ['mã tỉnh', 'ma tinh', 'province', 'province code'],
        comm_type:     ['type', 'loại', 'loai', 'call type', 'service type'],
        direction:     ['direction', 'hướng', 'huong', 'chiều'],
        bts_address:   ['địa chỉ trạm bts', 'dia chi tram bts', 'địa chỉ trạm', 'dia chi tram', 'bts', 'tên trạm', 'ten tram'],
        lac:           ['lac', 'location area', 'location area code', 'la'],
        cell_id:       ['số cell', 'so cell', 'cell id', 'cellid', 'cell', 'ci', 'mã cell', 'ma cell'],
      },
    },

    mobiphone: {
      name:           'Mobiphone MBF',
      code:           'MBF',
      color:          '#d69e2e',
      sheetPriority:  ['sheet 1', 'Sheet 1', 'sheet1', 'Sheet1'],
      fixedHeaderIdx: 17,         // Excel row 18 (0-indexed = 17)
      headerScanRows: 25,
      multiSubscriber: false,

      signatures: {
        sheetNames:  ['sheet 1', 'sheet1'],
        keywords:    ['báo cáo chi tiết dữ liệu online', 'số thứ tự', 'số chủ', 'mã địa danh', 'tên địa danh'],
      },

      piiPatterns: {
        phone_raw:           /Số điện thoại\s*:\s*([\d]+)/i,
        full_name:           /Tên thuê bao\s*:\s*(.+)/i,
        subscription_type:   /Loại thuê bao\s*:\s*(.+)/i,
        activation_date:     /Ngày nhập mạng\s*:\s*(.+)/i,
        id_doc_number:       /Số CMND\s*:\s*([\d]+)/i,
        id_issue_date:       /Ngày cấp CMND\s*:\s*(.+)/i,
        id_issue_authority:  /Nơi cấp CMND\s*:\s*(.+)/i,
        date_of_birth:       /Năm sinh\s*:\s*(.+)/i,
        address:             /Địa chỉ\/hộ khẩu\s*:\s*(.+)/i,
      },

      aliases: {
        timestamp:      ['thời gian', 'thoi gian', 'time', 'datetime'],
        comm_type:      ['loại cuộc gọi', 'loai cuoc goi', 'call type', 'loại'],
        source_number:  ['số chủ', 'so chu', 'subscriber', 'msisdn'],
        target_number:  ['số liên hệ', 'so lien he', 'called', 'contact'],
        duration:       ['thời lượng', 'thoi luong', 'duration', 'seconds'],
        ma_dia_danh:    ['mã địa danh', 'ma dia danh', 'cell code', 'dia danh'],
        bts_address:    ['tên địa danh', 'ten dia danh', 'location name', 'bts name', 'tên bts'],
        imei:           ['imei', 'device id'],
      },

      maDiaDanhParser: { separator: '-', lacIdx: 2, cellIdx: 3, sectorIdx: 4 },
    },

    vinaphone: {
      name:           'Vinaphone VNP',
      code:           'VNP',
      color:          '#3182ce',
      sheetPriority:  ['Sheet1'],
      fixedHeaderIdx: 0,           // Header ngay tại row 1 (idx 0) — không có PII block
      headerScanRows: 5,
      multiSubscriber: true,
      subscriberColumn: 'a_subs',

      signatures: {
        sheetNames:  ['sheet1'],
        keywords:    ['a_subs', 'b_subs', 'lac', 'cellid', 'imsi', 'rec_type'],
      },

      aliases: {
        source_number:  ['a_subs', 'a-subs', 'calling', 'msisdn', 'subscriber'],
        target_number:  ['b_subs', 'b-subs', 'called', 'destination'],
        date:           ['date', 'ngay'],
        time:           ['time', 'gio'],
        duration:       ['duration', 'thoi_luong', 'seconds'],
        imsi:           ['imsi'],
        imei:           ['imei'],
        comm_type:      ['rec_type', 'call_type', 'service_type'],
        lac:            ['lac', 'location_area'],
        cell_id:        ['cellid', 'cell_id', 'ci'],
        bts_address:    ['cell_name', 'cellname', 'site_name'],
      },

      recTypeMap: {
        SMO: 'SMS đi',  SMT: 'SMS đến',
        MOC: 'Gọi đi',  MTC: 'Gọi đến',
        SS:  'Dịch vụ',
      },
    },

    vietnamobile: {
      name:           'Vietnamobile VNM',
      code:           'VNM',
      color:          '#48bb78',
      sheetPriority:  ['Sheet1', 'sheet1', 'Data', 'data'],
      fixedHeaderIdx: 0,
      headerScanRows: 10,
      multiSubscriber: false,

      signatures: {
        sheetNames:  ['sheet1', 'data'],
        keywords:    ['vietnamobile', 'vietnam mobile', 'hanoi telecom', 'htc telecommunications', 'vietnamobile.vn'],
      },

      aliases: {
        timestamp:     ['thời gian', 'datetime', 'time', 'ngày giờ', 'start time'],
        source_number: ['số gọi', 'calling', 'a number', 'a_number', 'msisdn', 'subscriber', 'số chủ'],
        target_number: ['số nhận', 'called', 'b number', 'b_number', 'destination', 'số liên hệ'],
        duration:      ['thời lượng', 'duration', 'seconds', 'giây', 'thoi luong'],
        imei:          ['imei', 'device id'],
        lac:           ['lac', 'location area'],
        cell_id:       ['cell id', 'cellid', 'cell', 'ci', 'mã cell'],
        bts_address:   ['bts', 'tên bts', 'cell name', 'trạm', 'địa chỉ trạm'],
        comm_type:     ['loại', 'type', 'call type', 'loại cuộc gọi'],
      },
    },

    gmobile: {
      name:           'Gmobile GMB',
      code:           'GMB',
      color:          '#9f7aea',
      sheetPriority:  ['Sheet1', 'sheet1'],
      fixedHeaderIdx: 0,
      headerScanRows: 10,
      multiSubscriber: false,

      signatures: {
        sheetNames:  ['sheet1'],
        keywords:    ['gmobile', 'g-mobile', 'gtell', 'indochina telecom', 'indochina', 'g mobile'],
      },

      aliases: {
        timestamp:     ['thời gian', 'datetime', 'time', 'ngày giờ'],
        source_number: ['số gọi', 'calling', 'msisdn', 'a number', 'subscriber', 'số chủ'],
        target_number: ['số nhận', 'called', 'b number', 'destination', 'số liên hệ'],
        duration:      ['thời lượng', 'duration', 'giây', 'seconds'],
        imei:          ['imei'],
        lac:           ['lac'],
        cell_id:       ['cell id', 'cellid', 'cell'],
        bts_address:   ['bts', 'tên bts', 'cell name'],
        comm_type:     ['loại', 'type', 'call type'],
      },
    },
  };

  // ═══════════════════════════════════════════════════════════════
  // PROVINCE GEO — Tọa độ xấp xỉ từ tên tỉnh
  // ═══════════════════════════════════════════════════════════════

  const PROVINCE_GEO = {
    'T037': [19.80, 105.77], 'THANH HOA': [19.80, 105.77],
    'HN':   [21.02, 105.85], 'HA NOI':    [21.02, 105.85],
    'HCM':  [10.82, 106.63], 'TP HCM':    [10.82, 106.63],
    'DN':   [16.05, 108.20], 'DA NANG':   [16.05, 108.20],
    'HP':   [20.84, 106.69], 'HAI PHONG': [20.84, 106.69],
    'CT':   [10.04, 105.75], 'CAN THO':   [10.04, 105.75],
    'BD':   [11.32, 106.48], 'BINH DUONG':[11.32, 106.48],
    'LA':   [10.54, 106.41], 'LONG AN':   [10.54, 106.41],
    'TNH':  [11.34, 106.11], 'TAY NINH':  [11.34, 106.11],
  };

  // ═══════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Chuẩn hóa chuỗi: bỏ dấu tiếng Việt, lowercase, chuẩn hóa space
   * "Thời Gian" → "thoi gian", "Số Cell" → "so cell"
   */
  function normalize(str) {
    if (str == null) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // bỏ dấu kết hợp (NFD decomposed)
      .replace(/đ/g, 'd')          // đ (U+0111) → d
      .replace(/ð/g, 'd')          // ð → d
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Score header cell vs alias list — returns 0..1 */
  function scoreCell(cellValue, aliases) {
    const cell = normalize(cellValue);
    if (!cell) return 0;
    for (const alias of aliases) {
      const a = normalize(alias);
      if (!a) continue;
      if (cell === a)                    return 1.0;
      if (cell.includes(a) || a.includes(cell)) return 0.85;
    }
    return 0;
  }

  /** Build column map {field → colIndex} từ header row */
  function buildColumnMap(headerRow, aliases) {
    const map   = {};
    const bests = {};
    for (const f of Object.keys(aliases)) { map[f] = null; bests[f] = 0; }

    headerRow.forEach((cell, idx) => {
      if (cell == null || String(cell).trim() === '') return;
      for (const [field, list] of Object.entries(aliases)) {
        const score = scoreCell(String(cell), list);
        if (score >= 0.5 && score > (bests[field] || 0)) {
          bests[field] = score;
          map[field]   = idx;
        }
      }
    });

    return map;
  }

  /** Debug log: in ra bảng header → normalized → mapped field */
  function debugHeaderMapping(headerRow, colMap, carrierCode) {
    console.group(`[${carrierCode}] Header Detection Debug`);
    console.log('Header row:', headerRow);
    const table = {};
    headerRow.forEach((cell, idx) => {
      if (!cell) return;
      const norm  = normalize(String(cell));
      const field = Object.entries(colMap).find(([f, c]) => c === idx)?.[0] || '—';
      table[idx]  = { original: cell, normalized: norm, mapped_field: field };
    });
    console.table(table);
    const unmapped = Object.entries(colMap).filter(([, c]) => c == null).map(([f]) => f);
    if (unmapped.length) console.warn('Unmapped fields:', unmapped);
    console.groupEnd();
  }

  /** An toàn lấy cell value */
  function getCell(row, idx) {
    if (idx == null || !row || idx >= row.length) return null;
    const v = row[idx];
    return v != null && String(v).trim() !== '' ? String(v).trim() : null;
  }

  /** Tọa độ từ province string */
  function resolveGeo(provinceRaw) {
    if (!provinceRaw) return [null, null];
    const upper = String(provinceRaw).toUpperCase().trim();
    for (const [key, coords] of Object.entries(PROVINCE_GEO)) {
      if (upper === key || upper.includes(key) || key.includes(upper)) return coords;
    }
    return [null, null];
  }

  /** Chọn sheet tốt nhất */
  function selectSheet(workbook, template) {
    for (const priority of template.sheetPriority) {
      const match = workbook.SheetNames.find(
        n => n.toLowerCase() === priority.toLowerCase()
      );
      if (match) return match;
    }
    // Partial match (e.g. "sheet 1" vs "sheet1")
    for (const priority of template.sheetPriority) {
      const clean = priority.toLowerCase().replace(/\s/g, '');
      const match = workbook.SheetNames.find(
        n => n.toLowerCase().replace(/\s/g, '') === clean
      );
      if (match) return match;
    }
    return workbook.SheetNames[0];
  }

  // ═══════════════════════════════════════════════════════════════
  // HEADER DETECTION — score-based với fixed-hint
  // ═══════════════════════════════════════════════════════════════

  /**
   * Tìm header row bằng cách:
   * 1. Thử fixedHint — kiểm tra bằng alias score
   * 2. Fallback: scan toàn bộ rows, chọn row có score cao nhất
   */
  function findBestHeaderRow(rows, template) {
    const allAliases   = Object.values(template.aliases).flat().map(normalize);
    const fixedHint    = template.fixedHeaderIdx;

    function scoreRow(rowIdx) {
      const row = rows[rowIdx] || [];
      const nonEmpty = row.filter(c => c != null && String(c).trim()).length;
      if (nonEmpty < 2) return 0;
      const rowText = row.map(c => normalize(String(c || ''))).join(' ');
      let hits = 0;
      for (const a of allAliases) {
        if (a.length >= 2 && rowText.includes(a)) hits++;
      }
      return hits;
    }

    // 1. Fixed hint
    if (fixedHint !== null && fixedHint < rows.length) {
      const score = scoreRow(fixedHint);
      if (score >= 2) {
        console.log(`[Parser] Fixed header idx=${fixedHint} score=${score} ✓`);
        return fixedHint;
      }
      console.warn(`[Parser] Fixed hint idx=${fixedHint} score=${score} — falling back to scan`);
    }

    // 2. Score-based scan
    let bestScore = 0;
    let bestRow   = fixedHint ?? 0;
    const scanLimit = Math.min(template.headerScanRows || 30, rows.length);

    for (let i = 0; i < scanLimit; i++) {
      const s = scoreRow(i);
      if (s > bestScore) { bestScore = s; bestRow = i; }
    }

    console.log(`[Parser] Score-based header idx=${bestRow} score=${bestScore}`);
    return bestScore >= 2 ? bestRow : (fixedHint ?? 0);
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTO CARRIER DETECTOR
  // ═══════════════════════════════════════════════════════════════

  function detectCarrier(workbook) {
    const allKeys = Object.keys(TEMPLATES);
    const scores  = {};
    const matched = {};
    allKeys.forEach(k => { scores[k] = 0; matched[k] = []; });

    for (const [key, tmpl] of Object.entries(TEMPLATES)) {
      // Priority 1: sheet name (+6)
      const sheetHit = workbook.SheetNames.some(
        n => tmpl.signatures.sheetNames.includes(n.toLowerCase())
      );
      if (sheetHit) {
        scores[key] += 6;
        matched[key].push('sheet:' + workbook.SheetNames[0]);
      }

      // Priority 2: cell content keywords in first 25 rows (+2 each)
      const sheetName = selectSheet(workbook, tmpl);
      const ws = workbook.Sheets[sheetName];
      if (!ws) continue;

      const rows = XLSX.utils.sheet_to_json(ws, {
        header: 1, defval: null, raw: false,
      }).slice(0, 25);

      const allText = rows.flat().filter(Boolean)
        .map(c => normalize(String(c))).join(' ');

      for (const kw of tmpl.signatures.keywords) {
        if (allText.includes(normalize(kw))) {
          scores[key] += 2;
          matched[key].push('keyword:' + kw);
        }
      }

      // Priority 3: column alias match in first 5 rows (+1 each)
      const topRows = rows.slice(0, 5).flat().filter(Boolean)
        .map(c => normalize(String(c)));
      const coreAliases = Object.values(tmpl.aliases || {}).flat().slice(0, 8);
      for (const alias of coreAliases) {
        if (topRows.some(h => h.includes(normalize(alias)))) {
          scores[key] += 1;
          matched[key].push('col:' + alias);
        }
      }
    }

    console.log('[CellLacParser] Carrier detection scores:', scores);

    const sorted  = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const best    = sorted[0];
    const carrier = best[1] > 0 ? best[0] : 'viettel';

    const maxScore   = Math.max(...Object.values(scores), 1);
    const confidence = +(Math.min(best[1] / maxScore, 1).toFixed(2));

    const topMatches = matched[carrier];
    const source = topMatches.length === 0   ? 'fallback'
      : topMatches[0].startsWith('sheet')    ? 'sheet_name'
      : topMatches[0].startsWith('keyword')  ? 'cell_content'
      : 'column_header';

    return { carrier, confidence, format: carrier, source, matchedRules: topMatches };
  }

  // ═══════════════════════════════════════════════════════════════
  // VIETTEL PARSER
  // ═══════════════════════════════════════════════════════════════

  function parseViettel(rows, template) {
    // PII extraction từ fixed cells (indices match khi blankrows:true)
    const safeGet = (r, c) => getCell(rows[r] || [], c);
    const pii = {
      phone_raw:    safeGet(3, 2),   // Excel row 4, col C
      full_name:    safeGet(6, 2),   // Excel row 7
      date_of_birth:safeGet(8, 2),   // Excel row 9
      address:      safeGet(9, 2),   // Excel row 10
      subscription: safeGet(10, 2),  // Excel row 11
      id_doc_type:  safeGet(11, 2),  // Excel row 12
      id_doc_number:safeGet(12, 2),  // Excel row 13
      id_issue_date:safeGet(13, 2),  // Excel row 14
      activation:   safeGet(15, 2),  // Excel row 16
      account_status:safeGet(16, 2), // Excel row 17
      report_from:  safeGet(4, 2),   // Excel row 5 col C
      report_to:    safeGet(4, 4),   // Excel row 5 col E
    };

    console.log('[VTL] PII phone:', pii.phone_raw, '| name:', pii.full_name);

    const headerRowIdx = findBestHeaderRow(rows, template);
    const headerRow    = rows[headerRowIdx] || [];
    const colMap       = buildColumnMap(headerRow, template.aliases);

    debugHeaderMapping(headerRow, colMap, 'VTL');

    const missing  = ['timestamp', 'lac', 'cell_id'].filter(f => colMap[f] == null);
    const warnings = ['source_number', 'bts_address', 'province'].filter(f => colMap[f] == null);

    if (missing.length > 0) {
      console.error('[VTL] Missing critical columns:', missing);
    }

    const records = [];
    const errors  = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      // Skip blank rows (preserved in array because blankrows:true)
      if (!row || !row.some(c => c != null && String(c).trim())) continue;

      const ts   = getCell(row, colMap.timestamp);
      const lac  = getCell(row, colMap.lac);
      const cell = getCell(row, colMap.cell_id);
      const prov = getCell(row, colMap.province);
      const [lat, lng] = resolveGeo(prov);

      // Chỉ require timestamp; lac/cell optional (không reject nếu thiếu)
      if (!ts) {
        errors.push({ row: i + 1, reason: 'Thiếu timestamp', sample: row.slice(0, 5).map(c => c ?? '').join(' | ') });
        continue;
      }

      records.push({
        carrier:   'VTL',
        subscriber: pii.phone_raw,
        timestamp: ts,
        source:    getCell(row, colMap.source_number),
        target:    getCell(row, colMap.target_number),
        duration:  getCell(row, colMap.duration),
        imsi:      getCell(row, colMap.imsi),
        imei:      getCell(row, colMap.imei),
        province:  prov,
        comm_type: getCell(row, colMap.comm_type),
        direction: getCell(row, colMap.direction),
        bts_name:  getCell(row, colMap.bts_address),
        lac:       lac,
        cell_id:   cell,
        latitude:  lat,
        longitude: lng,
        tac: null, enodeb: null, azimuth: null, sector: null, band: null, technology: null,
        _row: i + 1,
      });
    }

    console.log(`[VTL] Parsed: ${records.length} valid, ${errors.length} errors`);
    return { pii, colMap, missing, warnings, records, errors };
  }

  // ═══════════════════════════════════════════════════════════════
  // MOBIPHONE PARSER
  // ═══════════════════════════════════════════════════════════════

  function parseMaDiaDanh(value) {
    if (!value) return { lac: null, cell_id: null, sector: null };
    const parts = String(value).split('-');
    return {
      lac:     parts[2] || null,
      cell_id: parts[3] || null,
      sector:  parts[4] || null,
    };
  }

  function extractMobiphonePii(rows, headerRowIdx, piiPatterns) {
    const pii = {};
    for (let i = 0; i < headerRowIdx; i++) {
      const row = rows[i] || [];
      const cellText = String(row[0] || '').trim();
      if (!cellText) continue;
      for (const [field, regex] of Object.entries(piiPatterns)) {
        if (pii[field]) continue;
        const m = cellText.match(regex);
        if (m) pii[field] = m[1].trim();
      }
    }
    return pii;
  }

  function parseMobiphone(rows, template) {
    const headerRowIdx = findBestHeaderRow(rows, template);
    const pii = extractMobiphonePii(rows, headerRowIdx, template.piiPatterns);
    const headerRow = rows[headerRowIdx] || [];
    const colMap    = buildColumnMap(headerRow, template.aliases);

    debugHeaderMapping(headerRow, colMap, 'MBF');
    console.log('[MBF] PII:', pii);

    const missing  = ['timestamp'].filter(f => colMap[f] == null);
    const warnings = ['source_number', 'ma_dia_danh'].filter(f => colMap[f] == null);

    const records = [];
    const errors  = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.some(c => c != null && String(c).trim())) continue;

      const ts = getCell(row, colMap.timestamp);
      if (!ts) {
        errors.push({ row: i + 1, reason: 'Thiếu timestamp', sample: row.slice(0, 4).map(c => c ?? '').join(' | ') });
        continue;
      }

      const maDiaDanh = getCell(row, colMap.ma_dia_danh);
      const { lac, cell_id, sector } = parseMaDiaDanh(maDiaDanh);

      records.push({
        carrier:    'MBF',
        subscriber: pii.phone_raw || getCell(row, colMap.source_number),
        timestamp:  ts,
        source:     getCell(row, colMap.source_number),
        target:     getCell(row, colMap.target_number),
        duration:   getCell(row, colMap.duration),
        imsi:       null,
        imei:       getCell(row, colMap.imei),
        province:   null,
        comm_type:  getCell(row, colMap.comm_type),
        direction:  null,
        bts_name:   getCell(row, colMap.bts_address),
        lac:        lac,
        cell_id:    cell_id,
        sector:     sector,
        latitude:   null, longitude: null,
        tac: null, enodeb: null, azimuth: null, band: null, technology: null,
        _row: i + 1,
      });
    }

    console.log(`[MBF] Parsed: ${records.length} valid, ${errors.length} errors`);
    return { pii, colMap, missing, warnings, records, errors };
  }

  // ═══════════════════════════════════════════════════════════════
  // VINAPHONE PARSER
  // ═══════════════════════════════════════════════════════════════

  function parseVinaDateTime(dateRaw, timeRaw) {
    if (!dateRaw) return null;
    const d = String(dateRaw).padStart(6, '0');
    const t = String(timeRaw || '000000').padStart(6, '0');
    return `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)} ${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}`;
  }

  function normalizeVinaPhone(phone) {
    if (!phone) return null;
    const s = String(phone).trim();
    if (s.startsWith('84') && s.length >= 11) return '0' + s.slice(2);
    if (s.startsWith('+84')) return '0' + s.slice(3);
    return s;
  }

  function parseVinaphone(rows, template) {
    const headerRowIdx = findBestHeaderRow(rows, template);
    const headerRow    = rows[headerRowIdx] || [];
    const colMap       = buildColumnMap(headerRow, template.aliases);

    debugHeaderMapping(headerRow, colMap, 'VNP');

    const missing  = ['source_number', 'lac', 'cell_id'].filter(f => colMap[f] == null);
    const warnings = ['target_number', 'bts_address'].filter(f => colMap[f] == null);

    const records       = [];
    const errors        = [];
    const subscriberMap = {};

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.some(c => c != null && String(c).trim())) continue;

      const aSubsRaw = getCell(row, colMap.source_number);
      if (!aSubsRaw) {
        errors.push({ row: i + 1, reason: 'a_subs trống — invalid row', sample: (row.slice(0, 5) || []).join('|') });
        continue;
      }

      const subscriber = normalizeVinaPhone(aSubsRaw);
      const dateRaw    = getCell(row, colMap.date);
      const timeRaw    = getCell(row, colMap.time);
      const timestamp  = parseVinaDateTime(dateRaw, timeRaw);

      if (!timestamp) {
        errors.push({ row: i + 1, reason: 'Thiếu timestamp (date/time)', sample: `date=${dateRaw} time=${timeRaw}` });
        continue;
      }

      const commTypeRaw = getCell(row, colMap.comm_type);
      const rec = {
        carrier:    'VNP',
        subscriber: subscriber,
        timestamp:  timestamp,
        source:     subscriber,
        target:     normalizeVinaPhone(getCell(row, colMap.target_number)),
        duration:   getCell(row, colMap.duration),
        imsi:       getCell(row, colMap.imsi),
        imei:       getCell(row, colMap.imei),
        province:   null,
        comm_type:  template.recTypeMap[commTypeRaw] || commTypeRaw,
        direction:  commTypeRaw?.endsWith('O') ? 'Đi' : commTypeRaw?.endsWith('T') ? 'Đến' : null,
        bts_name:   getCell(row, colMap.bts_address),
        lac:        getCell(row, colMap.lac),
        cell_id:    getCell(row, colMap.cell_id),
        latitude:   null, longitude: null,
        tac: null, enodeb: null, azimuth: null, sector: null, band: null, technology: null,
        _row: i + 1,
      };

      records.push(rec);
      if (!subscriberMap[subscriber]) subscriberMap[subscriber] = [];
      subscriberMap[subscriber].push(rec);
    }

    console.log(`[VNP] Parsed: ${records.length} valid, ${errors.length} errors | subscribers: ${Object.keys(subscriberMap).join(', ')}`);
    return { pii: {}, colMap, missing, warnings, records, errors, subscribers: subscriberMap };
  }

  // ═══════════════════════════════════════════════════════════════
  // VIETNAMOBILE PARSER — generic (needs real file to refine)
  // ═══════════════════════════════════════════════════════════════

  function parseVietnamobile(rows, template) {
    const headerRowIdx = findBestHeaderRow(rows, template);
    const headerRow    = rows[headerRowIdx] || [];
    const colMap       = buildColumnMap(headerRow, template.aliases);
    debugHeaderMapping(headerRow, colMap, 'VNM');

    const missing  = ['timestamp'].filter(f => colMap[f] == null);
    const warnings = ['source_number', 'lac', 'cell_id'].filter(f => colMap[f] == null);

    const records = [];
    const errors  = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.some(c => c != null && String(c).trim())) continue;

      const ts = getCell(row, colMap.timestamp);
      if (!ts) {
        errors.push({ row: i + 1, reason: 'Thiếu timestamp',
          sample: row.slice(0, 4).map(c => c ?? '').join(' | ') });
        continue;
      }

      records.push({
        carrier:    'VNM',
        subscriber: getCell(row, colMap.source_number),
        timestamp:  ts,
        source:     getCell(row, colMap.source_number),
        target:     getCell(row, colMap.target_number),
        duration:   getCell(row, colMap.duration),
        imsi:       null,
        imei:       getCell(row, colMap.imei),
        province:   null,
        comm_type:  getCell(row, colMap.comm_type),
        direction:  null,
        bts_name:   getCell(row, colMap.bts_address),
        lac:        getCell(row, colMap.lac),
        cell_id:    getCell(row, colMap.cell_id),
        sector:     null,
        latitude:   null, longitude: null,
        tac: null, enodeb: null, azimuth: null, band: null, technology: null,
        _row: i + 1,
      });
    }

    console.log(`[VNM] Parsed: ${records.length} valid, ${errors.length} errors`);
    return { pii: {}, colMap, missing, warnings, records, errors };
  }

  // ═══════════════════════════════════════════════════════════════
  // GMOBILE PARSER — generic (needs real file to refine)
  // ═══════════════════════════════════════════════════════════════

  function parseGmobile(rows, template) {
    const headerRowIdx = findBestHeaderRow(rows, template);
    const headerRow    = rows[headerRowIdx] || [];
    const colMap       = buildColumnMap(headerRow, template.aliases);
    debugHeaderMapping(headerRow, colMap, 'GMB');

    const missing  = ['timestamp'].filter(f => colMap[f] == null);
    const warnings = ['source_number', 'lac', 'cell_id'].filter(f => colMap[f] == null);

    const records = [];
    const errors  = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.some(c => c != null && String(c).trim())) continue;

      const ts = getCell(row, colMap.timestamp);
      if (!ts) {
        errors.push({ row: i + 1, reason: 'Thiếu timestamp',
          sample: row.slice(0, 4).map(c => c ?? '').join(' | ') });
        continue;
      }

      records.push({
        carrier:    'GMB',
        subscriber: getCell(row, colMap.source_number),
        timestamp:  ts,
        source:     getCell(row, colMap.source_number),
        target:     getCell(row, colMap.target_number),
        duration:   getCell(row, colMap.duration),
        imsi:       null,
        imei:       getCell(row, colMap.imei),
        province:   null,
        comm_type:  getCell(row, colMap.comm_type),
        direction:  null,
        bts_name:   getCell(row, colMap.bts_address),
        lac:        getCell(row, colMap.lac),
        cell_id:    getCell(row, colMap.cell_id),
        sector:     null,
        latitude:   null, longitude: null,
        tac: null, enodeb: null, azimuth: null, band: null, technology: null,
        _row: i + 1,
      });
    }

    console.log(`[GMB] Parsed: ${records.length} valid, ${errors.length} errors`);
    return { pii: {}, colMap, missing, warnings, records, errors };
  }

  // ═══════════════════════════════════════════════════════════════
  // PARSER REGISTRY — replaces switch in parseWorkbook
  // ═══════════════════════════════════════════════════════════════

  // S6.2: PARSER_REGISTRY với version-keyed aliases
  //   flat key  → backward compat (carrierKey = 'viettel')
  //   format key → new dispatch (format = 'viettel_V2')
  const PARSER_REGISTRY = {
    viettel:          parseViettel,
    viettel_V1:       parseViettel,
    viettel_V2:       parseViettel,   // same parser for now; extend when V2 spec confirmed
    mobiphone:        parseMobiphone,
    mobiphone_V1:     parseMobiphone,
    vinaphone:        parseVinaphone,
    vinaphone_V1:     parseVinaphone,
    vietnamobile:     parseVietnamobile,
    vietnamobile_V1:  parseVietnamobile,
    gmobile:          parseGmobile,
    gmobile_V1:       parseGmobile,
  };

  // ═══════════════════════════════════════════════════════════════
  // VERSION REGISTRY — per-carrier version detection rules
  // ═══════════════════════════════════════════════════════════════

  // S6.1: VERSION_REGISTRY
  //   Each carrier has one or more version entries.
  //   Entries are checked in order; first true check wins.
  //   V1 is always the fallback (no check function required).
  const VERSION_REGISTRY = {
    viettel: {
      V2: {
        description: 'With IMSI column',
        // V2: header area contains an 'imsi' column label
        check: (_wb, _sheet, rows) => {
          const scan = rows.slice(0, 30).flat()
            .map(c => normalize(String(c || '')));
          return scan.some(t => t === 'imsi' || t.includes('imsi'));
        },
      },
      V1: { description: 'Standard — fixed header row 21' },
    },
    mobiphone: {
      V1: { description: 'Standard — header row 17, PII block' },
    },
    vinaphone: {
      V1: { description: 'Standard — multi-subscriber, header row 0' },
    },
    vietnamobile: {
      V1: { description: 'Generic (awaiting real file)' },
    },
    gmobile: {
      V1: { description: 'Generic (awaiting real file)' },
    },
  };

  // ═══════════════════════════════════════════════════════════════
  // S6.1: detectFormat() — carrier + version detection
  // ═══════════════════════════════════════════════════════════════

  function detectFormat(workbook) {
    const carrierResult = detectCarrier(workbook);
    const carrier       = carrierResult.carrier;
    const template      = TEMPLATES[carrier];

    // Load first 35 rows of the best sheet for version checks
    const sheetName = template ? selectSheet(workbook, template) : workbook.SheetNames[0];
    const ws        = workbook.Sheets[sheetName];
    const rows      = ws
      ? XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }).slice(0, 35)
      : [];

    // Walk version entries in declaration order; skip V1 (fallback)
    const versions = VERSION_REGISTRY[carrier] || { V1: {} };
    let   detected = 'V1';

    for (const [ver, cfg] of Object.entries(versions)) {
      if (ver === 'V1') continue;
      if (cfg.check && cfg.check(workbook, ws, rows)) {
        detected = ver;
        break;
      }
    }

    const format = `${carrier}_${detected}`;

    console.log(`[CellLacParser] detectFormat → carrier="${carrier}" version="${detected}" format="${format}" confidence=${carrierResult.confidence}`);

    return {
      carrier,
      version:      detected,
      format,
      confidence:   carrierResult.confidence,
      source:       carrierResult.source,
      matchedRules: carrierResult.matchedRules,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN PARSE DISPATCHER
  // ═══════════════════════════════════════════════════════════════

  // S6.2: parseWorkbook accepts optional format for version-keyed dispatch
  function parseWorkbook(workbook, carrierKey, format) {
    const template = TEMPLATES[carrierKey];
    if (!template) throw new Error(`Carrier không hỗ trợ: ${carrierKey}`);

    const sheetName = selectSheet(workbook, template);
    const sheet     = workbook.Sheets[sheetName];
    if (!sheet) throw new Error(`Không tìm thấy sheet. Workbook sheets: ${workbook.SheetNames.join(', ')}`);

    console.log(`[CellLacParser] Parsing ${carrierKey.toUpperCase()} | format="${format || carrierKey}" | sheet="${sheetName}"`);

    // ★ CRITICAL: blankrows defaults to true — do NOT override
    //   Viettel fixedHeaderIdx=21 aligns with Excel row 22 only when blank rows are preserved
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header:  1,
      defval:  null,
      raw:     false,
    });

    console.log(`[CellLacParser] Total rows loaded: ${rows.length} (blank rows preserved)`);

    if (rows.length < 2) throw new Error('File quá ít dữ liệu (< 2 rows)');

    // Dispatch: prefer format key (e.g. 'viettel_V2'), fallback to carrier key
    const parserFn = (format && PARSER_REGISTRY[format])
                   || PARSER_REGISTRY[carrierKey];
    if (!parserFn) throw new Error(`Unknown carrier/format: ${format || carrierKey}`);
    const parseResult = parserFn(rows, template);

    return {
      carrier:         template.code,
      carrier_name:    template.name,
      sheet_name:      sheetName,
      total_data_rows: parseResult.records.length + parseResult.errors.length,
      valid_count:     parseResult.records.length,
      error_count:     parseResult.errors.length,
      missing_columns: parseResult.missing,
      col_warnings:    parseResult.warnings,
      parse_warnings:  parseResult.missing.length > 0
        ? [`Không tìm được cột: ${parseResult.missing.join(', ')}`]
        : [],
      pii:             parseResult.pii || {},
      column_map:      parseResult.colMap,
      records:         parseResult.records,
      errors:          (parseResult.errors || []).slice(0, 50),
      subscribers:     parseResult.subscribers || null,
      multi_subscriber: template.multiSubscriber || false,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FILE VALIDATION
  // ═══════════════════════════════════════════════════════════════

  function validateFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext))
      return `Định dạng không hỗ trợ: .${ext}`;
    if (file.size === 0)
      return 'File trống (0 bytes)';
    if (file.size > 100 * 1024 * 1024)
      return 'File quá lớn (> 100MB)';
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC: parseFile
  // ═══════════════════════════════════════════════════════════════

  function parseFile(file, carrierKey = 'auto') {
    const fileErr = validateFile(file);
    if (fileErr) return Promise.reject(new Error(fileErr));

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data     = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {
            type:      'array',
            cellDates: false,
            cellText:  true,
          });

          let resolved  = carrierKey;
          let detection = null;

          if (carrierKey === 'auto' || !TEMPLATES[carrierKey]) {
            // S6.1: Use detectFormat() → gets carrier + version + format
            detection = detectFormat(workbook);
            resolved  = detection.carrier;
            console.log(
              `[CellLacParser] Auto-detect → carrier="${resolved}" ` +
              `version="${detection.version}" format="${detection.format}" ` +
              `confidence=${detection.confidence} source="${detection.source}"`
            );
          }

          // Pass format for version-keyed dispatch in parseWorkbook
          const detectedFormat = detection?.format || null;
          const result = parseWorkbook(workbook, resolved, detectedFormat);
          result.auto_detected = (carrierKey === 'auto');
          result.file_name     = file.name;
          result.file_size     = file.size;

          // Attach detection metadata (additive — does not break existing callers)
          if (detection) {
            result.detection = detection;
            result.format    = detection.format;
            result.version   = detection.version;
          }

          console.log(
            `[CellLacParser] DONE: ${result.carrier_name} | ` +
            `valid=${result.valid_count} errors=${result.error_count} | ` +
            `sheet="${result.sheet_name}"`
          );
          resolve(result);
        } catch (err) {
          console.error('[CellLacParser] Parse failed:', err);
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Không thể đọc file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // GTP FORMAT CONVERTER
  // ═══════════════════════════════════════════════════════════════

  function toGtpFormat(records, carrier_name) {
    return records.map((r, idx) => {
      let timeStr = '--:--:--';
      if (r.timestamp) {
        const m = r.timestamp.match(/(\d{2}:\d{2}:\d{2})/);
        if (m) timeStr = m[1];
        else {
          const m2 = r.timestamp.match(/\s(\d{1,2}:\d{2})/);
          if (m2) timeStr = m2[1];
        }
      }

      const lat = r.latitude  || (21.02 + ((idx % 7) - 3) * 0.012);
      const lng = r.longitude || (105.85 + ((idx % 5) - 2) * 0.018);

      return {
        time:     timeStr,
        lac:      r.lac     || 'N/A',
        cell:     r.cell_id || 'N/A',
        ip:       carrier_name || r.carrier,
        lat:      parseFloat(Number(lat).toFixed(5)),
        lng:      parseFloat(Number(lng).toFixed(5)),
        label:    r.bts_name || `${r.carrier}-${r.lac || '?'}-${r.cell_id || '?'}`,
        strength: r.comm_type || r.direction || 'N/A',
        _raw:     r,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // EXCEL EXPORT — Multi-sheet workbook
  // ═══════════════════════════════════════════════════════════════

  // ── Inline builders: dùng cho GTP path (không có pre-built data) ──

  function _buildContactsInline(records, ownerPhone) {
    const contacts = {};
    records.forEach(r => {
      const sub   = r.subscriber || ownerPhone;
      const phone = (r.target && r.target !== sub) ? r.target
                  : (r.source && r.source !== sub) ? r.source : null;
      if (!phone || phone.length < 5) return;
      if (!contacts[phone]) {
        contacts[phone] = { count: 0, out: 0, in: 0, sms: 0,
                            zalo: '', fb: '', tg: '', note: '',
                            firstSeen: null, lastSeen: null };
      }
      const c   = contacts[phone];
      const dir = (r.direction || '').toLowerCase();
      const typ = (r.comm_type || '').toLowerCase();
      c.count++;
      if (dir.includes('đi') || dir === 'out' || dir === 'mo') c.out++;
      if (dir.includes('đến') || dir === 'in'  || dir === 'mt') c.in++;
      if (typ.includes('sms') || typ.includes('tin')) c.sms++;
      if (r.timestamp) {
        if (!c.firstSeen || r.timestamp < c.firstSeen) c.firstSeen = r.timestamp;
        if (!c.lastSeen  || r.timestamp > c.lastSeen)  c.lastSeen  = r.timestamp;
      }
    });
    return contacts;
  }

  function _buildImeiInline(records) {
    const imei = {};
    records.forEach(r => {
      if (!r.imei) return;
      if (!imei[r.imei]) {
        imei[r.imei] = { count: 0, valid: /^\d{15}$/.test(r.imei), model: '', note: '' };
      }
      imei[r.imei].count++;
    });
    return imei;
  }

  function _buildLocationInline(records) {
    const loc = {};
    records.forEach(r => {
      if (!r.lac && !r.cell_id) return;
      const key = `${r.lac || '?'}_${r.cell_id || '?'}`;
      if (!loc[key]) {
        loc[key] = { lac: r.lac, cell: r.cell_id,
                     province: r.province || '', bts: r.bts_name || '',
                     count: 0, gmap: '',
                     lat: r.latitude || null, lng: r.longitude || null };
      }
      loc[key].count++;
      if (!loc[key].province && r.province) loc[key].province = r.province;
      if (!loc[key].bts && r.bts_name)      loc[key].bts = r.bts_name;
    });
    return loc;
  }

  // ── Workbook formatting utilities ────────────────────────────────

  // Tính khoảng thời gian sử dụng từng IMEI từ records
  function _computeImeiPeriods(records) {
    const sorted = (records || []).filter(r => r.imei && r.timestamp)
                    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    const map = {};
    sorted.forEach(r => {
      if (!map[r.imei]) map[r.imei] = { first: r.timestamp, last: r.timestamp };
      else map[r.imei].last = r.timestamp;
    });
    const fmt = ts => {
      const s = String(ts || '');
      const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) return `${m[1]}/${m[2]}/${m[3].slice(2)}`;
      const m2 = s.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m2) return `${m2[3]}/${m2[2]}/${m2[1].slice(2)}`;
      return s.slice(0, 10);
    };
    const result = {};
    Object.entries(map).forEach(([imei, p]) => {
      result[imei] = p.first === p.last
        ? fmt(p.first)
        : `${fmt(p.first)} – ${fmt(p.last)}`;
    });
    return result;
  }

  // Tự căn độ rộng cột dựa trên nội dung
  function _autoColWidth(ws) {
    const ref = ws['!ref'];
    if (!ref) return;
    const range = XLSX.utils.decode_range(ref);
    const cols = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      let max = 8;
      for (let R = range.s.r; R <= range.e.r; R++) {
        const cell = ws[XLSX.utils.encode_cell({r: R, c: C})];
        if (cell && cell.v != null) {
          const len = String(cell.v).length;
          if (len > max) max = len;
        }
      }
      cols.push({wch: Math.min(max + 2, 60)});
    }
    ws['!cols'] = cols;
  }

  // Đóng băng dòng đầu tiên
  function _freezeRow1(ws) { ws['!freeze'] = {xSplit: 0, ySplit: 1}; }

  // Thêm bộ lọc tự động
  function _addAutoFilter(ws) {
    if (ws['!ref']) ws['!autofilter'] = {ref: ws['!ref']};
  }

  // In đậm các dòng chỉ định
  function _boldRows(ws, rows) {
    const ref = ws['!ref'];
    if (!ref) return;
    const range = XLSX.utils.decode_range(ref);
    rows.forEach(R => {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({r: R, c: C});
        if (ws[addr]) {
          if (!ws[addr].s) ws[addr].s = {};
          ws[addr].s.font = {bold: true};
        }
      }
    });
  }

  /**
   * Tạo XLSX workbook 6-sheet từ ParseResult:
   *   Dashboard, Subscriber_Profile, Communications,
   *   Devices, Mobility, Raw_CDR
   *
   * CDR path: dùng pre-built _contacts/_imei/_location
   * GTP path: auto-build từ records
   *
   * @param {object} parseResult - kết quả từ parseFile()
   * @returns XLSX Workbook object
   */
  function exportToExcel(parseResult) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS chưa được load');

    const wb   = XLSX.utils.book_new();
    const recs = parseResult.records || [];
    const pii  = parseResult.pii    || {};
    const ownerPhone = pii.phone || pii.phone_raw
                    || (recs[0] && recs[0].subscriber) || '';

    // CDR path truyền pre-built; GTP path tự build từ records
    const contacts = parseResult._contacts !== undefined
                   ? parseResult._contacts
                   : _buildContactsInline(recs, ownerPhone);
    const imeiMap  = parseResult._imei !== undefined
                   ? parseResult._imei
                   : _buildImeiInline(recs);
    const locMap   = parseResult._location !== undefined
                   ? parseResult._location
                   : _buildLocationInline(recs);

    const imeiPeriods   = _computeImeiPeriods(recs);
    const totalInteract = Object.values(contacts).reduce((s, v) => s + (v.count || 0), 0);
    const totalRecords  = recs.length;

    const dateFrom = pii.report_from
                   || (recs[0] ? String(recs[0].timestamp || '').slice(0, 10) : '');
    const dateTo   = pii.report_to
                   || (recs.length ? String(recs[recs.length - 1].timestamp || '').slice(0, 10) : '');
    const nd = new Date();
    const today = `${String(nd.getDate()).padStart(2,'0')}/${String(nd.getMonth()+1).padStart(2,'0')}/${nd.getFullYear()}`;

    // ── Sheet 1: Dashboard ────────────────────────────────────────
    const dashWs = XLSX.utils.aoa_to_sheet([
      ['DASHBOARD TỔNG QUAN',         ''],
      ['',                            ''],
      ['Chỉ số',                      'Giá trị'],
      ['Số thuê bao',                 ownerPhone],
      ['Chủ thuê bao',                pii.name || pii.full_name || ''],
      ['Nhà mạng',                    pii.carrier || parseResult.carrier_name || ''],
      ['Tổng số bản ghi',             totalRecords],
      ['Tổng số đối tác liên lạc',   Object.keys(contacts).length],
      ['Tổng số IMEI',                Object.keys(imeiMap).length],
      ['Tổng số vị trí BTS',          Object.keys(locMap).length],
      ['Thời gian bắt đầu',           dateFrom],
      ['Thời gian kết thúc',          dateTo],
      ['Ngày xuất báo cáo',           today],
    ]);
    dashWs['!merges'] = [{s:{r:0,c:0}, e:{r:0,c:1}}];
    _boldRows(dashWs, [0, 2]);
    _autoColWidth(dashWs);
    XLSX.utils.book_append_sheet(wb, dashWs, 'Dashboard');

    // ── Sheet 2: Subscriber_Profile ───────────────────────────────
    const profWs = XLSX.utils.aoa_to_sheet([
      ['THÔNG TIN THUÊ BAO',   ''],
      ['',                     ''],
      ['Số điện thoại',        ownerPhone],
      ['Họ tên',               pii.name       || pii.full_name      || ''],
      ['Ngày sinh',            pii.dob        || pii.date_of_birth  || ''],
      ['Địa chỉ',             pii.address    || ''],
      ['Giấy tờ',             pii.id_doc     || pii.id_doc_number  || ''],
      ['Ngày cấp',            pii.id_issue   || pii.id_issue_date  || ''],
      ['Ngày kích hoạt',      pii.activation || ''],
      ['',                    ''],
      ['THÔNG TIN PHÂN TÍCH', ''],
      ['',                    ''],
      ['Nhà mạng',            pii.carrier    || parseResult.carrier_name || ''],
      ['Từ ngày',             dateFrom],
      ['Đến ngày',            dateTo],
      ['Ngày xuất báo cáo',  today],
    ]);
    profWs['!merges'] = [
      {s:{r:0, c:0}, e:{r:0, c:1}},
      {s:{r:10,c:0}, e:{r:10,c:1}},
    ];
    _boldRows(profWs, [0, 10]);
    _autoColWidth(profWs);
    XLSX.utils.book_append_sheet(wb, profWs, 'Subscriber_Profile');

    // ── Sheet 3: Communications ───────────────────────────────────
    const commsHdr = ['Số điện thoại','Tần suất','Tỷ lệ %','Gọi đi','Gọi đến','SMS',
                      'Zalo','Facebook','Telegram','Ghi chú'];
    const commsRows = Object.entries(contacts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([phone, v]) => ({
        'Số điện thoại': phone,
        'Tần suất':      v.count || 0,
        'Tỷ lệ %':       totalInteract > 0
                         ? +((v.count / totalInteract * 100).toFixed(1)) : 0,
        'Gọi đi':        v.out  || 0,
        'Gọi đến':       v.in   || 0,
        'SMS':           v.sms  || 0,
        'Zalo':          v.zalo || '',
        'Facebook':      v.fb   || '',
        'Telegram':      v.tg   || '',
        'Ghi chú':       v.note || '',
      }));
    const commsWs = commsRows.length
      ? XLSX.utils.json_to_sheet(commsRows)
      : XLSX.utils.aoa_to_sheet([commsHdr]);
    _freezeRow1(commsWs); _addAutoFilter(commsWs);
    _boldRows(commsWs, [0]); _autoColWidth(commsWs);
    XLSX.utils.book_append_sheet(wb, commsWs, 'Communications');

    // ── Sheet 4: Devices ─────────────────────────────────────────
    const devHdr = ['IMEI','Model','Số lần xuất hiện','Ghi chú','Thời gian sử dụng'];
    const devRows = Object.entries(imeiMap)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([imei, v]) => ({
        'IMEI':               imei,
        'Model':              v.model || '',
        'Số lần xuất hiện':   v.count || 0,
        'Ghi chú':            v.note  || '',
        'Thời gian sử dụng':  imeiPeriods[imei] || '',
      }));
    const devWs = devRows.length
      ? XLSX.utils.json_to_sheet(devRows)
      : XLSX.utils.aoa_to_sheet([devHdr]);
    _freezeRow1(devWs); _addAutoFilter(devWs);
    _boldRows(devWs, [0]); _autoColWidth(devWs);
    XLSX.utils.book_append_sheet(wb, devWs, 'Devices');

    // ── Sheet 5: Mobility ─────────────────────────────────────────
    const mobHdr = ['LAC','CID','Mã tỉnh','Tên BTS','Tần suất','Tỷ lệ %','Google Maps','MNC'];
    const mobRows = Object.values(locMap)
      .sort((a, b) => b.count - a.count)
      .map(v => {
        let gm = v.gmap || '';
        if (!gm && v.lat && v.lng)
          gm = `https://www.google.com/maps?q=${v.lat},${v.lng}`;
        return {
          'LAC':       v.lac      || '',
          'CID':       v.cell     || '',
          'Mã tỉnh':   v.province || '',
          'Tên BTS':   v.bts      || '',
          'Tần suất':  v.count    || 0,
          'Tỷ lệ %':   totalRecords > 0
                       ? +((v.count / totalRecords * 100).toFixed(1)) : 0,
          'Google Maps': gm,
          'MNC':       v.mnc      || '',
        };
      });
    const mobWs = mobRows.length
      ? XLSX.utils.json_to_sheet(mobRows)
      : XLSX.utils.aoa_to_sheet([mobHdr]);
    _freezeRow1(mobWs); _addAutoFilter(mobWs);
    _boldRows(mobWs, [0]); _autoColWidth(mobWs);
    XLSX.utils.book_append_sheet(wb, mobWs, 'Mobility');

    // ── Sheet 6: Raw_CDR ──────────────────────────────────────────
    const rawHdr = ['Số chủ','Số liên hệ','Thời gian','Thời lượng','IMEI',
                    'Mã tỉnh','Loại','Dịch vụ','Địa chỉ','LAC','Cell'];
    const rawRows = recs.map(r => {
      const cNum = (r.target && r.target !== ownerPhone && r.target !== r.subscriber)
        ? r.target
        : (r.source && r.source !== ownerPhone && r.source !== r.subscriber
           ? r.source : r.target || '');
      return {
        'Số chủ':     ownerPhone || r.subscriber || '',
        'Số liên hệ': cNum,
        'Thời gian':  r.timestamp || '',
        'Thời lượng': r.duration  || '',
        'IMEI':       r.imei      || '',
        'Mã tỉnh':    r.province  || '',
        'Loại':       r.comm_type || '',
        'Dịch vụ':    r.service   || '',
        'Địa chỉ':    r.bts_name  || '',
        'LAC':        r.lac       || '',
        'Cell':       r.cell_id   || '',
      };
    });
    const rawWs = rawRows.length
      ? XLSX.utils.json_to_sheet(rawRows)
      : XLSX.utils.aoa_to_sheet([rawHdr]);
    _freezeRow1(rawWs); _addAutoFilter(rawWs);
    _boldRows(rawWs, [0]); _autoColWidth(rawWs);
    XLSX.utils.book_append_sheet(wb, rawWs, 'Raw_CDR');

    return wb;
  }

  function _appendSheet(wb, jsonData, sheetName) {
    if (!jsonData || jsonData.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([['Không có dữ liệu']]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      return;
    }
    const ws = XLSX.utils.json_to_sheet(jsonData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  /**
   * Download XLSX file từ ParseResult
   * Tên file: <phone>_export_all.xlsx hoặc <carrier>_export_all.xlsx
   */
  function downloadExcel(parseResult) {
    const wb       = exportToExcel(parseResult);
    const phone    = parseResult.pii?.phone
                     || parseResult.pii?.phone_raw
                     || Object.keys(parseResult.subscribers || {})[0]
                     || parseResult.carrier;
    const filename = `${phone}_export_all.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  // ═══════════════════════════════════════════════════════════════
  // CSV / JSON EXPORT
  // ═══════════════════════════════════════════════════════════════

  const _FIELDS = [
    'carrier','subscriber','timestamp','source','target','duration',
    'imsi','imei','province','comm_type','direction',
    'bts_name','lac','cell_id','sector','latitude','longitude',
    'tac','enodeb','azimuth','band','technology',
  ];

  function exportCSV(records) {
    const lines = [_FIELDS.join(',')];
    for (const r of records) {
      lines.push(_FIELDS.map(f => {
        const v = r[f];
        if (v == null) return '';
        const s = String(v);
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','));
    }
    return lines.join('\r\n');
  }

  function exportJSON(records) {
    return JSON.stringify(
      records.map(r => Object.fromEntries(_FIELDS.map(f => [f, r[f] ?? null]))),
      null, 2
    );
  }

  function downloadText(content, filename, mimeType) {
    const bom  = mimeType.includes('csv') ? '﻿' : '';
    const blob = new Blob([bom + content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ═══════════════════════════════════════════════════════════════
  // S7.2: buildDerived — shared pure function
  //   Returns {imeiData, contactsData, locationData, subscriber}
  //   Used by both cdr-analyzer.js and batch-processor.js
  // ═══════════════════════════════════════════════════════════════

  function buildDerived(records, pii, carrierName) {
    const imeiData     = {};
    const contactsData = {};
    const locationData = {};

    (records || []).forEach(r => {
      // imeiData
      const imei = r.imei;
      if (imei) {
        if (!imeiData[imei]) {
          imeiData[imei] = { count: 0, valid: /^\d{15}$/.test(imei), model: '', note: '' };
        }
        imeiData[imei].count++;
      }

      // contactsData
      const contact = r.target || r.source;
      const sub     = r.subscriber;
      const phone   = (contact && contact !== sub) ? contact : null;
      if (phone && phone.length >= 5) {
        if (!contactsData[phone]) {
          contactsData[phone] = { count: 0, out: 0, in: 0, sms: 0,
            zalo: '', fb: '', tg: '', note: '', firstSeen: null, lastSeen: null };
        }
        const c   = contactsData[phone];
        const dir = (r.direction || '').toLowerCase();
        const typ = (r.comm_type || '').toLowerCase();
        c.count++;
        if (dir.includes('đi') || dir === 'out' || dir === 'mo') c.out++;
        if (dir.includes('đến') || dir === 'in'  || dir === 'mt') c.in++;
        if (typ.includes('sms') || typ.includes('tin')) c.sms++;
        if (r.timestamp) {
          if (!c.firstSeen || r.timestamp < c.firstSeen) c.firstSeen = r.timestamp;
          if (!c.lastSeen  || r.timestamp > c.lastSeen)  c.lastSeen  = r.timestamp;
        }
      }

      // locationData
      const lac    = r.lac    ? String(r.lac).trim()    : null;
      const cellId = r.cell_id ? String(r.cell_id).trim() : null;
      if (lac || cellId) {
        const key = `${lac || '?'}_${cellId || '?'}`;
        if (!locationData[key]) {
          locationData[key] = { lac, cell: cellId,
            province: r.province || '', bts: r.bts_name || '',
            count: 0, note: '', lat: r.latitude || null, lng: r.longitude || null };
        }
        locationData[key].count++;
        if (!locationData[key].province && r.province) locationData[key].province = r.province;
        if (!locationData[key].bts && r.bts_name)      locationData[key].bts = r.bts_name;
      }
    });

    const p         = pii || {};
    const firstRec  = (records || [])[0];
    const subscriber = {
      phone:       p.phone_raw      || firstRec?.subscriber || '',
      name:        p.full_name      || '',
      dob:         p.date_of_birth  || '',
      address:     p.address        || '',
      id_doc:      p.id_doc_number  || '',
      activation:  p.activation     || '',
      carrier:     carrierName      || '',
      note:        '',
      report_from: p.report_from    || '',
      report_to:   p.report_to      || '',
    };

    return { imeiData, contactsData, locationData, subscriber };
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  return {
    TEMPLATES,
    PARSER_REGISTRY,
    VERSION_REGISTRY,
    SUPPORTED_CARRIERS: Object.keys(TEMPLATES),
    PROVINCE_GEO,
    parseFile,
    detectCarrier: (wb) => detectCarrier(wb),
    detectFormat:  (wb) => detectFormat(wb),
    buildDerived,
    toGtpFormat,
    exportToExcel,
    downloadExcel,
    exportCSV,
    exportJSON,
    downloadText,
    normalize,
  };
})();
