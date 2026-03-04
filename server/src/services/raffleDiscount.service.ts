import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import * as audit from './audit.service.js';

const DISCOUNT_FIELDS = ['min_quantity', 'discount_percent', 'is_active', 'raffle_id'];

export async function create(
  companyId: string,
  raffleId: string,
  data: {
    min_quantity: number;
    discount_percent: number;
    is_active?: boolean;
  },
  userId?: string,
) {
  // Verify raffle belongs to company
  const raffle = await prisma.raffles.findFirst({
    where: { id: raffleId, company_id: companyId },
  });

  if (!raffle) {
    throw new NotFoundError('Sorteio não encontrado.');
  }

  // Check if promotion with this quantity already exists
  const existing = await prisma.raffle_discounts.findFirst({
    where: { raffle_id: raffleId, min_quantity: data.min_quantity },
  });

  if (existing) {
    throw new BadRequestError('Já existe uma promoção para esta quantidade de cartelas.');
  }

  const discount = await prisma.raffle_discounts.create({
    data: {
      raffle_id: raffleId,
      min_quantity: data.min_quantity,
      discount_percent: data.discount_percent,
      is_active: data.is_active ?? true,
    },
  });

  await audit.log({
    companyId,
    userId,
    action: 'RAFFLE_DISCOUNT_CREATED',
    entityType: 'raffle_discount',
    entityId: discount.id,
    changesJson: { created: { min_quantity: data.min_quantity, discount_percent: data.discount_percent, raffle_id: raffleId } },
  });

  return discount;
}

export async function findAll(raffleId: string) {
  return prisma.raffle_discounts.findMany({
    where: { raffle_id: raffleId },
    orderBy: { min_quantity: 'asc' },
  });
}

export async function remove(companyId: string, raffleId: string, discountId: string, userId?: string) {
  // Verify raffle belongs to company
  const raffle = await prisma.raffles.findFirst({
    where: { id: raffleId, company_id: companyId },
  });

  if (!raffle) {
    throw new NotFoundError('Sorteio não encontrado.');
  }

  const discount = await prisma.raffle_discounts.findFirst({
    where: { id: discountId, raffle_id: raffleId },
  });

  if (!discount) {
    throw new NotFoundError('Promoção não encontrada.');
  }

  const result = await prisma.raffle_discounts.delete({
    where: { id: discountId },
  });

  await audit.log({
    companyId,
    userId,
    action: 'RAFFLE_DISCOUNT_REMOVED',
    entityType: 'raffle_discount',
    entityId: discountId,
    changesJson: { deleted: { min_quantity: Number(discount.min_quantity), discount_percent: Number(discount.discount_percent), raffle_id: raffleId } },
  });

  return result;
}
