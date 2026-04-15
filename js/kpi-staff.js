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
      type: fileData.type,
      data: fileData.data,
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

// Dashboard Views
function renderStaffDashboard(id, searchQuery = '') {
  const user = AuthManager.getCurrentUser();
  let myKPIs = KPIStore.getMyKPIs();
  const summary = KPIStore.getSummary(myKPIs); // Stats based on all
  
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    myKPIs = myKPIs.filter(k => k.title.toLowerCase().includes(q) || k.category.toLowerCase().includes(q));
  }
  
  const staffView = document.getElementById('staff-dashboard-view');
  const mgrView = document.getElementById('manager-dashboard-view');
  if(staffView && mgrView) {
    staffView.classList.remove('d-none');
    mgrView.classList.add('d-none');
  }

  // Populate names and stats
  const nameEl = document.getElementById('staff-welcome-name');
  if (nameEl && user) nameEl.textContent = user.name;
  
  const els = {
    total: document.getElementById('staff-stat-total'),
    completed: document.getElementById('staff-stat-completed'),
    progress: document.getElementById('staff-stat-progress'),
    progressBar: document.getElementById('staff-stat-progress-bar'),
    risk: document.getElementById('staff-stat-risk')
  };

  if(els.total) els.total.textContent = summary.total;
  if(els.completed) els.completed.textContent = summary.completed;
  if(els.progress) els.progress.textContent = summary.avgProgress + '%';
  if(els.progressBar) els.progressBar.style.width = summary.avgProgress + '%';
  if(els.risk) els.risk.textContent = summary.atRisk;

  // Render Table List
  const listContainer = document.getElementById('staff-dashboard-kpi-list');
  const emptyState = document.getElementById('staff-empty-state');
  if(!listContainer) return;

  if (!myKPIs.length) {
    listContainer.innerHTML = '';
    if(emptyState) emptyState.classList.remove('d-none');
  } else {
    if(emptyState) emptyState.classList.add('d-none');
    listContainer.innerHTML = myKPIs.map(k => `
      <tr class="align-middle" style="border-bottom: 1px solid rgba(0,0,0,0.05);">
        <td class="ps-3 py-3"><div class="fw-bold ">${k.title}</div><small style="color:var(--text-muted);">${k.category}</small></td>
        <td><span class="text-muted fw-medium">${k.target}</span></td>
        <td>
          <div class="d-flex align-items-center gap-2">
            <div class="progress flex-grow-1" style="height:8px; background: rgba(0,0,0,0.1);"><div class="progress-bar bg-primary rounded-pill" style="width:${k.progress}%; background:${progressColour(k.progress)} !important; transition:width 1s ease;"></div></div>
            <span class="small fw-bold text-muted">${k.progress}%</span>
          </div>
        </td>
        <td><span class="badge bg-${statusConfig(k.status).colour} bg-opacity-25 text-${statusConfig(k.status).colour} px-3 border border-${statusConfig(k.status).colour}">${statusConfig(k.status).label}</span></td>
        <td class="text-end pe-3"><a href="kpi-progress.html?id=${k.id}" class="btn border    btn-sm">Update</a></td>
      </tr>`).join('');
  }
}

// Manager logic moved to kpi-manager.js

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
