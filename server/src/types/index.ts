import { Request } from 'express';

export interface JwtPayload {
  userId: string;
  email: string;
  roles: { role: string; companyId: string | null }[];
  affiliateId?: string;
}

export interface PlayerJwtPayload {
  playerId: string;
  companyId: string;
  cpfLast4: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  status: string | null;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
  tenantId?: string;
  tenant?: TenantInfo;
}

export interface PlayerAuthRequest extends Request {
  player?: PlayerJwtPayload;
  tenantId?: string;
  tenant?: TenantInfo;
}
