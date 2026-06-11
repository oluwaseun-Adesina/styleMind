import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler, notFoundHandler } from './utils/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import wardrobeRoutes from './routes/wardrobeRoutes.js';
import lookbookRoutes from './routes/lookbookRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { env } from './config/env.js';

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS configuration
const allowedOrigins = env.ALLOWED_ORIGINS;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '6mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Rate limiting
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.RATE_LIMIT_MAX, // Limit each IP to N requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
  },
});

// Stricter rate limiting for AI endpoints (cost $)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.AI_RATE_LIMIT_MAX, // Limit each IP to N AI requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI request limit exceeded, please try again later',
  },
});

// Auth routes (stricter limit)
app.use('/api/auth', authLimiter, authRoutes);

// Wardrobe routes (standard limit)
app.use('/api/wardrobes', standardLimiter, wardrobeRoutes);

// Lookbook routes (standard limit)
app.use('/api/saved_outfits', standardLimiter, lookbookRoutes);

// Event routes (standard limit)
app.use('/api/events', standardLimiter, eventRoutes);

// AI routes (strict limit)
app.use('/api', aiLimiter, aiRoutes);

// Health check
app.get('/health', (_, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
