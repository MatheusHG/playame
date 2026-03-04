import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { hashCPF, hashPassword, validateCPF, getCPFLast4 } from '../utils/cpf.js';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../utils/errors.js';
import type { PlayerJwtPayload } from '../types/index.js';
import * as audit from './audit.service.js';
import { buildUpdateChanges } from '../utils/auditChanges.js';

function signPlayerToken(payload: PlayerJwtPayload): string {
  return jwt.sign(payload, env.PLAYER_JWT_SECRET, {
    expiresIn: env.PLAYER_JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export async function loginPlayer(
  companyId: string,
  cpf: string,
  password: string,
): Promise<{ token: string; player: Record<string, unknown> }> {
  if (!companyId) {
    throw new BadRequestError('Company ID is required');
  }

  if (!cpf || !validateCPF(cpf)) {
    throw new BadRequestError('CPF invalido');
  }

  if (!password) {
    throw new BadRequestError('Senha e obrigatoria');
  }

  const cleanedCPF = cpf.replace(/\D/g, '');
  const cpfHash = hashCPF(cleanedCPF);

  const player = await prisma.players.findUnique({
    where: {
      company_id_cpf_hash: {
        company_id: companyId,
        cpf_hash: cpfHash,
      },
    },
  });

  if (!player) {
    throw new NotFoundError('CPF nao encontrado. Cadastre-se primeiro.');
  }

  if (player.status === 'blocked') {
    throw new UnauthorizedError('Conta bloqueada. Entre em contato com o suporte.');
  }

  if (player.status === 'deleted') {
    throw new UnauthorizedError('Conta desativada.');
  }

  const passwordHash = hashPassword(password);
  if (player.password_hash !== passwordHash) {
    throw new UnauthorizedError('Senha incorreta');
  }

  // Backfill cpf_encrypted for existing players who don't have it
  let cpfEncrypted = player.cpf_encrypted;
  if (!cpfEncrypted) {
    cpfEncrypted = Buffer.from(cleanedCPF).toString('base64');
    await prisma.players.update({
      where: { id: player.id },
      data: { cpf_encrypted: cpfEncrypted },
    });
  }

  const payload: PlayerJwtPayload = {
    playerId: player.id,
    companyId: player.company_id,
    cpfLast4: player.cpf_last4,
  };

  const token = signPlayerToken(payload);

  return {
    token,
    player: {
      id: player.id,
      name: player.name,
      cpf_last4: player.cpf_last4,
      cpf_encrypted: cpfEncrypted,
      city: player.city,
      phone: player.phone,
    },
  };
}

export async function registerPlayer(
  companyId: string,
  cpf: string,
  password: string,
  name: string,
  phone?: string,
  city?: string,
): Promise<{ token: string; player: Record<string, unknown> }> {
  if (!companyId) {
    throw new BadRequestError('Company ID is required');
  }

  if (!cpf || !validateCPF(cpf)) {
    throw new BadRequestError('CPF invalido');
  }

  if (!password || password.length < 6) {
    throw new BadRequestError('Senha deve ter pelo menos 6 caracteres');
  }

  if (!name || name.trim().length < 3) {
    throw new BadRequestError('Nome deve ter pelo menos 3 caracteres');
  }

  const cleanedCPF = cpf.replace(/\D/g, '');
  const cpfHash = hashCPF(cleanedCPF);
  const cpfLast4 = getCPFLast4(cleanedCPF);

  // Check if player already exists
  const existing = await prisma.players.findUnique({
    where: {
      company_id_cpf_hash: {
        company_id: companyId,
        cpf_hash: cpfHash,
      },
    },
  });

  if (existing) {
    if (existing.status === 'blocked') {
      throw new UnauthorizedError('Conta bloqueada. Entre em contato com o suporte.');
    }
    throw new ConflictError('CPF ja cadastrado. Faca login.');
  }

  const passwordHash = hashPassword(password);

  const cpfEncrypted = Buffer.from(cleanedCPF).toString('base64');

  const player = await prisma.players.create({
    data: {
      company_id: companyId,
      cpf_hash: cpfHash,
      cpf_last4: cpfLast4,
      cpf_encrypted: cpfEncrypted,
      name: name.trim(),
      city: city?.trim() || null,
      phone: phone?.trim() || null,
      password_hash: passwordHash,
      status: 'active',
    },
  });

  const payload: PlayerJwtPayload = {
    playerId: player.id,
    companyId: player.company_id,
    cpfLast4: player.cpf_last4,
  };

  const token = signPlayerToken(payload);

  await audit.log({
    companyId,
    playerId: player.id,
    action: 'PLAYER_REGISTERED',
    entityType: 'player',
    entityId: player.id,
    changesJson: { created: { name: player.name, cpf_last4: player.cpf_last4, city: player.city, phone: player.phone } },
  });

  return {
    token,
    player: {
      id: player.id,
      name: player.name,
      cpf_last4: player.cpf_last4,
      cpf_encrypted: cpfEncrypted,
      city: player.city,
      phone: player.phone,
    },
  };
}

export async function changePassword(
  playerId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!currentPassword) {
    throw new BadRequestError('Senha atual e obrigatoria');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new BadRequestError('Nova senha deve ter pelo menos 6 caracteres');
  }

  const player = await prisma.players.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    throw new NotFoundError('Player not found');
  }

  const currentHash = hashPassword(currentPassword);
  if (player.password_hash !== currentHash) {
    throw new UnauthorizedError('Senha atual incorreta');
  }

  const newHash = hashPassword(newPassword);

  await prisma.players.update({
    where: { id: playerId },
    data: { password_hash: newHash, updated_at: new Date() },
  });
}

export async function updateProfile(
  playerId: string,
  data: { name?: string; phone?: string; city?: string },
): Promise<Record<string, unknown>> {
  if (data.name && data.name.trim().length < 3) {
    throw new BadRequestError('Nome deve ter pelo menos 3 caracteres');
  }

  const player = await prisma.players.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    throw new NotFoundError('Player not found');
  }

  const updated = await prisma.players.update({
    where: { id: playerId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.city !== undefined ? { city: data.city?.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      updated_at: new Date(),
    },
  });

  const changes = buildUpdateChanges(player, updated, ['name', 'phone', 'city']);
  if (changes) {
    await audit.log({
      companyId: player.company_id,
      playerId,
      action: 'PLAYER_PROFILE_UPDATED',
      entityType: 'player',
      entityId: playerId,
      changesJson: changes,
    });
  }

  return {
    id: updated.id,
    name: updated.name,
    cpf_last4: updated.cpf_last4,
    cpf_encrypted: updated.cpf_encrypted,
    city: updated.city,
    phone: updated.phone,
  };
}
