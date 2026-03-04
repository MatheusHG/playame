import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { DataTable, Column } from '@/components/shared/DataTable';
import { LoadingState } from '@/components/shared/LoadingState';
import { ResetPasswordDialog } from '@/components/empresa/ResetPasswordDialog';
import { SaleDetailDialog } from '@/components/empresa/SaleDetailDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAffiliates } from '@/hooks/useAffiliates';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Percent,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Save,
  KeyRound,
  Link2,
  Copy,
  MoreHorizontal,
  Eye,
  ShoppingCart,
  Pause,
} from 'lucide-react';

export default function AfiliadoDetalhe() {
  const { affiliateId } = useParams<{ affiliateId: string }>();
  const navigate = useNavigate();
  const { company } = useTenant();
  const { toast } = useToast();
  const { updateAffiliate, getCambistas } = useAffiliates(company?.id);

  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [editMode, setEditMode] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [saleDetailTicketId, setSaleDetailTicketId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    email: '',
    commission_percent: 0,
  });

  const { data: affiliate, isLoading: affiliateLoading } = useQuery({
    queryKey: ['affiliate', affiliateId],
    queryFn: () => api.get<any>(`/affiliates/${affiliateId}`),
    enabled: !!affiliateId,
  });

  const { data: commissions = [], isLoading: commissionsLoading } = useQuery({
    queryKey: ['affiliate-commissions', affiliateId, dateRange],
    queryFn: () => api.get<any[]>(`/affiliates/${affiliateId}/commissions`, {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    }),
    enabled: !!affiliateId && !!affiliate,
  });

  const { data: recentSales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['affiliate-sales', affiliateId, dateRange],
    queryFn: () => api.get<any[]>(`/affiliates/${affiliateId}/sales`, {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    }),
    enabled: !!affiliateId,
  });

  const stats = useMemo(() => {
    const isManager = affiliate?.type === 'manager';
    const amountField = isManager ? 'manager_net_amount' : 'cambista_amount';
    const totalGenerated = commissions.reduce((sum: number, c: any) => sum + (Number(c[amountField]) || 0), 0);
    const paidCommissions = commissions.filter((c: any) => c.payment?.status === 'succeeded');
    const totalPaid = paidCommissions.reduce((sum: number, c: any) => sum + (Number(c[amountField]) || 0), 0);
    const pendingCommissions = commissions.filter((c: any) => c.payment?.status !== 'succeeded');
    const totalPending = pendingCommissions.reduce((sum: number, c: any) => sum + (Number(c[amountField]) || 0), 0);
    return {
      totalGenerated,
      totalPaid,
      totalPending,
      totalSales: recentSales.length,
      paidCount: paidCommissions.length,
      pendingCount: pendingCommissions.length,
    };
  }, [commissions, recentSales, affiliate]);

  const commissionsApproved = useMemo(
    () => (commissions || []).filter((c: any) => c.payment?.status === 'succeeded'),
    [commissions]
  );

  const cambistas = useMemo(() => {
    if (affiliate?.type !== 'manager' || !company?.id) return [];
    return getCambistas(affiliate.id);
  }, [affiliate, company, getCambistas]);

  const handleStartEdit = () => {
    if (affiliate) {
      setEditData({
        name: affiliate.name,
        phone: affiliate.phone || '',
        email: affiliate.email || '',
        commission_percent: affiliate.commission_percent,
      });
      setEditMode(true);
    }
  };

  const handleSave = () => {
    updateAffiliate.mutate(
      {
        id: affiliate.id,
        name: editData.name,
        phone: editData.phone || undefined,
        email: editData.email || undefined,
        commission_percent: editData.commission_percent,
      },
      {
        onSuccess: () => {
          setEditMode(false);
          toast({ title: 'Dados atualizados', description: 'As informações foram salvas com sucesso.' });
        },
      }
    );
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const commissionColumns: Column<any>[] = [
    {
      key: 'ref',
      header: 'Ref',
      render: (item) => <span className="font-mono text-xs text-muted-foreground">{item.payment_id?.slice(0, 8).toUpperCase()}</span>,
    },
    {
      key: 'created_at',
      header: 'Data',
      render: (item) => format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    },
    {
      key: 'raffle',
      header: 'Sorteio',
      render: (item) => item.raffle?.name || '-',
    },
    {
      key: 'sale_amount',
      header: 'Venda',
      render: (item) => formatCurrency(Number(item.sale_amount)),
    },
    {
      key: 'commission',
      header: 'Comissão',
      render: (item) => {
        const amount = affiliate?.type === 'manager' ? item.manager_net_amount : item.cambista_amount;
        return <span className="font-medium text-primary">{formatCurrency(Number(amount) || 0)}</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => {
        const status = item.payment?.status;
        const label = status === 'succeeded' ? 'Aprovado' : status === 'pending' || status === 'processing' ? 'Pendente' : status || '—';
        return <Badge variant={status === 'succeeded' ? 'default' : 'secondary'}>{label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSaleDetailTicketId(item.ticket_id)}>
              <Eye className="h-4 w-4 mr-2" />Ver detalhes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const salesColumns: Column<any>[] = [
    {
      key: 'ref',
      header: 'Ref',
      render: (item) => {
        const paymentId = item.payment?.[0]?.id || item.id;
        return <span className="font-mono text-xs text-muted-foreground">{paymentId?.slice(0, 8).toUpperCase()}</span>;
      },
    },
    {
      key: 'created_at',
      header: 'Data',
      render: (item) => format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    },
    { key: 'raffle', header: 'Sorteio', render: (item) => item.raffle?.name || '-' },
    {
      key: 'player',
      header: 'Jogador',
      render: (item) => (
        <div>
          <div className="font-medium">{item.player?.name}</div>
          <div className="text-xs text-muted-foreground">***{item.player?.cpf_last4}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Valor',
      render: (item) => formatCurrency(Number(item.payment?.[0]?.amount || item.raffle?.ticket_price || 0)),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => {
        const status = item.payment?.[0]?.status || item.status;
        return (
          <Badge variant={status === 'succeeded' || status === 'active' ? 'default' : 'secondary'}>
            {status === 'succeeded' || status === 'active' ? 'Confirmado' : 'Pendente'}
          </Badge>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSaleDetailTicketId(item.id)}>
              <Eye className="h-4 w-4 mr-2" />Ver detalhes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (affiliateLoading) return <LoadingState fullScreen message="Carregando afiliado..." />;

  if (!affiliate) {
    return (
      <EmpresaLayout title="Afiliado não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground">O afiliado solicitado não foi encontrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
        </div>
      </EmpresaLayout>
    );
  }

  const isManager = affiliate.type === 'manager';

  return (
    <EmpresaLayout title={affiliate.name} description={isManager ? 'Detalhes do Gerente' : 'Detalhes do Operador'}>
      <div className="space-y-5">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/afiliados')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar para Afiliados
        </Button>

        {/* Profile Header Card */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: isManager ? '#DBEAFE' : '#EDE9FE' }}>
                  <User className="h-8 w-8" style={{ color: isManager ? '#2563EB' : '#7C3AED' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight">{affiliate.name}</h2>
                    <Badge variant={affiliate.is_active ? (affiliate.is_sales_paused ? 'secondary' : 'default') : 'destructive'}>
                      {affiliate.is_active ? (affiliate.is_sales_paused ? 'Pausado' : 'Ativo') : 'Inativo'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isManager ? 'Gerente' : 'Operador'}
                    {!isManager && affiliate.parent && (
                      <> &middot; Gerente: <span className="font-medium text-foreground">{affiliate.parent.name}</span></>
                    )}
                  </p>
                  {affiliate.is_sales_paused && (
                    <div className="flex items-center gap-1.5 mt-2 text-amber-600 dark:text-amber-400">
                      <Pause className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">Vendas pausadas</span>
                    </div>
                  )}
                </div>
              </div>
              {!editMode && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setResetPasswordOpen(true)}>
                    <KeyRound className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Resetar Senha</span>
                  </Button>
                  <Button size="sm" onClick={handleStartEdit}>
                    <span className="hidden sm:inline">Editar Perfil</span>
                    <span className="sm:hidden">Editar</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Edit Form */}
            {editMode && (
              <div className="mt-6 pt-6 border-t">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</Label>
                    <Input className="rounded-xl" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Telefone</Label>
                    <Input className="rounded-xl" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">E-mail</Label>
                    <Input className="rounded-xl" type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comissão (%)</Label>
                    <Input className="rounded-xl" type="number" min="0" max="100" step="0.01" value={editData.commission_percent}
                      onChange={(e) => setEditData({ ...editData, commission_percent: parseFloat(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-4">
                  <Button variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={updateAffiliate.isPending}>
                    <Save className="h-4 w-4 mr-2" />Salvar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Info Row */}
          {!editMode && (
            <div className="border-t bg-muted/30 px-5 sm:px-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#DBEAFE' }}>
                    <Phone className="h-3.5 w-3.5" style={{ color: '#2563EB' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Telefone</p>
                    <p className="text-sm font-medium truncate">{affiliate.phone || 'Não informado'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#FCE7F3' }}>
                    <Mail className="h-3.5 w-3.5" style={{ color: '#DB2777' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">E-mail</p>
                    <p className="text-sm font-medium truncate">{affiliate.email || 'Não informado'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#DCFCE7' }}>
                    <Percent className="h-3.5 w-3.5" style={{ color: '#16A34A' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Comissão</p>
                    <p className="text-sm font-medium">{affiliate.commission_percent}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
                    <Clock className="h-3.5 w-3.5" style={{ color: '#D97706' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cadastro</p>
                    <p className="text-sm font-medium">{format(new Date(affiliate.created_at), 'dd/MM/yyyy', { locale: ptBR })}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Affiliate Link */}
          {!editMode && affiliate.link_code && (
            <div className="border-t px-5 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground flex-shrink-0">
                  <Link2 className="h-4 w-4" />Link de indicação
                </div>
                <div className="flex flex-1 items-center gap-2 min-w-0">
                  <code className="flex-1 min-w-0 text-xs sm:text-sm bg-muted px-3 py-2 rounded-lg border break-all truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/?ref=${affiliate.link_code}` : `/?ref=${affiliate.link_code}`}
                  </code>
                  <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => {
                    const url = `${window.location.origin}/?ref=${affiliate.link_code}`;
                    navigator.clipboard.writeText(url);
                    toast({ title: 'Link copiado!' });
                  }}>
                    <Copy className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Copiar</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Date Range */}
        <DateRangeFilter from={dateRange.from} to={dateRange.to} onChange={(range) => setDateRange({ from: range.from!, to: range.to! })} />

        {/* Stats */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard icon={TrendingUp} bg="#DBEAFE" color="#2563EB" label="Total Gerado" value={formatCurrency(stats.totalGenerated)} sub={`${commissions.length} comissões`} />
          <StatCard icon={CheckCircle} bg="#DCFCE7" color="#16A34A" label="Total Pago" value={formatCurrency(stats.totalPaid)} sub={`${stats.paidCount} confirmados`} />
          <StatCard icon={XCircle} bg="#FEF3C7" color="#D97706" label="Pendente" value={formatCurrency(stats.totalPending)} sub={`${stats.pendingCount} aguardando`} />
          <StatCard icon={ShoppingCart} bg="#EDE9FE" color="#7C3AED" label="Vendas" value={String(stats.totalSales)} sub="no período" />
        </div>

        {/* Tabs */}
        <Card className="rounded-2xl overflow-hidden">
          <Tabs defaultValue="commissions" className="w-full">
            <div className="bg-muted/30 px-4 pt-3 overflow-x-auto">
              <TabsList className="bg-transparent h-auto p-0 gap-1">
                <TabsTrigger value="commissions" className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0">
                  <DollarSign className="w-4 h-4" />
                  <span className="hidden sm:inline">Comissões</span><span className="sm:hidden">Comis.</span>
                  {commissionsApproved.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{commissionsApproved.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="sales" className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0">
                  <ShoppingCart className="w-4 h-4" />
                  <span className="hidden sm:inline">Vendas</span>
                  {recentSales.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{recentSales.length}</Badge>}
                </TabsTrigger>
                {isManager && (
                  <TabsTrigger value="cambistas" className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0">
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Cambistas</span><span className="sm:hidden">Equipe</span>
                    {cambistas.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{cambistas.length}</Badge>}
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            <TabsContent value="commissions" className="mt-0 p-5">
              <p className="text-sm text-muted-foreground mb-3">Apenas comissões com pagamento aprovado</p>
              <DataTable data={commissionsApproved} columns={commissionColumns} loading={commissionsLoading} emptyMessage="Nenhuma comissão com pagamento aprovado no período" pageSize={15} />
            </TabsContent>

            <TabsContent value="sales" className="mt-0 p-5">
              <p className="text-sm text-muted-foreground mb-3">Cartelas vendidas por este afiliado no período</p>
              <DataTable data={recentSales} columns={salesColumns} loading={salesLoading} emptyMessage="Nenhuma venda encontrada no período" pageSize={15} />
            </TabsContent>

            {isManager && (
              <TabsContent value="cambistas" className="mt-0 p-5">
                {cambistas.length === 0 ? (
                  <div className="text-center py-12 rounded-xl border border-dashed bg-muted/20">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="font-medium text-muted-foreground">Nenhum cambista cadastrado</p>
                    <p className="text-sm text-muted-foreground mt-1">Os operadores vinculados a este gerente aparecerão aqui.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {cambistas.map((cambista: any) => (
                      <Link key={cambista.id} to={`/admin/afiliados/${cambista.id}`}
                        className="rounded-xl border bg-card p-4 hover:shadow-md transition-all hover:border-primary/30 block">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EDE9FE' }}>
                              <User className="h-5 w-5" style={{ color: '#7C3AED' }} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{cambista.name}</p>
                              <p className="text-xs text-muted-foreground">{cambista.commission_percent}% de comissão</p>
                            </div>
                          </div>
                          <Badge variant={cambista.is_active ? (cambista.is_sales_paused ? 'secondary' : 'default') : 'destructive'} className="flex-shrink-0">
                            {cambista.is_active ? (cambista.is_sales_paused ? 'Pausado' : 'Ativo') : 'Inativo'}
                          </Badge>
                        </div>
                        {(cambista.phone || cambista.email) && (
                          <div className="mt-3 pt-3 border-t flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {cambista.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{cambista.phone}</span>}
                            {cambista.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{cambista.email}</span>}
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </Card>

        <ResetPasswordDialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen} affiliate={affiliate} companySlug={company?.slug || ''} />
        <SaleDetailDialog open={!!saleDetailTicketId} onOpenChange={(open) => { if (!open) setSaleDetailTicketId(null); }} ticketId={saleDetailTicketId} />
      </div>
    </EmpresaLayout>
  );
}

function StatCard({ icon: Icon, bg, color, label, value, sub }: {
  icon: any; bg: string; color: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-3 sm:p-5 flex items-center gap-3 sm:gap-4">
      <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg sm:text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{sub}</p>
      </div>
    </div>
  );
}
