require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');

const authRoutes = require('./routes/authRoutes');
const kpiRoutes = require('./routes/kpiRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/kpis', kpiRoutes);

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
