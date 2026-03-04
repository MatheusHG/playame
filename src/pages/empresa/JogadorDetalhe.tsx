import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { useTenant } from '@/contexts/TenantContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  Star,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getDisplayCpf } from '@/lib/utils';
import type { Player, Ticket as TicketType, Payment } from '@/types/database.types';

type TicketRow = TicketType & {
  raffle?: { id: string; name: string; status: string; current_draw_count?: number } | null;
  ticket_numbers?: { number: number }[];
};
type PaymentRow = Payment & {
  raffle?: { id: string; name: string } | null;
};

export default function JogadorDetalhe() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const { company } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [filterRaffleId, setFilterRaffleId] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const { data: player, isLoading: playerLoading } = useQuery({
    queryKey: ['player', playerId, company?.id],
    enabled: !!playerId && !!company?.id,
    queryFn: () => api.get<Player>(`/companies/${company!.id}/players/${playerId}`),
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['player-tickets-detail', playerId, company?.id],
    enabled: !!playerId && !!company?.id,
    queryFn: () => api.get<TicketRow[]>(`/companies/${company!.id}/players/${playerId}/tickets`),
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['player-payments-detail', playerId, company?.id],
    enabled: !!playerId && !!company?.id,
    queryFn: () => api.get<PaymentRow[]>(`/companies/${company!.id}/players/${playerId}/payments`),
  });

  const updateProfileMutation = useMutation({
    mutationFn: () => api.patch(`/players/${playerId}`, {
      name: editName.trim(),
      city: editCity.trim() || null,
      phone: editPhone.trim() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player', playerId] });
      queryClient.invalidateQueries({ queryKey: ['company-players', company?.id] });
      setEditMode(false);
      toast({ title: 'Perfil atualizado' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Erro', description: e.message }),
  });

  const blockMutation = useMutation({
    mutationFn: ({ block, reason }: { block: boolean; reason?: string }) =>
      api.patch(`/players/${playerId}`, {
        status: block ? 'blocked' : 'active',
        blocked_at: block ? new Date().toISOString() : null,
        blocked_reason: block ? reason : null,
      }),
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

  const totalPago = payments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPendente = payments.filter((p) => p.status === 'pending' || p.status === 'processing').reduce((s, p) => s + Number(p.amount || 0), 0);
  const activeTickets = tickets.filter((t) => t.status === 'active');
  const pendingTickets = tickets.filter((t) => t.status === 'pending_payment');
  const winnerTickets = tickets.filter((t) => t.status === 'winner');

  const uniqueRaffles = useMemo(() => {
    const byId = new Map<string, string>();
    payments.forEach((p) => {
      if (p.raffle_id && (p as PaymentRow).raffle?.name) byId.set(p.raffle_id, (p as PaymentRow).raffle!.name);
    });
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [payments]);

  const filteredPayments = useMemo(() => {
    let list = [...(payments || [])];
    if (filterRaffleId) list = list.filter((p) => p.raffle_id === filterRaffleId);
    if (filterDateFrom) {
      const from = new Date(filterDateFrom); from.setHours(0, 0, 0, 0);
      list = list.filter((p) => new Date(p.created_at) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo); to.setHours(23, 59, 59, 999);
      list = list.filter((p) => new Date(p.created_at) <= to);
    }
    if (filterStatus) {
      if (filterStatus === 'succeeded') list = list.filter((p) => p.status === 'succeeded');
      else if (filterStatus === 'pending') list = list.filter((p) => p.status === 'pending' || p.status === 'processing');
      else list = list.filter((p) => p.status === filterStatus);
    }
    return list;
  }, [payments, filterRaffleId, filterDateFrom, filterDateTo, filterStatus]);

  const filteredTotalPago = filteredPayments.filter((p) => p.status === 'succeeded').reduce((s, p) => s + Number(p.amount || 0), 0);
  const filteredTotalPendente = filteredPayments.filter((p) => p.status === 'pending' || p.status === 'processing').reduce((s, p) => s + Number(p.amount || 0), 0);

  const clearFinanceFilters = () => { setFilterRaffleId(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterStatus(''); };
  const hasActiveFilters = filterRaffleId || filterDateFrom || filterDateTo || filterStatus;

  if (playerLoading || !company) return <LoadingState fullScreen message="Carregando..." />;
  if (!player) {
    return (
      <EmpresaLayout title="Jogador não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Jogador não encontrado.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/jogadores')}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar para Jogadores
          </Button>
        </div>
      </EmpresaLayout>
    );
  }

  const cpfDisplay = getDisplayCpf({ cpf_encrypted: (player as any).cpf_encrypted, cpf_last4: player.cpf_last4 })
    || ((player as any).cpf_encrypted ? `***.***.***-${player.cpf_last4}` : 'Venda de rua');

  return (
    <EmpresaLayout title={player.name} description="Perfil completo do jogador">
      <div className="space-y-5">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/jogadores')}>
          <ArrowLeft className="h-4 w-4 mr-2" />Voltar para Jogadores
        </Button>

        {/* Profile Header */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: player.status === 'blocked' ? '#FEE2E2' : '#DBEAFE' }}>
                  <User className="h-8 w-8" style={{ color: player.status === 'blocked' ? '#DC2626' : '#2563EB' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight">{player.name}</h2>
                    <Badge variant={player.status === 'blocked' ? 'destructive' : 'default'}>
                      {player.status === 'blocked' ? 'Bloqueado' : 'Ativo'}
                    </Badge>
                  </div>
                  {player.blocked_reason && (
                    <p className="text-xs text-destructive mt-1">Motivo: {player.blocked_reason}</p>
                  )}
                  <p className="text-sm text-muted-foreground mt-0.5 font-mono">{cpfDisplay}</p>
                </div>
              </div>
              {!editMode && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant={player.status === 'blocked' ? 'default' : 'destructive'}
                    size="sm"
                    onClick={() => player.status === 'blocked' ? blockMutation.mutate({ block: false }) : setBlockDialogOpen(true)}
                  >
                    {player.status === 'blocked'
                      ? <><ShieldCheck className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Desbloquear</span></>
                      : <><ShieldAlert className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Bloquear</span></>
                    }
                  </Button>
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    <span className="hidden sm:inline">Editar perfil</span>
                    <span className="sm:hidden">Editar</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Info Row */}
          <div className="border-t bg-muted/30 px-5 sm:px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoItem icon={Calendar} bg="#FEF3C7" color="#D97706" label="Cadastro" value={format(new Date(player.created_at), 'dd/MM/yyyy', { locale: ptBR })} />
              <InfoItem icon={Hash} bg="#EDE9FE" color="#7C3AED" label="CPF" value={cpfDisplay} />
              <InfoItem icon={MapPin} bg="#DCFCE7" color="#16A34A" label="Cidade" value={player.city || '—'} />
              <InfoItem icon={Phone} bg="#DBEAFE" color="#2563EB" label="Telefone" value={player.phone || '—'} />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard icon={DollarSign} bg="#DCFCE7" color="#16A34A" label="Total gasto" value={formatCurrency(totalPago)} sub={`${payments.filter(p => p.status === 'succeeded').length} pagamentos`} />
          <StatCard icon={Ticket} bg="#DBEAFE" color="#2563EB" label="Cartelas ativas" value={String(activeTickets.length)} sub={`${pendingTickets.length} pendentes`} />
          <StatCard icon={CreditCard} bg="#FEF3C7" color="#D97706" label="Pendente" value={formatCurrency(totalPendente)} sub="aguardando pagamento" />
          <StatCard icon={Trophy} bg="#EDE9FE" color="#7C3AED" label="Prêmios" value={String(winnerTickets.length)} sub={winnerTickets.length > 0 ? 'cartela(s) ganhadora(s)' : 'nenhum prêmio'} />
        </div>

        {/* Tabs */}
        <Card className="rounded-2xl overflow-hidden">
          <Tabs defaultValue="perfil" className="w-full">
            <div className="bg-muted/30 px-4 pt-3 overflow-x-auto">
              <TabsList className="bg-transparent h-auto p-0 gap-1">
                <TabsTrigger value="perfil" className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0">
                  <User className="w-4 h-4" />Perfil
                </TabsTrigger>
                <TabsTrigger value="financeiro" className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0">
                  <CreditCard className="w-4 h-4" />
                  <span className="hidden sm:inline">Financeiro</span><span className="sm:hidden">Fin.</span>
                  {payments.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{payments.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="cartelas" className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0">
                  <Ticket className="w-4 h-4" />
                  <span className="hidden sm:inline">Cartelas</span><span className="sm:hidden">Cart.</span>
                  {tickets.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{tickets.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="premios" className="rounded-t-xl rounded-b-none gap-2 px-4 py-2.5 data-[state=active]:bg-card data-[state=active]:shadow-sm flex-shrink-0">
                  <Trophy className="w-4 h-4" />
                  <span className="hidden sm:inline">Prêmios</span>
                  {winnerTickets.length > 0 && <Badge className="ml-1 h-5 px-1.5 text-xs">{winnerTickets.length}</Badge>}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Perfil Tab */}
            <TabsContent value="perfil" className="mt-0 p-5">
              {editMode ? (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</Label>
                      <Input className="rounded-xl" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CPF</Label>
                      <p className="text-sm text-muted-foreground py-2 border rounded-xl px-3 bg-muted/30">{cpfDisplay}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cidade</Label>
                      <Input className="rounded-xl" value={editCity} onChange={(e) => setEditCity(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Telefone</Label>
                      <Input className="rounded-xl" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => updateProfileMutation.mutateAsync()} disabled={updateProfileMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />Salvar
                    </Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <InfoCard icon={Calendar} bg="#FEF3C7" color="#D97706" label="Data do cadastro"
                    value={format(new Date(player.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} />
                  <InfoCard icon={Hash} bg="#EDE9FE" color="#7C3AED" label="CPF" value={cpfDisplay} mono />
                  <InfoCard icon={MapPin} bg="#DCFCE7" color="#16A34A" label="Cidade" value={player.city || '—'} />
                  <InfoCard icon={Phone} bg="#DBEAFE" color="#2563EB" label="Telefone" value={player.phone || '—'} />
                </div>
              )}
            </TabsContent>

            {/* Financeiro Tab */}
            <TabsContent value="financeiro" className="mt-0 p-5">
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Filter className="h-4 w-4" /><span className="text-sm font-medium">Filtros</span>
                </div>
                <Select value={filterRaffleId || 'all'} onValueChange={(v) => setFilterRaffleId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Sorteio" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os sorteios</SelectItem>
                    {uniqueRaffles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">De</Label>
                  <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full sm:w-[140px]" />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">Até</Label>
                  <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full sm:w-[140px]" />
                </div>
                <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="succeeded">Aprovado</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="processing">Processando</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFinanceFilters}><X className="h-4 w-4 mr-1" />Limpar</Button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 mb-5">
                <div className="p-4 rounded-xl border" style={{ backgroundColor: 'rgba(22, 163, 74, 0.05)', borderColor: 'rgba(22, 163, 74, 0.2)' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: '#16A34A' }}>
                    <DollarSign className="h-4 w-4" /><span className="text-sm font-medium">Total pago</span>
                    {hasActiveFilters && <span className="text-xs text-muted-foreground">(filtrado)</span>}
                  </div>
                  <p className="text-2xl font-bold">{formatCurrency(hasActiveFilters ? filteredTotalPago : totalPago)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{filteredPayments.filter((p) => p.status === 'succeeded').length} pagamento(s)</p>
                </div>
                <div className="p-4 rounded-xl border" style={{ backgroundColor: 'rgba(217, 119, 6, 0.05)', borderColor: 'rgba(217, 119, 6, 0.2)' }}>
                  <div className="flex items-center gap-2 mb-1" style={{ color: '#D97706' }}>
                    <CreditCard className="h-4 w-4" /><span className="text-sm font-medium">Pendente</span>
                    {hasActiveFilters && <span className="text-xs text-muted-foreground">(filtrado)</span>}
                  </div>
                  <p className="text-2xl font-bold" style={{ color: '#D97706' }}>{formatCurrency(hasActiveFilters ? filteredTotalPendente : totalPendente)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{filteredPayments.filter((p) => p.status === 'pending' || p.status === 'processing').length} pagamento(s)</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Sorteio</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          {hasActiveFilters ? 'Nenhum pagamento encontrado com os filtros' : 'Nenhum pagamento registrado'}
                        </TableCell>
                      </TableRow>
                    ) : filteredPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{p.id.slice(0, 8).toUpperCase()}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{format(new Date(p.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                        <TableCell className="font-medium">{p.raffle?.name || '—'}</TableCell>
                        <TableCell>{formatCurrency(Number(p.amount || 0))}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'succeeded' ? 'default' : 'secondary'}>
                            {p.status === 'succeeded' ? 'Aprovado' : p.status === 'pending' || p.status === 'processing' ? 'Pendente' : p.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Cartelas Tab */}
            <TabsContent value="cartelas" className="mt-0 p-5">
              <Tabs defaultValue="all" className="w-full">
                <TabsList className="mb-4 flex-wrap h-auto gap-1">
                  <TabsTrigger value="all">Todas ({tickets.length})</TabsTrigger>
                  <TabsTrigger value="active">Ativas ({activeTickets.length})</TabsTrigger>
                  <TabsTrigger value="pending">Pendentes ({pendingTickets.length})</TabsTrigger>
                  <TabsTrigger value="winner">Ganhadoras ({winnerTickets.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="mt-0"><TicketTable tickets={tickets} /></TabsContent>
                <TabsContent value="active" className="mt-0"><TicketTable tickets={activeTickets} /></TabsContent>
                <TabsContent value="pending" className="mt-0"><TicketTable tickets={pendingTickets} /></TabsContent>
                <TabsContent value="winner" className="mt-0"><TicketTable tickets={winnerTickets} /></TabsContent>
              </Tabs>
            </TabsContent>

            {/* Premios Tab */}
            <TabsContent value="premios" className="mt-0 p-5">
              {winnerTickets.length === 0 ? (
                <div className="text-center py-16 rounded-xl border border-dashed bg-muted/20">
                  <Trophy className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="font-medium text-muted-foreground">Nenhum prêmio recebido ainda</p>
                  <p className="text-sm text-muted-foreground mt-1">As cartelas ganhadoras aparecerão aqui após a apuração.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {winnerTickets.map((t) => (
                    <div key={t.id} className="rounded-xl border-2 p-4 relative overflow-hidden"
                      style={{ borderColor: '#D97706', backgroundColor: 'rgba(217, 119, 6, 0.03)' }}>
                      <div className="absolute top-3 right-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: '#FEF3C7' }}>
                          <Star className="h-4 w-4" style={{ color: '#D97706' }} />
                        </div>
                      </div>
                      <div className="pr-12">
                        <p className="font-semibold text-base">{t.raffle?.name || '—'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t.purchased_at ? format(new Date(t.purchased_at), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                        </p>
                      </div>
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Números</p>
                          <div className="flex flex-wrap gap-1">
                            {(t.ticket_numbers || []).map((n) => n.number).sort((a, b) => a - b).map((num) => (
                              <span key={num} className="inline-flex items-center justify-center h-7 min-w-[28px] px-1.5 rounded-md text-xs font-bold font-mono"
                                style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                {String(num).padStart(2, '0')}
                              </span>
                            ))}
                          </div>
                        </div>
                        {(t.eligible_prize_tiers || []).length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Faixas de prêmio</p>
                            <p className="text-sm font-medium" style={{ color: '#D97706' }}>
                              {(t.eligible_prize_tiers || []).length} faixa(s) elegível(eis)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
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

function InfoItem({ icon: Icon, bg, color, label, value }: {
  icon: any; bg: string; color: string; label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="h-3.5 w-3.5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, bg, color, label, value, mono }: {
  icon: any; bg: string; color: string; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border bg-muted/20">
      <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-medium truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

function TicketTable({ tickets }: { tickets: TicketRow[] }) {
  if (tickets.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhuma cartela nesta lista.</p>;
  }
  return (
    <div className="overflow-x-auto">
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
                <Badge variant={t.status === 'winner' ? 'default' : t.status === 'active' ? 'secondary' : 'outline'}>
                  {t.status === 'winner' ? 'Ganhadora' : t.status === 'active' ? 'Ativa' : t.status === 'pending_payment' ? 'Pendente' : t.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {(t.ticket_numbers || []).map((n) => n.number).sort((a, b) => a - b).map((num) => (
                    <span key={num} className="inline-flex items-center justify-center h-6 min-w-[24px] px-1 rounded text-[10px] font-bold font-mono bg-muted">
                      {String(num).padStart(2, '0')}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {t.purchased_at ? format(new Date(t.purchased_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : t.created_at ? format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
