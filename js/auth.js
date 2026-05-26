/**
 * KPI Pulse authentication module.
 * Uses the Express + MongoDB backend only.
 */

const API_BASE_URL = 'http://localhost:3000/api';
const API_ENDPOINTS = {
  login: `${API_BASE_URL}/auth/login`,
  register: `${API_BASE_URL}/auth/register`,
  profile: `${API_BASE_URL}/auth/profile`,
  staffUsers: `${API_BASE_URL}/auth/staff`,
  kpis: `${API_BASE_URL}/kpis`,
};

const ROLE_REDIRECTS = {
  manager: 'manager-kpi.html',
  staff: 'dashboard.html',
};
const LOGIN_PAGE = 'login.html';

const SESSION_KEYS = {
  token: 'authToken',
  user: 'userData',
  theme: 'theme',
};

function _getStore() {
  return window.sessionStorage;
}

function getAuthToken() {
  return _getStore().getItem(SESSION_KEYS.token);
}

async function apiRequest(url, options = {}) {
  const response = await authenticatedFetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

function requireAuth(requiredRole = null) {
  const token = getAuthToken();
  const user = getCurrentUser();

  if (!token || !user) {
    window.location.href = LOGIN_PAGE;
    return false;
  }

  if (requiredRole && user.role !== requiredRole) {
    window.location.href = ROLE_REDIRECTS[user.role] || LOGIN_PAGE;
    return false;
  }

  return true;
}

async function login(email, password, rememberMe = false) {
  const data = await apiRequest(API_ENDPOINTS.login, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  _storeSession(data.token, data.user, rememberMe);
  return data;
}

async function register(formData) {
  const data = await apiRequest(API_ENDPOINTS.register, {
    method: 'POST',
    body: JSON.stringify(formData),
  });

  if (data.token && data.user) {
    _storeSession(data.token, data.user);
  }

  return data;
}

async function logout() {
  _getStore().removeItem(SESSION_KEYS.token);
  _getStore().removeItem(SESSION_KEYS.user);
  window.location.href = LOGIN_PAGE;
}

function _storeSession(token, user, rememberMe = false) {
  const store = _getStore();
  store.setItem(SESSION_KEYS.token, token);
  store.setItem(SESSION_KEYS.user, JSON.stringify(user));
}

function isAuthenticated() {
  return !!getAuthToken() && !!getCurrentUser();
}

function getCurrentUser() {
  const raw = _getStore().getItem(SESSION_KEYS.user);
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function hasRole(role) {
  const user = getCurrentUser();
  return !!(user && user.role === role);
}

function redirectToModuleHome() {
  const user = getCurrentUser();
  if (!user) {
    _safeRedirect(LOGIN_PAGE);
    return;
  }
  _safeRedirect(ROLE_REDIRECTS[user.role] || LOGIN_PAGE);
}

function _safeRedirect(targetPage) {
  const isAtRoot = window.location.pathname.split('/').pop() === 'index.html' ||
    window.location.pathname.endsWith('/');
  const prefix = isAtRoot ? 'pages/' : '';
  window.location.href = prefix + targetPage;
}

async function updateProfile(updates) {
  const data = await apiRequest(API_ENDPOINTS.profile, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

  _getStore().setItem(SESSION_KEYS.user, JSON.stringify(data.user));
  return data.user;
}

async function changePassword(currentPassword, newPassword) {
  await updateProfile({ password: newPassword, currentPassword });
  return true;
}

async function deleteAccount(password) {
  throw new Error('Account deletion is not enabled on the MongoDB backend yet.');
}

async function authenticatedFetch(url, options = {}) {
  const token = getAuthToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function initDarkMode(toggleBtnId = 'darkModeToggle') {
  const setTheme = (theme) => {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    _getStore().setItem(SESSION_KEYS.theme, isDark ? 'dark' : 'light');
  };

  setTheme(_getStore().getItem(SESSION_KEYS.theme) === 'dark' ? 'dark' : 'light');

  const btn = document.getElementById(toggleBtnId);
  if (btn) {
    btn.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }
}

function populateNavUser(user) {
  const initial = (user.name || 'U').charAt(0).toUpperCase();
  ['sidebarAvatar', 'topbarAvatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = initial;
  });
  ['sidebarName', 'topbarName'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = user.name || 'User';
  });
  ['topbarRole', 'sidebarRole'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = user.role || '';
  });
}

String.prototype.toTitleCase = function () {
  return this.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    login, register, logout, requireAuth, isAuthenticated,
    getCurrentUser, hasRole, updateProfile, changePassword,
    deleteAccount, authenticatedFetch, redirectToModuleHome,
    initDarkMode, populateNavUser, apiRequest, API_ENDPOINTS,
  };
}
