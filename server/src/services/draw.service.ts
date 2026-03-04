import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { recalculateRaffleRanking } from './ranking.service.js';
import * as audit from './audit.service.js';
import { buildCreateChanges, buildUpdateChanges, buildDeleteChanges } from '../utils/auditChanges.js';

const BATCH_FIELDS = ['name', 'draw_order', 'raffle_id'];

export async function getDrawnNumbers(raffleId: string): Promise<number[]> {
  const numbers = await prisma.draw_numbers.findMany({
    where: {
      raffle_id: raffleId,
      draw_batch: { finalized_at: { not: null } },
    },
    select: { number: true },
    orderBy: { number: 'asc' },
  });
  return numbers.map((n) => n.number);
}

export async function getPublicBatches(raffleId: string) {
  return prisma.draw_batches.findMany({
    where: {
      raffle_id: raffleId,
      finalized_at: { not: null },
    },
    include: {
      draw_numbers: { orderBy: { number: 'asc' } },
    },
    orderBy: { draw_order: 'asc' },
  });
}

export async function getBatches(raffleId: string) {
  return prisma.draw_batches.findMany({
    where: { raffle_id: raffleId },
    include: {
      draw_numbers: { orderBy: { number: 'asc' } },
    },
    orderBy: { draw_order: 'asc' },
  });
}

export async function createBatch(
  raffleId: string,
  data: { name?: string; draw_order?: number },
  userId?: string,
) {
  const raffle = await prisma.raffles.findUnique({ where: { id: raffleId } });
  if (!raffle) {
    throw new NotFoundError('Raffle not found');
  }

  // Auto-calculate draw_order if not provided
  let drawOrder = data.draw_order;
  if (drawOrder === undefined || drawOrder === null) {
    const lastBatch = await prisma.draw_batches.findFirst({
      where: { raffle_id: raffleId },
      orderBy: { draw_order: 'desc' },
      select: { draw_order: true },
    });
    drawOrder = (lastBatch?.draw_order ?? 0) + 1;
  }

  // Check if draw_order already exists
  const existing = await prisma.draw_batches.findUnique({
    where: {
      raffle_id_draw_order: {
        raffle_id: raffleId,
        draw_order: drawOrder,
      },
    },
  });

  if (existing) {
    throw new ConflictError('Draw order already exists for this raffle');
  }

  const batch = await prisma.draw_batches.create({
    data: {
      raffle_id: raffleId,
      name: data.name || null,
      draw_order: drawOrder,
    },
    include: {
      draw_numbers: true,
    },
  });

  await audit.log({
    companyId: raffle.company_id,
    userId,
    action: 'DRAW_BATCH_CREATED',
    entityType: 'draw_batch',
    entityId: batch.id,
    changesJson: buildCreateChanges(batch, BATCH_FIELDS),
  });

  return batch;
}

export async function updateBatch(
  id: string,
  data: { name?: string; draw_order?: number },
  userId?: string,
) {
  const batch = await prisma.draw_batches.findUnique({ where: { id } });
  if (!batch) {
    throw new NotFoundError('Draw batch not found');
  }

  if (batch.finalized_at) {
    throw new BadRequestError('Cannot update a finalized batch');
  }

  // If draw_order is changing, check for conflicts
  if (data.draw_order !== undefined && data.draw_order !== batch.draw_order) {
    const existing = await prisma.draw_batches.findUnique({
      where: {
        raffle_id_draw_order: {
          raffle_id: batch.raffle_id,
          draw_order: data.draw_order,
        },
      },
    });

    if (existing) {
      throw new ConflictError('Draw order already exists for this raffle');
    }
  }

  const updated = await prisma.draw_batches.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.draw_order !== undefined ? { draw_order: data.draw_order } : {}),
    },
    include: {
      draw_numbers: { orderBy: { number: 'asc' } },
    },
  });

  const changes = buildUpdateChanges(batch, updated, BATCH_FIELDS);
  if (changes) {
    const raffle = await prisma.raffles.findUnique({ where: { id: batch.raffle_id }, select: { company_id: true } });
    await audit.log({
      companyId: raffle?.company_id,
      userId,
      action: 'DRAW_BATCH_UPDATED',
      entityType: 'draw_batch',
      entityId: id,
      changesJson: changes,
    });
  }

  return updated;
}

export async function deleteBatch(id: string, userId?: string) {
  const batch = await prisma.draw_batches.findUnique({ where: { id } });
  if (!batch) {
    throw new NotFoundError('Draw batch not found');
  }

  if (batch.finalized_at) {
    throw new BadRequestError('Cannot delete a finalized batch');
  }

  const raffle = await prisma.raffles.findUnique({ where: { id: batch.raffle_id }, select: { company_id: true } });

  // Delete cascade will handle draw_numbers
  const result = await prisma.draw_batches.delete({ where: { id } });

  await audit.log({
    companyId: raffle?.company_id,
    userId,
    action: 'DRAW_BATCH_DELETED',
    entityType: 'draw_batch',
    entityId: id,
    changesJson: buildDeleteChanges(batch, BATCH_FIELDS),
  });

  return result;
}

export async function finalizeBatch(id: string, userId?: string) {
  const batch = await prisma.draw_batches.findUnique({
    where: { id },
    include: { draw_numbers: true },
  });

  if (!batch) {
    throw new NotFoundError('Draw batch not found');
  }

  if (batch.finalized_at) {
    throw new BadRequestError('Batch already finalized');
  }

  if (batch.draw_numbers.length === 0) {
    throw new BadRequestError('Cannot finalize a batch with no drawn numbers');
  }

  const updated = await prisma.draw_batches.update({
    where: { id },
    data: { finalized_at: new Date() },
    include: {
      draw_numbers: { orderBy: { number: 'asc' } },
    },
  });

  // Update current_draw_count on the raffle
  const totalDrawnCount = await prisma.draw_numbers.count({
    where: {
      raffle_id: batch.raffle_id,
      draw_batch: { finalized_at: { not: null } },
    },
  });

  await prisma.raffles.update({
    where: { id: batch.raffle_id },
    data: { current_draw_count: totalDrawnCount },
  });

  // Trigger ranking recalculation
  await recalculateRaffleRanking(batch.raffle_id);

  const raffle = await prisma.raffles.findUnique({ where: { id: batch.raffle_id }, select: { company_id: true } });
  await audit.log({
    companyId: raffle?.company_id,
    userId,
    action: 'DRAW_BATCH_FINALIZED',
    entityType: 'draw_batch',
    entityId: id,
    changesJson: {
      batch_name: batch.name,
      draw_order: batch.draw_order,
      numbers: updated.draw_numbers.map(n => n.number),
    },
  });

  return updated;
}

export async function addNumber(batchId: string, raffleId: string, number: number, userId?: string) {
  const batch = await prisma.draw_batches.findUnique({ where: { id: batchId } });
  if (!batch) {
    throw new NotFoundError('Draw batch not found');
  }

  if (batch.finalized_at) {
    throw new BadRequestError('Cannot add numbers to a finalized batch');
  }

  // Check raffle range
  const raffle = await prisma.raffles.findUnique({ where: { id: raffleId } });
  if (!raffle) {
    throw new NotFoundError('Raffle not found');
  }

  if (number < raffle.number_range_start || number > raffle.number_range_end) {
    throw new BadRequestError(
      `Number must be between ${raffle.number_range_start} and ${raffle.number_range_end}`,
    );
  }

  // Check if number already drawn for this raffle (across all batches)
  const existing = await prisma.draw_numbers.findUnique({
    where: {
      raffle_id_number: {
        raffle_id: raffleId,
        number,
      },
    },
  });

  if (existing) {
    throw new ConflictError(`Number ${number} has already been drawn in this raffle`);
  }

  const result = await prisma.draw_numbers.create({
    data: {
      draw_batch_id: batchId,
      raffle_id: raffleId,
      number,
    },
  });

  await audit.log({
    companyId: raffle.company_id,
    userId,
    action: 'DRAW_NUMBER_ADDED',
    entityType: 'draw_number',
    entityId: result.id,
    changesJson: { created: { number, batch_id: batchId, raffle_id: raffleId } },
  });

  return result;
}

export async function removeNumber(id: string, userId?: string) {
  const drawNumber = await prisma.draw_numbers.findUnique({
    where: { id },
    include: { draw_batch: true },
  });

  if (!drawNumber) {
    throw new NotFoundError('Draw number not found');
  }

  if (drawNumber.draw_batch.finalized_at) {
    throw new BadRequestError('Cannot remove numbers from a finalized batch');
  }

  const result = await prisma.draw_numbers.delete({ where: { id } });

  const raffle = await prisma.raffles.findUnique({ where: { id: drawNumber.raffle_id }, select: { company_id: true } });
  await audit.log({
    companyId: raffle?.company_id,
    userId,
    action: 'DRAW_NUMBER_REMOVED',
    entityType: 'draw_number',
    entityId: id,
    changesJson: { deleted: { number: drawNumber.number, batch_id: drawNumber.draw_batch_id, raffle_id: drawNumber.raffle_id } },
  });

  return result;
}
