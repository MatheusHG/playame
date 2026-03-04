import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess, requireCompanyAdmin } from '../middleware/roleGuard.js';
import * as raffleService from '../services/raffle.service.js';
import * as rankingService from '../services/ranking.service.js';
import { AuthRequest } from '../types/index.js';
import { prisma } from '../config/database.js';
import { getCompanyId } from '../utils/tenant.js';

const router = Router();

// GET /finished/:companyId - public (finished raffles)
router.get('/finished/:companyId', async (req, res, next) => {
  try {
    const raffles = await prisma.raffles.findMany({
      where: {
        company_id: getCompanyId(req as any),
        status: 'finished',
        deleted_at: null,
      },
      include: {
        prize_tiers: true,
      },
      orderBy: { finished_at: 'desc' },
    });
    res.json(raffles);
  } catch (err) { next(err); }
});

// GET /company/:companyId - auth + company access
router.get('/company/:companyId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const result = await raffleService.getByCompany(getCompanyId(req));
    res.json(result);
  } catch (err) { next(err); }
});

// GET /public/:companyId - public (active raffles only)
router.get('/public/:companyId', async (req, res, next) => {
  try {
    const all = await raffleService.getByCompany(getCompanyId(req as any));
    const active = all.filter((r: any) => r.status === 'active');
    res.json(active);
  } catch (err) { next(err); }
});

// GET /:id - public
router.get('/:id', async (req, res, next) => {
  try {
    const result = await raffleService.getById(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /company/:companyId - auth + company admin
router.post('/company/:companyId', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await raffleService.create(getCompanyId(req), req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// PATCH /:id - auth + company admin
router.patch('/:id', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await raffleService.update(req.params.id as string, req.body, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// PATCH /:id/status - auth + company admin
router.patch('/:id/status', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await raffleService.changeStatus(req.params.id as string, req.body.status, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /:id - auth + company admin
router.delete('/:id', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await raffleService.deleteRaffle(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /:id/prize-tiers - auth + company admin
router.put('/:id/prize-tiers', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await raffleService.savePrizeTiers(req.params.id as string, req.body.tiers, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /:id/settle - auth + company admin
router.post('/:id/settle', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await raffleService.settle(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /:id/recalculate-ranking - auth + company admin
router.post('/:id/recalculate-ranking', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await rankingService.recalculateRaffleRanking(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
