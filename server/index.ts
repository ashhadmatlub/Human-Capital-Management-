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

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check with Supabase status
app.get('/api/health', async (req, res) => {
  const supabaseStatus = await testSupabaseConnection();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    database: 'healthy',
    supabase: supabaseStatus,
  });
});

// Mount Routes
app.use('/api', authRoutes);
app.use('/api', orgRoutes);
app.use('/api', employeeRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', leaveRoutes);
app.use('/api', payrollRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', aiRoutes);
app.use('/api', commsRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`HCM Lite API server running on http://localhost:${PORT}`);
  console.log(`Initial setup completed: ${db.get('settings')?.setup_completed ? 'YES' : 'NO (Awaiting First-Run Setup)'}`);
});
