# KPI Pulse

KPI Pulse is a role-based Key Performance Indicator management platform for managers and staff. The project now uses an Express backend with MongoDB/Mongoose for authentication, KPI records, KPI review, and audit history.

## Features

- Manager dashboard for KPI creation, assignment, review, and soft deletion
- Staff dashboard for assigned KPI tracking and progress submission
- JWT-based login and role authorization
- MongoDB-backed KPI schema with server-side validation
- Immutable KPI history/audit log
- Responsive dashboard UI with dark mode

## Technology Stack

| Category | Technology |
| --- | --- |
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Node.js, Express |
| Database | MongoDB Atlas with Mongoose |
| Auth | JWT + bcrypt password hashing |
| Styling | Custom CSS Design System |

## Project Structure

```text
KPI-Pulse/
|-- backend/
|   |-- controllers/
|   |-- models/
|   |-- routes/
|   |-- db.js
|   |-- server.js
|   `-- DATABASE_SCHEMA.md
|-- components/
|-- css/
|-- js/
|   |-- auth.js
|   |-- kpi-manager.js
|   |-- kpi-staff.js
|   `-- main.js
|-- pages/
`-- index.html
```

## Backend Setup

Create `backend/.env`:

```env
PORT=3000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=change_this_secret
```

Install and run the backend:

```bash
cd backend
npm install
npm start
```

The frontend expects the API at:

```text
http://localhost:3000/api
```

## API Summary

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/profile`
- `PUT /api/auth/profile`
- `GET /api/auth/staff`
- `GET /api/kpis`
- `POST /api/kpis`
- `PUT /api/kpis/:id`
- `PUT /api/kpis/:id/submit`
- `PUT /api/kpis/:id/review`
- `GET /api/kpis/:id/history`
- `DELETE /api/kpis/:id`

See [backend/DATABASE_SCHEMA.md](backend/DATABASE_SCHEMA.md) for schema and access rules.
