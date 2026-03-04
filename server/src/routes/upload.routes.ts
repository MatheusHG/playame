import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import * as uploadService from '../services/upload.service.js';
import { AuthRequest } from '../types/index.js';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// POST / - auth, uses multer
router.post('/', authMiddleware, upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const file = req.file!;
    const { companyId, folder } = req.body;
    const result = await uploadService.uploadFile(file as { buffer: Buffer; mimetype: string; originalname: string; size: number }, companyId, folder);
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
