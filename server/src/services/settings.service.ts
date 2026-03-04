import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import * as audit from './audit.service.js';

export async function getAll() {
  return prisma.platform_settings.findMany({
    orderBy: { key: 'asc' },
  });
}

export async function getByKey(key: string) {
  const setting = await prisma.platform_settings.findUnique({
    where: { key },
  });

  if (!setting) {
    throw new NotFoundError(`Setting '${key}' not found`);
  }

  return setting;
}

export async function update(
  key: string,
  value: unknown,
  updatedBy?: string,
) {
  if (!key) {
    throw new BadRequestError('Setting key is required');
  }

  if (value === undefined) {
    throw new BadRequestError('Setting value is required');
  }

  // Wrap primitive values in a JSON-compatible format
  const jsonValue: Prisma.InputJsonValue =
    typeof value === 'object' && value !== null
      ? (value as Prisma.InputJsonValue)
      : { value };

  // Fetch old value if exists
  const oldSetting = await prisma.platform_settings.findUnique({ where: { key } });

  const setting = await prisma.platform_settings.upsert({
    where: { key },
    update: {
      value: jsonValue,
      updated_by: updatedBy || null,
      updated_at: new Date(),
    },
    create: {
      key,
      value: jsonValue,
      updated_by: updatedBy || null,
    },
  });

  await audit.log({
    userId: updatedBy,
    action: oldSetting ? 'SETTING_UPDATED' : 'SETTING_CREATED',
    entityType: 'platform_setting',
    entityId: key,
    changesJson: oldSetting
      ? { before: { key, value: oldSetting.value }, after: { key, value: jsonValue } }
      : { created: { key, value: jsonValue } },
  });

  return setting;
}
