import { Router, raw } from 'express';
import { playerAuthMiddleware } from '../middleware/playerAuth.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/roleGuard.js';
import { rateLimit } from '../middleware/rateLimiter.js';
import * as stripeService from '../services/stripe.service.js';
import { AuthRequest, PlayerAuthRequest } from '../types/index.js';

const router = Router();

// Webhook router exported separately for raw body parsing
export const stripeWebhookRouter = Router();

// POST /checkout - player auth (rate limited)
router.post('/checkout', playerAuthMiddleware, rateLimit('stripe_checkout'), async (req: PlayerAuthRequest, res, next) => {
  try {
    const result = await stripeService.createCheckout(req.body);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /resume - player auth
router.post('/resume', playerAuthMiddleware, async (req: PlayerAuthRequest, res, next) => {
  try {
    const result = await stripeService.resumeCheckout(req.body.paymentId, req.player!.playerId, req.body.origin);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /keys - auth + super admin
router.post('/keys', authMiddleware, requireSuperAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await stripeService.manageKeys(req.body.companyId, req.body.action, req.body.keys, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /webhook - public (Stripe signature verification)
// Uses express.raw() middleware instead of json parsing
stripeWebhookRouter.post('/', raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const companyId = (req.query.companyId ?? req.headers['x-company-id']) as string;
    const result = await stripeService.handleWebhook(req.body, signature, companyId);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
