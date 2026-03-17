const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Server } = require('socket.io');

const config = require('./config');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { initializeSocket } = require('./services/socketService');

// Route imports
const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const serviceRoutes = require('./routes/services');
const postRoutes = require('./routes/posts');
const chatRoutes = require('./routes/chat');
const transactionRoutes = require('./routes/transactions');
const aiRoutes = require('./routes/ai');

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});

initializeSocket(io);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(morgan(config.nodeEnv === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { status: 'fail', message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Static files
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/ai', aiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'CommuneX API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// 404 handler
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  await connectDB();

  server.listen(config.port, () => {
    console.log(`\n====================================`);
    console.log(`  CommuneX Server`);
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  API: http://localhost:${config.port}/api`);
    console.log(`====================================\n`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = { app, server, io };
