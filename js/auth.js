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

const SESSION_KEYS = {
  token: 'authToken',
  user: 'userData',
  theme: 'theme',
};

function shouldUseBackendAuth() {
  // Local static runs should use Firestore-backed auth flow.
  return !/localhost|127\.0\.0\.1/i.test(window.location.hostname);
}

function _getStore() {
  return window.sessionStorage;
}

function _getDb() {
  if (typeof db === 'undefined') {
    throw new Error('Firestore is not initialized. Make sure firebase scripts are loaded first.');
  }
  return db;
}

async function _findUserByEmail(email) {
  const emailLower = String(email || '').trim().toLowerCase();
  if (!emailLower) return null;

  const dbRef = _getDb();
  const byLower = await dbRef.collection('users')
    .where('emailLower', '==', emailLower)
    .limit(1)
    .get();

  if (!byLower.empty) {
    const doc = byLower.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  const byEmail = await dbRef.collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!byEmail.empty) {
    const doc = byEmail.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  return null;
}


// ── Auth Guard ──────────────────────────────────────────────────────────────
/**
 * Protect a page. Call inside DOMContentLoaded on every protected page.
 * @param {string|null} requiredRole - 'manager', 'staff', or null (any auth)
 * @returns {boolean} true if access allowed
 */
function requireAuth(requiredRole = null) {
  const token = _getStore().getItem(SESSION_KEYS.token);
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
  if (!shouldUseBackendAuth()) {
    return mockLogin(email, password, rememberMe);
  }

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

async function mockLogin(email, password, rememberMe = false) {
  if (!email || !password || password.length < 6) {
    throw new Error('Invalid credentials — password must be at least 6 characters.');
  }

  const existingUser = await _findUserByEmail(email);

  if (existingUser && existingUser.password && existingUser.password !== password) {
    throw new Error('Invalid credentials. Please check your email and password.');
  }

  // Default role detection if not a registered user
  const isManagerEmail = email.toLowerCase().includes('manager') || email === 'manager@kpipro.com';

  const userData = existingUser || {
    id: '',
    name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    email: email,
    emailLower: email.toLowerCase(),
    role: isManagerEmail ? 'manager' : 'staff',
    department: 'General',
    bio: '',
    joinedAt: new Date().toISOString(),
    password,
  };

  if (!existingUser) {
    const docRef = await _getDb().collection('users').add(userData);
    userData.id = docRef.id;
  }

  _storeSession('mock-token-' + Date.now(), userData, rememberMe);
  return { token: _getStore().getItem(SESSION_KEYS.token), user: userData };
}


// ── Register ────────────────────────────────────────────────────────────────
/**
 * @param {Object} formData - { fullName, email, role, department, password }
 * @returns {Promise<Object>} { token, user }
 */
async function register(formData) {
  if (!shouldUseBackendAuth()) {
    return mockRegister(formData);
  }

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

async function mockRegister(formData) {
  const existingUser = await _findUserByEmail(formData.email);
  if (existingUser) {
    throw new Error('An account with this email already exists.');
  }

  const userData = {
    id: '',
    name: formData.fullName,
    email: formData.email,
    emailLower: formData.email.toLowerCase(),
    role: formData.role || 'staff',
    department: formData.department || 'General',
    bio: '',
    joinedAt: new Date().toISOString(),
    password: formData.password,
  };

  const docRef = await _getDb().collection('users').add(userData);
  userData.id = docRef.id;
  
  // Do NOT automatically log the user in. Force them to use the login page.
  return { success: true, user: userData };
}

// ── Logout ──────────────────────────────────────────────────────────────────
async function logout() {
  try {
    const token = _getStore().getItem(SESSION_KEYS.token);
    if (token) {
      await fetch(API_ENDPOINTS.logout, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
    }
  } catch (e) { /* ignore network errors on logout */ }

  _getStore().removeItem(SESSION_KEYS.token);
  _getStore().removeItem(SESSION_KEYS.user);
  window.location.href = LOGIN_PAGE;
}

// ── Session Helpers ─────────────────────────────────────────────────────────
function _storeSession(token, user, rememberMe = false) {
  const store = _getStore();
  store.setItem(SESSION_KEYS.token, token);
  store.setItem(SESSION_KEYS.user, JSON.stringify(user));
}

function isAuthenticated() {
  return !!_getStore().getItem(SESSION_KEYS.token) && !!getCurrentUser();
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
    const token = _getStore().getItem(SESSION_KEYS.token);
    const response = await fetch(API_ENDPOINTS.updateProfile, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Update failed');
    const data = await response.json();
    _getStore().setItem(SESSION_KEYS.user, JSON.stringify(data.user));
    return data.user;
  } catch (err) {
    const user = getCurrentUser();
    if (!user?.id) throw new Error('User session is missing. Please login again.');

    const updated = { ...user, ...updates };

    await _getDb().collection('users').doc(user.id).set({
      ...updated,
      emailLower: String(updated.email || '').toLowerCase(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    _getStore().setItem(SESSION_KEYS.user, JSON.stringify(updated));
    return updated;
  }
}

async function changePassword(currentPassword, newPassword) {
  try {
    const token = _getStore().getItem(SESSION_KEYS.token);
    const response = await fetch(API_ENDPOINTS.changePassword, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return response.ok;
  } catch {
    const user = getCurrentUser();
    if (!user?.id) return false;

    const snap = await _getDb().collection('users').doc(user.id).get();
    if (!snap.exists) return false;
    const data = snap.data();
    if (data.password && data.password !== currentPassword) return false;

    await _getDb().collection('users').doc(user.id).set({
      password: newPassword,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  }
}

async function deleteAccount(password) {
  try {
    const token = _getStore().getItem(SESSION_KEYS.token);
    const response = await fetch(API_ENDPOINTS.deleteAccount, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (response.ok) { await _clearAllData(); return true; }
    return false;
  } catch {
    await _clearAllData();
    return true;
  }
}

async function _clearAllData() {
  const user = getCurrentUser();
  const dbRef = _getDb();

  if (user?.id) {
    await dbRef.collection('users').doc(user.id).delete();
  }

  if (user?.id || user?.email) {
    const assignedById = user?.id
      ? await dbRef.collection('kpi').where('assignedTo', '==', user.id).get()
      : { docs: [] };
    const assignedByEmail = user?.email
      ? await dbRef.collection('kpi').where('assignedTo', '==', user.email).get()
      : { docs: [] };

    const toDelete = [...assignedById.docs, ...assignedByEmail.docs]
      .reduce((acc, doc) => {
        if (!acc.find(d => d.id === doc.id)) acc.push(doc);
        return acc;
      }, []);

    await Promise.all(toDelete.map(doc => dbRef.collection('kpi').doc(doc.id).delete()));
  }

  _getStore().clear();
}

// ── Authenticated Fetch ─────────────────────────────────────────────────────
async function authenticatedFetch(url, options = {}) {
  const token = _getStore().getItem(SESSION_KEYS.token);
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