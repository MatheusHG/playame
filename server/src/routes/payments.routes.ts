import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess, requireCompanyAdmin } from '../middleware/roleGuard.js';
import * as paymentService from '../services/payment.service.js';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /company/:companyId - auth + company access
router.get('/company/:companyId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const result = await paymentService.getByCompany(req.params.companyId as string);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /:id/action - auth + company admin
router.post('/:id/action', authMiddleware, requireCompanyAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const { action } = req.body;
    let result;

    if (action === 'approve') {
      result = await paymentService.approve(req.params.id as string, req.user!.userId);
    } else if (action === 'reject') {
      result = await paymentService.reject(req.params.id as string, req.user!.userId);
    } else {
      res.status(400).json({ error: 'Invalid action. Use "approve" or "reject".' });
      return;
    }

    res.json(result);
  } catch (err) { next(err); }
});

// GET /net-sales/:raffleId - used by raffle pages for prize pool display + financial breakdown
router.get('/net-sales/:raffleId', async (req, res, next) => {
  try {
    const where = { raffle_id: req.params.raffleId, status: 'succeeded' as const };

    const [paymentAgg, commissionAgg, ticketCount] = await Promise.all([
      prisma.payments.aggregate({
        where,
        _sum: {
          prize_pool_contribution: true,
          amount: true,
          admin_fee: true,
          net_amount: true,
          company_retention: true,
        },
      }),
      prisma.affiliate_commissions.aggregate({
        where: { raffle_id: req.params.raffleId },
        _sum: {
          super_admin_amount: true,
          manager_gross_amount: true,
          cambista_amount: true,
        },
      }),
      prisma.payments.count({ where }),
    ]);

    const totalPrizePoolContribution = Number(paymentAgg._sum.prize_pool_contribution ?? 0);
    const totalGross = Number(paymentAgg._sum.amount ?? 0);
    const totalAdminFee = Number(paymentAgg._sum.admin_fee ?? 0);
    const totalNet = Number(paymentAgg._sum.net_amount ?? 0);
    const totalCompanyRetention = Number(paymentAgg._sum.company_retention ?? 0);

    const totalSuperAdminFee = Number(commissionAgg._sum.super_admin_amount ?? 0);
    const totalManagerCommission = Number(commissionAgg._sum.manager_gross_amount ?? 0);
    const totalCambistaCommission = Number(commissionAgg._sum.cambista_amount ?? 0);
    const totalAffiliateCommissions = totalManagerCommission + totalCambistaCommission;

    // Fallback for pre-migration data
    let total = totalPrizePoolContribution;
    if (total === 0 && totalGross > 0) {
      total = totalNet;
    }

    res.json({
      total,
      gross: totalGross,
      admin_fee: totalAdminFee,
      net: totalNet,
      super_admin_fee: totalSuperAdminFee,
      affiliate_commissions: totalAffiliateCommissions,
      manager_commissions: totalManagerCommission,
      cambista_commissions: totalCambistaCommission,
      company_retention: totalCompanyRetention,
      prize_pool_contribution: totalPrizePoolContribution,
      ticket_count: ticketCount,
    });
  } catch (err) { next(err); }
});

// GET /net-sales-by-raffle/:companyId - public, returns prize_pool_contribution per raffle
router.get('/net-sales-by-raffle/:companyId', async (req, res, next) => {
  try {
    const companyId = req.params.companyId as string;
    const raffleIdsParam = req.query.raffleIds as string;
    if (!raffleIdsParam) {
      res.json({});
      return;
    }
    const raffleIds = raffleIdsParam.split(',').filter(Boolean);

    const rows = await prisma.payments.groupBy({
      by: ['raffle_id'],
      where: {
        company_id: companyId,
        raffle_id: { in: raffleIds },
        status: 'succeeded',
      },
      _sum: {
        prize_pool_contribution: true,
        net_amount: true,
        amount: true,
      },
    });

    const result: Record<string, number> = {};
    for (const row of rows) {
      const contrib = Number(row._sum.prize_pool_contribution ?? 0);
      // Fallback for pre-migration data
      result[row.raffle_id] = contrib > 0 ? contrib : Number(row._sum.net_amount ?? 0);
    }

    res.json(result);
  } catch (err) { next(err); }
});

export default router;
