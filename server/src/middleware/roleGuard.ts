import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();

    const hasRole = req.user.roles.some(r => roles.includes(r.role));
    if (!hasRole) throw new ForbiddenError('Insufficient permissions');

    next();
  };
}

export function requireSuperAdmin() {
  return requireRole('SUPER_ADMIN');
}

export function requireCompanyAccess(companyIdParam = 'companyId') {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();

    const isSuperAdmin = req.user.roles.some(r => r.role === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      next();
      return;
    }

    const companyId = req.params[companyIdParam];
    if (!companyId) {
      next();
      return;
    }

    const hasAccess = req.user.roles.some(
      r => r.companyId === companyId && ['ADMIN_EMPRESA', 'COLABORADOR'].includes(r.role)
    );

    if (!hasAccess) throw new ForbiddenError('No access to this company');

    next();
  };
}

export function requireCompanyAdmin(companyIdParam = 'companyId') {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) throw new UnauthorizedError();

    const isSuperAdmin = req.user.roles.some(r => r.role === 'SUPER_ADMIN');
    if (isSuperAdmin) {
      next();
      return;
    }

    const companyId = req.params[companyIdParam];
    const isAdmin = req.user.roles.some(
      r => r.companyId === companyId && r.role === 'ADMIN_EMPRESA'
    );

    if (!isAdmin) throw new ForbiddenError('Admin access required');

    next();
  };
}
