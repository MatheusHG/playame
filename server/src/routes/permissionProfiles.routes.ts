import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireCompanyAccess } from '../middleware/roleGuard.js';
import { prisma } from '../config/database.js';
import { AuthRequest } from '../types/index.js';
import * as audit from '../services/audit.service.js';
import { buildCreateChanges, buildDeleteChanges, buildUpdateChanges } from '../utils/auditChanges.js';

const PROFILE_FIELDS = ['name', 'description', 'affiliate_type', 'permissions', 'is_default'];

const router = Router();

// GET /:companyId - list permission profiles for a company
router.get('/:companyId', authMiddleware, requireCompanyAccess(), async (req: AuthRequest, res, next) => {
  try {
    const profiles = await prisma.permission_profiles.findMany({
      where: { company_id: req.params.companyId as string },
      orderBy: { created_at: 'desc' },
    });
    res.json(profiles);
  } catch (err) { next(err); }
});

// POST / - create permission profile
router.post('/', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { company_id, name, description, affiliate_type, permissions, is_default } = req.body;

    const profile = await prisma.permission_profiles.create({
      data: {
        company_id,
        name,
        description: description || null,
        affiliate_type,
        permissions: permissions || {},
        is_default: is_default || false,
      },
    });

    await audit.log({
      companyId: company_id,
      userId: req.user!.userId,
      action: 'PERMISSION_PROFILE_CREATED',
      entityType: 'permission_profile',
      entityId: profile.id,
      changesJson: buildCreateChanges(profile, PROFILE_FIELDS),
    });

    res.status(201).json(profile);
  } catch (err) { next(err); }
});

// PATCH /:id - update permission profile
router.patch('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const { name, description, permissions, is_default } = req.body;

    const before = await prisma.permission_profiles.findUnique({
      where: { id: req.params.id as string },
    });

    const profile = await prisma.permission_profiles.update({
      where: { id: req.params.id as string },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(permissions !== undefined ? { permissions } : {}),
        ...(is_default !== undefined ? { is_default } : {}),
        updated_at: new Date(),
      },
    });

    if (before) {
      const changes = buildUpdateChanges(before, profile, PROFILE_FIELDS);
      if (changes) {
        await audit.log({
          companyId: before.company_id,
          userId: req.user!.userId,
          action: 'PERMISSION_PROFILE_UPDATED',
          entityType: 'permission_profile',
          entityId: profile.id,
          changesJson: changes,
        });
      }
    }

    res.json(profile);
  } catch (err) { next(err); }
});

// DELETE /:id - delete permission profile
router.delete('/:id', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const profile = await prisma.permission_profiles.findUnique({
      where: { id: req.params.id as string },
    });

    await prisma.permission_profiles.delete({
      where: { id: req.params.id as string },
    });

    if (profile) {
      await audit.log({
        companyId: profile.company_id,
        userId: req.user!.userId,
        action: 'PERMISSION_PROFILE_DELETED',
        entityType: 'permission_profile',
        entityId: req.params.id as string,
        changesJson: buildDeleteChanges(profile, PROFILE_FIELDS),
      });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
