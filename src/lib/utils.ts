import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata 11 dígitos como 000.000.000-00 */
export function formatCpf(cleaned: string): string {
  const digits = cleaned.replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return cleaned;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Retorna o CPF para exibição: completo quando disponível (cpf_encrypted),
 * senão retorna "" (use fallback como ***.***.***-XXXX se quiser).
 */
export function getDisplayCpf(player: {
  cpf?: string;
  cpf_last4?: string;
  cpf_encrypted?: string | null;
}): string {
  if (player.cpf) return player.cpf;
  try {
    if (player.cpf_encrypted) return formatCpf(atob(player.cpf_encrypted));
  } catch {
    // ignore invalid base64
  }
  return "";
}
