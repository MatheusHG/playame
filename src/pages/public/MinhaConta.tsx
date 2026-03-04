import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { usePlayer } from '@/contexts/PlayerContext';
import { getDisplayCpf } from '@/lib/utils';
import { useTenant } from '@/contexts/TenantContext';
import { ThemedLayout } from '@/components/layouts/ThemedLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  Wallet,
  Ticket,
  Trophy,
  Settings,
  LogOut,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  ExternalLink,
  Loader2,
  MessageCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

export default function MinhaConta() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { player, companyId, isAuthenticated, isLoading: playerLoading, logout, updatePlayer } = usePlayer();
  const { company, loading: tenantLoading } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editName, setEditName] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'bilhetes' | 'transacoes' | 'sorteios' | 'configuracoes'>('bilhetes');
  const [resumingPaymentId, setResumingPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (player) {
      setEditName(player.name || '');
      setEditCity(player.city || '');
      setEditPhone((player as any).phone || '');
    }
  }, [player]);

  useEffect(() => {
    const tab = (searchParams.get('tab') || 'bilhetes').toLowerCase();
    if (tab === 'bilhetes' || tab === 'transacoes' || tab === 'sorteios' || tab === 'configuracoes') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!playerLoading && !isAuthenticated) {
      navigate('/');
    }
  }, [playerLoading, isAuthenticated, navigate]);

  // Fetch player's tickets
  const { data: tickets = [], isLoading: loadingTickets } = useQuery({
    queryKey: ['player-tickets', player?.id],
    enabled: !!player?.id && !!companyId,
    queryFn: async () => {
      const data = await api.playerGet<any[]>(`/players/${player!.id}/tickets`, {
        companyId: companyId!,
        include: 'raffle,ticket_numbers,ranking',
      });
      return data || [];
    },
  });

  // Fetch player's payments
  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['player-payments', player?.id],
    enabled: !!player?.id && !!companyId,
    queryFn: async () => {
      const data = await api.playerGet<any[]>(`/players/${player!.id}/payments`, {
        companyId: companyId!,
        include: 'raffle',
      });
      return data || [];
    },
  });

  // Fetch participated raffles
  const { data: raffles = [], isLoading: loadingRaffles } = useQuery({
    queryKey: ['player-raffles', player?.id],
    enabled: !!player?.id && !!companyId,
    queryFn: async () => {
      // Get unique raffle IDs from tickets
      const raffleIds = [...new Set(tickets.map(t => t.raffle_id))];
      if (raffleIds.length === 0) return [];

      const data = await api.playerGet<any[]>(`/players/${player!.id}/raffles`, {
        raffleIds: raffleIds.join(','),
      });
      return data || [];
    },
  });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'As senhas não coincidem',
      });
      return;
    }

    if (!currentPassword) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Informe sua senha atual',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres',
      });
      return;
    }

    setIsUpdating(true);
    try {
      await api.playerPost('/player-auth/change-password', {
        companyId,
        playerId: player?.id,
        currentPassword,
        newPassword,
      });

      toast({
        title: 'Sucesso',
        description: 'Senha alterada com sucesso',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Não foi possível alterar a senha',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const data = await api.playerPost<any>('/player-auth/update-profile', {
        companyId,
        playerId: player?.id,
        name: editName,
        city: editCity,
        phone: editPhone,
      });

      if (data?.error) throw new Error(data.error);
      return data?.player as any;
    },
    onSuccess: (updated) => {
      updatePlayer({
        name: updated.name,
        city: updated.city,
        phone: updated.phone,
      });
      toast({ title: 'Perfil atualizado!' });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar perfil',
        description: err?.message ?? 'Tente novamente.',
      });
    },
  });

  const handleResumePayment = async (paymentId: string) => {
    if (!player) return;
    setResumingPaymentId(paymentId);
    try {
      const data = await api.playerPost<any>('/stripe/resume', {
        paymentId,
        playerId: player.id,
      });
      if (data.error) throw new Error(data.error);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao retomar pagamento',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
    } finally {
      setResumingPaymentId(null);
    }
  };

  if (tenantLoading || playerLoading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  if (!isAuthenticated || !player) {
    return null;
  }

  const activeTickets = tickets.filter(t => t.status === 'active');
  const closedTickets = tickets.filter(t => t.status !== 'active' && t.status !== 'pending_payment');
  const pendingTickets = tickets.filter(t => t.status === 'pending_payment');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge>Ativo</Badge>;
      case 'winner':
        return <Badge variant="default">Ganhador</Badge>;
      case 'pending_payment':
        return <Badge variant="secondary">Aguardando Pagamento</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <Badge><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Processando</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'refunded':
        return <Badge variant="outline">Reembolsado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <ThemedLayout>
      <div className="container py-8">
        {/* Community Channel Banner - Fixed */}
        {company?.community_url && company?.community_name && (
          <a
            href={company.community_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 mb-6 text-white text-sm font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: company.primary_color || '#3B82F6' }}
          >
            <MessageCircle className="h-4 w-4 shrink-0" />
            <span>
              Participe do nosso canal do <strong>{company.community_name}</strong>!
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </a>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Minha Conta</h1>
            <p className="text-muted-foreground">Olá, {player.name}!</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Bilhetes Ativos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeTickets.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Sorteios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{raffles.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Apostado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                R$ {payments.filter(p => p.status === 'succeeded').reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Pendentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{pendingTickets.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="bilhetes" className="gap-2">
              <Ticket className="h-4 w-4 hidden sm:block" />
              Bilhetes
            </TabsTrigger>
            <TabsTrigger value="transacoes" className="gap-2">
              <Wallet className="h-4 w-4 hidden sm:block" />
              Transações
            </TabsTrigger>
            <TabsTrigger value="sorteios" className="gap-2">
              <Trophy className="h-4 w-4 hidden sm:block" />
              Sorteios
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="gap-2">
              <Settings className="h-4 w-4 hidden sm:block" />
              Config.
            </TabsTrigger>
          </TabsList>

          {/* Bilhetes Tab */}
          <TabsContent value="bilhetes" className="space-y-6">
            {/* Active Tickets */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Bilhetes Ativos ({activeTickets.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTickets ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : activeTickets.length === 0 ? (
                  <p className="text-muted-foreground">Você não possui bilhetes ativos.</p>
                ) : (
                  <div className="space-y-4">
                    {activeTickets.map((ticket) => (
                      <div key={ticket.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold">{(ticket as any).raffle?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Comprado em {format(new Date(ticket.purchased_at || ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                          {getStatusBadge(ticket.status || 'active')}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-muted-foreground">
                          <Badge variant="outline">
                            Acertos: {(ticket as any).ranking?.hits ?? 0}
                          </Badge>
                          <Badge variant="outline">
                            Faltam: {(ticket as any).ranking?.missing ?? '-'}
                          </Badge>
                          {(ticket as any).ranking?.rank_position && (
                            <Badge variant="outline">
                              Rank: {(ticket as any).ranking.rank_position}
                            </Badge>
                          )}
                          {(ticket as any).raffle?.current_draw_count !== null && (
                            <Badge variant="secondary">
                              Rodadas: {(ticket as any).raffle?.current_draw_count ?? 0}
                            </Badge>
                          )}
                          <Button variant="outline" size="sm" asChild className="ml-auto">
                            <Link to={`/sorteio/${(ticket as any).raffle?.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Acompanhar
                            </Link>
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {((ticket as any).ticket_numbers || []).map((tn: any) => (
                            <Badge key={tn.number} variant="outline" className="font-mono">
                              {String(tn.number).padStart(2, '0')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Closed Tickets */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  Bilhetes Encerrados ({closedTickets.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {closedTickets.length === 0 ? (
                  <p className="text-muted-foreground">Nenhum bilhete encerrado.</p>
                ) : (
                  <div className="space-y-4">
                    {closedTickets.map((ticket) => (
                      <div key={ticket.id} className="border rounded-lg p-4 opacity-75">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-semibold">{(ticket as any).raffle?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(ticket.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                          </div>
                          {getStatusBadge(ticket.status || '')}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-muted-foreground">
                          <Badge variant="outline">
                            Acertos: {(ticket as any).ranking?.hits ?? 0}
                          </Badge>
                          <Badge variant="outline">
                            Faltam: {(ticket as any).ranking?.missing ?? '-'}
                          </Badge>
                          {(ticket as any).ranking?.rank_position && (
                            <Badge variant="outline">
                              Rank: {(ticket as any).ranking.rank_position}
                            </Badge>
                          )}
                          <Button variant="outline" size="sm" asChild className="ml-auto">
                            <Link to={`/sorteio/${(ticket as any).raffle?.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver sorteio
                            </Link>
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {((ticket as any).ticket_numbers || []).map((tn: any) => (
                            <Badge key={tn.number} variant="outline" className="font-mono">
                              {String(tn.number).padStart(2, '0')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transações Tab */}
          <TabsContent value="transacoes">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Transações</CardTitle>
                <CardDescription>Todas as suas transações financeiras</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPayments ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : payments.length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma transação registrada.</p>
                ) : (
                  <div className="space-y-4">
                    {payments.map((payment) => (
                      <div key={payment.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{(payment as any).raffle?.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </p>
                            <p className="text-xs font-mono text-muted-foreground mt-0.5">
                              Ref: {payment.id?.slice(0, 8).toUpperCase()}
                            </p>
                          </div>
                          <div className="text-right space-y-1">
                            <p className="font-mono font-bold">R$ {Number(payment.amount).toFixed(2)}</p>
                            {getPaymentStatusBadge(payment.status || 'pending')}
                          </div>
                        </div>
                        {payment.status === 'pending' && (
                          <div className="mt-3 pt-3 border-t">
                            <Button
                              size="sm"
                              onClick={() => handleResumePayment(payment.id)}
                              disabled={resumingPaymentId === payment.id}
                              className="w-full sm:w-auto"
                            >
                              {resumingPaymentId === payment.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Abrindo...
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Concluir Pagamento
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sorteios Tab */}
          <TabsContent value="sorteios">
            <Card>
              <CardHeader>
                <CardTitle>Sorteios Participantes</CardTitle>
                <CardDescription>Todos os sorteios em que você está participando</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRaffles || loadingTickets ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : raffles.length === 0 ? (
                  <p className="text-muted-foreground">Você ainda não participou de nenhum sorteio.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {raffles.map((raffle) => {
                      const raffleTickets = tickets.filter(t => t.raffle_id === raffle.id && t.status === 'active');
                      return (
                        <div key={raffle.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold">{raffle.name}</h3>
                            <Badge variant={raffle.status === 'active' ? 'default' : 'secondary'}>
                              {raffle.status === 'active' ? 'Ativo' : raffle.status === 'finished' ? 'Encerrado' : raffle.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            {raffleTickets.length} bilhete(s) ativo(s)
                          </p>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/sorteio/${raffle.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Sorteio
                            </Link>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configurações Tab */}
          <TabsContent value="configuracoes">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Profile Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informações da Conta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Nome</Label>
                    <Input
                      id="profile-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">CPF</Label>
                    <p className="font-medium font-mono">{getDisplayCpf(player) || `***.***.***-${player.cpf_last4}`}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="profile-city">Cidade</Label>
                      <Input
                        id="profile-city"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="profile-phone">Telefone</Label>
                      <Input
                        id="profile-phone"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => updateProfileMutation.mutate()}
                    disabled={updateProfileMutation.isPending || !editName || editName.trim().length < 3}
                    className="w-full"
                  >
                    {updateProfileMutation.isPending ? 'Salvando...' : 'Salvar Perfil'}
                  </Button>
                </CardContent>
              </Card>

              {/* Change Password */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Alterar Senha
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Senha Atual</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar Senha</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  <Button 
                    onClick={handlePasswordChange} 
                    disabled={isUpdating || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full"
                  >
                    {isUpdating ? 'Alterando...' : 'Alterar Senha'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ThemedLayout>
  );
}
