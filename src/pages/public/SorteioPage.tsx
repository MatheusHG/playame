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
import { ArrowLeft, Trophy, Clock, DollarSign, Hash, ShoppingCart, Loader2, Check, Shuffle, Ticket, Timer, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, differenceInSeconds, differenceInDays, differenceInHours, differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PlayerAuthModal } from '@/components/public/PlayerAuthModal';
import { PublicRanking } from '@/components/public/PublicRanking';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type Raffle = Database['public']['Tables']['raffles']['Row'] & {
  prize_tiers: Database['public']['Tables']['prize_tiers']['Row'][];
};

export default function SorteioPage() {
  const { slug, raffleId } = useParams<{ slug: string; raffleId: string }>();
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();
  const { player, isAuthenticated, logout } = usePlayer();
  const { toast } = useToast();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

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

  // Update time remaining countdown
  useEffect(() => {
    if (!raffle?.scheduled_at) {
      setTimeRemaining('');
      return;
    }

    const updateTime = () => {
      const now = new Date();
      const endDate = new Date(raffle.scheduled_at!);
      const diff = differenceInSeconds(endDate, now);

      if (diff <= 0) {
        setTimeRemaining('Encerrado');
        return;
      }

      const days = differenceInDays(endDate, now);
      const hours = differenceInHours(endDate, now) % 24;
      const minutes = differenceInMinutes(endDate, now) % 60;
      const seconds = diff % 60;

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeRemaining(`${minutes}m ${seconds}s`);
      }
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

  const toggleNumber = (num: number) => {
    if (!raffle) return;
    
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter((n) => n !== num));
    } else if (selectedNumbers.length < raffle.numbers_per_ticket) {
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  const generateRandomNumbers = () => {
    if (!raffle) return;
    
    const shuffled = [...availableNumbers].sort(() => Math.random() - 0.5);
    setSelectedNumbers(shuffled.slice(0, raffle.numbers_per_ticket));
  };

  const handlePurchase = async () => {
    if (!player || !raffle) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-ticket-checkout', {
        body: {
          companyId: raffle.company_id,
          playerId: player.id,
          raffleId: raffle.id,
          quantity: 1,
          selectedNumbers: selectedNumbers.length === raffle.numbers_per_ticket ? selectedNumbers : undefined,
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

  const sortedTiers = [...(raffle.prize_tiers || [])].sort((a, b) => b.hits_required - a.hits_required);
  const ticketPrice = Number(raffle.ticket_price);

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

      {/* Hero */}
      <section
        className="py-8 text-white"
        style={{
          background: `linear-gradient(135deg, ${company.primary_color}, ${company.secondary_color})`,
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

            {timeRemaining && (
              <div className="bg-white/20 rounded-lg px-4 py-2 flex items-center gap-2">
                <Timer className="h-5 w-5" />
                <div>
                  <p className="font-bold">{timeRemaining}</p>
                  <p className="text-xs text-white/80">para encerrar</p>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Escolha seus Números
                </CardTitle>
                <CardDescription>
                  Selecione {raffle.numbers_per_ticket} números entre {raffle.number_range_start} e {raffle.number_range_end}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    {selectedNumbers.length} / {raffle.numbers_per_ticket} selecionados
                  </Badge>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedNumbers([])}>
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
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Seus números selecionados:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedNumbers
                        .sort((a, b) => a - b)
                        .map((num) => (
                          <Badge key={num} variant="default" className="font-mono text-lg px-3">
                            {String(num).padStart(2, '0')}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={selectedNumbers.length !== raffle.numbers_per_ticket}
                  onClick={() => {
                    if (!isAuthenticated) {
                      openAuth('login');
                    } else {
                      setPurchaseDialogOpen(true);
                    }
                  }}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Comprar Cartela - R$ {ticketPrice.toFixed(2)}
                </Button>
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
            {/* Prize Tiers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Faixas de Prêmio
                </CardTitle>
                <CardDescription>Prêmios reais baseados no pool atual</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {sortedTiers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma faixa configurada</p>
                ) : (
                  sortedTiers.map((tier) => {
                    const tierPrize =
                      tier.prize_type === 'money' ? prizePool * (Number(tier.prize_percentage) / 100) : 0;

                    return (
                      <div key={tier.id} className="p-3 rounded-lg bg-muted/50 space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{tier.hits_required} acertos</Badge>
                          {tier.prize_type === 'money' ? (
                            <span className="font-bold text-primary">R$ {tierPrize.toFixed(2)}</span>
                          ) : (
                            <Badge variant="secondary">Prêmio Físico</Badge>
                          )}
                        </div>
                        {tier.prize_type === 'object' && tier.object_description && (
                          <p className="text-sm text-muted-foreground">{tier.object_description}</p>
                        )}
                        {tier.purchase_allowed_until_draw_count && (
                          <p className="text-xs text-muted-foreground">
                            Até {tier.purchase_allowed_until_draw_count}ª rodada
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

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
                  <span className="text-muted-foreground">Rodadas sorteadas</span>
                  <span className="font-medium">{raffle.current_draw_count || 0}</span>
                </div>
                {raffle.scheduled_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Encerramento</span>
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
            <DialogDescription>{raffle.name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Seus números:</p>
              <div className="flex flex-wrap gap-2">
                {selectedNumbers
                  .sort((a, b) => a - b)
                  .map((num) => (
                    <Badge key={num} variant="default" className="font-mono">
                      {String(num).padStart(2, '0')}
                    </Badge>
                  ))}
              </div>
            </div>

            <div className="flex justify-between font-semibold text-lg border-t pt-4">
              <span>Total</span>
              <span>R$ {ticketPrice.toFixed(2)}</span>
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
                  Pagar R$ {ticketPrice.toFixed(2)}
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
