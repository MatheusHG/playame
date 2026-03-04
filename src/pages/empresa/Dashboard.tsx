import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users, DollarSign, Ticket, Trophy, CheckCircle2,
  CalendarClock, Clock, UserPlus, TrendingUp, Network,
  ShoppingCart, X, Info,
} from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DateRange } from 'react-day-picker';

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const PAYMENT_STATUS_LABELS: Record<string, string> = { succeeded: 'Aprovado', pending: 'Pendente', processing: 'Processando', failed: 'Falhou', refunded: 'Reembolsado' };
const PAYMENT_STATUS_COLORS: Record<string, string> = { succeeded: '#10B981', pending: '#F59E0B', processing: '#3B82F6', failed: '#EF4444', refunded: '#8B5CF6' };

const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const formatCompact = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v}`;
};

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

const tooltipStyle = { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px 16px', fontSize: '13px' };

interface EmpresaDashboardData {
  stats: {
    activePlayers: number; totalPlayers: number; totalRevenue: number; netRevenue: number;
    adminFees: number; totalTicketsSold: number; activeRaffles: number; finishedRaffles: number;
    draftRaffles: number; totalSalesCount: number; newPlayersToday: number; newPlayersThisMonth: number;
    totalAffiliates: number;
  };
  revenueByDay: { date: string; revenue: number; net: number; count: number }[];
  playerRegistrationsByDay: { date: string; count: number }[];
  paymentStatusDistribution: { status: string; count: number }[];
  raffleStatusDistribution: { status: string; count: number }[];
  recentSales: { id: string; amount: number; status: string; createdAt: string; raffleName: string; playerName: string }[];
  upcomingRaffles: { id: string; name: string; ticketPrice: number; scheduledAt: string | null; status: string }[];
  topAffiliates: { affiliateId: string; affiliateName: string; type: string; salesCount: number; totalSales: number }[];
}

export default function EmpresaDashboard() {
  const { company, loading: tenantLoading } = useTenant();
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 30), to: new Date() });

  const { data, isLoading } = useQuery({
    queryKey: ['empresa-dashboard', company?.id, dateRange.from.toISOString(), dateRange.to.toISOString()],
    enabled: !!company?.id,
    queryFn: () => api.get<EmpresaDashboardData>(`/companies/${company!.id}/dashboard`, { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() }),
    refetchInterval: 5 * 60 * 1000,
  });

  const handleDateChange = (range: DateRange) => { if (range.from && range.to) setDateRange({ from: range.from, to: range.to }); };

  if (tenantLoading) return <LoadingState fullScreen message="Carregando empresa..." />;
  if (isLoading || !data) {
    return (<EmpresaLayout title="Dashboard" description="Visão geral da empresa"><LoadingState message="Carregando dashboard..." className="py-12" /></EmpresaLayout>);
  }

  const { stats, revenueByDay, playerRegistrationsByDay, paymentStatusDistribution, raffleStatusDistribution, recentSales, upcomingRaffles, topAffiliates } = data;
  const totalPayments = paymentStatusDistribution.reduce((a, d) => a + d.count, 0);

  return (
    <EmpresaLayout title="Dashboard" description="Visão geral da empresa">
      {/* Date Filter */}
      <div className="flex items-center justify-between mb-6">
        <div />
        <div className="flex items-center gap-2">
          <DateRangeFilter from={dateRange.from} to={dateRange.to} onChange={handleDateChange} />
          <Button variant="ghost" size="icon" onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })} title="Limpar"><X className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <StatItem icon={Trophy} iconBg="#FFEDD5" iconColor="#EA580C" label="Sorteios Ativos" value={stats.activeRaffles} subtitle={`${stats.finishedRaffles} finalizados`} />
        <StatItem icon={Users} iconBg="#D1FAE5" iconColor="#059669" label="Jogadores" value={stats.activePlayers.toLocaleString('pt-BR')} subtitle={`+${stats.newPlayersToday} hoje | +${stats.newPlayersThisMonth} mês`} />
        <StatItem icon={DollarSign} iconBg="#FEF3C7" iconColor="#D97706" label="Faturamento" value={formatCurrency(stats.totalRevenue)} subtitle={`${stats.totalSalesCount} transações`} />
        <StatItem icon={TrendingUp} iconBg="#D1FAE5" iconColor="#059669" label="Receita Líquida" value={formatCurrency(stats.netRevenue)} subtitle={`-${formatCurrency(stats.adminFees)} taxas`} />
        <StatItem icon={Ticket} iconBg="#FCE7F3" iconColor="#DB2777" label="Cartelas Vendidas" value={stats.totalTicketsSold.toLocaleString('pt-BR')} subtitle="no período" />
        <StatItem icon={Network} iconBg="#EDE9FE" iconColor="#7C3AED" label="Afiliados" value={stats.totalAffiliates} subtitle="cadastrados" />
        <StatItem icon={CheckCircle2} iconBg="#DBEAFE" iconColor="#2563EB" label="Finalizados" value={stats.finishedRaffles} subtitle="sorteios concluídos" />
        <StatItem icon={ShoppingCart} iconBg="#FEF3C7" iconColor="#CA8A04" label="Ticket Médio" value={stats.totalSalesCount > 0 ? formatCurrency(stats.totalRevenue / stats.totalSalesCount) : 'R$ 0,00'} subtitle={`${stats.totalSalesCount} vendas`} tooltip="Calculado com base no valor bruto, sem descontos e taxas." />
      </div>

      {/* Revenue + Payment Status */}
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-2xl border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div><CardTitle className="text-base font-semibold">Faturamento</CardTitle><p className="text-sm text-muted-foreground mt-0.5">Bruto e líquido no período</p></div>
              <div className="hidden sm:flex items-center gap-5 text-sm">
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /><span className="text-muted-foreground">Bruto</span></div>
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><span className="text-muted-foreground">Líquido</span></div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[240px] sm:h-[320px]">
              {revenueByDay.length === 0 ? (<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum dado no período.</div>) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueByDay}>
                    <defs>
                      <linearGradient id="gRevE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gNetE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity={0.15} /><stop offset="100%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), 'dd/MM', { locale: ptBR })} fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={formatCompact} fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} width={70} />
                    <RechartsTooltip formatter={(v: number, n: string) => [formatCurrency(v), n === 'revenue' ? 'Bruto' : 'Líquido']} labelFormatter={(l) => format(parseISO(l as string), "dd 'de' MMMM, yyyy", { locale: ptBR })} contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2.5} fill="url(#gRevE)" name="revenue" />
                    <Area type="monotone" dataKey="net" stroke="#10B981" strokeWidth={2} fill="url(#gNetE)" name="net" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Status dos Pagamentos</CardTitle><p className="text-sm text-muted-foreground mt-0.5">No período</p></CardHeader>
          <CardContent>
            <div className="h-[200px]">
              {paymentStatusDistribution.length === 0 ? (<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum pagamento.</div>) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={paymentStatusDistribution.map(d => ({ ...d, name: PAYMENT_STATUS_LABELS[d.status] || d.status }))} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="count" nameKey="name" strokeWidth={2} stroke="hsl(var(--card))">
                    {paymentStatusDistribution.map((d, i) => (<Cell key={i} fill={PAYMENT_STATUS_COLORS[d.status] || CHART_COLORS[i % CHART_COLORS.length]} />))}
                  </Pie><RechartsTooltip contentStyle={tooltipStyle} /></PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 space-y-2.5">
              {paymentStatusDistribution.map((d, i) => {
                const pct = totalPayments > 0 ? ((d.count / totalPayments) * 100).toFixed(1) : '0';
                return (<div key={d.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5"><span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: PAYMENT_STATUS_COLORS[d.status] || CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-muted-foreground">{PAYMENT_STATUS_LABELS[d.status] || d.status}</span></div>
                  <div className="flex items-center gap-3"><span className="font-semibold tabular-nums">{d.count.toLocaleString('pt-BR')}</span><span className="text-muted-foreground text-xs w-12 text-right">{pct}%</span></div>
                </div>);
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Players + Top Affiliates */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100"><UserPlus className="h-5 w-5 text-violet-600" /></div>
                <div><CardTitle className="text-base font-semibold">Novos Jogadores</CardTitle><p className="text-sm text-muted-foreground">No período</p></div>
              </div>
              <div className="text-right"><p className="text-2xl font-bold">{stats.newPlayersThisMonth}</p><p className="text-xs text-muted-foreground">este mês</p></div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-[200px] sm:h-[260px]">
              {playerRegistrationsByDay.length === 0 ? (<div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhum cadastro.</div>) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={playerRegistrationsByDay} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), 'dd/MM', { locale: ptBR })} fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                    <RechartsTooltip labelFormatter={(l) => format(parseISO(l as string), "dd 'de' MMMM", { locale: ptBR })} formatter={(v: number) => [`${v} cadastros`, 'Novos']} contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                    <Bar dataKey="count" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100"><Network className="h-5 w-5 text-blue-600" /></div>
              <div><CardTitle className="text-base font-semibold">Top Afiliados</CardTitle><p className="text-sm text-muted-foreground">Por vendas no período</p></div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {topAffiliates.length === 0 ? (<div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">Nenhuma venda por afiliado.</div>) : (
              <div className="space-y-4">
                {topAffiliates.map((aff, i) => {
                  const max = topAffiliates[0]?.totalSales || 1;
                  return (<div key={aff.affiliateId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span><span className="font-medium truncate">{aff.affiliateName}</span><span className="text-xs text-muted-foreground">({aff.type === 'manager' ? 'Gerente' : 'Cambista'})</span></div>
                      <span className="font-semibold tabular-nums text-sm">{formatCurrency(aff.totalSales)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${(aff.totalSales / max) * 100}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} /></div>
                    <p className="text-xs text-muted-foreground">{aff.salesCount} vendas</p>
                  </div>);
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales + Sidebar */}
      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-2xl border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
              <div><CardTitle className="text-base font-semibold">Vendas Recentes</CardTitle><p className="text-sm text-muted-foreground">Últimas 10 no período</p></div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {recentSales.length === 0 ? (<p className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda no período.</p>) : (
              <div className="space-y-3">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center gap-4 rounded-xl border p-3.5 hover:bg-muted/40 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 flex-shrink-0"><span className="text-sm font-bold text-blue-600">{sale.playerName.charAt(0).toUpperCase()}</span></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between"><p className="font-medium text-sm truncate">{sale.playerName}</p><p className="font-bold text-sm tabular-nums ml-2">{formatCurrency(sale.amount)}</p></div>
                      <div className="flex items-center justify-between mt-0.5"><p className="text-xs text-muted-foreground truncate">{sale.raffleName}</p><p className="text-xs text-muted-foreground ml-2 flex-shrink-0">{format(new Date(sale.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100"><CalendarClock className="h-5 w-5 text-amber-600" /></div><CardTitle className="text-base font-semibold">Próximos Sorteios</CardTitle></div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {upcomingRaffles.length === 0 ? (<p className="text-sm text-muted-foreground py-4 text-center">Nenhum agendado.</p>) : (
                upcomingRaffles.map((r) => (
                  <div key={r.id} className="rounded-xl border p-3.5 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between"><p className="font-semibold text-sm truncate flex-1">{r.name}</p><StatusBadge status={r.status as any} /></div>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t">
                      <p className="font-bold text-sm tabular-nums">{formatCurrency(r.ticketPrice)}</p>
                      {r.scheduledAt && (<p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(r.scheduledAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Resumo dos Sorteios</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-0">
              {raffleStatusDistribution.length === 0 ? (<p className="text-sm text-muted-foreground py-4 text-center">Nenhum sorteio.</p>) : (
                raffleStatusDistribution.map((item) => {
                  const total = raffleStatusDistribution.reduce((a, d) => a + d.count, 0);
                  const pct = total > 0 ? ((item.count / total) * 100).toFixed(0) : '0';
                  return (<div key={item.status} className="space-y-2">
                    <div className="flex items-center justify-between"><StatusBadge status={item.status as any} /><span className="font-bold tabular-nums">{item.count}</span></div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                  </div>);
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </EmpresaLayout>
  );
}
