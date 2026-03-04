import { prisma } from '../config/database.js';

export interface FinancialLogParams {
  companyId: string;
  userId?: string;
  type: string;
  amount: number;
  referenceId?: string;
  referenceType?: string;
  description?: string;
}

export async function log(params: FinancialLogParams): Promise<string> {
  const entry = await prisma.financial_logs.create({
    data: {
      company_id: params.companyId,
      user_id: params.userId || null,
      type: params.type,
      amount: params.amount,
      reference_id: params.referenceId || null,
      reference_type: params.referenceType || null,
      description: params.description || null,
    },
  });

  return entry.id;
}

export interface FinancialFilters {
  type?: string;
  referenceType?: string;
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

  const logs = await prisma.financial_logs.findMany({
    where: where as any,
    include: {
      company: { select: { name: true } },
      user: { select: { id: true, email: true } },
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

export async function getByCompany(companyId: string, filters?: FinancialFilters) {
  const page = filters?.page ?? 1;
  const limit = Math.min(filters?.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { company_id: companyId };

  if (filters?.type) {
    where.type = filters.type;
  }
  if (filters?.referenceType) {
    where.reference_type = filters.referenceType;
  }
  if (filters?.startDate || filters?.endDate) {
    where.created_at = {
      ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
      ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
    };
  }

  const [data, total] = await Promise.all([
    prisma.financial_logs.findMany({
      where,
      include: {
        user: { select: { id: true, email: true } },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.financial_logs.count({ where }),
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
