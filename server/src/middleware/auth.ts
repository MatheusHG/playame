import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { AuthRequest, JwtPayload } from '../types/index.js';
import { UnauthorizedError } from '../utils/errors.js';

export async function authMiddleware(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token not provided');
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Always fetch fresh roles from DB to avoid stale JWT data
    const freshRoles = await prisma.user_roles.findMany({
      where: { user_id: decoded.userId },
    });

    decoded.roles = freshRoles.map((r) => ({
      role: r.role,
      companyId: r.company_id,
    }));

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = decoded;
  } catch {
    // Token invalid, continue without auth
  }
  next();
}
