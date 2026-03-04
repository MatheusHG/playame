import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Eye,
  Edit,
  MoreVertical,
  Play,
  Pause,
  StopCircle,
  Trash2,
  Trophy,
  DollarSign,
  Hash,
  Calendar,
  Dices,
  ImageIcon,
  ArrowRight,
} from 'lucide-react';
import { formatDistanceToNow, formatDistanceStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RaffleWithTiers } from '@/hooks/useRaffles';
import type { RaffleStatus } from '@/types/database.types';

interface RaffleCardProps {
  raffle: RaffleWithTiers;
  primaryColor?: string;
  onChangeStatus: (id: string, status: RaffleStatus) => void;
  onDelete: (id: string) => void;
}

const statusConfig: Record<
  RaffleStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; bg: string; color: string }
> = {
  draft: { label: 'Rascunho', variant: 'secondary', bg: '#F3F4F6', color: '#6B7280' },
  active: { label: 'Ativo', variant: 'default', bg: '#DCFCE7', color: '#16A34A' },
  paused: { label: 'Pausado', variant: 'outline', bg: '#FEF9C3', color: '#CA8A04' },
  finished: { label: 'Finalizado', variant: 'destructive', bg: '#FEE2E2', color: '#DC2626' },
};

export function RaffleCard({ raffle, primaryColor, onChangeStatus, onDelete }: RaffleCardProps) {
  const status = raffle.status || 'draft';
  const config = statusConfig[status];

  const prizeTiersCount = raffle.prize_tiers?.length || 0;
  const prizeDisplay = calculatePrizeDisplay(raffle);
  const numbersRange = raffle.number_range_end - raffle.number_range_start + 1;

  return (
    <div className="rounded-2xl border bg-card hover:shadow-lg transition-all overflow-hidden">
      {/* Image header */}
      {raffle.image_url ? (
        <Link to={`/admin/sorteios/${raffle.id}`}>
          <div className="relative h-36 overflow-hidden">
            <img
              src={raffle.image_url}
              alt={raffle.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <Badge variant={config.variant} className="absolute top-3 left-3">
              {config.label}
            </Badge>
            <div className="absolute bottom-3 left-3 right-3">
              <h3 className="text-white font-semibold text-lg leading-tight truncate">
                {raffle.name}
              </h3>
            </div>
          </div>
        </Link>
      ) : (
        <div className="px-5 pt-5 pb-2">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/admin/sorteios/${raffle.id}`}
              className="flex-1 min-w-0"
            >
              <div className="flex items-center gap-3 mb-1">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0"
                  style={{ backgroundColor: config.bg }}
                >
                  <Dices className="h-4 w-4" style={{ color: config.color }} />
                </div>
                <h3 className="font-semibold text-lg truncate hover:text-primary transition-colors">
                  {raffle.name}
                </h3>
              </div>
            </Link>
            <Badge variant={config.variant} className="shrink-0 mt-1">
              {config.label}
            </Badge>
          </div>
          {raffle.description && (
            <p className="text-sm text-muted-foreground line-clamp-1 mt-1 pl-[52px]">
              {raffle.description}
            </p>
          )}
        </div>
      )}

      <div className={raffle.image_url ? 'p-5 pt-3' : 'px-5 pb-5 pt-1'}>
        {/* Stats grid */}
        <TooltipProvider delayDuration={200}>
          <div className="grid grid-cols-2 gap-3">
            <StatMini
              icon={<DollarSign className="h-3.5 w-3.5" />}
              iconBg="#DCFCE7"
              iconColor="#16A34A"
              label="Cartela"
              value={`R$ ${Number(raffle.ticket_price).toFixed(2)}`}
            />
            <StatMini
              icon={<Hash className="h-3.5 w-3.5" />}
              iconBg="#DBEAFE"
              iconColor="#2563EB"
              label="Números"
              value={`${raffle.number_range_start}–${raffle.number_range_end}`}
              tooltip={`${numbersRange} números, ${raffle.numbers_per_ticket} por cartela`}
            />
            <StatMini
              icon={<Trophy className="h-3.5 w-3.5" />}
              iconBg="#FEF3C7"
              iconColor="#D97706"
              label="Prêmio"
              value={prizeDisplay}
            />
            <StatMini
              icon={<Dices className="h-3.5 w-3.5" />}
              iconBg="#EDE9FE"
              iconColor="#7C3AED"
              label="Rodadas"
              value={`${raffle.current_draw_count || 0}`}
              tooltip={`${prizeTiersCount} faixas de prêmio`}
            />
          </div>
        </TooltipProvider>

        <Separator className="my-3" />

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between gap-2">
          <ScheduleInfo raffle={raffle} />

          <div className="flex items-center gap-1 shrink-0">
            {/* Quick status action */}
            {status === 'draft' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg"
                onClick={() => onChangeStatus(raffle.id, 'active')}
              >
                <Play className="h-3 w-3 mr-1" />
                Ativar
              </Button>
            )}
            {status === 'active' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs rounded-lg"
                onClick={() => onChangeStatus(raffle.id, 'paused')}
              >
                <Pause className="h-3 w-3 mr-1" />
                Pausar
              </Button>
            )}
            {status === 'paused' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg"
                onClick={() => onChangeStatus(raffle.id, 'active')}
              >
                <Play className="h-3 w-3 mr-1" />
                Reativar
              </Button>
            )}

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem asChild>
                  <Link to={`/admin/sorteios/${raffle.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Visualizar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/admin/sorteios/${raffle.id}/editar`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Link>
                </DropdownMenuItem>

                {status === 'paused' && (
                  <>
                    <DropdownMenuSeparator />
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
        </div>

        {/* CTA for active raffles */}
        {status === 'active' && (
          <Button asChild size="sm" className="w-full mt-3 rounded-xl">
            <Link to={`/admin/sorteios/${raffle.id}`}>
              Gerenciar
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── Stat mini-component with colored circle icon ── */

function StatMini({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  tooltip,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  tooltip?: string;
}) {
  const content = (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none">{label}</p>
        <p className="text-sm font-semibold truncate mt-0.5">{value}</p>
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-default">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

/* ── Schedule / countdown info ─────────────────────────────── */

function ScheduleInfo({ raffle }: { raffle: RaffleWithTiers }) {
  const scheduled = raffle.scheduled_at;
  const isDraft = raffle.status === 'draft';

  if (scheduled && isDraft) {
    const target = new Date(scheduled);
    const now = new Date();
    const isFuture = target > now;

    if (isFuture) {
      const distance = formatDistanceStrict(target, now, { locale: ptBR });
      return (
        <div className="text-xs flex items-center gap-1.5 min-w-0 text-blue-600">
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="truncate font-medium">Ativa em {distance}</span>
        </div>
      );
    }

    return (
      <div className="text-xs flex items-center gap-1.5 min-w-0 text-amber-600">
        <Calendar className="h-3 w-3 shrink-0" />
        <span className="truncate">Agendamento expirado</span>
      </div>
    );
  }

  if (scheduled) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
        <Calendar className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {new Date(scheduled).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>
    );
  }

  return (
    <div className="text-xs text-muted-foreground flex items-center gap-1.5 min-w-0">
      <Calendar className="h-3 w-3 shrink-0" />
      <span className="truncate">
        {formatDistanceToNow(new Date(raffle.created_at), {
          addSuffix: true,
          locale: ptBR,
        })}
      </span>
    </div>
  );
}

/* ── Prize display helper ──────────────────────────────────── */

function calculatePrizeDisplay(raffle: RaffleWithTiers): string {
  const mode = raffle.prize_mode || 'PERCENT_ONLY';
  const fixedValue = Number(raffle.fixed_prize_value) || 0;
  const profitPct = Number(raffle.company_profit_percent) || 0;
  const prizePct = Math.max(0, 100 - profitPct);

  switch (mode) {
    case 'FIXED':
      return `R$ ${fixedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    case 'PERCENT_ONLY':
      return `${prizePct.toFixed(0)}% do líq.`;
    case 'FIXED_PLUS_PERCENT':
      return `R$ ${fixedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} +${prizePct.toFixed(0)}%`;
    default:
      return '-';
  }
}
