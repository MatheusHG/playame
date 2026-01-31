import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { StatsCard } from '@/components/shared/StatsCard';
import { LoadingState } from '@/components/shared/LoadingState';
import { Ticket, Users, DollarSign, Trophy } from 'lucide-react';

export default function EmpresaDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['empresa-stats', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const [rafflesRes, playersRes, ticketsRes, paymentsRes] = await Promise.all([
        supabase.from('raffles').select('id', { count: 'exact', head: true }).eq('company_id', company!.id).eq('status', 'active'),
        supabase.from('players').select('id', { count: 'exact', head: true }).eq('company_id', company!.id).eq('status', 'active'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('company_id', company!.id).eq('status', 'active'),
        supabase.from('payments').select('amount').eq('company_id', company!.id).eq('status', 'succeeded'),
      ]);

      const totalRevenue = paymentsRes.data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      return {
        activeRaffles: rafflesRes.count || 0,
        activePlayers: playersRes.count || 0,
        activeTickets: ticketsRes.count || 0,
        revenue: totalRevenue,
      };
    },
  });

  if (tenantLoading) {
    return <LoadingState fullScreen message="Carregando empresa..." />;
  }

  return (
    <EmpresaLayout title="Dashboard" description="Visão geral da empresa">
      {isLoading ? (
        <LoadingState message="Carregando estatísticas..." className="py-12" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Sorteios Ativos"
            value={stats?.activeRaffles || 0}
            icon={Trophy}
            description="sorteios em andamento"
          />
          <StatsCard
            title="Jogadores Ativos"
            value={stats?.activePlayers || 0}
            icon={Users}
            description="jogadores cadastrados"
          />
          <StatsCard
            title="Cartelas Ativas"
            value={stats?.activeTickets || 0}
            icon={Ticket}
            description="cartelas em jogo"
          />
          <StatsCard
            title="Faturamento"
            value={`R$ ${(stats?.revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={DollarSign}
            description="em pagamentos aprovados"
          />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Sorteios Recentes</h3>
          <p className="text-muted-foreground text-sm">
            Nenhum sorteio recente para exibir.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Últimas Vendas</h3>
          <p className="text-muted-foreground text-sm">
            Nenhuma venda recente para exibir.
          </p>
        </div>
      </div>
    </EmpresaLayout>
  );
}
