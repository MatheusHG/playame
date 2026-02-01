import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRaffleTickets, TicketWithDetails } from '@/hooks/useTickets';
import { LoadingState } from '@/components/shared/LoadingState';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ticket, User, Calendar, Hash } from 'lucide-react';

interface TicketsListProps {
  raffleId: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending_payment: { label: 'Aguardando Pagamento', variant: 'outline' },
  active: { label: 'Ativa', variant: 'default' },
  winner: { label: 'Ganhadora', variant: 'default' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
};

export function TicketsList({ raffleId }: TicketsListProps) {
  const { data: tickets, isLoading, error } = useRaffleTickets(raffleId);

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
      <CardContent>
        {!tickets || tickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma cartela vendida ainda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jogador</TableHead>
                <TableHead>Números</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TicketRow key={ticket.id} ticket={ticket} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function TicketRow({ ticket }: { ticket: TicketWithDetails }) {
  const config = statusConfig[ticket.status || 'pending_payment'];
  const numbers = ticket.ticket_numbers?.map(n => n.number).sort((a, b) => a - b) || [];

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{ticket.players?.name || 'Desconhecido'}</div>
            <div className="text-xs text-muted-foreground">
              ***{ticket.players?.cpf_last4} • {ticket.players?.city || 'N/A'}
            </div>
          </div>
        </div>
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
