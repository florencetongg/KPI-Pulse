function loadComponent(id, filePath, callback = null) {
  fetch(filePath)
    .then(response => {
      if (!response.ok) throw new Error("Component not found: " + filePath);
      return response.text();
    })
    .then(data => {
      const element = document.getElementById(id);
      if (!element) return console.error("Element not found:", id);

      element.innerHTML = data;

      // Run callback after component loads
      if (callback) callback();
    })
    .catch(error => console.error(error));
}

document.addEventListener("DOMContentLoaded", function () {
  // 1. Session Guard
  const user = AuthManager.getCurrentUser();
  const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html') || window.location.pathname.includes('index.html');
  
  if (!user && !isAuthPage) {
    window.location.href = 'login.html';
    return;
  }

  // 2. Load sidebar and highlight active link
  loadComponent("sidebar-container", "../components/sidebar.html", function() {
    const sidebarItems = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    let currentPage = window.location.pathname.split("/").pop();
    if (currentPage === '') currentPage = 'dashboard.html';

    sidebarItems.forEach(item => {
      const href = item.getAttribute('href');
      if (href === currentPage) {
        item.classList.add('active');
      }

      // Role-based visibility for sidebar
      if (user && user.role !== 'manager') {
        const adminLinks = ['kpi-form.html', 'kpi-verify.html', 'manager-kpi.html'];
        if (adminLinks.includes(href)) {
          item.classList.add('d-none');
        }
      }
    });

    // Logout wiring
    document.querySelectorAll('[href="login.html"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        AuthManager.logout();
      });
    });
  });

  // 3. Load top navbar and highlight active link
  loadComponent("navbar-container", "../components/navbar.html", function() {
    const navLinks = document.querySelectorAll('.top-nav-link');
    let currentPage = window.location.pathname.split("/").pop();
    if (currentPage === '') currentPage = 'dashboard.html';

    navLinks.forEach(link => {
      const page = link.getAttribute('data-page');
      if (page === currentPage) {
        link.classList.add('active');
      }

      // Role-based visibility for top nav
      if (user && user.role !== 'manager') {
        const adminPages = ['kpi-form.html', 'kpi-verify.html'];
        if (adminPages.includes(page)) {
          link.classList.add('d-none');
        }
      }
    });

    // Populate User Info
    if (user) {
      const nameEl = document.getElementById('top-nav-user-name');
      const avatarEl = document.getElementById('top-nav-avatar');
      const ddName = document.getElementById('user-dropdown-name');
      const ddDept = document.getElementById('user-dropdown-dept');
      
      if (nameEl) nameEl.textContent = user.name;
      if (avatarEl) avatarEl.textContent = user.avatar;
      if (ddName) ddName.textContent = user.name;
      if (ddDept) ddDept.textContent = user.department;
    }

    // Notification Logic
    const btnNotif = document.getElementById('btn-notifications');
    if (btnNotif) {
      btnNotif.addEventListener('click', () => {
        const badge = btnNotif.querySelector('.top-nav-badge');
        if(badge) badge.classList.add('d-none');
        if(typeof showToast === 'function') {
          if(!document.querySelector('.toast-notifs-shown')) {
             showToast('System: Q4 Goals have been published.', 'info');
             setTimeout(() => showToast('Manager left a comment on your KPI.', 'primary'), 1000);
             document.body.classList.add('toast-notifs-shown');
          } else {
             showToast('No new notifications.', 'info');
          }
        }
      });
    }

    // Global Top Search Logic
    const topSearch = document.getElementById('top-nav-search');
    if (topSearch) {
      topSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const q = e.target.value.trim();
          if(!q) return;

          const isDash = window.location.pathname.includes('dashboard.html') || window.location.pathname.endsWith('/');
          if(isDash && typeof renderStaffDashboard === 'function') {
            const role = user.role;
            if(role === 'manager') {
              const el = document.getElementById('mgr-search-input');
              if(el) el.value = q;
              renderManagerDashboard('dashboard-content', q);
            } else {
              const el = document.getElementById('staff-search-input');
              if(el) el.value = q;
              renderStaffDashboard('dashboard-content', q);
            }
          } else {
            if(typeof showToast === 'function') showToast(`Searching for "${q}" across the organization.`, 'info');
          }
        }
      });
    }
  });

});

function generateBreadcrumb() {
  const container = document.getElementById('breadcrumb-container');
  if (!container) return;

  const path = window.location.pathname.split("/").pop() || 'dashboard.html';
  
  const labels = {
    'dashboard.html': 'Dashboard',
    'kpi-form.html': 'KPI Management',
    'kpi-verify.html': 'KPI Verify',
    'manager-kpi.html': 'Manager KPI',
    'staff-kpi.html': 'My KPIs',
    'profile.html': 'Profile',
    'settings.html': 'Settings',
    'login.html': 'Login',
    'kpi-progress.html': 'Update Progress'
  };

  container.innerHTML = `
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="dashboard.html">Home</a></li>
        <li class="breadcrumb-item active" aria-current="page">${labels[path] || 'Page'}</li>
      </ol>
    </nav>
  `;
}

document.addEventListener("DOMContentLoaded", generateBreadcrumb);