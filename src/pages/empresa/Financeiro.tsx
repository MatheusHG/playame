import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable, Column } from '@/components/shared/DataTable';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { ManualPaymentApproval } from '@/components/empresa/ManualPaymentApproval';
import { DollarSign, TrendingUp, Receipt, ArrowUpCircle, CircleDollarSign, User, Eye, MoreVertical, CheckCircle, XCircle, Users, FileText, Trophy, ShoppingCart, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Payment, FinancialLog as FinancialLogBase } from '@/types/database.types';
import type { AffiliateCommission } from '@/types/affiliate.types';
import { getDisplayCpf } from '@/lib/utils';

type PaymentWithPlayer = Payment & {
  player: { id: string; name: string; cpf_last4: string } | null;
};
type AffiliateCommissionRow = AffiliateCommission & {
  manager?: { id: string; name: string } | null;
  cambista?: { id: string; name: string } | null;
};
type FinancialLog = FinancialLogBase & {
  user_email?: string;
};

const formatBrl = (v: number) => `R$ ${Number(v).toFixed(2)}`;

/* ── Stat Item ── */
interface StatItemProps { icon: LucideIcon; iconBg: string; iconColor: string; label: string; value: string | number; subtitle?: string; tooltip?: string; }
function StatItem({ icon: Icon, iconBg, iconColor, label, value, subtitle, tooltip }: StatItemProps) {
  return (
    <div className="rounded-2xl border bg-card p-3 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow">
      <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: iconBg }}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
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
        <p className="text-lg sm:text-2xl font-bold tracking-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function EmpresaFinanceiro() {
  const { company, loading } = useTenant();

  // Date filters
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  // Controles para abrir diálogos de aprovar/rejeitar por payment id (uso no dropdown de ações)
  const [paymentControls, setPaymentControls] = useState<Record<string, { openApprove: () => void; openReject: () => void }>>({});
  // Modal do descritivo (invoice) do pagamento
  const [invoiceModalPayment, setInvoiceModalPayment] = useState<PaymentWithPlayer | null>(null);

  // Fetch payments with date filter and player info
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['company-payments', company?.id, startDate, endDate],
    enabled: !!company?.id,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.from = startOfDay(startDate).toISOString();
      if (endDate) params.to = endOfDay(endDate).toISOString();

      const data = await api.get<PaymentWithPlayer[]>(`/payments/company/${company!.id}`, params);
      return data;
    },
  });

  // Fetch affiliate commissions (mesmo período dos pagamentos) para exibir descontos e descritivo
  const { data: affiliateCommissions = [] } = useQuery({
    queryKey: ['company-affiliate-commissions', company?.id, startDate, endDate],
    enabled: !!company?.id,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.from = startOfDay(startDate).toISOString();
      if (endDate) params.to = endOfDay(endDate).toISOString();

      const data = await api.get<AffiliateCommissionRow[]>(`/commissions/company/${company!.id}`, params);
      return data;
    },
  });

  const commissionsByPaymentId = useMemo(() => {
    const map = new Map<string, AffiliateCommissionRow>();
    affiliateCommissions.forEach((c) => map.set(c.payment_id, c));
    return map;
  }, [affiliateCommissions]);

  // Fetch financial logs with date filter and user info
  const { data: financialLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['company-financial-logs', company?.id, startDate, endDate],
    enabled: !!company?.id,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.from = startOfDay(startDate).toISOString();
      if (endDate) params.to = endOfDay(endDate).toISOString();

      const data = await api.get<FinancialLog[]>(`/financial-logs/company/${company!.id}`, params);
      return data;
    },
  });

  if (loading) {
    return <LoadingState fullScreen message="Carregando empresa..." />;
  }

  // Calculate stats (filtered data)
  const succeededPayments = payments.filter((p) => p.status === 'succeeded');
  const totalSales = succeededPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalFees = succeededPayments.reduce((sum, p) => sum + Number(p.admin_fee || 0), 0);
  const netRevenue = succeededPayments.reduce((sum, p) => sum + Number(p.net_amount), 0);
  const totalRetention = succeededPayments.reduce((sum, p) => sum + Number((p as any).company_retention || 0), 0);
  const totalPrizePool = succeededPayments.reduce((sum, p) => sum + Number((p as any).prize_pool_contribution || 0), 0);

  const handleClearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const paymentColumns: Column<PaymentWithPlayer>[] = [
    {
      key: 'ref',
      header: 'Ref',
      render: (p) => (
        <span className="font-mono text-xs text-muted-foreground">{p.id.slice(0, 8).toUpperCase()}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Data',
      render: (p) => (
        <div>
          <p className="font-medium">{format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'HH:mm')}</p>
        </div>
      ),
    },
    {
      key: 'player_name',
      header: 'Jogador',
      render: (p) => (
        <span className="font-medium">{(p as PaymentWithPlayer).player?.name ?? '—'}</span>
      ),
    },
    {
      key: 'player_cpf',
      header: 'CPF',
        render: (p) => {
          const player = (p as PaymentWithPlayer).player;
          if (!player) return '—';
          const cpf = getDisplayCpf({ cpf_encrypted: null, cpf_last4: player.cpf_last4 });
          return <span className="font-mono text-sm">{cpf || '—'}</span>;
        },
    },
    {
      key: 'amount',
      header: 'Valor Bruto',
      render: (p) => <span className="font-mono">R$ {Number(p.amount).toFixed(2)}</span>,
    },
    {
      key: 'admin_fee',
      header: 'Taxa Admin',
      render: (p) => <span className="font-mono text-muted-foreground">R$ {Number(p.admin_fee || 0).toFixed(2)}</span>,
    },
    {
      key: 'net_amount',
      header: 'Valor Líquido',
      render: (p) => <span className="font-mono font-medium text-primary">R$ {Number(p.net_amount).toFixed(2)}</span>,
    },
    {
      key: 'affiliate_discounts',
      header: 'Afiliados',
      render: (p) => {
        const comm = commissionsByPaymentId.get(p.id);
        const mgr = Number(comm?.manager_gross_amount || 0);
        const cam = Number(comm?.cambista_amount || 0);
        if (!comm || (mgr === 0 && cam === 0)) {
          return <span className="text-muted-foreground">—</span>;
        }
        const total = mgr + cam;
        const tooltipParts: string[] = [];
        if (mgr > 0) tooltipParts.push(`Gerente: ${formatBrl(mgr)}${comm.manager?.name ? ` (${comm.manager.name})` : ''}`);
        if (cam > 0) tooltipParts.push(`Cambista: ${formatBrl(cam)}${comm.cambista?.name ? ` (${comm.cambista.name})` : ''}`);
        return (
          <div className="flex items-center gap-1 text-muted-foreground" title={tooltipParts.join('\n')}>
            <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-mono text-xs">{formatBrl(total)}</span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <Badge
          variant={
            p.status === 'succeeded'
              ? 'default'
              : p.status === 'pending' || p.status === 'processing'
              ? 'secondary'
              : 'destructive'
          }
        >
          {p.status === 'succeeded'
            ? 'Pago'
            : p.status === 'pending'
            ? 'Pendente'
            : p.status === 'processing'
            ? 'Processando'
            : p.status === 'failed'
            ? 'Falhou'
            : 'Reembolsado'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (p) => {
        const isPending = p.status === 'pending' || p.status === 'processing';
        return (
          <>
            {isPending && (
              <ManualPaymentApproval
                payment={{
                  id: p.id,
                  ticket_id: p.ticket_id,
                  status: p.status,
                  amount: Number(p.amount),
                }}
                hideButtons
                onRegisterControls={(openApprove, openReject) =>
                  setPaymentControls((prev) => ({ ...prev, [p.id]: { openApprove, openReject } }))
                }
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {p.player_id && (
                  <DropdownMenuItem asChild>
                    <Link to={`/admin/jogadores/${p.player_id}`} className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Ver perfil
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setInvoiceModalPayment(p)} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Ver descritivo
                </DropdownMenuItem>
                {isPending && (
                  <>
                    {p.player_id && <DropdownMenuSeparator />}
                    <DropdownMenuItem onClick={() => paymentControls[p.id]?.openApprove()} className="gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Aprovar pagamento
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => paymentControls[p.id]?.openReject()}
                      className="gap-2 text-destructive focus:text-destructive"
                    >
                      <XCircle className="h-4 w-4" />
                      Rejeitar pagamento
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        );
      },
    },
  ];

  const logColumns: Column<FinancialLog>[] = [
    {
      key: 'created_at',
      header: 'Data',
      render: (log) => (
        <div>
          <p className="font-medium">{format(new Date(log.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
          <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'HH:mm')}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (log) => (
        <Badge variant={log.type.includes('PAYOUT') ? 'destructive' : 'default'}>
          {log.type === 'TICKET_SALE'
            ? 'Venda'
            : log.type === 'PRIZE_PAYOUT'
            ? 'Premiação'
            : log.type}
        </Badge>
      ),
    },
    {
      key: 'amount',
      header: 'Valor',
      render: (log) => (
        <span
          className={`font-mono font-medium ${
            log.type.includes('PAYOUT') ? 'text-destructive' : 'text-primary'
          }`}
        >
          {log.type.includes('PAYOUT') ? '-' : '+'}R$ {Math.abs(Number(log.amount)).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'user_id',
      header: 'Usuário',
      render: (log) => (
        <div className="flex items-center gap-1.5">
          {log.user_id ? (
            <>
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-mono">
                {log.user_id.slice(0, 8)}...
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Sistema</span>
          )}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Descrição',
      render: (log) => <span className="text-sm">{log.description || '-'}</span>,
    },
  ];

  return (
    <EmpresaLayout title="Financeiro" description="Relatórios financeiros da empresa">
      {/* Date Filter */}
      <div className="rounded-2xl border bg-card p-4 mb-6">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClear={handleClearFilters}
        />
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 mb-6">
        <StatItem
          icon={DollarSign}
          iconBg="#DBEAFE"
          iconColor="#2563EB"
          label="Total de Vendas"
          value={`R$ ${totalSales.toFixed(2)}`}
          subtitle={`${succeededPayments.length} pagamentos`}
        />
        <StatItem
          icon={Receipt}
          iconBg="#F3F4F6"
          iconColor="#6B7280"
          label="Taxa Administrativa"
          value={`R$ ${totalFees.toFixed(2)}`}
          subtitle={`${company?.admin_fee_percentage}% por venda`}
        />
        <StatItem
          icon={TrendingUp}
          iconBg="#EDE9FE"
          iconColor="#7C3AED"
          label="Receita Líquida"
          value={`R$ ${netRevenue.toFixed(2)}`}
          subtitle="Após taxa administrativa"
        />
        <StatItem
          icon={CircleDollarSign}
          iconBg="#FEF3C7"
          iconColor="#D97706"
          label="Retenção Empresa"
          value={`R$ ${totalRetention.toFixed(2)}`}
          subtitle="Lucro retido"
        />
        <StatItem
          icon={Trophy}
          iconBg="#DCFCE7"
          iconColor="#16A34A"
          label="Contribuição Prêmio"
          value={`R$ ${totalPrizePool.toFixed(2)}`}
          subtitle="Acumulado para premiação"
        />
        <StatItem
          icon={ShoppingCart}
          iconBg="#FCE7F3"
          iconColor="#DB2777"
          label="Ticket Médio"
          value={succeededPayments.length > 0 ? `R$ ${(totalSales / succeededPayments.length).toFixed(2)}` : 'R$ 0,00'}
          subtitle={`${succeededPayments.length} vendas`}
          tooltip="Calculado com base no valor bruto, sem descontos e taxas."
        />
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <Tabs defaultValue="pagamentos" className="w-full">
          <div className="border-b bg-muted/30 px-5 pt-4">
            <TabsList className="bg-transparent h-auto p-0 gap-1">
              <TabsTrigger
                value="pagamentos"
                className="rounded-t-xl rounded-b-none border border-b-0 data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2.5 text-sm gap-2"
              >
                <CircleDollarSign className="h-4 w-4" />
                Pagamentos
              </TabsTrigger>
              <TabsTrigger
                value="movimentacoes"
                className="rounded-t-xl rounded-b-none border border-b-0 data-[state=active]:bg-card data-[state=active]:shadow-none px-4 py-2.5 text-sm gap-2"
              >
                <ArrowUpCircle className="h-4 w-4" />
                Movimentações
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-5">
            <TabsContent value="pagamentos" className="mt-0">
              <DataTable
                data={payments}
                columns={paymentColumns}
                loading={loadingPayments}
                searchPlaceholder="Buscar pagamentos..."
                emptyMessage="Nenhum pagamento registrado"
              />
            </TabsContent>

            <TabsContent value="movimentacoes" className="mt-0">
              <DataTable
                data={financialLogs}
                columns={logColumns}
                loading={loadingLogs}
                searchPlaceholder="Buscar movimentações..."
                emptyMessage="Nenhuma movimentação registrada"
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Modal Descritivo (invoice) do pagamento */}
      <Dialog open={!!invoiceModalPayment} onOpenChange={(open) => !open && setInvoiceModalPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Descritivo do pagamento</DialogTitle>
          </DialogHeader>
          {invoiceModalPayment && (() => {
            const comm = commissionsByPaymentId.get(invoiceModalPayment.id);
            const amount = Number(invoiceModalPayment.amount);
            const adminFee = Number(invoiceModalPayment.admin_fee || 0);
            const adminPct = amount > 0 ? ((adminFee / amount) * 100).toFixed(1) : (comm?.super_admin_percent ?? 0);
            return (
              <div className="space-y-3 text-sm">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground">Ref</span>
                    <span className="font-mono font-medium text-xs">{invoiceModalPayment.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground">Valor pago pelo jogador</span>
                    <span className="font-mono font-medium">{formatBrl(amount)}</span>
                  </div>
                  <div className="flex justify-between items-start text-muted-foreground">
                    <span>(-) Taxa administração (Super Admin)</span>
                    <div className="text-right">
                      <div className="font-mono">-{formatBrl(adminFee)}</div>
                      <div className="text-[10px] opacity-80 font-mono">{comm != null ? Number(comm.super_admin_percent).toFixed(1) : adminPct}%</div>
                    </div>
                  </div>
                  {comm && Number(comm.manager_gross_amount || 0) > 0 && (
                    <div className="flex justify-between items-start text-muted-foreground">
                      <span>(-) Comissão gerente{comm.manager?.name ? ` (${comm.manager.name})` : ''}</span>
                      <div className="text-right">
                        <div className="font-mono">-{formatBrl(Number(comm.manager_gross_amount))}</div>
                        {comm.manager_percent != null && (
                          <div className="text-[10px] opacity-80 font-mono">{Number(comm.manager_percent).toFixed(1)}%</div>
                        )}
                      </div>
                    </div>
                  )}
                  {comm && Number(comm.cambista_amount || 0) > 0 && (
                    <div className="flex justify-between items-start text-muted-foreground">
                      <span>(-) Comissão cambista{comm.cambista?.name ? ` (${comm.cambista.name})` : ''}</span>
                      <div className="text-right">
                        <div className="font-mono">-{formatBrl(Number(comm.cambista_amount))}</div>
                        {(comm.cambista_percent_of_manager != null || (comm as any).cambista_percent != null) && (
                          <div className="text-[10px] opacity-80 font-mono">{Number((comm as any).cambista_percent ?? comm.cambista_percent_of_manager).toFixed(1)}% da cartela</div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-start pt-2 border-t font-medium">
                    <span>Líquido empresa (após taxa e afiliados)</span>
                    <span className="font-mono">{formatBrl(Number(invoiceModalPayment.net_amount))}</span>
                  </div>

                  {/* Company retention & prize pool */}
                  {comm && Number((comm as any).company_retention_amount || 0) > 0 && (
                    <div className="flex justify-between items-start text-orange-600 dark:text-orange-400">
                      <span>Retenção empresa ({Number((comm as any).company_profit_percent || 0).toFixed(1)}%)</span>
                      <span className="font-mono font-medium">{formatBrl(Number((comm as any).company_retention_amount))}</span>
                    </div>
                  )}
                  {comm && Number((comm as any).prize_pool_contribution || 0) > 0 && (
                    <div className="flex justify-between items-start text-green-600 dark:text-green-400">
                      <span>Contribuição ao prêmio</span>
                      <span className="font-mono font-medium">{formatBrl(Number((comm as any).prize_pool_contribution))}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </EmpresaLayout>
  );
}
