import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { DollarSign, TrendingUp, Receipt, ArrowUpCircle, CircleDollarSign, User, Eye, MoreVertical, CheckCircle, XCircle, Users, FileText } from 'lucide-react';
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
import type { Database } from '@/integrations/supabase/types';
import { getDisplayCpf } from '@/lib/utils';

type Payment = Database['public']['Tables']['payments']['Row'];
type PaymentWithPlayer = Payment & {
  player: { id: string; name: string; cpf_last4: string } | null;
};
type AffiliateCommissionRow = Database['public']['Tables']['affiliate_commissions']['Row'] & {
  manager?: { id: string; name: string } | null;
  cambista?: { id: string; name: string } | null;
};
type FinancialLog = Database['public']['Tables']['financial_logs']['Row'] & {
  user_email?: string;
};

const formatBrl = (v: number) => `R$ ${Number(v).toFixed(2)}`;

export default function EmpresaFinanceiro() {
  const { slug } = useParams<{ slug: string }>();
  const { setCompanySlug, company, loading } = useTenant();
  
  // Date filters
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  // Controles para abrir diálogos de aprovar/rejeitar por payment id (uso no dropdown de ações)
  const [paymentControls, setPaymentControls] = useState<Record<string, { openApprove: () => void; openReject: () => void }>>({});
  // Modal do descritivo (invoice) do pagamento
  const [invoiceModalPayment, setInvoiceModalPayment] = useState<PaymentWithPlayer | null>(null);

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  // Fetch payments with date filter and player info
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['company-payments', company?.id, startDate, endDate],
    enabled: !!company?.id,
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(`
          *,
          player:players(id, name, cpf_encrypted, cpf_last4)
        `)
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (startDate) {
        query = query.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PaymentWithPlayer[];
    },
  });

  // Fetch affiliate commissions (mesmo período dos pagamentos) para exibir descontos e descritivo
  const { data: affiliateCommissions = [] } = useQuery({
    queryKey: ['company-affiliate-commissions', company?.id, startDate, endDate],
    enabled: !!company?.id,
    queryFn: async () => {
      let query = supabase
        .from('affiliate_commissions')
        .select(`
          *,
          manager:affiliates!affiliate_commissions_manager_id_fkey(id, name),
          cambista:affiliates!affiliate_commissions_cambista_id_fkey(id, name)
        `)
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (startDate) {
        query = query.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AffiliateCommissionRow[];
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
      let query = supabase
        .from('financial_logs')
        .select('*')
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (startDate) {
        query = query.gte('created_at', startOfDay(startDate).toISOString());
      }
      if (endDate) {
        query = query.lte('created_at', endOfDay(endDate).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch user emails for logs that have user_id
      const userIds = [...new Set((data || []).map(log => log.user_id).filter(Boolean))];
      let usersMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        // We need to use auth.users but we can't directly query it
        // Instead, we'll show user_id abbreviated or fetch from audit_logs
        // For now, just show user_id if available
      }

      return (data || []).map(log => ({
        ...log,
        user_email: log.user_id ? `Usuário ${log.user_id.slice(0, 8)}...` : undefined,
      })) as FinancialLog[];
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

  const handleClearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const paymentColumns: Column<PaymentWithPlayer>[] = [
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
                {p.player_id && slug && (
                  <DropdownMenuItem asChild>
                    <Link to={`/empresa/${slug}/jogadores/${p.player_id}`} className="flex items-center gap-2">
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
                    {p.player_id && slug && <DropdownMenuSeparator />}
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
      <div className="mb-6">
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClear={handleClearFilters}
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total de Vendas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {totalSales.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{succeededPayments.length} pagamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Taxa Administrativa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">R$ {totalFees.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              {company?.admin_fee_percentage}% por venda
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Receita Líquida
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">R$ {netRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Disponível para premiação</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pagamentos" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pagamentos" className="gap-2">
            <CircleDollarSign className="h-4 w-4" />
            Pagamentos
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="gap-2">
            <ArrowUpCircle className="h-4 w-4" />
            Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pagamentos">
          <DataTable
            data={payments}
            columns={paymentColumns}
            loading={loadingPayments}
            searchPlaceholder="Buscar pagamentos..."
            emptyMessage="Nenhum pagamento registrado"
          />
        </TabsContent>

        <TabsContent value="movimentacoes">
          <DataTable
            data={financialLogs}
            columns={logColumns}
            loading={loadingLogs}
            searchPlaceholder="Buscar movimentações..."
            emptyMessage="Nenhuma movimentação registrada"
          />
        </TabsContent>
      </Tabs>

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
                        {comm.cambista_percent_of_manager != null && (
                          <div className="text-[10px] opacity-80 font-mono">{Number(comm.cambista_percent_of_manager).toFixed(1)}% do gerente</div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-start pt-2 border-t font-medium text-primary">
                    <span>Valor líquido (empresa)</span>
                    <span className="font-mono">{formatBrl(Number(invoiceModalPayment.net_amount))}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </EmpresaLayout>
  );
}
