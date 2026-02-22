import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { AffiliatesList } from '@/components/empresa/AffiliatesList';
import { CommissionSplitTable } from '@/components/empresa/CommissionSplitTable';
import { useTenant } from '@/contexts/TenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { calculateCommissions } from '@/types/affiliate.types';
import { usePlatformSettings, useAffiliates } from '@/hooks/useAffiliates';
import { Users, Receipt, Calculator } from 'lucide-react';

export default function EmpresaAfiliados() {
  const { company } = useTenant();
  const { getSuperAdminFeePercent } = usePlatformSettings();
  const { managers } = useAffiliates(company?.id);

  if (!company) return null;

  // Exemplo de cálculo para demonstração
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
      <Tabs defaultValue="affiliates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="affiliates" className="gap-2">
            <Users className="h-4 w-4" />
            Gerentes e Operadores
          </TabsTrigger>
          <TabsTrigger value="commissions" className="gap-2">
            <Receipt className="h-4 w-4" />
            Histórico de Comissões
          </TabsTrigger>
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="h-4 w-4" />
            Simulador
          </TabsTrigger>
        </TabsList>

        <TabsContent value="affiliates">
          <AffiliatesList companyId={company.id} />
        </TabsContent>

        <TabsContent value="commissions">
          <CommissionSplitTable companyId={company.id} />
        </TabsContent>

        <TabsContent value="calculator">
          <Card>
            <CardHeader>
              <CardTitle>Simulador de Comissões</CardTitle>
              <CardDescription>
                Veja como o split é calculado para uma venda de R$ {sampleSale.toFixed(2)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-destructive/10">
                    <p className="text-sm text-muted-foreground">Taxa Administrativa</p>
                    <p className="text-2xl font-bold text-destructive">
                      R$ {calculation.superAdminAmount.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">{superAdminPercent}% da venda</p>
                  </div>

                  <div className="p-4 rounded-lg bg-primary/10">
                    <p className="text-sm text-muted-foreground">Gerente (Bruto)</p>
                    <p className="text-2xl font-bold text-primary">
                      R$ {calculation.managerGrossAmount?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sampleManagerPercent}% do líquido da empresa
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-secondary">
                    <p className="text-sm text-muted-foreground">Operador</p>
                    <p className="text-2xl font-bold text-secondary-foreground">
                      R$ {calculation.cambistaAmount?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sampleCambistaPercent}% do gerente
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-accent">
                    <p className="text-sm text-muted-foreground">Empresa (Líquido)</p>
                    <p className="text-2xl font-bold text-accent-foreground">
                      R$ {calculation.companyNetAmount.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Após todos os descontos</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted">
                  <h4 className="font-medium mb-2">Detalhamento:</h4>
                  <ul className="space-y-1 text-sm">
                    <li>
                      1. Venda: <strong>R$ {sampleSale.toFixed(2)}</strong>
                    </li>
                    <li>
                      2. Taxa Admin ({superAdminPercent}% da venda):{' '}
                      <strong>- R$ {calculation.superAdminAmount.toFixed(2)}</strong>
                    </li>
                    <li>
                      3. Valor para empresa (após taxa): <strong>R$ {(sampleSale - calculation.superAdminAmount).toFixed(2)}</strong>
                    </li>
                    <li>
                      4. Gerente ({sampleManagerPercent}% do valor da empresa):{' '}
                      <strong>- R$ {calculation.managerGrossAmount?.toFixed(2)}</strong>
                    </li>
                    <li>
                      5. Empresa (líquido final): <strong>R$ {calculation.companyNetAmount.toFixed(2)}</strong>
                    </li>
                    <li className="pl-4 text-muted-foreground border-l-2 border-muted-foreground/20 ml-2">
                      • Operador ({sampleCambistaPercent}% do valor do gerente): R$ {calculation.cambistaAmount?.toFixed(2)}
                    </li>
                    <li className="pl-4 text-muted-foreground border-l-2 border-muted-foreground/20 ml-2">
                      • Gerente (líquido): R$ {calculation.managerNetAmount?.toFixed(2)}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </EmpresaLayout>
  );
}
