import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRaffleTickets, TicketWithDetails } from '@/hooks/useTickets';
import { LoadingState } from '@/components/shared/LoadingState';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ticket, User, Calendar, Search, Clock } from 'lucide-react';
import { getDisplayCpf } from '@/lib/utils';

interface TicketsListProps {
  raffleId: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending_payment: { label: 'Aguardando Pagamento', variant: 'outline' },
  active: { label: 'Ativa', variant: 'default' },
  winner: { label: 'Ganhadora', variant: 'default' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
};

function isStreetSale(ticket: TicketWithDetails): boolean {
  return !!(ticket.snapshot_data as any)?.is_street_sale;
}

function getSellerEmail(ticket: TicketWithDetails): string | null {
  return (ticket.snapshot_data as any)?.seller_email || null;
}

function getRef(ticket: TicketWithDetails): string {
  const paymentId = ticket.payments?.[0]?.id;
  return (paymentId || ticket.id).slice(0, 8).toUpperCase();
}

function getDrawCountAtPurchase(ticket: TicketWithDetails): number | null {
  const val = (ticket.snapshot_data as any)?.draw_count_at_purchase;
  return val != null ? Number(val) : null;
}

export function TicketsList({ raffleId }: TicketsListProps) {
  const { data: tickets, isLoading, error } = useRaffleTickets(raffleId);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  if (isLoading) {
    return <LoadingState message="Carregando cartelas..." />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Erro ao carregar cartelas: {error.message}
        </CardContent>
      </Card>
    );
  }

  const activeTickets = tickets?.filter(t => t.status === 'active') || [];
  const pendingTickets = tickets?.filter(t => t.status === 'pending_payment') || [];
  const winnerTickets = tickets?.filter(t => t.status === 'winner') || [];

  // Filter tickets
  const filteredTickets = tickets?.filter(ticket => {
    // Type filter
    if (typeFilter === 'street' && !isStreetSale(ticket)) return false;
    if (typeFilter === 'online' && isStreetSale(ticket)) return false;

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const ref = getRef(ticket).toLowerCase();
      const name = ticket.player?.name?.toLowerCase() || '';
      const seller = getSellerEmail(ticket)?.toLowerCase() || '';
      return ref.includes(search) || name.includes(search) || seller.includes(search);
    }

    return true;
  }) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          Cartelas Vendidas
        </CardTitle>
        <CardDescription>
          {activeTickets.length} ativas, {pendingTickets.length} aguardando, {winnerTickets.length} ganhadoras
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, Ref ou vendedor..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="street">Rua</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!tickets || tickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma cartela vendida ainda.
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma cartela encontrada para o filtro aplicado.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Jogador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Números</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Rodada</TableHead>
                <TableHead>Compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TicketRow({ ticket }: { ticket: TicketWithDetails }) {
  const config = statusConfig[ticket.status || 'pending_payment'];
  const numbers = ticket.ticket_numbers?.map(n => n.number).sort((a, b) => a - b) || [];
  const street = isStreetSale(ticket);
  const seller = getSellerEmail(ticket);

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {getRef(ticket)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{ticket.player?.name || 'Desconhecido'}</div>
            <div className="text-xs text-muted-foreground">
              {street
                ? 'Venda de rua'
                : `${getDisplayCpf(ticket.player || {}) || `***${ticket.player?.cpf_last4}`} • ${ticket.player?.city || 'N/A'}`
              }
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={street ? 'secondary' : 'outline'} className="text-xs">
          {street ? 'Rua' : 'Online'}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1 max-w-xs">
          {numbers.slice(0, 8).map((num) => (
            <Badge key={num} variant="outline" className="text-xs font-mono">
              {num.toString().padStart(2, '0')}
            </Badge>
          ))}
          {numbers.length > 8 && (
            <Badge variant="secondary" className="text-xs">
              +{numbers.length - 8}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={config.variant}>{config.label}</Badge>
      </TableCell>
      <TableCell>
        {street && seller ? (
          <span className="text-xs text-muted-foreground">{seller}</span>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        {(() => {
          const dc = getDrawCountAtPurchase(ticket);
          return dc != null ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {dc}ª
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        })()}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {ticket.purchased_at
            ? formatDistanceToNow(new Date(ticket.purchased_at), { addSuffix: true, locale: ptBR })
            : 'Pendente'
          }
        </div>
      </TableCell>
    </TableRow>
  );
}
