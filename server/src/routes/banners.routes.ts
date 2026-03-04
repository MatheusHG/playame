import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAdmin } from '../middleware/roleGuard.js';
import * as bannerService from '../services/banner.service.js';
import { AuthRequest } from '../types/index.js';
import { getCompanyId } from '../utils/tenant.js';

const router = Router();

// GET /company/:companyId - public
router.get('/company/:companyId', async (req, res, next) => {
  try {
    const result = await bannerService.getByCompany(getCompanyId(req as any));
    res.json(result);
  } catch (err) { next(err); }
});

// POST /company/:companyId - auth + company admin
router.post('/company/:companyId', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await bannerService.create(getCompanyId(req), req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// DELETE /:id - auth + company admin
router.delete('/:id', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await bannerService.deleteBanner(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
