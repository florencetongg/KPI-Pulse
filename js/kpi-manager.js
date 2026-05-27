/**
 * KPI Manager Module
 * Powers manager-kpi.html, kpi-form.html, kpi-verify.html.
 * Uses the Express + MongoDB backend only.
 */

const KPI_API_BASE = 'http://localhost:3000/api';

async function apiJson(url, options = {}) {
  const response = await authenticatedFetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed with status ${response.status}`);
  return data;
}

let lastKpiSource = 'remote';

function normalizeMaybeTimestamp(value) {
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return value;
}

function normalizeKpiRecord(record) {
  const assigned = record.assignedTo && typeof record.assignedTo === 'object' ? record.assignedTo : null;
  const createdBy = record.createdBy && typeof record.createdBy === 'object' ? record.createdBy : null;

  return {
    ...record,
    id: record._id || record.id,
    assignedTo: assigned?._id || assigned?.id || record.assignedTo,
    assignedToName: record.assignedToName || assigned?.name || '',
    assignedToDept: record.assignedToDept || assigned?.department || '',
    createdBy: createdBy?._id || createdBy?.id || record.createdBy,
    createdAt: normalizeMaybeTimestamp(record.createdAt),
    updatedAt: normalizeMaybeTimestamp(record.updatedAt),
    submittedAt: normalizeMaybeTimestamp(record.submittedAt),
  };
}

// ── Data Store ───────────────────────────────────────────────────────────────
async function getKpis() {
  const result = await apiJson(`${KPI_API_BASE}/kpis`);
  const kpis = (result.data || []).map(normalizeKpiRecord);
  lastKpiSource = 'remote';
  return kpis;
}

async function getKpiById(id) {
  if (!id) return null;
  const kpis = await getKpis();
  return kpis.find(kpi => kpi.id === id) || null;
}

async function saveKpi(kpi) {
  const payload = { ...kpi };

  if (kpi.id) {
    const id = kpi.id;
    delete payload.id;
    await apiJson(`${KPI_API_BASE}/kpis/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return id;
  }

  const result = await apiJson(`${KPI_API_BASE}/kpis`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return result.data?._id || result.data?.id;
}

async function deleteKpi(id) {
  if (!id) return;
  await apiJson(`${KPI_API_BASE}/kpis/${id}`, { method: 'DELETE' });
}

async function getStaffUsers() {
  const result = await apiJson(`${KPI_API_BASE}/auth/staff`);
  return (result.data || []).map(user => ({ id: user._id || user.id, ...user }));
}

// ── Manager Dashboard ────────────────────────────────────────────────────────
async function loadManagerDashboard() {
  try {
    const kpis = await getKpis();
    const total = kpis.length;
    const completed = kpis.filter(k => k.status === 'approved').length;
    const pending = kpis.filter(k => ['pending', 'in-progress'].includes(k.status)).length;
    const submitted = kpis.filter(k => k.status === 'submitted').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    setText('statTotal', total);
    setText('statCompleted', completed);
    setText('statPending', pending);
    setText('statRate', rate + '%');

    const badge = document.getElementById('pendingBadge');
    if (badge) {
      if (submitted > 0) {
        badge.style.display = 'inline-flex';
        badge.textContent = submitted;
      } else {
        badge.style.display = 'none';
      }
    }

    const alertBtn = document.getElementById('verifyAlertBtn');
    if (alertBtn) {
      if (submitted > 0) {
        alertBtn.style.display = 'inline-flex';
        setText('pendingCount', submitted);
      } else {
        alertBtn.style.display = 'none';
      }
    }

    await renderKpiTable();
    await renderStaffPerformance();
    await renderKpiHistory(kpis);
    setConnectionStatus(true);
  } catch (error) {
    console.error('Failed to load manager dashboard:', error);
    setConnectionStatus(false);
    flashAlert('Unable to fetch KPI data from the backend right now.', 'error');
  }
}

// ── KPI Table ────────────────────────────────────────────────────────────────
async function renderKpiTable() {
  const tbody = document.getElementById('kpiTableBody');
  if (!tbody) return;

  const search = (document.getElementById('kpiSearch')?.value || '').toLowerCase();
  const status = document.getElementById('statusFilter')?.value || '';

  let kpis = await getKpis();
  if (search) {
    kpis = kpis.filter(k =>
      (k.name || '').toLowerCase().includes(search) ||
      (k.assignedToName || '').toLowerCase().includes(search)
    );
  }
  if (status) {
    kpis = kpis.filter(k => k.status === status);
  }

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
            <div style="height:100%;width:${k.progress || 0}%;background:${pColor(k.progress)};border-radius:3px;transition:width 0.4s;"></div>
          </div>
          <span style="font-size:0.75rem;font-weight:700;min-width:30px;">${k.progress || 0}%</span>
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
  document.getElementById('confirmDeleteKpiBtn').onclick = async function () {
    await deleteKpi(id);
    closeModal('deleteModal');
    await loadManagerDashboard();
    flashAlert('KPI "' + name + '" deleted.');
  };
  document.getElementById('deleteModal').classList.add('open');
}

// ── Staff Performance Summary ────────────────────────────────────────────────
async function renderStaffPerformance() {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;

  const kpis = await getKpis();
  const map = {};

  kpis.forEach(k => {
    if (!k.assignedTo) return;
    if (!map[k.assignedTo]) {
      map[k.assignedTo] = {
        name: k.assignedToName || 'Unknown',
        dept: k.assignedToDept || 'General',
        total: 0,
        completed: 0,
      };
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
      : '<span class="badge badge-danger">At Risk</span>';

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

// ── KPI History ───────────────────────────────────────────────────────────────
async function renderKpiHistory(kpisArg) {
  const list = document.getElementById('kpiHistoryList');
  const emptyEl = document.getElementById('kpiHistoryEmpty');
  if (!list) return;

  const kpis = Array.isArray(kpisArg) ? kpisArg : await getKpis();
  const historyItems = kpis
    .slice()
    .sort((a, b) => {
      const bTime = Date.parse(b.updatedAt || b.createdAt || 0) || 0;
      const aTime = Date.parse(a.updatedAt || a.createdAt || 0) || 0;
      return bTime - aTime;
    })
    .slice(0, 12);

  if (!historyItems.length) {
    list.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  list.innerHTML = historyItems.map(k => {
    const when = fmtDateTime(k.updatedAt || k.createdAt);
    return `
      <li style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="min-width:0;">
          <div style="font-size:0.85rem;font-weight:700;color:var(--navy);line-height:1.35;">${esc(k.name || 'Untitled KPI')}</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:4px;">
            ${historyEventLabel(k)}${k.assignedToName ? ` · ${esc(k.assignedToName)}` : ''}
          </div>
        </div>
        <div style="flex-shrink:0;text-align:right;">
          <div style="font-size:0.72rem;color:var(--muted);">${esc(when)}</div>
          <div style="margin-top:6px;">${sBadge(k.status)}</div>
        </div>
      </li>`;
  }).join('');
}

// ── KPI Form ─────────────────────────────────────────────────────────────────
async function initKpiForm() {
  const sel = document.getElementById('kpiAssignedTo');
  const statusSelect = document.getElementById('kpiStatus');

  const staff = await getStaffUsers();

  if (!staff.length) {
    sel.innerHTML = '<option>No staff found</option>';
    return;
  }

  sel.innerHTML =
    '<option value="">Select staff member</option>' +
    staff.map(s => `<option value="${s.id}">${s.name} (${s.email || ''})</option>`).join('');

  const editId = new URLSearchParams(window.location.search).get('id');
  if (!editId) {
    if (statusSelect) {
      statusSelect.value = 'pending';
      statusSelect.disabled = true;
    }
    return;
  }
  if (statusSelect) statusSelect.disabled = false;

  const kpi = await getKpiById(editId);
  if (!kpi) return;

  setVal('kpiId', kpi.id);
  setVal('kpiName', kpi.name || '');
  setVal('kpiCategory', kpi.category || '');
  setVal('kpiDescription', kpi.description || '');
  setVal('kpiTarget', kpi.target || '');
  setVal('kpiUnit', kpi.unit || '');
  setVal('kpiDueDate', toDateInputValue(kpi.dueDate));
  setVal('kpiPriority', kpi.priority || '');
  setVal('kpiWeight', kpi.weight || 0);
  setVal('kpiAssignedTo', kpi.assignedTo || '');
  setVal('kpiStatus', kpi.status || 'pending');
  setText('formPageTitle', 'Edit KPI');

  const badge = document.getElementById('kpiStatusBadge');
  if (badge) badge.style.display = 'inline-flex';
}

async function saveKpiForm() {
  clearFieldErrors();

  const name = document.getElementById('kpiName')?.value.trim() || '';
  const category = document.getElementById('kpiCategory')?.value || '';
  const description = document.getElementById('kpiDescription')?.value.trim() || '';
  const target = document.getElementById('kpiTarget')?.value.trim() || '';
  const unit = document.getElementById('kpiUnit')?.value.trim() || '';
  const dueDate = document.getElementById('kpiDueDate')?.value || '';
  const priority = document.getElementById('kpiPriority')?.value || '';
  const weight = document.getElementById('kpiWeight')?.value || '0';
  const assignedTo = document.getElementById('kpiAssignedTo')?.value || '';
  const status = document.getElementById('kpiStatus')?.value || 'pending';

  let valid = true;
  if (!name) { fieldErr('kpiNameError', 'KPI name is required.'); valid = false; }
  if (!category) { fieldErr('kpiCategoryError', 'Category is required.'); valid = false; }
  if (!description) { fieldErr('kpiDescriptionError', 'Description is required.'); valid = false; }
  if (!target) { fieldErr('kpiTargetError', 'Target value is required.'); valid = false; }
  if (!unit) { fieldErr('kpiUnitError', 'Unit / measure is required.'); valid = false; }
  if (!dueDate) { fieldErr('kpiDueDateError', 'Due date is required.'); valid = false; }
  if (!priority) { fieldErr('kpiPriorityError', 'Priority is required.'); valid = false; }
  if (!assignedTo) { fieldErr('kpiAssignedToError', 'Please assign this KPI to someone.'); valid = false; }

  if (!valid) {
    show('errorAlert');
    return;
  }

  const numericTarget = Number(target);
  if (!Number.isFinite(numericTarget) || numericTarget < 0) {
    fieldErr('kpiTargetError', 'Target must be a valid number.');
    show('errorAlert');
    return;
  }
  
  const numericWeight = Number(weight);
  if (!Number.isFinite(numericWeight) || numericWeight < 0 || numericWeight > 100) {
    fieldErr('kpiWeightError', 'Weight must be between 0 and 100.');
    show('errorAlert');
    return;
  }
  hide('errorAlert');

  const editId = document.getElementById('kpiId')?.value || '';

  const payload = {
    id: editId || undefined,
    name,
    category,
    description,
    target: numericTarget,
    unit,
    dueDate,
    priority,
    weight: numericWeight,
    assignedTo,
  };

  if (editId) payload.status = status;

  await saveKpi(payload);

  show('successAlert');
  setText('successMsg', editId ? 'KPI updated successfully!' : 'KPI created and assigned successfully!');
  setTimeout(() => { window.location.href = 'manager-kpi.html'; }, 1400);
}

// ── Verification Page ────────────────────────────────────────────────────────
async function renderVerifyList() {
  const container = document.getElementById('verifyList');
  const emptyEl = document.getElementById('verifyEmpty');
  if (!container) return;

  let kpis = await getKpis();
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
          <div style="font-size:0.8rem;color:var(--muted);margin-top:3px;">${esc(k.category || '')}${k.priority ? ' · ' + priorityHtml(k.priority) : ''}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${overdue ? '<span style="font-size:0.72rem;color:#dc2626;font-weight:700;background:#fef2f2;padding:3px 8px;border-radius:20px;">Overdue</span>' : ''}
          ${sBadge(k.status)}
        </div>
      </div>
      <div class="verify-card-meta">
        <span>👤 <strong>${esc(k.assignedToName || 'Unassigned')}</strong></span>
        <span>🎯 Target: <strong>${esc(k.target || '—')} ${esc(k.unit || '')}</strong></span>
        <span>📅 Due: <strong>${k.dueDate ? fmtDate(k.dueDate) : '—'}</strong></span>
        ${k.submittedAt ? `<span>📤 Submitted: <strong>${fmtDate(k.submittedAt)}</strong></span>` : ''}
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:0.8rem;color:var(--muted);min-width:68px;">Progress:</span>
        <div style="flex:1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${k.progress || 0}%;background:${pColor(k.progress)};border-radius:4px;transition:width 0.4s;"></div>
        </div>
        <span style="font-size:0.8rem;font-weight:700;min-width:34px;">${k.progress || 0}%</span>
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
  document.getElementById('confirmApproveBtn').onclick = async function () {
    await apiJson(`${KPI_API_BASE}/kpis/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({
      status: 'approved',
      }),
    });

    closeModal('approveModal');
    flashAlert('KPI "' + name + '" approved! ✓');
    await renderVerifyList();
  };
  document.getElementById('approveModal').classList.add('open');
}

function openReject(id, name) {
  document.getElementById('rejectKpiName').textContent = name;
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectReasonError').textContent = '';
  document.getElementById('confirmRejectBtn').onclick = async function () {
    const reason = document.getElementById('rejectReason').value.trim();
    if (!reason) {
      document.getElementById('rejectReasonError').textContent = 'Rejection reason is required.';
      return;
    }

    await apiJson(`${KPI_API_BASE}/kpis/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({
      status: 'rejected',
      rejectionReason: reason,
      }),
    });

    closeModal('rejectModal');
    flashAlert('KPI "' + name + '" rejected.', 'error');
    await renderVerifyList();
  };
  document.getElementById('rejectModal').classList.add('open');
}

async function previewEvidence(id) {
  const kpi = await getKpiById(id);
  const content = document.getElementById('evidencePreviewContent');
  if (!kpi || !content) return;

  const evidenceLink = kpi.evidenceRef ? `${KPI_API_BASE}/evidence/${kpi.evidenceRef}/download` : null;
  const isImage = evidenceLink && /^image\//i.test(kpi.evidenceMimeType || '');
  const isPdf = evidenceLink && /\.pdf(?:\?|$)/i.test(kpi.evidenceName || '');
  const downloadButton = evidenceLink
    ? `<div style="margin-top:16px;"><a href="${esc(evidenceLink)}" target="_blank" rel="noreferrer noopener" class="btn btn-primary btn-sm">Download evidence</a></div>`
    : '';

  if (!evidenceLink) {
    content.innerHTML = `
      <div style="text-align:center;padding:24px;">
        <svg viewBox="0 0 24 24" style="width:52px;height:52px;margin:0 auto 12px;display:block;stroke:var(--muted);stroke-width:1.5;fill:none;stroke-linecap:round;stroke-linejoin:round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p style="font-weight:700;color:var(--navy);margin:0 0 4px;">No evidence attached</p>
        <p style="color:var(--muted);font-size:0.85rem;margin:0;">This KPI has no evidence reference available for preview.</p>
      </div>`;
  } else if (isImage) {
    content.innerHTML = `<div style="text-align:center;"><img src="${esc(evidenceLink)}" alt="Evidence" style="max-width:100%;border-radius:8px;display:block;">${downloadButton}</div>`;
  } else if (isPdf) {
    content.innerHTML = `<div style="width:100%;height:520px;"><iframe src="${esc(evidenceLink)}" style="width:100%;height:100%;border:none;border-radius:12px;" title="Evidence PDF preview"></iframe>${downloadButton}</div>`;
  } else {
    content.innerHTML = `
      <div style="text-align:center;padding:24px;">
        <svg viewBox="0 0 24 24" style="width:52px;height:52px;margin:0 auto 12px;display:block;stroke:var(--primary);stroke-width:1.5;fill:none;stroke-linecap:round;stroke-linejoin:round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <p style="font-weight:700;color:var(--navy);margin:0 0 4px;">${esc(kpi.evidenceName || 'evidence file')}</p>
        <p style="color:var(--muted);font-size:0.85rem;margin:0;">Evidence file attached by ${esc(kpi.assignedToName || 'staff member')}.</p>
        ${downloadButton}
      </div>`;
  }
  document.getElementById('evidenceModal').classList.add('open');
}

// ── Utilities ────────────────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
function show(id) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function fieldErr(id, msg) { const el = document.getElementById(id); if (el) el.textContent = msg; }
function clearFieldErrors() { document.querySelectorAll('.form-hint.error').forEach(el => el.textContent = ''); hide('errorAlert'); }

function flashAlert(msg, type = 'success') {
  const el = document.getElementById('successAlert');
  if (!el) return;
  const msgEl = document.getElementById('successMsg');
  if (msgEl) msgEl.textContent = msg;
  el.style.display = 'flex';
  setTimeout(() => el.style.display = 'none', 3000);
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return 'No timestamp';
  return new Date(d).toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateInputValue(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function historyEventLabel(kpi) {
  if (kpi.status === 'approved') return 'Approved by manager';
  if (kpi.status === 'rejected') return 'Rejected by manager';
  if (kpi.status === 'submitted') return 'Submitted for review';
  if ((kpi.progress || 0) > 0) return `Progress updated to ${kpi.progress || 0}%`;
  if (kpi.createdAt && kpi.updatedAt && kpi.createdAt === kpi.updatedAt) return 'KPI created';
  return 'Updated by manager';
}

function setConnectionStatus(connected) {
  const el = document.getElementById('kpiHistoryConnection');
  if (!el) return;
  if (connected && lastKpiSource === 'remote') {
    el.textContent = 'MongoDB backend connected';
    el.style.color = 'var(--success)';
  } else {
    el.textContent = 'Backend fetch failed';
    el.style.color = 'var(--danger)';
  }
}

function pColor(pct) {
  pct = pct || 0;
  if (pct >= 80) return '#16a34a';
  if (pct >= 50) return '#d97706';
  return '#dc2626';
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

function priorityHtml(p) {
  return { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' }[p] || (p || '—');
}

window.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal')) e.target.classList.remove('open');
});
