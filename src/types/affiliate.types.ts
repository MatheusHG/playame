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
  cambista_percent_of_manager: number | null;
  cambista_amount: number | null;
  manager_net_amount: number | null;
  rates_snapshot: RatesSnapshot;
  created_at: string;
}

export interface RatesSnapshot {
  super_admin_percent: number;
  manager_percent?: number;
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
export interface CommissionCalculation {
  saleAmount: number;
  superAdminPercent: number;
  superAdminAmount: number;
  companyNetAmount: number;
  managerId?: string;
  managerPercent?: number;
  managerGrossAmount?: number;
  cambistaId?: string;
  cambistaPercentOfManager?: number;
  cambistaAmount?: number;
  managerNetAmount?: number;
}

export function calculateCommissions(
  saleAmount: number,
  superAdminPercent: number,
  managerPercent?: number,
  cambistaPercentOfManager?: number
): CommissionCalculation {
  // Super-Admin taxa (sempre primeiro)
  const superAdminAmount = saleAmount * (superAdminPercent / 100);
  let companyNetAmount = saleAmount - superAdminAmount;

  let managerGrossAmount: number | undefined;
  let cambistaAmount: number | undefined;
  let managerNetAmount: number | undefined;

  // Gerente taxa (se existir)
  if (managerPercent !== undefined && managerPercent > 0) {
    managerGrossAmount = saleAmount * (managerPercent / 100);
    companyNetAmount -= managerGrossAmount;
    managerNetAmount = managerGrossAmount;

    // Cambista taxa (se existir, baseado no valor do gerente)
    if (cambistaPercentOfManager !== undefined && cambistaPercentOfManager > 0) {
      cambistaAmount = managerGrossAmount * (cambistaPercentOfManager / 100);
      managerNetAmount = managerGrossAmount - cambistaAmount;
    }
  }

  return {
    saleAmount,
    superAdminPercent,
    superAdminAmount: Math.round(superAdminAmount * 100) / 100,
    companyNetAmount: Math.round(companyNetAmount * 100) / 100,
    managerPercent,
    managerGrossAmount: managerGrossAmount !== undefined 
      ? Math.round(managerGrossAmount * 100) / 100 
      : undefined,
    cambistaPercentOfManager,
    cambistaAmount: cambistaAmount !== undefined 
      ? Math.round(cambistaAmount * 100) / 100 
      : undefined,
    managerNetAmount: managerNetAmount !== undefined 
      ? Math.round(managerNetAmount * 100) / 100 
      : undefined,
  };
}
