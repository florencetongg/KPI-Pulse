/**
 * Component Loader
 * Dynamically loads reusable components (navbar, sidebar, etc.)
 */

/**
 * Load navbar component
 * Fetches and injects navbar HTML
 */
async function loadNavbar() {
    try {
        const response = await fetch('/components/navbar.html');
        if (!response.ok) {
            throw new Error('Failed to load navbar');
        }

        const html = await response.text();

        // Create container if it doesn't exist
        let navContainer = document.querySelector('nav');
        if (!navContainer) {
            navContainer = document.createElement('nav');
            document.body.insertBefore(navContainer, document.body.firstChild);
        }

        navContainer.innerHTML = html;

        // Initialize navbar functionality
        initializeNavbar();
    } catch (error) {
        console.error('Navbar loading error:', error);
    }
}

/**
 * Initialize navbar with interactivity
 */
function initializeNavbar() {
    // User profile initialization
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const user = getCurrentUser();

    if (user) {
        if (userName) userName.textContent = user.name;
        if (userAvatar) userAvatar.textContent = user.name.charAt(0).toUpperCase();
    }

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        // Check saved theme preference
        const savedTheme = localStorage.getItem('theme') || 'light';
        applyTheme(savedTheme);

        themeToggle.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
        });
    }

    // Set active nav link
    setActiveNavLink();

    // Mobile menu toggle (if applicable)
    const navMenu = document.querySelector('.nav-menu');
    const navToggle = document.querySelector('.nav-toggle');

    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navMenu?.classList.toggle('active');
        });
    }

    // Close menu on link click
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu?.classList.remove('active');
        });
    });
}

/**
 * Apply theme to document
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const isDark = theme === 'dark';

    // Keep both selectors in sync because some pages/styles rely on .dark,
    // while others rely on [data-theme].
    html.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.body.classList.toggle('dark', isDark);
    if (themeToggle) themeToggle.textContent = isDark ? '☀️' : '🌙';

    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

/**
 * Set active navigation link based on current page
 */
function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.classList.remove('active');

        // Check if link matches current path
        const href = link.getAttribute('href');
        if (currentPath.endsWith(href) || currentPath.includes(href)) {
            link.classList.add('active');
        }
    });
}

/**
 * Load sidebar component for dashboard pages
 * @param {Array} items - Sidebar menu items
 */
async function loadSidebar(items) {
    try {
        const sidebarContainer = document.querySelector('.sidebar');
        if (!sidebarContainer) return;

        let html = '<nav class="sidebar">';
        items.forEach(item => {
            const activeClass = item.active ? 'active' : '';
            html += `<a href="${item.link}" class="sidebar-link ${activeClass}">${item.label}</a>`;
        });
        html += '</nav>';

        sidebarContainer.innerHTML = html;

        // Add event listeners
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', function (e) {
                // Update active state
                document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            });
        });
    } catch (error) {
        console.error('Sidebar loading error:', error);
    }
}

/**
 * Initialize page-level functionality
 * Call this on every page after DOM is loaded
 */
function initializePage() {
    // Load navbar if not already loaded
    if (!document.querySelector('nav')) {
        loadNavbar();
    } else {
        initializeNavbar();
    }

    // Check authentication
    checkAuthentication();

    // Set up global error handling
    setupErrorHandling();
}

/**
 * Check if user is authenticated
 * Redirect to login if not
 */
function checkAuthentication() {
    const publicPages = ['index.html', 'login.html', 'register.html', 'reset-password.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    const isPublic = publicPages.includes(currentPage);
    const isAuthenticated = !!localStorage.getItem('authToken');

    if (!isPublic && !isAuthenticated) {
        window.location.href = '/login.html';
    }

    if ((currentPage === 'login.html' || currentPage === 'register.html') && isAuthenticated) {
        // Redirect to appropriate dashboard
        const user = getCurrentUser();
        const redirectUrl = user?.role === 'manager' ? '/manager-kpi.html' : '/dashboard.html';
        window.location.href = redirectUrl;
    }
}

/**
 * Global error handler
 */
function setupErrorHandling() {
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        // Could send to error tracking service here
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        // Could send to error tracking service here
    });
}

/**
 * Show loading indicator
 */
function showLoading() {
    let loader = document.getElementById('globalLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
                  background: rgba(0,0,0,0.7); display: flex; align-items: center; 
                  justify-content: center; z-index: 9999;">
        <div style="width: 50px; height: 50px; border: 5px solid #e2e8f0; 
                    border-top: 5px solid #4f46e5; border-radius: 50%; 
                    animation: spin 1s linear infinite;"></div>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
        document.body.appendChild(loader);
    }
    loader.style.display = 'flex';
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.style.display = 'none';
    }
}

/**
 * Show toast notification
 * @param {string} message - Notification message
 * @param {string} type - 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toastContainer';
        toastContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    const bgColor = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
    }[type] || '#6b7280';

    toast.style.cssText = `
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    animation: slideIn 0.3s ease-out;
  `;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Format API response for UI display
 * @param {Object} response - API response
 * @returns {Array} Formatted list of items
 */
function formatApiResponse(response) {
    if (Array.isArray(response)) {
        return response;
    }
    if (response.data) {
        return Array.isArray(response.data) ? response.data : [response.data];
    }
    if (response.items) {
        return response.items;
    }
    return [];
}

/**
 * Debounce function for search/filter
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Throttle function for scroll/resize events
 * @param {Function} func - Function to throttle
 * @param {number} limit - Limit time in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
} else {
    initializePage();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadNavbar,
        initializeNavbar,
        applyTheme,
        setActiveNavLink,
        loadSidebar,
        initializePage,
        checkAuthentication,
        showLoading,
        hideLoading,
        showToast,
        formatApiResponse,
        debounce,
        throttle,
    };
}