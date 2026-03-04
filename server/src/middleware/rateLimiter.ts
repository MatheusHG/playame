import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { RateLimitError } from '../utils/errors.js';

interface RateLimitOptions {
  maxAttempts?: number;
  windowSeconds?: number;
  blockSeconds?: number;
  identifierFn?: (req: Request) => string;
}

export function rateLimit(action: string, options: RateLimitOptions = {}) {
  const {
    maxAttempts = 5,
    windowSeconds = 300,
    blockSeconds = 900,
    identifierFn = (req) => req.ip || 'unknown',
  } = options;

  return async (req: Request, _res: Response, next: NextFunction) => {
    const identifier = identifierFn(req);
    const now = new Date();

    const record = await prisma.rate_limits.findUnique({
      where: { identifier_action: { identifier, action } },
    });

    if (!record) {
      await prisma.rate_limits.create({
        data: { identifier, action, attempts: 1, first_attempt_at: now, last_attempt_at: now },
      });
      next();
      return;
    }

    if (record.blocked_until && record.blocked_until > now) {
      throw new RateLimitError('Too many attempts. Please try again later.');
    }

    const windowStart = new Date(now.getTime() - windowSeconds * 1000);
    if (record.first_attempt_at && record.first_attempt_at < windowStart) {
      await prisma.rate_limits.update({
        where: { id: record.id },
        data: { attempts: 1, first_attempt_at: now, last_attempt_at: now, blocked_until: null },
      });
      next();
      return;
    }

    if ((record.attempts ?? 0) >= maxAttempts) {
      await prisma.rate_limits.update({
        where: { id: record.id },
        data: {
          blocked_until: new Date(now.getTime() + blockSeconds * 1000),
          last_attempt_at: now,
        },
      });
      throw new RateLimitError('Too many attempts. Please try again later.');
    }

    await prisma.rate_limits.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 }, last_attempt_at: now },
    });

    next();
  };
}
