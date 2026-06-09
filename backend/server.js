require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const connectDB = require('./db');
const app = require('./app');

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
