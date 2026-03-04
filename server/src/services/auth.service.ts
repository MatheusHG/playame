import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../utils/errors.js';
import type { JwtPayload } from '../types/index.js';

const BCRYPT_ROUNDS = 12;

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export async function login(email: string, password: string): Promise<{ token: string; user: JwtPayload }> {
  if (!email || !password) {
    throw new BadRequestError('Email and password are required');
  }

  const user = await prisma.users.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      user_roles: {
        include: { company: true },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Build roles array
  const roles = user.user_roles.map((ur) => ({
    role: ur.role,
    companyId: ur.company_id,
  }));

  // Check if user is linked to an affiliate
  const affiliate = await prisma.affiliates.findFirst({
    where: { user_id: user.id, is_active: true, deleted_at: null },
  });

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    roles,
    ...(affiliate ? { affiliateId: affiliate.id } : {}),
  };

  const token = signToken(payload);

  return { token, user: payload };
}

export async function register(email: string, password: string): Promise<{ token: string; user: JwtPayload }> {
  if (!email || !password) {
    throw new BadRequestError('Email and password are required');
  }

  if (password.length < 6) {
    throw new BadRequestError('Password must be at least 6 characters');
  }

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.users.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.users.create({
    data: {
      email: normalizedEmail,
      password_hash: passwordHash,
    },
  });

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    roles: [],
  };

  const token = signToken(payload);

  return { token, user: payload };
}

export async function getMe(userId: string) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: {
      user_roles: {
        include: { company: true },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Check if user is linked to an affiliate
  const affiliate = await prisma.affiliates.findFirst({
    where: { user_id: user.id, is_active: true, deleted_at: null },
    include: {
      company: true,
      permission_profile: true,
    },
  });

  return {
    id: user.id,
    email: user.email,
    email_confirmed: user.email_confirmed,
    created_at: user.created_at,
    roles: user.user_roles.map((ur) => ({
      role: ur.role,
      companyId: ur.company_id,
      company: ur.company
        ? { id: ur.company.id, name: ur.company.name, slug: ur.company.slug }
        : null,
    })),
    affiliate: affiliate
      ? {
          id: affiliate.id,
          type: affiliate.type,
          name: affiliate.name,
          email: affiliate.email,
          phone: affiliate.phone,
          link_code: affiliate.link_code,
          company_id: affiliate.company_id,
          parent_affiliate_id: affiliate.parent_affiliate_id,
          permission_profile_id: affiliate.permission_profile_id,
          is_sales_paused: affiliate.is_sales_paused,
          commission_percent: affiliate.commission_percent,
          company: affiliate.company
            ? {
                id: affiliate.company.id,
                name: affiliate.company.name,
                slug: affiliate.company.slug,
                logo_url: affiliate.company.logo_url,
                primary_color: affiliate.company.primary_color,
                secondary_color: affiliate.company.secondary_color,
              }
            : null,
          permissions: (affiliate.permission_profile?.permissions as Record<string, boolean>) ?? {},
          permission_profile: affiliate.permission_profile,
        }
      : null,
  };
}

export async function updatePasswordWithToken(token: string, newPassword: string): Promise<void> {
  if (!token) {
    throw new BadRequestError('Recovery token is required');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new BadRequestError('Password must be at least 6 characters');
  }

  let payload: { userId: string };
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as { userId: string };
  } catch {
    throw new UnauthorizedError('Invalid or expired recovery token');
  }

  const user = await prisma.users.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.users.update({
    where: { id: user.id },
    data: { password_hash: passwordHash, updated_at: new Date() },
  });
}

export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  if (!newPassword || newPassword.length < 6) {
    throw new BadRequestError('Password must be at least 6 characters');
  }

  const user = await prisma.users.findUnique({ where: { id: userId } });
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.users.update({
    where: { id: userId },
    data: { password_hash: passwordHash, updated_at: new Date() },
  });
}
