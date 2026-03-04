import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SuperAdminLayout } from '@/components/layouts/SuperAdminLayout';
import { StatsCard } from '@/components/shared/StatsCard';
import { DataTable, Column } from '@/components/shared/DataTable';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { ManualPaymentApproval } from '@/components/empresa/ManualPaymentApproval';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Building2, Percent, CircleDollarSign, ArrowUpCircle, User, Store, Globe } from 'lucide-react';
import { Payment } from '@/types/database.types';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FinancialLog as FinancialLogBase } from '@/types/database.types';

interface PaymentWithCompany extends Payment {
  company_name?: string;
  raffle_name?: string;
  player_name?: string;
  is_street_sale?: boolean;
  seller_email?: string;
}

type FinancialLog = FinancialLogBase & {
  company_name?: string;
};

export default function SuperAdminFinanceiro() {
  // Date filters
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['financial-stats', startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.from = startOfDay(startDate).toISOString();
      if (endDate) params.to = endOfDay(endDate).toISOString();

      const data = await api.get<{
        totalRevenue: number;
        totalFees: number;
        totalNet: number;
        transactionCount: number;
      }>('/admin/financial-stats', params);

      return data;
    },
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments-list', startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.from = startOfDay(startDate).toISOString();
      if (endDate) params.to = endOfDay(endDate).toISOString();

      const data = await api.get<PaymentWithCompany[]>('/admin/payments', params);
      return data;
    },
  });

  // Fetch financial logs
  const { data: financialLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['financial-logs-all', startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.from = startOfDay(startDate).toISOString();
      if (endDate) params.to = endOfDay(endDate).toISOString();

      const data = await api.get<FinancialLog[]>('/financial-logs', params);
      return data;
    },
  });

  const handleClearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const paymentColumns: Column<PaymentWithCompany>[] = [
    {
      key: 'created_at',
      header: 'Data',
      render: (item) => (
        <div>
          <p className="font-medium">{format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(item.created_at), 'HH:mm')}</p>
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Ref',
      render: (item) => (
        <span className="font-mono text-xs text-muted-foreground">
          {item.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      key: 'company_name',
      header: 'Empresa',
    },
    {
      key: 'is_street_sale',
      header: 'Tipo',
      render: (item) => (
        <Badge variant={item.is_street_sale ? 'secondary' : 'outline'} className="gap-1 text-xs">
          {item.is_street_sale ? (
            <><Store className="h-3 w-3" /> Rua</>
          ) : (
            <><Globe className="h-3 w-3" /> Online</>
          )}
        </Badge>
      ),
    },
    {
      key: 'seller_email',
      header: 'Vendedor',
      render: (item) => {
        if (item.is_street_sale && item.seller_email) {
          return <span className="text-xs">{item.seller_email}</span>;
        }
        if (item.player_name) {
          return <span className="text-xs text-muted-foreground">{item.player_name}</span>;
        }
        return <span className="text-xs text-muted-foreground">-</span>;
      },
    },
    {
      key: 'amount',
      header: 'Valor',
      render: (item) => `R$ ${Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'admin_fee',
      header: 'Taxa Admin',
      render: (item) => `R$ ${Number(item.admin_fee).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'net_amount',
      header: 'Líquido Empresa',
      render: (item) => `R$ ${Number(item.net_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (item) => (
        <ManualPaymentApproval 
          payment={{
            id: item.id,
            ticket_id: item.ticket_id,
            status: item.status,
            amount: Number(item.amount)
          }}
        />
      ),
    },
  ];

  const logColumns: Column<FinancialLog>[] = [
    {
      key: 'created_at',
      header: 'Data',
      render: (log) => (
        <div>
          <p className="font-medium">{format(new Date(log.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'HH:mm')}</p>
        </div>
      ),
    },
    {
      key: 'company_name',
      header: 'Empresa',
      render: (log) => <span className="font-medium">{log.company_name || '-'}</span>,
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (log) => (
        <Badge variant={log.type.includes('PAYOUT') ? 'destructive' : 'default'}>
          {log.type === 'TICKET_SALE'
            ? 'Venda'
            : log.type === 'PRIZE_PAYOUT'
            ? 'Premiação'
            : log.type}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Valor',
      render: (log) => (
        <span
          className={`font-mono font-medium ${
            log.type.includes('PAYOUT') ? 'text-destructive' : 'text-primary'
          }`}
        >
          {log.type.includes('PAYOUT') ? '-' : '+'}R$ {Math.abs(Number(log.amount)).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'user_id',
      header: 'Usuário',
      render: (log) => (
        <div className="flex items-center gap-1.5">
          {log.user_id ? (
            <>
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">
                {log.user_id.slice(0, 8)}...
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Sistema</span>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Descrição',
      render: (log) => <span className="text-sm">{log.description || '-'}</span>,
    },
  ];

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <SuperAdminLayout title="Financeiro" description="Relatórios financeiros globais">
      {/* Date Filter */}
      <div className="mb-6">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClear={handleClearFilters}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatsCard
          title="Faturamento Total"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={DollarSign}
          description="pagamentos aprovados"
        />
        <StatsCard
          title="Taxas Administrativas"
          value={formatCurrency(stats?.totalFees || 0)}
          icon={Percent}
          description="receita da plataforma"
        />
        <StatsCard
          title="Repassado às Empresas"
          value={formatCurrency(stats?.totalNet || 0)}
          icon={Building2}
          description="líquido para empresas"
        />
        <StatsCard
          title="Transações"
          value={stats?.transactionCount || 0}
          icon={TrendingUp}
          description="transações aprovadas"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pagamentos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pagamentos" className="gap-2">
            <CircleDollarSign className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="gap-2">
            <ArrowUpCircle className="h-4 w-4" />
            Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pagamentos">
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Histórico de Transações</h3>
              <p className="text-sm text-muted-foreground">
                {startDate || endDate ? 'Transações filtradas por período' : 'Últimas 100 transações'}
              </p>
            </div>
            <div className="p-4">
              <DataTable
                data={payments}
                columns={paymentColumns}
                loading={paymentsLoading}
                searchPlaceholder="Buscar transações..."
                emptyMessage="Nenhuma transação registrada"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="movimentacoes">
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Movimentações Financeiras</h3>
              <p className="text-sm text-muted-foreground">
                {startDate || endDate ? 'Movimentações filtradas por período' : 'Últimas 100 movimentações'}
              </p>
            </div>
            <div className="p-4">
              <DataTable
                data={financialLogs}
                columns={logColumns}
                loading={logsLoading}
                searchPlaceholder="Buscar movimentações..."
                emptyMessage="Nenhuma movimentação registrada"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </SuperAdminLayout>
  );
}
