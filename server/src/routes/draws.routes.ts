import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess, requireCompanyAdmin } from '../middleware/roleGuard.js';
import * as drawService from '../services/draw.service.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /raffle/:raffleId/drawn-numbers - public, flat array of drawn numbers
router.get('/raffle/:raffleId/drawn-numbers', async (req, res, next) => {
  try {
    const numbers = await drawService.getDrawnNumbers(req.params.raffleId as string);
    res.json({ numbers });
  } catch (err) { next(err); }
});

// GET /raffle/:raffleId/public - public, finalized batches only
router.get('/raffle/:raffleId/public', async (req, res, next) => {
  try {
    const result = await drawService.getPublicBatches(req.params.raffleId as string);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /raffle/:raffleId - auth + company access
router.get('/raffle/:raffleId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const result = await drawService.getBatches(req.params.raffleId as string);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /raffle/:raffleId - auth + company admin
router.post('/raffle/:raffleId', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await drawService.createBatch(req.params.raffleId as string, req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// PATCH /:id - auth + company admin
router.patch('/:id', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await drawService.updateBatch(req.params.id as string, req.body, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /:id - auth + company admin
router.delete('/:id', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await drawService.deleteBatch(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// PATCH /:id/finalize - auth + company admin
router.patch('/:id/finalize', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await drawService.finalizeBatch(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /:id/numbers - auth + company admin
router.post('/:id/numbers', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await drawService.addNumber(req.params.id as string, req.body.raffleId, req.body.number, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// DELETE /numbers/:id - auth + company admin
router.delete('/numbers/:id', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await drawService.removeNumber(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
