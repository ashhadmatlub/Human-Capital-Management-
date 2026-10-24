import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import orgRoutes from './routes/orgRoutes';
import employeeRoutes from './routes/employeeRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import leaveRoutes from './routes/leaveRoutes';
import payrollRoutes from './routes/payrollRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import aiRoutes from './routes/aiRoutes';
import commsRoutes from './routes/commsRoutes';
import { db } from './db/database';
import { testSupabaseConnection } from './db/supabase';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173']; // Vite dev + preview

app.use(
  cors({
    origin: IS_PRODUCTION
      ? (origin, cb) => {
          if (!origin || allowedOrigins.includes(origin)) {
            cb(null, true);
          } else {
            cb(new Error(`CORS: origin ${origin} not allowed`));
          }
        }
      : true, // allow all in dev
    credentials: true,
  })
);

// ─── Security Headers ────────────────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ─── Body Parser ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// ─── Simple In-Memory Rate Limiter ───────────────────────────────────────────
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 300; // requests
const RATE_WINDOW = 60_000; // per minute

app.use((req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const entry = rateMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return next();
  }

  if (entry.count >= RATE_LIMIT) {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return;
  }

  entry.count++;
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const supabaseStatus = await testSupabaseConnection();
  res.json({
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: 'healthy',
    setup_completed: db.get('settings')?.setup_completed ?? false,
    supabase: supabaseStatus,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', authRoutes);
app.use('/api', orgRoutes);
app.use('/api', employeeRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', leaveRoutes);
app.use('/api', payrollRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', aiRoutes);
app.use('/api', commsRoutes);

// ─── 404 Catch-All ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[HCM Server Error]', err?.message || err);
  const status = err?.status || 500;
  res.status(status).json({
    error: IS_PRODUCTION ? 'Internal server error' : err?.message || 'Unknown error',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║       HCM Lite API  –  Port ${PORT}             ║`);
  console.log(`╚══════════════════════════════════════════════╝`);
  console.log(`  Mode       : ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`  Setup done : ${db.get('settings')?.setup_completed ? '✅ YES' : '⏳ NO – Awaiting First-Run Setup'}`);
  console.log(`  API root   : http://localhost:${PORT}/api\n`);
});
