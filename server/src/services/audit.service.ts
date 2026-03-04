import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';

export interface AuditLogParams {
  companyId?: string;
  userId?: string;
  playerId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  changesJson?: Prisma.InputJsonValue;
  ipAddress?: string;
}

export async function log(params: AuditLogParams): Promise<string> {
  const entry = await prisma.audit_logs.create({
    data: {
      company_id: params.companyId || null,
      user_id: params.userId || null,
      player_id: params.playerId || null,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      changes_json: params.changesJson ?? Prisma.JsonNull,
      ip_address: params.ipAddress || null,
    },
  });

  return entry.id;
}

export interface AuditFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  playerId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function getAll(query?: Record<string, string>) {
  const where: Record<string, unknown> = {};

  if (query?.from || query?.to) {
    where.created_at = {
      ...(query.from ? { gte: new Date(query.from) } : {}),
      ...(query.to ? { lte: new Date(query.to) } : {}),
    };
  }

  const logs = await prisma.audit_logs.findMany({
    where: where as any,
    include: {
      company: { select: { name: true } },
      user: { select: { id: true, email: true } },
      player: { select: { id: true, name: true, cpf_last4: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 200,
  });

  return logs.map((l) => ({
    ...l,
    company_name: (l as any).company?.name || null,
    company: undefined,
  }));
}

export async function getByCompany(companyId: string, filters?: AuditFilters) {
  const page = filters?.page ?? 1;
  const limit = Math.min(filters?.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { company_id: companyId };

  if (filters?.action) {
    where.action = filters.action;
  }
  if (filters?.entityType) {
    where.entity_type = filters.entityType;
  }
  if (filters?.entityId) {
    where.entity_id = filters.entityId;
  }
  if (filters?.userId) {
    where.user_id = filters.userId;
  }
  if (filters?.playerId) {
    where.player_id = filters.playerId;
  }
  if (filters?.startDate || filters?.endDate) {
    where.created_at = {
      ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
    };
  }

  const [data, total] = await Promise.all([
    prisma.audit_logs.findMany({
      where,
      include: {
        user: { select: { id: true, email: true } },
        player: { select: { id: true, name: true, cpf_last4: true } },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.audit_logs.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
