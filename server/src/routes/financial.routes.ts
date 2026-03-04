import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess, requireSuperAdmin } from '../middleware/roleGuard.js';
import * as financialService from '../services/financial.service.js';
import { AuthRequest } from '../types/index.js';
import { getCompanyId } from '../utils/tenant.js';

const router = Router();

// GET /company/:companyId - auth + company access
router.get('/company/:companyId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const result = await financialService.getByCompany(getCompanyId(req));
    res.json(result.data);
  } catch (err) { next(err); }
});

// GET / - auth + super admin (all logs)
router.get('/', authMiddleware, requireSuperAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await financialService.getAll(req.query as Record<string, string>);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
