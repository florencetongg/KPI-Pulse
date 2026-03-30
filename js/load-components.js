function loadComponent(id, filePath, callback = null) {
  fetch(filePath)
    .then(response => {
      if (!response.ok) {
        throw new Error("Component not found: " + filePath);
      }
      return response.text();
    })
    .then(data => {
      document.getElementById(id).innerHTML = data;

      // Run callback after component loads
      if (callback) callback();
    })
    .catch(error => console.error(error));
}

document.addEventListener("DOMContentLoaded", function () {

  function loadComponent(id, filePath) {
    fetch(filePath)
      .then(response => {
        if (!response.ok) {
          throw new Error("Component not found: " + filePath);
        }
        return response.text();
      })
      .then(data => {
        const element = document.getElementById(id);

        if (element) {
          element.innerHTML = data;
        } else {
          console.error("Element not found:", id);
        }
      })
      .catch(error => console.error(error));
  }

  loadComponent("sidebar-container", "../components/sidebar.html");
  loadComponent("navbar-container", "../components/navbar.html");

});