import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { hashCPF, hashPassword, getCPFLast4 } from '../utils/cpf.js';
import {
    NotFoundError,
    BadRequestError,
} from '../utils/errors.js';
import { calculateTicketRanking } from './ranking.service.js';
import { calculateCommissions } from './commission.service.js';
import { getDrawnNumbers } from './draw.service.js';

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export interface CreateStreetSaleParams {
    companyId: string;
    userId: string;
    raffleId: string;
    customerName: string;
    customerPhone: string;
    quantity: number;
    ticketNumbers: number[][];
}

export async function createStreetSale(params: CreateStreetSaleParams) {
    const {
        companyId,
        userId,
        raffleId,
        customerName,
        customerPhone,
        quantity,
        ticketNumbers,
    } = params;

    if (!companyId || !raffleId || !customerName || !customerPhone) {
        throw new BadRequestError('Missing required parameters');
    }

    if (ticketNumbers.length !== quantity) {
        throw new BadRequestError('Number of ticket number sets must match quantity');
    }

    // Fetch seller info
    const seller = await prisma.users.findUnique({
        where: { id: userId },
        select: { email: true },
    });

    // Fetch company
    const company = await prisma.companies.findUnique({ where: { id: companyId } });
    if (!company) {
        throw new NotFoundError('Company not found');
    }

    // Fetch raffle
    const raffle = await prisma.raffles.findFirst({
        where: { id: raffleId, company_id: companyId, status: 'active' },
    });

    if (!raffle) {
        throw new NotFoundError('Sorteio nao encontrado ou nao esta ativo');
    }

    // Find or create player by phone
    // Since CPF is required we'll generate a dummy one if player doesn't exist
    let player = await prisma.players.findFirst({
        where: { company_id: companyId, phone: customerPhone },
    });

    if (!player) {
        // Generate dummy CPF based on timestamp to avoid collisions
        const dummyCpf = Date.now().toString().padStart(11, '0').substring(0, 11);
        const cpfHash = hashCPF(dummyCpf);
        const cpfLast4 = getCPFLast4(dummyCpf);
        const dummyPasswordHash = hashPassword(Date.now().toString());

        player = await prisma.players.create({
            data: {
                company_id: companyId,
                cpf_hash: cpfHash,
                cpf_last4: cpfLast4,
                name: customerName,
                phone: customerPhone,
                password_hash: dummyPasswordHash,
                status: 'active',
            },
        });
    }

    // Fetch discount rules
    const ticketPrice = Number(raffle.ticket_price);
    const originalAmount = round2(ticketPrice * quantity);

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

    if (finalAmount < 0) {
        throw new BadRequestError('Valor invalido apos desconto');
    }

    // Fetch admin fee
    const platformSetting = await prisma.platform_settings.findUnique({
        where: { key: 'super_admin_fee_percent' },
    });
    const superAdminFeePercent =
        (platformSetting?.value as { value?: number })?.value ?? 10;

    const prizeConfig = {
        prize_mode: raffle.prize_mode as 'FIXED' | 'PERCENT_ONLY' | 'FIXED_PLUS_PERCENT',
        company_profit_percent: Number(raffle.company_profit_percent ?? 0),
    };

    const commissionCalc = calculateCommissions(
        finalAmount,
        superAdminFeePercent,
        undefined,
        undefined,
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

    // Get eligible prize tiers
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

    // Fetch already-drawn numbers to block selection
    const drawnNumbers = await getDrawnNumbers(raffleId);
    const drawnSet = new Set(drawnNumbers);

    // Create everything in a transaction
    return prisma.$transaction(async (tx) => {
        const createdTickets: Array<{ id: string }> = [];

        for (let i = 0; i < quantity; i++) {
            const numbers = [...ticketNumbers[i]].sort((a, b) => a - b);
            const validNumbers = numbers.every(
                (n) => n >= raffle.number_range_start && n <= raffle.number_range_end,
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

            const ticket = await tx.tickets.create({
                data: {
                    raffle_id: raffleId,
                    player_id: player.id,
                    company_id: companyId,
                    status: 'active',
                    purchased_at: now,
                    eligible_prize_tiers: eligibleTiers.map((t) => t.id),
                    snapshot_data: {
                        raffle_name: raffle.name,
                        ticket_price: ticketPrice,
                        prize_mode: raffle.prize_mode,
                        fixed_prize_value: Number(raffle.fixed_prize_value),
                        prize_percent_of_sales: Number(raffle.prize_percent_of_sales),
                        rules_version: raffle.rules_version,
                        draw_count_at_purchase: raffle.current_draw_count ?? 0,
                        is_street_sale: true,
                        seller_id: userId,
                        seller_email: seller?.email || null,
                    },
                },
            });

            await tx.ticket_numbers.createMany({
                data: numbers.map((n) => ({ ticket_id: ticket.id, number: n })),
            });

            createdTickets.push({ id: ticket.id });
        }

        const payment = await tx.payments.create({
            data: {
                ticket_id: createdTickets[0].id,
                company_id: companyId,
                player_id: player.id,
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
                status: 'succeeded',
                processed_at: now,
            },
        });

        await tx.affiliate_commissions.create({
            data: {
                payment_id: payment.id,
                ticket_id: createdTickets[0].id,
                company_id: companyId,
                raffle_id: raffleId,
                sale_amount: commissionCalc.saleAmount,
                super_admin_percent: commissionCalc.superAdminPercent,
                super_admin_amount: commissionCalc.superAdminAmount,
                company_net_amount: commissionCalc.companyNetAmount,
                company_profit_percent: commissionCalc.companyProfitPercent ?? null,
                company_retention_amount: commissionCalc.companyRetentionAmount ?? 0,
                prize_pool_contribution: commissionCalc.prizePoolContribution ?? 0,
                rates_snapshot: commissionCalc.ratesSnapshot as Prisma.InputJsonValue,
            },
        });

        // Log financial - ticket sale
        await tx.financial_logs.create({
            data: {
                company_id: companyId,
                user_id: userId,
                type: 'TICKET_SALE',
                amount: finalAmount,
                reference_id: payment.id,
                reference_type: 'payment',
                description: `Venda de rua de ${quantity} cartela(s)`,
            },
        });

        // Log admin fee
        if (commissionCalc.superAdminAmount > 0) {
            await tx.financial_logs.create({
                data: {
                    company_id: companyId,
                    user_id: userId,
                    type: 'ADMIN_FEE',
                    amount: -commissionCalc.superAdminAmount,
                    reference_id: payment.id,
                    reference_type: 'payment',
                    description: 'Taxa administrativa da plataforma (Venda de Rua)',
                },
            });
        }

        // Log company retention (empresa profit)
        if (commissionCalc.companyRetentionAmount && commissionCalc.companyRetentionAmount > 0) {
            await tx.financial_logs.create({
                data: {
                    company_id: companyId,
                    user_id: userId,
                    type: 'COMPANY_RETENTION',
                    amount: commissionCalc.companyRetentionAmount,
                    reference_id: payment.id,
                    reference_type: 'payment',
                    description: `Retenção empresa (${commissionCalc.companyProfitPercent ?? 0}%) - Venda de Rua`,
                },
            });
        }

        // Log prize pool contribution
        if (commissionCalc.prizePoolContribution && commissionCalc.prizePoolContribution > 0) {
            await tx.financial_logs.create({
                data: {
                    company_id: companyId,
                    user_id: userId,
                    type: 'PRIZE_POOL',
                    amount: commissionCalc.prizePoolContribution,
                    reference_id: payment.id,
                    reference_type: 'payment',
                    description: `Contribuição ao prêmio - Venda de Rua`,
                },
            });
        }

        // Log audit
        await tx.audit_logs.create({
            data: {
                company_id: companyId,
                user_id: userId,
                player_id: player.id,
                action: 'STREET_SALE_CREATED',
                entity_type: 'payment',
                entity_id: payment.id,
                changes_json: {
                    ticket_count: quantity,
                    raffle_id: raffleId,
                },
            },
        });

        return {
            success: true,
            paymentId: payment.id,
            ticketIds: createdTickets.map((t) => t.id),
            message: 'Venda de rua registrada com sucesso',
        };
    }).then(async (result) => {
        // Calculate rankings outside transaction to avoid locks
        for (const ticketId of result.ticketIds) {
            await calculateTicketRanking(ticketId).catch(console.error);
        }
        return result;
    });
}

export async function getStreetSaleDetail(paymentId: string) {
    const payment = await prisma.payments.findUnique({
        where: { id: paymentId },
        include: {
            player: { select: { id: true, name: true, phone: true } },
            raffle: { select: { id: true, name: true, ticket_price: true } },
            ticket: {
                include: { ticket_numbers: { orderBy: { number: 'asc' } } },
            },
            affiliate_commissions: true,
        },
    });

    if (!payment) {
        throw new NotFoundError('Payment not found');
    }

    // Get ALL tickets for this sale (same player + raffle + purchased_at window)
    const mainTicket = payment.ticket;
    let allTickets: any[] = [];

    if (mainTicket?.purchased_at) {
        const purchasedAt = mainTicket.purchased_at;
        const from = new Date(purchasedAt.getTime() - 2000);
        const to = new Date(purchasedAt.getTime() + 2000);

        allTickets = await prisma.tickets.findMany({
            where: {
                player_id: payment.player_id,
                raffle_id: payment.raffle_id,
                purchased_at: { gte: from, lte: to },
                snapshot_data: { path: ['is_street_sale'], equals: true },
            },
            include: { ticket_numbers: { orderBy: { number: 'asc' } } },
            orderBy: { created_at: 'asc' },
        });
    } else if (mainTicket) {
        allTickets = [mainTicket];
    }

    // Get financial logs
    const financialLogs = await prisma.financial_logs.findMany({
        where: { reference_id: paymentId, reference_type: 'payment' },
        orderBy: { created_at: 'asc' },
    });

    // Get audit logs
    const auditLogs = await prisma.audit_logs.findMany({
        where: { entity_id: paymentId, entity_type: 'payment' },
        orderBy: { created_at: 'asc' },
    });

    const commission = payment.affiliate_commissions?.[0] || null;

    // Extract seller info from snapshot_data
    const firstTicketSnapshot = allTickets[0]?.snapshot_data as Record<string, any> | null;
    const sellerEmail = firstTicketSnapshot?.seller_email || null;

    return {
        payment: {
            id: payment.id,
            amount: payment.amount,
            admin_fee: payment.admin_fee,
            net_amount: payment.net_amount,
            original_amount: payment.original_amount,
            discount_percent: payment.discount_percent,
            discount_amount: payment.discount_amount,
            company_retention: payment.company_retention,
            prize_pool_contribution: payment.prize_pool_contribution,
            status: payment.status,
            processed_at: payment.processed_at,
            created_at: payment.created_at,
        },
        player: payment.player,
        raffle: payment.raffle,
        seller_email: sellerEmail,
        tickets: allTickets.map((t: any) => ({
            id: t.id,
            status: t.status,
            numbers: t.ticket_numbers.map((n: any) => n.number),
        })),
        commission: commission
            ? {
                  super_admin_percent: commission.super_admin_percent,
                  super_admin_amount: commission.super_admin_amount,
                  company_net_amount: commission.company_net_amount,
                  company_profit_percent: commission.company_profit_percent,
                  company_retention_amount: commission.company_retention_amount,
                  prize_pool_contribution: commission.prize_pool_contribution,
              }
            : null,
        financialLogs: financialLogs.map((l) => ({
            id: l.id,
            type: l.type,
            amount: l.amount,
            description: l.description,
            created_at: l.created_at,
        })),
        auditLogs: auditLogs.map((l) => ({
            id: l.id,
            action: l.action,
            changes_json: l.changes_json,
            created_at: l.created_at,
        })),
    };
}

export interface GetStreetSalesParams {
    companyId: string;
    search?: string;
    raffleId?: string;
    startDate?: string;
    endDate?: string;
}

export async function getStreetSales(params: GetStreetSalesParams) {
    const { companyId, search, raffleId, startDate, endDate } = params;

    let playerFilter: any = undefined;
    if (search) {
        playerFilter = {
            is: {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search } },
                ]
            }
        };
    }

    const payments = await prisma.payments.findMany({
        where: {
            company_id: companyId,
            status: 'succeeded',
            ticket: {
                is: {
                    snapshot_data: {
                        path: ['is_street_sale'],
                        equals: true,
                    }
                }
            },
            raffle_id: raffleId ? raffleId : undefined,
            processed_at: {
                gte: startDate ? new Date(startDate) : undefined,
                lte: endDate ? new Date(endDate) : undefined,
            },
            player: playerFilter,
        },
        include: {
            player: {
                select: {
                    id: true,
                    name: true,
                    phone: true,
                },
            },
            raffle: {
                select: {
                    id: true,
                    name: true,
                },
            },
            ticket: {
                include: {
                    ticket_numbers: { orderBy: { number: 'asc' } },
                },
            },
        },
        orderBy: { processed_at: 'desc' },
    });

    // For each payment, count all tickets in the sale
    const enriched = await Promise.all(
        payments.map(async (p) => {
            let ticketCount = 1;
            if (p.ticket?.purchased_at) {
                const from = new Date(p.ticket.purchased_at.getTime() - 2000);
                const to = new Date(p.ticket.purchased_at.getTime() + 2000);
                ticketCount = await prisma.tickets.count({
                    where: {
                        player_id: p.player_id,
                        raffle_id: p.raffle_id,
                        purchased_at: { gte: from, lte: to },
                        snapshot_data: { path: ['is_street_sale'], equals: true },
                    },
                });
            }
            return { ...p, ticketCount };
        }),
    );

    return enriched;
}
