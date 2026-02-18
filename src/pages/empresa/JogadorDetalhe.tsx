import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { useTenant } from '@/contexts/TenantContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  User,
  Calendar,
  MapPin,
  Phone,
  CreditCard,
  Ticket,
  Trophy,
  ShieldAlert,
  ShieldCheck,
  Save,
  DollarSign,
  Hash,
  Filter,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getDisplayCpf } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type Player = Database['public']['Tables']['players']['Row'];
type TicketRow = Database['public']['Tables']['tickets']['Row'] & {
  raffle?: { id: string; name: string; status: string } | null;
  ticket_numbers?: { number: number }[];
};
type PaymentRow = Database['public']['Tables']['payments']['Row'] & {
  raffle?: { id: string; name: string } | null;
};

export default function JogadorDetalhe() {
  const { slug, playerId } = useParams<{ slug: string; playerId: string }>();
  const navigate = useNavigate();
  const { company, setCompanySlug } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  // Filtros do financeiro
  const [filterRaffleId, setFilterRaffleId] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Fetch player
  const { data: player, isLoading: playerLoading } = useQuery({
    queryKey: ['player', playerId, company?.id],
    enabled: !!playerId && !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId!)
        .eq('company_id', company!.id)
        .is('deleted_at', null)
        .single();
      if (error) throw error;
      return data as Player;
    },
  });

  // Fetch all tickets (including pending_payment) with numbers and raffle
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['player-tickets-detail', playerId, company?.id],
    enabled: !!playerId && !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          raffle:raffles(id, name, status),
          ticket_numbers(number)
        `)
        .eq('player_id', playerId!)
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as TicketRow[];
    },
  });

  // Fetch payments
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['player-payments-detail', playerId, company?.id],
    enabled: !!playerId && !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          raffle:raffles(id, name)
        `)
        .eq('player_id', playerId!)
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PaymentRow[];
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('players')
        .update({
          name: editName.trim(),
          city: editCity.trim() || null,
          phone: editPhone.trim() || null,
        })
        .eq('id', playerId!)
        .eq('company_id', company!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player', playerId] });
      queryClient.invalidateQueries({ queryKey: ['company-players', company?.id] });
      setEditMode(false);
      toast({ title: 'Perfil atualizado' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erro', description: e.message }),
  });

  const blockMutation = useMutation({
    mutationFn: async ({ block, reason }: { block: boolean; reason?: string }) => {
      const { error } = await supabase
        .from('players')
        .update({
          status: block ? 'blocked' : 'active',
          blocked_at: block ? new Date().toISOString() : null,
          blocked_reason: block ? reason : null,
        })
        .eq('id', playerId!)
        .eq('company_id', company!.id);
      if (error) throw error;
    },
    onSuccess: (_, { block }) => {
      queryClient.invalidateQueries({ queryKey: ['player', playerId] });
      queryClient.invalidateQueries({ queryKey: ['company-players', company?.id] });
      setBlockDialogOpen(false);
      toast({ title: block ? 'Jogador bloqueado' : 'Jogador desbloqueado' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erro', description: e.message }),
  });

  const startEdit = () => {
    if (player) {
      setEditName(player.name || '');
      setEditCity(player.city || '');
      setEditPhone(player.phone || '');
      setEditMode(true);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const totalPago = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPendente = payments
    .filter((p) => p.status === 'pending' || p.status === 'processing')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const activeTickets = tickets.filter((t) => t.status === 'active');
  const pendingTickets = tickets.filter((t) => t.status === 'pending_payment');
  const winnerTickets = tickets.filter((t) => t.status === 'winner');

  // Sorteios únicos dos pagamentos (para filtro)
  const uniqueRaffles = useMemo(() => {
    const byId = new Map<string, string>();
    (payments || []).forEach((p) => {
      if (p.raffle_id && (p as PaymentRow).raffle?.name) {
        byId.set(p.raffle_id, (p as PaymentRow).raffle!.name);
      }
    });
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [payments]);

  // Pagamentos filtrados (sorteio, data, status)
  const filteredPayments = useMemo(() => {
    let list = [...(payments || [])];
    if (filterRaffleId) {
      list = list.filter((p) => p.raffle_id === filterRaffleId);
    }
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      from.setHours(0, 0, 0, 0);
      list = list.filter((p) => new Date(p.created_at) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((p) => new Date(p.created_at) <= to);
    }
    if (filterStatus) {
      if (filterStatus === 'succeeded') list = list.filter((p) => p.status === 'succeeded');
      else if (filterStatus === 'pending') list = list.filter((p) => p.status === 'pending' || p.status === 'processing');
      else list = list.filter((p) => p.status === filterStatus);
    }
    return list;
  }, [payments, filterRaffleId, filterDateFrom, filterDateTo, filterStatus]);

  const filteredTotalPago = filteredPayments
    .filter((p) => p.status === 'succeeded')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const filteredTotalPendente = filteredPayments
    .filter((p) => p.status === 'pending' || p.status === 'processing')
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const clearFinanceFilters = () => {
    setFilterRaffleId('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterStatus('');
  };
  const hasActiveFilters = filterRaffleId || filterDateFrom || filterDateTo || filterStatus;

  useEffect(() => {
    if (slug) setCompanySlug(slug);
  }, [slug, setCompanySlug]);

  if (playerLoading || !company) {
    return <LoadingState fullScreen message="Carregando..." />;
  }
  if (!player) {
    return (
      <EmpresaLayout title="Jogador não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Jogador não encontrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(`/empresa/${slug}/jogadores`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Jogadores
          </Button>
        </div>
      </EmpresaLayout>
    );
  }

  return (
    <EmpresaLayout title={player.name} description="Perfil completo do jogador">
      <div className="space-y-6">
        {/* Header: voltar + avatar + nome + status | ações */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => navigate(`/empresa/${slug}/jogadores`)} title="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{player.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={player.status === 'blocked' ? 'destructive' : 'default'}>
                  {player.status === 'blocked' ? 'Bloqueado' : 'Ativo'}
                </Badge>
                {player.blocked_reason && (
                  <span className="text-xs text-muted-foreground">({player.blocked_reason})</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!editMode && (
              <>
                <Button
                  variant={player.status === 'blocked' ? 'default' : 'destructive'}
                  size="sm"
                  onClick={() =>
                    player.status === 'blocked'
                      ? blockMutation.mutate({ block: false })
                      : setBlockDialogOpen(true)
                  }
                >
                  {player.status === 'blocked' ? (
                    <><ShieldCheck className="h-4 w-4 mr-2" />Desbloquear</>
                  ) : (
                    <><ShieldAlert className="h-4 w-4 mr-2" />Bloquear</>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={startEdit}>
                  Editar perfil
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Conteúdo em Tabs (padrão de layout) */}
        <Card>
          <Tabs defaultValue="perfil" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto flex-wrap gap-1 p-2 bg-muted/50">
              <TabsTrigger value="perfil" className="gap-2 data-[state=active]:bg-background">
                <User className="h-4 w-4 shrink-0" />
                Perfil
              </TabsTrigger>
              <TabsTrigger value="financeiro" className="gap-2 data-[state=active]:bg-background">
                <CreditCard className="h-4 w-4 shrink-0" />
                Financeiro
                {payments.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{payments.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="cartelas" className="gap-2 data-[state=active]:bg-background">
                <Ticket className="h-4 w-4 shrink-0" />
                Cartelas
                {tickets.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{tickets.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="premios" className="gap-2 data-[state=active]:bg-background">
                <Trophy className="h-4 w-4 shrink-0" />
                Prêmios
                {winnerTickets.length > 0 && (
                  <Badge variant="default" className="ml-1 h-5 px-1.5 text-xs">{winnerTickets.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="mt-0 p-6 pt-4">
              {editMode ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nome</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <p className="text-sm text-muted-foreground py-2 border rounded-md px-3 bg-muted/30">
                        {getDisplayCpf({ cpf_encrypted: (player as any).cpf_encrypted, cpf_last4: player.cpf_last4 }) || `***.***.***-${player.cpf_last4}`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => updateProfileMutation.mutateAsync()} disabled={updateProfileMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar
                    </Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/20">
                    <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Data do cadastro</p>
                      <p className="font-medium">{format(new Date(player.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/20">
                    <Hash className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">CPF</p>
                      <p className="font-medium font-mono">
                        {getDisplayCpf({ cpf_encrypted: (player as any).cpf_encrypted, cpf_last4: player.cpf_last4 }) || `***.***.***-${player.cpf_last4}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/20">
                    <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Cidade</p>
                      <p className="font-medium">{player.city || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/20">
                    <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Telefone</p>
                      <p className="font-medium">{player.phone || '—'}</p>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="financeiro" className="mt-0 p-6 pt-4">
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Filter className="h-4 w-4" />
                  <span className="text-sm font-medium">Filtros</span>
                </div>
                <Select value={filterRaffleId || 'all'} onValueChange={(v) => setFilterRaffleId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sorteio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os sorteios</SelectItem>
                    {uniqueRaffles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">De</Label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-[140px]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Até</Label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-[140px]"
                  />
                </div>
                <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="succeeded">Aprovado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFinanceFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 mb-6">
                <div className="p-5 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 text-primary mb-1">
                    <DollarSign className="h-5 w-5" />
                    <span className="text-sm font-medium">Total pago</span>
                    {hasActiveFilters && <span className="text-xs text-muted-foreground">(filtrado)</span>}
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(hasActiveFilters ? filteredTotalPago : totalPago)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{filteredPayments.filter((p) => p.status === 'succeeded').length} pagamento(s)</p>
                </div>
                <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                    <CreditCard className="h-5 w-5" />
                    <span className="text-sm font-medium">Pendente</span>
                    {hasActiveFilters && <span className="text-xs text-muted-foreground">(filtrado)</span>}
                  </div>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(hasActiveFilters ? filteredTotalPendente : totalPendente)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{filteredPayments.filter((p) => p.status === 'pending' || p.status === 'processing').length} pagamento(s)</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Sorteio</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                        {hasActiveFilters ? 'Nenhum pagamento encontrado com os filtros aplicados' : 'Nenhum pagamento registrado'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">{format(new Date(p.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                        <TableCell className="font-medium">{p.raffle?.name || '—'}</TableCell>
                        <TableCell>{formatCurrency(Number(p.amount || 0))}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'succeeded' ? 'default' : 'secondary'}>
                            {p.status === 'succeeded' ? 'Aprovado' : p.status === 'pending' || p.status === 'processing' ? 'Pendente' : p.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="cartelas" className="mt-0 p-6 pt-4">
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">Todas ({tickets.length})</TabsTrigger>
                  <TabsTrigger value="active">Ativas ({activeTickets.length})</TabsTrigger>
                  <TabsTrigger value="pending">Não pagas ({pendingTickets.length})</TabsTrigger>
                  <TabsTrigger value="winner">Ganhadoras ({winnerTickets.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-0">
                  <TicketTable tickets={tickets} formatDate={(d) => format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR })} />
                </TabsContent>
                <TabsContent value="active" className="mt-0">
                  <TicketTable tickets={activeTickets} formatDate={(d) => format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR })} />
                </TabsContent>
                <TabsContent value="pending" className="mt-0">
                  <TicketTable tickets={pendingTickets} formatDate={(d) => format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR })} />
                </TabsContent>
                <TabsContent value="winner" className="mt-0">
                  <TicketTable tickets={winnerTickets} formatDate={(d) => format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR })} />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="premios" className="mt-0 p-6 pt-4">
              {winnerTickets.length === 0 ? (
                <div className="text-center py-16 rounded-xl border border-dashed bg-muted/20">
                  <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="font-medium text-muted-foreground">Nenhum prêmio recebido ainda</p>
                  <p className="text-sm text-muted-foreground mt-1">As cartelas ganhadoras aparecerão aqui após a apuração dos sorteios.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sorteio</TableHead>
                      <TableHead>Números da cartela</TableHead>
                      <TableHead>Faixas de prêmio</TableHead>
                      <TableHead>Data da compra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {winnerTickets.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.raffle?.name || '—'}</TableCell>
                        <TableCell>
                          <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                            {(t.ticket_numbers || []).map((n) => n.number).sort((a, b) => a - b).join(', ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          {(t.eligible_prize_tiers || []).length > 0
                            ? `${(t.eligible_prize_tiers || []).length} faixa(s)`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.purchased_at ? format(new Date(t.purchased_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <ConfirmDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        title="Bloquear jogador"
        description={`Tem certeza que deseja bloquear "${player.name}"? O jogador não poderá mais participar dos sorteios.`}
        confirmLabel="Bloquear"
        variant="destructive"
        onConfirm={() => blockMutation.mutate({ block: true, reason: 'Bloqueado pelo administrador' })}
        loading={blockMutation.isPending}
      />
    </EmpresaLayout>
  );
}

function TicketTable({
  tickets,
  formatDate,
}: {
  tickets: TicketRow[];
  formatDate: (d: Date) => string;
}) {
  if (tickets.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhuma cartela nesta lista.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sorteio</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Números</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((t) => (
          <TableRow key={t.id}>
            <TableCell className="font-medium">{t.raffle?.name || '—'}</TableCell>
            <TableCell>
              <Badge
                variant={
                  t.status === 'winner'
                    ? 'default'
                    : t.status === 'active'
                      ? 'secondary'
                      : t.status === 'pending_payment'
                        ? 'outline'
                        : 'outline'
                }
              >
                {t.status === 'winner' ? 'Ganhadora' : t.status === 'active' ? 'Ativa' : t.status === 'pending_payment' ? 'Pendente pagamento' : t.status}
              </Badge>
            </TableCell>
            <TableCell className="font-mono text-sm">
              {(t.ticket_numbers || []).map((n) => n.number).sort((a, b) => a - b).join(', ')}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {t.purchased_at ? formatDate(new Date(t.purchased_at)) : t.created_at ? formatDate(new Date(t.created_at)) : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
