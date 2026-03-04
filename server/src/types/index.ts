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

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface PlayerAuthRequest extends Request {
  player?: PlayerJwtPayload;
}
