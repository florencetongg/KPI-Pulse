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

  // Load sidebar and highlight active link
  loadComponent("sidebar-container", "../components/sidebar.html", function() {
    const sidebarItems = document.querySelectorAll('#sidebar-wrapper .list-group-item');
    let currentPage = window.location.pathname.split("/").pop();
    if (currentPage === '') currentPage = 'dashboard.html'; // default page

    sidebarItems.forEach(item => {
      if (item.getAttribute('href') === currentPage) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  });

  // Load navbar normally (no callback needed)
  loadComponent("navbar-container", "../components/navbar.html");

});

function generateBreadcrumb() {
  const container = document.getElementById('breadcrumb-container');
  if (!container) return;

  const path = window.location.pathname.split("/").pop() || 'dashboard.html';
  
  // Define breadcrumb labels for each page
  const labels = {
    'dashboard.html': 'Dashboard',
    'kpi-form.html': 'KPI Form',
    'kpi-verify.html': 'KPI Verify',
    'manager-kpi.html': 'Manager KPI',
    'staff-kpi.html': 'Staff KPI',
    'profile.html': 'Profile',
    'settings.html': 'Settings',
    'login.html': 'Login'
  };

  // For simple 2-level breadcrumb: Home / Page
  container.innerHTML = `
    <nav aria-label="breadcrumb">
      <ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="dashboard.html">Home</a></li>
        <li class="breadcrumb-item active" aria-current="page">${labels[path] || 'Page'}</li>
      </ol>
    </nav>
  `;
}

// Run after DOM loads
document.addEventListener("DOMContentLoaded", generateBreadcrumb);