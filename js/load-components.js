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