import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Eye, Edit, MoreVertical, Play, Pause, StopCircle, Trash2, Trophy, Users, DollarSign } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RaffleWithTiers } from '@/hooks/useRaffles';
import type { Database } from '@/integrations/supabase/types';

type RaffleStatus = Database['public']['Enums']['raffle_status'];

interface RaffleCardProps {
  raffle: RaffleWithTiers;
  slug: string;
  ticketCount?: number;
  onChangeStatus: (id: string, status: RaffleStatus) => void;
  onDelete: (id: string) => void;
}

const statusConfig: Record<RaffleStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  active: { label: 'Ativo', variant: 'default' },
  paused: { label: 'Pausado', variant: 'outline' },
  finished: { label: 'Finalizado', variant: 'destructive' },
};

export function RaffleCard({ raffle, slug, ticketCount = 0, onChangeStatus, onDelete }: RaffleCardProps) {
  const status = raffle.status || 'draft';
  const config = statusConfig[status];

  const prizeTiersCount = raffle.prize_tiers?.length || 0;
  const prizeTotal = calculatePrizeDisplay(raffle);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{raffle.name}</CardTitle>
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>
            {raffle.description && (
              <CardDescription className="line-clamp-2">{raffle.description}</CardDescription>
            )}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/empresa/${slug}/sorteios/${raffle.id}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/empresa/${slug}/sorteios/${raffle.id}/editar`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {status === 'draft' && (
                <DropdownMenuItem onClick={() => onChangeStatus(raffle.id, 'active')}>
                  <Play className="mr-2 h-4 w-4" />
                  Ativar
                </DropdownMenuItem>
              )}
              {status === 'active' && (
                <DropdownMenuItem onClick={() => onChangeStatus(raffle.id, 'paused')}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pausar
                </DropdownMenuItem>
              )}
              {status === 'paused' && (
                <>
                  <DropdownMenuItem onClick={() => onChangeStatus(raffle.id, 'active')}>
                    <Play className="mr-2 h-4 w-4" />
                    Reativar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangeStatus(raffle.id, 'finished')}>
                    <StopCircle className="mr-2 h-4 w-4" />
                    Finalizar
                  </DropdownMenuItem>
                </>
              )}
              {(status === 'draft' || status === 'paused') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive" 
                    onClick={() => onDelete(raffle.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>R$ {Number(raffle.ticket_price).toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{ticketCount} cartelas</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="h-4 w-4" />
            <span>{prizeTiersCount} faixas</span>
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {raffle.scheduled_at ? (
              <span>Programado para {new Date(raffle.scheduled_at).toLocaleDateString('pt-BR')}</span>
            ) : (
              <span>Criado {formatDistanceToNow(new Date(raffle.created_at), { addSuffix: true, locale: ptBR })}</span>
            )}
          </div>
          
          <div className="text-sm font-medium text-primary">
            {prizeTotal}
          </div>
        </div>

        {status === 'active' && (
          <div className="mt-4">
            <Button asChild className="w-full">
              <Link to={`/empresa/${slug}/sorteios/${raffle.id}`}>
                Gerenciar Sorteio
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function calculatePrizeDisplay(raffle: RaffleWithTiers): string {
  const mode = raffle.prize_mode || 'PERCENT_ONLY';
  const fixedValue = Number(raffle.fixed_prize_value) || 0;
  const percent = Number(raffle.prize_percent_of_sales) || 0;

  switch (mode) {
    case 'FIXED':
      return `R$ ${fixedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    case 'PERCENT_ONLY':
      return `${percent}% das vendas`;
    case 'FIXED_PLUS_PERCENT':
      return `R$ ${fixedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} + ${percent}%`;
    default:
      return '-';
  }
}
