import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireSuperAdmin, requireCompanyAccess, requireCompanyAdmin } from '../middleware/roleGuard.js';
import * as companyService from '../services/company.service.js';
import * as ticketService from '../services/ticket.service.js';
import { AuthRequest } from '../types/index.js';
import { prisma } from '../config/database.js';

const router = Router();

// GET / - auth + super admin
router.get('/', authMiddleware, requireSuperAdmin(), async (_req: AuthRequest, res, next) => {
  try {
    const result = await companyService.getAll();
    res.json(result);
  } catch (err) { next(err); }
});

// GET /:identifier - public (for tenant resolution)
router.get('/:identifier', async (req, res, next) => {
  try {
    const result = await companyService.getByIdentifier(req.params.identifier as string);
    res.json(result);
  } catch (err) { next(err); }
});

// POST / - auth + super admin
router.post('/', authMiddleware, requireSuperAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await companyService.create(req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// PATCH /:id - auth + company admin
router.patch('/:id', authMiddleware, requireCompanyAdmin('id'), async (req: AuthRequest, res, next) => {
  try {
    const result = await companyService.update(req.params.id as string, req.body, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /:id - auth + super admin
router.delete('/:id', authMiddleware, requireSuperAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await companyService.deleteCompany(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /:companyId/stats - auth + company access
router.get('/:companyId/stats', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.params.companyId as string;

    const [raffles, tickets, payments, players] = await Promise.all([
      prisma.raffles.count({ where: { company_id: companyId } }),
      prisma.tickets.count({ where: { raffle: { company_id: companyId } } }),
      prisma.payments.count({ where: { company_id: companyId } }),
      prisma.players.count({ where: { company_id: companyId } }),
    ]);

    res.json({ raffles, tickets, payments, players });
  } catch (err) { next(err); }
});

// GET /:companyId/dashboard - rich dashboard data
router.get('/:companyId/dashboard', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.params.companyId as string;
    const { from, to } = req.query;
    const now = new Date();
    const rangeFrom = from ? new Date(from as string) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const rangeTo = to ? new Date(to as string) : now;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const paymentWhere: any = { company_id: companyId, status: 'succeeded', created_at: { gte: rangeFrom, lte: rangeTo } };

    const [
      activePlayers,
      totalPlayers,
      revenueTotals,
      totalTicketsSold,
      activeRaffles,
      finishedRaffles,
      draftRaffles,
      totalSalesCount,
      newPlayersToday,
      newPlayersThisMonth,
      totalAffiliates,
      revenueByDayRaw,
      playerRegByDayRaw,
      paymentStatusRaw,
      raffleStatusRaw,
      recentSalesRaw,
      upcomingRafflesRaw,
      topAffiliatesRaw,
    ] = await Promise.all([
      prisma.players.count({ where: { company_id: companyId, status: 'active' } }),
      prisma.players.count({ where: { company_id: companyId, deleted_at: null } }),
      prisma.payments.aggregate({ where: paymentWhere, _sum: { amount: true, admin_fee: true, net_amount: true } }),
      prisma.tickets.count({ where: { company_id: companyId, status: { in: ['active', 'winner'] }, created_at: { gte: rangeFrom, lte: rangeTo } } }),
      prisma.raffles.count({ where: { company_id: companyId, status: 'active' } }),
      prisma.raffles.count({ where: { company_id: companyId, status: 'finished' } }),
      prisma.raffles.count({ where: { company_id: companyId, status: 'draft' } }),
      prisma.payments.count({ where: paymentWhere }),
      prisma.players.count({ where: { company_id: companyId, created_at: { gte: todayStart } } }),
      prisma.players.count({ where: { company_id: companyId, created_at: { gte: monthStart } } }),
      prisma.affiliates.count({ where: { company_id: companyId, deleted_at: null } }),
      prisma.$queryRaw`
        SELECT DATE(created_at AT TIME ZONE 'UTC') as date,
               COALESCE(SUM(amount),0)::float as revenue,
               COALESCE(SUM(net_amount),0)::float as net,
               COUNT(*)::int as count
        FROM payments
        WHERE company_id = ${companyId}::uuid AND status = 'succeeded'
          AND created_at >= ${rangeFrom} AND created_at <= ${rangeTo}
        GROUP BY DATE(created_at AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `,
      prisma.$queryRaw`
        SELECT DATE(created_at AT TIME ZONE 'UTC') as date, COUNT(*)::int as count
        FROM players
        WHERE company_id = ${companyId}::uuid
          AND created_at >= ${rangeFrom} AND created_at <= ${rangeTo}
        GROUP BY DATE(created_at AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `,
      prisma.$queryRaw`
        SELECT status, COUNT(*)::int as count
        FROM payments
        WHERE company_id = ${companyId}::uuid
          AND created_at >= ${rangeFrom} AND created_at <= ${rangeTo}
        GROUP BY status
      `,
      prisma.$queryRaw`
        SELECT status, COUNT(*)::int as count
        FROM raffles
        WHERE company_id = ${companyId}::uuid AND deleted_at IS NULL
        GROUP BY status
      `,
      prisma.payments.findMany({
        where: { company_id: companyId, status: 'succeeded', created_at: { gte: rangeFrom, lte: rangeTo } },
        include: {
          raffle: { select: { name: true } },
          player: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      prisma.raffles.findMany({
        where: { company_id: companyId, status: { in: ['draft', 'active'] }, deleted_at: null },
        orderBy: { scheduled_at: 'asc' },
        take: 5,
      }),
      prisma.$queryRaw`
        SELECT a.id as "affiliateId", a.name as "affiliateName", a.type,
               COUNT(*)::int as "salesCount",
               COALESCE(SUM(p.amount),0)::float as "totalSales"
        FROM payments p
        JOIN tickets t ON t.id = p.ticket_id
        JOIN affiliates a ON a.id = t.affiliate_id
        WHERE p.company_id = ${companyId}::uuid AND p.status = 'succeeded'
          AND p.created_at >= ${rangeFrom} AND p.created_at <= ${rangeTo}
        GROUP BY a.id, a.name, a.type
        ORDER BY "totalSales" DESC
        LIMIT 5
      `,
    ]);

    const fmtDate = (d: any) => d instanceof Date ? d.toISOString().split('T')[0] : String(d);

    res.json({
      stats: {
        activePlayers,
        totalPlayers,
        totalRevenue: Number(revenueTotals._sum.amount || 0),
        netRevenue: Number(revenueTotals._sum.net_amount || 0),
        adminFees: Number(revenueTotals._sum.admin_fee || 0),
        totalTicketsSold,
        activeRaffles,
        finishedRaffles,
        draftRaffles,
        totalSalesCount,
        newPlayersToday,
        newPlayersThisMonth,
        totalAffiliates,
      },
      revenueByDay: (revenueByDayRaw as any[]).map(r => ({
        date: fmtDate(r.date), revenue: Number(r.revenue), net: Number(r.net), count: Number(r.count),
      })),
      playerRegistrationsByDay: (playerRegByDayRaw as any[]).map(r => ({
        date: fmtDate(r.date), count: Number(r.count),
      })),
      paymentStatusDistribution: paymentStatusRaw as any[],
      raffleStatusDistribution: raffleStatusRaw as any[],
      recentSales: (recentSalesRaw as any[]).map(p => ({
        id: p.id, amount: Number(p.amount), status: p.status, createdAt: p.created_at,
        raffleName: p.raffle?.name || '-', playerName: p.player?.name || '-',
      })),
      upcomingRaffles: (upcomingRafflesRaw as any[]).map(r => ({
        id: r.id, name: r.name, ticketPrice: Number(r.ticket_price),
        scheduledAt: r.scheduled_at, status: r.status,
      })),
      topAffiliates: topAffiliatesRaw as any[],
    });
  } catch (err) { next(err); }
});

// GET /:companyId/players - auth + company access
router.get('/:companyId/players', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.params.companyId as string;
    const players = await prisma.players.findMany({
      where: { company_id: companyId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    res.json(players);
  } catch (err) { next(err); }
});

// GET /:companyId/players/ticket-counts - auth + company access
router.get('/:companyId/players/ticket-counts', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.params.companyId as string;
    const counts = await prisma.tickets.groupBy({
      by: ['player_id'],
      where: {
        company_id: companyId,
        status: 'active',
      },
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    for (const c of counts) {
      result[c.player_id] = c._count.id;
    }
    res.json(result);
  } catch (err) { next(err); }
});

// GET /:companyId/players/:playerId - admin: get single player detail
router.get('/:companyId/players/:playerId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.params.companyId as string;
    const playerId = req.params.playerId as string;
    const player = await prisma.players.findFirst({
      where: { id: playerId, company_id: companyId },
    });
    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }
    res.json(player);
  } catch (err) { next(err); }
});

// GET /:companyId/players/:playerId/tickets - admin: get player's tickets
router.get('/:companyId/players/:playerId/tickets', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.params.companyId as string;
    const playerId = req.params.playerId as string;
    const result = await ticketService.getByPlayer(playerId, companyId);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /:companyId/players/:playerId/payments - admin: get player's payments
router.get('/:companyId/players/:playerId/payments', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const companyId = req.params.companyId as string;
    const playerId = req.params.playerId as string;
    const payments = await prisma.payments.findMany({
      where: { player_id: playerId, company_id: companyId },
      include: { raffle: { select: { id: true, name: true } } },
      orderBy: { created_at: 'desc' },
    });
    res.json(payments);
  } catch (err) { next(err); }
});

export default router;
