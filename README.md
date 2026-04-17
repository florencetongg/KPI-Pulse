# KPI Pro - Key Performance Indicator Management System

A modern, functional KPI management system built with vanilla HTML, CSS, and JavaScript. Designed for seamless backend integration with support for both managers and staff roles.

## Features

### Authentication & User Management
- ✅ User registration with password strength indicator
- ✅ Login with role-based dashboard routing
- ✅ User profile management (view, edit, change password)
- ✅ Account deletion with confirmation
- ✅ Session management with localStorage
- ✅ Remember me functionality

### Manager Dashboard
- ✅ KPI overview with key metrics
- ✅ Team staff performance summary
- ✅ Create, edit, and delete KPIs
- ✅ Assign KPIs to staff members
- ✅ KPI verification workflow
- ✅ Approve/reject staff submissions
- ✅ Filter and search KPIs by status

### Staff Dashboard
- ✅ Personal KPI overview
- ✅ Track KPI progress with visual indicators
- ✅ Update progress with notes
- ✅ Upload evidence/supporting files
- ✅ View approval status from managers
- ✅ Progress history timeline
- ✅ Search and filter assigned KPIs

### Design System
- ✅ Unified color palette (Navy, Indigo, Green, Red)
- ✅ Responsive layout (Desktop, Tablet, Mobile)
- ✅ Dark mode support
- ✅ Consistent typography (Sora & DM Sans)
- ✅ Reusable component library
- ✅ Smooth animations and transitions

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Design**: CSS Grid, Flexbox, CSS Variables
- **State Management**: localStorage for client-side persistence
- **Package Manager**: None (framework-free, no dependencies)
- **API Ready**: All endpoints prepared for backend integration

## Project Structure

```
kpi-pulse/
├── index.html                 # Landing page
├── README.md                  # This file
├── INTEGRATION_GUIDE.md       # Backend integration guide
├── components/
│   ├── navbar.html           # Navigation component
│   └── sidebar.html          # Sidebar component
├── pages/
│   ├── login.html            # Login page
│   ├── register.html         # Registration page
│   ├── dashboard.html        # Staff dashboard
│   ├── manager-kpi.html      # Manager dashboard
│   ├── kpi-verify.html       # Verification workflow
│   ├── staff-kpi.html        # KPI details/update
│   ├── kpi-progress.html     # Progress tracking
│   ├── profile.html          # User profile
│   └── kpi-form.html         # KPI creation/editing
├── css/
│   └── style.css             # Unified design system (1000+ lines)
└── js/
    ├── main.js               # Utility functions
    ├── auth.js               # Authentication & session
    ├── kpi-manager.js        # Manager operations
    ├── kpi-staff.js          # Staff operations
    └── load-components.js    # Component loading & theme
```

## Getting Started

### Installation

No build process required! Just clone and serve with a local server:

```bash
# Using Python 3
python -m http.server 5500

# Or using Node.js
npx http-server -p 5500

# Or using Ruby
ruby -run -ehttpd . -p5500
```

Then open `http://localhost:5500` in your browser.

### Quick Start

1. **Register** a new account at `/register.html`
   - Select your role (Staff or Manager)
   - Choose your department
   - Set a password

2. **Login** at `/login.html`
   - Authenticate with your email and password
   - Role determines dashboard destination

3. **For Staff**:
   - View assigned KPIs on dashboard
   - Click "Update Progress" to log progress
   - Upload supporting files and notes

4. **For Managers**:
   - Create KPIs and assign to staff
   - Review pending submissions
   - Approve or reject progress updates

## Component Documentation

### Navbar Component (`components/navbar.html`)

Included on every page. Features:
- Logo and branding
- Navigation links (context-aware)
- User profile dropdown
- Theme toggle (dark/light)
- Active state indicator

### Forms

All forms include:
- Client-side validation
- Error message display
- Visual feedback
- Password strength indicator (registration)
- File upload handling

### Modal Dialogs

Modal system for forms and confirmations:
- Backdrop overlay
- Smooth animations
- Focus management
- Keyboard support (Escape to close)

### Tables

Responsive tables with:
- Overflow handling on mobile
- Hover effects
- Status badges
- Action buttons
- Sorting-ready structure

### Cards

Card component system:
- Header, body, footer sections
- Status indicators
- Progress bars
- Avatar support

## CSS Architecture

### Design Tokens

```css
:root {
  /* Colors */
  --primary: #4f46e5;        /* Indigo */
  --navy: #0f172a;           /* Navy */
  --success: #16a34a;        /* Green */
  --danger: #dc2626;         /* Red */
  --warning: #f59e0b;        /* Amber */
  --info: #0891b2;           /* Cyan */

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;
  --spacing-2xl: 32px;

  /* Typography */
  --font-primary: 'Sora', sans-serif;
  --font-secondary: 'DM Sans', sans-serif;

  /* Transitions */
  --transition: all 0.3s ease;
}
```

## JavaScript Modules

### auth.js
Handles authentication and user sessions

### kpi-manager.js
Manager-specific KPI operations

### kpi-staff.js
Staff-specific KPI operations

### main.js
Shared utilities and formatting functions

### load-components.js
Component loading and theme management

## API Integration

The frontend is ready for backend integration. See [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md) for:

- Complete API endpoint specifications
- Data model definitions
- Error handling strategies
- Authentication flow
- File upload handling

### Quick Integration

1. Update API base URL in modules:
```javascript
const API_BASE_URL = 'https://your-backend.com/api';
```

2. Implement CORS on backend
3. Replace mock functions with real API calls
4. Test authentication and workflows

## Responsive Design

Optimized for:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (below 768px)

## Dark Mode

Built-in dark mode support with system preference detection and user toggle.

## Security

- Client-side form validation
- JWT token-based authentication
- Secure password handling
- CORS configuration ready
- Environment variable support (future)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers

## Test Accounts (Mock Data)

- **Staff**: `staff@kpipro.com` / `password123`
- **Manager**: `manager@kpipro.com` / `password123`

## Development

The codebase is organized for easy maintenance:

- **No external dependencies** - Pure vanilla stack
- **Modular JavaScript** - Clear separation of concerns
- **Consistent styling** - CSS variables and reusable classes
- **Well-documented** - JSDoc comments and inline docs

## Troubleshooting

**CORS Error**: Configure backend CORS settings
**Undefined Functions**: Verify all JS files are loaded
**localStorage Issues**: Clear browser cache

## Status

✅ **Frontend Complete** - All pages implemented, design finalized, ready for backend integration

## License

Part of the KPI Pro suite

---

Built with ❤️ for efficient KPI management