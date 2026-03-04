import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

/**
 * Calculate ranking for a single ticket.
 * Ports the PL/pgSQL calculate_ticket_ranking function to TypeScript.
 */
export async function calculateTicketRanking(ticketId: string): Promise<void> {
  // Get ticket info with raffle
  const ticket = await prisma.tickets.findUnique({
    where: { id: ticketId },
    include: {
      raffle: { select: { id: true, numbers_per_ticket: true } },
    },
  });

  // Only calculate for active tickets
  if (!ticket || ticket.status !== 'active') {
    return;
  }

  const raffleId = ticket.raffle_id;
  const numbersPerTicket = ticket.raffle.numbers_per_ticket;

  // Get ticket numbers
  const ticketNumbers = await prisma.ticket_numbers.findMany({
    where: { ticket_id: ticketId },
    select: { number: true },
  });

  const ticketNumberSet = new Set(ticketNumbers.map((tn) => tn.number));

  // Get all drawn numbers from finalized batches
  const drawnNumbers = await prisma.draw_numbers.findMany({
    where: {
      raffle_id: raffleId,
      draw_batch: {
        finalized_at: { not: null },
      },
    },
    select: { number: true },
  });

  const drawnNumberSet = new Set(drawnNumbers.map((dn) => dn.number));

  // Calculate hits (intersection)
  let hits = 0;
  for (const num of ticketNumberSet) {
    if (drawnNumberSet.has(num)) {
      hits++;
    }
  }

  // Calculate missing
  const missing = numbersPerTicket - hits;

  // Upsert ticket_ranking
  await prisma.ticket_ranking.upsert({
    where: { ticket_id: ticketId },
    update: {
      hits,
      missing,
      last_calculated_at: new Date(),
    },
    create: {
      ticket_id: ticketId,
      raffle_id: raffleId,
      player_id: ticket.player_id,
      company_id: ticket.company_id,
      hits,
      missing,
      last_calculated_at: new Date(),
    },
  });
}

/**
 * Recalculate ranking for all active tickets in a raffle.
 * Ports the PL/pgSQL recalculate_raffle_ranking function to TypeScript.
 */
export async function recalculateRaffleRanking(raffleId: string): Promise<void> {
  // Get all active tickets for this raffle
  const activeTickets = await prisma.tickets.findMany({
    where: { raffle_id: raffleId, status: 'active' },
    select: { id: true },
  });

  // Recalculate each ticket
  for (const ticket of activeTickets) {
    await calculateTicketRanking(ticket.id);
  }

  // Update rank_positions using ROW_NUMBER ordered by missing ASC, hits DESC
  // We need to get all rankings, sort them, and update positions
  const rankings = await prisma.ticket_ranking.findMany({
    where: { raffle_id: raffleId },
    include: {
      ticket: { select: { purchased_at: true } },
    },
    orderBy: [
      { missing: 'asc' },
      { hits: 'desc' },
    ],
  });

  // Sort with tiebreaker: missing ASC, hits DESC, purchased_at ASC (oldest first)
  rankings.sort((a, b) => {
    if (a.missing !== b.missing) return a.missing - b.missing;
    if ((a.hits ?? 0) !== (b.hits ?? 0)) return (b.hits ?? 0) - (a.hits ?? 0);
    const aTime = a.ticket.purchased_at?.getTime() ?? 0;
    const bTime = b.ticket.purchased_at?.getTime() ?? 0;
    return aTime - bTime;
  });

  // Update rank positions in batch
  for (let i = 0; i < rankings.length; i++) {
    await prisma.ticket_ranking.update({
      where: { id: rankings[i].id },
      data: { rank_position: i + 1 },
    });
  }
}

/**
 * Get ranking for a raffle with ticket and player data.
 */
export async function getRanking(raffleId: string) {
  return prisma.ticket_ranking.findMany({
    where: { raffle_id: raffleId },
    include: {
      ticket: {
        include: {
          ticket_numbers: { orderBy: { number: 'asc' } },
        },
      },
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
    },
    orderBy: { rank_position: 'asc' },
  });
}
