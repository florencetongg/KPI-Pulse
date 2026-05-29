// API_BASE_URL is defined in auth.js (loaded first on this page).

let cycleChart = null;
let chartJsPromise = null;

function ensureChartJs() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  if (chartJsPromise) return chartJsPromise;

  chartJsPromise = new Promise(function (resolve, reject) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.async = true;
    script.onload = function () { resolve(); };
    script.onerror = function () {
      chartJsPromise = null;
      reject(new Error('Failed to load Chart.js'));
    };
    document.head.appendChild(script);
  });

  return chartJsPromise;
}

function normalizeKpiId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  if (typeof value.toString === 'function') return value.toString();
  return String(value);
}

function cycleApiUrl(path) {
  const base = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:3000/api';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function destroyChartInstance(instance) {
  if (instance && typeof Chart !== 'undefined' && instance instanceof Chart) {
    instance.destroy();
  }
}

async function apiJson(url, options = {}) {
  const response = await authenticatedFetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed with status ${response.status}`);
  return data;
}

function chartTheme() {
  const dark = document.body.classList.contains('dark');
  return {
    tick: dark ? '#94a3b8' : '#64748b',
    grid: dark ? 'rgba(148,163,184,0.14)' : 'rgba(100,116,139,0.18)',
    title: dark ? '#cbd5e1' : '#475569',
    pointBorder: dark ? '#1e293b' : '#ffffff',
  };
}

function buildChartScales(yLabel, xLabel) {
  const theme = chartTheme();
  return {
    y: {
      beginAtZero: true,
      max: 100,
      ticks: { color: theme.tick, callback: value => `${value}%` },
      grid: { color: theme.grid },
      title: { display: true, text: yLabel, color: theme.title, font: { weight: '600' } },
    },
    x: {
      ticks: { color: theme.tick, maxRotation: 45, minRotation: 0 },
      grid: { color: theme.grid },
      title: { display: true, text: xLabel, color: theme.title, font: { weight: '600' } },
    },
  };
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtHistoryDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const timePart = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  return `${datePart}, ${timePart}`;
}

function fmtCycleLabel(value, cycleNumber) {
  if (!value) return `Cycle ${cycleNumber}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return `Cycle ${cycleNumber}`;
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function historyActionBadge(action) {
  const map = {
    created: '<span class="badge cycle-badge-created">Created</span>',
    submitted: '<span class="badge cycle-badge-submitted">Submitted</span>',
    approved: '<span class="badge cycle-badge-approved">Approved</span>',
    rejected: '<span class="badge cycle-badge-rejected">Rejected</span>',
    updated: '<span class="badge cycle-badge-created">Updated</span>',
    'soft-deleted': '<span class="badge cycle-badge-rejected">Deleted</span>',
  };
  return map[action] || `<span class="badge cycle-badge-created">${esc(action || '—')}</span>`;
}

function actorLabel(actorRole) {
  if (actorRole === 'manager') return 'Manager';
  if (actorRole === 'staff') return 'Staff';
  return '—';
}

function progressCell(progress) {
  const value = Math.min(Math.max(Number(progress) || 0, 0), 100);
  return `
    <div class="cycle-progress-cell">
      <span class="cycle-progress-value">${value}%</span>
      <div class="cycle-progress-bar" aria-hidden="true">
        <div class="cycle-progress-fill" style="width:${value}%;"></div>
      </div>
    </div>`;
}

function resolveEntryProgress(entry, cycleEntries) {
  if (entry.displayProgress != null && entry.displayProgress !== '') {
    return Number(entry.displayProgress) || 0;
  }

  if (entry.action === 'approved') {
    const submitted = cycleEntries
      .filter(item => item.action === 'submitted')
      .filter(item => (Date.parse(item.recordedAt || 0) || 0) <= (Date.parse(entry.recordedAt || 0) || 0))
      .sort((a, b) => (Date.parse(b.recordedAt || 0) || 0) - (Date.parse(a.recordedAt || 0) || 0));
    if (submitted[0]) return Number(submitted[0].progress) || 0;
  }
  return Number(entry.progress) || 0;
}

function enrichCycleEntries(entries) {
  const sorted = [...entries].sort(
    (a, b) => (Date.parse(a.recordedAt || 0) || 0) - (Date.parse(b.recordedAt || 0) || 0)
  );

  return sorted.map((entry, index, all) => {
    const progress = Number(entry.progress) || 0;

    if (entry.displayProgress != null && entry.displayProgress !== '') {
      return { ...entry, displayProgress: Number(entry.displayProgress) || 0 };
    }

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

      return { ...entry, displayProgress, submissionProgress: displayProgress };
    }

    return {
      ...entry,
      displayProgress: progress,
      submissionProgress: entry.action === 'submitted' ? progress : null,
    };
  });
}

function commentCell(entry) {
  if (entry.action === 'rejected' && entry.rejectionReason) {
    return `<span class="cycle-rejection-reason">${esc(entry.rejectionReason)}</span>`;
  }
  return esc(entry.comment || '—');
}

function getKpiIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('kpi_id') || params.get('id') || '';
}

function decodeUrlParam(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(String(value).replace(/\+/g, ' '));
  } catch {
    return String(value);
  }
}

function getKpiMetaFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    name: decodeUrlParam(params.get('name') || ''),
    assignedToName: decodeUrlParam(params.get('assignedTo') || ''),
    department: decodeUrlParam(params.get('department') || ''),
  };
}

function applyUrlMetaToHeader(urlMeta) {
  const titleEl = document.getElementById('cyclePageTitle');
  const assignedEl = document.getElementById('cycleAssignedTo');
  const deptEl = document.getElementById('cycleDepartment');

  if (urlMeta.name && titleEl) titleEl.textContent = urlMeta.name;
  if (urlMeta.assignedToName && assignedEl) {
    assignedEl.textContent = `Assigned to: ${urlMeta.assignedToName}`;
  }
  if (urlMeta.department && deptEl) {
    deptEl.textContent = `Department: ${urlMeta.department}`;
  }
  if (urlMeta.name) document.title = `${urlMeta.name} | KPI Pro`;
}

function sortCycleEntries(entries) {
  return [...entries].sort(
    (a, b) => (Date.parse(a.recordedAt || 0) || 0) - (Date.parse(b.recordedAt || 0) || 0)
  );
}

function normalizeCycleEntry(entry) {
  return {
    ...entry,
    name: entry.name || entry.kpiName || 'Untitled KPI',
    comment: entry.comment || '',
    staffName: entry.staffName || '',
  };
}

function prepareCycleEntries(entries) {
  if (!entries.length) return [];
  const normalized = entries.map(normalizeCycleEntry);
  const sorted = sortCycleEntries(normalized);
  if (sorted[0].displayProgress != null) return sorted;
  return enrichCycleEntries(sorted);
}

async function fetchCycleHistoryData(kpiId) {
  const normalizedId = normalizeKpiId(kpiId);
  if (!normalizedId) return { kpi: {}, entries: [], error: 'Missing KPI id.' };

  try {
    const result = await apiJson(cycleApiUrl(`/kpi-history/${encodeURIComponent(normalizedId)}/cycles`));
    const entries = prepareCycleEntries(result.data?.cycles || []);
    if (entries.length) {
      return { kpi: result.data?.kpi || {}, entries, error: '' };
    }
  } catch (error) {
    console.warn('Cycle history /cycles failed:', error.message);
  }

  try {
    const feedResult = await apiJson(cycleApiUrl('/kpi-history/feed'));
    const filtered = (feedResult.data || []).filter(
      entry => normalizeKpiId(entry.kpi_id || entry.kpiId) === normalizedId
    );
    const entries = prepareCycleEntries(filtered);
    if (entries.length) {
      return { kpi: {}, entries, error: '' };
    }
  } catch (error) {
    console.warn('Cycle history feed fallback failed:', error.message);
  }

  return { kpi: {}, entries: [], error: 'No history found for this KPI.' };
}

function resolveKpiHeaderMeta(apiKpi, urlMeta, entries) {
  const firstEntry = entries[0] || {};
  const staff = firstEntry.staffId && typeof firstEntry.staffId === 'object' ? firstEntry.staffId : null;

  return {
    name: apiKpi.name || urlMeta.name || firstEntry.name || firstEntry.kpiName || 'KPI Cycle History',
    assignedToName: apiKpi.assignedToName || urlMeta.assignedToName || firstEntry.staffName || staff?.name || '—',
    department: apiKpi.department || urlMeta.department || staff?.department || '—',
  };
}

function segmentIntoCycles(entries) {
  const sorted = [...entries].sort(
    (a, b) => (Date.parse(a.recordedAt || 0) || 0) - (Date.parse(b.recordedAt || 0) || 0)
  );
  const cycles = [];
  let buffer = [];

  sorted.forEach(entry => {
    buffer.push(entry);
    if (entry.action === 'approved') {
      cycles.push(buildCycleRecord(buffer, cycles.length + 1, true));
      buffer = [];
    }
  });

  if (buffer.length) {
    cycles.push(buildCycleRecord(buffer, cycles.length + 1, false));
  }

  return attachImprovement(cycles);
}

function buildCycleRecord(entries, cycleNumber, isComplete) {
  const milestones = entries
    .filter(entry => ['created', 'submitted', 'approved'].includes(entry.action))
    .map(entry => ({
      ...entry,
      displayProgress: resolveEntryProgress(entry, entries),
    }));

  const approved = entries.find(entry => entry.action === 'approved');
  const submitted = entries.filter(entry => entry.action === 'submitted');
  const finalSubmitted = submitted[submitted.length - 1];
  const completionProgress = finalSubmitted
    ? Number(finalSubmitted.progress) || 0
    : approved
      ? resolveEntryProgress(approved, entries)
      : Number(milestones[0]?.displayProgress) || 0;

  return {
    cycleNumber,
    label: fmtCycleLabel(approved?.recordedAt || entries[entries.length - 1]?.recordedAt, cycleNumber),
    entries: entries.map(entry => ({
      ...entry,
      displayProgress: resolveEntryProgress(entry, entries),
      cycleNumber,
    })),
    milestones,
    isComplete: isComplete && !!approved,
    completionProgress,
    completedAt: approved?.recordedAt || null,
    improvement: null,
  };
}

function attachImprovement(cycles) {
  let previousComplete = null;

  return cycles.map(cycle => {
    if (!cycle.isComplete) {
      return { ...cycle, improvement: null };
    }

    const improvement = previousComplete == null
      ? null
      : Math.round((cycle.completionProgress - previousComplete.completionProgress) * 10) / 10;

    previousComplete = cycle;
    return { ...cycle, improvement };
  });
}

function formatImprovement(value) {
  if (value == null) return '—';
  if (value > 0) return `+${value}%`;
  if (value < 0) return `${value}%`;
  return '0%';
}

function improvementClass(value) {
  if (value == null) return 'muted';
  if (value > 0) return 'success';
  if (value < 0) return 'danger';
  return 'muted';
}

function renderCycleSummary(cycles) {
  const strip = document.getElementById('cycleSummaryStrip');
  if (!strip) return;

  const completed = cycles.filter(cycle => cycle.isComplete);
  if (!completed.length) {
    strip.style.display = 'none';
    strip.innerHTML = '';
    return;
  }

  strip.style.display = 'grid';
  strip.innerHTML = completed.map(cycle => {
    const imp = cycle.improvement;
    const impText = formatImprovement(imp);
    const impColor = improvementClass(imp) === 'success'
      ? '#16a34a'
      : improvementClass(imp) === 'danger'
        ? '#dc2626'
        : 'var(--muted)';

    return `
      <div class="kpi-stat-card ${cycle.completionProgress >= 100 ? 'success' : 'primary'}">
        <div class="kpi-stat-value" style="font-size:1.5rem;">${cycle.label}</div>
        <div class="kpi-stat-label">Cycle ${cycle.cycleNumber} completed at ${cycle.completionProgress}%</div>
        <div style="margin-top:8px;font-size:0.8rem;font-weight:700;color:${impColor};">
          ${imp == null ? 'First completed cycle' : `Improvement: ${impText}`}
        </div>
      </div>`;
  }).join('');
}

function renderHistoryTable(cycles) {
  const tbody = document.getElementById('cycleHistoryBody');
  if (!tbody) return;

  const rows = cycles.flatMap(cycle => cycle.entries.map(entry => `
    <tr>
      <td style="font-weight:600;white-space:nowrap;">${esc(cycle.label)}</td>
      <td style="white-space:nowrap;">${esc(fmtHistoryDate(entry.recordedAt))}</td>
      <td>${historyActionBadge(entry.action)}</td>
      <td>${progressCell(entry.displayProgress)}</td>
      <td style="max-width:220px;white-space:normal;">${commentCell(entry)}</td>
      <td>${esc(entry.evidenceName || '—')}</td>
      <td>${esc(actorLabel(entry.actorRole))}</td>
    </tr>`));

  tbody.innerHTML = rows.join('');
}

function renderCycleInsights(cycles) {
  const block = document.getElementById('cycleInsightBlock');
  if (!block) return;

  const completed = cycles.filter(cycle => cycle.isComplete);
  if (!completed.length) {
    block.style.display = 'none';
    return;
  }

  block.style.display = 'block';
  const latest = completed[completed.length - 1];
  const first = completed[0];
  const totalImprovement = completed.length > 1
    ? Math.round((latest.completionProgress - first.completionProgress) * 10) / 10
    : null;

  const lines = [
    `Completed cycles: ${completed.length} cycle${completed.length === 1 ? '' : 's'} recorded for this KPI.`,
    latest.improvement != null
      ? `Latest cycle (${latest.label}): ${latest.completionProgress}% completion, ${formatImprovement(latest.improvement)} vs previous cycle.`
      : `Latest cycle (${latest.label}): ${latest.completionProgress}% completion.`,
    totalImprovement != null
      ? `Overall improvement from first to latest completed cycle: ${formatImprovement(totalImprovement)}.`
      : 'Overall improvement: first completed cycle — no prior cycle to compare.',
  ];

  block.innerHTML = lines.map(line => `<p>${esc(line)}</p>`).join('');
}

function renderCompletionChart(cycles) {
  const canvas = document.getElementById('cycleCompletionChart');
  const card = canvas?.closest('.cycle-completion-chart');
  if (!canvas) return;

  ensureChartJs().then(function () {
    renderCompletionChartInner(cycles, canvas, card);
  }).catch(function () {
    if (card) card.style.display = 'none';
  });
}

function renderCompletionChartInner(cycles, canvas, card) {
  if (typeof Chart === 'undefined') return;

  const completed = cycles.filter(cycle => cycle.isComplete);

  destroyChartInstance(window.cycleCompletionChart);
  window.cycleCompletionChart = null;

  if (!completed.length) {
    if (card) card.style.display = 'none';
    return;
  }

  if (card) card.style.display = 'block';

  const labels = completed.map(cycle => cycle.label);
  const values = completed.map(cycle => cycle.completionProgress);
  const pointColors = values.map(value => (value >= 100 ? '#16a34a' : '#4f46e5'));

  window.cycleCompletionChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Completed progress',
        data: values,
        borderColor: '#4f46e5',
        backgroundColor: document.body.classList.contains('dark')
          ? 'rgba(129, 140, 248, 0.18)'
          : 'rgba(79, 70, 229, 0.14)',
        fill: true,
        tension: 0.3,
        pointRadius: 7,
        pointHoverRadius: 9,
        pointBackgroundColor: pointColors,
        pointBorderColor: chartTheme().pointBorder,
        pointBorderWidth: 2,
        borderWidth: 2.5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: buildChartScales('Completion %', 'Cycle'),
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const cycle = completed[context.dataIndex];
              const base = `Completed: ${context.parsed.y}%`;
              if (cycle.improvement == null) return base;
              return `${base} (${formatImprovement(cycle.improvement)} vs previous)`;
            },
          },
        },
      },
    },
  });
}

function renderJourneyChart(cycles) {
  const canvas = document.getElementById('cycleAchievementChart');
  const card = canvas?.closest('.cycle-chart-card');
  if (!canvas) return;

  ensureChartJs().then(function () {
    renderJourneyChartInner(cycles, canvas, card);
  }).catch(function () {
    if (card) card.style.display = 'none';
  });
}

function renderJourneyChartInner(cycles, canvas, card) {
  if (typeof Chart === 'undefined') return;

  const milestones = cycles.flatMap(cycle =>
    cycle.milestones.map(milestone => ({
      ...milestone,
      cycleLabel: cycle.label,
      cycleNumber: cycle.cycleNumber,
    }))
  );

  if (cycleChart) {
    cycleChart.destroy();
    cycleChart = null;
  }

  if (!milestones.length) {
    if (card) card.style.display = 'none';
    return;
  }

  if (card) card.style.display = 'block';

  const labels = milestones.map(milestone => {
    const action = milestone.action.charAt(0).toUpperCase() + milestone.action.slice(1);
    return `C${milestone.cycleNumber} ${action}`;
  });
  const values = milestones.map(milestone => milestone.displayProgress);
  const pointColors = milestones.map(milestone => ({
    created: '#94a3b8',
    submitted: '#9333ea',
    approved: '#16a34a',
  }[milestone.action] || '#4f46e5'));

  cycleChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Progress',
        data: values,
        borderColor: '#4f46e5',
        backgroundColor: document.body.classList.contains('dark')
          ? 'rgba(129, 140, 248, 0.18)'
          : 'rgba(79, 70, 229, 0.14)',
        fill: true,
        tension: 0.3,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: pointColors,
        pointBorderColor: chartTheme().pointBorder,
        pointBorderWidth: 2,
        borderWidth: 2.5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: buildChartScales('Progress %', 'Created → submitted → completed'),
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              const milestone = milestones[items[0]?.dataIndex];
              if (!milestone) return '';
              return `${milestone.cycleLabel} — ${milestone.action}`;
            },
            label(context) {
              return `Progress: ${context.parsed.y}%`;
            },
          },
        },
      },
    },
  });
}

function showLoadingState() {
  const loadingEl = document.getElementById('cycleHistoryLoading');
  if (loadingEl) loadingEl.style.display = 'flex';
  document.getElementById('cycleContentWrap').style.display = 'none';
  document.getElementById('cycleHistoryEmpty').style.display = 'none';
  const errorEl = document.getElementById('cycleHistoryError');
  if (errorEl) errorEl.style.display = 'none';
}

function hideLoadingState() {
  const loadingEl = document.getElementById('cycleHistoryLoading');
  if (loadingEl) loadingEl.style.display = 'none';
}

function showEmptyState(message) {
  hideLoadingState();
  document.getElementById('cycleContentWrap').style.display = 'none';
  const emptyEl = document.getElementById('cycleHistoryEmpty');
  emptyEl.style.display = 'flex';
  const emptyText = emptyEl.querySelector('p');
  if (emptyText) {
    emptyText.textContent = message || 'No history yet for this KPI.';
  }
  const strip = document.getElementById('cycleSummaryStrip');
  if (strip) {
    strip.style.display = 'none';
    strip.innerHTML = '';
  }

  destroyChartInstance(cycleChart);
  cycleChart = null;
  destroyChartInstance(window.cycleCompletionChart);
  window.cycleCompletionChart = null;
}

function showContent(entries) {
  hideLoadingState();
  window.__cycleHistoryEntries = entries;
  document.getElementById('cycleHistoryEmpty').style.display = 'none';
  document.getElementById('cycleContentWrap').style.display = 'block';

  const cycles = segmentIntoCycles(entries);
  renderCycleSummary(cycles);
  renderHistoryTable(cycles);
  renderCycleInsights(cycles);

  window.setTimeout(function () {
    renderJourneyChart(cycles);
    renderCompletionChart(cycles);
  }, 0);
}

async function loadCycleHistory() {
  const titleEl = document.getElementById('cyclePageTitle');
  const assignedEl = document.getElementById('cycleAssignedTo');
  const deptEl = document.getElementById('cycleDepartment');
  const errorEl = document.getElementById('cycleHistoryError');
  const kpiId = normalizeKpiId(getKpiIdFromUrl());
  const urlMeta = getKpiMetaFromUrl();

  applyUrlMetaToHeader(urlMeta);

  if (!kpiId) {
    if (errorEl) {
      errorEl.style.display = 'flex';
      errorEl.textContent = 'Missing KPI id in the URL. Open this page from the KPI history list.';
    }
    showEmptyState('Missing KPI id. Go back and open this page using the View cycles button.');
    return;
  }

  showLoadingState();

  try {
    const { kpi: apiKpi, entries, error: fetchError } = await fetchCycleHistoryData(kpiId);
    const kpi = resolveKpiHeaderMeta(apiKpi, urlMeta, entries);

    if (titleEl) titleEl.textContent = kpi.name;
    if (assignedEl) assignedEl.textContent = `Assigned to: ${kpi.assignedToName || '—'}`;
    if (deptEl) deptEl.textContent = `Department: ${kpi.department || '—'}`;

    document.title = `${kpi.name} | KPI Pro`;

    if (!entries.length) {
      if (errorEl && fetchError) {
        errorEl.style.display = 'flex';
        errorEl.textContent = fetchError;
      }
      showEmptyState(fetchError || 'No history yet for this KPI.');
      return;
    }

    if (errorEl) errorEl.style.display = 'none';
    showContent(entries);
  } catch (error) {
    console.error('Failed to load cycle history:', error);
    if (errorEl) {
      errorEl.style.display = 'flex';
      errorEl.textContent = error.message || 'Unable to load cycle history.';
    }
    showEmptyState(error.message || 'Unable to load cycle history.');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  if (!requireAuth('manager')) return;
  const user = getCurrentUser();
  populateNavUser(user);
  initDarkMode();
  applyUrlMetaToHeader(getKpiMetaFromUrl());
  loadCycleHistory();

  const darkToggle = document.getElementById('darkModeToggle');
  if (darkToggle) {
    darkToggle.addEventListener('click', function () {
      window.setTimeout(function () {
        const entries = window.__cycleHistoryEntries;
        if (entries && entries.length) showContent(entries);
      }, 0);
    });
  }
});
