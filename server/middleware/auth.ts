import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, User } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'saylani-hackathon-hcm-lite-secret-key-2026';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      employee_id: user.employee_id,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Token missing.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: string };
    const users = db.get('users');
    const user = users.find((u) => u.id === decoded.id && u.is_active);

    if (!user) {
      res.status(401).json({ error: 'User not found or deactivated.' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }
}

export function requireRole(allowedRoles: Array<'admin' | 'hr' | 'employee'>) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: Access restricted to roles [${allowedRoles.join(', ')}]`,
      });
      return;
    }
    next();
  };
}

// Data scope guard middleware
export function enforceDataScope(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  // If role is employee, enforce employee_id match on parameters or queries
  if (req.user.role === 'employee') {
    const requestedEmpId = req.params.employee_id || req.query.employee_id;
    if (requestedEmpId && requestedEmpId !== req.user.employee_id) {
      res.status(403).json({
        error: 'Forbidden: You do not have permission to view other employee records.',
      });
      return;
    }
  }
  next();
}
