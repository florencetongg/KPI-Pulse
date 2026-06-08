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
let activeStaffFilter = null;
let cachedHistoryEntries = [];
let cachedDashboardKpis = [];

const KPI_RECORDS_API = `${KPI_API_BASE}/kpi-records`;
const KPI_HISTORY_API = `${KPI_API_BASE}/kpi-history`;

let cachedStaffUsers = [];

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

function hasEvidenceUploaded(kpi) {
  return Boolean(kpi.evidenceRef || String(kpi.evidenceName || '').trim());
}

function isOpenKpi(kpi) {
  return !['approved', 'rejected'].includes(kpi.status);
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
  const normalizedId = normalizeKpiId(id);
  const kpis = await getKpis();
  return kpis.find(kpi => normalizeKpiId(kpi.id) === normalizedId) || null;
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
  cachedStaffUsers = (result.data || []).map(user => ({ id: user._id || user.id, ...user }));
  return cachedStaffUsers;
}

function resolveStaffName(entry, staffUsers = cachedStaffUsers) {
  const populated = entry.staffId && typeof entry.staffId === 'object' ? entry.staffId : null;
  if (populated?.name) return populated.name;

  const staffId = String(populated?._id || entry.staffId || '');
  if (!staffId) return '';

  const match = staffUsers.find(user => String(user.id) === staffId);
  return match?.name || '';
}

function resolveStaffDepartment(entry, staffUsers = cachedStaffUsers) {
  const populated = entry.staffId && typeof entry.staffId === 'object' ? entry.staffId : null;
  if (populated?.department) return populated.department;

  const staffId = String(populated?._id || entry.staffId || '');
  if (!staffId) return '';

  const match = staffUsers.find(user => String(user.id) === staffId);
  return match?.department || '';
}

function buildCycleHistoryUrl({ kpiId, name, assignedTo, department }) {
  const params = new URLSearchParams();
  params.set('kpi_id', normalizeKpiId(kpiId));
  if (name) params.set('name', name);
  if (assignedTo) params.set('assignedTo', assignedTo);
  if (department) params.set('department', department);
  return `kpi-cycle-history.html?${params.toString()}`;
}

function decodeUrlParam(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function fmtCycleMonthYear(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function updateVerifyNavBadge(count) {
  const badge = document.getElementById('pendingBadge');
  if (!badge) return;

  if (count > 0) {
    badge.style.display = 'inline-flex';
    badge.textContent = count;
  } else {
    badge.style.display = 'none';
    badge.textContent = '0';
  }
}

async function refreshVerifyNavBadge(kpisArg) {
  try {
    const kpis = Array.isArray(kpisArg) ? kpisArg : await getKpis();
    const submittedCount = kpis.filter(k => k.status === 'submitted').length;
    updateVerifyNavBadge(submittedCount);
    return submittedCount;
  } catch (error) {
    updateVerifyNavBadge(0);
    return 0;
  }
}

// ── Manager Dashboard ────────────────────────────────────────────────────────
async function loadManagerDashboard() {
  try {
    activeStaffFilter = new URLSearchParams(window.location.search).get('staff') || null;
    cachedDashboardKpis = await getKpis();
    const kpis = cachedDashboardKpis;
    const total = kpis.length;
    const completed = kpis.filter(k => k.status === 'approved').length;
    const openKpis = kpis.filter(isOpenKpi);
    const needsReview = openKpis.filter(k => hasEvidenceUploaded(k)).length;
    const inProgress = openKpis.filter(k => !hasEvidenceUploaded(k)).length;
    const pending = needsReview + inProgress;
    const submittedCount = kpis.filter(k => k.status === 'submitted').length;
    const overdue = kpis.filter(k => k.isOverdue).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    setText('statTotal', total);
    setText('statCompleted', completed);
    setText('statPending', pending);
    setText('statNeedsReview', needsReview);
    setText('statInProgress', inProgress);
    setText('statRate', rate + '%');
    setText('statOverdue', overdue);
    const overdueEl = document.getElementById('statOverdue');
    if (overdueEl) overdueEl.style.color = overdue > 0 ? '#dc2626' : '';

    updateVerifyNavBadge(submittedCount);

    const alertBtn = document.getElementById('verifyAlertBtn');
    if (alertBtn) {
      if (submittedCount > 0) {
        alertBtn.style.display = 'inline-flex';
        setText('pendingCount', submittedCount);
      } else {
        alertBtn.style.display = 'none';
      }
    }

    await renderKpiTable(kpis);
    await renderStaffPerformance(kpis);
    cachedHistoryEntries = [];
    try {
      await renderKpiHistory(kpis);
    } catch (historyError) {
      console.error('Failed to load KPI history section:', historyError);
    }
    updateStaffFilterUi(kpis);
    setConnectionStatus(true);
  } catch (error) {
    console.error('Failed to load manager dashboard:', error);
    setConnectionStatus(false);
    flashAlert('Unable to fetch KPI data from the backend right now.', 'error');
  }
}

// ── KPI Table ────────────────────────────────────────────────────────────────
async function renderKpiTable(kpisArg) {
  const tbody = document.getElementById('kpiTableBody');
  if (!tbody) return;

  const search = (document.getElementById('kpiSearch')?.value || '').toLowerCase();
  const status = document.getElementById('statusFilter')?.value || '';

  let kpis = Array.isArray(kpisArg) ? kpisArg : await getKpis();
  const staffFilter = getActiveStaffFilter();
  if (staffFilter) {
    kpis = kpis.filter(k => String(k.assignedTo) === String(staffFilter));
  }
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
      <td>${dueDateCellHtml(k)}</td>
      <td style="min-width:130px;">${progressCellHtml(k)}</td>
      <td>${sBadge(k.status)}</td>
      <td style="text-align:right;">
        <div style="display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;">
          ${k.status === 'submitted' ? `<a href="kpi-verify.html?id=${k.id}" style="background:#2563eb;color:#fff;font-size:0.72rem;padding:5px 10px;border-radius:8px;text-decoration:none;font-weight:700;">Review</a>` : ''}
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
async function renderStaffPerformance(kpisArg) {
  const tbody = document.getElementById('staffTableBody');
  if (!tbody) return;

  const kpis = Array.isArray(kpisArg) ? kpisArg : await getKpis();
  const staffGroups = new Map();

  kpis.forEach(k => {
    if (!k.assignedTo) return;
    const staffId = String(k.assignedTo);
    if (!staffGroups.has(staffId)) {
      staffGroups.set(staffId, {
        id: k.assignedTo,
        name: k.assignedToName || 'Unknown',
        dept: k.assignedToDept || 'General',
        kpis: [],
        total: 0,
        completed: 0,
        hasOverdue: false,
      });
    }
    const entry = staffGroups.get(staffId);
    entry.kpis.push(k);
    entry.total++;
    if (k.status === 'approved') entry.completed++;
    if (k.isOverdue) entry.hasOverdue = true;
  });

  const staff = [...staffGroups.values()].map(s => ({
    ...s,
    rate: calculateWeightedProgress(s.kpis),
  }));
  const selectedStaffId = getActiveStaffFilter();
  const emptyEl = document.getElementById('staffEmptyState');

  if (!staff.length) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = staff.map(s => {
    const rate = s.rate;
    const perf = staffPerformanceBadge(rate, s.hasOverdue);
    const completedColor = completedCountColor(s.completed, rate);
    const isSelected = selectedStaffId && String(selectedStaffId) === String(s.id);
    const rowStyle = [
      'cursor:pointer',
      isSelected ? 'background:var(--bg-secondary)' : '',
    ].filter(Boolean).join(';');

    return `<tr class="staff-performance-row" data-staff-id="${esc(s.id)}" style="${rowStyle}" onclick="filterKpisByStaff('${s.id}')" title="Click to view this staff member's KPIs">
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#a5b4fc);display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.8rem;font-weight:700;flex-shrink:0;">${s.name.charAt(0).toUpperCase()}</div>
          <span style="font-weight:600;">${esc(s.name)}</span>
        </div>
      </td>
      <td style="color:var(--muted);font-size:0.85rem;">${esc(s.dept)}</td>
      <td style="font-weight:700;">${s.total}</td>
      <td style="font-weight:700;color:${completedColor};">${s.completed}</td>
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

// ── KPI History (completed KPIs from kpiHistory) ────────────────────────────
function normalizeKpiId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  if (typeof value.toString === 'function') return value.toString();
  return String(value);
}

async function fetchHistoryFeed() {
  let result;
  try {
    result = await apiJson(`${KPI_HISTORY_API}/feed`);
  } catch (primaryError) {
    console.warn('KPI history feed unavailable at /api/kpi-history/feed, falling back to /api/kpis/history/feed', primaryError);
    result = await apiJson(`${KPI_API_BASE}/kpis/history/feed`);
  }

  cachedHistoryEntries = (result.data || []).map(normalizeHistoryEntry);
  cachedHistoryEntries = enrichManagerHistoryEntries(cachedHistoryEntries);
  return cachedHistoryEntries;
}

function enrichManagerHistoryEntries(entries) {
  const grouped = new Map();

  entries.forEach(entry => {
    const kpiId = normalizeKpiId(entry.kpi_id || entry.kpiId);
    if (!kpiId) return;
    if (!grouped.has(kpiId)) grouped.set(kpiId, []);
    grouped.get(kpiId).push(entry);
  });

  const enriched = [];
  grouped.forEach(kpiEntries => {
    enriched.push(...enrichSingleKpiHistoryClient(kpiEntries));
  });

  return enriched.sort(
    (a, b) => (Date.parse(b.recordedAt || 0) || 0) - (Date.parse(a.recordedAt || 0) || 0)
  );
}

function enrichSingleKpiHistoryClient(entries) {
  const sorted = [...entries].sort(
    (a, b) => (Date.parse(a.recordedAt || 0) || 0) - (Date.parse(b.recordedAt || 0) || 0)
  );

  return sorted.map((entry, index, all) => {
    if (entry.displayProgress != null && entry.displayProgress !== '') {
      return { ...entry, displayProgress: Number(entry.displayProgress) || 0 };
    }

    const progress = Number(entry.progress) || 0;

    if (entry.action === 'approved') {
      let lastApprovedBefore = -1;
      for (let i = index - 1; i >= 0; i -= 1) {
        if (all[i].action === 'approved') {
          lastApprovedBefore = i;
          break;
        }
      }

      const cycleSubmitted = all
        .slice(lastApprovedBefore + 1, index)
        .filter(item => item.action === 'submitted');
      const lastSubmitted = cycleSubmitted[cycleSubmitted.length - 1];
      const displayProgress = lastSubmitted
        ? Number(lastSubmitted.progress) || 0
        : progress;

      return { ...entry, displayProgress };
    }

    return { ...entry, displayProgress: progress };
  });
}

function getKpiCycleSummaries(entries) {
  const grouped = new Map();

  entries.forEach(entry => {
    const kpiId = normalizeKpiId(entry.kpi_id || entry.kpiId);
    if (!kpiId) return;
    if (!grouped.has(kpiId)) grouped.set(kpiId, []);
    grouped.get(kpiId).push(entry);
  });

  const summaries = [];

  grouped.forEach((kpiEntries, kpiId) => {
    const perKpiEnriched = enrichSingleKpiHistoryClient(kpiEntries);
    const approvedEntries = perKpiEnriched
      .filter(entry => entry.action === 'approved')
      .sort((a, b) => (Date.parse(b.recordedAt || 0) || 0) - (Date.parse(a.recordedAt || 0) || 0));

    if (!approvedEntries.length) return;

    const latestApproved = approvedEntries[0];
    const progress = Number(latestApproved.displayProgress ?? latestApproved.progress) || 0;
    const staff = latestApproved.staffId && typeof latestApproved.staffId === 'object'
      ? latestApproved.staffId
      : null;

    summaries.push({
      ...latestApproved,
      kpi_id: kpiId,
      kpiId,
      progress,
      completedAt: latestApproved.recordedAt,
      cycleCount: approvedEntries.length,
      department: staff?.department || resolveStaffDepartment(latestApproved),
    });
  });

  return summaries;
}

function normalizeHistoryEntry(entry) {
  const staff = entry.staffId && typeof entry.staffId === 'object' ? entry.staffId : null;
  const kpiId = normalizeKpiId(entry.kpi_id || entry.kpiId);

  return {
    ...entry,
    id: entry._id || entry.id,
    kpi_id: kpiId,
    kpiId,
    name: entry.name || entry.kpiName || 'Untitled KPI',
    staffName: entry.staffName || staff?.name || resolveStaffName(entry),
    staffId: staff?._id || entry.staffId,
    action: entry.action || '',
    recordedAt: entry.recordedAt,
    progress: Number(entry.displayProgress ?? entry.progress) || 0,
    displayProgress: entry.displayProgress != null ? Number(entry.displayProgress) || 0 : null,
    target: entry.target || '—',
    comment: entry.comment || '',
    status: entry.status || 'approved',
  };
}

function populateHistoryStaffFilter(entries) {
  const select = document.getElementById('historyStaffFilter');
  if (!select) return;

  const current = select.value;
  const names = [...new Set(entries.map(entry => entry.staffName).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All Staff</option>' +
    names.map(name => `<option value="${escAttr(name)}">${esc(name)}</option>`).join('');
  if (current && names.includes(current)) select.value = current;
}

function filterHistoryEntries(entries) {
  const staffName = document.getElementById('historyStaffFilter')?.value || '';
  if (!staffName) return entries;
  return entries.filter(entry => entry.staffName === staffName);
}

async function renderKpiHistory(kpisArg) {
  const tbody = document.getElementById('kpiHistoryList');
  const emptyEl = document.getElementById('kpiHistoryEmpty');
  if (!tbody) return;

  try {
    if (!cachedStaffUsers.length) {
      await getStaffUsers();
    }
    await fetchHistoryFeed();
  } catch (error) {
    console.error('Failed to load KPI history:', error);
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    const connectionEl = document.getElementById('kpiHistoryConnection');
    if (connectionEl) {
      connectionEl.textContent = 'Unable to load KPI history';
      connectionEl.style.color = 'var(--danger)';
    }
    return;
  }

  const cycleSummaries = getKpiCycleSummaries(cachedHistoryEntries);
  populateHistoryStaffFilter(cycleSummaries);

  const historyItems = filterHistoryEntries(cycleSummaries)
    .slice()
    .sort((a, b) => {
      const bTime = Date.parse(b.completedAt || b.recordedAt || 0) || 0;
      const aTime = Date.parse(a.completedAt || a.recordedAt || 0) || 0;
      return bTime - aTime;
    });

  if (!historyItems.length) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  let kpiLookup = new Map();
  try {
    const kpis = Array.isArray(kpisArg) ? kpisArg : cachedDashboardKpis.length ? cachedDashboardKpis : await getKpis();
    kpiLookup = new Map(kpis.map(kpi => [normalizeKpiId(kpi.id || kpi._id), kpi]));
  } catch (lookupError) {
    console.warn('Could not load live KPI metadata for history links', lookupError);
  }

  tbody.innerHTML = historyItems.map(entry => {
    const kpiId = normalizeKpiId(entry.kpi_id || entry.kpiId);
    const liveKpi = kpiLookup.get(kpiId);
    const staffName = liveKpi?.assignedToName || resolveStaffName(entry);
    const department = liveKpi?.assignedToDept || entry.department || resolveStaffDepartment(entry);
    const name = liveKpi?.name || entry.name;
    const progress = entry.progress || 0;
    const cycleUrl = buildCycleHistoryUrl({
      kpiId,
      name,
      assignedTo: staffName,
      department,
    });
    const statusBadge = progress >= 100
      ? '<span class="badge badge-success">Completed</span>'
      : `<span class="badge badge-warning">${entry.cycleCount} cycle${entry.cycleCount === 1 ? '' : 's'}</span>`;

    return `<tr>
      <td style="font-weight:600;color:var(--navy);">${esc(name)}</td>
      <td>${esc(staffName || '—')}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px;min-width:140px;">
          <span style="font-weight:700;min-width:36px;">${progress}%</span>
          <div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:999px;overflow:hidden;min-width:60px;">
            <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,#4f46e5,#818cf8);border-radius:999px;"></div>
          </div>
        </div>
      </td>
      <td>${esc(fmtDate(entry.completedAt || entry.recordedAt))}</td>
      <td>${statusBadge}</td>
      <td><a href="${escAttr(cycleUrl)}" class="btn btn-secondary btn-sm">View cycles</a></td>
    </tr>`;
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
  const focusId = new URLSearchParams(window.location.search).get('id');
  const f = typeof currentVerifyFilter !== 'undefined' ? currentVerifyFilter : 'all';
  if (focusId) {
    kpis = kpis.filter(k => String(k.id) === String(focusId));
  } else if (f && f !== 'all') {
    kpis = kpis.filter(k => k.status === f);
  }

  if (!kpis.length) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  container.innerHTML = kpis.map(k => {
    const overdue = k.dueDate && k.status !== 'approved' && new Date(k.dueDate) < new Date();
    return `
    <div class="verify-card fade-in-up" id="verify-kpi-${k.id}">
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

  if (focusId) {
    const card = document.getElementById(`verify-kpi-${focusId}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
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
    cachedHistoryEntries = [];
    await renderVerifyList();
    await refreshVerifyNavBadge();
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
    await refreshVerifyNavBadge();
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
function getActiveStaffFilter() {
  return activeStaffFilter || new URLSearchParams(window.location.search).get('staff') || null;
}

function staffPerformanceBadge(rate, hasOverdue) {
  if (hasOverdue || rate < 30) {
    return '<span class="badge badge-danger">Critical</span>';
  }
  if (rate >= 70) {
    return '<span class="badge badge-success">On Track</span>';
  }
  return '<span class="badge badge-warning">At Risk</span>';
}

function completedCountColor(completed, rate) {
  if (completed === 0) return '#dc2626';
  if (rate >= 70) return '#16a34a';
  return '#d97706';
}

function updateStaffFilterUi(kpisArg) {
  const banner = document.getElementById('staffFilterBanner');
  const nameEl = document.getElementById('staffFilterName');
  const staffFilter = getActiveStaffFilter();
  if (!banner || !nameEl) return;

  if (!staffFilter) {
    banner.style.display = 'none';
    nameEl.textContent = '';
    return;
  }

  const kpis = Array.isArray(kpisArg) ? kpisArg : [];
  const match = kpis.find(k => String(k.assignedTo) === String(staffFilter));
  nameEl.textContent = match?.assignedToName || 'Selected staff';
  banner.style.display = 'inline-flex';
}

function filterKpisByStaff(staffId) {
  activeStaffFilter = staffId;
  const url = new URL(window.location.href);
  url.searchParams.set('staff', staffId);
  window.history.pushState({}, '', url);
  renderKpiTable();
  renderStaffPerformance();
  getKpis().then(updateStaffFilterUi);
  document.getElementById('kpi-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearStaffFilter() {
  activeStaffFilter = null;
  const url = new URL(window.location.href);
  url.searchParams.delete('staff');
  window.history.pushState({}, '', url);
  renderKpiTable();
  renderStaffPerformance();
  updateStaffFilterUi([]);
}

function dueDateCellHtml(k) {
  if (!k.dueDate) return '—';

  const dateText = fmtDate(k.dueDate);
  if (k.isOverdue) {
    return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      <span style="font-size:0.85rem;color:#dc2626;font-weight:600;">${dateText}</span>
      <span style="font-size:0.7rem;color:#dc2626;font-weight:600;">Overdue</span>
    </div>`;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(k.dueDate);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = (dueDay - today) / 86400000;
  const dueSoon = diffDays >= 0 && diffDays <= 7;
  const style = dueSoon ? 'font-size:0.85rem;color:#d97706;font-weight:600;' : 'font-size:0.85rem;';

  return `<div style="${style}">${dateText}</div>`;
}

function shouldShowProgressBar(kpi) {
  const progress = Number(kpi.progress) || 0;
  if (kpi.status === 'pending' && progress === 0) return false;
  return progress > 0 || ['in-progress', 'submitted', 'approved', 'rejected'].includes(kpi.status);
}

function progressCellHtml(k) {
  const progress = Number(k.progress) || 0;
  if (k.status === 'pending' && progress === 0) {
    return '<span style="font-size:0.8rem;color:var(--muted);">Not started</span>';
  }
  if (!shouldShowProgressBar(k)) {
    return '<span style="font-size:0.8rem;color:var(--muted);">Not started</span>';
  }

  return `<div style="display:flex;align-items:center;gap:8px;">
    <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
      <div style="height:100%;width:${progress}%;background:${pColor(progress)};border-radius:3px;transition:width 0.4s;"></div>
    </div>
    <span style="font-size:0.75rem;font-weight:700;min-width:30px;">${progress}%</span>
  </div>`;
}

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

function escAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
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

function historyEventLabel(entry) {
  const map = {
    submitted: 'Submitted for review',
    approved: 'Approved by manager',
    rejected: 'Rejected by manager',
    updated: 'Updated by manager',
  };
  return map[entry.action] || 'KPI updated';
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

function historyActionBadge(action) {
  const map = {
    created: '<span class="badge badge-pending">Created</span>',
    submitted: '<span class="badge badge-info">Submitted</span>',
    approved: '<span class="badge badge-success">Approved</span>',
    rejected: '<span class="badge badge-danger">Rejected</span>',
    updated: '<span class="badge badge-warning">Updated</span>',
    'soft-deleted': '<span class="badge badge-danger">Deleted</span>',
  };
  return map[action] || `<span class="badge">${esc(action || '—')}</span>`;
}

function priorityHtml(p) {
  return { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' }[p] || (p || '—');
}

window.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal')) e.target.classList.remove('open');
});
