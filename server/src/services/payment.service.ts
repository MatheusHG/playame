import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { calculateTicketRanking } from './ranking.service.js';

export async function getByCompany(companyId: string) {
  return prisma.payments.findMany({
    where: { company_id: companyId },
    include: {
      ticket: {
        select: {
          id: true,
          status: true,
          affiliate_id: true,
          ticket_numbers: { orderBy: { number: 'asc' } },
        },
      },
      player: {
        select: {
          id: true,
          name: true,
          cpf_last4: true,
          phone: true,
        },
      },
      raffle: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}

export async function getById(id: string) {
  const payment = await prisma.payments.findUnique({
    where: { id },
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
          phone: true,
        },
      },
      raffle: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!payment) {
    throw new NotFoundError('Payment not found');
  }

  return payment;
}

export async function approve(paymentId: string, userId: string) {
  const payment = await prisma.payments.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new NotFoundError('Pagamento nao encontrado');
  }

  if (payment.status !== 'pending' && payment.status !== 'processing') {
    throw new BadRequestError('Pagamento ja foi processado');
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Update payment status to succeeded
    await tx.payments.update({
      where: { id: paymentId },
      data: {
        status: 'succeeded',
        processed_at: now,
        updated_at: now,
      },
    });

    // Activate the ticket
    await tx.tickets.update({
      where: { id: payment.ticket_id },
      data: {
        status: 'active',
        purchased_at: now,
        updated_at: now,
      },
    });

    // Log financial - ticket sale
    await tx.financial_logs.create({
      data: {
        company_id: payment.company_id,
        user_id: userId,
        type: 'TICKET_SALE',
        amount: payment.amount,
        reference_id: paymentId,
        reference_type: 'payment',
        description: 'Venda manual aprovada (1 cartela)',
      },
    });

    // Log admin fee
    if (payment.admin_fee && Number(payment.admin_fee) > 0) {
      await tx.financial_logs.create({
        data: {
          company_id: payment.company_id,
          user_id: userId,
          type: 'ADMIN_FEE',
          amount: -Number(payment.admin_fee),
          reference_id: paymentId,
          reference_type: 'payment',
          description: 'Taxa administrativa da plataforma (venda manual)',
        },
      });
    }

    // Log audit
    await tx.audit_logs.create({
      data: {
        company_id: payment.company_id,
        user_id: userId,
        player_id: payment.player_id,
        action: 'MANUAL_PAYMENT_APPROVED',
        entity_type: 'payment',
        entity_id: paymentId,
        changes_json: {
          before: { status: payment.status },
          after: { status: 'succeeded' },
        },
      },
    });

    return { success: true };
  }).then(async (result) => {
    // Calculate ranking after transaction completes
    await calculateTicketRanking(payment.ticket_id);
    return result;
  });
}

export async function reject(paymentId: string, userId: string, reason?: string) {
  const payment = await prisma.payments.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    throw new NotFoundError('Pagamento nao encontrado');
  }

  if (payment.status !== 'pending' && payment.status !== 'processing') {
    throw new BadRequestError('Pagamento ja foi processado');
  }

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Update payment status to failed
    await tx.payments.update({
      where: { id: paymentId },
      data: {
        status: 'failed',
        processed_at: now,
        updated_at: now,
      },
    });

    // Cancel the ticket
    await tx.tickets.update({
      where: { id: payment.ticket_id },
      data: {
        status: 'cancelled',
        updated_at: now,
      },
    });

    // Log audit
    await tx.audit_logs.create({
      data: {
        company_id: payment.company_id,
        user_id: userId,
        player_id: payment.player_id,
        action: 'MANUAL_PAYMENT_REJECTED',
        entity_type: 'payment',
        entity_id: paymentId,
        changes_json: {
          before: { status: payment.status },
          after: { status: 'failed' },
          reason: reason || null,
        },
      },
    });

    return { success: true };
  });
}
