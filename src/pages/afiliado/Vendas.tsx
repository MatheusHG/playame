import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AffiliateLayout } from '@/components/layouts/AffiliateLayout';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingState } from '@/components/shared/LoadingState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Ticket,
  Calendar,
  User,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Vendas() {
  const { slug } = useParams<{ slug: string }>();
  const { affiliate, hasPermission } = useAffiliate();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch sales/tickets for this affiliate
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['affiliate-sales', affiliate?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tickets')
        .select(`
          *,
          player:players(id, name, cpf_last4, phone, city),
          raffle:raffles(id, name, ticket_price),
          payment:payments(id, status, amount)
        `)
        .eq('affiliate_id', affiliate?.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!affiliate?.id && hasPermission('can_view_own_sales'),
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      active: { variant: 'default', label: 'Ativa' },
      pending_payment: { variant: 'secondary', label: 'Aguardando Pagamento' },
      winner: { variant: 'default', label: 'Vencedora' },
      cancelled: { variant: 'destructive', label: 'Cancelada' },
    };
    return configs[status] || { variant: 'outline', label: status };
  };

  const filteredTickets = tickets?.filter((ticket: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      ticket.player?.name?.toLowerCase().includes(search) ||
      ticket.player?.cpf_last4?.includes(search) ||
      ticket.raffle?.name?.toLowerCase().includes(search)
    );
  });

  // Calculate totals
  const totals = tickets?.reduce((acc: any, ticket: any) => {
    const payment = ticket.payment?.[0];
    acc.total++;
    if (ticket.status === 'active') {
      acc.confirmed++;
      acc.value += Number(ticket.raffle?.ticket_price || 0);
    }
    if (ticket.status === 'pending_payment') acc.pending++;
    return acc;
  }, { total: 0, confirmed: 0, pending: 0, value: 0 }) || { total: 0, confirmed: 0, pending: 0, value: 0 };

  if (!hasPermission('can_view_own_sales')) {
    return (
      <AffiliateLayout title="Minhas Vendas">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Acesso Negado</h2>
            <p className="text-muted-foreground">Você não tem permissão para ver suas vendas.</p>
          </div>
        </div>
      </AffiliateLayout>
    );
  }

  if (isLoading) {
    return (
      <AffiliateLayout title="Minhas Vendas">
        <LoadingState message="Carregando vendas..." />
      </AffiliateLayout>
    );
  }

  return (
    <AffiliateLayout title="Minhas Vendas" description="Acompanhe todas as suas vendas">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Ticket className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{totals.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-green-600 font-bold">{totals.confirmed}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Confirmadas</p>
                  <p className="text-2xl font-bold text-green-600">{totals.confirmed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="text-amber-600 font-bold">{totals.pending}</span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-amber-600">{totals.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(totals.value)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente ou sorteio..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {hasPermission('can_create_sales') && !affiliate?.is_sales_paused && (
            <Button asChild>
              <Link to={`/afiliado/${slug}/nova-venda`}>
                <Ticket className="h-4 w-4 mr-2" />
                Nova Venda
              </Link>
            </Button>
          )}
        </div>

        {/* Sales Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Sorteio</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhuma venda encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTickets?.map((ticket: any) => {
                    const status = getStatusConfig(ticket.status);
                    return (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{ticket.player?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                CPF: ***{ticket.player?.cpf_last4}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{ticket.raffle?.name}</p>
                        </TableCell>
                        <TableCell>
                          {formatCurrency(ticket.raffle?.ticket_price || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AffiliateLayout>
  );
}
