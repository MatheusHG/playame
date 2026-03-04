import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/roleGuard.js';
import * as settingsService from '../services/settings.service.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET / - auth
router.get('/', authMiddleware, async (_req: AuthRequest, res, next) => {
  try {
    const result = await settingsService.getAll();
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /:key - auth + super admin
router.put('/:key', authMiddleware, requireSuperAdmin(), async (req: AuthRequest, res, next) => {
  try {
    const result = await settingsService.update(req.params.key as string, req.body.value, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
