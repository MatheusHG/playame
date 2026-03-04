import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { hashCPF } from '../utils/cpf.js';
import * as audit from './audit.service.js';

export async function getByRaffle(raffleId: string) {
  return prisma.tickets.findMany({
    where: { raffle_id: raffleId },
    include: {
      ticket_numbers: { orderBy: { number: 'asc' } },
      player: {
        select: {
          id: true,
          name: true,
          cpf_last4: true,
          cpf_encrypted: true,
          phone: true,
          city: true,
        },
      },
      affiliate: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      payments: {
        select: { id: true },
        take: 1,
      },
      ticket_ranking: true,
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getById(id: string) {
  const ticket = await prisma.tickets.findUnique({
    where: { id },
    include: {
      ticket_numbers: { orderBy: { number: 'asc' } },
      player: {
        select: {
          id: true,
          name: true,
          cpf_last4: true,
          phone: true,
          city: true,
        },
      },
      raffle: {
        select: {
          id: true,
          name: true,
          status: true,
          ticket_price: true,
          numbers_per_ticket: true,
        },
      },
      payments: {
        orderBy: { created_at: 'desc' },
        take: 1,
      },
      ticket_ranking: true,
      affiliate: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  return ticket;
}

export async function cancel(ticketId: string, userId?: string) {
  const ticket = await prisma.tickets.findUnique({ where: { id: ticketId } });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  if (ticket.status === 'cancelled') {
    throw new BadRequestError('Ticket is already cancelled');
  }

  if (ticket.status === 'winner') {
    throw new BadRequestError('Cannot cancel a winning ticket');
  }

  const result = await prisma.tickets.update({
    where: { id: ticketId },
    data: {
      status: 'cancelled',
      updated_at: new Date(),
    },
  });

  await audit.log({
    companyId: ticket.company_id,
    userId,
    action: 'TICKET_CANCELLED',
    entityType: 'ticket',
    entityId: ticketId,
    changesJson: { before: { status: ticket.status }, after: { status: 'cancelled' } },
  });

  return result;
}

export async function getPublicTrackingByPayment(paymentId: string) {
  const payment = await prisma.payments.findUnique({
    where: { id: paymentId },
    select: {
      player_id: true,
      raffle_id: true,
      ticket: { select: { purchased_at: true } },
    },
  });
  if (!payment) return null;

  const purchasedAt = payment.ticket?.purchased_at;
  const ticketWhere: any = {
    player_id: payment.player_id,
    raffle_id: payment.raffle_id,
    status: 'active',
  };
  if (purchasedAt) {
    ticketWhere.purchased_at = {
      gte: new Date(purchasedAt.getTime() - 2000),
      lte: new Date(purchasedAt.getTime() + 2000),
    };
  }

  const tickets = await prisma.tickets.findMany({
    where: ticketWhere,
    include: {
      ticket_numbers: { orderBy: { number: 'asc' } },
      ticket_ranking: true,
    },
    orderBy: { created_at: 'asc' },
  });

  const drawnNumbers = await prisma.draw_numbers.findMany({
    where: {
      draw_batch: {
        raffle_id: payment.raffle_id,
        finalized_at: { not: null },
      },
    },
    select: { number: true },
  });
  const drawnSet = new Set(drawnNumbers.map((d) => d.number));

  return {
    tickets: tickets.map((t) => ({
      id: t.id,
      numbers: t.ticket_numbers.map((n) => n.number),
      hits: t.ticket_ranking?.hits ?? 0,
      missing: t.ticket_ranking?.missing ?? t.ticket_numbers.length,
      rank_position: t.ticket_ranking?.rank_position ?? null,
      matched_numbers: t.ticket_numbers
        .map((n) => n.number)
        .filter((n) => drawnSet.has(n)),
    })),
    total_drawn: drawnSet.size,
  };
}

export async function getWinnersByRaffle(raffleId: string) {
  return prisma.tickets.findMany({
    where: {
      raffle_id: raffleId,
      status: 'winner',
    },
    include: {
      ticket_numbers: { orderBy: { number: 'asc' } },
      player: {
        select: {
          name: true,
          cpf_last4: true,
          city: true,
        },
      },
      ticket_ranking: {
        select: {
          hits: true,
          rank_position: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });
}

export async function lookupByCpf(companyId: string, cpf: string) {
  const cpfHash = hashCPF(cpf);

  const player = await prisma.players.findUnique({
    where: {
      company_id_cpf_hash: {
        company_id: companyId,
        cpf_hash: cpfHash,
      },
    },
    select: { id: true, name: true, cpf_last4: true },
  });

  if (!player) return null;

  const tickets = await prisma.tickets.findMany({
    where: {
      player_id: player.id,
      company_id: companyId,
      status: { in: ['active', 'winner'] },
    },
    include: {
      ticket_numbers: { orderBy: { number: 'asc' } },
      raffle: {
        select: {
          id: true,
          name: true,
          status: true,
          image_url: true,
          numbers_per_ticket: true,
          number_range_start: true,
          number_range_end: true,
          finished_at: true,
        },
      },
      ticket_ranking: {
        select: {
          hits: true,
          missing: true,
          rank_position: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  // Get drawn numbers for each raffle
  const raffleIds = [...new Set(tickets.map((t) => t.raffle_id))];
  const drawnByRaffle: Record<string, Set<number>> = {};

  if (raffleIds.length > 0) {
    const drawnNumbers = await prisma.draw_numbers.findMany({
      where: {
        raffle_id: { in: raffleIds },
        draw_batch: { finalized_at: { not: null } },
      },
      select: { raffle_id: true, number: true },
    });

    for (const dn of drawnNumbers) {
      if (!drawnByRaffle[dn.raffle_id]) {
        drawnByRaffle[dn.raffle_id] = new Set();
      }
      drawnByRaffle[dn.raffle_id].add(dn.number);
    }
  }

  return {
    player_name: player.name,
    cpf_last4: player.cpf_last4,
    tickets: tickets.map((t) => {
      const drawnSet = drawnByRaffle[t.raffle_id] || new Set<number>();
      return {
        id: t.id,
        status: t.status,
        numbers: t.ticket_numbers.map((n) => n.number),
        matched_numbers: t.ticket_numbers
          .map((n) => n.number)
          .filter((n) => drawnSet.has(n)),
        hits: t.ticket_ranking?.hits ?? 0,
        missing: t.ticket_ranking?.missing ?? t.ticket_numbers.length,
        rank_position: t.ticket_ranking?.rank_position ?? null,
        raffle: t.raffle,
      };
    }),
  };
}

export async function searchByRef(raffleId: string, ref: string) {
  const refLower = ref.toLowerCase();
  const pattern = `${refLower}%`;

  // Search tickets where ticket.id or payment.id starts with the ref
  const matchingIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT t.id
    FROM tickets t
    LEFT JOIN payments p ON p.ticket_id = t.id
    WHERE t.raffle_id = ${raffleId}::uuid
      AND (t.id::text LIKE ${pattern} OR p.id::text LIKE ${pattern})
    LIMIT 1
  `;

  if (matchingIds.length === 0) return null;

  const ticket = await prisma.tickets.findUnique({
    where: { id: matchingIds[0].id },
    include: {
      ticket_numbers: { orderBy: { number: 'asc' } },
      player: {
        select: {
          id: true,
          name: true,
          cpf_last4: true,
          cpf_encrypted: true,
          city: true,
          phone: true,
        },
      },
      payments: {
        select: { id: true },
        take: 1,
      },
      ticket_ranking: true,
    },
  });

  if (!ticket) return null;

  // Get drawn numbers to compute hits
  const drawnNumbers = await prisma.draw_numbers.findMany({
    where: {
      raffle_id: raffleId,
      draw_batch: { finalized_at: { not: null } },
    },
    select: { number: true },
  });
  const drawnSet = new Set(drawnNumbers.map((d) => d.number));

  const numbers = ticket.ticket_numbers.map((n) => n.number);
  const matchedNumbers = numbers.filter((n) => drawnSet.has(n));

  return {
    id: ticket.id,
    status: ticket.status,
    purchased_at: ticket.purchased_at,
    snapshot_data: ticket.snapshot_data,
    eligible_prize_tiers: ticket.eligible_prize_tiers,
    player: ticket.player,
    numbers,
    matched_numbers: matchedNumbers,
    hits: ticket.ticket_ranking?.hits ?? matchedNumbers.length,
    missing: ticket.ticket_ranking?.missing ?? (numbers.length - matchedNumbers.length),
    rank_position: ticket.ticket_ranking?.rank_position ?? null,
    total_drawn: drawnSet.size,
    ref: (ticket.payments?.[0]?.id || ticket.id).slice(0, 8).toUpperCase(),
  };
}

export async function searchByRefGlobal(companyId: string, ref: string) {
  const refLower = ref.toLowerCase();
  const pattern = `${refLower}%`;

  const matchingIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT DISTINCT t.id
    FROM tickets t
    LEFT JOIN payments p ON p.ticket_id = t.id
    WHERE t.company_id = ${companyId}::uuid
      AND (t.id::text LIKE ${pattern} OR p.id::text LIKE ${pattern})
    LIMIT 1
  `;

  if (matchingIds.length === 0) return null;

  const ticket = await prisma.tickets.findUnique({
    where: { id: matchingIds[0].id },
    include: {
      ticket_numbers: { orderBy: { number: 'asc' } },
      player: {
        select: {
          id: true,
          name: true,
          cpf_last4: true,
          cpf_encrypted: true,
          city: true,
          phone: true,
        },
      },
      payments: {
        select: { id: true },
        take: 1,
      },
      ticket_ranking: true,
      raffle: {
        select: {
          id: true,
          name: true,
          numbers_per_ticket: true,
          prize_tiers: true,
        },
      },
    },
  });

  if (!ticket) return null;

  // Get drawn numbers to compute hits
  const drawnNumbers = await prisma.draw_numbers.findMany({
    where: {
      raffle_id: ticket.raffle_id,
      draw_batch: { finalized_at: { not: null } },
    },
    select: { number: true },
  });
  const drawnSet = new Set(drawnNumbers.map((d) => d.number));

  const numbers = ticket.ticket_numbers.map((n) => n.number);
  const matchedNumbers = numbers.filter((n) => drawnSet.has(n));

  return {
    id: ticket.id,
    status: ticket.status,
    purchased_at: ticket.purchased_at,
    snapshot_data: ticket.snapshot_data,
    eligible_prize_tiers: ticket.eligible_prize_tiers,
    player: ticket.player,
    numbers,
    matched_numbers: matchedNumbers,
    hits: ticket.ticket_ranking?.hits ?? matchedNumbers.length,
    missing: ticket.ticket_ranking?.missing ?? (numbers.length - matchedNumbers.length),
    rank_position: ticket.ticket_ranking?.rank_position ?? null,
    total_drawn: drawnSet.size,
    ref: (ticket.payments?.[0]?.id || ticket.id).slice(0, 8).toUpperCase(),
    raffle: ticket.raffle,
  };
}

export async function getByPlayer(playerId: string, companyId: string) {
  return prisma.tickets.findMany({
    where: {
      player_id: playerId,
      company_id: companyId,
    },
    include: {
      ticket_numbers: { orderBy: { number: 'asc' } },
      raffle: {
        select: {
          id: true,
          name: true,
          status: true,
          ticket_price: true,
        },
      },
      payments: {
        orderBy: { created_at: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          amount: true,
        },
      },
      ticket_ranking: true,
    },
    orderBy: { created_at: 'desc' },
  });
}
