import { prisma } from '../config/database.js';

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
  companyProfitPercent?: number;
  companyRetentionAmount?: number;
  prizePoolContribution?: number;
  ratesSnapshot: Record<string, unknown>;
}

export interface PrizeConfig {
  prize_mode: 'FIXED' | 'PERCENT_ONLY' | 'FIXED_PLUS_PERCENT';
  company_profit_percent: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calculates the commission split for a sale.
 * ALL percentages are calculated on the sale amount (ticket price):
 * 1. Super-Admin fee: % of saleAmount
 * 2. Manager commission: % of saleAmount
 * 3. Cambista commission: % of saleAmount
 * 4. Company net = saleAmount - all deductions above
 * 5. Company retention vs prize pool split (based on raffle prize config)
 */
export function calculateCommissions(
  saleAmount: number,
  superAdminPercent: number,
  manager?: { id: string; name: string; commission_percent: number },
  cambista?: { id: string; name: string; commission_percent: number },
  prizeConfig?: PrizeConfig,
): CommissionCalculation {
  // 1. Super-Admin platform fee (% of sale amount)
  const superAdminAmount = round2(saleAmount * (superAdminPercent / 100));

  // Start with sale minus admin fee
  let companyNetAmount = round2(saleAmount - superAdminAmount);

  const result: CommissionCalculation = {
    saleAmount,
    superAdminPercent,
    superAdminAmount,
    companyNetAmount,
    ratesSnapshot: {
      super_admin_percent: superAdminPercent,
    },
  };

  // 2. Manager: percentage on SALE AMOUNT (ticket price)
  if (manager && manager.commission_percent > 0) {
    const managerGrossAmount = round2(
      saleAmount * (manager.commission_percent / 100),
    );
    companyNetAmount = round2(companyNetAmount - managerGrossAmount);

    result.managerId = manager.id;
    result.managerPercent = manager.commission_percent;
    result.managerGrossAmount = managerGrossAmount;
    result.managerNetAmount = managerGrossAmount;
    result.ratesSnapshot.manager_percent = manager.commission_percent;
    result.ratesSnapshot.manager_name = manager.name;

    // 3. Cambista: percentage on SALE AMOUNT (ticket price)
    if (cambista && cambista.commission_percent > 0) {
      const cambistaAmount = round2(
        saleAmount * (cambista.commission_percent / 100),
      );
      result.cambistaId = cambista.id;
      result.cambistaPercent = cambista.commission_percent;
      result.cambistaAmount = cambistaAmount;
      result.managerNetAmount = round2(managerGrossAmount - cambistaAmount);
      companyNetAmount = round2(companyNetAmount - cambistaAmount);
      result.ratesSnapshot.cambista_percent = cambista.commission_percent;
      result.ratesSnapshot.cambista_name = cambista.name;
    }
  }

  result.companyNetAmount = companyNetAmount;

  // 4. Company retention vs prize pool split
  if (prizeConfig) {
    result.ratesSnapshot.prize_mode = prizeConfig.prize_mode;

    if (prizeConfig.prize_mode === 'FIXED') {
      // FIXED: company keeps entire net, prize is a fixed amount (not from sales)
      result.companyProfitPercent = 100;
      result.companyRetentionAmount = companyNetAmount;
      result.prizePoolContribution = 0;
      result.ratesSnapshot.company_profit_percent = 100;
    } else {
      // PERCENT_ONLY or FIXED_PLUS_PERCENT: split net into retention + prize contribution
      const profitPercent = prizeConfig.company_profit_percent || 0;
      const retentionAmount = round2(companyNetAmount * (profitPercent / 100));
      const prizeContribution = round2(companyNetAmount - retentionAmount);

      result.companyProfitPercent = profitPercent;
      result.companyRetentionAmount = retentionAmount;
      result.prizePoolContribution = prizeContribution;
      result.ratesSnapshot.company_profit_percent = profitPercent;
    }
  }

  return result;
}

export async function getByCompany(companyId: string) {
  return prisma.affiliate_commissions.findMany({
    where: { company_id: companyId },
    include: {
      manager: {
        select: { id: true, name: true, type: true, commission_percent: true },
      },
      cambista: {
        select: { id: true, name: true, type: true, commission_percent: true },
      },
      raffle: {
        select: { id: true, name: true },
      },
      payment: {
        select: { id: true, status: true, amount: true, created_at: true },
      },
      ticket: {
        select: { id: true, status: true },
      },
    },
    orderBy: { created_at: 'desc' },
  });
}
