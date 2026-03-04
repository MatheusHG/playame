import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { PlayerAuthRequest, PlayerJwtPayload } from '../types/index.js';
import { UnauthorizedError } from '../utils/errors.js';

export function playerAuthMiddleware(req: PlayerAuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token not provided');
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, env.PLAYER_JWT_SECRET) as PlayerJwtPayload;
    req.player = decoded;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
