const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGO_URI;

        if (!mongoUri || mongoUri.includes('xxxxx')) {
            throw new Error('MONGO_URI is missing or still contains the placeholder host. Replace it in backend/.env with your real MongoDB Atlas connection string.');
        }

        const conn = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Database Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
