import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PrizeTiersEditor } from '@/components/empresa/PrizeTiersEditor';
import { DrawBatchManager } from '@/components/empresa/DrawBatchManager';
import { TicketsList } from '@/components/empresa/TicketsList';
import { RankingTable } from '@/components/empresa/RankingTable';
import { SettlementDialog } from '@/components/empresa/SettlementDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Edit, DollarSign, Hash, Trophy,
  Play, Pause, Eye, Clock, Dices, Ticket, BarChart3, Award, Info,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRaffle, useRaffleMutations, usePrizeTierMutations } from '@/hooks/useRaffles';
import { differenceInSeconds, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import type { RaffleStatus } from '@/types/database.types';
import type { LucideIcon } from 'lucide-react';

interface NetSalesBreakdown {
  total: number;
  gross: number;
  admin_fee: number;
  net: number;
  super_admin_fee: number;
  affiliate_commissions: number;
  manager_commissions: number;
  cambista_commissions: number;
  company_retention: number;
  prize_pool_contribution: number;
  ticket_count: number;
}

function useCountdown(targetDate: string | null | undefined) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!targetDate) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) return null;

  const target = new Date(targetDate);
  if (target <= now) return null;

  const days = differenceInDays(target, now);
  const hours = differenceInHours(target, now) % 24;
  const minutes = differenceInMinutes(target, now) % 60;
  const seconds = differenceInSeconds(target, now) % 60;

  return { days, hours, minutes, seconds };
}

const statusConfig: Record<RaffleStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; bg: string; color: string }> = {
  draft: { label: 'Rascunho', variant: 'secondary', bg: '#F3F4F6', color: '#6B7280' },
  active: { label: 'Ativo', variant: 'default', bg: '#DCFCE7', color: '#16A34A' },
  paused: { label: 'Pausado', variant: 'outline', bg: '#FEF9C3', color: '#CA8A04' },
  finished: { label: 'Finalizado', variant: 'destructive', bg: '#FEE2E2', color: '#DC2626' },
};

/* ── Stat Item ── */
interface StatItemProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string | number;
  subtitle?: string;
  action?: React.ReactNode;
  tooltip?: string;
}

function StatItem({ icon: Icon, iconBg, iconColor, label, value, subtitle, action, tooltip }: StatItemProps) {
  return (
    <div className="rounded-2xl border bg-card p-3 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow">
      <div
        className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full flex-shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            {tooltip && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {action}
        </div>
        <p className="text-lg sm:text-2xl font-bold tracking-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function VisualizarSorteio() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const navigate = useNavigate();
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();
  const { data: raffle, isLoading } = useRaffle(id);
  const { changeStatus } = useRaffleMutations(company?.id);
  const { savePrizeTiers } = usePrizeTierMutations(id);

  const [showFinancialBreakdown, setShowFinancialBreakdown] = useState(false);
  const [statusChange, setStatusChange] = useState<{ id: string; status: RaffleStatus } | null>(null);

  const { data: netSalesData } = useQuery({
    queryKey: ['raffle-net-sales', id],
    enabled: !!id,
    queryFn: async () => {
      return api.get<NetSalesBreakdown>(`/payments/net-sales/${id}`);
    },
  });

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  const handleStatusChange = () => {
    if (statusChange) {
      changeStatus.mutate(statusChange);
      setStatusChange(null);
    }
  };

  const statusChangeLabels: Record<string, { title: string; description: string; confirm: string }> = {
    active: {
      title: 'Ativar Sorteio',
      description: 'Tem certeza que deseja ativar este sorteio? Ele ficará visível e disponível para compra de cartelas.',
      confirm: 'Ativar',
    },
    paused: {
      title: 'Pausar Sorteio',
      description: 'Tem certeza que deseja pausar este sorteio? Ele não ficará disponível para novas compras enquanto estiver pausado.',
      confirm: 'Pausar',
    },
    finished: {
      title: 'Finalizar Sorteio',
      description: 'Tem certeza que deseja finalizar este sorteio? Esta ação não pode ser desfeita.',
      confirm: 'Finalizar',
    },
  };

  if (tenantLoading || isLoading) {
    return <LoadingState fullScreen message="Carregando sorteio..." />;
  }

  if (!raffle) {
    return (
      <EmpresaLayout title="Sorteio não encontrado">
        <div className="text-center py-16 rounded-2xl border bg-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-4" style={{ backgroundColor: '#F3F4F6' }}>
            <Dices className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground mb-4">O sorteio solicitado não foi encontrado.</p>
          <Button onClick={() => navigate(`/empresa/${slug}/sorteios`)} className="rounded-xl">Voltar</Button>
        </div>
      </EmpresaLayout>
    );
  }

  const status = raffle.status || 'draft';
  const config = statusConfig[status];
  const isActive = status === 'active';
  const isPaused = status === 'paused';
  const isDraft = status === 'draft';
  const isFinished = status === 'finished';

  // Prize pool calculation
  const prizePoolContrib = netSalesData?.total || 0;
  const fixedVal = Number(raffle.fixed_prize_value) || 0;
  const mode = raffle.prize_mode || 'PERCENT_ONLY';
  const totalPrize =
    mode === 'FIXED' ? fixedVal
    : mode === 'PERCENT_ONLY' ? prizePoolContrib
    : fixedVal + prizePoolContrib;
  const profitPct = Number(raffle.company_profit_percent) || 0;

  return (
    <EmpresaLayout
      title={raffle.name}
      description={raffle.description || 'Detalhes do sorteio'}
    >
      {/* Header */}
      <div className="rounded-2xl border bg-card p-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(`/empresa/${slug}/sorteios`)} className="rounded-xl">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0"
                style={{ backgroundColor: config.bg }}
              >
                <Dices className="h-4 w-4" style={{ color: config.color }} />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{raffle.name}</h2>
                <Badge variant={config.variant} className="mt-0.5">
                  {config.label}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            {isDraft && (
              <Button onClick={() => setStatusChange({ id: raffle.id, status: 'active' })} className="rounded-xl">
                <Play className="mr-2 h-4 w-4" />
                Ativar
              </Button>
            )}
            {isActive && (
              <Button variant="outline" onClick={() => setStatusChange({ id: raffle.id, status: 'paused' })} className="rounded-xl">
                <Pause className="mr-2 h-4 w-4" />
                Pausar
              </Button>
            )}
            {isPaused && (
              <>
                <Button onClick={() => setStatusChange({ id: raffle.id, status: 'active' })} className="rounded-xl">
                  <Play className="mr-2 h-4 w-4" />
                  Reativar
                </Button>
                <SettlementDialog
                  raffleId={raffle.id}
                  raffleName={raffle.name}
                  isFinished={isFinished}
                />
              </>
            )}
            <Button variant="outline" asChild className="rounded-xl">
              <Link to={`/empresa/${slug}/sorteios/${raffle.id}/editar`}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Countdown for scheduled raffles */}
      {raffle.scheduled_at && isDraft && (() => {
        const target = new Date(raffle.scheduled_at);
        const now = new Date();
        const isPast = target <= now;
        return (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20 p-5 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                <Clock className="h-5 w-5" style={{ color: '#2563EB' }} />
              </div>
              <div>
                {isPast ? (
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                    Agendamento expirado — ative o sorteio manualmente.
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agendado para ativação</p>
                    <CountdownDisplay targetDate={raffle.scheduled_at} />
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 mb-6">
        <StatItem
          icon={DollarSign}
          iconBg="#DCFCE7"
          iconColor="#16A34A"
          label="Preço da Cartela"
          value={`R$ ${Number(raffle.ticket_price).toFixed(2)}`}
        />
        <StatItem
          icon={Hash}
          iconBg="#EDE9FE"
          iconColor="#7C3AED"
          label="Range de Números"
          value={`${raffle.number_range_start} - ${raffle.number_range_end}`}
          subtitle={`${raffle.numbers_per_ticket} por cartela`}
        />
        <StatItem
          icon={Dices}
          iconBg="#DBEAFE"
          iconColor="#2563EB"
          label="Rodadas"
          value={raffle.current_draw_count || 0}
          subtitle="números sorteados"
        />
        <StatItem
          icon={Trophy}
          iconBg="#FEF3C7"
          iconColor="#D97706"
          label="Prêmio Acumulado"
          value={`R$ ${totalPrize.toFixed(2)}`}
          subtitle={mode === 'FIXED' ? 'Valor fixo' : `${profitPct.toFixed(0)}% retenção`}
          action={
            <button
              type="button"
              onClick={() => setShowFinancialBreakdown(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Ver detalhes financeiros"
            >
              <Eye className="h-4 w-4" />
            </button>
          }
        />
        <StatItem
          icon={BarChart3}
          iconBg="#FCE7F3"
          iconColor="#DB2777"
          label="Faturamento"
          value={`R$ ${(netSalesData?.gross || 0).toFixed(2)}`}
          subtitle={`${netSalesData?.ticket_count || 0} cartelas vendidas`}
        />
        <StatItem
          icon={Ticket}
          iconBg="#FEF3C7"
          iconColor="#CA8A04"
          label="Ticket Médio"
          value={`R$ ${(netSalesData?.ticket_count ? (netSalesData.gross / netSalesData.ticket_count) : 0).toFixed(2)}`}
          subtitle="por cartela vendida"
          tooltip="Calculado com base no valor bruto, sem descontos e taxas."
        />
      </div>

      {/* Financial Breakdown Dialog */}
      <Dialog open={showFinancialBreakdown} onOpenChange={setShowFinancialBreakdown}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#DCFCE7' }}>
                <DollarSign className="h-4 w-4" style={{ color: '#16A34A' }} />
              </div>
              <DialogTitle>Detalhes Financeiros</DialogTitle>
            </div>
          </DialogHeader>
          {netSalesData && (
            <div className="space-y-3 mt-2">
              <FinancialRow label="Faturamento Bruto" value={netSalesData.gross} highlight />
              <Separator />
              <FinancialRow label="Taxa Administrativa (Admin)" value={netSalesData.admin_fee} negative />
              <Separator />
              <FinancialRow label="Comissões de Afiliados" value={netSalesData.affiliate_commissions} negative />
              <div className="pl-4 space-y-1.5">
                <FinancialRow label="Gerentes" value={netSalesData.manager_commissions} sub negative />
                <FinancialRow label="Cambistas" value={netSalesData.cambista_commissions} sub negative />
              </div>
              <Separator />
              <FinancialRow label="Retenção da Empresa" value={netSalesData.company_retention} negative />
              <Separator />
              <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-3">
                <FinancialRow label="Contribuição ao Prêmio" value={netSalesData.prize_pool_contribution} highlight green />
              </div>
              <div className="flex justify-between text-sm text-muted-foreground px-1">
                <span>Total de cartelas</span>
                <span className="font-semibold text-foreground">{netSalesData.ticket_count}</span>
              </div>
            </div>
          )}
          {!netSalesData && (
            <div className="text-center py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full mx-auto mb-3" style={{ backgroundColor: '#F3F4F6' }}>
                <DollarSign className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhuma venda registrada.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <Tabs defaultValue="rodadas" className="w-full">
          <div className="border-b bg-muted/30 px-5 pt-4">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              <TabsTrigger
                value="rodadas"
                className="rounded-t-xl rounded-b-none border border-b-0 data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2.5 text-sm"
              >
                <Dices className="mr-2 h-4 w-4" />
                Rodadas
              </TabsTrigger>
              <TabsTrigger
                value="faixas"
                className="rounded-t-xl rounded-b-none border border-b-0 data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2.5 text-sm"
              >
                <Award className="mr-2 h-4 w-4" />
                Faixas de Prêmio
              </TabsTrigger>
              <TabsTrigger
                value="cartelas"
                className="rounded-t-xl rounded-b-none border border-b-0 data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2.5 text-sm"
              >
                <Ticket className="mr-2 h-4 w-4" />
                Cartelas
              </TabsTrigger>
              <TabsTrigger
                value="ranking"
                className="rounded-t-xl rounded-b-none border border-b-0 data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2.5 text-sm"
              >
                <Trophy className="mr-2 h-4 w-4" />
                Ranking
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-5">
            <TabsContent value="rodadas" className="mt-0">
              <DrawBatchManager
                raffleId={raffle.id}
                numberRangeStart={raffle.number_range_start}
                numberRangeEnd={raffle.number_range_end}
                isRaffleActive={isActive}
              />
            </TabsContent>

            <TabsContent value="faixas" className="mt-0">
              <PrizeTiersEditor
                tiers={raffle.prize_tiers || []}
                onSave={(tiers) => savePrizeTiers.mutate(tiers)}
                isLoading={savePrizeTiers.isPending}
                maxHits={raffle.numbers_per_ticket}
                currentDrawCount={raffle.current_draw_count || 0}
              />
            </TabsContent>

            <TabsContent value="cartelas" className="mt-0">
              <TicketsList raffleId={raffle.id} />
            </TabsContent>

            <TabsContent value="ranking" className="mt-0">
              <RankingTable raffleId={raffle.id} numbersPerTicket={raffle.numbers_per_ticket} prizeTiers={raffle.prize_tiers || []} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Status Change Confirmation */}
      <ConfirmDialog
        open={!!statusChange}
        onOpenChange={() => setStatusChange(null)}
        title={statusChange ? statusChangeLabels[statusChange.status]?.title ?? 'Alterar Status' : ''}
        description={statusChange ? statusChangeLabels[statusChange.status]?.description ?? '' : ''}
        confirmLabel={statusChange ? statusChangeLabels[statusChange.status]?.confirm ?? 'Confirmar' : 'Confirmar'}
        onConfirm={handleStatusChange}
        loading={changeStatus.isPending}
      />
    </EmpresaLayout>
  );
}

/* ── Countdown Display ─────────────────────────────────────── */

function CountdownDisplay({ targetDate }: { targetDate: string }) {
  const countdown = useCountdown(targetDate);

  if (!countdown) return null;

  const { days, hours, minutes, seconds } = countdown;

  return (
    <div className="flex gap-2 mt-1">
      {days > 0 && <CountdownUnit value={days} label="dias" />}
      <CountdownUnit value={hours} label="hrs" />
      <CountdownUnit value={minutes} label="min" />
      <CountdownUnit value={seconds} label="seg" />
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xl font-bold font-mono text-blue-700 dark:text-blue-400 tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10px] text-blue-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

/* ── Financial Row ─────────────────────────────────────────── */

function FinancialRow({
  label,
  value,
  highlight,
  green,
  negative,
  sub,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  green?: boolean;
  negative?: boolean;
  sub?: boolean;
}) {
  const formatted = `R$ ${value.toFixed(2)}`;
  return (
    <div className={`flex justify-between items-center ${sub ? 'text-xs' : 'text-sm'}`}>
      <span className={sub ? 'text-muted-foreground' : ''}>{label}</span>
      <span
        className={`font-medium tabular-nums ${
          highlight && green ? 'text-green-600 font-bold' :
          highlight ? 'font-bold' :
          negative && value > 0 ? 'text-red-500' : ''
        }`}
      >
        {negative && value > 0 ? `- ${formatted}` : formatted}
      </span>
    </div>
  );
}
