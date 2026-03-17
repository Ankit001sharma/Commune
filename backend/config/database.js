const mongoose = require('mongoose');
const config = require('./index');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[DB] Connection error: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error(`[DB] MongoDB error: ${err.message}`);
});

module.exports = connectDB;
