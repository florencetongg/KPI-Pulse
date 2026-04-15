/**
 * KPI-Pulse — Authentication Manager
 * ========================================
 */

const AuthManager = {
  // --- Constants ---
  USERS_KEY: 'kpi_pulse_users',
  SESSION_KEY: 'kpi_pulse_session',

  // --- Core Methods ---

  /** Registers a new user */
  register(userData) {
    const users = this._getAllUsers();

    // Check if email already exists
    if (users.find(u => u.email === userData.email)) {
      return { success: false, message: 'Email already registered.' };
    }

    // Add unique ID and defaults
    const newUser = {
      id: 'U' + Date.now(),
      avatar: userData.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
      ...userData,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    return { success: true, user: newUser };
  },

  /** Log in a user and set session */
  login(email, password) {
    const users = this._getAllUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      return { success: false, message: 'Invalid email or password.' };
    }

    // Create a copy without password for session
    const sessionUser = { ...user };
    delete sessionUser.password;

    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionUser));
    return { success: true, user: sessionUser };
  },

  /** Log out and clear session */
  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = '/pages/login.html';
  },

  /** Get current logged in user */
  getCurrentUser() {
    const session = sessionStorage.getItem(this.SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },

  /** Check if user is authenticated, redirect to login if not */
  checkAuth() {
    const user = this.getCurrentUser();
    const isLoginPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html');

    if (!user && !isLoginPage) {
      window.location.href = '/pages/login.html';
      return false;
    }

    if (user && isLoginPage) {
      if (user.role === 'manager') {
        window.location.href = '/pages/manager-kpi.html';
      } else {
        window.location.href = '/pages/dashboard.html';
      }
      return true;
    }

    return !!user;
  },

  // --- Helpers ---
  _getAllUsers() {
    const data = localStorage.getItem(this.USERS_KEY);
    return data ? JSON.parse(data) : [];
  },

  getStaffMembers() {
    return this._getAllUsers().filter(u => u.role === 'staff');
  }
};

// Auto-run auth check on file load
AuthManager.checkAuth();
