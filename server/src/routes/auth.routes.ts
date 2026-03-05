import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// POST /login - public
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /register - public
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, role, company_id } = req.body;
    const result = await authService.register(email, password, role, company_id);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /logout - auth required
router.post('/logout', authMiddleware, async (_req: AuthRequest, res, next) => {
  try {
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) { next(err); }
});

// GET /me - auth required
router.get('/me', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const result = await authService.getMe(req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /reset-password - auth required
router.post('/reset-password', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { newPassword } = req.body;
    const result = await authService.resetPassword(req.user!.userId, newPassword);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /update-password - public (with recovery token)
router.post('/update-password', async (req, res, next) => {
  try {
    const { password, token } = req.body;
    await authService.updatePasswordWithToken(token, password);
    res.json({ success: true, message: 'Senha redefinida com sucesso' });
  } catch (err) { next(err); }
});

export default router;
