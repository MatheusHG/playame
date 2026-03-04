import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowLeft, Trophy, Hash, ShoppingCart, Loader2, Check, AlertCircle, Plus, X, Lock, RotateCcw, Sparkles, Crown, Medal, Star, Gift, Info, ScrollText, Radio, Clock, CreditCard } from 'lucide-react';
import { differenceInSeconds, differenceInDays, differenceInHours, differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PlayerAuthModal } from '@/components/public/PlayerAuthModal';
import { PublicRanking } from '@/components/public/PublicRanking';

import { cn } from '@/lib/utils';
import { PlayerAccountMenu } from '@/components/public/PlayerAccountMenu';
import { PublicFooter } from '@/components/public/PublicFooter';
import { PromotionCombos } from '@/components/public/PromotionCombos';
import { useDrawnNumbers } from '@/hooks/useRaffles';

interface TicketSelection {
  id: number;
  numbers: number[];
}

export default function SorteioPage() {
  const { raffleId } = useParams<{ raffleId: string }>();
  const [searchParams] = useSearchParams();
  const { company, loading: tenantLoading } = useTenant();
  const { player, isAuthenticated, logout } = usePlayer();
  const { toast } = useToast();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [tickets, setTickets] = useState<TicketSelection[]>([{ id: 1, numbers: [] }]);
  const [activeTicketId, setActiveTicketId] = useState(1);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [addAnotherTicketDialogOpen, setAddAnotherTicketDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const promptedTicketIdsRef = useRef<Set<number>>(new Set());
  const [pendingPaymentDialogOpen, setPendingPaymentDialogOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{ id: string; amount: number } | null>(null);
  const [isResumingPayment, setIsResumingPayment] = useState(false);

  // Capture ref from URL and store in localStorage
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode && company?.id) {
      // Store the ref code in localStorage for this company
      localStorage.setItem(`affiliate_ref_${company.id}`, refCode);
    }
  }, [searchParams, company?.id]);

  // Fetch affiliate by link_code from URL or localStorage
  useEffect(() => {
    const fetchAffiliateByRef = async () => {
      const refCode = searchParams.get('ref') || (company?.id ? localStorage.getItem(`affiliate_ref_${company.id}`) : null);

      if (!refCode || !company?.id) {
        setAffiliateId(null);
        return;
      }

      try {
        const data = await api.post<any[]>('/affiliates/by-link-code', { linkCode: refCode });

        // Find affiliate that matches this company and is not paused
        const validAffiliate = data?.find(
          (a: any) => a.company_id === company.id && !a.is_sales_paused
        );

        if (validAffiliate) {
          setAffiliateId(validAffiliate.id);
        } else {
          setAffiliateId(null);
        }
      } catch (err) {
        console.error('Error fetching affiliate:', err);
        setAffiliateId(null);
      }
    };

    fetchAffiliateByRef();
  }, [searchParams, company?.id]);

  useCompanyBranding();

  // Check for pending payments for this raffle
  useEffect(() => {
    if (!player?.id || !raffleId || !company?.id) return;

    const checkPendingPayments = async () => {
      try {
        const data = await api.playerGet<any[]>(`/payments/pending/${player.id}`, {
          raffleId,
          companyId: company.id,
        });

        if (data && data.length > 0) {
          setPendingPayment({ id: data[0].id, amount: Number(data[0].amount) });
          setPendingPaymentDialogOpen(true);
        }
      } catch (err) {
        console.error('Error checking pending payments:', err);
      }
    };

    checkPendingPayments();
  }, [player?.id, raffleId, company?.id]);

  const handleResumePayment = async () => {
    if (!pendingPayment || !player) return;
    setIsResumingPayment(true);
    try {
      const data = await api.playerPost<any>('/resume-checkout', {
        paymentId: pendingPayment.id,
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
      setIsResumingPayment(false);
    }
  };

  // Fetch raffle details
  const { data: raffle, isLoading } = useQuery({
    queryKey: ['public-raffle', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const data = await api.get<any>(`/raffles/${raffleId}`, { include: 'prize_tiers' });
      return data;
    },
  });

  // Fetch net sales (já com taxas descontadas) para cálculo do prêmio
  const { data: netSales = 0 } = useQuery({
    queryKey: ['raffle-total-net-sales', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const data = await api.get<{ total: number }>(`/payments/net-sales/${raffleId}`);
      return data.total || 0;
    },
  });

  // Fetch raffle discounts
  const { data: discounts = [] } = useQuery({
    queryKey: ['raffle-discounts', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      return api.get<any[]>(`/raffles/${raffleId}/discounts`);
    },
  });

  // Fetch already-drawn numbers (from finalized batches)
  const { data: drawnNumbersSet = new Set<number>() } = useDrawnNumbers(raffleId);

  // Check if raffle is open based on scheduled_at (start date)
  const [countdown, setCountdown] = useState<{ text: string; isOpen: boolean }>({ text: '', isOpen: true });

  useEffect(() => {
    // If raffle is already active, skip countdown regardless of scheduled_at
    if (!raffle?.scheduled_at || raffle.status === 'active') {
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
  }, [raffle?.scheduled_at, raffle?.status]);

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
  // netSales already equals SUM(prize_pool_contribution) from backend
  const calculatePrizePool = (): number => {
    if (!raffle) return 0;
    if (raffle.prize_mode === 'FIXED') {
      return Number(raffle.fixed_prize_value) || 0;
    }
    if (raffle.prize_mode === 'PERCENT_ONLY') {
      return netSales;
    }
    // FIXED_PLUS_PERCENT
    return (Number(raffle.fixed_prize_value) || 0) + netSales;
  };

  const prizePool = calculatePrizePool();

  const activeTicket = tickets.find(t => t.id === activeTicketId) || tickets[0];
  const selectedNumbers = activeTicket?.numbers || [];

  const toggleNumber = (num: number) => {
    if (!raffle) return;
    if (drawnNumbersSet.has(num)) return; // Block already-drawn numbers

    setTickets((prev) => {
      let didCompleteActiveTicket = false;

      const next = prev.map((ticket) => {
        if (ticket.id !== activeTicketId) return ticket;

        let nextNumbers: number[] = ticket.numbers;
        if (ticket.numbers.includes(num)) {
          nextNumbers = ticket.numbers.filter((n) => n !== num);
        } else if (ticket.numbers.length < raffle.numbers_per_ticket) {
          nextNumbers = [...ticket.numbers, num];
        }

        if (
          nextNumbers.length === raffle.numbers_per_ticket &&
          !promptedTicketIdsRef.current.has(ticket.id)
        ) {
          didCompleteActiveTicket = true;
          promptedTicketIdsRef.current.add(ticket.id);
        }

        return { ...ticket, numbers: nextNumbers };
      });

      if (didCompleteActiveTicket) {
        setAddAnotherTicketDialogOpen(true);
      }

      return next;
    });
  };

  const generateRandomNumbers = () => {
    if (!raffle) return;

    const pool = availableNumbers.filter((n) => !drawnNumbersSet.has(n));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    setTickets((prev) => {
      const next = prev.map((ticket) => {
        if (ticket.id !== activeTicketId) return ticket;
        return { ...ticket, numbers: shuffled.slice(0, raffle.numbers_per_ticket) };
      });

      if (!promptedTicketIdsRef.current.has(activeTicketId)) {
        promptedTicketIdsRef.current.add(activeTicketId);
        setAddAnotherTicketDialogOpen(true);
      }

      return next;
    });
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

  const handleSelectCombo = (targetQuantity: number) => {
    if (tickets.length >= targetQuantity) return;

    const toAdd = targetQuantity - tickets.length;
    const maxId = Math.max(...tickets.map(t => t.id));
    const newTickets = Array.from({ length: toAdd }, (_, i) => ({
      id: maxId + i + 1,
      numbers: [] as number[],
    }));

    const allTickets = [...tickets, ...newTickets];
    setTickets(allTickets);

    // Navigate to first incomplete ticket
    const firstIncomplete = allTickets.find(
      t => t.numbers.length < (raffle?.numbers_per_ticket || 0)
    );
    if (firstIncomplete) {
      setActiveTicketId(firstIncomplete.id);
    }
  };

  const allTicketsComplete = raffle ? tickets.every(t => t.numbers.length === raffle.numbers_per_ticket) : false;
  const ticketPrice = raffle ? Number(raffle.ticket_price) : 0;

  const quantity = tickets.length;
  const totalPrice = ticketPrice * quantity;

  // Calculate best discount
  const validDiscounts = discounts.filter(d => d.is_active);
  const bestDiscount = validDiscounts.sort((a, b) => b.min_quantity - a.min_quantity).find(d => quantity >= d.min_quantity);
  const discountPercent = bestDiscount ? Number(bestDiscount.discount_percent) : 0;
  const discountAmount = totalPrice * (discountPercent / 100);
  const finalPrice = totalPrice - discountAmount;

  // Prize tiers data (used in hero section)
  const sortedTiers = [...(raffle?.prize_tiers || [])].sort((a: any, b: any) => b.hits_required - a.hits_required);
  const getTierIcon = (index: number) => {
    if (index === 0) return <Crown className="h-5 w-5 text-yellow-400" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-300" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-500" />;
    return <Star className="h-5 w-5 text-blue-300" />;
  };
  const maxDiscountValue = validDiscounts.length > 0
    ? Math.max(...validDiscounts.map(d => Number(d.discount_percent)))
    : 0;

  const handlePurchase = async () => {
    if (!player || !raffle) return;

    setIsProcessing(true);
    try {
      const data = await api.playerPost<any>('/create-ticket-checkout', {
        companyId: raffle.company_id,
        playerId: player.id,
        raffleId: raffle.id,
        quantity: tickets.length,
        ticketNumbers: tickets.map(t => t.numbers.sort((a, b) => a - b)),
        affiliateId: affiliateId || undefined,
      });

      if (data.error) throw new Error(data.error);

      if (data.manual) {
        // Manual payment: show success message, no redirect
        setPurchaseDialogOpen(false);
        toast({
          title: 'Cartela registrada com sucesso!',
          description: 'Aguarde a aprovação do pagamento pelo administrador.',
        });
        setTickets([{ id: 1, numbers: [] }]);
        setActiveTicketId(1);
        promptedTicketIdsRef.current.clear();
        setIsProcessing(false);
      } else {
        window.location.href = data.checkoutUrl;
      }
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
            <Link to={"/"} className="flex items-center gap-2 text-white">
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
            <Link to={"/"}>Voltar</Link>
          </Button>
        </div>
        <PublicFooter />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ backgroundColor: `${company.primary_color}F2` }}>
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={"/"} className="flex items-center gap-2 text-white">
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">{company.name}</span>
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              {player && (
                <PlayerAccountMenu
                  player={player}
                  onLogout={logout}
                  variant="secondary"
                  className="bg-white/20 text-white hover:bg-white/30"
                />
              )}
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => openAuth('login')}>
              Entrar
            </Button>
          )}
        </div>
      </header>

      {/* Hero - Product Showcase */}
      <section className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="grid gap-6 lg:grid-cols-2 items-start">
            {/* Left: Raffle Image */}
            <div className="relative">
              {raffle.image_url ? (
                <div className="relative overflow-hidden rounded-2xl shadow-lg">
                  <img
                    src={raffle.image_url}
                    alt={raffle.name}
                    className="w-full aspect-[4/3] object-cover"
                  />
                  {/* Price Badge overlay */}
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-md">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cartela</p>
                    <p className="text-xl font-extrabold text-foreground">R$ {ticketPrice.toFixed(2)}</p>
                  </div>
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {maxDiscountValue > 0 && (
                      <Badge className="bg-green-600 text-white text-xs shadow-sm">
                        Até {maxDiscountValue}% OFF
                      </Badge>
                    )}
                    <Badge className="bg-primary text-primary-foreground text-xs shadow-sm">Ativo</Badge>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full aspect-[4/3] rounded-2xl shadow-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${company.primary_color}, ${company.secondary_color})` }}
                >
                  <Trophy className="h-16 w-16 text-white/30" />
                  {/* Price Badge overlay */}
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-md">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cartela</p>
                    <p className="text-xl font-extrabold text-foreground">R$ {ticketPrice.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Raffle Info */}
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{raffle.name}</h1>
                {raffle.description && (
                  <p className="text-muted-foreground text-sm mt-1 line-clamp-3">{raffle.description}</p>
                )}
              </div>

              {/* Key Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 bg-background rounded-xl border p-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-primary">R$ {prizePool.toFixed(2)}</p>
                    <p className="text-[11px] text-muted-foreground">Prêmio total</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-background rounded-xl border p-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Hash className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{raffle.numbers_per_ticket} números</p>
                    <p className="text-[11px] text-muted-foreground">{raffle.number_range_start}–{raffle.number_range_end}</p>
                  </div>
                </div>
              </div>

              {/* Info Chips */}
              <div className="flex flex-wrap gap-2">
                {raffle.scheduled_at && (
                  <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-medium">
                    <Clock className="h-3 w-3" />
                    {format(new Date(raffle.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-medium">
                  <Hash className="h-3 w-3" />
                  {raffle.current_draw_count || 0} rodadas
                </Badge>
                <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-medium">
                  <Trophy className="h-3 w-3" />
                  {raffle.prize_mode === 'FIXED' ? 'Prêmio Fixo'
                    : raffle.prize_mode === 'PERCENT_ONLY' ? '% das Vendas'
                    : 'Fixo + %'}
                </Badge>
              </div>

              {/* Acompanhar o sorteio */}
              <Link
                to={`/sorteio/${raffleId}/acompanhar`}
                className="inline-flex items-center gap-2 bg-primary/10 rounded-xl px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors w-fit"
              >
                <Radio className="h-4 w-4 animate-pulse" />
                Acompanhar o sorteio ao vivo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Prize Tiers - Standalone Section */}
      {sortedTiers.length > 0 && (
        <section className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-semibold">Distribuição dos Prêmios</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sortedTiers.map((tier: any, index: number) => {
                const tierPrize = tier.prize_type === 'money'
                  ? prizePool * (Number(tier.prize_percentage) / 100)
                  : 0;
                const currentDraw = raffle?.current_draw_count ?? 0;
                const tierLimit = tier.purchase_allowed_until_draw_count;
                const isEligible = tierLimit == null || tierLimit >= currentDraw;
                return (
                  <div
                    key={tier.id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3',
                      !isEligible
                        ? 'bg-muted/30 border-muted opacity-60'
                        : index === 0
                          ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800'
                          : 'bg-background'
                    )}
                  >
                    {getTierIcon(index)}
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-semibold', !isEligible && 'line-through')}>{tier.hits_required} acertos</p>
                      <p className="text-xs text-muted-foreground">{tier.prize_percentage}% do prêmio</p>
                      {tierLimit != null && (
                        <p className={cn('text-[10px] mt-0.5', isEligible ? 'text-green-600' : 'text-red-500')}>
                          {isEligible
                            ? `Elegível (até ${tierLimit}ª rodada)`
                            : `Encerrado na ${tierLimit}ª rodada`}
                        </p>
                      )}
                    </div>
                    <span className={cn(
                      'font-bold text-sm shrink-0',
                      !isEligible ? 'text-muted-foreground line-through' : index === 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'
                    )}>
                      {tier.prize_type === 'object'
                        ? <span className="flex items-center gap-1 text-xs"><Gift className="h-3 w-3" />{tier.object_description}</span>
                        : `R$ ${tierPrize.toFixed(2)}`}
                    </span>
                  </div>
                );
              })}
            </div>
            {(raffle?.current_draw_count ?? 0) > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Rodada atual: {raffle.current_draw_count}ª — Comprando agora, você concorre apenas aos prêmios marcados como "Elegível".
              </p>
            )}
          </div>
        </section>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pb-40 lg:pb-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Ticket Selection */}
          <div className="lg:col-span-2 space-y-4">

            {/* Promotion Combos */}
            {validDiscounts.length > 0 && (
              <PromotionCombos
                discounts={discounts}
                ticketPrice={ticketPrice}
                currentQuantity={tickets.length}
                onSelectCombo={handleSelectCombo}
              />
            )}

            {/* Countdown Warning if not open */}
            {!countdown.isOpen && countdown.text && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Lock className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Sorteio abre em</span>
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 font-mono">
                  {countdown.text}
                </p>
              </div>
            )}

            {/* Ticket Manager */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                Suas Cartelas ({tickets.length})
              </h2>
              <button
                onClick={addTicket}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
              >
                <Plus className="h-3 w-3" />
                Adicionar
              </button>
            </div>

            {/* Ticket Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {tickets.map((ticket, index) => {
                const isActive = activeTicketId === ticket.id;
                const isComplete = ticket.numbers.length === raffle.numbers_per_ticket;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => setActiveTicketId(ticket.id)}
                    className={cn(
                      'relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 border',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm border-primary'
                        : isComplete
                          ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
                          : 'bg-background text-muted-foreground hover:bg-muted/50 border-muted'
                    )}
                  >
                    {isComplete && <Check className="h-3 w-3" />}
                    Cartela {index + 1}
                    <span className="text-[10px] opacity-70">
                      {ticket.numbers.length}/{raffle.numbers_per_ticket}
                    </span>
                    {tickets.length > 1 && (
                      <span
                        onClick={(e) => { e.stopPropagation(); removeTicket(ticket.id); }}
                        className="ml-0.5 opacity-60 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Number Selection Card */}
            <Card className="rounded-xl overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Header: Progress + Actions */}
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-medium">Selecione {raffle.numbers_per_ticket} números</span>
                    <span className="text-muted-foreground/60 ml-1 text-xs">
                      ({raffle.number_range_start}–{raffle.number_range_end})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={generateRandomNumbers}
                    >
                      <Sparkles className="h-3 w-3" />
                      Sortear
                    </Button>
                    {selectedNumbers.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground"
                        onClick={() => setTickets(prev => prev.map(t => t.id === activeTicketId ? { ...t, numbers: [] } : t))}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        selectedNumbers.length === raffle.numbers_per_ticket
                          ? 'bg-green-500'
                          : 'bg-primary'
                      )}
                      style={{ width: `${(selectedNumbers.length / raffle.numbers_per_ticket) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium">
                      {selectedNumbers.length}/{raffle.numbers_per_ticket} selecionados
                    </span>
                    {selectedNumbers.length === raffle.numbers_per_ticket && (
                      <span className="text-green-600 font-medium flex items-center gap-1">
                        <Check className="h-3 w-3" /> Completa!
                      </span>
                    )}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground border-t border-b py-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-muted/80 border border-muted-foreground/20" />
                    <span>Disponível</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-primary" />
                    <span>Selecionado</span>
                  </div>
                  {drawnNumbersSet.size > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-full bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-700" />
                      <span>Já sorteado</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-muted/30 border border-dashed border-muted-foreground/20" />
                    <span>Bloqueado</span>
                  </div>
                </div>

                {/* Number Grid */}
                <div className="max-h-[400px] overflow-auto">
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                    {availableNumbers.map((num) => {
                      const isSelected = selectedNumbers.includes(num);
                      const isDrawn = drawnNumbersSet.has(num);
                      const isFull = selectedNumbers.length >= raffle.numbers_per_ticket && !isSelected;

                      return (
                        <button
                          key={num}
                          onClick={() => toggleNumber(num)}
                          disabled={isFull || isDrawn}
                          className={cn(
                            'h-10 w-10 sm:h-9 sm:w-9 rounded-full font-mono text-xs font-semibold transition-all duration-150',
                            'flex items-center justify-center select-none mx-auto',
                            isDrawn
                              ? 'bg-red-100 text-red-400 line-through cursor-not-allowed opacity-50 dark:bg-red-950/30 dark:text-red-500'
                              : isSelected
                                ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                                : 'bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground',
                            !isDrawn && isFull && 'opacity-25 cursor-not-allowed hover:bg-muted/60'
                          )}
                        >
                          {String(num).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected numbers strip - Always visible */}
                <div className="border-t pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground shrink-0">
                      Seus números ({selectedNumbers.length}/{raffle.numbers_per_ticket}):
                    </span>
                  </div>
                  {selectedNumbers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNumbers
                        .sort((a, b) => a - b)
                        .map((num) => (
                          <button
                            key={num}
                            onClick={() => toggleNumber(num)}
                            className="h-7 min-w-[32px] px-1.5 rounded-lg bg-primary/10 text-primary font-mono text-xs font-semibold hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center justify-center"
                            title="Clique para remover"
                          >
                            {String(num).padStart(2, '0')}
                          </button>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">
                      Nenhum número selecionado. Clique nos números acima ou use "Sortear".
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Accordion: Informações + Regulamento */}
            <Accordion type="multiple" className="mt-6 space-y-2">
              <AccordionItem value="informacoes" className="border rounded-xl px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Informações do Sorteio</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 text-sm pb-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Números por cartela</span>
                      <span className="font-medium">{raffle.numbers_per_ticket}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Range de números</span>
                      <span className="font-medium">
                        {raffle.number_range_start}–{raffle.number_range_end}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rodadas realizadas</span>
                      <span className="font-medium">{raffle.current_draw_count || 0}</span>
                    </div>
                    {raffle.scheduled_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Data</span>
                        <span className="font-medium">
                          {format(new Date(raffle.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modo de prêmio</span>
                      <span className="font-medium">
                        {raffle.prize_mode === 'FIXED' ? 'Valor Fixo'
                          : raffle.prize_mode === 'PERCENT_ONLY' ? 'Percentual das Vendas'
                          : raffle.prize_mode === 'FIXED_PLUS_PERCENT' ? 'Fixo + Percentual'
                          : 'Não definido'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prêmio total acumulado</span>
                      <span className="font-bold text-primary">R$ {prizePool.toFixed(2)}</span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="regulamento" className="border rounded-xl px-4">
                <AccordionTrigger className="hover:no-underline py-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">Regulamento</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {(raffle as any).regulations ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-line pb-2">
                      {(raffle as any).regulations}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum regulamento específico cadastrado para este sorteio.
                    </p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Ranking - Always visible */}
            <div className="mt-6">
              <PublicRanking raffleId={raffle.id} />
            </div>
          </div>

          {/* Right Column - Purchase Summary (Sticky) */}
          <div className="hidden lg:block">
            <div className="sticky top-[4rem] space-y-4">
              <Card className="rounded-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Resumo da Compra
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Tickets list */}
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {tickets.map((ticket, index) => {
                      const isComplete = ticket.numbers.length === raffle.numbers_per_ticket;
                      return (
                        <div
                          key={ticket.id}
                          className={cn(
                            'rounded-lg border p-2 text-xs',
                            isComplete ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-muted'
                          )}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">Cartela {index + 1}</span>
                            <div className="flex items-center gap-1">
                              <Badge variant={isComplete ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
                                {isComplete ? <Check className="h-2.5 w-2.5 mr-0.5" /> : null}
                                {ticket.numbers.length}/{raffle.numbers_per_ticket}
                              </Badge>
                              {tickets.length > 1 && (
                                <button
                                  onClick={() => removeTicket(ticket.id)}
                                  className="h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Remover cartela"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          {ticket.numbers.length > 0 ? (
                            <div className="flex flex-wrap gap-0.5">
                              {ticket.numbers.sort((a, b) => a - b).map(num => (
                                <span key={num} className="font-mono text-[10px] bg-primary/10 text-primary rounded px-1">
                                  {String(num).padStart(2, '0')}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <button
                              onClick={() => setActiveTicketId(ticket.id)}
                              className="text-primary text-[10px] font-medium hover:underline flex items-center gap-1"
                            >
                              <Hash className="h-2.5 w-2.5" />
                              Escolher números
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Price breakdown */}
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{tickets.length} cartela(s) × R$ {ticketPrice.toFixed(2)}</span>
                      <span className={discountPercent > 0 ? "line-through text-muted-foreground text-xs" : "font-medium"}>
                        R$ {totalPrice.toFixed(2)}
                      </span>
                    </div>
                    {discountPercent > 0 && (
                      <div className="flex justify-between text-sm text-green-600 font-medium">
                        <span>Desconto ({discountPercent}%)</span>
                        <span>- R$ {discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span>R$ {finalPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* CTA Button */}
                  {countdown.isOpen ? (
                    <Button
                      size="lg"
                      className={cn(
                        'w-full h-12 text-base',
                        allTicketsComplete && 'animate-pulse'
                      )}
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
                        ? `Comprar - R$ ${finalPrice.toFixed(2)}`
                        : `${tickets.filter(t => t.numbers.length === raffle.numbers_per_ticket).length}/${tickets.length} completas`
                      }
                    </Button>
                  ) : (
                    <Button size="lg" className="w-full h-12" disabled variant="secondary">
                      <Lock className="mr-2 h-5 w-5" />
                      Aguardando Abertura
                    </Button>
                  )}

                  {/* Payment methods trust signal */}
                  <div className="flex items-center justify-center gap-3 pt-2 text-muted-foreground/50">
                    <CreditCard className="h-4 w-4" />
                    <span className="text-[10px] uppercase tracking-wider">Pagamento seguro</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" style={{ borderTop: `2px solid ${company.primary_color}` }}>
        <div className="container mx-auto px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">{tickets.length}x cartela</p>
              <p className="text-xs text-muted-foreground">
                {tickets.filter(t => t.numbers.length === raffle.numbers_per_ticket).length}/{tickets.length} completas
              </p>
            </div>
            <div className="text-right">
              {discountPercent > 0 && (
                <p className="text-xs text-muted-foreground line-through">R$ {totalPrice.toFixed(2)}</p>
              )}
              <p className="font-bold text-lg">R$ {finalPrice.toFixed(2)}</p>
              {discountPercent > 0 && (
                <Badge className="bg-green-600 text-white text-[10px] h-4 px-1.5">-{discountPercent}%</Badge>
              )}
            </div>
          </div>
          {countdown.isOpen ? (
            <Button
              size="lg"
              className="w-full h-12"
              disabled={!allTicketsComplete}
              onClick={() => {
                if (!isAuthenticated) {
                  openAuth('login');
                } else {
                  setPurchaseDialogOpen(true);
                }
              }}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {allTicketsComplete
                ? `Comprar - R$ ${finalPrice.toFixed(2)}`
                : `${tickets.filter(t => t.numbers.length === raffle.numbers_per_ticket).length}/${tickets.length} completas`
              }
            </Button>
          ) : (
            <Button size="lg" className="w-full h-12" disabled variant="secondary">
              <Lock className="mr-2 h-4 w-4" />
              Aguardando Abertura
            </Button>
          )}
        </div>
      </div>

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
                <span className={discountPercent > 0 ? "line-through text-muted-foreground" : ""}>R$ {totalPrice.toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>Desconto ({discountPercent}%)</span>
                  <span>- R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total</span>
                <span>R$ {finalPrice.toFixed(2)}</span>
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
                  Pagar R$ {finalPrice.toFixed(2)}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prompt to add another ticket when current one is complete */}
      <Dialog open={addAnotherTicketDialogOpen} onOpenChange={setAddAnotherTicketDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar mais 1 cartela?</DialogTitle>
            <DialogDescription>
              Você completou os {raffle?.numbers_per_ticket} números desta cartela. Quer adicionar mais uma para aumentar suas chances?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAnotherTicketDialogOpen(false)}>
              Não, continuar
            </Button>
            <Button
              onClick={() => {
                setAddAnotherTicketDialogOpen(false);
                addTicket();
              }}
            >
              Adicionar 1 cartela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending Payment Dialog */}
      <Dialog open={pendingPaymentDialogOpen} onOpenChange={setPendingPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Pagamento Pendente
            </DialogTitle>
            <DialogDescription>
              Você tem um pagamento pendente de R$ {pendingPayment?.amount?.toFixed(2)} para este sorteio. Deseja concluir o pagamento?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPaymentDialogOpen(false)}>
              Agora não
            </Button>
            <Button onClick={handleResumePayment} disabled={isResumingPayment}>
              {isResumingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Abrindo...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Concluir Pagamento
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

      <PublicFooter />
    </div>
  );
}
