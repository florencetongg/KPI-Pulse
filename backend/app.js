require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const kpiRoutes = require('./routes/kpiRoutes');
const kpiRecordRoutes = require('./routes/kpiRecordRoutes');
const kpiHistoryRoutes = require('./routes/kpiHistoryRoutes');
const evidenceRoutes = require('./routes/evidenceRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..')));

app.use('/api/auth', authRoutes);
app.use('/api/kpis', kpiRoutes);
app.use('/api/kpi-records', kpiRecordRoutes);
app.use('/api/kpi-history', kpiHistoryRoutes);
app.use('/api/evidence', evidenceRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Server Error occurred' });
});

module.exports = app;
