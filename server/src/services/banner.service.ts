import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import * as audit from './audit.service.js';
import { buildCreateChanges, buildDeleteChanges, buildUpdateChanges } from '../utils/auditChanges.js';

const BANNER_FIELDS = ['image_url', 'redirect_url', 'display_order', 'is_active'];

export async function getByCompany(companyId: string) {
  return prisma.company_banners.findMany({
    where: { company_id: companyId },
    orderBy: [{ display_order: 'asc' }, { created_at: 'desc' }],
  });
}

export async function create(
  companyId: string,
  data: {
    image_url: string;
    redirect_url?: string;
    display_order?: number;
    is_active?: boolean;
  },
  userId?: string,
) {
  if (!data.image_url) {
    throw new BadRequestError('Image URL is required');
  }

  const banner = await prisma.company_banners.create({
    data: {
      company_id: companyId,
      image_url: data.image_url,
      redirect_url: data.redirect_url || null,
      display_order: data.display_order ?? 0,
      is_active: data.is_active ?? true,
    },
  });

  await audit.log({
    companyId,
    userId,
    action: 'BANNER_CREATED',
    entityType: 'banner',
    entityId: banner.id,
    changesJson: buildCreateChanges(banner, BANNER_FIELDS),
  });

  return banner;
}

export async function update(
  id: string,
  data: {
    image_url?: string;
    redirect_url?: string;
    display_order?: number;
    is_active?: boolean;
  },
  userId?: string,
) {
  const banner = await prisma.company_banners.findUnique({ where: { id } });
  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  const updated = await prisma.company_banners.update({
    where: { id },
    data: {
      ...(data.image_url !== undefined ? { image_url: data.image_url } : {}),
      ...(data.redirect_url !== undefined
        ? { redirect_url: data.redirect_url || null }
        : {}),
      ...(data.display_order !== undefined
        ? { display_order: data.display_order }
        : {}),
      ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      updated_at: new Date(),
    },
  });

  const changes = buildUpdateChanges(banner, updated, BANNER_FIELDS);
  if (changes) {
    await audit.log({
      companyId: banner.company_id,
      userId,
      action: 'BANNER_UPDATED',
      entityType: 'banner',
      entityId: id,
      changesJson: changes,
    });
  }

  return updated;
}

export async function deleteBanner(id: string, userId?: string) {
  const banner = await prisma.company_banners.findUnique({ where: { id } });
  if (!banner) {
    throw new NotFoundError('Banner not found');
  }

  const result = await prisma.company_banners.delete({ where: { id } });

  await audit.log({
    companyId: banner.company_id,
    userId,
    action: 'BANNER_DELETED',
    entityType: 'banner',
    entityId: id,
    changesJson: buildDeleteChanges(banner, BANNER_FIELDS),
  });

  return result;
}
