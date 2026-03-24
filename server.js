/**
 * GreenBite Backend Server
 * Express.js entry point with middleware stack and route mounting
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import routes
const authRoutes = require('./routes/auth.routes');
const donationRoutes = require('./routes/donation.routes');
const adminRoutes = require('./routes/admin.routes');
const ngoRoutes = require('./routes/ngo.routes');
const taskRoutes = require('./routes/task.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware Stack ──────────────────────────────────────────────
app.use(helmet());                                    // Security headers
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));                               // Request logging
app.use(express.json({ limit: '10mb' }));             // Parse JSON (large limit for base64 images)
app.use(express.urlencoded({ extended: true }));

// ── Health Check ─────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'GreenBite Backend is running 🌱' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'GreenBite API is running 🌱' });
});

// ── API Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ngo', ngoRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// ── 404 Handler ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ── Global Error Handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌱 GreenBite API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
