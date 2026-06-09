<div align="center">

# KPI-Pro by WIF2003 Occ2 Group 11

**Role-based KPI management for managers and staff**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![JWT](https://img.shields.io/badge/Auth-JWT-6366F1?style=for-the-badge)](https://jwt.io/)

*Managers assign KPIs · Staff submit progress · Audit trail built in*

[Quick Start](#quick-start) · [Demo Accounts](#demo-accounts) · [Run Locally](#how-to-run) · [API Docs](#api-reference)

</div>

---

## Table of Contents

- [About](#about)
- [Demo Accounts](#demo-accounts)
- [Quick Start](#quick-start)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [How to Run](#how-to-run)
- [Frontend Pages](#frontend-pages)
- [KPI Lifecycle](#kpi-lifecycle)
- [API Reference](#api-reference)
- [Tests and Scripts](#tests-and-scripts)
- [Troubleshooting](#troubleshooting)

---

## About

**KPI Pulse** (branded **KPI Pro** in the UI) is a performance management platform where:

| Role | What they do |
| --- | --- |
| **Manager** | Create KPIs, assign staff, review submissions, track team progress |
| **Staff** | View assigned KPIs, update progress, upload evidence, track approval status |

Built with **Express + MongoDB** on the backend and **HTML / CSS / JavaScript** on the frontend.

---

## Demo Accounts

Use these credentials to log in at **[Login](http://localhost:3000/pages/login.html)** after starting the backend.

### Manager

| | |
| --- | --- |
| **Email** | `alex.manager@kpipro.com` |
| **Password** | `Alex123@` |
| **Dashboard** | [manager-kpi.html](http://localhost:3000/pages/manager-kpi.html) |

### Staff

| Name | Email | Password |
| --- | --- | --- |
| John Doe | `john.doe@kpipro.com` | `John123@` |
| Jane Smith | `jane.smith@kpipro.com` | `Jane123@` |
| Robert Johnson | `robert.johnson@kpipro.com` | `Robert123@` |

> Staff land on **[dashboard.html](http://localhost:3000/pages/dashboard.html)** after login.

<details>
<summary><strong>Try the full workflow</strong></summary>

1. Log in as **Alex** (manager) → create or review KPIs assigned to John, Jane, or Robert
2. Log out → log in as **John**, **Jane**, or **Robert** → submit progress and evidence
3. Log back in as **Alex** → approve or reject submissions on the verify screen

</details>

---

## Quick Start

```bash
# 1. Clone and enter the project
cd KPI-Pulse

# 2. Backend setup
cd backend
npm install
# Create backend/.env with MONGO_URI and JWT_SECRET (see below)

# 3. Start server (API + frontend on one port)
npm start
```

Then open **http://localhost:3000/pages/login.html** and sign in with a [demo account](#demo-accounts).

---

## Features

<details open>
<summary><strong>Manager</strong></summary>

- Create, edit, and soft-delete KPIs for staff in the same department
- Review submissions — approve or reject with feedback
- KPI history feed and per-KPI audit trail
- Approved cycle records and merged history
- List active staff for assignment

</details>

<details open>
<summary><strong>Staff</strong></summary>

- Dashboard with **weighted progress** summary
- Update progress, current value, and evidence
- Status tracking: `pending` → `in-progress` → `submitted` → `approved` / `rejected`
- Filterable KPI list and cycle history

</details>

<details>
<summary><strong>Platform</strong></summary>

- JWT login with role-based access (`manager` / `staff`)
- bcrypt password hashing
- Immutable KPI audit log
- Evidence uploads (PDF, images, Office) — max 5 MB
- Light / dark theme
- Optional password reset via Gmail SMTP

</details>

---

## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript, Bootstrap 5 |
| Backend | Node.js, Express 4 |
| Database | MongoDB + Mongoose 8 |
| Auth | JWT + bcrypt |
| Uploads | Multer → `backend/uploads/evidence/` |
| Tests | Jest |

---

## Project Structure

<details>
<summary>Click to expand folder tree</summary>

```text
KPI-Pulse/
├── backend/
│   ├── controllers/       # Auth, KPI, evidence handlers
│   ├── middleware/        # JWT, manager guard, multer
│   ├── models/            # user, kpi, kpiHistory, kpiRecord, evidence
│   ├── routes/
│   ├── scripts/           # DB diagnostic scripts
│   ├── tests/             # Jest unit tests
│   ├── uploads/evidence/
│   ├── utils/
│   ├── db.js
│   ├── server.js
│   └── DATABASE_SCHEMA.md
├── components/            # navbar, sidebar HTML fragments
├── css/style.css
├── js/
│   ├── auth.js            # Session & API helpers
│   ├── main.js            # Theme, global init
│   ├── kpi-manager.js
│   ├── kpi-staff.js
│   └── kpi-weighted-progress.js
├── pages/                 # App screens
└── index.html             # Landing page
```

</details>

---

## Environment Variables

Create **`backend/.env`**:

```env
PORT=3000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
JWT_SECRET=change_this_to_a_long_random_secret

# Optional — password reset
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_gmail_app_password
```

| Variable | Required | Description |
| --- | :---: | --- |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (30-day token expiry) |
| `PORT` | — | Default `3000` |
| `EMAIL_USER` / `EMAIL_PASS` | — | Gmail for reset emails |

---

## How to Run

### Option A — Single server *(recommended)*

Express serves **both** the API and static HTML.

| Step | Command / Action |
| --- | --- |
| Install | `cd backend && npm install` |
| Configure | Add `backend/.env` (see above) |
| Start | `npm start` or `npm run dev` |
| Login | [localhost:3000/pages/login.html](http://localhost:3000/pages/login.html) |

**Key URLs**

| Page | URL |
| --- | --- |
| Landing | http://localhost:3000/index.html |
| Login | http://localhost:3000/pages/login.html |
| Register | http://localhost:3000/pages/register.html |
| Staff dashboard | http://localhost:3000/pages/dashboard.html |
| Manager dashboard | http://localhost:3000/pages/manager-kpi.html |

API base: `http://localhost:3000/api` (configured in `js/auth.js` and `js/main.js`).

---

### Option B — Live Server *(frontend hot reload)*

**Terminal 1 — backend**

```bash
cd backend
npm install
npm start
```

**Terminal 2 — frontend** (project root)

```bash
npm install
npx live-server --port=5501 --open=pages/login.html
```

| Page | URL |
| --- | --- |
| Login | http://127.0.0.1:5501/pages/login.html |
| Landing | http://127.0.0.1:5501/index.html |

CORS is enabled — the frontend on `:5501` still talks to the API on `:3000`.

> Password-reset emails default to `http://127.0.0.1:5501/pages/reset-password.html`.

---

## Frontend Pages

<details>
<summary>All pages</summary>

| Page | Path | Description |
| --- | --- | --- |
| Landing | `index.html` | Marketing homepage |
| Login | `pages/login.html` | Sign in |
| Register | `pages/register.html` | New account |
| Staff dashboard | `pages/dashboard.html` | KPI overview |
| My KPIs | `pages/staff-kpi.html` | Full staff list |
| KPI progress | `pages/kpi-progress.html` | Progress detail |
| Manager dashboard | `pages/manager-kpi.html` | Team management |
| KPI form | `pages/kpi-form.html` | Create / edit KPI |
| KPI verify | `pages/kpi-verify.html` | Manager review |
| Cycle history | `pages/kpi-cycle-history.html` | Approved cycles |
| Profile | `pages/profile.html` | Account settings |
| Reset password | `pages/reset-password.html` | After email link |

</details>

**Role redirects after login**

| Role | Destination |
| --- | --- |
| Manager | `pages/manager-kpi.html` |
| Staff | `pages/dashboard.html` |

---

## KPI Lifecycle

```
pending ──► in-progress ──► submitted ──► approved
                                  │
                                  └──► rejected ──► (staff can resubmit)
```

- Managers assign KPIs to active staff in their department
- Staff submit progress + evidence → status becomes `submitted`
- Managers approve or reject; **approved KPIs cannot be resubmitted**
- Deletes are soft (`isDeleted`); audit history is kept

---

## API Reference

**Base URL:** `http://localhost:3000/api`  
**Auth header:** `Authorization: Bearer <token>`

<details>
<summary><strong>Auth</strong> — <code>/api/auth</code></summary>

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/register` | Public | Register user |
| POST | `/login` | Public | Login → JWT |
| GET | `/profile` | Auth | Current user |
| PUT | `/profile` | Auth | Update profile |
| GET | `/staff` | Manager | List department staff |
| POST | `/forgot-password` | Public | Send reset email |
| POST | `/reset-password` | Public | Set new password |

</details>

<details>
<summary><strong>KPIs</strong> — <code>/api/kpis</code></summary>

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/` | Auth | List KPIs (role-scoped) |
| POST | `/` | Manager | Create KPI |
| GET | `/:id` | Auth | Single KPI |
| PUT | `/:id` | Manager | Update KPI |
| PUT | `/:id/submit` | Staff | Submit progress |
| PUT | `/:id/review` | Manager | Approve / reject |
| GET | `/:id/history` | Auth | Audit history |
| GET | `/history/feed` | Manager | History feed |
| DELETE | `/:id` | Manager | Soft delete |

</details>

<details>
<summary><strong>KPI records</strong> — <code>/api/kpi-records</code></summary>

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/feed` | Manager | Cycle records feed |
| GET | `/my` | Staff | Own records |
| GET | `/:kpiId` | Auth | Records for KPI |

</details>

<details>
<summary><strong>KPI history</strong> — <code>/api/kpi-history</code></summary>

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/feed` | Auth | History feed |
| GET | `/` | Auth | History by query |
| GET | `/:kpiId/cycles` | Auth | Cycle groupings |

</details>

<details>
<summary><strong>Evidence</strong> — <code>/api/evidence</code></summary>

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/upload` | Auth | Upload file (`file` field) |
| GET | `/:id` | Auth | Metadata |
| GET | `/:id/download` | Auth | Download file |

Allowed: PDF, PNG, JPEG, WEBP, DOC/DOCX, XLS/XLSX, PPT/PPTX — **max 5 MB**

</details>

Full schema: [backend/DATABASE_SCHEMA.md](backend/DATABASE_SCHEMA.md)

---

## Tests and Scripts

**Run tests**

```bash
cd backend
npm test
```

Covers weighted progress, KPI query helpers, history enrichment, and password validation.

<details>
<summary>Diagnostic scripts (<code>backend/scripts/</code>)</summary>

| Script | Purpose |
| --- | --- |
| `diagnose-db.js` | Test MongoDB connection |
| `diagnose-manager.js` | Debug manager access |
| `dump_users.js` / `dump_kpis.js` | Dump collections |
| `test-api.js` | Manual API checks |

```bash
cd backend
node scripts/diagnose-db.js
```

</details>

**Database collections:** `users` · `kpis` · `kpihistories` · `kpi_cycle_records` · `evidences`

---

## Troubleshooting

<details>
<summary>Common issues</summary>

| Issue | Fix |
| --- | --- |
| `MONGO_URI is missing or still contains the placeholder` | Set a real connection string in `backend/.env` |
| `Port 3000 is already in use` | Change `PORT` in `.env` and update `API_BASE_URL` in `js/auth.js` + `js/main.js` |
| API fails from live-server | Ensure backend is running on port 3000 |
| Reset email not sent | Set `EMAIL_USER` and `EMAIL_PASS` (Gmail app password) |
| Evidence upload rejected | Check type/size; use `/api/evidence/upload` |
| Demo login fails | Confirm accounts exist in your MongoDB (register or seed the DB) |

</details>