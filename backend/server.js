require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');

const authRoutes = require('./routes/authRoutes');
const kpiRoutes = require('./routes/kpiRoutes');
const kpiRecordRoutes = require('./routes/kpiRecordRoutes');
const kpiHistoryRoutes = require('./routes/kpiHistoryRoutes');
const evidenceRoutes = require('./routes/evidenceRoutes');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend from project root (http://localhost:3000/pages/login.html)
app.use(express.static(path.join(__dirname, '..')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/kpi-records', kpiRecordRoutes);
app.use('/api/kpi-history', kpiHistoryRoutes);
app.use('/api/evidence', evidenceRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Server Error occurred' });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    await connectDB();
    const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Set a different PORT in backend/.env.`);
            process.exit(1);
        }
        throw error;
    });
};

startServer();
