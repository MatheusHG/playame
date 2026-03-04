import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import * as audit from './audit.service.js';
import { buildCreateChanges, buildUpdateChanges, buildDeleteChanges } from '../utils/auditChanges.js';

const RAFFLE_FIELDS = ['name', 'description', 'image_url', 'ticket_price', 'number_range_start', 'number_range_end', 'numbers_per_ticket', 'prize_mode', 'fixed_prize_value', 'prize_percent_of_sales', 'company_profit_percent', 'regulations', 'scheduled_at', 'status'];

export async function getByCompany(companyId: string) {
  return prisma.raffles.findMany({
    where: { company_id: companyId, deleted_at: null },
    include: {
      prize_tiers: { orderBy: { hits_required: 'desc' } },
      raffle_discounts: { orderBy: { min_quantity: 'asc' } },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getById(id: string) {
  const raffle = await prisma.raffles.findUnique({
    where: { id },
    include: {
      prize_tiers: { orderBy: { hits_required: 'desc' } },
      raffle_discounts: { orderBy: { min_quantity: 'asc' } },
    },
  });

  if (!raffle) {
    throw new NotFoundError('Raffle not found');
  }

  return raffle;
}

export async function create(
  companyId: string,
  data: {
    name: string;
    description?: string;
    image_url?: string;
    ticket_price: number;
    number_range_start?: number;
    number_range_end?: number;
    numbers_per_ticket?: number;
    prize_mode?: 'FIXED' | 'FIXED_PLUS_PERCENT' | 'PERCENT_ONLY';
    fixed_prize_value?: number;
    prize_percent_of_sales?: number;
    company_profit_percent?: number;
    regulations?: string;
    scheduled_at?: string;
  },
  userId?: string,
) {
  if (!data.name) {
    throw new BadRequestError('Name is required');
  }

  if (!data.ticket_price || data.ticket_price <= 0) {
    throw new BadRequestError('Ticket price must be greater than zero');
  }

  const raffle = await prisma.raffles.create({
    data: {
      company_id: companyId,
      name: data.name,
      description: data.description || null,
      image_url: data.image_url || null,
      ticket_price: data.ticket_price,
      number_range_start: data.number_range_start ?? 0,
      number_range_end: data.number_range_end ?? 99,
      numbers_per_ticket: data.numbers_per_ticket ?? 10,
      prize_mode: data.prize_mode || 'PERCENT_ONLY',
      fixed_prize_value: data.fixed_prize_value ?? 0,
      prize_percent_of_sales: data.prize_percent_of_sales ?? 100,
      company_profit_percent: data.company_profit_percent ?? 0,
      regulations: data.regulations || null,
      scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : null,
      status: 'draft',
    },
    include: {
      prize_tiers: true,
    },
  });

  await audit.log({
    companyId,
    userId,
    action: 'RAFFLE_CREATED',
    entityType: 'raffle',
    entityId: raffle.id,
    changesJson: buildCreateChanges(raffle, RAFFLE_FIELDS),
  });

  return raffle;
}

export async function update(
  id: string,
  data: {
    name?: string;
    description?: string;
    image_url?: string;
    ticket_price?: number;
    number_range_start?: number;
    number_range_end?: number;
    numbers_per_ticket?: number;
    prize_mode?: 'FIXED' | 'FIXED_PLUS_PERCENT' | 'PERCENT_ONLY';
    fixed_prize_value?: number;
    prize_percent_of_sales?: number;
    company_profit_percent?: number;
    regulations?: string;
    scheduled_at?: string | null;
  },
  userId?: string,
) {
  const raffle = await prisma.raffles.findUnique({ where: { id } });
  if (!raffle) {
    throw new NotFoundError('Raffle not found');
  }

  const updated = await prisma.raffles.update({
    where: { id },
    data: {
      ...data,
      scheduled_at: data.scheduled_at !== undefined
        ? (data.scheduled_at ? new Date(data.scheduled_at) : null)
        : undefined,
      updated_at: new Date(),
    },
    include: {
      prize_tiers: { orderBy: { hits_required: 'desc' } },
    },
  });

  const changes = buildUpdateChanges(raffle, updated, RAFFLE_FIELDS);
  if (changes) {
    await audit.log({
      companyId: raffle.company_id,
      userId,
      action: 'RAFFLE_UPDATED',
      entityType: 'raffle',
      entityId: id,
      changesJson: changes,
    });
  }

  return updated;
}

export async function deleteRaffle(id: string, userId?: string) {
  const raffle = await prisma.raffles.findUnique({ where: { id } });
  if (!raffle) {
    throw new NotFoundError('Raffle not found');
  }

  const result = await prisma.raffles.update({
    where: { id },
    data: {
      deleted_at: new Date(),
      updated_at: new Date(),
    },
  });

  await audit.log({
    companyId: raffle.company_id,
    userId,
    action: 'RAFFLE_DELETED',
    entityType: 'raffle',
    entityId: id,
    changesJson: buildDeleteChanges(raffle, RAFFLE_FIELDS),
  });

  return result;
}

export async function changeStatus(id: string, status: 'draft' | 'active' | 'paused' | 'finished', userId?: string) {
  const raffle = await prisma.raffles.findUnique({ where: { id } });
  if (!raffle) {
    throw new NotFoundError('Raffle not found');
  }

  const result = await prisma.raffles.update({
    where: { id },
    data: {
      status,
      ...(status === 'finished' ? { finished_at: new Date() } : {}),
      updated_at: new Date(),
    },
  });

  await audit.log({
    companyId: raffle.company_id,
    userId,
    action: 'RAFFLE_STATUS_CHANGED',
    entityType: 'raffle',
    entityId: id,
    changesJson: { before: { status: raffle.status }, after: { status } },
  });

  return result;
}

export async function savePrizeTiers(
  raffleId: string,
  tiers: Array<{
    hits_required: number;
    prize_percentage: number;
    prize_type?: 'money' | 'object';
    purchase_allowed_until_draw_count?: number | null;
    object_description?: string | null;
  }>,
  userId?: string,
) {
  const raffle = await prisma.raffles.findUnique({ where: { id: raffleId } });
  if (!raffle) {
    throw new NotFoundError('Raffle not found');
  }

  // Fetch old tiers for audit and locked-tier validation
  const oldTiers = await prisma.prize_tiers.findMany({
    where: { raffle_id: raffleId },
    orderBy: { hits_required: 'desc' },
  });

  // Validate locked tiers: if a tier's round limit has passed, its prize_percentage and limit cannot change
  const currentDrawCount = raffle.current_draw_count ?? 0;
  if (currentDrawCount > 0) {
    for (const oldTier of oldTiers) {
      if (
        oldTier.purchase_allowed_until_draw_count != null &&
        currentDrawCount >= oldTier.purchase_allowed_until_draw_count
      ) {
        // This tier is locked — find matching new tier by hits_required
        const newTier = tiers.find((t) => t.hits_required === oldTier.hits_required);
        if (!newTier) {
          throw new BadRequestError(
            `A faixa de ${oldTier.hits_required} acertos não pode ser removida — a rodada limite (${oldTier.purchase_allowed_until_draw_count}) já passou.`
          );
        }
        if (Number(newTier.prize_percentage) !== Number(oldTier.prize_percentage)) {
          throw new BadRequestError(
            `A % do prêmio da faixa de ${oldTier.hits_required} acertos não pode ser alterada — a rodada limite (${oldTier.purchase_allowed_until_draw_count}) já passou.`
          );
        }
        if (
          (newTier.purchase_allowed_until_draw_count ?? null) !== (oldTier.purchase_allowed_until_draw_count ?? null)
        ) {
          throw new BadRequestError(
            `O limite de rodada da faixa de ${oldTier.hits_required} acertos não pode ser alterado — já foi ultrapassado.`
          );
        }
      }
    }
  }

  // Delete all existing tiers and insert new ones in a transaction
  const result = await prisma.$transaction(async (tx) => {
    await tx.prize_tiers.deleteMany({ where: { raffle_id: raffleId } });

    if (tiers.length > 0) {
      await tx.prize_tiers.createMany({
        data: tiers.map((tier) => ({
          raffle_id: raffleId,
          hits_required: tier.hits_required,
          prize_percentage: tier.prize_percentage,
          prize_type: tier.prize_type || 'money',
          purchase_allowed_until_draw_count: tier.purchase_allowed_until_draw_count ?? null,
          object_description: tier.object_description || null,
        })),
      });
    }

    return tx.prize_tiers.findMany({
      where: { raffle_id: raffleId },
      orderBy: { hits_required: 'desc' },
    });
  });

  const tierFields = ['hits_required', 'prize_percentage', 'prize_type', 'purchase_allowed_until_draw_count', 'object_description'];
  const simplify = (t: any) => tierFields.reduce((o: any, f) => { o[f] = t[f] ?? null; return o; }, {} as Record<string, unknown>);

  await audit.log({
    companyId: raffle.company_id,
    userId,
    action: 'PRIZE_TIERS_UPDATED',
    entityType: 'raffle',
    entityId: raffleId,
    changesJson: {
      before: { tiers: oldTiers.map(simplify) },
      after: { tiers: tiers.map(simplify) },
    },
  });

  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function settle(raffleId: string) {
  return prisma.$transaction(async (tx) => {
    // Get raffle data
    const raffle = await tx.raffles.findUnique({
      where: { id: raffleId },
      include: {
        prize_tiers: { orderBy: { hits_required: 'desc' } },
      },
    });

    if (!raffle) {
      throw new NotFoundError('Sorteio nao encontrado');
    }

    if (raffle.status === 'finished') {
      throw new BadRequestError('Sorteio ja foi apurado');
    }

    // Aggregate financial totals from succeeded payments
    const salesAggregate = await tx.payments.aggregate({
      where: { raffle_id: raffleId, status: 'succeeded' },
      _sum: {
        amount: true,
        admin_fee: true,
        company_retention: true,
        prize_pool_contribution: true,
      },
    });

    const totalSales = Number(salesAggregate._sum.amount ?? 0);
    const totalAdminFees = Number(salesAggregate._sum.admin_fee ?? 0);
    const totalCompanyRetention = Number(salesAggregate._sum.company_retention ?? 0);
    const totalPrizePoolContributions = Number(salesAggregate._sum.prize_pool_contribution ?? 0);

    // Aggregate total affiliate commissions
    const commissionAggregate = await tx.affiliate_commissions.aggregate({
      where: { raffle_id: raffleId },
      _sum: { manager_gross_amount: true },
    });
    const totalAffiliateCommissions = Number(commissionAggregate._sum.manager_gross_amount ?? 0);

    // Calculate prize pool based on prize_mode
    let prizePool = 0;
    switch (raffle.prize_mode) {
      case 'FIXED':
        prizePool = Number(raffle.fixed_prize_value ?? 0);
        break;
      case 'PERCENT_ONLY':
        if (totalPrizePoolContributions > 0) {
          // Use accumulated per-ticket contributions (new data)
          prizePool = totalPrizePoolContributions;
        } else if (totalSales > 0) {
          // Fallback for pre-migration data: calculate from raffle config
          const netAfterAll = round2(totalSales - totalAdminFees - totalAffiliateCommissions);
          const retentionPercent = Number(raffle.company_profit_percent ?? 0);
          const retention = round2(netAfterAll * (retentionPercent / 100));
          prizePool = round2(netAfterAll - retention);
        }
        break;
      case 'FIXED_PLUS_PERCENT': {
        const fixedPart = Number(raffle.fixed_prize_value ?? 0);
        if (totalPrizePoolContributions > 0) {
          prizePool = fixedPart + totalPrizePoolContributions;
        } else if (totalSales > 0) {
          // Fallback for pre-migration data
          const netAfterAll = round2(totalSales - totalAdminFees - totalAffiliateCommissions);
          const retentionPercent = Number(raffle.company_profit_percent ?? 0);
          const retention = round2(netAfterAll * (retentionPercent / 100));
          prizePool = fixedPart + round2(netAfterAll - retention);
        } else {
          prizePool = fixedPart;
        }
        break;
      }
    }

    const winners: Array<{
      ticket_id: string;
      player_id: string;
      hits: number;
      tier_id: string;
      prize_type: string;
      prize_value: number;
      object_description: string | null;
    }> = [];

    // Process each prize tier (ordered by hits_required DESC)
    for (const tier of raffle.prize_tiers) {
      // Find matching tickets from ranking
      const matchingRankings = await tx.ticket_ranking.findMany({
        where: {
          raffle_id: raffleId,
          hits: { gte: tier.hits_required },
        },
        include: {
          ticket: true,
        },
        orderBy: { rank_position: 'asc' },
      });

      for (const ranking of matchingRankings) {
        // Check if tier.id is in the ticket's eligible_prize_tiers
        // If eligible_prize_tiers is empty (legacy tickets), treat as eligible for all tiers
        const tierIds = ranking.ticket.eligible_prize_tiers as string[];
        if (tierIds.length > 0 && !tierIds.includes(tier.id)) {
          continue;
        }

        // Skip tickets already marked as winner
        if (ranking.ticket.status === 'winner') {
          continue;
        }

        // Calculate prize for this winner
        let tierPrize = 0;
        if (tier.prize_type === 'money') {
          tierPrize = round2(prizePool * (Number(tier.prize_percentage) / 100));
        }

        // Mark ticket as winner
        await tx.tickets.update({
          where: { id: ranking.ticket_id },
          data: { status: 'winner' },
        });

        // Log financial for money prizes
        if (tier.prize_type === 'money' && tierPrize > 0) {
          await tx.financial_logs.create({
            data: {
              company_id: raffle.company_id,
              type: 'PRIZE_PAYOUT',
              amount: tierPrize,
              reference_id: ranking.ticket_id,
              reference_type: 'ticket',
              description: `Premio ${tier.hits_required} acertos - Cartela ${ranking.ticket_id}`,
            },
          });
        }

        winners.push({
          ticket_id: ranking.ticket_id,
          player_id: ranking.player_id,
          hits: ranking.hits ?? 0,
          tier_id: tier.id,
          prize_type: tier.prize_type ?? 'money',
          prize_value: tierPrize,
          object_description: tier.object_description,
        });
      }
    }

    // Set raffle status to finished
    await tx.raffles.update({
      where: { id: raffleId },
      data: {
        status: 'finished',
        finished_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Log audit with full financial breakdown
    await tx.audit_logs.create({
      data: {
        company_id: raffle.company_id,
        action: 'RAFFLE_SETTLED',
        entity_type: 'raffle',
        entity_id: raffleId,
        changes_json: {
          total_sales: totalSales,
          total_admin_fees: totalAdminFees,
          total_affiliate_commissions: totalAffiliateCommissions,
          total_company_retention: totalCompanyRetention,
          prize_pool: prizePool,
          winners_count: winners.length,
        },
      },
    });

    return {
      success: true,
      total_sales: totalSales,
      total_admin_fees: totalAdminFees,
      total_affiliate_commissions: totalAffiliateCommissions,
      total_company_retention: totalCompanyRetention,
      prize_pool: prizePool,
      winners,
    };
  });
}
