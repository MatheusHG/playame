import { useState } from 'react';
import { SuperAdminLayout } from '@/components/layouts/SuperAdminLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformSettings, useAffiliateCommissions } from '@/hooks/useAffiliates';
import { CommissionSplitTable } from '@/components/empresa/CommissionSplitTable';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Settings, Network, Receipt, History, Percent } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Affiliate, CommissionRateChange } from '@/types/affiliate.types';

export default function SuperAdminAfiliados() {
  const { getSuperAdminFeePercent, updateSuperAdminFee, isLoading: settingsLoading } = usePlatformSettings();
  const [editFeeOpen, setEditFeeOpen] = useState(false);
  const [newFee, setNewFee] = useState(getSuperAdminFeePercent());
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Buscar todos os afiliados
  const { data: allAffiliates = [], isLoading: affiliatesLoading } = useQuery({
    queryKey: ['all-affiliates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('affiliates')
        .select(`
          *,
          company:companies(name)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Buscar histórico de alterações de taxas
  const { data: rateChanges = [], isLoading: changesLoading } = useQuery({
    queryKey: ['commission-rate-changes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('commission_rate_changes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as CommissionRateChange[];
    },
  });

  const handleUpdateFee = () => {
    updateSuperAdminFee.mutate(newFee, {
      onSuccess: () => setEditFeeOpen(false),
    });
  };

  const affiliateColumns: Column<typeof allAffiliates[0]>[] = [
    {
      key: 'name',
      header: 'Nome',
      render: (item) => (
        <div>
          <div className="font-medium">{item.name}</div>
          <div className="text-sm text-muted-foreground">{(item as any).company?.name}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (item) => (
        <Badge variant={item.type === 'manager' ? 'default' : 'secondary'}>
          {item.type === 'manager' ? 'Gerente' : 'Operador'}
        </Badge>
      ),
    },
    {
      key: 'commission_percent',
      header: 'Comissão',
      render: (item) => (
        <span className="font-mono">{item.commission_percent}%</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (item) => (
        <Badge variant={item.is_active ? 'outline' : 'secondary'}>
          {item.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Cadastro',
      render: (item) => format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR }),
    },
  ];

  const changesColumns: Column<CommissionRateChange>[] = [
    {
      key: 'created_at',
      header: 'Data',
      render: (item) => format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    },
    {
      key: 'entity_type',
      header: 'Entidade',
      render: (item) => (
        <Badge variant="outline" className="capitalize">
          {item.entity_type}
        </Badge>
      ),
    },
    {
      key: 'field_changed',
      header: 'Campo',
      render: (item) => <span className="font-mono text-sm">{item.field_changed}</span>,
    },
    {
      key: 'old_value',
      header: 'Antes',
      render: (item) => (
        <span className="font-mono">{item.old_value !== null ? `${item.old_value}%` : '-'}</span>
      ),
    },
    {
      key: 'new_value',
      header: 'Depois',
      render: (item) => (
        <span className="font-mono">{item.new_value !== null ? `${item.new_value}%` : '-'}</span>
      ),
    },
    {
      key: 'changed_by',
      header: 'Alterado por',
      render: (item) => (
        <span className="font-mono text-xs">
          {item.changed_by ? `${item.changed_by.slice(0, 8)}...` : 'Sistema'}
        </span>
      ),
    },
  ];

  return (
    <SuperAdminLayout title="Afiliados" description="Gerencie taxas globais e visualize a rede de afiliados">
      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="affiliates" className="gap-2">
            <Network className="h-4 w-4" />
            Todos Afiliados
          </TabsTrigger>
          <TabsTrigger value="commissions" className="gap-2">
            <Receipt className="h-4 w-4" />
            Comissões
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Taxa Global Super-Admin
                </CardTitle>
                <CardDescription>
                  Esta taxa é aplicada sobre todas as vendas, antes de qualquer outra comissão.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-4xl font-bold">{getSuperAdminFeePercent()}%</p>
                    <p className="text-sm text-muted-foreground">Taxa atual</p>
                  </div>
                  <Button onClick={() => {
                    setNewFee(getSuperAdminFeePercent());
                    setEditFeeOpen(true);
                  }}>
                    Alterar Taxa
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Como funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>
                  <strong>1. Taxa Super-Admin ({getSuperAdminFeePercent()}%):</strong> Aplicada primeiro sobre o valor total da venda.
                </p>
                <p>
                  <strong>2. Comissão do Gerente:</strong> Definida pela Empresa, calculada sobre o valor total da venda.
                </p>
                <p>
                  <strong>3. Comissão do Operador:</strong> Definida pelo Gerente, calculada sobre o valor que o Gerente recebe.
                </p>
                <p className="text-muted-foreground border-t pt-3">
                  A Empresa recebe o restante após todas as deduções.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="affiliates">
          <Card>
            <CardHeader>
              <CardTitle>Todos os Afiliados</CardTitle>
              <CardDescription>
                Visualize todos os gerentes e cambistas cadastrados em todas as empresas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={allAffiliates}
                columns={affiliateColumns}
                loading={affiliatesLoading}
                searchPlaceholder="Buscar afiliados..."
                emptyMessage="Nenhum afiliado cadastrado"
                pageSize={20}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico de Comissões</CardTitle>
                  <CardDescription>
                    Todas as comissões registradas no sistema
                  </CardDescription>
                </div>
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                />
              </div>
            </CardHeader>
            <CardContent>
              <CommissionSplitTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Alterações de Taxas</CardTitle>
              <CardDescription>
                Auditoria completa de todas as alterações de comissões
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={rateChanges}
                columns={changesColumns}
                loading={changesLoading}
                searchPlaceholder="Buscar alterações..."
                emptyMessage="Nenhuma alteração registrada"
                pageSize={20}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editFeeOpen} onOpenChange={setEditFeeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Taxa Global</DialogTitle>
            <DialogDescription>
              Esta alteração afetará todas as novas vendas. Vendas anteriores não serão afetadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-fee">Nova taxa (%)</Label>
              <Input
                id="new-fee"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={newFee}
                onChange={(e) => setNewFee(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFeeOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateFee} disabled={updateSuperAdminFee.isPending}>
              {updateSuperAdminFee.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
