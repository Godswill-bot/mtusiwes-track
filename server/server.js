/**
 * MTU SIWES Email Server
 * Express server for email verification and password reset
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import weekRoutes from './routes/weekRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import gradingRoutes from './routes/gradingRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import logbookRoutes from './routes/logbookRoutes.js';
import supervisorRoutes from './routes/supervisorRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import { verifyEmailConfig } from './lib/email.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Configure CORS for production and development
const allowedOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  // Add Vercel domains
  'https://mtusiwes-track.vercel.app',
  /\.vercel\.app$/,  // Allow all Vercel preview deployments
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list or matches regex
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      return allowed === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow anyway for now to debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MTU SIWES Email Server',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/weeks', weekRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/logbook', logbookRoutes);
app.use('/api/supervisor', supervisorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attendance', attendanceRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const startServer = async () => {
  try {
    // Verify email configuration (with timeout to prevent hanging)
    console.log('Checking email configuration...');
    const emailReady = await Promise.race([
      verifyEmailConfig(),
      new Promise((resolve) => setTimeout(() => resolve(false), 12000))
    ]);
    
    if (!emailReady) {
      console.warn('⚠ Warning: Email configuration may be incorrect');
      console.warn('  Server will start, but email sending may not work');
      console.warn('  Check your EMAIL_USER and EMAIL_PASS in .env file\n');
    }

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║     MTU SIWES Email Server is running!                  ║
╠══════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${PORT}                    ║
║  Environment: ${process.env.NODE_ENV || 'development'}                    ║
║  Email:       ${process.env.EMAIL_USER || 'Not configured'}              ║
╚══════════════════════════════════════════════════════════╝
      `);
      console.log('Available endpoints:');
      console.log('  POST /api/auth/register');
      console.log('  POST /api/auth/verify-email');
      console.log('  POST /api/auth/login');
      console.log('  POST /api/auth/forgot-password');
      console.log('  POST /api/auth/verify-reset-otp');
      console.log('  POST /api/auth/reset-password');
      console.log('  GET  /health');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;

