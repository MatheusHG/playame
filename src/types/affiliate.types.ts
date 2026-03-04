// Tipos para o sistema de afiliados

export type AffiliateType = 'manager' | 'cambista';

export interface Affiliate {
  id: string;
  company_id: string;
  parent_affiliate_id: string | null;
  user_id: string | null;
  type: AffiliateType;
  name: string;
  phone: string | null;
  email: string | null;
  commission_percent: number;
  is_active: boolean;
  link_code: string;
  is_sales_paused: boolean;
  paused_at: string | null;
  paused_by: string | null;
  permission_profile_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AffiliateWithParent extends Affiliate {
  parent?: Affiliate;
  cambistas?: Affiliate[];
}

export interface AffiliateCommission {
  id: string;
  payment_id: string;
  ticket_id: string;
  company_id: string;
  raffle_id: string;
  sale_amount: number;
  super_admin_percent: number;
  super_admin_amount: number;
  company_net_amount: number;
  manager_id: string | null;
  manager_percent: number | null;
  manager_gross_amount: number | null;
  cambista_id: string | null;
  /** @deprecated Use cambista_percent instead */
  cambista_percent_of_manager: number | null;
  cambista_percent: number | null;
  cambista_amount: number | null;
  manager_net_amount: number | null;
  rates_snapshot: RatesSnapshot;
  created_at: string;
}

export interface RatesSnapshot {
  super_admin_percent: number;
  manager_percent?: number;
  cambista_percent?: number;
  /** @deprecated Use cambista_percent instead */
  cambista_percent_of_manager?: number;
  manager_name?: string;
  cambista_name?: string;
}

export interface CommissionRateChange {
  id: string;
  entity_type: 'platform' | 'company' | 'manager' | 'affiliate';
  entity_id: string;
  field_changed: string;
  old_value: number | null;
  new_value: number | null;
  changed_by: string | null;
  company_id: string | null;
  created_at: string;
}

export interface PlatformSettings {
  id: string;
  key: string;
  value: { value: number };
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

// Cálculo de comissões
// TODAS as porcentagens são calculadas sobre o valor da cartela (saleAmount)
export interface CommissionCalculation {
  saleAmount: number;
  superAdminPercent: number;
  superAdminAmount: number;
  companyNetAmount: number;
  managerId?: string;
  managerPercent?: number;
  managerGrossAmount?: number;
  cambistaId?: string;
  cambistaPercent?: number;
  cambistaAmount?: number;
  managerNetAmount?: number;
}

export function calculateCommissions(
  saleAmount: number,
  superAdminPercent: number,
  managerPercent?: number,
  cambistaPercent?: number
): CommissionCalculation {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // 1. Taxa administrativa do sistema (Super-Admin) - % da cartela
  const superAdminAmount = round2(saleAmount * (superAdminPercent / 100));

  // Começa com valor após taxa admin
  let companyNetAmount = round2(saleAmount - superAdminAmount);

  let managerGrossAmount: number | undefined;
  let cambistaAmount: number | undefined;
  let managerNetAmount: number | undefined;

  // 2. Gerente: percentual sobre o VALOR DA CARTELA
  if (managerPercent !== undefined && managerPercent > 0) {
    managerGrossAmount = round2(saleAmount * (managerPercent / 100));
    companyNetAmount = round2(companyNetAmount - managerGrossAmount);
    managerNetAmount = managerGrossAmount;

    // 3. Cambista: percentual sobre o VALOR DA CARTELA
    if (cambistaPercent !== undefined && cambistaPercent > 0) {
      cambistaAmount = round2(saleAmount * (cambistaPercent / 100));
      managerNetAmount = round2(managerGrossAmount - cambistaAmount);
      companyNetAmount = round2(companyNetAmount - cambistaAmount);
    }
  }

  return {
    saleAmount,
    superAdminPercent,
    superAdminAmount,
    companyNetAmount,
    managerPercent,
    managerGrossAmount,
    cambistaPercent,
    cambistaAmount,
    managerNetAmount,
  };
}
