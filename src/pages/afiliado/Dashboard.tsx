import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AffiliateLayout } from '@/components/layouts/AffiliateLayout';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { StatsCard } from '@/components/shared/StatsCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link, useParams } from 'react-router-dom';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Ticket,
  DollarSign,
  TrendingUp,
  Users,
  Link as LinkIcon,
  Copy,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AffiliateDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const { affiliate, hasPermission } = useAffiliate();
  const { toast } = useToast();

  const currentMonth = {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  };

  // Fetch sales stats
  const { data: salesStats } = useQuery({
    queryKey: ['affiliate-sales-stats', affiliate?.id, currentMonth],
    queryFn: async () => {
      // Get tickets sold by this affiliate
      const { data: tickets, error } = await (supabase as any)
        .from('tickets')
        .select('id, status, purchased_at, raffle:raffles(ticket_price)')
        .eq('affiliate_id', affiliate?.id)
        .gte('created_at', currentMonth.from.toISOString())
        .lte('created_at', currentMonth.to.toISOString());

      if (error) throw error;

      const totalSales = tickets?.length || 0;
      const confirmedSales = tickets?.filter((t: any) => t.status === 'active').length || 0;
      const totalValue = tickets?.reduce((sum: number, t: any) => 
        sum + (t.status === 'active' ? Number(t.raffle?.ticket_price || 0) : 0), 0
      ) || 0;

      return { totalSales, confirmedSales, totalValue };
    },
    enabled: !!affiliate?.id,
  });

  // Fetch commission stats
  const { data: commissionStats } = useQuery({
    queryKey: ['affiliate-commission-stats', affiliate?.id, currentMonth],
    queryFn: async () => {
      const isManager = affiliate?.type === 'manager';
      const column = isManager ? 'manager_id' : 'cambista_id';
      const amountColumn = isManager ? 'manager_net_amount' : 'cambista_amount';

      const { data, error } = await (supabase as any)
        .from('affiliate_commissions')
        .select(`${amountColumn}, payment:payments(status)`)
        .eq(column, affiliate?.id)
        .gte('created_at', currentMonth.from.toISOString())
        .lte('created_at', currentMonth.to.toISOString());

      if (error) throw error;

      const totalCommission = data?.reduce((sum: number, c: any) => 
        sum + (Number(c[amountColumn]) || 0), 0
      ) || 0;

      const paidCommission = data?.filter((c: any) => c.payment?.status === 'succeeded')
        .reduce((sum: number, c: any) => sum + (Number(c[amountColumn]) || 0), 0) || 0;

      return { totalCommission, paidCommission };
    },
    enabled: !!affiliate?.id && hasPermission('can_view_own_commissions'),
  });

  // Fetch team count (for managers)
  const { data: teamCount } = useQuery({
    queryKey: ['affiliate-team-count', affiliate?.id],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('affiliates')
        .select('id', { count: 'exact', head: true })
        .eq('parent_affiliate_id', affiliate?.id)
        .eq('is_active', true)
        .is('deleted_at', null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!affiliate?.id && affiliate?.type === 'manager' && hasPermission('can_manage_cambistas'),
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const copyLink = () => {
    const url = `${window.location.origin}/empresa/${slug}?ref=${affiliate?.link_code}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link copiado!',
      description: 'Seu link de afiliado foi copiado para a área de transferência.',
    });
  };

  if (!affiliate) return null;

  return (
    <AffiliateLayout title="Dashboard" description={`Bem-vindo, ${affiliate.name}!`}>
      <div className="space-y-6">
        {/* Paused Warning */}
        {affiliate.is_sales_paused && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive">Vendas Pausadas</h3>
              <p className="text-sm text-muted-foreground">
                Suas vendas estão temporariamente pausadas. Novos clientes que acessarem seu link
                não poderão fazer compras atribuídas a você.
              </p>
            </div>
          </div>
        )}

        {/* Quick Link Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <h3 className="font-medium flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  Seu Link de Afiliado
                </h3>
                <p className="text-sm text-muted-foreground truncate max-w-md">
                  {window.location.origin}/empresa/{slug}?ref={affiliate.link_code}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href={`${window.location.origin}/empresa/${slug}?ref=${affiliate.link_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Vendas do Mês"
            value={salesStats?.confirmedSales?.toString() || '0'}
            icon={Ticket}
            description={`${salesStats?.totalSales || 0} total (${format(new Date(), 'MMMM', { locale: ptBR })})`}
          />
          
          {hasPermission('can_view_own_commissions') && (
            <StatsCard
              title="Comissões"
              value={formatCurrency(commissionStats?.totalCommission || 0)}
              icon={DollarSign}
              description={`${formatCurrency(commissionStats?.paidCommission || 0)} recebido`}
            />
          )}

          <StatsCard
            title="Valor Vendido"
            value={formatCurrency(salesStats?.totalValue || 0)}
            icon={TrendingUp}
            description="Vendas confirmadas"
          />

          {affiliate.type === 'manager' && hasPermission('can_manage_cambistas') && (
            <StatsCard
              title="Equipe"
              value={teamCount?.toString() || '0'}
              icon={Users}
              description="Cambistas ativos"
            />
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hasPermission('can_create_sales') && !affiliate.is_sales_paused && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Nova Venda</CardTitle>
                <CardDescription>
                  Registre uma venda para um cliente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to={`/afiliado/${slug}/nova-venda`}>
                    <Ticket className="h-4 w-4 mr-2" />
                    Criar Venda
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {hasPermission('can_view_own_sales') && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Minhas Vendas</CardTitle>
                <CardDescription>
                  Acompanhe todas as suas vendas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <Link to={`/afiliado/${slug}/vendas`}>
                    Ver Vendas
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {affiliate.type === 'manager' && hasPermission('can_manage_cambistas') && (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Minha Equipe</CardTitle>
                <CardDescription>
                  Gerencie seus cambistas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <Link to={`/afiliado/${slug}/equipe`}>
                    <Users className="h-4 w-4 mr-2" />
                    Ver Equipe
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Commission Rate Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sua Comissão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="text-3xl font-bold">{affiliate.commission_percent}%</div>
                <p className="text-sm text-muted-foreground">
                  {affiliate.type === 'manager' 
                    ? 'sobre o valor total de cada venda'
                    : 'sobre a comissão do seu gerente'
                  }
                </p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                {affiliate.type === 'manager' ? 'Gerente' : 'Cambista'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </AffiliateLayout>
  );
}
