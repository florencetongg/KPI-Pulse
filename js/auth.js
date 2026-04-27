/**
 * KPI Pro — Authentication Module
 * Handles login, registration, logout, session management
 * Role-based routing: manager → manager-kpi.html | staff → dashboard.html
 */

// ── API Configuration ───────────────────────────────────────────────────────
const API_BASE_URL = 'http://localhost:3000/api'; // TODO: update with real backend
const API_ENDPOINTS = {
  login: `${API_BASE_URL}/auth/login`,
  register: `${API_BASE_URL}/auth/register`,
  logout: `${API_BASE_URL}/auth/logout`,
  verifyToken: `${API_BASE_URL}/auth/verify`,
  refreshToken: `${API_BASE_URL}/auth/refresh`,
  profile: `${API_BASE_URL}/user/profile`,
  updateProfile: `${API_BASE_URL}/user/profile/update`,
  changePassword: `${API_BASE_URL}/user/password/change`,
  deleteAccount: `${API_BASE_URL}/user/profile/delete`,
};

// ── Routing Constants ───────────────────────────────────────────────────────
const ROLE_REDIRECTS = {
  manager: 'manager-kpi.html',
  staff: 'dashboard.html',
};
const LOGIN_PAGE = 'login.html';


// ── Auth Guard ──────────────────────────────────────────────────────────────
/**
 * Protect a page. Call inside DOMContentLoaded on every protected page.
 * @param {string|null} requiredRole - 'manager', 'staff', or null (any auth)
 * @returns {boolean} true if access allowed
 */
function requireAuth(requiredRole = null) {
  const token = localStorage.getItem('authToken');
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

// ── Login ───────────────────────────────────────────────────────────────────
/**
 * @param {string} email
 * @param {string} password
 * @param {boolean} rememberMe
 * @returns {Promise<Object>} { token, user }
 */
async function login(email, password, rememberMe = false) {
  try {
    const response = await fetch(API_ENDPOINTS.login, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error('Server error: ' + response.statusText);
    const data = await response.json();
    _storeSession(data.token, data.user, rememberMe);
    return data;
  } catch (err) {
    console.warn('Backend unavailable, using mock login:', err.message);
    return mockLogin(email, password, rememberMe);
  }
}

function mockLogin(email, password, rememberMe = false) {
  if (!email || !password || password.length < 6) {
    throw new Error('Invalid credentials — password must be at least 6 characters.');
  }

  // Try to find a registered user first
  const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
  const existingUser = registeredUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

  // Default role detection if not a registered user
  const isManagerEmail = email.toLowerCase().includes('manager') || email === 'manager@kpipro.com';

  const userData = existingUser || {
    id: 'u_' + Math.random().toString(36).substr(2, 9),
    name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    email: email,
    role: isManagerEmail ? 'manager' : 'staff',
    department: 'General',
    bio: '',
    joinedAt: new Date().toISOString(),
  };

  // Critical fix: ensure existing user role is respected
  if (existingUser) userData.role = existingUser.role;


  _storeSession('mock-token-' + Date.now(), userData, rememberMe);
  return { token: localStorage.getItem('authToken'), user: userData };
}


// ── Register ────────────────────────────────────────────────────────────────
/**
 * @param {Object} formData - { fullName, email, role, department, password }
 * @returns {Promise<Object>} { token, user }
 */
async function register(formData) {
  try {
    const response = await fetch(API_ENDPOINTS.register, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (!response.ok) throw new Error('Registration failed: ' + response.statusText);
    const data = await response.json();
    _storeSession(data.token, data.user);
    return data;
  } catch (err) {
    console.warn('Backend unavailable, using mock register:', err.message);
    return mockRegister(formData);
  }
}

function mockRegister(formData) {
  // Check duplicate email
  const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
  if (registeredUsers.find(u => u.email.toLowerCase() === formData.email.toLowerCase())) {
    throw new Error('An account with this email already exists.');
  }

  const userData = {
    id: 'u_' + Math.random().toString(36).substr(2, 9),
    name: formData.fullName,
    email: formData.email,
    role: formData.role || 'staff',
    department: formData.department || 'General',
    bio: '',
    joinedAt: new Date().toISOString(),
  };

  registeredUsers.push(userData);
  localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
  
  // Do NOT automatically log the user in. Force them to use the login page.
  return { success: true, user: userData };
}

// ── Logout ──────────────────────────────────────────────────────────────────
async function logout() {
  try {
    const token = localStorage.getItem('authToken');
    if (token) {
      await fetch(API_ENDPOINTS.logout, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    }
  } catch (e) { /* ignore network errors on logout */ }

  localStorage.removeItem('authToken');
  localStorage.removeItem('userData');
  localStorage.removeItem('rememberMe');
  window.location.href = LOGIN_PAGE;
}

// ── Session Helpers ─────────────────────────────────────────────────────────
function _storeSession(token, user, rememberMe = false) {
  localStorage.setItem('authToken', token);
  localStorage.setItem('userData', JSON.stringify(user));
  if (rememberMe) localStorage.setItem('rememberMe', 'true');
}

function isAuthenticated() {
  return !!localStorage.getItem('authToken') && !!getCurrentUser();
}

function getCurrentUser() {
  const raw = localStorage.getItem('userData');
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
  const target = ROLE_REDIRECTS[user.role] || LOGIN_PAGE;
  _safeRedirect(target);
}

/**
 * Intelligent redirect that handles being inside /pages or at root
 * @param {string} targetPage - the filename (e.g. 'dashboard.html')
 */
function _safeRedirect(targetPage) {
  const isAtRoot = window.location.pathname.split('/').pop() === 'index.html' ||
    window.location.pathname.endsWith('/');
  const prefix = isAtRoot ? 'pages/' : '';
  window.location.href = prefix + targetPage;
}


// ── Profile Update ──────────────────────────────────────────────────────────
async function updateProfile(updates) {
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(API_ENDPOINTS.updateProfile, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Update failed');
    const data = await response.json();
    localStorage.setItem('userData', JSON.stringify(data.user));
    return data.user;
  } catch (err) {
    // Mock: merge updates into localStorage
    const user = getCurrentUser();
    const updated = { ...user, ...updates };
    localStorage.setItem('userData', JSON.stringify(updated));
    // Sync into registeredUsers list
    const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
    const idx = registeredUsers.findIndex(u => u.email === updated.email);
    if (idx !== -1) { registeredUsers[idx] = updated; localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers)); }
    return updated;
  }
}

async function changePassword(currentPassword, newPassword) {
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(API_ENDPOINTS.changePassword, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return response.ok;
  } catch { return true; } // Mock success
}

async function deleteAccount(password) {
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(API_ENDPOINTS.deleteAccount, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (response.ok) { _clearAllData(); return true; }
    return false;
  } catch { _clearAllData(); return true; } // Mock success
}

function _clearAllData() {
  const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
  const user = getCurrentUser();
  const filtered = registeredUsers.filter(u => u.email !== user?.email);
  localStorage.clear();
  localStorage.setItem('registeredUsers', JSON.stringify(filtered));
}

// ── Authenticated Fetch ─────────────────────────────────────────────────────
async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem('authToken');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ── Dark Mode Initialiser (call once per page) ──────────────────────────────
function initDarkMode(toggleBtnId = 'darkModeToggle') {
  const setTheme = (theme) => {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  setTheme(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light');

  const btn = document.getElementById(toggleBtnId);
  if (btn) {
    btn.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('dark') ? 'light' : 'dark';
      setTheme(nextTheme);
    });
  }
}

// ── Populate Navbar UI ──────────────────────────────────────────────────────
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

// ── String Helper ───────────────────────────────────────────────────────────
String.prototype.toTitleCase = function () {
  return this.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

// ── Module Export ────────────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    login, register, logout, requireAuth, isAuthenticated,
    getCurrentUser, hasRole, updateProfile, changePassword,
    deleteAccount, authenticatedFetch, redirectToModuleHome,
    initDarkMode, populateNavUser,
  };
}