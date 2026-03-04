import crypto from 'crypto';
import { env } from '../config/env.js';

export function hashCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  return crypto.createHash('sha256').update(cleaned + env.CPF_SALT).digest('hex');
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned[10])) return false;

  return true;
}

export function getCPFLast4(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.slice(-4);
}
