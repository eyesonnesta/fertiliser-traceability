// =====================================================================
// Server entry point
// Sets up Express, middleware, routes, and starts listening.
// =====================================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const stockRoutes = require('./routes/stock');
const transferRoutes = require('./routes/transfers');
const recallRoutes = require('./routes/recall');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const distributionRoutes = require('./routes/distributions');

const app = express();

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
const allowedOrigins = (process.env.FRONTEND_ORIGIN || defaultOrigins.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed.'));
  },
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 8),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please wait and try again.' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.FORGOT_PASSWORD_RATE_LIMIT_MAX || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please wait and try again.' },
});

// --- Global middleware ---
app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions));            // allow only configured frontend origins
app.use(express.json({ limit: '64kb' }));    // parse JSON request bodies into req.body

// --- Health check (handy for confirming the server is up) ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'fertiliser-traceability-api' });
});

// --- Feature routes ---
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/forgot-password', forgotPasswordLimiter);
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/recall', recallRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/distributions', distributionRoutes);

// --- Fallback for unknown routes ---
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// --- Error handler for security middleware such as CORS ---
app.use((err, req, res, next) => {
  if (err.message === 'CORS origin not allowed.') {
    return res.status(403).json({ error: 'CORS origin not allowed.' });
  }
  console.error('Unhandled server error:', err);
  return res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

module.exports = app; // exported for testing
