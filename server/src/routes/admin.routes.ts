import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/roleGuard.js';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /stats - super admin dashboard stats
router.get('/stats', authMiddleware, requireSuperAdmin(), async (_req: AuthRequest, res, next) => {
  try {
    const [companies, players, activeTickets, revenue] = await Promise.all([
      prisma.companies.count({ where: { status: 'active' } }),
      prisma.players.count({ where: { status: 'active' } }),
      prisma.tickets.count({ where: { status: 'active' } }),
      prisma.payments.aggregate({
        where: { status: 'succeeded' },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      companies,
      players,
      activeTickets,
      revenue: Number(revenue._sum.amount || 0),
    });
  } catch (err) { next(err); }
});

// GET /dashboard - super admin rich dashboard data
router.get('/dashboard', authMiddleware, requireSuperAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query;
    const now = new Date();
    const rangeFrom = from ? new Date(from as string) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const rangeTo = to ? new Date(to as string) : now;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const paymentDateFilter: Record<string, unknown> = { status: 'succeeded', created_at: { gte: rangeFrom, lte: rangeTo } };
    const playerDateFilter = { created_at: { gte: rangeFrom, lte: rangeTo } };

    const [
      totalCompanies,
      totalPlayers,
      revenueTotals,
      totalTicketsSold,
      activeRaffles,
      finishedRaffles,
      upcomingRafflesCount,
      totalSalesCount,
      newPlayersToday,
      newPlayersThisMonth,
      revenueByDayRaw,
      playerRegByDayRaw,
      salesByCompanyRaw,
      paymentStatusRaw,
      raffleStatusRaw,
      recentSalesRaw,
      upcomingRafflesListRaw,
    ] = await Promise.all([
      prisma.companies.count({ where: { status: 'active' } }),
      prisma.players.count({ where: { status: 'active' } }),
      prisma.payments.aggregate({
        where: paymentDateFilter as any,
        _sum: { amount: true, admin_fee: true },
      }),
      prisma.tickets.count({ where: { status: { in: ['active', 'winner'] }, created_at: { gte: rangeFrom, lte: rangeTo } } }),
      prisma.raffles.count({ where: { status: 'active' } }),
      prisma.raffles.count({ where: { status: 'finished' } }),
      prisma.raffles.count({ where: { status: 'draft' } }),
      prisma.payments.count({ where: paymentDateFilter as any }),
      prisma.players.count({ where: { created_at: { gte: todayStart } } }),
      prisma.players.count({ where: { created_at: { gte: monthStart } } }),
      prisma.$queryRaw`
        SELECT
          DATE(created_at AT TIME ZONE 'UTC') as date,
          COALESCE(SUM(amount), 0)::float as revenue,
          COALESCE(SUM(admin_fee), 0)::float as fees,
          COUNT(*)::int as count
        FROM payments
        WHERE status = 'succeeded' AND created_at >= ${rangeFrom} AND created_at <= ${rangeTo}
        GROUP BY DATE(created_at AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `,
      prisma.$queryRaw`
        SELECT
          DATE(created_at AT TIME ZONE 'UTC') as date,
          COUNT(*)::int as count
        FROM players
        WHERE created_at >= ${rangeFrom} AND created_at <= ${rangeTo}
        GROUP BY DATE(created_at AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `,
      prisma.$queryRaw`
        SELECT
          p.company_id as "companyId",
          c.name as "companyName",
          COALESCE(SUM(p.amount), 0)::float as "totalRevenue",
          COUNT(*)::int as "salesCount"
        FROM payments p
        JOIN companies c ON c.id = p.company_id
        WHERE p.status = 'succeeded' AND p.created_at >= ${rangeFrom} AND p.created_at <= ${rangeTo}
        GROUP BY p.company_id, c.name
        ORDER BY "totalRevenue" DESC
        LIMIT 10
      `,
      prisma.$queryRaw`
        SELECT status, COUNT(*)::int as count
        FROM payments
        WHERE created_at >= ${rangeFrom} AND created_at <= ${rangeTo}
        GROUP BY status
      `,
      prisma.$queryRaw`
        SELECT status, COUNT(*)::int as count
        FROM raffles
        WHERE deleted_at IS NULL
        GROUP BY status
      `,
      prisma.payments.findMany({
        where: { status: 'succeeded', created_at: { gte: rangeFrom, lte: rangeTo } },
        include: {
          company: { select: { name: true } },
          raffle: { select: { name: true } },
          player: { select: { name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      prisma.raffles.findMany({
        where: { status: { in: ['draft', 'active'] }, deleted_at: null },
        include: { company: { select: { name: true } } },
        orderBy: { scheduled_at: 'asc' },
        take: 5,
      }),
    ]);

    const formatDate = (d: any) =>
      d instanceof Date ? d.toISOString().split('T')[0] : String(d);

    res.json({
      stats: {
        totalCompanies,
        totalPlayers,
        totalRevenue: Number(revenueTotals._sum.amount || 0),
        totalAdminFees: Number(revenueTotals._sum.admin_fee || 0),
        totalTicketsSold,
        activeRaffles,
        finishedRaffles,
        upcomingRaffles: upcomingRafflesCount,
        totalSalesCount,
        newPlayersToday,
        newPlayersThisMonth,
      },
      revenueByDay: (revenueByDayRaw as any[]).map(r => ({
        date: formatDate(r.date),
        revenue: Number(r.revenue),
        fees: Number(r.fees),
        count: Number(r.count),
      })),
      playerRegistrationsByDay: (playerRegByDayRaw as any[]).map(r => ({
        date: formatDate(r.date),
        count: Number(r.count),
      })),
      salesByCompany: salesByCompanyRaw as any[],
      paymentStatusDistribution: paymentStatusRaw as any[],
      raffleStatusDistribution: raffleStatusRaw as any[],
      recentSales: (recentSalesRaw as any[]).map(p => ({
        id: p.id,
        amount: Number(p.amount),
        adminFee: Number(p.admin_fee || 0),
        status: p.status,
        createdAt: p.created_at,
        companyName: p.company?.name || '-',
        raffleName: p.raffle?.name || '-',
        playerName: p.player?.name || '-',
      })),
      upcomingRafflesList: (upcomingRafflesListRaw as any[]).map(r => ({
        id: r.id,
        name: r.name,
        companyName: r.company?.name || '-',
        ticketPrice: Number(r.ticket_price),
        scheduledAt: r.scheduled_at,
        status: r.status,
      })),
    });
  } catch (err) { next(err); }
});

// GET /financial-stats - super admin financial stats
router.get('/financial-stats', authMiddleware, requireSuperAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);

    const where: Record<string, unknown> = { status: 'succeeded' };
    if (Object.keys(dateFilter).length > 0) {
      where.processed_at = dateFilter;
    }

    const [totals, count] = await Promise.all([
      prisma.payments.aggregate({
        where: where as any,
        _sum: { amount: true, admin_fee: true, net_amount: true },
      }),
      prisma.payments.count({ where: where as any }),
    ]);

    res.json({
      totalRevenue: Number(totals._sum.amount || 0),
      totalFees: Number(totals._sum.admin_fee || 0),
      totalNet: Number(totals._sum.net_amount || 0),
      transactionCount: count,
    });
  } catch (err) { next(err); }
});

// GET /payments - super admin all payments
router.get('/payments', authMiddleware, requireSuperAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);

    const where: Record<string, unknown> = {};
    if (Object.keys(dateFilter).length > 0) {
      where.created_at = dateFilter;
    }

    const payments = await prisma.payments.findMany({
      where: where as any,
      include: {
        company: { select: { name: true } },
        ticket: { select: { snapshot_data: true } },
        player: { select: { name: true, phone: true } },
        raffle: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    res.json(payments.map((p: any) => {
      const snap = (p.ticket?.snapshot_data as Record<string, any>) || {};
      return {
        ...p,
        company_name: p.company?.name || null,
        raffle_name: p.raffle?.name || null,
        player_name: p.player?.name || null,
        is_street_sale: !!snap.is_street_sale,
        seller_email: snap.seller_email || null,
        company: undefined,
        ticket: undefined,
        player: undefined,
        raffle: undefined,
      };
    }));
  } catch (err) { next(err); }
});

// GET /user-roles - super admin user roles list
router.get('/user-roles', authMiddleware, requireSuperAdmin(), async (_req: AuthRequest, res, next) => {
  try {
    const roles = await prisma.user_roles.findMany({
      include: {
        user: { select: { email: true } },
        company: { select: { name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(roles.map((r) => ({
      ...r,
      user_email: r.user?.email || null,
      company_name: r.company?.name || null,
      user: undefined,
      company: undefined,
    })));
  } catch (err) { next(err); }
});

// DELETE /user-roles/:id - super admin delete user role
router.delete('/user-roles/:id', authMiddleware, requireSuperAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const roleId = req.params.id as string;
    const role = await prisma.user_roles.findUnique({
      where: { id: roleId },
      include: { user: { select: { email: true } } },
    });

    await prisma.user_roles.delete({
      where: { id: roleId },
    });

    if (role) {
      const { log } = await import('../services/audit.service.js');
      await log({
        companyId: role.company_id || undefined,
        userId: req.user!.userId,
        action: 'USER_ROLE_REMOVED',
        entityType: 'user_role',
        entityId: roleId,
        changesJson: { deleted: { role: role.role, user_email: role.user?.email, company_id: role.company_id } },
      });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
