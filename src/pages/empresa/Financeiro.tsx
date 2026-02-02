import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, Column } from '@/components/shared/DataTable';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { ManualPaymentApproval } from '@/components/empresa/ManualPaymentApproval';
import { DollarSign, TrendingUp, Receipt, ArrowUpCircle, CircleDollarSign, User } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type Payment = Database['public']['Tables']['payments']['Row'];
type FinancialLog = Database['public']['Tables']['financial_logs']['Row'] & {
  user_email?: string;
};

export default function EmpresaFinanceiro() {
  const { slug } = useParams<{ slug: string }>();
  const { setCompanySlug, company, loading } = useTenant();
  
  // Date filters
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  // Fetch payments with date filter
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['company-payments', company?.id, startDate, endDate],
    enabled: !!company?.id,
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('*')
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (startDate) {
        query = query.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Payment[];
    },
  });

  // Fetch financial logs with date filter and user info
  const { data: financialLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['company-financial-logs', company?.id, startDate, endDate],
    enabled: !!company?.id,
    queryFn: async () => {
      let query = supabase
        .from('financial_logs')
        .select('*')
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (startDate) {
        query = query.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user emails for logs that have user_id
      const userIds = [...new Set((data || []).map(log => log.user_id).filter(Boolean))];
      let usersMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        // We need to use auth.users but we can't directly query it
        // Instead, we'll show user_id abbreviated or fetch from audit_logs
        // For now, just show user_id if available
      }

      return (data || []).map(log => ({
        ...log,
        user_email: log.user_id ? `Usuário ${log.user_id.slice(0, 8)}...` : undefined,
      })) as FinancialLog[];
    },
  });

  if (loading) {
    return <LoadingState fullScreen message="Carregando empresa..." />;
  }

  // Calculate stats (filtered data)
  const succeededPayments = payments.filter((p) => p.status === 'succeeded');
  const totalSales = succeededPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalFees = succeededPayments.reduce((sum, p) => sum + Number(p.admin_fee || 0), 0);
  const netRevenue = succeededPayments.reduce((sum, p) => sum + Number(p.net_amount), 0);

  const handleClearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const paymentColumns: Column<Payment>[] = [
    {
      key: 'created_at',
      header: 'Data',
      render: (p) => (
        <div>
          <p className="font-medium">{format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'HH:mm')}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Valor Bruto',
      render: (p) => <span className="font-mono">R$ {Number(p.amount).toFixed(2)}</span>,
    },
    {
      key: 'admin_fee',
      header: 'Taxa Admin',
      render: (p) => <span className="font-mono text-muted-foreground">R$ {Number(p.admin_fee || 0).toFixed(2)}</span>,
    },
    {
      key: 'net_amount',
      header: 'Valor Líquido',
      render: (p) => <span className="font-mono font-medium text-primary">R$ {Number(p.net_amount).toFixed(2)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <Badge
          variant={
            p.status === 'succeeded'
              ? 'default'
              : p.status === 'pending' || p.status === 'processing'
              ? 'secondary'
              : 'destructive'
          }
        >
          {p.status === 'succeeded'
            ? 'Pago'
            : p.status === 'pending'
            ? 'Pendente'
            : p.status === 'processing'
            ? 'Processando'
            : p.status === 'failed'
            ? 'Falhou'
            : 'Reembolsado'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (p) => (
        <ManualPaymentApproval 
          payment={{
            id: p.id,
            ticket_id: p.ticket_id,
            status: p.status,
            amount: Number(p.amount)
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

  return (
    <EmpresaLayout title="Financeiro" description="Relatórios financeiros da empresa">
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total de Vendas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {totalSales.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{succeededPayments.length} pagamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Taxa Administrativa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">R$ {totalFees.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              {company?.admin_fee_percentage}% por venda
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Receita Líquida
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">R$ {netRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Disponível para premiação</p>
          </CardContent>
        </Card>
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
          <DataTable
            data={payments}
            columns={paymentColumns}
            loading={loadingPayments}
            searchPlaceholder="Buscar pagamentos..."
            emptyMessage="Nenhum pagamento registrado"
          />
        </TabsContent>

        <TabsContent value="movimentacoes">
          <DataTable
            data={financialLogs}
            columns={logColumns}
            loading={loadingLogs}
            searchPlaceholder="Buscar movimentações..."
            emptyMessage="Nenhuma movimentação registrada"
          />
        </TabsContent>
      </Tabs>
    </EmpresaLayout>
  );
}
