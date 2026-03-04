import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess, requireSuperAdmin } from '../middleware/roleGuard.js';
import * as auditService from '../services/audit.service.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /company/:companyId - auth + company access
router.get('/company/:companyId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const filters: auditService.AuditFilters = {
      action: req.query.action as string | undefined,
      entityType: req.query.entityType as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const result = await auditService.getByCompany(req.params.companyId as string, filters);
    res.json(result);
  } catch (err) { next(err); }
});

// GET / - auth + super admin (all logs)
router.get('/', authMiddleware, requireSuperAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await auditService.getAll(req.query as Record<string, string>);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
