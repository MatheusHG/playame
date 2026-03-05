import { Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AuthRequest, TenantInfo } from '../types/index.js';

// In-memory cache: domain → TenantInfo (TTL 5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;
const tenantCache = new Map<string, { tenant: TenantInfo; expiresAt: number }>();

function normalizeHost(host: string): string {
  // Remove port and www prefix, lowercase
  return host.split(':')[0].replace(/^www\./, '').toLowerCase();
}

async function findTenantByDomain(domain: string): Promise<TenantInfo | null> {
  // Check cache first
  const cached = tenantCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  // Query database - try custom_domain match (with and without www)
  const company = await prisma.companies.findFirst({
    where: {
      deleted_at: null,
      status: 'active',
      OR: [
        { custom_domain: domain },
        { custom_domain: `www.${domain}` },
        { slug: domain }, // fallback: allow slug as domain for dev/testing
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      custom_domain: true,
      logo_url: true,
      favicon_url: true,
      primary_color: true,
      secondary_color: true,
      status: true,
    },
  });

  if (company) {
    const tenant: TenantInfo = company;
    tenantCache.set(domain, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
    return tenant;
  }

  return null;
}

// Allow clearing cache for a specific domain (e.g., after company update)
export function invalidateTenantCache(domain?: string) {
  if (domain) {
    const normalized = normalizeHost(domain);
    tenantCache.delete(normalized);
  } else {
    tenantCache.clear();
  }
}

export function tenantResolver() {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const host = normalizeHost(req.hostname || req.headers.host || '');

      // For cross-origin requests, the frontend domain is in the Origin header.
      // req.hostname is the API server domain, not the frontend domain.
      const origin = req.headers.origin;
      const originHost = origin ? normalizeHost(new URL(origin).hostname) : null;

      // Determine the domain to resolve: prefer Origin (frontend domain) over Host (API domain)
      const platformDomain = normalizeHost(env.PLATFORM_DOMAIN);
      const platformBase = platformDomain.replace(/^api\./, '');
      const isApiHost = host === platformDomain || host.startsWith('api.');
      const domainToResolve = isApiHost && originHost ? originHost : host;

      // Skip tenant resolution for platform domain (super-admin)
      // Matches both "api.playame.com.br" and "playame.com.br"
      if (domainToResolve === platformDomain || domainToResolve === platformBase) {
        return next();
      }

      // Skip for localhost without custom domain setup (development)
      if (domainToResolve === 'localhost' || domainToResolve === '127.0.0.1') {
        // In dev, allow X-Tenant-ID header as fallback
        const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
        if (tenantIdHeader) {
          const company = await prisma.companies.findFirst({
            where: { id: tenantIdHeader, deleted_at: null },
            select: {
              id: true, name: true, slug: true, custom_domain: true,
              logo_url: true, favicon_url: true, primary_color: true, secondary_color: true, status: true,
            },
          });
          if (company) {
            req.tenantId = company.id;
            req.tenant = company;
          }
        }
        return next();
      }

      // Resolve tenant from frontend domain
      const tenant = await findTenantByDomain(domainToResolve);
      if (tenant) {
        req.tenantId = tenant.id;
        req.tenant = tenant;
      }

      // Also check X-Tenant-ID header (for super-admin cross-tenant access)
      if (!req.tenantId) {
        const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
        if (tenantIdHeader) {
          const company = await prisma.companies.findFirst({
            where: { id: tenantIdHeader, deleted_at: null },
            select: {
              id: true, name: true, slug: true, custom_domain: true,
              logo_url: true, favicon_url: true, primary_color: true, secondary_color: true, status: true,
            },
          });
          if (company) {
            req.tenantId = company.id;
            req.tenant = company;
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
