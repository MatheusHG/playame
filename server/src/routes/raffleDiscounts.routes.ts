import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess } from '../middleware/roleGuard.js';
import * as raffleDiscountService from '../services/raffleDiscount.service.js';
import { AuthRequest } from '../types/index.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { prisma } from '../config/database.js';

const router = Router();

/** Resolve companyId from user roles or from the raffle (for SUPER_ADMIN) */
async function resolveCompanyId(req: AuthRequest, raffleId: string): Promise<string> {
    const fromRole = req.user!.roles.find(r => r.companyId)?.companyId;
    if (fromRole) return fromRole;

    // SUPER_ADMIN doesn't have a companyId in roles – look up from the raffle
    const raffle = await prisma.raffles.findUnique({
        where: { id: raffleId },
        select: { company_id: true },
    });
    if (!raffle) throw new NotFoundError('Sorteio não encontrado.');
    return raffle.company_id;
}

// Create discount
router.post(
    '/:raffleId/discounts',
    authMiddleware,
    requireCompanyAccess(),
    async (req: AuthRequest, res, next) => {
        try {
            const raffleId = req.params.raffleId as string;
            const { min_quantity, discount_percent, is_active } = req.body;

            if (!min_quantity || min_quantity < 2) {
                throw new BadRequestError('A quantidade mínima deve ser maior que 1');
            }
            if (!discount_percent || discount_percent <= 0 || discount_percent > 100) {
                throw new BadRequestError('O desconto deve ser entre 0.01% e 100%');
            }

            const companyId = await resolveCompanyId(req, raffleId);

            const discount = await raffleDiscountService.create(companyId, raffleId, {
                min_quantity,
                discount_percent,
                is_active,
            }, req.user!.userId as string);
            res.status(201).json(discount);
        } catch (error) {
            next(error);
        }
    }
);

// Get all discounts for a raffle
router.get('/:raffleId/discounts', async (req, res, next) => {
    try {
        const { raffleId } = req.params;
        const discounts = await raffleDiscountService.findAll(raffleId);
        res.json(discounts);
    } catch (error) {
        next(error);
    }
});

// Delete discount
router.delete(
    '/:raffleId/discounts/:id',
    authMiddleware,
    requireCompanyAccess(),
    async (req: AuthRequest, res, next) => {
        try {
            const raffleId = req.params.raffleId as string;
            const id = req.params.id as string;
            const companyId = await resolveCompanyId(req, raffleId);

            await raffleDiscountService.remove(companyId, raffleId, id, req.user!.userId as string);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

export default router;
