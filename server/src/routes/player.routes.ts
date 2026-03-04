import { Router } from 'express';
import { rateLimit } from '../middleware/rateLimiter.js';
import { playerAuthMiddleware } from '../middleware/playerAuth.js';
import { authMiddleware } from '../middleware/auth.js';
import * as playerService from '../services/player.service.js';
import { prisma } from '../config/database.js';
import { AuthRequest, PlayerAuthRequest } from '../types/index.js';

const router = Router();

// POST /auth - public (rate limited)
// Dispatches to loginPlayer/registerPlayer/changePassword/updateProfile based on body.action
router.post('/auth', rateLimit('player_auth'), async (req, res, next) => {
  try {
    const { action, ...data } = req.body;

    const companyId = (req as any).tenantId || data.companyId;

    let result;
    switch (action) {
      case 'login':
        result = await playerService.loginPlayer(companyId, data.cpf, data.password);
        break;
      case 'register':
        result = await playerService.registerPlayer(companyId, data.cpf, data.password, data.name, data.phone, data.city);
        break;
      case 'changePassword':
        result = await playerService.changePassword(data.playerId, data.currentPassword, data.newPassword);
        break;
      case 'updateProfile':
        result = await playerService.updateProfile(data.playerId, data);
        break;
      default:
        res.status(400).json({ error: 'Invalid action' });
        return;
    }

    res.json(result);
  } catch (err) { next(err); }
});

// GET /:id/tickets - player auth: get player's tickets
router.get('/:id/tickets', playerAuthMiddleware, async (req: PlayerAuthRequest, res, next) => {
  try {
    const playerId = req.params.id as string;
    const companyId = (req as any).tenantId || (req.query.companyId as string) || req.player!.companyId;
    const include = (req.query.include as string) || '';

    const includeRaffle = include.includes('raffle');
    const includeNumbers = include.includes('ticket_numbers');
    const includeRanking = include.includes('ranking');

    const tickets = await prisma.tickets.findMany({
      where: { player_id: playerId, company_id: companyId },
      include: {
        raffle: includeRaffle ? { select: { id: true, name: true, status: true, current_draw_count: true } } : false,
        ticket_numbers: includeNumbers,
        ticket_ranking: includeRanking,
      },
      orderBy: { created_at: 'desc' },
    });

    // Flatten ranking to single object
    const result = tickets.map((t) => {
      const { ticket_ranking, ...rest } = t as any;
      return {
        ...rest,
        ranking: ticket_ranking || null,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// GET /:id/payments - player auth: get player's payments
router.get('/:id/payments', playerAuthMiddleware, async (req: PlayerAuthRequest, res, next) => {
  try {
    const playerId = req.params.id as string;
    const companyId = (req as any).tenantId || (req.query.companyId as string) || req.player!.companyId;
    const include = (req.query.include as string) || '';

    const includeRaffle = include.includes('raffle');

    const payments = await prisma.payments.findMany({
      where: { player_id: playerId, company_id: companyId },
      include: {
        raffle: includeRaffle ? { select: { id: true, name: true } } : false,
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(payments);
  } catch (err) { next(err); }
});

// GET /:id/raffles - player auth: get player's participated raffles
router.get('/:id/raffles', playerAuthMiddleware, async (req: PlayerAuthRequest, res, next) => {
  try {
    const playerId = req.params.id as string;
    const raffleIdsParam = req.query.raffleIds as string;

    if (!raffleIdsParam) {
      const tickets = await prisma.tickets.findMany({
        where: { player_id: playerId, status: { not: 'cancelled' } },
        select: { raffle_id: true },
        distinct: ['raffle_id'],
      });

      const raffleIds = tickets.map((t) => t.raffle_id);
      if (raffleIds.length === 0) {
        res.json([]);
        return;
      }

      const raffles = await prisma.raffles.findMany({
        where: { id: { in: raffleIds } },
      });
      res.json(raffles);
    } else {
      const raffleIds = raffleIdsParam.split(',').filter(Boolean);
      const raffles = await prisma.raffles.findMany({
        where: { id: { in: raffleIds } },
      });
      res.json(raffles);
    }
  } catch (err) { next(err); }
});

// PATCH /:id - admin auth: update player (block/unblock)
router.patch('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const playerId = req.params.id as string;
    const { status, blocked_at, blocked_reason, name, city, phone } = req.body;

    const before = await prisma.players.findUnique({ where: { id: playerId } });

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (status !== undefined) updateData.status = status;
    if (blocked_at !== undefined) updateData.blocked_at = blocked_at ? new Date(blocked_at) : null;
    if (blocked_reason !== undefined) updateData.blocked_reason = blocked_reason;
    if (name !== undefined) updateData.name = name;
    if (city !== undefined) updateData.city = city;
    if (phone !== undefined) updateData.phone = phone;

    const updated = await prisma.players.update({
      where: { id: playerId },
      data: updateData as any,
    });

    if (before) {
      const PLAYER_FIELDS = ['name', 'phone', 'city', 'status', 'blocked_at', 'blocked_reason'];
      const { buildUpdateChanges } = await import('../utils/auditChanges.js');
      const changes = buildUpdateChanges(before, updated, PLAYER_FIELDS);
      if (changes) {
        const { log } = await import('../services/audit.service.js');
        await log({
          companyId: before.company_id,
          userId: req.user!.userId,
          playerId,
          action: 'PLAYER_UPDATED',
          entityType: 'player',
          entityId: playerId,
          changesJson: changes,
        });
      }
    }

    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
