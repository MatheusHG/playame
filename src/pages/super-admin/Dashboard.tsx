import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SuperAdminLayout } from '@/components/layouts/SuperAdminLayout';
import { StatsCard } from '@/components/shared/StatsCard';
import { LoadingState } from '@/components/shared/LoadingState';
import { Building2, Users, DollarSign, Ticket } from 'lucide-react';

export default function SuperAdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['super-admin-stats'],
    queryFn: async () => {
      const [companiesRes, playersRes, paymentsRes, ticketsRes] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('players').select('id', { count: 'exact', head: true }),
        supabase.from('payments').select('amount').eq('status', 'succeeded'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      const totalRevenue = paymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      return {
        companies: companiesRes.count || 0,
        players: playersRes.count || 0,
        revenue: totalRevenue,
        activeTickets: ticketsRes.count || 0,
      };
    },
  });

  return (
    <SuperAdminLayout title="Dashboard" description="Visão geral da plataforma">
      {isLoading ? (
        <LoadingState message="Carregando estatísticas..." className="py-12" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total de Empresas"
            value={stats?.companies || 0}
            icon={Building2}
            description="empresas ativas"
          />
          <StatsCard
            title="Total de Jogadores"
            value={stats?.players || 0}
            icon={Users}
            description="jogadores cadastrados"
          />
          <StatsCard
            title="Faturamento Total"
            value={`R$ ${(stats?.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            description="em pagamentos aprovados"
          />
          <StatsCard
            title="Cartelas Ativas"
            value={stats?.activeTickets || 0}
            icon={Ticket}
            description="em sorteios ativos"
          />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Atividade Recente</h3>
          <p className="text-muted-foreground text-sm">
            Nenhuma atividade recente para exibir.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Alertas</h3>
          <p className="text-muted-foreground text-sm">
            Nenhum alerta no momento.
          </p>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
