/**
 * KPI Manager Module
 * Powers manager-kpi.html, kpi-form.html, kpi-verify.html
 */

// ── Data Store ───────────────────────────────────────────────────────────────
function getKpis() {
  return JSON.parse(localStorage.getItem('kpis') || '[]');
}
function saveKpis(kpis) {
  localStorage.setItem('kpis', JSON.stringify(kpis));
}
function getKpiById(id) {
  return getKpis().find(k => k.id === id) || null;
}
function getStaffUsers() {
  const reg = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
  return reg.filter(u => u.role === 'staff');
}

// ── Manager Dashboard ────────────────────────────────────────────────────────
function loadManagerDashboard() {
  const kpis = getKpis();
  const total     = kpis.length;
  const completed = kpis.filter(k => k.status === 'approved').length;
  const pending   = kpis.filter(k => ['pending','in-progress'].includes(k.status)).length;
  const submitted = kpis.filter(k => k.status === 'submitted').length;
  const rate      = total > 0 ? Math.round((completed / total) * 100) : 0;

  setText('statTotal',     total);
  setText('statCompleted', completed);
  setText('statPending',   pending);
  setText('statRate',      rate + '%');

  // Pending verification alert
  if (submitted > 0) {
    const badge = document.getElementById('pendingBadge');
    if (badge) { badge.style.display = 'inline-flex'; badge.textContent = submitted; }
    const alertBtn = document.getElementById('verifyAlertBtn');
    if (alertBtn) {
      alertBtn.style.display = 'inline-flex';
      setText('pendingCount', submitted);
    }
  }

  renderKpiTable();
  renderStaffPerformance();
}

// ── KPI Table ────────────────────────────────────────────────────────────────
function renderKpiTable() {
  const tbody = document.getElementById('kpiTableBody');
  if (!tbody) return;

  const search = (document.getElementById('kpiSearch')?.value || '').toLowerCase();
  const status = document.getElementById('statusFilter')?.value || '';

  let kpis = getKpis();
  if (search)  kpis = kpis.filter(k => k.name.toLowerCase().includes(search) || (k.assignedToName || '').toLowerCase().includes(search));
  if (status)  kpis = kpis.filter(k => k.status === status);

  const empty = document.getElementById('kpiEmptyState');
  if (!kpis.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = kpis.map(k => {
    const overdue = k.dueDate && k.status !== 'approved' && new Date(k.dueDate) < new Date();
    return `<tr>
      <td>
        <div style="font-weight:600;color:var(--navy);">${esc(k.name)}</div>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:2px;">${esc(k.category || '')}${k.priority ? ' · ' + priorityHtml(k.priority) : ''}</div>
      </td>
      <td>
        <div style="font-size:0.85rem;font-weight:500;">${esc(k.target || '—')}</div>
        <div style="font-size:0.72rem;color:var(--muted);">${esc(k.unit || '')}</div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#a5b4fc);display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.7rem;font-weight:700;flex-shrink:0;">${(k.assignedToName || '?').charAt(0).toUpperCase()}</div>
          <span style="font-size:0.85rem;">${esc(k.assignedToName || 'Unassigned')}</span>
        </div>
      </td>
      <td>
        <div style="font-size:0.85rem;">${k.dueDate ? fmtDate(k.dueDate) : '—'}</div>
        ${overdue ? '<div style="font-size:0.7rem;color:#dc2626;font-weight:600;margin-top:2px;">⚠ Overdue</div>' : ''}
      </td>
      <td style="min-width:130px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${k.progress||0}%;background:${pColor(k.progress)};border-radius:3px;transition:width 0.4s;"></div>
          </div>
          <span style="font-size:0.75rem;font-weight:700;min-width:30px;">${k.progress||0}%</span>
        </div>
      </td>
      <td>${sBadge(k.status)}</td>
      <td style="text-align:right;">
        <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;">
          ${k.status === 'submitted' ? `<a href="kpi-verify.html" style="background:#fef3c7;color:#92400e;font-size:0.72rem;padding:5px 10px;border-radius:8px;text-decoration:none;font-weight:700;">Review</a>` : ''}
          <a href="kpi-form.html?id=${k.id}" style="background:var(--bg-secondary);color:var(--navy);font-size:0.72rem;padding:5px 10px;border-radius:8px;text-decoration:none;border:1px solid var(--border);font-weight:600;">Edit</a>
          <button onclick="openDeleteKpi('${k.id}','${esc(k.name)}')" style="background:#fef2f2;color:#dc2626;font-size:0.72rem;padding:5px 10px;border-radius:8px;border:none;cursor:pointer;font-weight:700;">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openDeleteKpi(id, name) {
  document.getElementById('deleteKpiName').textContent = name;
  document.getElementById('confirmDeleteKpiBtn').onclick = function () {
    saveKpis(getKpis().filter(k => k.id !== id));
    closeModal('deleteModal');
    loadManagerDashboard();
    flashAlert('KPI "' + name + '" deleted.');
  };
  document.getElementById('deleteModal').classList.add('open');
}

// ── Staff Performance Summary ─────────────────────────────────────────────────
function renderStaffPerformance() {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;

  const kpis = getKpis();
  const map  = {};

  kpis.forEach(k => {
    if (!k.assignedTo) return;
    if (!map[k.assignedTo]) {
      map[k.assignedTo] = { name: k.assignedToName || 'Unknown', dept: k.assignedToDept || 'General', total: 0, completed: 0 };
    }
    map[k.assignedTo].total++;
    if (k.status === 'approved') map[k.assignedTo].completed++;
  });

  const staff = Object.values(map);
  const emptyEl = document.getElementById('staffEmptyState');

  if (!staff.length) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = staff.map(s => {
    const rate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    const perf = rate >= 80 ? '<span class="badge badge-success">On Track</span>'
               : rate >= 40 ? '<span class="badge badge-warning">Needs Attention</span>'
               :              '<span class="badge badge-danger">At Risk</span>';
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#a5b4fc);display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.8rem;font-weight:700;flex-shrink:0;">${s.name.charAt(0).toUpperCase()}</div>
          <span style="font-weight:600;">${esc(s.name)}</span>
        </div>
      </td>
      <td style="color:var(--muted);font-size:0.85rem;">${esc(s.dept)}</td>
      <td style="font-weight:700;">${s.total}</td>
      <td style="font-weight:700;color:var(--success);">${s.completed}</td>
      <td style="min-width:140px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${rate}%;background:${pColor(rate)};border-radius:4px;transition:width 0.5s;"></div>
          </div>
          <span style="font-size:0.8rem;font-weight:700;">${rate}%</span>
        </div>
      </td>
      <td>${perf}</td>
    </tr>`;
  }).join('');
}

// ── KPI Form ─────────────────────────────────────────────────────────────────
function initKpiForm() {
  // Populate staff dropdown
  const sel = document.getElementById('kpiAssignedTo');
  if (sel) {
    const staff = getStaffUsers();
    if (!staff.length) {
      sel.innerHTML = '<option value="">No staff accounts yet — register a staff user first</option>';
    } else {
      sel.innerHTML = '<option value="">Select staff member</option>' +
        staff.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.email)})</option>`).join('');
    }
  }

  // Check for edit mode via URL param
  const params  = new URLSearchParams(window.location.search);
  const editId  = params.get('id');
  if (editId) {
    const kpi = getKpiById(editId);
    if (kpi) {
      setText('formPageTitle', 'Edit KPI');
      setVal('kpiId',         kpi.id);
      setVal('kpiName',       kpi.name || '');
      setVal('kpiCategory',   kpi.category || '');
      setVal('kpiDescription',kpi.description || '');
      setVal('kpiTarget',     kpi.target || '');
      setVal('kpiUnit',       kpi.unit || '');
      setVal('kpiDueDate',    kpi.dueDate || '');
      setVal('kpiPriority',   kpi.priority || '');
      setVal('kpiStatus',     kpi.status || 'pending');
      if (sel) sel.value = kpi.assignedTo || '';

      const btn = document.getElementById('submitKpiBtn');
      if (btn) btn.innerHTML = `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;stroke-width:2.5;fill:none;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg> Update KPI`;

      const badge = document.getElementById('kpiStatusBadge');
      if (badge) { badge.style.display = 'inline-flex'; badge.textContent = 'Editing'; }
    }
  }
}

function saveKpiForm() {
  clearFieldErrors();

  const name       = document.getElementById('kpiName')?.value.trim()       || '';
  const category   = document.getElementById('kpiCategory')?.value          || '';
  const description= document.getElementById('kpiDescription')?.value.trim()|| '';
  const target     = document.getElementById('kpiTarget')?.value.trim()      || '';
  const unit       = document.getElementById('kpiUnit')?.value.trim()        || '';
  const dueDate    = document.getElementById('kpiDueDate')?.value            || '';
  const priority   = document.getElementById('kpiPriority')?.value           || '';
  const assignedTo = document.getElementById('kpiAssignedTo')?.value         || '';
  const status     = document.getElementById('kpiStatus')?.value             || 'pending';

  let valid = true;
  if (!name)       { fieldErr('kpiNameError',       'KPI name is required.');              valid = false; }
  if (!category)   { fieldErr('kpiCategoryError',   'Category is required.');              valid = false; }
  if (!target)     { fieldErr('kpiTargetError',     'Target value is required.');          valid = false; }
  if (!unit)       { fieldErr('kpiUnitError',       'Unit / measure is required.');        valid = false; }
  if (!dueDate)    { fieldErr('kpiDueDateError',    'Due date is required.');              valid = false; }
  if (!priority)   { fieldErr('kpiPriorityError',   'Priority is required.');              valid = false; }
  if (!assignedTo) { fieldErr('kpiAssignedToError', 'Please assign this KPI to someone.'); valid = false; }

  if (!valid) {
    show('errorAlert');
    return;
  }
  hide('errorAlert');

  // Resolve staff name and department
  const staffSel = document.getElementById('kpiAssignedTo');
  const staffOpt = staffSel?.options[staffSel?.selectedIndex];
  const assignedToName = staffOpt ? staffOpt.text.split(' (')[0] : '';
  const staffRec = getStaffUsers().find(s => s.id === assignedTo);
  const assignedToDept = staffRec?.department || 'General';

  const kpis  = getKpis();
  const editId = document.getElementById('kpiId')?.value || '';
  const now    = new Date().toISOString();

  if (editId) {
    const idx = kpis.findIndex(k => k.id === editId);
    if (idx !== -1) {
      kpis[idx] = { ...kpis[idx], name, category, description, target, unit, dueDate, priority, assignedTo, assignedToName, assignedToDept, status, updatedAt: now };
      saveKpis(kpis);
    }
  } else {
    kpis.push({
      id: 'kpi_' + Math.random().toString(36).substr(2, 9),
      name, category, description, target, unit, dueDate, priority,
      assignedTo, assignedToName, assignedToDept, status,
      progress: 0, currentValue: '', comments: '',
      evidenceName: null, evidenceData: null,
      rejectionReason: '', submittedAt: null,
      createdAt: now, updatedAt: now,
    });
    saveKpis(kpis);
  }

  show('successAlert');
  setText('successMsg', editId ? 'KPI updated successfully!' : 'KPI created and assigned successfully!');
  setTimeout(() => { window.location.href = 'manager-kpi.html'; }, 1400);
}

// ── Verification Page ─────────────────────────────────────────────────────────
function renderVerifyList() {
  const container = document.getElementById('verifyList');
  const emptyEl   = document.getElementById('verifyEmpty');
  if (!container) return;

  let kpis = getKpis();
  const f = typeof currentVerifyFilter !== 'undefined' ? currentVerifyFilter : 'all';
  if (f && f !== 'all') kpis = kpis.filter(k => k.status === f);

  if (!kpis.length) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  container.innerHTML = kpis.map(k => {
    const overdue = k.dueDate && k.status !== 'approved' && new Date(k.dueDate) < new Date();
    return `
    <div class="verify-card fade-in-up">
      <div class="verify-card-header">
        <div>
          <div style="font-family:'Sora',sans-serif;font-weight:700;font-size:1rem;color:var(--navy);">${esc(k.name)}</div>
          <div style="font-size:0.8rem;color:var(--muted);margin-top:3px;">${esc(k.category||'')}${k.priority ? ' · ' + priorityHtml(k.priority) : ''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${overdue ? '<span style="font-size:0.72rem;color:#dc2626;font-weight:700;background:#fef2f2;padding:3px 8px;border-radius:20px;">Overdue</span>' : ''}
          ${sBadge(k.status)}
        </div>
      </div>
      <div class="verify-card-meta">
        <span>👤 <strong>${esc(k.assignedToName||'Unassigned')}</strong></span>
        <span>🎯 Target: <strong>${esc(k.target||'—')} ${esc(k.unit||'')}</strong></span>
        <span>📅 Due: <strong>${k.dueDate ? fmtDate(k.dueDate) : '—'}</strong></span>
        ${k.submittedAt ? `<span>📤 Submitted: <strong>${fmtDate(k.submittedAt)}</strong></span>` : ''}
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:0.8rem;color:var(--muted);min-width:68px;">Progress:</span>
        <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${k.progress||0}%;background:${pColor(k.progress)};border-radius:4px;transition:width 0.4s;"></div>
        </div>
        <span style="font-size:0.8rem;font-weight:700;min-width:34px;">${k.progress||0}%</span>
      </div>

      ${k.comments ? `<div style="background:var(--bg-secondary);border-radius:10px;padding:12px;margin-bottom:14px;font-size:0.85rem;"><strong style="color:var(--navy);">Staff notes:</strong> ${esc(k.comments)}</div>` : ''}
      ${k.rejectionReason && k.status === 'rejected' ? `<div style="background:#fef2f2;border-radius:10px;padding:12px;margin-bottom:14px;font-size:0.85rem;color:#991b1b;"><strong>Rejection reason:</strong> ${esc(k.rejectionReason)}</div>` : ''}

      <div class="verify-actions">
        ${k.evidenceName ? `<button onclick="previewEvidence('${k.id}')" style="background:var(--bg-secondary);border:1px solid var(--border);color:var(--navy);font-size:0.8rem;padding:7px 14px;border-radius:8px;cursor:pointer;font-weight:600;">📎 ${esc(k.evidenceName)}</button>` : '<span style="font-size:0.8rem;color:var(--muted);padding:7px 0;">No evidence uploaded</span>'}
        ${k.status === 'submitted' ? `
          <button onclick="openApprove('${k.id}','${esc(k.name)}')" style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;font-weight:700;font-size:0.82rem;padding:7px 16px;border-radius:8px;cursor:pointer;">✓ Approve</button>
          <button onclick="openReject('${k.id}','${esc(k.name)}')"  style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;font-weight:700;font-size:0.82rem;padding:7px 16px;border-radius:8px;cursor:pointer;">✕ Reject</button>
        ` : ''}
        ${k.status === 'approved' ? '<span style="font-size:0.85rem;font-weight:700;color:var(--success);padding:7px 0;">✓ Approved</span>' : ''}
        ${k.status === 'rejected' ? '<span style="font-size:0.85rem;font-weight:700;color:var(--danger);padding:7px 0;">✕ Rejected — awaiting resubmission</span>' : ''}
      </div>
    </div>`;
  }).join('');
}

function openApprove(id, name) {
  document.getElementById('approveKpiName').textContent = name;
  document.getElementById('confirmApproveBtn').onclick = function () {
    const kpis = getKpis();
    const idx  = kpis.findIndex(k => k.id === id);
    if (idx !== -1) {
      kpis[idx].status    = 'approved';
      kpis[idx].progress  = 100;
      kpis[idx].updatedAt = new Date().toISOString();
      saveKpis(kpis);
    }
    closeModal('approveModal');
    flashAlert('KPI "' + name + '" approved! ✓');
    renderVerifyList();
  };
  document.getElementById('approveModal').classList.add('open');
}

function openReject(id, name) {
  document.getElementById('rejectKpiName').textContent = name;
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectReasonError').textContent = '';
  document.getElementById('confirmRejectBtn').onclick = function () {
    const reason = document.getElementById('rejectReason').value.trim();
    if (!reason) { document.getElementById('rejectReasonError').textContent = 'Rejection reason is required.'; return; }
    const kpis = getKpis();
    const idx  = kpis.findIndex(k => k.id === id);
    if (idx !== -1) {
      kpis[idx].status          = 'rejected';
      kpis[idx].rejectionReason = reason;
      kpis[idx].updatedAt       = new Date().toISOString();
      saveKpis(kpis);
    }
    closeModal('rejectModal');
    flashAlert('KPI "' + name + '" rejected.', 'error');
    renderVerifyList();
  };
  document.getElementById('rejectModal').classList.add('open');
}

function previewEvidence(id) {
  const kpi     = getKpiById(id);
  const content = document.getElementById('evidencePreviewContent');
  if (!kpi || !content) return;

  if (kpi.evidenceData && kpi.evidenceData.startsWith('data:image')) {
    content.innerHTML = `<img src="${kpi.evidenceData}" alt="Evidence" style="max-width:100%;border-radius:8px;display:block;">`;
  } else {
    content.innerHTML = `
      <div style="text-align:center;padding:24px;">
        <svg viewBox="0 0 24 24" style="width:52px;height:52px;margin:0 auto 12px;display:block;stroke:var(--primary);stroke-width:1.5;fill:none;stroke-linecap:round;stroke-linejoin:round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p style="font-weight:700;color:var(--navy);margin:0 0 4px;">${esc(kpi.evidenceName || 'evidence file')}</p>
        <p style="color:var(--muted);font-size:0.85rem;margin:0;">Evidence file attached by ${esc(kpi.assignedToName || 'staff member')}.</p>
      </div>`;
  }
  document.getElementById('evidenceModal').classList.add('open');
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function closeModal(id)        { document.getElementById(id)?.classList.remove('open'); }
function show(id)              { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function hide(id)              { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function setText(id, val)      { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val)       { const el = document.getElementById(id); if (el) el.value = val; }
function fieldErr(id, msg)     { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearFieldErrors()    { document.querySelectorAll('.form-hint.error').forEach(el => el.textContent = ''); hide('errorAlert'); }

function flashAlert(msg, type = 'success') {
  const el = document.getElementById('successAlert');
  if (!el) return;
  const msgEl = document.getElementById('successMsg');
  if (msgEl) msgEl.textContent = msg;
  el.style.display = 'flex';
  setTimeout(() => el.style.display = 'none', 3000);
}

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

function priorityHtml(p) {
  return { high:'🔴 High', medium:'🟡 Medium', low:'🟢 Low' }[p] || (p || '—');
}

// Close modals on backdrop click
window.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal')) e.target.classList.remove('open');
});