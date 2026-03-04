import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess, requireCompanyAdmin } from '../middleware/roleGuard.js';
import * as streetSaleService from '../services/streetSale.service.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /company/:companyId => List street sales matching filters
router.get('/company/:companyId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
    try {
        const companyId = req.params.companyId as string;
        const { search, raffleId, startDate, endDate } = req.query;

        const result = await streetSaleService.getStreetSales({
            companyId,
            search: search as string,
            raffleId: raffleId as string,
            startDate: startDate as string,
            endDate: endDate as string,
        });

        res.json(result);
    } catch (err) { next(err); }
});

// GET /:paymentId/detail => Get full street sale detail
router.get('/:paymentId/detail', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
    try {
        const result = await streetSaleService.getStreetSaleDetail(req.params.paymentId as string);
        res.json(result);
    } catch (err) { next(err); }
});

// POST /company/:companyId => Create a new street sale
router.post('/company/:companyId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
    try {
        const companyId = req.params.companyId as string;
        const userId = req.user!.userId;
        const { raffleId, customerName, customerPhone, quantity, ticketNumbers } = req.body;

        const result = await streetSaleService.createStreetSale({
            companyId,
            userId,
            raffleId,
            customerName,
            customerPhone,
            quantity,
            ticketNumbers
        });

        res.json(result);
    } catch (err) { next(err); }
});

export default router;
