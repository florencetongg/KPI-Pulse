/**
 * KPI-Pulse — Universal KPI Engine (CRUD + Dynamic Rendering)
 * ========================================
 * Stores all KPI data in localStorage and provides methods for management.
 * Integrated with AuthManager for user context.
 */

const KPIStore = {
  KPI_KEY: 'kpi_pulse_data',

  // --- Data Access ---
  
  /** Get all KPIs in the system */
  _getAll() {
    const data = localStorage.getItem(this.KPI_KEY);
    return data ? JSON.parse(data) : [];
  },

  /** Save all KPIs to localStorage */
  _save(kpis) {
    localStorage.setItem(this.KPI_KEY, JSON.stringify(kpis));
    KPIEvents.emit('kpis:changed', kpis);
  },

  /** Get KPIs for a specific user */
  getKPIsForUser(userId) {
    return this._getAll().filter(k => k.assignedTo === userId);
  },

  getKPIById(id) {
    return this._getAll().find(k => k.id === id);
  },

  /** Get all KPIs for Manager view */
  getAllKPIs() {
    return this._getAll();
  },

  /** Get current logged-in user's KPIs */
  getMyKPIs() {
    const user = AuthManager.getCurrentUser();
    return user ? this.getKPIsForUser(user.id) : [];
  },

  // --- CRUD Operations ---

  createKPI(kpiData) {
    const kpis = this._getAll();
    const newKPI = {
      id: 'KPI-' + Date.now(),
      title: kpiData.title,
      category: kpiData.category || 'General',
      target: kpiData.target,
      progress: 0,
      status: 'pending',
      assignedTo: kpiData.assignedTo,
      dueDate: kpiData.dueDate,
      createdAt: new Date().toISOString(),
      history: [{ date: new Date().toISOString().split('T')[0], value: 0, note: 'KPI Created' }],
      evidence: []
    };
    kpis.push(newKPI);
    this._save(kpis);
    return newKPI;
  },

  updateKPI(id, updates) {
    const kpis = this._getAll();
    const index = kpis.findIndex(k => k.id === id);
    if (index === -1) return false;

    kpis[index] = { ...kpis[index], ...updates };
    this._save(kpis);
    return true;
  },

  deleteKPI(id) {
    const kpis = this._getAll().filter(k => k.id !== id);
    this._save(kpis);
    return true;
  },

  updateProgress(id, progress, note = '') {
    const kpis = this._getAll();
    const index = kpis.findIndex(k => k.id === id);
    if (index === -1) return false;

    const kpi = kpis[index];
    const val = parseInt(progress);
    kpi.progress = val;
    
    // Status Logic
    if (val >= 100) kpi.status = 'completed';
    else if (val >= 60) kpi.status = 'on-track';
    else if (val >= 30) kpi.status = 'at-risk';
    else kpi.status = 'delayed';

    kpi.history.push({
      date: new Date().toISOString().split('T')[0],
      value: val,
      note: note || `Progress updated to ${val}%`
    });

    this._save(kpis);
    return true;
  },

  addEvidence(id, fileData) {
    const kpis = this._getAll();
    const index = kpis.findIndex(k => k.id === id);
    if (index === -1) return false;

    kpis[index].evidence.push({
      name: fileData.name,
      size: fileData.size,
      date: new Date().toISOString().split('T')[0]
    });

    this._save(kpis);
    return true;
  },

  // --- Summaries ---

  getSummary(kpis) {
    if (!kpis.length) return { total: 0, completed: 0, onTrack: 0, atRisk: 0, delayed: 0, avgProgress: 0 };
    return {
      total: kpis.length,
      completed: kpis.filter(k => k.status === 'completed').length,
      onTrack: kpis.filter(k => k.status === 'on-track').length,
      atRisk: kpis.filter(k => k.status === 'at-risk').length,
      delayed: kpis.filter(k => k.status === 'delayed').length,
      avgProgress: Math.round(kpis.reduce((sum, k) => sum + k.progress, 0) / kpis.length)
    };
  }
};

// --- Event System ---
const KPIEvents = {
  _listeners: {},
  on(event, fn) { (this._listeners[event] ||= []).push(fn); },
  emit(event, payload) { (this._listeners[event] || []).forEach(fn => fn(payload)); }
};

// --- UI Helpers ---

function statusConfig(status) {
  const map = {
    'completed': { colour: 'success', label: 'Completed', icon: 'check-circle' },
    'on-track': { colour: 'primary', label: 'On Track', icon: 'trending-up' },
    'at-risk': { colour: 'warning', label: 'At Risk', icon: 'alert-triangle' },
    'delayed': { colour: 'danger', label: 'Delayed', icon: 'alert-circle' },
    'pending': { colour: 'secondary', label: 'Pending', icon: 'clock' }
  };
  return map[status] || map['pending'];
}

function progressColour(pct) {
  if (pct >= 80) return 'var(--success-green)';
  if (pct >= 50) return 'var(--primary-blue)';
  if (pct >= 30) return 'var(--warning-orange)';
  return 'var(--danger-red)';
}

function daysUntil(dateStr) {
  if (!dateStr) return 0;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function showToast(message, type = 'success') {
  const colours = { success: 'var(--success-green)', warning: 'var(--warning-orange)', danger: 'var(--danger-red)', info: 'var(--primary-blue)' };
  const icons = { success: 'check-circle', warning: 'alert-triangle', danger: 'alert-circle', info: 'info' };

  let container = document.getElementById('kpi-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'kpi-toast-container';
    container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.innerHTML = `
    <div class="d-flex align-items-center gap-2 p-3 rounded-3 shadow-lg bg-white" style="border-left:4px solid ${colours[type]}; min-width:280px; animation:slideIn .3s ease;">
      <i data-lucide="${icons[type]}" style="width:20px;height:20px;color:${colours[type]};"></i>
      <span class="fw-medium small">${message}</span>
    </div>`;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// --- Specific Page Renderers ---

function renderStatCard({ title, value, icon, colour, progress }) {
  const pBar = progress !== undefined ? `
    <div class="mt-3">
      <div class="progress" style="height:6px;">
        <div class="progress-bar" style="width:${progress}%; background:${progressColour(progress)};"></div>
      </div>
    </div>` : '';

  return `
    <div class="card stat-card border-0 shadow-sm h-100 p-3">
      <div class="d-flex justify-content-between">
        <div>
          <p class="text-muted mb-1 fw-medium small">${title}</p>
          <h2 class="fw-bold mb-0" style="color:${colour};">${value}</h2>
        </div>
        <div class="icon-box" style="background:${colour}15;">
          <i data-lucide="${icon}" style="color:${colour}; width:22px; height:22px;"></i>
        </div>
      </div>
      ${pBar}
    </div>`;
}

function renderProgressRing(pct, size = 48) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const col = progressColour(pct);
  return `
    <svg width="${size}" height="${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#eee" stroke-width="5"/>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${col}" stroke-width="5"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}"
        stroke-linecap="round" transform="rotate(-90 ${size/2} ${size/2})" style="transition:all 1s ease;"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" style="font-size:11px;font-weight:700;">${pct}%</text>
    </svg>`;
}

// Dashboard Views
function renderStaffDashboard(id) {
  const user = AuthManager.getCurrentUser();
  const myKPIs = KPIStore.getMyKPIs();
  const summary = KPIStore.getSummary(myKPIs);
  const container = document.getElementById(id);
  if (!container) return;

  let html = `
    <div class="mb-4">
      <h4 class="fw-bold">Welcome, ${user.name} 👋</h4>
    </div>
    <div class="row g-4 mb-4">
      <div class="col-md-3">${renderStatCard({ title: 'My KPIs', value: summary.total, icon: 'target', colour: 'var(--primary-blue)' })}</div>
      <div class="col-md-3">${renderStatCard({ title: 'Completed', value: summary.completed, icon: 'check-circle', colour: 'var(--success-green)' })}</div>
      <div class="col-md-3">${renderStatCard({ title: 'Avg Progress', value: summary.avgProgress + '%', icon: 'trending-up', colour: 'var(--secondary-500)', progress: summary.avgProgress })}</div>
      <div class="col-md-3">${renderStatCard({ title: 'At Risk', value: summary.atRisk, icon: 'alert-triangle', colour: 'var(--warning-orange)' })}</div>
    </div>`;

  if (!myKPIs.length) {
    html += `<div class="card p-5 text-center text-muted shadow-sm border-0">No KPIs assigned to you yet.</div>`;
  } else {
    const rows = myKPIs.map(k => `
      <tr class="align-middle">
        <td><div class="fw-bold">${k.title}</div><small class="text-muted">${k.category}</small></td>
        <td>${k.target}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="progress flex-grow-1" style="height:8px;"><div class="progress-bar" style="width:${k.progress}%; background:${progressColour(k.progress)};"></div></div>
            <span class="small fw-bold">${k.progress}%</span>
          </div>
        </td>
        <td><span class="badge bg-${statusConfig(k.status).colour} bg-opacity-10 text-${statusConfig(k.status).colour}">${statusConfig(k.status).label}</span></td>
        <td class="text-end"><a href="kpi-progress.html?id=${k.id}" class="btn btn-sm btn-light border">Update</a></td>
      </tr>`).join('');

    html += `
      <div class="card border-0 shadow-sm p-4">
        <h5>My Recent KPIs</h5>
        <div class="table-responsive"><table class="table"><thead><tr><th>KPI</th><th>Target</th><th>Progress</th><th>Status</th><th class="text-end">Action</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>`;
  }
  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function renderManagerDashboard(id) {
  const allKPIs = KPIStore.getAllKPIs();
  const summary = KPIStore.getSummary(allKPIs);
  const container = document.getElementById(id);
  if (!container) return;

  let html = `
    <div class="row g-4 mb-4">
      <div class="col-md-3">${renderStatCard({ title: 'Total Team KPIs', value: summary.total, icon: 'users', colour: 'var(--primary-blue)' })}</div>
      <div class="col-md-3">${renderStatCard({ title: 'Team Completion', value: summary.completed, icon: 'check-circle', colour: 'var(--success-green)' })}</div>
      <div class="col-md-3">${renderStatCard({ title: 'Team Avg', value: summary.avgProgress + '%', icon: 'trending-up', colour: 'var(--secondary-500)', progress: summary.avgProgress })}</div>
      <div class="col-md-3">${renderStatCard({ title: 'Delayed Items', value: summary.delayed, icon: 'alert-circle', colour: 'var(--danger-red)' })}</div>
    </div>`;

  const staff = AuthManager._getAllUsers().filter(u => u.role === 'staff');
  const staffRows = staff.map(s => {
    const sKPIs = KPIStore.getKPIsForUser(s.id);
    const sSummary = KPIStore.getSummary(sKPIs);
    return `
      <tr class="align-middle">
        <td><div class="fw-bold">${s.name}</div><small>${s.department}</small></td>
        <td>${sKPIs.length}</td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="progress flex-grow-1" style="height:8px;"><div class="progress-bar" style="width:${sSummary.avgProgress}%; background:${progressColour(sSummary.avgProgress)};"></div></div>
            <span class="small fw-bold">${sSummary.avgProgress}%</span>
          </div>
        </td>
        <td><span class="badge bg-${sSummary.delayed ? 'danger' : 'success'} bg-opacity-10 text-${sSummary.delayed ? 'danger' : 'success'}">${sSummary.delayed ? 'Behind' : 'Excellent'}</span></td>
      </tr>`;
  }).join('');

  html += `
    <div class="card border-0 shadow-sm p-4">
      <h5>Team Performance Summary</h5>
      <div class="table-responsive"><table class="table"><thead><tr><th>Staff</th><th>KPIs</th><th>Avg Progress</th><th>Health</th></tr></thead><tbody>${staffRows}</tbody></table></div>
    </div>`;

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// Inject styles once
(function injectStyles() {
    if (document.getElementById('kpi-engine-styles')) return;
    const s = document.createElement('style');
    s.id = 'kpi-engine-styles';
    s.textContent = `
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .icon-box { width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center; }
        .stat-card { transition: transform .2s ease; } .stat-card:hover { transform: translateY(-3px); }
    `;
    document.head.appendChild(s);
})();
