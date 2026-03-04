import { Router } from 'express';
import { playerAuthMiddleware } from '../middleware/playerAuth.js';
import * as playerService from '../services/player.service.js';
import { PlayerAuthRequest } from '../types/index.js';

const router = Router();

// POST /change-password - player auth: change password
router.post('/change-password', playerAuthMiddleware, async (req: PlayerAuthRequest, res, next) => {
  try {
    const { playerId, currentPassword, newPassword } = req.body;
    await playerService.changePassword(playerId || req.player!.playerId, currentPassword, newPassword);
    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (err) { next(err); }
});

// POST /update-profile - player auth: update profile
router.post('/update-profile', playerAuthMiddleware, async (req: PlayerAuthRequest, res, next) => {
  try {
    const { playerId, name, city, phone } = req.body;
    const player = await playerService.updateProfile(playerId || req.player!.playerId, { name, city, phone });
    res.json({ player });
  } catch (err) { next(err); }
});

export default router;
