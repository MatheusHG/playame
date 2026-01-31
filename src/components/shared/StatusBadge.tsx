import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  CompanyStatus, 
  PlayerStatus, 
  RaffleStatus, 
  TicketStatus, 
  PaymentStatus 
} from '@/types/database.types';

type Status = CompanyStatus | PlayerStatus | RaffleStatus | TicketStatus | PaymentStatus;

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  // Company status
  active: { label: 'Ativo', variant: 'default' },
  suspended: { label: 'Suspenso', variant: 'destructive' },
  deleted: { label: 'Excluído', variant: 'outline' },
  
  // Player status
  blocked: { label: 'Bloqueado', variant: 'destructive' },
  
  // Raffle status
  draft: { label: 'Rascunho', variant: 'secondary' },
  paused: { label: 'Pausado', variant: 'outline' },
  finished: { label: 'Finalizado', variant: 'secondary' },
  
  // Ticket status
  pending_payment: { label: 'Aguardando Pagamento', variant: 'outline' },
  winner: { label: 'Vencedor', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  
  // Payment status
  pending: { label: 'Pendente', variant: 'outline' },
  processing: { label: 'Processando', variant: 'secondary' },
  succeeded: { label: 'Aprovado', variant: 'default' },
  failed: { label: 'Falhou', variant: 'destructive' },
  refunded: { label: 'Reembolsado', variant: 'outline' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'outline' as const };
  
  return (
    <Badge variant={config.variant} className={cn(className)}>
      {config.label}
    </Badge>
  );
}
