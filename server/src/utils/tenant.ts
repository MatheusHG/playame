import { AuthRequest, PlayerAuthRequest } from '../types/index.js';

/**
 * Extract companyId from tenant middleware (domain resolution) or route params.
 * Tenant middleware sets req.tenantId when the request comes from a known company domain.
 * Falls back to route param for backwards compatibility.
 */
export function getCompanyId(req: AuthRequest | PlayerAuthRequest, paramName = 'companyId'): string {
  return (req as any).tenantId || req.params[paramName] || '';
}
