import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess } from '../middleware/roleGuard.js';
import * as commissionService from '../services/commission.service.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /company/:companyId - auth + company access
router.get('/company/:companyId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const result = await commissionService.getByCompany(req.params.companyId as string);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
