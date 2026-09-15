/* ================================================================
   CYBEROPS — IP Intelligence Platform
   Frontend JavaScript  |  v1.0
================================================================ */

'use strict';

/* ----------------------------------------------------------------
   SIDEBAR TOGGLE
---------------------------------------------------------------- */
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const mc = document.getElementById('mainContent');
  if (window.innerWidth <= 768) {
    sb.classList.toggle('mobile-open');
  } else {
    sb.classList.toggle('collapsed');
    mc.classList.toggle('expanded');
  }
}

/* ----------------------------------------------------------------
   LIVE CLOCK (UTC+7 / ICT)
---------------------------------------------------------------- */
function startClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  function tick() {
    try {
      el.textContent = new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }) + ' ICT';
    } catch (_) {
      // fallback: manual +7h offset
      const vn = new Date(Date.now() + 7 * 3600000);
      el.textContent = vn.toISOString().replace('T', ' ').slice(0, 19) + ' ICT';
    }
  }
  tick();
  setInterval(tick, 1000);
}

/* ----------------------------------------------------------------
   COPY TO CLIPBOARD
---------------------------------------------------------------- */
function copyText(text, btnEl) {
  const doFeedback = (ok) => {
    if (!btnEl) return;
    const prev = btnEl.innerHTML;
    btnEl.innerHTML = ok
      ? '<i class="fa-solid fa-check"></i>'
      : '<i class="fa-solid fa-xmark"></i>';
    btnEl.classList.toggle('ok', ok);
    setTimeout(() => { btnEl.innerHTML = prev; btnEl.classList.remove('ok'); }, 1600);
  };

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => doFeedback(true)).catch(() => doFeedback(false));
  } else {
    // HTTP fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    doFeedback(ok);
  }
}

/* ----------------------------------------------------------------
   GENERATE FORM — MODE SELECTOR
---------------------------------------------------------------- */
function initModeSelector() {
  const radios = document.querySelectorAll('input[name="mode"]');
  if (!radios.length) return;

  function show(mode) {
    document.querySelectorAll('.cond-section').forEach(s => s.classList.remove('active'));
    const t = document.getElementById('cond-' + mode);
    if (t) t.classList.add('active');
  }

  radios.forEach(r => r.addEventListener('change', () => show(r.value)));

  const checked = document.querySelector('input[name="mode"]:checked');
  if (checked) show(checked.value);
}

/* ----------------------------------------------------------------
   UPLOAD ZONE — DRAG & DROP
---------------------------------------------------------------- */
function initUploadZone() {
  const zone = document.querySelector('.upload-zone');
  if (!zone) return;
  const fileInput = zone.querySelector('input[type="file"]');
  const label = zone.querySelector('.upload-txt');

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) {
      // Create a new DataTransfer to assign to input.files
      const dt = e.dataTransfer;
      fileInput.files = dt.files;
      setFileLabel(dt.files[0].name);
    }
  });

  fileInput.addEventListener('change', e => {
    if (e.target.files[0]) setFileLabel(e.target.files[0].name);
  });

  function setFileLabel(name) {
    if (label) label.innerHTML = `<i class="fa-solid fa-check" style="color:var(--green)"></i>&nbsp; ${escHtml(name)}`;
    zone.style.borderColor = 'var(--green)';
  }
}

/* ----------------------------------------------------------------
   DELETE CONFIRM MODAL
---------------------------------------------------------------- */
function confirmDelete(token, label) {
  const modal = document.getElementById('deleteModal');
  const labelEl = document.getElementById('deleteLabel');
  const form = document.getElementById('deleteForm');
  if (!modal || !form) return;
  if (labelEl) labelEl.textContent = label || token;
  form.action = '/admin/delete/' + token;
  modal.classList.add('open');
}

function closeDeleteModal() {
  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.remove('open');
}

/* ----------------------------------------------------------------
   UA → HUMAN-READABLE
---------------------------------------------------------------- */
function parseUA(ua) {
  if (!ua) return '—';
  let parts = [];
  // Device / OS
  if      (/iPhone/i.test(ua))   parts.push('iPhone');
  else if (/iPad/i.test(ua))     parts.push('iPad');
  else if (/Android/i.test(ua))  parts.push('Android');
  else if (/Windows NT/i.test(ua)) parts.push('Windows');
  else if (/Macintosh/i.test(ua)) parts.push('macOS');
  else if (/Linux/i.test(ua))    parts.push('Linux');
  // Browser
  if      (/Edg\//i.test(ua))                        parts.push('Edge');
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua))  parts.push('Opera');
  else if (/Firefox\//i.test(ua))                    parts.push('Firefox');
  else if (/Chrome\//i.test(ua) && !/Chromium/.test(ua)) parts.push('Chrome');
  else if (/Safari\//i.test(ua) && !/Chrome/.test(ua))   parts.push('Safari');

  return parts.length ? parts.join(' / ') : ua.slice(0, 40) + (ua.length > 40 ? '…' : '');
}

/* ----------------------------------------------------------------
   REFERER → PLATFORM CHIP
---------------------------------------------------------------- */
function refPlatform(ref) {
  if (!ref) return { icon: 'fa-solid fa-globe', label: '—', color: '#4f647d' };
  const r = ref.toLowerCase();
  if (r.includes('zalo'))            return { icon: 'fa-solid fa-comment-dots', label: 'Zalo',     color: '#0068ff' };
  if (r.includes('t.me') || r.includes('telegram')) return { icon: 'fa-brands fa-telegram', label: 'Telegram', color: '#26a5e4' };
  if (r.includes('gmail') || r.includes('mail.google')) return { icon: 'fa-solid fa-envelope', label: 'Gmail', color: '#ea4335' };
  if (r.includes('facebook') || r.includes('fb.com')) return { icon: 'fa-brands fa-facebook', label: 'Facebook', color: '#1877f2' };
  if (r.includes('twitter') || r.includes('x.com')) return { icon: 'fa-brands fa-x-twitter', label: 'X / Twitter', color: '#e7e9ea' };
  if (r.includes('viber'))           return { icon: 'fa-brands fa-viber', label: 'Viber',    color: '#7360f2' };
  if (r.includes('line.me'))         return { icon: 'fa-solid fa-comment', label: 'LINE',     color: '#00c300' };
  try {
    const host = new URL(ref).hostname.replace('www.', '');
    return { icon: 'fa-solid fa-globe', label: host.slice(0, 22), color: '#8ca0bc' };
  } catch (_) {
    return { icon: 'fa-solid fa-globe', label: ref.slice(0, 22), color: '#8ca0bc' };
  }
}

/* ----------------------------------------------------------------
   ENRICH HIT TABLE (UA parse, referer chips, timestamps)
---------------------------------------------------------------- */
function enrichHitTable() {
  // User-agent cells
  document.querySelectorAll('[data-ua]').forEach(el => {
    el.title = el.dataset.ua;
    el.textContent = parseUA(el.dataset.ua);
  });

  // Referer cells
  document.querySelectorAll('[data-ref]').forEach(el => {
    const raw = el.dataset.ref;
    const p = refPlatform(raw);
    el.innerHTML = raw
      ? `<span class="ref-chip" title="${escHtml(raw)}"><i class="${escHtml(p.icon)}" style="color:${p.color}"></i>&nbsp;${escHtml(p.label)}</span>`
      : '<span style="color:var(--t4)">—</span>';
  });

  // Timestamps → ICT
  document.querySelectorAll('[data-utc]').forEach(el => {
    const raw = el.dataset.utc;
    try {
      const d = new Date(raw.replace(' ', 'T') + 'Z');
      if (isNaN(d)) return;
      el.textContent = d.toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }) + ' ICT';
      el.title = 'UTC: ' + raw;
    } catch (_) {}
  });
}

/* ----------------------------------------------------------------
   CLOSE MODAL ON BACKDROP CLICK
---------------------------------------------------------------- */
function initModalBackdrop() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
}

/* ----------------------------------------------------------------
   ESCAPE HTML
---------------------------------------------------------------- */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ----------------------------------------------------------------
   INIT
---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  initModeSelector();
  initUploadZone();
  initModalBackdrop();
  enrichHitTable();
});
