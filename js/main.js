/**
 * Main Application File
 * Shared utilities and initialization for all pages
 */

// API Base URL Configuration
const API_BASE_URL = 'http://localhost:3000/api'; // TODO: Update with actual backend URL

/**
 * Initialize application on page load
 */
function initializeApp() {
  // Load components
  loadNavbar();

  // Set up global event listeners
  setupGlobalListeners();

  // Initialize theme
  initializeTheme();

  // Check authentication status
  verifyUserSession();
}

/**
 * Initialize theme from localStorage or system preference
 */
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme');

  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
    if (!localStorage.getItem('theme')) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/**
 * Verify user session is still valid
 */
async function verifyUserSession() {
  const token = localStorage.getItem('authToken');
  if (!token) return;

  try {
    const isValid = await verifyToken();
    if (!isValid) {
      // Token expired, try to refresh
      try {
        await refreshToken();
      } catch {
        logout();
      }
    }
  } catch (error) {
    console.error('Session verification error:', error);
  }
}

/**
 * Set up global event listeners
 */
function setupGlobalListeners() {
  // Handle network offline/online
  window.addEventListener('offline', () => {
    showToast('You are offline. Some features may not work.', 'warning');
  });

  window.addEventListener('online', () => {
    showToast('You are back online!', 'success');
  });

  // Handle page visibility
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // Page came back to focus - refresh critical data
      console.log('Page visible again');
    }
  });

  // Handle unload
  window.addEventListener('beforeunload', (e) => {
    // Could save unsaved changes here
  });
}

/**
 * Validate form field
 * @param {HTMLInputElement} field - Form field to validate
 * @param {string} type - Validation type (email, password, required, etc.)
 * @returns {boolean} Validation result
 */
function validateField(field, type = 'required') {
  const value = field.value.trim();

  switch (type) {
    case 'required':
      return value.length > 0;

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);

    case 'password':
      return value.length >= 6;

    case 'number':
      return !isNaN(value) && value.length > 0;

    case 'phone':
      const phoneRegex = /^\+?[\d\s-()]+$/;
      return phoneRegex.test(value) && value.length >= 10;

    case 'date':
      return new Date(value) instanceof Date && !isNaN(new Date(value));

    default:
      return true;
  }
}

/**
 * Show field error message
 * @param {HTMLInputElement} field - Form field
 * @param {string} message - Error message
 */
function showFieldError(field, message) {
  field.classList.add('error');

  let errorEl = field.nextElementSibling;
  if (!errorEl || !errorEl.classList.contains('error-message')) {
    errorEl = document.createElement('span');
    errorEl.className = 'error-message';
    field.after(errorEl);
  }
  errorEl.textContent = message;
}

/**
 * Clear field error
 * @param {HTMLInputElement} field - Form field
 */
function clearFieldError(field) {
  field.classList.remove('error');
  const errorEl = field.nextElementSibling;
  if (errorEl && errorEl.classList.contains('error-message')) {
    errorEl.textContent = '';
  }
}

/**
 * Format date for display (short format)
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDateShort(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date for display (long format)
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDateLong(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format date and time
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date and time
 */
function formatDateTime(date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format time elapsed (relative time)
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
function formatTimeAgo(date) {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';

  return formatDateShort(date);
}

/**
 * Format number as currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (usd, eur, etc.)
 * @returns {string} Formatted currency
 */
function formatCurrency(amount, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

/**
 * Format number with thousand separators
 * @param {number} num - Number to format
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted number
 */
function formatNumber(num, decimals = 0) {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Get initials from name
 * @param {string} name - Person's name
 * @returns {string} Initials
 */
function getInitials(name) {
  return name
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase();
}

/**
 * Generate random color for avatar
 * @param {string} seed - Seed for consistent color
 * @returns {string} Hex color
 */
function getAvatarColor(seed) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B4D9', '#ABEBC6', '#FAD7A0', '#D5A6BD',
  ];

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
    return true;
  } catch (error) {
    console.error('Copy to clipboard error:', error);
    return false;
  }
}

/**
 * Download file
 * @param {string} content - File content
 * @param {string} fileName - File name
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, fileName, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Parse query parameters from URL
 * @returns {Object} Query parameters
 */
function getQueryParams() {
  const params = {};
  const searchParams = new URLSearchParams(window.location.search);
  for (const [key, value] of searchParams) {
    params[key] = value;
  }
  return params;
}

/**
 * Add query parameter to URL
 * @param {string} key - Parameter key
 * @param {string} value - Parameter value
 */
function addQueryParam(key, value) {
  const url = new URL(window.location);
  url.searchParams.set(key, value);
  window.history.pushState({}, '', url);
}

/**
 * Remove query parameter from URL
 * @param {string} key - Parameter key
 */
function removeQueryParam(key) {
  const url = new URL(window.location);
  url.searchParams.delete(key);
  window.history.pushState({}, '', url);
}

/**
 * Deep clone object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (obj instanceof Object) {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

/**
 * Merge objects
 * @param {...Object} objects - Objects to merge
 * @returns {Object} Merged object
 */
function mergeObjects(...objects) {
  return objects.reduce((acc, obj) => ({ ...acc, ...obj }), {});
}

/**
 * Sort array of objects by property
 * @param {Array} array - Array to sort
 * @param {string} property - Property to sort by
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} Sorted array
 */
function sortByProperty(array, property, order = 'asc') {
  return [...array].sort((a, b) => {
    const aVal = a[property];
    const bVal = b[property];

    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Group array by property
 * @param {Array} array - Array to group
 * @param {string} property - Property to group by
 * @returns {Object} Grouped object
 */
function groupByProperty(array, property) {
  return array.reduce((acc, item) => {
    const key = item[property];
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeApp,
    validateField,
    showFieldError,
    clearFieldError,
    formatDateShort,
    formatDateLong,
    formatDateTime,
    formatTimeAgo,
    formatCurrency,
    formatNumber,
    getInitials,
    getAvatarColor,
    copyToClipboard,
    downloadFile,
    getQueryParams,
    addQueryParam,
    removeQueryParam,
    deepClone,
    mergeObjects,
    sortByProperty,
    groupByProperty,
  };
}