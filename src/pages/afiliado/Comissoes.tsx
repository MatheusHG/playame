import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AffiliateLayout } from '@/components/layouts/AffiliateLayout';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingState } from '@/components/shared/LoadingState';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';

export default function Comissoes() {
  const { slug } = useParams<{ slug: string }>();
  const { affiliate, hasPermission } = useAffiliate();

  const currentMonth = {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  };

  const lastMonth = {
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(subMonths(new Date(), 1)),
  };

  // Fetch commissions
  const { data: commissions, isLoading } = useQuery({
    queryKey: ['affiliate-commissions', affiliate?.id],
    queryFn: async () => {
      const isManager = affiliate?.type === 'manager';
      const column = isManager ? 'manager_id' : 'cambista_id';

      const { data, error } = await (supabase as any)
        .from('affiliate_commissions')
        .select(`
          *,
          ticket:tickets(id),
          raffle:raffles(id, name),
          payment:payments(id, status, amount, processed_at)
        `)
        .eq(column, affiliate?.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!affiliate?.id && hasPermission('can_view_own_commissions'),
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Calculate stats
  const calculateStats = () => {
    if (!commissions) return { total: 0, paid: 0, pending: 0, thisMonth: 0, lastMonth: 0 };

    const isManager = affiliate?.type === 'manager';
    const amountKey = isManager ? 'manager_net_amount' : 'cambista_amount';

    return commissions.reduce((acc: any, c: any) => {
      const amount = Number(c[amountKey]) || 0;
      const isPaid = c.payment?.status === 'succeeded';
      const createdAt = new Date(c.created_at);

      acc.total += amount;
      if (isPaid) acc.paid += amount;
      else acc.pending += amount;

      if (createdAt >= currentMonth.from && createdAt <= currentMonth.to) {
        acc.thisMonth += amount;
      }
      if (createdAt >= lastMonth.from && createdAt <= lastMonth.to) {
        acc.lastMonth += amount;
      }

      return acc;
    }, { total: 0, paid: 0, pending: 0, thisMonth: 0, lastMonth: 0 });
  };

  const stats = calculateStats();

  if (!hasPermission('can_view_own_commissions')) {
    return (
      <AffiliateLayout title="Comissões">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Acesso Negado</h2>
            <p className="text-muted-foreground">Você não tem permissão para ver comissões.</p>
          </div>
        </div>
      </AffiliateLayout>
    );
  }

  if (isLoading) {
    return (
      <AffiliateLayout title="Comissões">
        <LoadingState message="Carregando comissões..." />
      </AffiliateLayout>
    );
  }

  const isManager = affiliate?.type === 'manager';
  const amountKey = isManager ? 'manager_net_amount' : 'cambista_amount';

  return (
    <AffiliateLayout title="Comissões" description="Acompanhe suas comissões por vendas">
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Recebido</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.paid)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-amber-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Pendente</p>
                  <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.pending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Este Mês</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.thisMonth)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Commission Rate Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sua Taxa de Comissão</p>
                <p className="text-3xl font-bold">{affiliate?.commission_percent}%</p>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                {isManager ? 'Gerente' : 'Cambista'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {isManager 
                ? 'Você recebe comissão sobre o valor total de cada venda realizada por você e sua equipe.'
                : 'Você recebe comissão sobre a comissão do seu gerente para cada venda realizada.'
              }
            </p>
          </CardContent>
        </Card>

        {/* Commissions Table - apenas pagamentos aprovados */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Comissões</CardTitle>
            <CardDescription className="text-muted-foreground">
              Apenas comissões com pagamento aprovado
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sorteio</TableHead>
                  <TableHead>Valor Venda</TableHead>
                  <TableHead>Sua Comissão</TableHead>
                  <TableHead>Status do pagamento</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const approvedOnly = commissions?.filter((c: any) => c.payment?.status === 'succeeded') ?? [];
                  if (approvedOnly.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhuma comissão com pagamento aprovado
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return approvedOnly.map((commission: any) => (
                    <TableRow key={commission.id}>
                      <TableCell>
                        <p className="font-medium">{commission.raffle?.name}</p>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(commission.sale_amount)}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {formatCurrency(commission[amountKey] || 0)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Aprovado
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(commission.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ));
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AffiliateLayout>
  );
}
