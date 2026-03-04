import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess, requireSuperAdmin } from '../middleware/roleGuard.js';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /company/:companyId - auth + company access
router.get('/company/:companyId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const logs = await prisma.webhook_logs.findMany({
      where: { company_id: req.params.companyId as string },
      orderBy: { created_at: 'desc' },
    });
    res.json(logs);
  } catch (err) { next(err); }
});

// GET / - auth + super admin (all webhook logs)
router.get('/', authMiddleware, requireSuperAdmin(), async (_req: AuthRequest, res, next) => {
  try {
    const logs = await prisma.webhook_logs.findMany({
      orderBy: { created_at: 'desc' },
    });
    res.json(logs);
  } catch (err) { next(err); }
});

export default router;
