import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangeFilter } from '@/components/shared/DateRangeFilter';
import { DataTable, Column } from '@/components/shared/DataTable';
import { LoadingState } from '@/components/shared/LoadingState';
import { StatsCard } from '@/components/shared/StatsCard';
import { ResetPasswordDialog } from '@/components/empresa/ResetPasswordDialog';
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
} from 'lucide-react';

export default function AfiliadoDetalhe() {
  const { slug, affiliateId } = useParams<{ slug: string; affiliateId: string }>();
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
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    email: '',
    commission_percent: 0,
  });

  // Fetch affiliate data
  const { data: affiliate, isLoading: affiliateLoading } = useQuery({
    queryKey: ['affiliate', affiliateId],
    queryFn: async () => {
      // First get the affiliate
      const { data: affData, error: affError } = await (supabase as any)
        .from('affiliates')
        .select('*')
        .eq('id', affiliateId)
        .single();

      if (affError) throw affError;

      // If it's a cambista, fetch parent manager separately
      if (affData.parent_affiliate_id) {
        const { data: parentData } = await (supabase as any)
          .from('affiliates')
          .select('id, name')
          .eq('id', affData.parent_affiliate_id)
          .single();
        
        return { ...affData, parent: parentData };
      }

      return affData;
    },
    enabled: !!affiliateId,
  });

  // Fetch commissions for this affiliate
  const { data: commissions = [], isLoading: commissionsLoading } = useQuery({
    queryKey: ['affiliate-commissions', affiliateId, dateRange],
    queryFn: async () => {
      const isManager = affiliate?.type === 'manager';
      const column = isManager ? 'manager_id' : 'cambista_id';

      const { data, error } = await (supabase as any)
        .from('affiliate_commissions')
        .select(`
          *,
          raffle:raffles(name),
          payment:payments(status)
        `)
        .eq(column, affiliateId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!affiliateId && !!affiliate,
  });

  // Fetch recent sales (tickets with this affiliate)
  const { data: recentSales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['affiliate-sales', affiliateId, dateRange],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('tickets')
        .select(`
          *,
          raffle:raffles(name, ticket_price),
          player:players(name, cpf_last4),
          payment:payments(amount, status, created_at)
        `)
        .eq('affiliate_id', affiliateId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!affiliateId,
  });

  // Calculate stats
  const stats = useMemo(() => {
    const isManager = affiliate?.type === 'manager';
    const amountField = isManager ? 'manager_net_amount' : 'cambista_amount';

    const totalGenerated = commissions.reduce((sum: number, c: any) => 
      sum + (Number(c[amountField]) || 0), 0
    );

    const paidCommissions = commissions.filter((c: any) => 
      c.payment?.status === 'succeeded'
    );
    const totalPaid = paidCommissions.reduce((sum: number, c: any) => 
      sum + (Number(c[amountField]) || 0), 0
    );

    const pendingCommissions = commissions.filter((c: any) => 
      c.payment?.status !== 'succeeded'
    );
    const totalPending = pendingCommissions.reduce((sum: number, c: any) => 
      sum + (Number(c[amountField]) || 0), 0
    );

    const totalSales = recentSales.length;

    return {
      totalGenerated,
      totalPaid,
      totalPending,
      totalSales,
      paidCount: paidCommissions.length,
      pendingCount: pendingCommissions.length,
    };
  }, [commissions, recentSales, affiliate]);

  // Apenas comissões com pagamento aprovado entram no histórico
  const commissionsApproved = useMemo(
    () => (commissions || []).filter((c: any) => c.payment?.status === 'succeeded'),
    [commissions]
  );

  // Get cambistas if this is a manager
  const cambistas = useMemo(() => {
    if (affiliate?.type !== 'manager' || !company?.id) return [];
    return getCambistas(affiliate.id);
  }, [affiliate, company, getCambistas]);

  // Start edit mode
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

  // Save changes
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
          toast({
            title: 'Dados atualizados',
            description: 'As informações foram salvas com sucesso.',
          });
        },
      }
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Commission table columns
  const commissionColumns: Column<any>[] = [
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
        const amount = affiliate?.type === 'manager' 
          ? item.manager_net_amount 
          : item.cambista_amount;
        return <span className="font-medium text-primary">{formatCurrency(Number(amount) || 0)}</span>;
      },
    },
    {
      key: 'status',
      header: 'Status do pagamento',
      render: (item) => {
        const status = item.payment?.status;
        const label = status === 'succeeded' ? 'Aprovado' : status === 'pending' || status === 'processing' ? 'Pendente' : status || '—';
        return (
          <Badge variant={status === 'succeeded' ? 'default' : 'secondary'}>
            {label}
          </Badge>
        );
      },
    },
  ];

  // Sales table columns
  const salesColumns: Column<any>[] = [
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
      key: 'player',
      header: 'Jogador',
      render: (item) => (
        <div>
          <div>{item.player?.name}</div>
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
  ];

  if (affiliateLoading) {
    return <LoadingState fullScreen message="Carregando afiliado..." />;
  }

  if (!affiliate) {
    return (
      <EmpresaLayout title="Afiliado não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground">O afiliado solicitado não foi encontrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </EmpresaLayout>
    );
  }

  const isManager = affiliate.type === 'manager';

  return (
    <EmpresaLayout
      title={affiliate.name}
      description={isManager ? 'Detalhes do Gerente' : 'Detalhes do Operador'}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(`/empresa/${slug}/afiliados`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Afiliados
          </Button>
          {!editMode && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setResetPasswordOpen(true)}>
                <KeyRound className="h-4 w-4 mr-2" />
                Resetar Senha
              </Button>
              <Button onClick={handleStartEdit}>
                Editar Perfil
              </Button>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {affiliate.name}
                    <Badge variant={affiliate.is_active ? 'default' : 'secondary'}>
                      {affiliate.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {isManager ? 'Gerente' : 'Operador'}
                    {!isManager && affiliate.parent && (
                      <> • Gerente: {affiliate.parent.name}</>
                    )}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={editData.phone}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editData.email}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission">
                    Comissão (%) {!isManager && '- sobre o valor do gerente'}
                  </Label>
                  <Input
                    id="commission"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={editData.commission_percent}
                    onChange={(e) => 
                      setEditData({ ...editData, commission_percent: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="md:col-span-2 flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setEditMode(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={updateAffiliate.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Link do afiliado - URL que ele compartilha */}
                {affiliate.link_code && slug && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Link2 className="h-4 w-4" />
                      Link do afiliado (URL para compartilhar)
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="flex-1 min-w-0 text-sm bg-background px-3 py-2 rounded border break-all">
                        {typeof window !== 'undefined' ? `${window.location.origin}/empresa/${slug}?ref=${affiliate.link_code}` : `/empresa/${slug}?ref=${affiliate.link_code}`}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = `${window.location.origin}/empresa/${slug}?ref=${affiliate.link_code}`;
                          navigator.clipboard.writeText(url);
                          toast({ title: 'Link copiado!', description: 'URL copiada para a área de transferência.' });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar
                      </Button>
                    </div>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{affiliate.phone || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{affiliate.email || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {affiliate.commission_percent}%
                      {!isManager && ' sobre o gerente'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Desde {format(new Date(affiliate.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Date Range Filter */}
        <DateRangeFilter
          from={dateRange.from}
          to={dateRange.to}
          onChange={(range) => setDateRange({ from: range.from!, to: range.to! })}
        />

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            title="Total Gerado"
            value={formatCurrency(stats.totalGenerated)}
            icon={TrendingUp}
            description={`${commissions.length} comissões no período`}
          />
          <StatsCard
            title="Total Pago"
            value={formatCurrency(stats.totalPaid)}
            icon={CheckCircle}
            description={`${stats.paidCount} pagamentos confirmados`}
          />
          <StatsCard
            title="Pendente"
            value={formatCurrency(stats.totalPending)}
            icon={XCircle}
            description={`${stats.pendingCount} aguardando`}
          />
          <StatsCard
            title="Vendas"
            value={stats.totalSales.toString()}
            icon={DollarSign}
            description="Cartelas vendidas"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="commissions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="commissions">Histórico de Comissões</TabsTrigger>
            <TabsTrigger value="sales">Últimas Vendas</TabsTrigger>
            {isManager && <TabsTrigger value="cambistas">Cambistas ({cambistas.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="commissions">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Comissões</CardTitle>
                <CardDescription>
                  Apenas comissões com pagamento aprovado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={commissionsApproved}
                  columns={commissionColumns}
                  loading={commissionsLoading}
                  emptyMessage="Nenhuma comissão com pagamento aprovado no período"
                  pageSize={15}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle>Últimas Vendas</CardTitle>
                <CardDescription>
                  Cartelas vendidas por este afiliado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={recentSales}
                  columns={salesColumns}
                  loading={salesLoading}
                  emptyMessage="Nenhuma venda encontrada no período"
                  pageSize={15}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {isManager && (
            <TabsContent value="cambistas">
              <Card>
                <CardHeader>
                  <CardTitle>Cambistas</CardTitle>
                  <CardDescription>
                    Cambistas vinculados a este gerente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {cambistas.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhum cambista cadastrado para este gerente.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {cambistas.map((cambista: any) => (
                        <Link
                          key={cambista.id}
                          to={`/empresa/${slug}/afiliados/${cambista.id}`}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                              <Users className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="font-medium">{cambista.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {cambista.commission_percent}% sobre sua comissão
                              </div>
                            </div>
                          </div>
                          <Badge variant={cambista.is_active ? 'default' : 'secondary'}>
                            {cambista.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <ResetPasswordDialog
          open={resetPasswordOpen}
          onOpenChange={setResetPasswordOpen}
          affiliate={affiliate}
          companySlug={slug || ''}
        />
      </div>
    </EmpresaLayout>
  );
}
