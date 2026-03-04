import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess, requireCompanyAdmin } from '../middleware/roleGuard.js';
import * as affiliateService from '../services/affiliate.service.js';
import * as audit from '../services/audit.service.js';
import { AuthRequest } from '../types/index.js';
import { prisma } from '../config/database.js';
import { getCompanyId } from '../utils/tenant.js';

const router = Router();

// GET /company/:companyId - auth + company access
router.get('/company/:companyId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const result = await affiliateService.getByCompany(getCompanyId(req));
    res.json(result);
  } catch (err) { next(err); }
});

// GET /by-link/:code - public
router.get('/by-link/:code', async (req, res, next) => {
  try {
    const result = await affiliateService.getByLinkCode(req.params.code as string);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /:id - auth
router.get('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const result = await affiliateService.getById(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /:id/sales-stats - affiliate sales stats
router.get('/:id/sales-stats', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const affiliateId = req.params.id as string;
    const { from, to } = req.query;
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);
    const where: any = { affiliate_id: affiliateId };
    if (Object.keys(dateFilter).length > 0) where.created_at = dateFilter;

    const [totalSales, confirmedTickets, totalValueAgg] = await Promise.all([
      prisma.tickets.count({ where }),
      prisma.tickets.count({ where: { ...where, status: { in: ['active', 'winner'] } } }),
      prisma.payments.aggregate({
        where: { ticket: { affiliate_id: affiliateId }, status: 'succeeded', ...(Object.keys(dateFilter).length > 0 ? { created_at: dateFilter } : {}) },
        _sum: { amount: true },
      }),
    ]);

    res.json({
      totalSales,
      confirmedSales: confirmedTickets,
      totalValue: Number(totalValueAgg._sum.amount || 0),
    });
  } catch (err) { next(err); }
});

// GET /:id/commission-stats - affiliate commission stats
router.get('/:id/commission-stats', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const affiliateId = req.params.id as string;
    const { from, to } = req.query;
    const dateFilter: any = {};
    if (from) dateFilter.gte = new Date(from as string);
    if (to) dateFilter.lte = new Date(to as string);

    const affiliate = await prisma.affiliates.findUnique({ where: { id: affiliateId }, select: { type: true } });
    const isManager = affiliate?.type === 'manager';

    const where: any = isManager
      ? { manager_id: affiliateId }
      : { cambista_id: affiliateId };
    if (Object.keys(dateFilter).length > 0) where.created_at = dateFilter;

    const totals = await prisma.affiliate_commissions.aggregate({
      where,
      _sum: isManager
        ? { manager_net_amount: true }
        : { cambista_amount: true },
    });

    const totalCommission = Number(
      isManager ? (totals._sum as any).manager_net_amount || 0 : (totals._sum as any).cambista_amount || 0
    );

    res.json({ totalCommission, paidCommission: 0 });
  } catch (err) { next(err); }
});

// GET /:id/team-count - affiliate team count (managers)
router.get('/:id/team-count', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const count = await prisma.affiliates.count({
      where: { parent_affiliate_id: req.params.id as string, deleted_at: null, is_active: true },
    });
    res.json({ count });
  } catch (err) { next(err); }
});

// GET /:id/team - list cambistas under this manager
router.get('/:id/team', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const affiliateId = req.params.id as string;

    // Verify the requesting user owns this affiliate
    if (req.user?.affiliateId && req.user.affiliateId !== affiliateId) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    // Verify the affiliate is a manager
    const affiliate = await prisma.affiliates.findUnique({
      where: { id: affiliateId },
      select: { type: true },
    });
    if (!affiliate || affiliate.type !== 'manager') {
      res.status(400).json({ error: 'Only managers can view team' }); return;
    }

    const team = await prisma.affiliates.findMany({
      where: {
        parent_affiliate_id: affiliateId,
        deleted_at: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        type: true,
        link_code: true,
        commission_percent: true,
        is_sales_paused: true,
        is_active: true,
        created_at: true,
        user_id: true,
        permission_profile: { select: { id: true, name: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(team);
  } catch (err) { next(err); }
});

// GET /:id/team-stats - sales stats per team member
router.get('/:id/team-stats', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const affiliateId = req.params.id as string;

    if (req.user?.affiliateId && req.user.affiliateId !== affiliateId) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    // Get all cambistas under this manager
    const cambistas = await prisma.affiliates.findMany({
      where: { parent_affiliate_id: affiliateId, deleted_at: null },
      select: { id: true },
    });

    const cambistaIds = cambistas.map(c => c.id);
    if (cambistaIds.length === 0) {
      res.json({}); return;
    }

    // Get ticket counts per cambista
    const statsRaw = await prisma.$queryRaw<{ affiliate_id: string; total: bigint; confirmed: bigint }[]>`
      SELECT
        affiliate_id,
        COUNT(*)::bigint as total,
        COUNT(*) FILTER (WHERE status IN ('active', 'winner'))::bigint as confirmed
      FROM tickets
      WHERE affiliate_id = ANY(${cambistaIds}::uuid[])
      GROUP BY affiliate_id
    `;

    const stats: Record<string, { total: number; confirmed: number }> = {};
    for (const row of statsRaw) {
      stats[row.affiliate_id] = {
        total: Number(row.total),
        confirmed: Number(row.confirmed),
      };
    }

    // Fill in zeros for cambistas with no sales
    for (const id of cambistaIds) {
      if (!stats[id]) {
        stats[id] = { total: 0, confirmed: 0 };
      }
    }

    res.json(stats);
  } catch (err) { next(err); }
});

// GET /:id/sales - list sales/tickets for this affiliate (managers see team sales too)
router.get('/:id/sales', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const affiliateId = req.params.id as string;

    if (req.user?.affiliateId && req.user.affiliateId !== affiliateId) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    // For managers, include their own sales AND their team's sales
    const affiliate = await prisma.affiliates.findUnique({
      where: { id: affiliateId },
      select: { type: true },
    });

    let affiliateIds: string[] = [affiliateId];
    if (affiliate?.type === 'manager') {
      const cambistas = await prisma.affiliates.findMany({
        where: { parent_affiliate_id: affiliateId, deleted_at: null },
        select: { id: true },
      });
      affiliateIds = [affiliateId, ...cambistas.map(c => c.id)];
    }

    const tickets = await prisma.tickets.findMany({
      where: { affiliate_id: { in: affiliateIds } },
      include: {
        raffle: { select: { name: true, ticket_price: true } },
        player: { select: { name: true, cpf_last4: true } },
        affiliate: { select: { name: true } },
        payments: { select: { id: true, amount: true, status: true, created_at: true }, take: 1, orderBy: { created_at: 'desc' } },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    // Flatten payment array to match frontend expectations
    const result = tickets.map(t => ({
      ...t,
      payment: t.payments,
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// GET /:id/commissions - list commissions for this affiliate
router.get('/:id/commissions', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const affiliateId = req.params.id as string;

    if (req.user?.affiliateId && req.user.affiliateId !== affiliateId) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    // Determine if manager or cambista
    const affiliate = await prisma.affiliates.findUnique({
      where: { id: affiliateId },
      select: { type: true },
    });
    if (!affiliate) {
      res.status(404).json({ error: 'Affiliate not found' }); return;
    }

    const isManager = affiliate.type === 'manager';
    const where = isManager
      ? { manager_id: affiliateId }
      : { cambista_id: affiliateId };

    const commissions = await prisma.affiliate_commissions.findMany({
      where,
      include: {
        raffle: { select: { name: true } },
        payment: { select: { status: true } },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    res.json(commissions);
  } catch (err) { next(err); }
});

// POST /:id/team - manager creates a cambista under their team
router.post('/:id/team', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const managerId = req.params.id as string;

    if (req.user?.affiliateId && req.user.affiliateId !== managerId) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    // Verify the affiliate is a manager
    const manager = await prisma.affiliates.findUnique({
      where: { id: managerId },
      select: { type: true, company_id: true },
    });
    if (!manager || manager.type !== 'manager') {
      res.status(400).json({ error: 'Only managers can create team members' }); return;
    }

    const { name, phone, email, commission_percent, permission_profile_id } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Name is required' }); return;
    }

    const linkCode = `cam_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const cambista = await prisma.affiliates.create({
      data: {
        company_id: manager.company_id,
        name,
        type: 'cambista',
        phone: phone || null,
        email: email || null,
        parent_affiliate_id: managerId,
        commission_percent: commission_percent ?? 0,
        permission_profile_id: permission_profile_id || null,
        link_code: linkCode,
        created_by: req.user?.userId || null,
        is_active: true,
      },
      include: {
        permission_profile: { select: { id: true, name: true } },
      },
    });

    await audit.log({
      companyId: manager.company_id,
      userId: req.user?.userId,
      action: 'AFFILIATE_CREATED',
      entityType: 'affiliate',
      entityId: cambista.id,
      changesJson: { created: { name, type: 'cambista', phone: phone || null, email: email || null, commission_percent: commission_percent ?? 0, parent_affiliate_id: managerId } },
    });

    res.status(201).json(cambista);
  } catch (err) { next(err); }
});

// PATCH /:id/team/:memberId - manager updates a cambista in their team
router.patch('/:id/team/:memberId', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const managerId = req.params.id as string;
    const memberId = req.params.memberId as string;

    if (req.user?.affiliateId && req.user.affiliateId !== managerId) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    // Verify the member belongs to this manager
    const member = await prisma.affiliates.findUnique({
      where: { id: memberId },
      select: { parent_affiliate_id: true, commission_percent: true, company_id: true },
    });
    if (!member || member.parent_affiliate_id !== managerId) {
      res.status(403).json({ error: 'This member is not in your team' }); return;
    }

    const { name, phone, email, commission_percent, permission_profile_id } = req.body;

    // Track commission changes
    if (commission_percent !== undefined && Number(commission_percent) !== Number(member.commission_percent)) {
      await prisma.commission_rate_changes.create({
        data: {
          entity_type: 'affiliate',
          entity_id: memberId,
          field_changed: 'commission_percent',
          old_value: member.commission_percent,
          new_value: commission_percent,
          changed_by: req.user?.userId || null,
          company_id: member.company_id,
        },
      });
    }

    // Fetch full member before update for audit
    const memberBefore = await prisma.affiliates.findUnique({ where: { id: memberId } });

    const updated = await prisma.affiliates.update({
      where: { id: memberId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(commission_percent !== undefined ? { commission_percent } : {}),
        ...(permission_profile_id !== undefined ? { permission_profile_id: permission_profile_id || null } : {}),
        updated_at: new Date(),
      },
      include: {
        permission_profile: { select: { id: true, name: true } },
      },
    });

    if (memberBefore) {
      const changedFields: Record<string, unknown> = {};
      const beforeFields: Record<string, unknown> = {};
      const afterFields: Record<string, unknown> = {};
      for (const f of ['name', 'phone', 'email', 'commission_percent', 'permission_profile_id']) {
        const oldVal = (memberBefore as any)[f];
        const newVal = (updated as any)[f];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          beforeFields[f] = oldVal;
          afterFields[f] = newVal;
        }
      }
      if (Object.keys(beforeFields).length > 0) {
        await audit.log({
          companyId: member.company_id,
          userId: req.user?.userId,
          action: 'AFFILIATE_UPDATED',
          entityType: 'affiliate',
          entityId: memberId,
          changesJson: { before: beforeFields, after: afterFields } as any,
        });
      }
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /:id/team/:memberId/pause - manager toggles pause for a cambista
router.patch('/:id/team/:memberId/pause', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const managerId = req.params.id as string;
    const memberId = req.params.memberId as string;

    if (req.user?.affiliateId && req.user.affiliateId !== managerId) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    // Verify the member belongs to this manager
    const member = await prisma.affiliates.findUnique({
      where: { id: memberId },
      select: { parent_affiliate_id: true, is_sales_paused: true },
    });
    if (!member || member.parent_affiliate_id !== managerId) {
      res.status(403).json({ error: 'This member is not in your team' }); return;
    }

    const newPausedState = !member.is_sales_paused;
    const updated = await prisma.affiliates.update({
      where: { id: memberId },
      data: {
        is_sales_paused: newPausedState,
        paused_at: newPausedState ? new Date() : null,
        paused_by: newPausedState ? req.user?.userId || null : null,
        updated_at: new Date(),
      },
    });

    const aff = await prisma.affiliates.findUnique({ where: { id: memberId }, select: { company_id: true } });
    await audit.log({
      companyId: aff?.company_id,
      userId: req.user?.userId,
      action: 'AFFILIATE_TOGGLED',
      entityType: 'affiliate',
      entityId: memberId,
      changesJson: { before: { is_sales_paused: member.is_sales_paused }, after: { is_sales_paused: newPausedState } },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /:id/team/:memberId - manager soft-deletes a cambista from their team
router.delete('/:id/team/:memberId', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const managerId = req.params.id as string;
    const memberId = req.params.memberId as string;

    if (req.user?.affiliateId && req.user.affiliateId !== managerId) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    // Verify the member belongs to this manager
    const member = await prisma.affiliates.findUnique({
      where: { id: memberId },
    });
    if (!member || member.parent_affiliate_id !== managerId) {
      res.status(403).json({ error: 'This member is not in your team' }); return;
    }

    const deleted = await prisma.affiliates.update({
      where: { id: memberId },
      data: {
        deleted_at: new Date(),
        is_active: false,
        updated_at: new Date(),
      },
    });

    await audit.log({
      companyId: member.company_id,
      userId: req.user?.userId,
      action: 'AFFILIATE_DELETED',
      entityType: 'affiliate',
      entityId: memberId,
      changesJson: { deleted: { name: member.name, type: member.type, email: member.email, phone: member.phone } },
    });

    res.json(deleted);
  } catch (err) { next(err); }
});

// POST /:id/team/:memberId/create-user - manager creates user account for a cambista
router.post('/:id/team/:memberId/create-user', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const managerId = req.params.id as string;
    const memberId = req.params.memberId as string;

    if (req.user?.affiliateId && req.user.affiliateId !== managerId) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }

    // Verify the member belongs to this manager
    const member = await prisma.affiliates.findUnique({
      where: { id: memberId },
      select: { parent_affiliate_id: true },
    });
    if (!member || member.parent_affiliate_id !== managerId) {
      res.status(403).json({ error: 'This member is not in your team' }); return;
    }

    const { email, password } = req.body;
    const result = await affiliateService.createUser(memberId, email, password);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// GET /:id/dashboard - rich affiliate dashboard
router.get('/:id/dashboard', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const affiliateId = req.params.id as string;
    const { from, to } = req.query;
    const now = new Date();
    const rangeFrom = from ? new Date(from as string) : new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeTo = to ? new Date(to as string) : now;

    const affiliate = await prisma.affiliates.findUnique({
      where: { id: affiliateId },
      select: { type: true, commission_percent: true, company_id: true },
    });
    if (!affiliate) { res.status(404).json({ error: 'Affiliate not found' }); return; }

    const isManager = affiliate.type === 'manager';

    // For managers, include their own sales AND their team's sales
    let affiliateIds: string[] = [affiliateId];
    if (isManager) {
      const cambistas = await prisma.affiliates.findMany({
        where: { parent_affiliate_id: affiliateId, deleted_at: null },
        select: { id: true },
      });
      affiliateIds = [affiliateId, ...cambistas.map(c => c.id)];
    }

    const commWhere: any = isManager ? { manager_id: affiliateId } : { cambista_id: affiliateId };
    const commWhereDate: any = { ...commWhere, created_at: { gte: rangeFrom, lte: rangeTo } };
    const ticketWhere: any = { affiliate_id: { in: affiliateIds }, created_at: { gte: rangeFrom, lte: rangeTo } };

    const [
      totalSales,
      confirmedSales,
      totalValueAgg,
      commissionTotals,
      teamCount,
      salesByDayRaw,
      recentSalesRaw,
    ] = await Promise.all([
      prisma.tickets.count({ where: ticketWhere }),
      prisma.tickets.count({ where: { ...ticketWhere, status: { in: ['active', 'winner'] } } }),
      prisma.payments.aggregate({
        where: { ticket: { affiliate_id: { in: affiliateIds } }, status: 'succeeded', created_at: { gte: rangeFrom, lte: rangeTo } },
        _sum: { amount: true },
      }),
      prisma.affiliate_commissions.aggregate({
        where: commWhereDate,
        _sum: isManager
          ? { manager_net_amount: true, sale_amount: true }
          : { cambista_amount: true, sale_amount: true },
      }),
      isManager
        ? prisma.affiliates.count({ where: { parent_affiliate_id: affiliateId, deleted_at: null, is_active: true } })
        : Promise.resolve(0),
      prisma.$queryRaw`
        SELECT DATE(p.created_at AT TIME ZONE 'UTC') as date,
               COALESCE(SUM(p.amount),0)::float as value,
               COUNT(*)::int as count
        FROM payments p
        JOIN tickets t ON t.id = p.ticket_id
        WHERE t.affiliate_id = ANY(${affiliateIds}::uuid[]) AND p.status = 'succeeded'
          AND p.created_at >= ${rangeFrom} AND p.created_at <= ${rangeTo}
        GROUP BY DATE(p.created_at AT TIME ZONE 'UTC')
        ORDER BY date ASC
      `,
      prisma.payments.findMany({
        where: { ticket: { affiliate_id: { in: affiliateIds } }, status: 'succeeded', created_at: { gte: rangeFrom, lte: rangeTo } },
        include: {
          raffle: { select: { name: true } },
          player: { select: { name: true } },
          ticket: { select: { affiliate: { select: { name: true } } } },
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
    ]);

    const totalCommission = Number(
      isManager ? (commissionTotals._sum as any).manager_net_amount || 0 : (commissionTotals._sum as any).cambista_amount || 0
    );

    const fmtDate = (d: any) => d instanceof Date ? d.toISOString().split('T')[0] : String(d);

    res.json({
      stats: {
        totalSales,
        confirmedSales,
        totalValue: Number(totalValueAgg._sum.amount || 0),
        totalCommission,
        commissionPercent: Number(affiliate.commission_percent),
        teamCount,
        type: affiliate.type,
      },
      salesByDay: (salesByDayRaw as any[]).map(r => ({
        date: fmtDate(r.date), value: Number(r.value), count: Number(r.count),
      })),
      recentSales: (recentSalesRaw as any[]).map(p => ({
        id: p.id, amount: Number(p.amount), createdAt: p.created_at,
        raffleName: p.raffle?.name || '-', playerName: p.player?.name || '-',
        affiliateName: (p as any).ticket?.affiliate?.name || null,
      })),
    });
  } catch (err) { next(err); }
});

// POST /company/:companyId - auth + company admin
router.post('/company/:companyId', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await affiliateService.create(getCompanyId(req), req.body, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// PATCH /:id - auth + company admin
router.patch('/:id', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await affiliateService.update(req.params.id as string, req.body, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /:id - auth + company admin
router.delete('/:id', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await affiliateService.deleteAffiliate(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// PATCH /:id/pause - auth + company admin
router.patch('/:id/pause', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await affiliateService.togglePause(req.params.id as string, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /:id/create-user - auth + company admin
router.post('/:id/create-user', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await affiliateService.createUser(req.params.id as string, email, password, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

export default router;
