import { Prisma } from '@prisma/client';

/**
 * Converts Prisma Decimal objects to plain numbers for JSON serialization.
 */
function toPlain(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === 'bigint') return Number(val);
  if (val instanceof Date) return val.toISOString();
  // Prisma Decimal has a toNumber() method
  if (typeof val === 'object' && val !== null && 'toNumber' in val && typeof (val as any).toNumber === 'function') {
    return (val as any).toNumber();
  }
  return val;
}

/**
 * Picks only the specified fields from an object, converting Decimals to numbers.
 */
function pickFields(obj: Record<string, any>, fields: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in obj) {
      result[field] = toPlain(obj[field]);
    }
  }
  return result;
}

/**
 * Builds a changes_json object for a CREATE operation.
 * Returns: { created: { field1: value1, ... } }
 */
export function buildCreateChanges(
  data: Record<string, any>,
  fields: string[],
): Prisma.InputJsonValue {
  return { created: pickFields(data, fields) } as unknown as Prisma.InputJsonValue;
}

/**
 * Builds a changes_json object for a DELETE operation.
 * Returns: { deleted: { field1: value1, ... } }
 */
export function buildDeleteChanges(
  data: Record<string, any>,
  fields: string[],
): Prisma.InputJsonValue {
  return { deleted: pickFields(data, fields) } as unknown as Prisma.InputJsonValue;
}

/**
 * Builds a changes_json object for an UPDATE operation.
 * Only includes fields that actually changed.
 * Returns: { before: { field1: oldVal }, after: { field1: newVal } }
 * Returns null if nothing changed.
 */
export function buildUpdateChanges(
  before: Record<string, any>,
  after: Record<string, any>,
  fields: string[],
): Prisma.InputJsonValue | null {
  const beforeObj: Record<string, unknown> = {};
  const afterObj: Record<string, unknown> = {};
  let hasChanges = false;

  for (const field of fields) {
    const oldVal = toPlain(before[field]);
    const newVal = toPlain(after[field]);
    // Compare stringified values to handle Decimal -> number conversion
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      beforeObj[field] = oldVal;
      afterObj[field] = newVal;
      hasChanges = true;
    }
  }

  if (!hasChanges) return null;

  return { before: beforeObj, after: afterObj } as unknown as Prisma.InputJsonValue;
}
