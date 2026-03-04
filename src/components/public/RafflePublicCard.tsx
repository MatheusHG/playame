import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Hash, Trophy, Clock, ShoppingCart, Eye, Lock, Calendar, Tag, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { differenceInSeconds, differenceInDays, differenceInHours, differenceInMinutes, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RafflePublicCardProps {
  raffle: any;
}

export function RafflePublicCard({ raffle }: RafflePublicCardProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState<{ text: string; isOpen: boolean }>({ text: '', isOpen: true });
  const [previewOpen, setPreviewOpen] = useState(false);
  const detailUrl = `/sorteio/${raffle.id}`;

  const ticketPrice = Number(raffle.ticket_price);

  const prizeTiers = raffle.prize_tiers?.sort((a: any, b: any) => b.hits_required - a.hits_required) || [];

  // Fetch discounts for this raffle
  const { data: discounts = [] } = useQuery({
    queryKey: ['raffle-discounts', raffle.id],
    queryFn: async () => {
      return api.get<any[]>(`/raffles/${raffle.id}/discounts`);
    },
  });

  const activeDiscounts = discounts.filter((d: any) => d.is_active).sort((a: any, b: any) => a.min_quantity - b.min_quantity);
  const maxDiscount = activeDiscounts.length > 0 ? Math.max(...activeDiscounts.map((d: any) => Number(d.discount_percent))) : 0;

  // Fetch net sales (já com taxas descontadas) para cálculo do prêmio
  const { data: netSales = 0 } = useQuery({
    queryKey: ['raffle-net-sales', raffle.id],
    queryFn: async () => {
      const data = await api.get<{ total: number }>(`/payments/net-sales/${raffle.id}`);
      return data.total || 0;
    },
  });

  // Calculate prize pool - netSales already = SUM(prize_pool_contribution)
  const calculatePrizePool = (): number => {
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

  // Update countdown - scheduled_at is the START date
  // Skip countdown if raffle is already active (manually activated before scheduled date)
  useEffect(() => {
    if (!raffle.scheduled_at || raffle.status === 'active') {
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
  }, [raffle.scheduled_at, raffle.status]);

  return (
    <>
      <div
        className={`group flex flex-col h-full rounded-2xl border bg-card overflow-hidden transition-all cursor-pointer ${countdown.isOpen ? 'hover:shadow-xl hover:-translate-y-1' : 'opacity-90'}`}
        onClick={() => countdown.isOpen ? navigate(detailUrl) : setPreviewOpen(true)}
      >
        {/* Image Section - Prominent */}
        <div className="relative overflow-hidden">
          {raffle.image_url ? (
            <img
              src={raffle.image_url}
              alt={raffle.name}
              className={`w-full aspect-[4/3] object-cover transition-transform duration-300 group-hover:scale-105 ${!countdown.isOpen ? 'grayscale' : ''}`}
            />
          ) : (
            <div className="w-full aspect-[4/3] bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
              <Trophy className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Badges overlay on image */}
          <div className="absolute top-3 left-3 flex gap-1.5">
            {countdown.isOpen ? (
              <Badge className="bg-green-600 text-white text-xs shadow-sm">Ativo</Badge>
            ) : (
              <Badge className="bg-amber-500 text-white text-xs shadow-sm">
                <Lock className="h-3 w-3 mr-1" />
                Em breve
              </Badge>
            )}
          </div>

          <div className="absolute top-3 right-3 flex gap-1.5">
            {maxDiscount > 0 && (
              <Badge className="bg-red-500 text-white text-xs font-bold shadow-sm">
                -{maxDiscount}% OFF
              </Badge>
            )}
          </div>

          {/* Price badge overlay - bottom left */}
          <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-background/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-lg">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">Cartela</p>
            <p className="text-lg font-extrabold text-foreground leading-tight">R$ {ticketPrice.toFixed(2)}</p>
          </div>

          {/* Prize pool badge - bottom right */}
          {prizePool > 0 && (
            <div className="absolute bottom-3 right-3 bg-yellow-500/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-lg">
              <p className="text-[10px] uppercase tracking-wider text-yellow-900/70 leading-none">Prêmio</p>
              <p className="text-lg font-extrabold text-yellow-900 leading-tight flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" />
                R$ {prizePool.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Content Section - Clean and compact */}
        <div className="flex flex-col flex-1 p-4">
          {/* Title + Description */}
          <h3 className="text-lg font-bold leading-tight mb-1">{raffle.name}</h3>
          {raffle.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{raffle.description}</p>
          )}

          {/* Countdown */}
          {!countdown.isOpen && countdown.text && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-center mb-3">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Lock className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium text-amber-800 dark:text-amber-200">Abre em</span>
              </div>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300 font-mono">
                {countdown.text}
              </p>
            </div>
          )}

          {/* Info chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Badge variant="outline" className="gap-1 text-[11px] py-0.5 font-normal">
              <Hash className="h-3 w-3" />
              {raffle.numbers_per_ticket} números
            </Badge>
            <Badge variant="outline" className="gap-1 text-[11px] py-0.5 font-normal">
              <Clock className="h-3 w-3" />
              {raffle.current_draw_count || 0} rodadas
            </Badge>
            {raffle.scheduled_at && (
              <Badge variant="outline" className="gap-1 text-[11px] py-0.5 font-normal">
                <Calendar className="h-3 w-3" />
                {format(new Date(raffle.scheduled_at), "dd/MM", { locale: ptBR })}
              </Badge>
            )}
          </div>

          {/* Promotions - Compact */}
          {activeDiscounts.length > 0 && (
            <div className="flex items-center gap-1.5 mb-3 text-xs">
              <Tag className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <span className="text-green-700 dark:text-green-400 font-medium">
                {activeDiscounts.length === 1
                  ? `${activeDiscounts[0].min_quantity}+ cartelas: ${Number(activeDiscounts[0].discount_percent)}% off`
                  : `Combos de ${activeDiscounts[0].min_quantity} a ${activeDiscounts[activeDiscounts.length - 1].min_quantity} cartelas`
                }
              </span>
            </div>
          )}

          {/* Prize Tiers - Compact top 2 */}
          {prizeTiers.length > 0 && (
            <div className="space-y-1 mb-4">
              {prizeTiers.slice(0, 2).map((tier: any) => {
                const tierPrize = tier.prize_type === 'money'
                  ? prizePool * (Number(tier.prize_percentage) / 100)
                  : 0;
                return (
                  <div key={tier.id} className="flex justify-between text-xs bg-muted/50 rounded-lg px-2.5 py-1.5">
                    <span className="text-muted-foreground">{tier.hits_required} acertos ({tier.prize_percentage}%)</span>
                    <span className="font-semibold">
                      {tier.prize_type === 'object'
                        ? tier.object_description
                        : `R$ ${tierPrize.toFixed(2)}`}
                    </span>
                  </div>
                );
              })}
              {prizeTiers.length > 2 && (
                <p className="text-[11px] text-muted-foreground text-center">
                  + {prizeTiers.length - 2} faixas de prêmio
                </p>
              )}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* CTA */}
          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            {countdown.isOpen ? (
              <Button className="w-full h-11 text-sm font-semibold" size="lg" asChild>
                <Link to={detailUrl}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Comprar — R$ {ticketPrice.toFixed(2)}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button className="w-full h-11" size="lg" disabled variant="secondary">
                  <Lock className="mr-2 h-4 w-4" />
                  Aguardando Abertura
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setPreviewOpen(true)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Prévia do Sorteio
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{raffle.name}</DialogTitle>
          </DialogHeader>

          {raffle.image_url && (
            <div className="aspect-video relative overflow-hidden rounded-lg">
              <img
                src={raffle.image_url}
                alt={raffle.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {raffle.description && (
            <p className="text-sm text-muted-foreground">{raffle.description}</p>
          )}

          <Separator />

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">R$ {ticketPrice.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">por cartela</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">R$ {prizePool.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">prêmio total</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <Hash className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{raffle.numbers_per_ticket} números</p>
                <p className="text-xs text-muted-foreground">
                  de {raffle.number_range_start} a {raffle.number_range_end}
                </p>
              </div>
            </div>
            {raffle.scheduled_at && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {format(new Date(raffle.scheduled_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(raffle.scheduled_at), "'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Countdown */}
          {!countdown.isOpen && countdown.text && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Lock className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Abre em</span>
              </div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 font-mono">
                {countdown.text}
              </p>
            </div>
          )}

          {/* Prize Tiers */}
          {prizeTiers.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Faixas de Prêmio
                </h4>
                <div className="space-y-2">
                  {prizeTiers.map((tier: any) => {
                    const tierPrize = tier.prize_type === 'money'
                      ? prizePool * (Number(tier.prize_percentage) / 100)
                      : 0;

                    return (
                      <div key={tier.id} className="flex justify-between items-center text-sm bg-muted/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{tier.prize_percentage}%</Badge>
                          <span>{tier.hits_required} acertos</span>
                        </div>
                        <span className="font-semibold">
                          {tier.prize_type === 'object'
                            ? tier.object_description
                            : `R$ ${tierPrize.toFixed(2)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Regulations */}
          {raffle.regulations && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Regulamento</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{raffle.regulations}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
