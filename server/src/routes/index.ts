import { Router, Response } from 'express';
import authRoutes from './auth.routes.js';
import playerRoutes from './player.routes.js';
import companyRoutes from './companies.routes.js';
import raffleRoutes from './raffles.routes.js';
import raffleDiscountsRoutes from './raffleDiscounts.routes.js';
import ticketRoutes from './tickets.routes.js';
import drawRoutes from './draws.routes.js';
import paymentRoutes from './payments.routes.js';
import affiliateRoutes from './affiliates.routes.js';
import commissionRoutes from './commissions.routes.js';
import stripeRoutes, { stripeWebhookRouter } from './stripe.routes.js';
import settingsRoutes from './settings.routes.js';
import bannerRoutes from './banners.routes.js';
import auditRoutes from './audit.routes.js';
import financialRoutes from './financial.routes.js';
import webhookRoutes from './webhook.routes.js';
import uploadRoutes from './upload.routes.js';
import adminRoutes from './admin.routes.js';
import playerAuthRoutes from './playerAuth.routes.js';
import permissionProfileRoutes from './permissionProfiles.routes.js';
import streetSaleRoutes from './streetSales.routes.js';
import { AuthRequest } from '../types/index.js';

const apiRouter = Router();

// ─── Tenant resolution endpoint ─────────────────────
// Returns the company resolved from the Host header by tenantResolver middleware
apiRouter.get('/tenant/resolve', (req: AuthRequest, res: Response) => {
  if (!req.tenant) {
    return res.status(404).json({ error: 'Tenant not found for this domain' });
  }
  return res.json(req.tenant);
});

// Mount the Stripe webhook route BEFORE json parsing is applied
// This route needs raw body for Stripe signature verification
apiRouter.use('/stripe/webhook', stripeWebhookRouter);

// Standard JSON-parsed routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/players', playerRoutes);
apiRouter.use('/companies', companyRoutes);
apiRouter.use('/raffles', raffleRoutes);
apiRouter.use('/raffles', raffleDiscountsRoutes);
apiRouter.use('/tickets', ticketRoutes);
apiRouter.use('/draws', drawRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/affiliates', affiliateRoutes);
apiRouter.use('/commissions', commissionRoutes);
apiRouter.use('/stripe', stripeRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/banners', bannerRoutes);
apiRouter.use('/audit-logs', auditRoutes);
apiRouter.use('/financial-logs', financialRoutes);
apiRouter.use('/webhook-logs', webhookRoutes);
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/player-auth', playerAuthRoutes);
apiRouter.use('/permission-profiles', permissionProfileRoutes);
apiRouter.use('/street-sales', streetSaleRoutes);

export { apiRouter, stripeWebhookRouter };
