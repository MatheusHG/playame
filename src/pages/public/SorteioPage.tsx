import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Trophy, Clock, DollarSign, Hash, ShoppingCart, Loader2, Check, Shuffle, Ticket, Timer, AlertCircle, Plus, Minus, X, Lock } from 'lucide-react';
import { formatDistanceToNow, differenceInSeconds, differenceInDays, differenceInHours, differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PlayerAuthModal } from '@/components/public/PlayerAuthModal';
import { PublicRanking } from '@/components/public/PublicRanking';
import { PrizeTiersDisplay } from '@/components/public/PrizeTiersDisplay';
import { AffiliateSelector } from '@/components/public/AffiliateSelector';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type Raffle = Database['public']['Tables']['raffles']['Row'] & {
  prize_tiers: Database['public']['Tables']['prize_tiers']['Row'][];
};

interface TicketSelection {
  id: number;
  numbers: number[];
}

export default function SorteioPage() {
  const { slug, raffleId } = useParams<{ slug: string; raffleId: string }>();
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();
  const { player, isAuthenticated, logout } = usePlayer();
  const { toast } = useToast();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [tickets, setTickets] = useState<TicketSelection[]>([{ id: 1, numbers: [] }]);
  const [activeTicketId, setActiveTicketId] = useState(1);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | undefined>();

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  useCompanyBranding();

  // Fetch raffle details
  const { data: raffle, isLoading } = useQuery({
    queryKey: ['public-raffle', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raffles')
        .select('*, prize_tiers(*)')
        .eq('id', raffleId!)
        .single();

      if (error) throw error;
      return data as Raffle;
    },
  });

  // Fetch total sales for prize calculation
  const { data: totalSales = 0 } = useQuery({
    queryKey: ['raffle-total-sales', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('amount')
        .eq('raffle_id', raffleId!)
        .eq('status', 'succeeded');

      if (error) throw error;
      return data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    },
  });

  // Check if raffle is open based on scheduled_at (start date)
  const [countdown, setCountdown] = useState<{ text: string; isOpen: boolean }>({ text: '', isOpen: true });

  useEffect(() => {
    if (!raffle?.scheduled_at) {
      setCountdown({ text: '', isOpen: true });
      return;
    }

    const updateTime = () => {
      const now = new Date();
      const startDate = new Date(raffle.scheduled_at!);
      const diff = differenceInSeconds(startDate, now);

      // If scheduled date has passed, raffle is open
      if (diff <= 0) {
        setCountdown({ text: '', isOpen: true });
        return;
      }

      // Raffle not yet open - show countdown to opening
      const days = differenceInDays(startDate, now);
      const hours = differenceInHours(startDate, now) % 24;
      const minutes = differenceInMinutes(startDate, now) % 60;
      const seconds = diff % 60;

      let timeText = '';
      if (days > 0) {
        timeText = `${days}d ${hours}h ${minutes}m`;
      } else if (hours > 0) {
        timeText = `${hours}h ${minutes}m ${seconds}s`;
      } else if (minutes > 0) {
        timeText = `${minutes}m ${seconds}s`;
      } else {
        timeText = `${seconds}s`;
      }

      setCountdown({ text: timeText, isOpen: false });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [raffle?.scheduled_at]);

  // Generate numbers for selection
  const availableNumbers = useMemo(() => {
    if (!raffle) return [];
    const numbers: number[] = [];
    for (let i = raffle.number_range_start; i <= raffle.number_range_end; i++) {
      numbers.push(i);
    }
    return numbers;
  }, [raffle]);

  // Calculate prize pool
  const calculatePrizePool = (): number => {
    if (!raffle) return 0;
    if (raffle.prize_mode === 'FIXED') {
      return Number(raffle.fixed_prize_value) || 0;
    }
    if (raffle.prize_mode === 'PERCENT_ONLY') {
      return totalSales * (Number(raffle.prize_percent_of_sales) / 100);
    }
    // FIXED_PLUS_PERCENT
    return (Number(raffle.fixed_prize_value) || 0) + totalSales * (Number(raffle.prize_percent_of_sales) / 100);
  };

  const prizePool = calculatePrizePool();

  const activeTicket = tickets.find(t => t.id === activeTicketId) || tickets[0];
  const selectedNumbers = activeTicket?.numbers || [];

  const toggleNumber = (num: number) => {
    if (!raffle) return;
    
    setTickets(prev => prev.map(ticket => {
      if (ticket.id !== activeTicketId) return ticket;
      
      if (ticket.numbers.includes(num)) {
        return { ...ticket, numbers: ticket.numbers.filter((n) => n !== num) };
      } else if (ticket.numbers.length < raffle.numbers_per_ticket) {
        return { ...ticket, numbers: [...ticket.numbers, num] };
      }
      return ticket;
    }));
  };

  const generateRandomNumbers = () => {
    if (!raffle) return;
    
    const shuffled = [...availableNumbers].sort(() => Math.random() - 0.5);
    setTickets(prev => prev.map(ticket => {
      if (ticket.id !== activeTicketId) return ticket;
      return { ...ticket, numbers: shuffled.slice(0, raffle.numbers_per_ticket) };
    }));
  };

  const addTicket = () => {
    const newId = Math.max(...tickets.map(t => t.id)) + 1;
    setTickets(prev => [...prev, { id: newId, numbers: [] }]);
    setActiveTicketId(newId);
  };

  const removeTicket = (ticketId: number) => {
    if (tickets.length <= 1) return;
    
    setTickets(prev => prev.filter(t => t.id !== ticketId));
    if (activeTicketId === ticketId) {
      setActiveTicketId(tickets.find(t => t.id !== ticketId)?.id || tickets[0].id);
    }
  };

  const allTicketsComplete = raffle ? tickets.every(t => t.numbers.length === raffle.numbers_per_ticket) : false;
  const ticketPrice = raffle ? Number(raffle.ticket_price) : 0;
  const totalPrice = ticketPrice * tickets.length;

  const handlePurchase = async () => {
    if (!player || !raffle) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-ticket-checkout', {
        body: {
          companyId: raffle.company_id,
          playerId: player.id,
          raffleId: raffle.id,
          quantity: tickets.length,
          ticketNumbers: tickets.map(t => t.numbers.sort((a, b) => a - b)),
          affiliateId: selectedAffiliateId && selectedAffiliateId !== '__none__' ? selectedAffiliateId : undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      window.location.href = data.checkoutUrl;
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao processar compra',
        description: err instanceof Error ? err.message : 'Tente novamente.',
      });
      setIsProcessing(false);
    }
  };

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  };

  if (tenantLoading || isLoading) {
    return <LoadingState fullScreen message="Carregando sorteio..." />;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Empresa não encontrada</h1>
          <p className="text-muted-foreground">A empresa solicitada não existe ou está inativa.</p>
        </div>
      </div>
    );
  }

  if (!raffle || raffle.status !== 'active') {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: company.primary_color }}>
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Link to={`/empresa/${slug}`} className="flex items-center gap-2 text-white">
              <ArrowLeft className="h-5 w-5" />
              <span>{company.name}</span>
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Sorteio não encontrado</h1>
          <p className="text-muted-foreground mb-4">O sorteio solicitado não existe ou não está ativo.</p>
          <Button asChild>
            <Link to={`/empresa/${slug}`}>Voltar</Link>
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: company.primary_color }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={`/empresa/${slug}`} className="flex items-center gap-2 text-white">
            <ArrowLeft className="h-5 w-5" />
            <span>{company.name}</span>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="text-white/80 text-sm">{player?.name.split(' ')[0]}</span>
              <Button variant="secondary" size="sm" onClick={logout}>
                Sair
              </Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => openAuth('login')}>
              Entrar
            </Button>
          )}
        </div>
      </header>

      {/* Hero with optional image */}
      <section
        className="py-8 text-white relative overflow-hidden"
        style={{
          background: raffle.image_url 
            ? `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url(${raffle.image_url})` 
            : `linear-gradient(135deg, ${company.primary_color}, ${company.secondary_color})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="container mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{raffle.name}</h1>
          {raffle.description && <p className="text-white/80 mb-4">{raffle.description}</p>}

          <div className="flex flex-wrap gap-4">
            <div className="bg-white/20 rounded-lg px-4 py-2 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <div>
                <p className="font-bold">R$ {ticketPrice.toFixed(2)}</p>
                <p className="text-xs text-white/80">por cartela</p>
              </div>
            </div>

            {!countdown.isOpen && countdown.text && (
              <div className="bg-amber-500/80 rounded-lg px-4 py-2 flex items-center gap-2">
                <Timer className="h-5 w-5" />
                <div>
                  <p className="font-bold">{countdown.text}</p>
                  <p className="text-xs text-white/80">para abrir</p>
                </div>
              </div>
            )}

            <div className="bg-white/20 rounded-lg px-4 py-2 flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              <div>
                <p className="font-bold">R$ {prizePool.toFixed(2)}</p>
                <p className="text-xs text-white/80">prêmio total</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Number Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Tabs */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5" />
                    Suas Cartelas ({tickets.length})
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addTicket}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Cartela
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {tickets.map((ticket, index) => (
                    <div key={ticket.id} className="relative">
                      <Button
                        variant={activeTicketId === ticket.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setActiveTicketId(ticket.id)}
                        className={cn(
                          'pr-8',
                          ticket.numbers.length === raffle.numbers_per_ticket && 'border-green-500'
                        )}
                      >
                        Cartela {index + 1}
                        {ticket.numbers.length === raffle.numbers_per_ticket && (
                          <Check className="h-3 w-3 ml-1 text-green-500" />
                        )}
                      </Button>
                      {tickets.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTicket(ticket.id);
                          }}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-medium">Cartela {tickets.findIndex(t => t.id === activeTicketId) + 1}</p>
                      <p className="text-sm text-muted-foreground">
                        Selecione {raffle.numbers_per_ticket} números entre {raffle.number_range_start} e {raffle.number_range_end}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-sm">
                        {selectedNumbers.length} / {raffle.numbers_per_ticket}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => setTickets(prev => prev.map(t => t.id === activeTicketId ? { ...t, numbers: [] } : t))}>
                        Limpar
                      </Button>
                      <Button variant="outline" size="sm" onClick={generateRandomNumbers}>
                        <Shuffle className="mr-1 h-4 w-4" />
                        Sortear
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-10 gap-1 sm:gap-2">
                    {availableNumbers.map((num) => {
                      const isSelected = selectedNumbers.includes(num);
                      const isFull = selectedNumbers.length >= raffle.numbers_per_ticket && !isSelected;

                      return (
                        <button
                          key={num}
                          onClick={() => toggleNumber(num)}
                          disabled={isFull}
                          className={cn(
                            'aspect-square rounded-lg font-mono text-sm sm:text-base font-bold transition-all',
                            'flex items-center justify-center',
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                              : 'bg-muted hover:bg-muted/80',
                            isFull && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {String(num).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>

                  {selectedNumbers.length > 0 && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Números selecionados:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedNumbers
                          .sort((a, b) => a - b)
                          .map((num) => (
                            <Badge key={num} variant="default" className="font-mono text-sm px-2">
                              {String(num).padStart(2, '0')}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-4 border-t pt-6">
                {/* Countdown Warning if not open */}
                {!countdown.isOpen && countdown.text && (
                  <div className="w-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Lock className="h-5 w-5 text-amber-600" />
                      <span className="font-medium text-amber-800 dark:text-amber-200">Sorteio abre em</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 font-mono">
                      {countdown.text}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                      Você pode visualizar as informações, mas as compras estarão disponíveis após a abertura.
                    </p>
                  </div>
                )}

                {/* Affiliate Selector */}
                <AffiliateSelector
                  companyId={raffle.company_id}
                  value={selectedAffiliateId}
                  onChange={setSelectedAffiliateId}
                />

                {/* Summary */}
                <div className="w-full bg-muted rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{tickets.length} cartela(s) × R$ {ticketPrice.toFixed(2)}</span>
                    <span>R$ {totalPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>R$ {totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                {countdown.isOpen ? (
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={!allTicketsComplete}
                    onClick={() => {
                      if (!isAuthenticated) {
                        openAuth('login');
                      } else {
                        setPurchaseDialogOpen(true);
                      }
                    }}
                  >
                    <ShoppingCart className="mr-2 h-5 w-5" />
                    {allTicketsComplete 
                      ? `Comprar ${tickets.length} Cartela(s) - R$ ${totalPrice.toFixed(2)}`
                      : `Complete todas as cartelas (${tickets.filter(t => t.numbers.length === raffle.numbers_per_ticket).length}/${tickets.length})`
                    }
                  </Button>
                ) : (
                  <Button size="lg" className="w-full" disabled variant="secondary">
                    <Lock className="mr-2 h-5 w-5" />
                    Aguardando Abertura
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Ranking */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Ranking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PublicRanking raffleId={raffle.id} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Prize Tiers with Winners */}
            <PrizeTiersDisplay 
              raffleId={raffle.id}
              prizeTiers={raffle.prize_tiers || []}
              prizePool={prizePool}
              currentDrawCount={raffle.current_draw_count || 0}
              prizeMode={raffle.prize_mode}
              fixedPrizeValue={raffle.fixed_prize_value}
              prizePercentOfSales={raffle.prize_percent_of_sales}
            />

            {/* Raffle Info */}
            <Card>
              <CardHeader>
                <CardTitle>Informações do Sorteio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Números por cartela</span>
                  <span className="font-medium">{raffle.numbers_per_ticket}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Range de números</span>
                  <span className="font-medium">
                    {raffle.number_range_start} - {raffle.number_range_end}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rodadas realizadas</span>
                  <span className="font-medium">{raffle.current_draw_count || 0}</span>
                </div>
                {raffle.scheduled_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data final</span>
                    <span className="font-medium">
                      {format(new Date(raffle.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Compra</DialogTitle>
            <DialogDescription>
              Você está comprando {tickets.length} cartela(s) para o sorteio "{raffle.name}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {tickets.map((ticket, index) => (
              <div key={ticket.id} className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm mb-2">Cartela {index + 1}</p>
                <div className="flex flex-wrap gap-1">
                  {ticket.numbers.sort((a, b) => a - b).map(num => (
                    <Badge key={num} variant="outline" className="font-mono text-xs">
                      {String(num).padStart(2, '0')}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{tickets.length} cartela(s) × R$ {ticketPrice.toFixed(2)}</span>
                <span>R$ {totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total</span>
                <span>R$ {totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 mt-0.5 text-primary" />
              <span>Ao confirmar, você será redirecionado para o pagamento seguro</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePurchase} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Pagar R$ {totalPrice.toFixed(2)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Modal */}
      <PlayerAuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        mode={authMode}
        onModeChange={setAuthMode}
        companyId={company.id}
      />
    </div>
  );
}
