/**
 * KPI Staff Module
 * Powers dashboard.html, staff-kpi.html, kpi-progress.html.
 * Uses the Express + MongoDB backend only.
 */

const KPI_API_BASE = 'http://localhost:3000/api';
const ALLOWED_EVIDENCE_TYPES = [
  '',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];
const MAX_EVIDENCE_SIZE = 5 * 1024 * 1024;

async function apiJson(url, options = {}) {
  const response = await authenticatedFetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed with status ${response.status}`);
  return data;
}

function normalizeKpiRecord(record) {
  const assigned = record.assignedTo && typeof record.assignedTo === 'object' ? record.assignedTo : null;
  return {
    ...record,
    id: record._id || record.id,
    assignedTo: assigned?._id || assigned?.id || record.assignedTo,
    assignedToName: record.assignedToName || assigned?.name || '',
    assignedToDept: record.assignedToDept || assigned?.department || '',
  };
}

// ── Data Store ───────────────────────────────────────────────────────────────
const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
const EVIDENCE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const EVIDENCE_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'];

function getCurrentStaffKpiKeys() {
  const user = getCurrentUser();
  if (!user) return { user: null, keys: [] };

  const keys = [user.id, user.uid, user.email]
    .filter(Boolean)
    .map(v => String(v).trim())
    .filter(Boolean);

  return { user, keys: [...new Set(keys)] };
}

function isAssignedToCurrentStaff(kpi) {
  const { keys } = getCurrentStaffKpiKeys();
  return keys.includes(String(kpi?.assignedTo || '').trim());
}

async function getKpis() {
  const result = await apiJson(`${KPI_API_BASE}/kpis`);
  return (result.data || []).map(normalizeKpiRecord);
}

async function getMyKpis() {
  // In the new API-driven model, getKpis for a staff member will already be scoped.
  return getKpis();
}

async function getStaffKpiById(id) {
  if (!id) return null;
  const result = await apiJson(`${KPI_API_BASE}/kpis/${id}`);
  const kpi = normalizeKpiRecord(result.data);

  // The API should enforce this, but a client-side check is good practice.
  if (!isAssignedToCurrentStaff(kpi)) {
    throw new Error('You are not allowed to view or update this KPI.');
  }
  return kpi;
}

async function updateKpi(id, updates) {
  // The backend handles merging and timestamps.
  await apiJson(`${KPI_API_BASE}/kpis/${id}/submit`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

function getStaffStatusForProgress(progress) {
  const pct = Math.min(Math.max(parseInt(progress, 10) || 0, 0), 100);
  if (pct === 0) return 'pending';
  if (pct === 100) return 'submitted';
  return 'in-progress';
}

function getReviewFeedback(kpi) {
  return kpi?.rejectionReason || kpi?.reviewComment || '';
}

function rejectedFeedbackHtml(kpi) {
  const feedback = getReviewFeedback(kpi);
  if (kpi?.status !== 'rejected' || !feedback) return '';

  return `<div style="background:#fef2f2;border-radius:8px;padding:10px;margin-top:10px;font-size:0.8rem;color:#991b1b;border:1px solid #fecaca;"><strong>Manager feedback:</strong> ${esc(feedback)}</div>`;
}

function validateEvidenceFile(file) {
  if (!file) return { valid: true };

  const lowerName = String(file.name || '').toLowerCase();
  const hasAllowedExtension = EVIDENCE_ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
  const hasAllowedType = EVIDENCE_ALLOWED_TYPES.includes(file.type);

  if (!hasAllowedExtension || (file.type && !hasAllowedType)) {
    return {
      valid: false,
      message: 'Invalid file type. Please upload JPG, PNG, PDF, DOC, or DOCX.',
    };
  }

  if (file.size > EVIDENCE_MAX_BYTES) {
    return {
      valid: false,
      message: 'File size must not exceed 10MB.',
    };
  }

  return { valid: true };
}

function setEvidenceError(message) {
  const el = document.getElementById('evidenceError');
  if (el) el.textContent = message || '';

  const alert = document.getElementById('errorAlert');
  const msg = document.getElementById('errorMsg');
  if (message && alert && msg) {
    msg.textContent = message;
    alert.style.display = 'flex';
  }
}

function addEvidenceToPayload(file, payload, uploadedAt) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(payload);
      return;
    }

    payload.evidenceName = file.name;
    payload.evidenceFileType = file.type || '';
    payload.evidenceFileSize = file.size;
    payload.evidenceUploadedAt = uploadedAt;

    // Demo-level evidence storage: keep using Base64 to match the existing project style.
    const reader = new FileReader();
    reader.onload = e => {
      payload.evidenceData = e.target.result;
      resolve(payload);
    };
    reader.onerror = () => reject(new Error('Could not read the evidence file.'));
    reader.readAsDataURL(file);
  });
}

function showStaffUpdateError(message) {
  setEvidenceError(message);
  const alert = document.getElementById('errorAlert');
  const msg = document.getElementById('errorMsg');
  if (alert && msg) {
    msg.textContent = message;
    alert.style.display = 'flex';
  } else {
    window.alert(message);
  }
}

// ── Staff Dashboard ──────────────────────────────────────────────────────────
async function loadStaffDashboard() {
  const kpis = await getMyKpis();
  const assigned = kpis.length;
  const completed = kpis.filter(k => k.status === 'approved').length;
  const pending = kpis.filter(k => ['pending', 'in-progress'].includes(k.status)).length;
  const avgProg = assigned > 0
    ? Math.round(kpis.reduce((sum, k) => sum + (k.progress || 0), 0) / assigned)
    : 0;

  setText('statAssigned', assigned);
  setText('statCompleted', completed);
  setText('statPending', pending);
  setText('statProgress', avgProg + '%');

  const ring = document.getElementById('progressRing');
  if (ring) {
    const c = 2 * Math.PI * 50;
    ring.setAttribute('stroke-dasharray', c);
    setTimeout(() => {
      ring.setAttribute('stroke-dashoffset', c - (c * avgProg / 100));
    }, 200);
  }
  setText('progressRingText', avgProg + '%');

  await renderMyKpiTable(kpis);
  renderActivity(kpis);
}

// ── My KPI Table (dashboard overview) ───────────────────────────────────────
async function renderMyKpiTable(kpis) {
  const tbody = document.getElementById('myKpiTableBody');
  if (!tbody) return;

  let data = kpis || await getMyKpis();
  const search = (document.getElementById('dashSearch')?.value || '').toLowerCase();
  const statusF = document.getElementById('dashStatusFilter')?.value || '';

  if (search) data = data.filter(k => (k.name || '').toLowerCase().includes(search) || (k.category || '').toLowerCase().includes(search));
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
        <div style="font-size:0.72rem;color:var(--muted);margin-top:2px;">${esc(k.category || '')}${overdue ? ' · <span style="color:#dc2626;font-weight:700;">Overdue</span>' : ''}</div>
      </td>
      <td style="font-size:0.85rem;">${esc(k.target || '—')} <span style="color:var(--muted);font-size:0.72rem;">${esc(k.unit || '')}</span></td>
      <td style="min-width:120px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:5px;background:var(--border);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${k.progress || 0}%;background:${pColor(k.progress)};border-radius:3px;"></div>
          </div>
          <span style="font-size:0.72rem;font-weight:700;">${k.progress || 0}%</span>
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

// ── Recent Activity Feed ─────────────────────────────────────────────────────
function renderActivity(kpis) {
  const list = document.getElementById('activityList');
  if (!list) return;

  const sorted = [...(kpis || [])]
    .filter(k => k.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 6);

  if (!sorted.length) return;

  const dotMap = { approved: 'success', rejected: 'danger', submitted: 'primary', 'in-progress': 'warning', pending: 'primary' };

  list.innerHTML = sorted.map(k => `
    <div class="activity-item">
      <div class="activity-dot ${dotMap[k.status] || 'primary'}"></div>
      <div>
        <div class="activity-text" style="font-weight:500;">${esc(k.name)}</div>
        <div class="activity-time">${sLabel(k.status)} · ${k.updatedAt ? timeAgo(k.updatedAt) : ''}</div>
        ${k.status === 'rejected' && getReviewFeedback(k) ? `<div style="font-size:0.75rem;color:#991b1b;margin-top:4px;">Manager feedback: ${esc(getReviewFeedback(k))}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ── Staff KPI Cards (staff-kpi.html) ────────────────────────────────────────
async function renderStaffKpis() {
  const grid = document.getElementById('kpiCardGrid');
  const empty = document.getElementById('kpiEmptyState');
  if (!grid) return;

  let kpis = await getMyKpis();

  const search = (document.getElementById('searchKpi')?.value || '').toLowerCase();
  const filter = (typeof activeFilter !== 'undefined') ? activeFilter : '';

  if (search) kpis = kpis.filter(k => (k.name || '').toLowerCase().includes(search) || (k.category || '').toLowerCase().includes(search));
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
          <div class="kpi-item-card-meta">${esc(k.category || 'General')}${k.priority ? ' · ' + priorityHtml(k.priority) : ''}</div>
        </div>
        ${sBadge(k.status)}
      </div>
      <div class="kpi-item-card-body">
        <div class="kpi-progress-section">
          <div class="kpi-progress-row">
            <span>Target</span>
            <span>${esc(k.target || '—')} ${esc(k.unit || '')}</span>
          </div>
          ${k.currentValue ? `<div class="kpi-progress-row"><span>Current</span><span>${esc(k.currentValue)}</span></div>` : ''}
          <div class="kpi-progress-row">
            <span>Progress</span>
            <span style="color:${pColor(k.progress)};font-weight:700;">${k.progress || 0}%</span>
          </div>
        </div>

        <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:12px;">
          <div style="height:100%;width:${k.progress || 0}%;background:${pColor(k.progress)};border-radius:4px;transition:width 0.5s;"></div>
        </div>

        <div class="kpi-card-footer-meta">
          <span>📅 ${k.dueDate ? fmtDate(k.dueDate) : 'No deadline'}${overdue ? ' <span style="color:#dc2626;font-weight:700;">(Overdue)</span>' : ''}</span>
          ${k.updatedAt ? `<span title="${new Date(k.updatedAt).toLocaleString()}">🔄 ${timeAgo(k.updatedAt)}</span>` : ''}
        </div>

        ${rejectedFeedbackHtml(k)}

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

// ── Update Progress Modal (staff-kpi.html) ──────────────────────────────────
async function openKpiUpdateModal(id) {
  let kpi;
  try {
    kpi = await getStaffKpiById(id);
  } catch (err) {
    showStaffUpdateError(err.message || 'You are not allowed to update this KPI.');
    return;
  }
  if (!kpi) return;
  if (kpi.status === 'approved') {
    showStaffUpdateError('Approved KPIs cannot be updated.');
    return;
  }

  setVal('updateKpiId', id);
  setText('updateKpiNameDisplay', kpi.name);
  setText('updateKpiTarget', 'Target: ' + (kpi.target || '—') + (kpi.unit ? ' ' + kpi.unit : ''));

  const val = kpi.progress || 0;
  const slider = document.getElementById('progressSlider');
  const input = document.getElementById('progressInput');
  if (slider) slider.value = val;
  if (input) input.value = val;

  setVal('progressComment', kpi.comments || '');
  const fileSelected = document.getElementById('fileSelected');
  const fileInput = document.getElementById('evidenceFile');
  setEvidenceError('');
  if (fileSelected) fileSelected.style.display = 'none';
  if (fileInput) fileInput.value = '';

  document.getElementById('updateProgressModal').classList.add('open');
}

async function submitProgress() {
  const id = document.getElementById('updateKpiId')?.value || '';
  const progress = parseInt(document.getElementById('progressInput')?.value) || 0;
  const comment = document.getElementById('progressComment')?.value.trim() || '';
  const fileInput = document.getElementById('evidenceFile');
  const file = fileInput?.files?.[0] || null;

  if (!id) return;
  setEvidenceError('');

  const evidenceCheck = validateEvidenceFile(file);
  if (!evidenceCheck.valid) {
    setEvidenceError(evidenceCheck.message);
    return;
  }

  const now = new Date().toISOString();
  const status = getStaffStatusForProgress(progress);
  const payload = {
    progress,
    comments: comment,
    status,
    submittedAt: status === 'submitted' ? now : null,
    updatedAt: now,
  };

  try {
    await addEvidenceToPayload(file, payload, now);
    await updateKpi(id, payload);
    closeModal('updateProgressModal');
    await renderStaffKpis();
    if (typeof loadStaffDashboard === 'function') await loadStaffDashboard();
  } catch (err) {
    showStaffUpdateError(err.message || 'Could not submit progress. Please try again.');
  }
}

// ── Progress Page (kpi-progress.html) ───────────────────────────────────────
async function initProgressPage() {
  const sel = document.getElementById('kpiSelect');
  if (!sel) return;

  const kpis = (await getMyKpis()).filter(k => k.status !== 'approved');
  sel.innerHTML = '<option value="">— Choose a KPI —</option>' +
    kpis.map(k => `<option value="${k.id}">${esc(k.name)} (${k.progress || 0}% complete)</option>`).join('');

  const urlId = new URLSearchParams(window.location.search).get('id');
  if (urlId && kpis.find(k => k.id === urlId)) {
    sel.value = urlId;
    await onKpiSelect();
  }
}

async function onKpiSelect() {
  const id = document.getElementById('kpiSelect')?.value || '';
  const infoCard = document.getElementById('kpiInfoCard');
  if (!id) {
    if (infoCard) infoCard.style.display = 'none';
    return;
  }

  let kpi;
  try {
    kpi = await getStaffKpiById(id);
  } catch (err) {
    showStaffUpdateError(err.message || 'You are not allowed to update this KPI.');
    if (infoCard) infoCard.style.display = 'none';
    return;
  }
  if (!kpi) return;

  if (infoCard) infoCard.style.display = 'block';

  const pct = kpi.progress || 0;
  setText('infoKpiName', kpi.name || '—');
  setText('infoTarget', (kpi.target || '—') + (kpi.unit ? ' ' + kpi.unit : ''));
  setText('infoDue', kpi.dueDate ? fmtDate(kpi.dueDate) : '—');
  setText('infoCat', kpi.category || '—');
  const statusEl = document.getElementById('infoStatus');
  if (statusEl) {
    statusEl.innerHTML = sBadge(kpi.status) +
      (kpi.status === 'rejected' && getReviewFeedback(kpi)
        ? `<div style="font-size:0.78rem;color:#991b1b;margin-top:6px;"><strong>Manager feedback:</strong> ${esc(getReviewFeedback(kpi))}</div>`
        : '');
  }

  const c = 2 * Math.PI * 56;
  const ring = document.getElementById('kpiInfoRing');
  if (ring) {
    ring.setAttribute('stroke-dasharray', c);
    setTimeout(() => ring.setAttribute('stroke-dashoffset', c - (c * pct / 100)), 100);
  }
  setText('ringPct', pct + '%');

  const slider = document.getElementById('progressSlider');
  const input = document.getElementById('progressInput');
  const bar = document.getElementById('progressBar');
  if (slider) slider.value = pct;
  if (input) input.value = pct;
  if (bar) bar.style.width = pct + '%';

  setVal('currentValue', kpi.currentValue || '');
  setVal('progressNotes', kpi.comments || '');
}

async function submitProgressPage() {
  const id = document.getElementById('kpiSelect')?.value || '';
  const progress = parseInt(document.getElementById('progressInput')?.value) || 0;
  const notes = document.getElementById('progressNotes')?.value.trim() || '';
  const currentVal = document.getElementById('currentValue')?.value.trim() || '';
  const fileInput = document.getElementById('evidenceFile');
  const file = fileInput?.files?.[0] || null;

  const kpiSelErr = document.getElementById('kpiSelectError');
  const progErr = document.getElementById('progressError');
  const evidErr = document.getElementById('evidenceError');
  const errAlert = document.getElementById('errorAlert');
  if (kpiSelErr) kpiSelErr.textContent = '';
  if (progErr) progErr.textContent = '';
  if (evidErr) evidErr.textContent = '';
  if (errAlert) errAlert.style.display = 'none';

  let valid = true;
  if (!id) { if (kpiSelErr) kpiSelErr.textContent = 'Please select a KPI.'; valid = false; }
  if (progress < 0 || progress > 100) { if (progErr) progErr.textContent = 'Progress must be between 0 and 100%.'; valid = false; }
  
  const evidenceCheck = validateEvidenceFile(file);
  if (!evidenceCheck.valid) {
    if (evidErr) evidErr.textContent = evidenceCheck.message;
    valid = false;
  }

  if (currentVal && (!Number.isFinite(Number(currentVal)) || Number(currentVal) < 0)) {
    if (progErr) progErr.textContent = 'Current achievement value must be a valid number.';
    valid = false;
  }

  if (!valid) {
    if (errAlert) {
      errAlert.style.display = 'flex';
      setText('errorMsg', evidenceCheck.valid ? 'Please fix the errors above.' : evidenceCheck.message);
    }
    return;
  }

  const now = new Date().toISOString();
  const status = getStaffStatusForProgress(progress);
  const payload = {
    progress,
    comments: notes,
    status,
    submittedAt: status === 'submitted' ? now : null,
    updatedAt: now,
  };
  if (currentVal) payload.currentValue = Number(currentVal);

  const finish = async () => {
    try {
      if (file) {
        await addEvidenceToPayload(file, payload, now);
      }
      await updateKpi(id, payload);
    } catch (err) {
      showStaffUpdateError(err.message || 'Could not submit progress. Please try again.');
      return;
    }

    const sa = document.getElementById('successAlert');
    if (sa) {
      sa.style.display = 'flex';
      setText('successMsg', status === 'submitted'
        ? 'Progress submitted! Your manager will review it soon.'
        : 'Progress saved successfully.');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.getElementById('progressForm')?.reset();
    const ic = document.getElementById('kpiInfoCard');
    if (ic) ic.style.display = 'none';
    const pb = document.getElementById('progressBar');
    if (pb) pb.style.width = '0%';
    const fp = document.getElementById('filePreview');
    if (fp) fp.style.display = 'none';

    setTimeout(() => { initProgressPage(); }, 120);
  };

  await finish();

// ── Utilities ────────────────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

function pColor(pct) {
  pct = pct || 0;
  if (pct >= 80) return '#16a34a';
  if (pct >= 50) return '#d97706';
  return '#dc2626';
}

function isValidEvidenceFile(file) {
  if (!file) return true;
  return ALLOWED_EVIDENCE_TYPES.includes(file.type || '') && file.size <= MAX_EVIDENCE_SIZE;
}

function sBadge(status) {
  const map = {
    pending: '<span class="badge badge-pending">Pending</span>',
    'in-progress': '<span class="badge badge-warning">In Progress</span>',
    submitted: '<span class="badge badge-info">Submitted</span>',
    approved: '<span class="badge badge-success">Approved</span>',
    rejected: '<span class="badge badge-danger">Rejected</span>',
  };
  return map[status] || '<span class="badge">—</span>';
}

function sLabel(s) {
  return { pending: 'Pending', 'in-progress': 'In Progress', submitted: 'Submitted for Review', approved: 'Approved by Manager', rejected: 'Rejected' }[s] || s;
}

function priorityHtml(p) {
  return { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' }[p] || (p || '');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const d = Math.floor(hrs / 24);
  return d + 'd ago';
}

window.addEventListener('click', function (e) {
  if (e.target.classList && e.target.classList.contains('modal')) e.target.classList.remove('open');
});
