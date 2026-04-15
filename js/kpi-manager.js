/**
 * KPI Manager Module
 * Handles specifically the manager-kpi.html rendering logic.
 */

function renderManagerView() {
  const allKPIs = KPIStore.getAllKPIs();
  const summary = KPIStore.getSummary(allKPIs);

  // Update Stat Cards
  document.getElementById('mgr-stat-total').textContent = summary.total;
  document.getElementById('mgr-stat-completed').textContent = summary.completed;
  document.getElementById('mgr-stat-pending').textContent = summary.total - summary.completed; // or whatever logic
  document.getElementById('mgr-stat-delayed').textContent = summary.delayed;

  // Update Health Ring
  document.getElementById('mgr-health-pct').textContent = summary.avgProgress + '%';

  // Render KPIs to Table
  const tbody = document.getElementById('mgr-kpi-table-body');
  if (!tbody) return;

  if (allKPIs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No KPIs assigned yet.</td></tr>`;
    return;
  }

  // Get staff map for names
  const users = AuthManager._getAllUsers();
  
  tbody.innerHTML = allKPIs.map(k => {
    const assignedUser = users.find(u => u.id === k.assignedTo) || { name: 'Unknown', department: 'Unknown' };
    const statusCfg = statusConfig(k.status);

    return `
      <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
        <td class="ps-3 py-3">
          <div class="fw-bold ">${k.title}</div>
          <small style="color:var(--text-muted);">${k.category}</small>
        </td>
        <td>
          <span class="">${assignedUser.name}</span>
        </td>
        <td>
          <span class="text-muted fw-medium">${k.target}</span>
        </td>
        <td>
          <span class="badge bg-${statusCfg.colour} bg-opacity-25 text-${statusCfg.colour} px-3 border border-${statusCfg.colour}">${statusCfg.label}</span>
          <span class="ms-2 small text-muted fw-bold">${k.progress}%</span>
        </td>
        <td class="text-end pe-3">
          <button class="btn btn-sm btn-outline-dark " onclick="alert('Demo: Edit KPI')"><i data-lucide="edit-2" style="width:14px; height:14px;"></i></button>
          <button class="btn btn-sm btn-outline-danger " onclick="if(confirm('Delete KPI?')){ KPIStore.deleteKPI('${k.id}'); renderManagerView(); }"><i data-lucide="trash-2" style="width:14px; height:14px;"></i></button>
        </td>
      </tr>
    `;
  }).join('');
  
  if (window.lucide) lucide.createIcons();

  // Search logic
  const searchInput = document.getElementById('mgr-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const rows = tbody.querySelectorAll('tr');
      rows.forEach((row, i) => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }
}
