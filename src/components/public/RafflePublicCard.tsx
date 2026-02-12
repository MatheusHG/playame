import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Hash, Trophy, Clock, ShoppingCart, Eye, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInSeconds, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Raffle = Database['public']['Tables']['raffles']['Row'] & {
  prize_tiers: Database['public']['Tables']['prize_tiers']['Row'][];
};

interface RafflePublicCardProps {
  raffle: Raffle;
  companySlug: string;
}

export function RafflePublicCard({ raffle, companySlug }: RafflePublicCardProps) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState<{ text: string; isOpen: boolean }>({ text: '', isOpen: true });
  const detailUrl = `/empresa/${companySlug}/sorteio/${raffle.id}`;

  const ticketPrice = Number(raffle.ticket_price);

  const prizeTiers = raffle.prize_tiers?.sort((a, b) => b.hits_required - a.hits_required) || [];

  // Fetch net sales (já com taxas descontadas) para cálculo do prêmio
  const { data: netSales = 0 } = useQuery({
    queryKey: ['raffle-net-sales', raffle.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('net_amount')
        .eq('raffle_id', raffle.id)
        .eq('status', 'succeeded');

      if (error) throw error;
      return data?.reduce((sum, p) => sum + Number(p.net_amount || 0), 0) || 0;
    },
  });

  // Calculate prize pool
  const calculatePrizePool = (): number => {
    if (raffle.prize_mode === 'FIXED') {
      return Number(raffle.fixed_prize_value) || 0;
    }
    if (raffle.prize_mode === 'PERCENT_ONLY') {
      return netSales * (Number(raffle.prize_percent_of_sales) / 100);
    }
    // FIXED_PLUS_PERCENT
    return (Number(raffle.fixed_prize_value) || 0) + netSales * (Number(raffle.prize_percent_of_sales) / 100);
  };

  const prizePool = calculatePrizePool();

  // Update countdown - scheduled_at is the START date
  useEffect(() => {
    if (!raffle.scheduled_at) {
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
  }, [raffle.scheduled_at]);

  return (
    <Card
      className={`flex flex-col h-full transition-shadow overflow-hidden cursor-pointer ${countdown.isOpen ? 'hover:shadow-lg' : 'opacity-90'}`}
      onClick={() => navigate(detailUrl)}
    >
      {/* Raffle Image */}
      {raffle.image_url && (
        <div className="aspect-video relative overflow-hidden">
          <img
            src={raffle.image_url}
            alt={raffle.name}
            className={`w-full h-full object-cover ${!countdown.isOpen ? 'grayscale' : ''}`}
          />
          {countdown.isOpen ? (
            <Badge variant="default" className="absolute top-2 right-2">Ativo</Badge>
          ) : (
            <Badge variant="secondary" className="absolute top-2 right-2">
              <Lock className="h-3 w-3 mr-1" />
              Em breve
            </Badge>
          )}
        </div>
      )}
      <CardHeader className={raffle.image_url ? 'pt-4' : ''}>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{raffle.name}</CardTitle>
            {raffle.description && (
              <CardDescription className="mt-1 line-clamp-2">{raffle.description}</CardDescription>
            )}
          </div>
          {!raffle.image_url && (
            countdown.isOpen ? (
              <Badge variant="default">Ativo</Badge>
            ) : (
              <Badge variant="secondary">
                <Lock className="h-3 w-3 mr-1" />
                Em breve
              </Badge>
            )
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Countdown to Opening */}
        {!countdown.isOpen && countdown.text && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Lock className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-amber-800 dark:text-amber-200">Abre em</span>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 font-mono">
              {countdown.text}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <p className="font-semibold">R$ {ticketPrice.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">por cartela</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="h-4 w-4 text-primary" />
            <div>
              <p className="font-semibold">R$ {prizePool.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">prêmio total</p>
            </div>
          </div>
        </div>

        {/* Prize Tiers - Show real values */}
        {prizeTiers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Faixas de Prêmio
            </p>
            <div className="space-y-1">
              {prizeTiers.slice(0, 3).map((tier) => {
                const tierPrize = tier.prize_type === 'money' 
                  ? prizePool * (Number(tier.prize_percentage) / 100)
                  : 0;
                
                return (
                  <div key={tier.id} className="flex justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <span>{tier.hits_required} acertos</span>
                    <span className="font-medium">
                      {tier.prize_type === 'object'
                        ? tier.object_description
                        : `R$ ${tierPrize.toFixed(2)}`}
                    </span>
                  </div>
                );
              })}
              {prizeTiers.length > 3 && (
                <p className="text-xs text-muted-foreground text-center">
                  + {prizeTiers.length - 3} faixas
                </p>
              )}
            </div>
          </div>
        )}

        {/* Info row */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Hash className="h-4 w-4" />
            <span>{raffle.numbers_per_ticket} números</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{raffle.current_draw_count || 0} sorteados</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
        {countdown.isOpen ? (
          <Button className="w-full" size="lg" asChild>
            <Link to={detailUrl}>
              <ShoppingCart className="mr-2 h-5 w-5" />
              Comprar Cartela
            </Link>
          </Button>
        ) : (
          <>
            <Button className="w-full" size="lg" disabled variant="secondary">
              <Lock className="mr-2 h-5 w-5" />
              Aguardando Abertura
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link to={detailUrl}>
                <Eye className="mr-2 h-4 w-4" />
                Prévia do Sorteio
              </Link>
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
