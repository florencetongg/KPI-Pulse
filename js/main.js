/**
 * Core Initialization & Component Loading Layout
 */

function loadComponent(id, filePath, callback = null) {
  fetch(filePath)
    .then(response => {
      if (!response.ok) throw new Error("Component not found: " + filePath);
      return response.text();
    })
    .then(data => {
      const element = document.getElementById(id);
      if (element) {
        element.innerHTML = data;
        if (callback) callback();
      }
    })
    .catch(error => console.error(error));
}

document.addEventListener("DOMContentLoaded", function () {
  const user = AuthManager.getCurrentUser();
  
  // Guard the session - AuthManager handles redirect, but we make sure we don't load UI if not logged in
  if (!user && window.location.pathname !== '/' && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html') && !window.location.pathname.includes('index.html')) {
    return; // AuthManager already redirects
  }

  // Load Sidebar
  loadComponent("sidebar-container", "/components/sidebar.html", function() {
    setupRoleVisibility(user);
    setupActiveLinks();
    
    const sbBtn = document.getElementById('sidebarLogoutBtn');
    if (sbBtn) sbBtn.addEventListener('click', (e) => { e.preventDefault(); AuthManager.logout(); });
  });

  // Load Navbar
  loadComponent("navbar-container", "/components/navbar.html", function() {
    setupRoleVisibility(user);
    setupActiveLinks();

    const topNavName = document.getElementById('top-nav-user-name');
    const ddName = document.getElementById('user-dropdown-name');
    const ddDept = document.getElementById('user-dropdown-dept');
    const navBtn = document.getElementById('navLogoutBtn');

    if (user) {
      if(topNavName) topNavName.textContent = user.name;
      if(ddName) ddName.textContent = user.name;
      if(ddDept) ddDept.textContent = user.department;
    }

    if (navBtn) navBtn.addEventListener('click', (e) => { e.preventDefault(); AuthManager.logout(); });
  });
});

function setupRoleVisibility(user) {
  if (!user) return;
  const isManager = user.role === 'manager';
  
  // Hide staff items if manager, and vice versa
  const staffOnly = document.querySelectorAll('.nav-staff-only');
  const mgrOnly = document.querySelectorAll('.nav-manager-only');

  if (isManager) {
    staffOnly.forEach(el => el.classList.add('d-none'));
    mgrOnly.forEach(el => el.classList.remove('d-none'));
  } else {
    mgrOnly.forEach(el => el.classList.add('d-none'));
    staffOnly.forEach(el => el.classList.remove('d-none'));
  }
}

function setupActiveLinks() {
  const currentPath = window.location.pathname.split("/").pop() || 'dashboard.html';
  
  // Sidebar
  document.querySelectorAll('#sidebar-wrapper .list-group-item').forEach(el => {
    const href = el.getAttribute('href');
    if (href && href.split("/").pop() === currentPath) el.classList.add('active');
  });

  // Top nav
  document.querySelectorAll('#top-navbar .top-nav-link').forEach(el => {
    const page = el.getAttribute('data-page');
    if (page && (page === currentPath || page.split("/").pop() === currentPath)) el.classList.add('active');
  });
}
