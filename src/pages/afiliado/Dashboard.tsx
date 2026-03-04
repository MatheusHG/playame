import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AffiliateLayout } from '@/components/layouts/AffiliateLayout';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { format, parseISO, subDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Ticket, DollarSign, TrendingUp, Users,
  Link as LinkIcon, Copy, ExternalLink, AlertTriangle,
  ShoppingCart, Percent, X, Info,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useToast } from '@/hooks/use-toast';
import type { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { DateRange } from 'react-day-picker';

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

interface AffiliateDashboardData {
  stats: {
    totalSales: number; confirmedSales: number; totalValue: number;
    totalCommission: number; commissionPercent: number; teamCount: number; type: string;
  };
  salesByDay: { date: string; value: number; count: number }[];
  recentSales: { id: string; amount: number; createdAt: string; raffleName: string; playerName: string }[];
}

export default function AffiliateDashboard() {
  const { affiliate, hasPermission } = useAffiliate();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState({ from: startOfMonth(new Date()), to: new Date() });

  const { data } = useQuery({
    queryKey: ['affiliate-dashboard', affiliate?.id, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => api.get<AffiliateDashboardData>(`/affiliates/${affiliate?.id}/dashboard`, {
      from: dateRange.from.toISOString(), to: dateRange.to.toISOString(),
    }),
    enabled: !!affiliate?.id,
    refetchInterval: 5 * 60 * 1000,
  });

  const handleDateChange = (range: DateRange) => { if (range.from && range.to) setDateRange({ from: range.from, to: range.to }); };

  const copyLink = () => {
    const url = `${window.location.origin}/?ref=${affiliate?.link_code}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado!', description: 'Seu link de afiliado foi copiado para a área de transferência.' });
  };

  if (!affiliate) return null;

  const stats = data?.stats;
  const salesByDay = data?.salesByDay || [];
  const recentSales = data?.recentSales || [];

  return (
    <AffiliateLayout title="Dashboard" description={`Bem-vindo, ${affiliate.name}!`}>
      <div className="space-y-6">
        {/* Paused Warning */}
        {affiliate.is_sales_paused && (
          <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive">Vendas Pausadas</h3>
              <p className="text-sm text-muted-foreground">Suas vendas estão temporariamente pausadas. Novos clientes que acessarem seu link não poderão fazer compras atribuídas a você.</p>
            </div>
          </div>
        )}

        {/* Quick Link + Date Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Card className="rounded-2xl border shadow-sm flex-1 w-full sm:w-auto">
            <CardContent className="py-4 px-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 flex-shrink-0">
                  <LinkIcon className="h-5 w-5 text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Seu Link de Afiliado</p>
                  <p className="text-sm font-medium truncate mt-0.5">{window.location.origin}/?ref={affiliate.link_code}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={copyLink}><Copy className="h-4 w-4 mr-2" />Copiar</Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`${window.location.origin}/?ref=${affiliate.link_code}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Date Filter */}
        <div className="flex items-center justify-end gap-2">
          <DateRangeFilter from={dateRange.from} to={dateRange.to} onChange={handleDateChange} />
          <Button variant="ghost" size="icon" onClick={() => setDateRange({ from: startOfMonth(new Date()), to: new Date() })} title="Limpar"><X className="h-4 w-4" /></Button>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          <StatItem icon={Ticket} iconBg="#DBEAFE" iconColor="#2563EB" label="Vendas Confirmadas" value={stats?.confirmedSales || 0} subtitle={`${stats?.totalSales || 0} total no período`} />
          <StatItem icon={TrendingUp} iconBg="#D1FAE5" iconColor="#059669" label="Valor Vendido" value={formatCurrency(stats?.totalValue || 0)} subtitle="vendas confirmadas" />
          {hasPermission('can_view_own_commissions') && (
            <StatItem icon={DollarSign} iconBg="#FEF3C7" iconColor="#D97706" label="Comissões" value={formatCurrency(stats?.totalCommission || 0)} subtitle="no período" />
          )}
          {affiliate.type === 'manager' && hasPermission('can_manage_cambistas') && (
            <StatItem icon={Users} iconBg="#EDE9FE" iconColor="#7C3AED" label="Equipe" value={stats?.teamCount || 0} subtitle="cambistas ativos" />
          )}
          <StatItem icon={ShoppingCart} iconBg="#FCE7F3" iconColor="#DB2777" label="Ticket Médio" value={(stats?.confirmedSales || 0) > 0 ? formatCurrency((stats?.totalValue || 0) / stats!.confirmedSales) : 'R$ 0,00'} subtitle={`${stats?.confirmedSales || 0} vendas`} tooltip="Calculado com base no valor bruto, sem descontos e taxas." />
        </div>

        {/* Commission Rate + Sales Chart */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Commission Info */}
          <Card className="rounded-2xl border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100"><Percent className="h-5 w-5 text-amber-600" /></div>
                <CardTitle className="text-base font-semibold">Sua Comissão</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-bold">{stats?.commissionPercent || affiliate.commission_percent}%</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {affiliate.type === 'manager' ? 'sobre o valor da cartela' : 'sobre o valor da cartela'}
                  </p>
                </div>
                <Badge variant="outline" className="text-base px-4 py-2">
                  {affiliate.type === 'manager' ? 'Gerente' : 'Cambista'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Sales Chart */}
          <Card className="lg:col-span-2 rounded-2xl border shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100"><ShoppingCart className="h-5 w-5 text-blue-600" /></div>
                  <div><CardTitle className="text-base font-semibold">Vendas no Período</CardTitle><p className="text-sm text-muted-foreground">Valor diário</p></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-[240px]">
                {salesByDay.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Nenhuma venda no período.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesByDay}>
                      <defs>
                        <linearGradient id="gradAffSales" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} /><stop offset="100%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), 'dd/MM', { locale: ptBR })} fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <YAxis tickFormatter={formatCompact} fontSize={11} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} width={70} />
                      <RechartsTooltip formatter={(v: number) => [formatCurrency(v), 'Valor']} labelFormatter={(l) => format(parseISO(l as string), "dd 'de' MMMM", { locale: ptBR })} contentStyle={tooltipStyle} />
                      <Area type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2.5} fill="url(#gradAffSales)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales + Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Recent Sales */}
          <Card className="lg:col-span-2 rounded-2xl border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                <div><CardTitle className="text-base font-semibold">Vendas Recentes</CardTitle><p className="text-sm text-muted-foreground">Últimas 10 no período</p></div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {recentSales.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda no período.</p>
              ) : (
                <div className="space-y-3">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center gap-4 rounded-xl border p-3.5 hover:bg-muted/40 transition-colors">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 flex-shrink-0">
                        <span className="text-sm font-bold text-blue-600">{sale.playerName.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">{sale.playerName}</p>
                          <p className="font-bold text-sm tabular-nums ml-2">{formatCurrency(sale.amount)}</p>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">{sale.raffleName}</p>
                          <p className="text-xs text-muted-foreground ml-2 flex-shrink-0">{format(new Date(sale.createdAt), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="space-y-4">
            {hasPermission('can_create_sales') && !affiliate.is_sales_paused && (
              <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="py-5 px-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100"><Ticket className="h-5 w-5 text-blue-600" /></div>
                    <div><p className="font-semibold text-sm">Nova Venda</p><p className="text-xs text-muted-foreground">Registre uma venda</p></div>
                  </div>
                  <Button asChild className="w-full"><Link to={"/afiliado/nova-venda"}>Criar Venda</Link></Button>
                </CardContent>
              </Card>
            )}

            {hasPermission('can_view_own_sales') && (
              <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="py-5 px-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100"><ShoppingCart className="h-5 w-5 text-emerald-600" /></div>
                    <div><p className="font-semibold text-sm">Minhas Vendas</p><p className="text-xs text-muted-foreground">Acompanhe suas vendas</p></div>
                  </div>
                  <Button variant="outline" asChild className="w-full"><Link to={"/afiliado/vendas"}>Ver Vendas</Link></Button>
                </CardContent>
              </Card>
            )}

            {affiliate.type === 'manager' && hasPermission('can_manage_cambistas') && (
              <Card className="rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="py-5 px-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100"><Users className="h-5 w-5 text-violet-600" /></div>
                    <div><p className="font-semibold text-sm">Minha Equipe</p><p className="text-xs text-muted-foreground">Gerencie cambistas</p></div>
                  </div>
                  <Button variant="outline" asChild className="w-full"><Link to={"/afiliado/equipe"}>Ver Equipe</Link></Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AffiliateLayout>
  );
}
