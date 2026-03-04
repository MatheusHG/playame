import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess, requireCompanyAdmin } from '../middleware/roleGuard.js';
import * as ticketService from '../services/ticket.service.js';
import * as rankingService from '../services/ranking.service.js';
import { AuthRequest } from '../types/index.js';
import { getCompanyId } from '../utils/tenant.js';

const router = Router();

// GET /track/:paymentId - public tracking by payment ref
router.get('/track/:paymentId', async (req, res, next) => {
  try {
    const result = await ticketService.getPublicTrackingByPayment(req.params.paymentId as string);
    if (!result) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(result);
  } catch (err) { next(err); }
});

// GET /winners/:raffleId - public winners list
router.get('/winners/:raffleId', async (req, res, next) => {
  try {
    const result = await ticketService.getWinnersByRaffle(req.params.raffleId as string);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /lookup-by-cpf/:companyId - public ticket lookup by CPF
router.get('/lookup-by-cpf/:companyId', async (req, res, next) => {
  try {
    const cpf = req.query.cpf as string;
    if (!cpf) {
      res.status(400).json({ error: 'CPF is required' });
      return;
    }
    const result = await ticketService.lookupByCpf(getCompanyId(req as any), cpf);
    if (!result) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    res.json(result);
  } catch (err) { next(err); }
});

// GET /company/:companyId/search?ref=XXXXX - search ticket by ref across all company raffles
router.get('/company/:companyId/search', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const ref = req.query.ref as string;
    if (!ref || ref.length < 3) {
      res.status(400).json({ error: 'Ref must be at least 3 characters' });
      return;
    }
    const result = await ticketService.searchByRefGlobal(getCompanyId(req), ref);
    if (!result) {
      res.status(404).json({ error: 'Cartela não encontrada' });
      return;
    }
    res.json(result);
  } catch (err) { next(err); }
});

// GET /raffle/:raffleId/search?ref=XXXXX - search ticket by ref
router.get('/raffle/:raffleId/search', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const ref = req.query.ref as string;
    if (!ref || ref.length < 3) {
      res.status(400).json({ error: 'Ref must be at least 3 characters' });
      return;
    }
    const result = await ticketService.searchByRef(req.params.raffleId as string, ref);
    if (!result) {
      res.status(404).json({ error: 'Cartela não encontrada' });
      return;
    }
    res.json(result);
  } catch (err) { next(err); }
});

// GET /raffle/:raffleId - auth + company access
router.get('/raffle/:raffleId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const result = await ticketService.getByRaffle(req.params.raffleId as string);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /raffle/:raffleId/ranking - public
router.get('/raffle/:raffleId/ranking', async (req, res, next) => {
  try {
    const result = await rankingService.getRanking(req.params.raffleId as string);
    res.json(result);
  } catch (err) { next(err); }
});

// PATCH /:id/cancel - auth + company admin
router.patch('/:id/cancel', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await ticketService.cancel(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
