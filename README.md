# KPI Pro

**KPI Pro** is a comprehensive, role-based Key Performance Indicator (KPI) management platform designed to help organizations monitor staff performance, manage KPI progress, verify submissions, and review historical achievements. Built with Firebase integration and a modern responsive interface, KPI Pro ensures secure and efficient KPI management for both managers and staff.

---

## 🚀 Key Features

### 👨‍💼 Manager Functions
- View overall team KPI performance dashboard
- Edit or remove existing KPIs
- Verify staff submissions and supporting evidence
- View KPI history and previous performance records for each staff member
- Track completion percentages and pending tasks

### 👩‍💻 Staff Functions
- View personal assigned KPIs
- Update KPI progress in real time
- Submit completed KPI evidence for verification
- Track status of submitted KPIs
- Monitor personal completion rates

### 🌟 Additional Features
- Role-based login system
- Real-time Firestore database sync
- Responsive dashboard UI
- Dark mode support
- Performance analytics cards and charts

---

## 🛠️ Technology Stack

| Category | Technology |
|--------|------------|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Firebase Authentication |
| Database | Firestore |
| Styling | Custom CSS Design System |
| Fonts | Sora, DM Sans |

---

## 📂 Project Structure

```text
KPI-Pro/
│── css/
│   └── style.css
│
│── js/
│   ├── auth.js
│   ├── firebase.js
│   ├── kpi-manager.js
│   ├── kpi-staff.js
│   └── main.js
│
│── pages/
│   ├── login.html
│   ├── manager-kpi.html
│   ├── staff-kpi.html
│   └── kpi-form.html
│
└── README.md
````

---

## ⚙️ Setup & Installation

## 1️⃣ Clone Project

```bash
git clone https://github.com/florencetongg/KPI-Pulse
cd kpi-pro
```

---

## 2️⃣ Firebase Setup

Create a Firebase project and enable:

* Authentication (Email/Password)
* Firestore Database

Update `firebase.js`

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
```

---

## 3️⃣ Run Project

Open `login.html` using Live Server or browser.

---

## 🔐 Demo Accounts

| Role    | Email                                                   | Password    |
| ------- | ------------------------------------------------------- | ----------- |
| Manager | [alex.rivera@kpipro.com](mailto:alex.rivera@kpipro.com) | password123 |
| Staff   | [john.doe@kpipro.com](mailto:john.doe@kpipro.com)       | password123 |
| Staff   | [jane.smith@kpipro.com](mailto:jane.smith@kpipro.com)   | password123 |

---

## 📖 Usage Guide

## Manager Dashboard

Managers can:

* Review all team KPIs
* Create and assign KPIs
* Approve progress submissions
* View KPI history records
* Monitor department performance

## Staff Dashboard

Staff can:

* View assigned KPIs
* Submit updates
* Upload evidence
* Check approval status
* Track monthly progress

---

## 🌙 UI Features

* Clean modern dashboard
* Mobile responsive layout
* Dark / Light mode
* Interactive cards
* Real-time updates

---

## 🔮 Future Improvements

* Email reminders for deadlines
* Export KPI reports to PDF
* Advanced analytics charts
* Department filtering
* AI KPI recommendation system

---

## 📄 License

This project is licensed under the **MIT License**.

---

```
```
