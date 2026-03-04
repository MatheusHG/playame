import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import * as audit from './audit.service.js';
import { buildCreateChanges, buildUpdateChanges, buildDeleteChanges } from '../utils/auditChanges.js';
import { invalidateTenantCache } from '../middleware/tenantResolver.js';

// UUID v4 regex check
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPANY_FIELDS = ['name', 'slug', 'custom_domain', 'logo_url', 'primary_color', 'secondary_color', 'payment_method', 'admin_fee_percentage', 'status', 'payments_enabled', 'community_url', 'community_name'];

export async function getByIdentifier(identifier: string) {
  const isUuid = UUID_REGEX.test(identifier);

  const company = await prisma.companies.findFirst({
    where: isUuid
      ? { id: identifier, deleted_at: null }
      : { slug: identifier, deleted_at: null },
  });

  if (!company) {
    throw new NotFoundError('Company not found');
  }

  return company;
}

export async function getAll() {
  return prisma.companies.findMany({
    where: { deleted_at: null },
    orderBy: { created_at: 'desc' },
  });
}

export async function create(data: {
  name: string;
  slug: string;
  custom_domain?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  payment_method?: 'manual' | 'online';
  admin_fee_percentage?: number;
}, userId?: string) {
  if (!data.name || !data.slug) {
    throw new BadRequestError('Name and slug are required');
  }

  const existing = await prisma.companies.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    throw new BadRequestError('Slug already in use');
  }

  // Validate custom_domain uniqueness if provided
  if (data.custom_domain) {
    const domainExists = await prisma.companies.findFirst({
      where: { custom_domain: data.custom_domain },
    });
    if (domainExists) {
      throw new BadRequestError('Custom domain already in use');
    }
  }

  const company = await prisma.companies.create({
    data: {
      name: data.name,
      slug: data.slug,
      custom_domain: data.custom_domain || null,
      logo_url: data.logo_url || null,
      primary_color: data.primary_color || '#3B82F6',
      secondary_color: data.secondary_color || '#1E40AF',
      payment_method: data.payment_method || 'manual',
      admin_fee_percentage: data.admin_fee_percentage ?? 10,
      status: 'active',
    },
  });

  await audit.log({
    companyId: company.id,
    userId,
    action: 'COMPANY_CREATED',
    entityType: 'company',
    entityId: company.id,
    changesJson: buildCreateChanges(company, COMPANY_FIELDS),
  });

  return company;
}

export async function update(
  id: string,
  data: {
    name?: string;
    slug?: string;
    custom_domain?: string | null;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    payments_enabled?: boolean;
    payment_method?: 'manual' | 'online';
    admin_fee_percentage?: number;
    status?: 'active' | 'suspended';
    footer_social_links?: any;
    footer_menus?: any;
    community_url?: string | null;
    community_name?: string | null;
    general_regulations?: string | null;
    about_us?: string | null;
    contact_info?: any;
  },
  userId?: string,
) {
  const company = await prisma.companies.findUnique({ where: { id } });
  if (!company) {
    throw new NotFoundError('Company not found');
  }

  // If slug is being changed, check uniqueness
  if (data.slug && data.slug !== company.slug) {
    const existing = await prisma.companies.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      throw new BadRequestError('Slug already in use');
    }
  }

  // If custom_domain is being changed, check uniqueness
  if (data.custom_domain !== undefined && data.custom_domain !== company.custom_domain) {
    if (data.custom_domain) {
      const domainExists = await prisma.companies.findFirst({
        where: { custom_domain: data.custom_domain, id: { not: id } },
      });
      if (domainExists) {
        throw new BadRequestError('Custom domain already in use');
      }
    }
  }

  const updated = await prisma.companies.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });

  // Invalidate tenant cache when domain changes
  if (company.custom_domain) invalidateTenantCache(company.custom_domain);
  if (updated.custom_domain) invalidateTenantCache(updated.custom_domain);

  const changes = buildUpdateChanges(company, updated, COMPANY_FIELDS);
  if (changes) {
    await audit.log({
      companyId: id,
      userId,
      action: 'COMPANY_UPDATED',
      entityType: 'company',
      entityId: id,
      changesJson: changes,
    });
  }

  return updated;
}

export async function deleteCompany(id: string, userId?: string) {
  const company = await prisma.companies.findUnique({ where: { id } });
  if (!company) {
    throw new NotFoundError('Company not found');
  }

  const result = await prisma.companies.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      status: 'deleted',
      updated_at: new Date(),
    },
  });

  await audit.log({
    companyId: id,
    userId,
    action: 'COMPANY_DELETED',
    entityType: 'company',
    entityId: id,
    changesJson: buildDeleteChanges(company, COMPANY_FIELDS),
  });

  return result;
}
