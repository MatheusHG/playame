import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SuperAdminLayout } from '@/components/layouts/SuperAdminLayout';
import { StatsCard } from '@/components/shared/StatsCard';
import { DataTable, Column } from '@/components/shared/DataTable';
import { DollarSign, TrendingUp, Building2, Percent } from 'lucide-react';
import { Payment, Company } from '@/types/database.types';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface PaymentWithCompany extends Payment {
  company_name?: string;
}

export default function SuperAdminFinanceiro() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['financial-stats'],
    queryFn: async () => {
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, admin_fee, status');

      const succeeded = payments?.filter(p => p.status === 'succeeded') || [];
      const totalRevenue = succeeded.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalFees = succeeded.reduce((sum, p) => sum + Number(p.admin_fee), 0);
      const totalNet = totalRevenue - totalFees;

      return {
        totalRevenue,
        totalFees,
        totalNet,
        transactionCount: succeeded.length,
      };
    },
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Fetch company names
      const companyIds = [...new Set(data.map(p => p.company_id))];
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);

      const companiesMap = (companies || []).reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {} as Record<string, string>);

      return data.map(payment => ({
        ...payment,
        company_name: companiesMap[payment.company_id],
      })) as PaymentWithCompany[];
    },
  });

  const columns: Column<PaymentWithCompany>[] = [
    {
      key: 'created_at',
      header: 'Data',
      render: (item) => new Date(item.created_at).toLocaleDateString('pt-BR'),
    },
    {
      key: 'company_name',
      header: 'Empresa',
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
  ];

  const formatCurrency = (value: number) =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <SuperAdminLayout title="Financeiro" description="Relatórios financeiros globais">
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

      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Histórico de Transações</h3>
          <p className="text-sm text-muted-foreground">Últimas 100 transações</p>
        </div>
        <div className="p-4">
          <DataTable
            data={payments}
            columns={columns}
            loading={paymentsLoading}
            searchPlaceholder="Buscar transações..."
            emptyMessage="Nenhuma transação registrada"
          />
        </div>
      </div>
    </SuperAdminLayout>
  );
}
