/**
 * KPI Staff Module
 * Powers dashboard.html, staff-kpi.html, kpi-progress.html
 */

// ── Data Store (mirrors manager store, shared localStorage) ──────────────────
function getKpis() {
  return JSON.parse(localStorage.getItem('kpis') || '[]');
}
function saveKpis(kpis) {
  localStorage.setItem('kpis', JSON.stringify(kpis));
}

function getMyKpis() {
  const user = getCurrentUser();
  if (!user) return [];
  // Match by id OR email (in case ID was used as assignedTo)
  return getKpis().filter(k =>
    k.assignedTo === user.id ||
    k.assignedTo === user.email
  );
}

// ── Staff Dashboard ───────────────────────────────────────────────────────────
function loadStaffDashboard() {
  const kpis      = getMyKpis();
  const assigned  = kpis.length;
  const completed = kpis.filter(k => k.status === 'approved').length;
  const pending   = kpis.filter(k => ['pending','in-progress'].includes(k.status)).length;
  const avgProg   = assigned > 0
    ? Math.round(kpis.reduce((sum, k) => sum + (k.progress || 0), 0) / assigned)
    : 0;

  setText('statAssigned',  assigned);
  setText('statCompleted', completed);
  setText('statPending',   pending);
  setText('statProgress',  avgProg + '%');

  // Overall progress ring (SVG circle animation)
  const ring = document.getElementById('progressRing');
  if (ring) {
    const c = 2 * Math.PI * 50;
    ring.setAttribute('stroke-dasharray', c);
    // Animate with small delay for visual effect
    setTimeout(() => {
      ring.setAttribute('stroke-dashoffset', c - (c * avgProg / 100));
    }, 200);
  }
  setText('progressRingText', avgProg + '%');

  renderMyKpiTable(kpis);
  renderActivity(kpis);
}

// ── My KPI Table (dashboard overview) ────────────────────────────────────────
function renderMyKpiTable(kpis) {
  const tbody = document.getElementById('myKpiTableBody');
  if (!tbody) return;

  let data = kpis || getMyKpis();
  const search  = (document.getElementById('dashSearch')?.value || '').toLowerCase();
  const statusF = document.getElementById('dashStatusFilter')?.value || '';

  if (search)  data = data.filter(k => k.name.toLowerCase().includes(search) || (k.category||'').toLowerCase().includes(search));
  if (statusF) data = data.filter(k => k.status === statusF);

  const empty = document.getElementById('dashEmptyState');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted);">No KPIs match your search.</td></tr>';
    if (empty) empty.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = data.slice(0, 10).map(k => {
    const overdue = k.dueDate && k.status !== 'approved' && new Date(k.dueDate) < new Date();
    return `<tr>
      <td>
        <div style="font-weight:600;color:var(--navy);">${esc(k.name)}</div>
        <div style="font-size:0.72rem;color:var(--muted);margin-top:2px;">${esc(k.category||'')}${overdue ? ' · <span style="color:#dc2626;font-weight:700;">Overdue</span>' : ''}</div>
      </td>
      <td style="font-size:0.85rem;">${esc(k.target||'—')} <span style="color:var(--muted);font-size:0.72rem;">${esc(k.unit||'')}</span></td>
      <td style="min-width:120px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${k.progress||0}%;background:${pColor(k.progress)};border-radius:3px;"></div>
          </div>
          <span style="font-size:0.72rem;font-weight:700;">${k.progress||0}%</span>
        </div>
      </td>
      <td style="font-size:0.82rem;">${k.dueDate ? fmtDate(k.dueDate) : '—'}</td>
      <td>${sBadge(k.status)}</td>
      <td style="text-align:right;">
        ${k.status !== 'approved'
          ? `<button onclick="goUpdateKpi('${k.id}')" style="background:var(--primary);color:#fff;font-size:0.72rem;padding:5px 12px;border-radius:8px;border:none;cursor:pointer;font-weight:700;">Update</button>`
          : '<span style="font-size:0.8rem;font-weight:700;color:var(--success);">✓ Done</span>'}
      </td>
    </tr>`;
  }).join('');
}

function goUpdateKpi(id) {
  window.location.href = 'kpi-progress.html?id=' + id;
}

// ── Recent Activity Feed ──────────────────────────────────────────────────────
function renderActivity(kpis) {
  const list = document.getElementById('activityList');
  if (!list) return;

  const sorted = [...(kpis || getMyKpis())]
    .filter(k => k.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 6);

  if (!sorted.length) return;

  const dotMap = { approved:'success', rejected:'danger', submitted:'primary', 'in-progress':'warning', pending:'primary' };

  list.innerHTML = sorted.map(k => `
    <div class="activity-item">
      <div class="activity-dot ${dotMap[k.status] || 'primary'}"></div>
      <div>
        <div class="activity-text" style="font-weight:500;">${esc(k.name)}</div>
        <div class="activity-time">${sLabel(k.status)} · ${k.updatedAt ? timeAgo(k.updatedAt) : ''}</div>
      </div>
    </div>
  `).join('');
}

// ── Staff KPI Cards (staff-kpi.html) ──────────────────────────────────────────
function renderStaffKpis() {
  const grid  = document.getElementById('kpiCardGrid');
  const empty = document.getElementById('kpiEmptyState');
  if (!grid) return;

  let kpis = getMyKpis();

  const search = (document.getElementById('searchKpi')?.value || '').toLowerCase();
  const filter = (typeof activeFilter !== 'undefined') ? activeFilter : '';

  if (search) kpis = kpis.filter(k => k.name.toLowerCase().includes(search) || (k.category||'').toLowerCase().includes(search));
  if (filter) kpis = kpis.filter(k => k.status === filter);

  const countEl = document.getElementById('kpiCountText');
  if (countEl) countEl.textContent = kpis.length;

  if (!kpis.length) {
    grid.innerHTML = '';
    if (empty) {
      empty.style.display = 'block';
      const msg = document.getElementById('emptyMsg');
      if (msg) msg.textContent = filter || search
        ? 'No KPIs match your current filter or search.'
        : 'Your manager hasn\'t assigned any KPIs to you yet.';
    }
    return;
  }
  if (empty) empty.style.display = 'none';

  grid.innerHTML = kpis.map((k, i) => {
    const overdue = k.dueDate && k.status !== 'approved' && new Date(k.dueDate) < new Date();
    const canUpdate = !['approved'].includes(k.status);
    return `
    <div class="kpi-item-card fade-in-up" style="animation-delay:${i * 0.05}s;">
      <div class="kpi-item-card-header">
        <div style="flex:1;min-width:0;">
          <div class="kpi-item-card-name">${esc(k.name)}</div>
          <div class="kpi-item-card-meta">${esc(k.category||'General')}${k.priority ? ' · ' + priorityHtml(k.priority) : ''}</div>
        </div>
        ${sBadge(k.status)}
      </div>
      <div class="kpi-item-card-body">
        <div class="kpi-progress-section">
          <div class="kpi-progress-row">
            <span>Target</span>
            <span>${esc(k.target||'—')} ${esc(k.unit||'')}</span>
          </div>
          ${k.currentValue ? `<div class="kpi-progress-row"><span>Current</span><span>${esc(k.currentValue)}</span></div>` : ''}
          <div class="kpi-progress-row">
            <span>Progress</span>
            <span style="color:${pColor(k.progress)};font-weight:700;">${k.progress||0}%</span>
          </div>
        </div>

        <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:12px;">
          <div style="height:100%;width:${k.progress||0}%;background:${pColor(k.progress)};border-radius:4px;transition:width 0.5s;"></div>
        </div>

        <div class="kpi-card-footer-meta">
          <span>📅 ${k.dueDate ? fmtDate(k.dueDate) : 'No deadline'}${overdue ? ' <span style="color:#dc2626;font-weight:700;">(Overdue)</span>' : ''}</span>
          ${k.updatedAt ? `<span title="${new Date(k.updatedAt).toLocaleString()}">🔄 ${timeAgo(k.updatedAt)}</span>` : ''}
        </div>

        ${k.rejectionReason && k.status === 'rejected'
          ? `<div style="background:#fef2f2;border-radius:8px;padding:10px;margin-top:10px;font-size:0.8rem;color:#991b1b;border:1px solid #fecaca;"><strong>Rejected:</strong> ${esc(k.rejectionReason)}</div>`
          : ''}

        ${canUpdate
          ? `<button class="btn btn-primary btn-block" style="margin-top:14px;" onclick="openKpiUpdateModal('${k.id}')">
               <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
               ${k.status === 'rejected' ? 'Resubmit' : 'Update Progress'}
             </button>`
          : `<div style="display:flex;align-items:center;gap:8px;margin-top:14px;padding:10px;background:#f0fdf4;border-radius:10px;font-size:0.85rem;color:#16a34a;font-weight:700;border:1px solid #bbf7d0;">
               <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>
               Approved by Manager
             </div>`}
      </div>
    </div>`;
  }).join('');
}

// ── Update Progress Modal (staff-kpi.html) ────────────────────────────────────
function openKpiUpdateModal(id) {
  const kpi = getKpis().find(k => k.id === id);
  if (!kpi) return;

  setVal('updateKpiId', id);
  setText('updateKpiNameDisplay', kpi.name);
  setText('updateKpiTarget', 'Target: ' + (kpi.target || '—') + (kpi.unit ? ' ' + kpi.unit : ''));

  const val = kpi.progress || 0;
  const slider = document.getElementById('progressSlider');
  const input  = document.getElementById('progressInput');
  if (slider) slider.value = val;
  if (input) input.value = val;

  setVal('progressComment', kpi.comments || '');
  const fileSelected = document.getElementById('fileSelected');
  const fileInput    = document.getElementById('evidenceFile');
  if (fileSelected) fileSelected.style.display = 'none';
  if (fileInput)    fileInput.value = '';

  document.getElementById('updateProgressModal').classList.add('open');
}

function submitProgress() {
  const id       = document.getElementById('updateKpiId')?.value || '';
  const progress = parseInt(document.getElementById('progressInput')?.value) || 0;
  const comment  = document.getElementById('progressComment')?.value.trim() || '';
  const fileInput = document.getElementById('evidenceFile');

  if (!id) return;

  const kpis = getKpis();
  const idx  = kpis.findIndex(k => k.id === id);
  if (idx === -1) return;

  const now = new Date().toISOString();
  kpis[idx].progress    = progress;
  kpis[idx].comments    = comment;
  kpis[idx].status      = 'submitted';
  kpis[idx].submittedAt = now;
  kpis[idx].updatedAt   = now;

  function finish() {
    saveKpis(kpis);
    closeModal('updateProgressModal');
    renderStaffKpis();
    if (typeof loadStaffDashboard === 'function') loadStaffDashboard();
  }

  if (fileInput && fileInput.files.length > 0) {
    const file   = fileInput.files[0];
    kpis[idx].evidenceName = file.name;
    const reader = new FileReader();
    reader.onload = e => { kpis[idx].evidenceData = e.target.result; finish(); };
    reader.readAsDataURL(file);
  } else {
    finish();
  }
}

// ── Progress Page (kpi-progress.html) ────────────────────────────────────────
function initProgressPage() {
  const sel = document.getElementById('kpiSelect');
  if (!sel) return;

  // Exclude already approved
  const kpis = getMyKpis().filter(k => k.status !== 'approved');
  sel.innerHTML = '<option value="">— Choose a KPI —</option>' +
    kpis.map(k => `<option value="${k.id}">${esc(k.name)} (${k.progress||0}% complete)</option>`).join('');

  // Pre-select from URL ?id= param
  const urlId = new URLSearchParams(window.location.search).get('id');
  if (urlId && kpis.find(k => k.id === urlId)) {
    sel.value = urlId;
    onKpiSelect();
  }
}

function onKpiSelect() {
  const id = document.getElementById('kpiSelect')?.value || '';
  const infoCard = document.getElementById('kpiInfoCard');
  if (!id) { if (infoCard) infoCard.style.display = 'none'; return; }

  const kpi = getKpis().find(k => k.id === id);
  if (!kpi) return;

  if (infoCard) infoCard.style.display = 'block';

  const pct = kpi.progress || 0;
  setText('infoKpiName', kpi.name || '—');
  setText('infoTarget',  (kpi.target || '—') + (kpi.unit ? ' ' + kpi.unit : ''));
  setText('infoDue',     kpi.dueDate ? fmtDate(kpi.dueDate) : '—');
  setText('infoCat',     kpi.category || '—');
  const statusEl = document.getElementById('infoStatus');
  if (statusEl) statusEl.innerHTML = sBadge(kpi.status);

  // Animate progress ring (r=56 used in kpi-progress.html SVG)
  const c    = 2 * Math.PI * 56;
  const ring = document.getElementById('kpiInfoRing');
  if (ring) {
    ring.setAttribute('stroke-dasharray', c);
    setTimeout(() => ring.setAttribute('stroke-dashoffset', c - (c * pct / 100)), 100);
  }
  setText('ringPct', pct + '%');

  // Pre-fill slider/input/bar
  const slider = document.getElementById('progressSlider');
  const input  = document.getElementById('progressInput');
  const bar    = document.getElementById('progressBar');
  if (slider) slider.value = pct;
  if (input)  input.value  = pct;
  if (bar)    bar.style.width = pct + '%';

  setVal('currentValue',  kpi.currentValue || '');
  setVal('progressNotes', kpi.comments     || '');
}

function submitProgressPage() {
  const id          = document.getElementById('kpiSelect')?.value || '';
  const progress    = parseInt(document.getElementById('progressInput')?.value) || 0;
  const notes       = document.getElementById('progressNotes')?.value.trim() || '';
  const currentVal  = document.getElementById('currentValue')?.value.trim()  || '';
  const fileInput   = document.getElementById('evidenceFile');

  // Validation
  const kpiSelErr  = document.getElementById('kpiSelectError');
  const progErr    = document.getElementById('progressError');
  const evidErr    = document.getElementById('evidenceError');
  const errAlert   = document.getElementById('errorAlert');
  if (kpiSelErr)  kpiSelErr.textContent  = '';
  if (progErr)    progErr.textContent    = '';
  if (evidErr)    evidErr.textContent    = '';
  if (errAlert)   errAlert.style.display = 'none';

  let valid = true;
  if (!id)                                { if (kpiSelErr) kpiSelErr.textContent = 'Please select a KPI.';                   valid = false; }
  if (progress < 0 || progress > 100)     { if (progErr)   progErr.textContent   = 'Progress must be between 0 and 100%.';  valid = false; }

  if (!valid) {
    if (errAlert) { errAlert.style.display = 'flex'; setText('errorMsg', 'Please fix the errors above.'); }
    return;
  }

  const kpis = getKpis();
  const idx  = kpis.findIndex(k => k.id === id);
  if (idx === -1) return;

  const now = new Date().toISOString();
  kpis[idx].progress     = progress;
  kpis[idx].currentValue = currentVal;
  kpis[idx].comments     = notes;
  kpis[idx].status       = 'submitted';
  kpis[idx].submittedAt  = now;
  kpis[idx].updatedAt    = now;

  function finish() {
    saveKpis(kpis);
    const sa = document.getElementById('successAlert');
    if (sa) { sa.style.display = 'flex'; setText('successMsg', 'Progress submitted! Your manager will review it soon.'); }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Reset form UI
    document.getElementById('progressForm')?.reset();
    const ic = document.getElementById('kpiInfoCard');
    if (ic) ic.style.display = 'none';
    const pb = document.getElementById('progressBar');
    if (pb) pb.style.width = '0%';
    const fp = document.getElementById('filePreview');
    if (fp) fp.style.display = 'none';

    setTimeout(initProgressPage, 120);
  }

  if (fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    kpis[idx].evidenceName = file.name;
    const reader = new FileReader();
    reader.onload = e => { kpis[idx].evidenceData = e.target.result; finish(); };
    reader.readAsDataURL(file);
  } else {
    finish();
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function closeModal(id)    { document.getElementById(id)?.classList.remove('open'); }
function setText(id, val)  { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val)   { const el = document.getElementById(id); if (el) el.value = val; }

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-MY', { day:'2-digit', month:'short', year:'numeric' });
}

function pColor(pct) {
  pct = pct || 0;
  if (pct >= 80) return '#16a34a';
  if (pct >= 50) return '#d97706';
  return '#dc2626';
}

function sBadge(status) {
  const map = {
    pending:       '<span class="badge badge-pending">Pending</span>',
    'in-progress': '<span class="badge badge-warning">In Progress</span>',
    submitted:     '<span class="badge badge-info">Submitted</span>',
    approved:      '<span class="badge badge-success">Approved</span>',
    rejected:      '<span class="badge badge-danger">Rejected</span>',
  };
  return map[status] || '<span class="badge">—</span>';
}

function sLabel(s) {
  return { pending:'Pending', 'in-progress':'In Progress', submitted:'Submitted for Review', approved:'Approved by Manager', rejected:'Rejected' }[s] || s;
}

function priorityHtml(p) {
  return { high:'🔴 High', medium:'🟡 Medium', low:'🟢 Low' }[p] || (p || '');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return hrs + 'h ago';
  const d = Math.floor(hrs / 24);
  return d + 'd ago';
}

// Backdrop close
window.addEventListener('click', function (e) {
  if (e.target.classList && e.target.classList.contains('modal')) e.target.classList.remove('open');
});