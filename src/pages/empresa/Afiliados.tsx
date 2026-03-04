import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { AffiliatesList } from '@/components/empresa/AffiliatesList';
import { CommissionSplitTable } from '@/components/empresa/CommissionSplitTable';
import { useTenant } from '@/contexts/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateCommissions } from '@/types/affiliate.types';
import { usePlatformSettings, useAffiliates } from '@/hooks/useAffiliates';
import { Users, Receipt, Calculator, UserCheck, UserX, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ── Stat Item ── */
interface StatItemProps { icon: LucideIcon; iconBg: string; iconColor: string; label: string; value: string | number; subtitle?: string; }
function StatItem({ icon: Icon, iconBg, iconColor, label, value, subtitle }: StatItemProps) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className="flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: iconBg }}>
        <Icon className="h-5 w-5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold tracking-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function EmpresaAfiliados() {
  const { company } = useTenant();
  const { getSuperAdminFeePercent } = usePlatformSettings();
  const { managers, affiliates } = useAffiliates(company?.id);

  if (!company) return null;

  const cambistas = affiliates.filter(a => a.type === 'cambista');
  const activeAffiliates = affiliates.filter(a => a.is_active).length;
  const inactiveAffiliates = affiliates.filter(a => !a.is_active).length;

  // Cálculo para simulador
  const sampleSale = 10;
  const superAdminPercent = getSuperAdminFeePercent();
  const sampleManagerPercent = managers[0]?.commission_percent || 5;
  const sampleCambistaPercent = 60;

  const calculation = calculateCommissions(
    sampleSale,
    superAdminPercent,
    sampleManagerPercent,
    sampleCambistaPercent
  );

  return (
    <EmpresaLayout
      title="Afiliados"
      description="Gerencie sua rede de gerentes e operadores"
    >
      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4 mb-6">
        <StatItem
          icon={Users}
          iconBg="#DBEAFE"
          iconColor="#2563EB"
          label="Total de Afiliados"
          value={affiliates.length}
        />
        <StatItem
          icon={UserPlus}
          iconBg="#EDE9FE"
          iconColor="#7C3AED"
          label="Gerentes"
          value={managers.length}
          subtitle={`${cambistas.length} operador${cambistas.length !== 1 ? 'es' : ''}`}
        />
        <StatItem
          icon={UserCheck}
          iconBg="#DCFCE7"
          iconColor="#16A34A"
          label="Ativos"
          value={activeAffiliates}
        />
        <StatItem
          icon={UserX}
          iconBg="#FEE2E2"
          iconColor="#DC2626"
          label="Inativos"
          value={inactiveAffiliates}
        />
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <Tabs defaultValue="affiliates">
          <div className="bg-muted/30 px-4 pt-3">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              <TabsTrigger
                value="affiliates"
                className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Users className="h-4 w-4" />
                Gerentes e Operadores
              </TabsTrigger>
              <TabsTrigger
                value="commissions"
                className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Receipt className="h-4 w-4" />
                Histórico de Comissões
              </TabsTrigger>
              <TabsTrigger
                value="calculator"
                className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm"
              >
                <Calculator className="h-4 w-4" />
                Simulador
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-5">
            <TabsContent value="affiliates" className="mt-0">
              <AffiliatesList companyId={company.id} />
            </TabsContent>

            <TabsContent value="commissions" className="mt-0">
              <CommissionSplitTable companyId={company.id} />
            </TabsContent>

            <TabsContent value="calculator" className="mt-0">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold">Simulador de Comissões</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Veja como o split é calculado para uma venda de R$ {sampleSale.toFixed(2)}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="rounded-2xl border p-5 flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }}>
                      <Receipt className="h-4 w-4" style={{ color: '#DC2626' }} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Taxa Admin</p>
                      <p className="text-xl font-bold tracking-tight">R$ {calculation.superAdminAmount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{superAdminPercent}% da venda</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-5 flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                      <Users className="h-4 w-4" style={{ color: '#2563EB' }} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gerente</p>
                      <p className="text-xl font-bold tracking-tight">R$ {calculation.managerGrossAmount?.toFixed(2) || '0.00'}</p>
                      <p className="text-xs text-muted-foreground">{sampleManagerPercent}% da cartela</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-5 flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#EDE9FE' }}>
                      <UserPlus className="h-4 w-4" style={{ color: '#7C3AED' }} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Operador</p>
                      <p className="text-xl font-bold tracking-tight">R$ {calculation.cambistaAmount?.toFixed(2) || '0.00'}</p>
                      <p className="text-xs text-muted-foreground">{sampleCambistaPercent}% da cartela</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-5 flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#DCFCE7' }}>
                      <Calculator className="h-4 w-4" style={{ color: '#16A34A' }} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresa</p>
                      <p className="text-xl font-bold tracking-tight">R$ {calculation.companyNetAmount.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Líquido final</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/30 p-5">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: '#F3F4F6' }}>
                      <Receipt className="h-4 w-4" style={{ color: '#6B7280' }} />
                    </div>
                    Detalhamento
                  </h4>
                  <ul className="space-y-2 text-sm ml-10">
                    <li className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#2563EB' }} />
                      Venda: <strong>R$ {sampleSale.toFixed(2)}</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#DC2626' }} />
                      Taxa Admin ({superAdminPercent}% da venda): <strong>- R$ {calculation.superAdminAmount.toFixed(2)}</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#16A34A' }} />
                      Valor para empresa: <strong>R$ {(sampleSale - calculation.superAdminAmount).toFixed(2)}</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#7C3AED' }} />
                      Gerente ({sampleManagerPercent}% da cartela): <strong>- R$ {calculation.managerGrossAmount?.toFixed(2)}</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#D97706' }} />
                      Empresa (líquido final): <strong>R$ {calculation.companyNetAmount.toFixed(2)}</strong>
                    </li>
                    <li className="pl-4 ml-2 border-l-2 border-muted-foreground/20 text-muted-foreground flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      Operador ({sampleCambistaPercent}% da cartela): R$ {calculation.cambistaAmount?.toFixed(2)}
                    </li>
                    <li className="pl-4 ml-2 border-l-2 border-muted-foreground/20 text-muted-foreground flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      Gerente (líquido): R$ {calculation.managerNetAmount?.toFixed(2)}
                    </li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </EmpresaLayout>
  );
}
