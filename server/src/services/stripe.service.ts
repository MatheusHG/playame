import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { encryptStripeKey, decryptStripeKey } from '../utils/crypto.js';
import {
  NotFoundError,
  BadRequestError,
} from '../utils/errors.js';
import { calculateCommissions } from './commission.service.js';
import { calculateTicketRanking } from './ranking.service.js';
import { getDrawnNumbers } from './draw.service.js';
import * as audit from './audit.service.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function generateRandomNumbers(start: number, end: number, count: number, excludeSet?: Set<number>): number[] {
  const available: number[] = [];
  for (let i = start; i <= end; i++) {
    if (!excludeSet || !excludeSet.has(i)) {
      available.push(i);
    }
  }
  const selected: number[] = [];
  for (let i = 0; i < count && available.length > 0; i++) {
    const idx = Math.floor(Math.random() * available.length);
    selected.push(available.splice(idx, 1)[0]);
  }
  return selected.sort((a, b) => a - b);
}

// ─── Create Checkout ──────────────────────────────────────────

export interface CreateCheckoutParams {
  companyId: string;
  playerId: string;
  raffleId: string;
  quantity?: number;
  ticketNumbers?: number[][];
  affiliateId?: string;
  origin?: string;
}

export async function createCheckout(params: CreateCheckoutParams) {
  const {
    companyId,
    playerId,
    raffleId,
    quantity = 1,
    ticketNumbers,
    affiliateId,
    origin = '',
  } = params;

  if (!companyId || !playerId || !raffleId) {
    throw new BadRequestError('Missing required parameters');
  }

  // Validate ticketNumbers if provided
  const hasCustomNumbers =
    ticketNumbers && Array.isArray(ticketNumbers) && ticketNumbers.length > 0;
  if (hasCustomNumbers && ticketNumbers.length !== quantity) {
    throw new BadRequestError('Number of ticket number sets must match quantity');
  }

  // Fetch company
  const company = await prisma.companies.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new NotFoundError('Company not found');
  }

  if (!company.payments_enabled) {
    throw new BadRequestError('Pagamentos nao habilitados para esta empresa');
  }

  const isManualPayment = company.payment_method === 'manual';

  if (!isManualPayment && !company.stripe_secret_key_encrypted) {
    throw new BadRequestError('Stripe nao configurado para esta empresa');
  }

  const stripeSecretKey = isManualPayment
    ? ''
    : decryptStripeKey(company.stripe_secret_key_encrypted!);

  // Fetch raffle
  const raffle = await prisma.raffles.findFirst({
    where: { id: raffleId, company_id: companyId, status: 'active' },
  });

  if (!raffle) {
    throw new NotFoundError('Sorteio nao encontrado ou nao esta ativo');
  }

  // Fetch player
  const player = await prisma.players.findFirst({
    where: { id: playerId, company_id: companyId },
  });

  if (!player) {
    throw new NotFoundError('Jogador nao encontrado');
  }

  // Fetch super-admin fee from platform settings
  const platformSetting = await prisma.platform_settings.findUnique({
    where: { key: 'super_admin_fee_percent' },
  });
  const superAdminFeePercent =
    (platformSetting?.value as { value?: number })?.value ?? 10;

  // Fetch affiliate chain if provided
  let manager:
    | { id: string; name: string; commission_percent: number }
    | undefined;
  let cambista:
    | { id: string; name: string; commission_percent: number }
    | undefined;

  if (affiliateId) {
    const affiliate = await prisma.affiliates.findFirst({
      where: {
        id: affiliateId,
        company_id: companyId,
        is_active: true,
        deleted_at: null,
      },
    });

    if (affiliate) {
      if (affiliate.type === 'cambista' && affiliate.parent_affiliate_id) {
        const parentManager = await prisma.affiliates.findFirst({
          where: {
            id: affiliate.parent_affiliate_id,
            is_active: true,
          },
        });

        if (parentManager) {
          manager = {
            id: parentManager.id,
            name: parentManager.name,
            commission_percent: Number(parentManager.commission_percent),
          };
          cambista = {
            id: affiliate.id,
            name: affiliate.name,
            commission_percent: Number(affiliate.commission_percent),
          };
        }
      } else if (affiliate.type === 'manager') {
        manager = {
          id: affiliate.id,
          name: affiliate.name,
          commission_percent: Number(affiliate.commission_percent),
        };
      }
    }
  }

  // Calculate amounts
  const ticketPrice = Number(raffle.ticket_price);
  const originalAmount = round2(ticketPrice * quantity);

  // Fetch discount rules
  const now = new Date();
  const discountRows = await prisma.raffle_discounts.findMany({
    where: { raffle_id: raffleId, is_active: true },
    orderBy: { min_quantity: 'desc' },
  });

  const validDiscounts = discountRows.filter((d) => {
    if (!d.is_active) return false;
    const startsOk = !d.starts_at || now >= d.starts_at;
    const endsOk = !d.ends_at || now <= d.ends_at;
    return startsOk && endsOk;
  });

  const bestDiscount = validDiscounts.find(
    (d) => quantity >= d.min_quantity,
  );
  const discountPercent = bestDiscount
    ? Number(bestDiscount.discount_percent || 0)
    : 0;
  const discountAmount = round2(originalAmount * (discountPercent / 100));
  const finalAmount = round2(originalAmount - discountAmount);

  if (!finalAmount || finalAmount <= 0) {
    throw new BadRequestError('Valor invalido apos desconto');
  }

  const prizeConfig = {
    prize_mode: raffle.prize_mode as 'FIXED' | 'PERCENT_ONLY' | 'FIXED_PLUS_PERCENT',
    company_profit_percent: Number(raffle.company_profit_percent ?? 0),
  };

  const commissionCalc = calculateCommissions(
    finalAmount,
    superAdminFeePercent,
    manager,
    cambista,
    prizeConfig,
  );
  commissionCalc.ratesSnapshot.discount_percent = discountPercent;
  commissionCalc.ratesSnapshot.discount_amount = discountAmount;
  commissionCalc.ratesSnapshot.original_amount = originalAmount;
  if (bestDiscount?.id) {
    commissionCalc.ratesSnapshot.discount_rule_id = bestDiscount.id;
    commissionCalc.ratesSnapshot.discount_min_quantity =
      bestDiscount.min_quantity;
  }

  // Fetch already-drawn numbers to block selection
  const drawnNumbers = await getDrawnNumbers(raffleId);
  const drawnSet = new Set(drawnNumbers);

  // Create tickets
  const tickets: Array<{ id: string }> = [];
  for (let i = 0; i < quantity; i++) {
    let numbers: number[];
    if (hasCustomNumbers && ticketNumbers![i]) {
      numbers = [...ticketNumbers![i]].sort((a, b) => a - b);
      const validNumbers = numbers.every(
        (n) =>
          n >= raffle.number_range_start && n <= raffle.number_range_end,
      );
      if (!validNumbers || numbers.length !== raffle.numbers_per_ticket) {
        throw new BadRequestError(`Invalid numbers for ticket ${i + 1}`);
      }
      // Block already-drawn numbers
      const conflicting = numbers.filter((n) => drawnSet.has(n));
      if (conflicting.length > 0) {
        throw new BadRequestError(
          `Números já sorteados não podem ser selecionados: ${conflicting.map((n) => String(n).padStart(2, '0')).join(', ')}`,
        );
      }
    } else {
      numbers = generateRandomNumbers(
        raffle.number_range_start,
        raffle.number_range_end,
        raffle.numbers_per_ticket,
        drawnSet,
      );
    }

    // Get eligible prize tiers based on current draw count
    const eligibleTiers = await prisma.prize_tiers.findMany({
      where: {
        raffle_id: raffleId,
        OR: [
          { purchase_allowed_until_draw_count: null },
          {
            purchase_allowed_until_draw_count: {
              gte: raffle.current_draw_count ?? 0,
            },
          },
        ],
      },
      select: { id: true },
    });

    const ticket = await prisma.tickets.create({
      data: {
        raffle_id: raffleId,
        player_id: playerId,
        company_id: companyId,
        status: 'pending_payment',
        affiliate_id: affiliateId || null,
        eligible_prize_tiers: eligibleTiers.map((t) => t.id),
        snapshot_data: {
          raffle_name: raffle.name,
          ticket_price: ticketPrice,
          prize_mode: raffle.prize_mode,
          fixed_prize_value: Number(raffle.fixed_prize_value),
          prize_percent_of_sales: Number(raffle.prize_percent_of_sales),
          rules_version: raffle.rules_version,
          draw_count_at_purchase: raffle.current_draw_count ?? 0,
        },
      },
    });

    // Insert ticket numbers
    await prisma.ticket_numbers.createMany({
      data: numbers.map((n) => ({ ticket_id: ticket.id, number: n })),
    });

    tickets.push({ id: ticket.id });
  }

  // Create payment record
  const payment = await prisma.payments.create({
    data: {
      ticket_id: tickets[0].id,
      company_id: companyId,
      player_id: playerId,
      raffle_id: raffleId,
      amount: finalAmount,
      admin_fee: commissionCalc.superAdminAmount,
      net_amount: commissionCalc.companyNetAmount,
      original_amount: originalAmount,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      discount_rule_id: bestDiscount?.id || null,
      company_retention: commissionCalc.companyRetentionAmount ?? 0,
      prize_pool_contribution: commissionCalc.prizePoolContribution ?? 0,
      status: 'pending',
    },
  });

  // Create affiliate_commissions record
  await prisma.affiliate_commissions.create({
    data: {
      payment_id: payment.id,
      ticket_id: tickets[0].id,
      company_id: companyId,
      raffle_id: raffleId,
      sale_amount: commissionCalc.saleAmount,
      super_admin_percent: commissionCalc.superAdminPercent,
      super_admin_amount: commissionCalc.superAdminAmount,
      company_net_amount: commissionCalc.companyNetAmount,
      manager_id: commissionCalc.managerId || null,
      manager_percent: commissionCalc.managerPercent ?? null,
      manager_gross_amount: commissionCalc.managerGrossAmount ?? null,
      cambista_id: commissionCalc.cambistaId || null,
      cambista_percent:
        commissionCalc.cambistaPercent ?? null,
      cambista_amount: commissionCalc.cambistaAmount ?? null,
      manager_net_amount: commissionCalc.managerNetAmount ?? null,
      company_profit_percent: commissionCalc.companyProfitPercent ?? null,
      company_retention_amount: commissionCalc.companyRetentionAmount ?? 0,
      prize_pool_contribution: commissionCalc.prizePoolContribution ?? 0,
      rates_snapshot: commissionCalc.ratesSnapshot as Prisma.InputJsonValue,
    },
  });

  // Manual payment: return immediately without Stripe
  if (isManualPayment) {
    return {
      success: true,
      manual: true,
      paymentId: payment.id,
      ticketIds: tickets.map((t) => t.id),
      message: 'Pagamento registrado. Aguarde a aprovacao do administrador.',
    };
  }

  // Online payment: create Stripe checkout session
  const stripe = new Stripe(stripeSecretKey);

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'brl',
          product_data: {
            name: `${quantity} cartela(s) - ${raffle.name}`,
            description:
              discountPercent > 0
                ? `Inclui desconto de ${discountPercent}%`
                : `${quantity} cartela(s) com ${raffle.numbers_per_ticket} numeros cada`,
          },
          unit_amount: Math.round(finalAmount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${origin}/empresa/${company.slug}/compra-sucesso?payment_id=${payment.id}`,
    cancel_url: `${origin}/empresa/${company.slug}?cancelled=true`,
    metadata: {
      payment_id: payment.id,
      company_id: companyId,
      player_id: playerId,
      raffle_id: raffleId,
      ticket_ids: tickets.map((t) => t.id).join(','),
      affiliate_id: affiliateId || '',
      discount_percent: String(discountPercent),
      discount_amount: String(discountAmount),
      original_amount: String(originalAmount),
    },
  });

  // Update payment with Stripe session ID
  await prisma.payments.update({
    where: { id: payment.id },
    data: { stripe_checkout_session_id: session.id },
  });

  return {
    success: true,
    checkoutUrl: session.url,
    paymentId: payment.id,
    ticketIds: tickets.map((t) => t.id),
  };
}

// ─── Handle Webhook ───────────────────────────────────────────

export async function handleWebhook(
  body: string,
  signature: string,
  companyId: string,
) {
  if (!signature) {
    throw new BadRequestError('Missing stripe-signature header');
  }

  // Parse event to get metadata
  let rawEvent: Record<string, unknown>;
  try {
    rawEvent = JSON.parse(body);
  } catch {
    throw new BadRequestError('Invalid JSON payload');
  }

  // Fetch company with Stripe keys
  const company = await prisma.companies.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      stripe_secret_key_encrypted: true,
      stripe_webhook_secret_encrypted: true,
    },
  });

  if (!company) {
    throw new NotFoundError('Company not found');
  }

  if (!company.stripe_webhook_secret_encrypted) {
    throw new BadRequestError('Webhook secret not configured');
  }

  const webhookSecret = decryptStripeKey(company.stripe_webhook_secret_encrypted);
  const stripeSecretKey = company.stripe_secret_key_encrypted
    ? decryptStripeKey(company.stripe_secret_key_encrypted)
    : '';

  const stripe = new Stripe(stripeSecretKey);

  // Verify signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    throw new BadRequestError('Invalid signature');
  }

  const startTime = Date.now();
  let logStatus = 'processed';
  let logError: string | null = null;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentId = session.metadata?.payment_id;
        const ticketIds = session.metadata?.ticket_ids?.split(',') || [];
        const playerId = session.metadata?.player_id;
        const raffleId = session.metadata?.raffle_id;

        if (!paymentId) break;

        // Update payment status
        await prisma.payments.update({
          where: { id: paymentId },
          data: {
            status: 'succeeded',
            stripe_payment_intent_id: session.payment_intent as string,
            processed_at: new Date(),
            updated_at: new Date(),
          },
        });

        // Activate all tickets and calculate ranking
        for (const ticketId of ticketIds) {
          if (!ticketId) continue;

          await prisma.tickets.update({
            where: { id: ticketId },
            data: {
              status: 'active',
              purchased_at: new Date(),
              updated_at: new Date(),
            },
          });

          await calculateTicketRanking(ticketId);
        }

        // Get payment amount for financial logging
        const paymentData = await prisma.payments.findUnique({
          where: { id: paymentId },
          select: { amount: true, admin_fee: true, net_amount: true },
        });

        if (paymentData) {
          // Log financial - ticket sale
          await prisma.financial_logs.create({
            data: {
              company_id: companyId,
              type: 'TICKET_SALE',
              amount: paymentData.amount,
              reference_id: paymentId,
              reference_type: 'payment',
              description: `Venda de ${ticketIds.length} cartela(s)`,
            },
          });

          // Log admin fee
          if (paymentData.admin_fee && Number(paymentData.admin_fee) > 0) {
            await prisma.financial_logs.create({
              data: {
                company_id: companyId,
                type: 'ADMIN_FEE',
                amount: -Number(paymentData.admin_fee),
                reference_id: paymentId,
                reference_type: 'payment',
                description: 'Taxa administrativa da plataforma',
              },
            });
          }
        }

        // Log audit
        await prisma.audit_logs.create({
          data: {
            company_id: companyId,
            player_id: playerId || null,
            action: 'TICKET_PURCHASED',
            entity_type: 'ticket',
            entity_id: ticketIds[0] || null,
            changes_json: {
              payment_id: paymentId,
              ticket_count: ticketIds.length,
              raffle_id: raffleId,
            },
          },
        });

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const paymentId = paymentIntent.metadata?.payment_id;

        if (!paymentId) break;

        // Update payment status to failed
        await prisma.payments.update({
          where: { id: paymentId },
          data: {
            status: 'failed',
            stripe_payment_intent_id: paymentIntent.id,
            updated_at: new Date(),
          },
        });

        // Cancel associated ticket
        const paymentRecord = await prisma.payments.findUnique({
          where: { id: paymentId },
          select: { ticket_id: true },
        });

        if (paymentRecord?.ticket_id) {
          await prisma.tickets.update({
            where: { id: paymentRecord.ticket_id },
            data: { status: 'cancelled', updated_at: new Date() },
          });
        }

        break;
      }

      default:
        // Unhandled event type - just log it
        break;
    }
  } catch (processingError) {
    logStatus = 'error';
    logError =
      processingError instanceof Error
        ? processingError.message
        : String(processingError);
  }

  // Log webhook event
  const processingTime = Date.now() - startTime;
  await prisma.webhook_logs.create({
    data: {
      company_id: companyId,
      event_type: event.type,
      event_id: event.id,
      payload: rawEvent as Prisma.InputJsonValue,
      status: logStatus,
      error_message: logError,
      processing_time_ms: processingTime,
    },
  });

  if (logStatus === 'error') {
    throw new Error(logError || 'Webhook processing error');
  }

  return { received: true };
}

// ─── Resume Checkout ──────────────────────────────────────────

export async function resumeCheckout(
  paymentId: string,
  playerId: string,
  origin?: string,
) {
  if (!paymentId || !playerId) {
    throw new BadRequestError('Missing required parameters');
  }

  const payment = await prisma.payments.findFirst({
    where: { id: paymentId, player_id: playerId, status: 'pending' },
    include: {
      company: true,
    },
  });

  if (!payment) {
    throw new NotFoundError('Pagamento pendente nao encontrado');
  }

  if (!payment.stripe_checkout_session_id) {
    throw new BadRequestError('Sessao de checkout nao encontrada');
  }

  const company = payment.company;
  if (!company?.stripe_secret_key_encrypted) {
    throw new BadRequestError('Stripe nao configurado para esta empresa');
  }

  const stripeSecretKey = decryptStripeKey(company.stripe_secret_key_encrypted);
  const stripe = new Stripe(stripeSecretKey);

  const session = await stripe.checkout.sessions.retrieve(
    payment.stripe_checkout_session_id,
  );

  if (session.status === 'complete') {
    throw new BadRequestError('Este pagamento ja foi concluido.');
  }

  if (session.status === 'expired') {
    // Session expired - create a new one
    const raffle = await prisma.raffles.findUnique({
      where: { id: payment.raffle_id },
      select: { name: true, numbers_per_ticket: true },
    });

    const tickets = await prisma.tickets.findMany({
      where: {
        raffle_id: payment.raffle_id,
        player_id: playerId,
        status: 'pending_payment',
      },
      select: { id: true },
    });

    const ticketIds = tickets.map((t) => t.id);
    const qty = ticketIds.length || 1;

    const newSession = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `${qty} cartela(s) - ${raffle?.name || 'Sorteio'}`,
              description: `${qty} cartela(s) com ${raffle?.numbers_per_ticket || 10} numeros cada`,
            },
            unit_amount: Math.round(Number(payment.amount) * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin || ''}/empresa/${company.slug}/compra-sucesso?payment_id=${payment.id}`,
      cancel_url: `${origin || ''}/empresa/${company.slug}?cancelled=true`,
      metadata: {
        payment_id: payment.id,
        company_id: payment.company_id,
        player_id: playerId,
        raffle_id: payment.raffle_id,
        ticket_ids: ticketIds.join(','),
      },
    });

    // Update payment with new session ID
    await prisma.payments.update({
      where: { id: payment.id },
      data: { stripe_checkout_session_id: newSession.id },
    });

    return { checkoutUrl: newSession.url, renewed: true };
  }

  // Session still open
  if (session.url) {
    return { checkoutUrl: session.url };
  }

  throw new BadRequestError('Nao foi possivel recuperar o link de pagamento');
}

// ─── Manage Keys ──────────────────────────────────────────────

export async function manageKeys(
  companyId: string,
  action: 'save' | 'validate' | 'clear',
  keys?: { stripeSecretKey?: string; stripeWebhookSecret?: string },
  userId?: string,
) {
  if (action === 'save') {
    const updateData: Record<string, unknown> = {};

    if (keys?.stripeSecretKey !== undefined) {
      updateData.stripe_secret_key_encrypted = keys.stripeSecretKey
        ? encryptStripeKey(keys.stripeSecretKey)
        : null;
    }

    if (keys?.stripeWebhookSecret !== undefined) {
      updateData.stripe_webhook_secret_encrypted = keys.stripeWebhookSecret
        ? encryptStripeKey(keys.stripeWebhookSecret)
        : null;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.companies.update({
        where: { id: companyId },
        data: {
          ...updateData,
          updated_at: new Date(),
        },
      });
    }

    await audit.log({
      companyId,
      userId,
      action: 'STRIPE_KEYS_SAVED',
      entityType: 'company',
      entityId: companyId,
      changesJson: { action: 'save', keys_updated: Object.keys(updateData) },
    });

    return { success: true, message: 'Stripe keys saved successfully' };
  }

  if (action === 'validate') {
    if (!keys?.stripeSecretKey) {
      throw new BadRequestError('Stripe secret key is required for validation');
    }

    const stripe = new Stripe(keys.stripeSecretKey);

    try {
      await stripe.customers.list({ limit: 1 });
      return { valid: true, message: 'Stripe key is valid' };
    } catch {
      return { valid: false, message: 'Invalid Stripe key' };
    }
  }

  if (action === 'clear') {
    await prisma.companies.update({
      where: { id: companyId },
      data: {
        stripe_secret_key_encrypted: null,
        stripe_webhook_secret_encrypted: null,
        payments_enabled: false,
        updated_at: new Date(),
      },
    });

    await audit.log({
      companyId,
      userId,
      action: 'STRIPE_KEYS_CLEARED',
      entityType: 'company',
      entityId: companyId,
      changesJson: { action: 'clear' },
    });

    return { success: true, message: 'Stripe keys cleared successfully' };
  }

  throw new BadRequestError('Invalid action');
}
