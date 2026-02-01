import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Hash, Trophy, Clock, ShoppingCart, Loader2, Check, Timer, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import { useToast } from '@/hooks/use-toast';
import { differenceInSeconds, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Raffle = Database['public']['Tables']['raffles']['Row'] & {
  prize_tiers: Database['public']['Tables']['prize_tiers']['Row'][];
};

interface RafflePublicCardProps {
  raffle: Raffle;
  companySlug: string;
  isAuthenticated: boolean;
  onBuyClick: () => void;
}

export function RafflePublicCard({ raffle, companySlug, isAuthenticated, onBuyClick }: RafflePublicCardProps) {
  const { player } = usePlayer();
  const { toast } = useToast();
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  const ticketPrice = Number(raffle.ticket_price);
  const totalPrice = ticketPrice * quantity;

  const prizeTiers = raffle.prize_tiers?.sort((a, b) => b.hits_required - a.hits_required) || [];

  // Fetch total sales for prize calculation
  const { data: totalSales = 0 } = useQuery({
    queryKey: ['raffle-sales', raffle.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('amount')
        .eq('raffle_id', raffle.id)
        .eq('status', 'succeeded');

      if (error) throw error;
      return data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    },
  });

  // Calculate prize pool
  const calculatePrizePool = (): number => {
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

  // Update time remaining countdown
  useEffect(() => {
    if (!raffle.scheduled_at) {
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

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [raffle.scheduled_at]);

  const handleBuyClick = () => {
    if (!isAuthenticated) {
      onBuyClick();
    } else {
      setBuyDialogOpen(true);
    }
  };

  const handlePurchase = async () => {
    if (!player) return;

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-ticket-checkout', {
        body: {
          companyId: raffle.company_id,
          playerId: player.id,
          raffleId: raffle.id,
          quantity,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Redirect to Stripe checkout
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

  return (
    <>
      <Card className="flex flex-col h-full hover:shadow-lg transition-shadow overflow-hidden">
        {/* Raffle Image */}
        {raffle.image_url && (
          <div className="aspect-video relative overflow-hidden">
            <img
              src={raffle.image_url}
              alt={raffle.name}
              className="w-full h-full object-cover"
            />
            <Badge variant="default" className="absolute top-2 right-2">Ativo</Badge>
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
            {!raffle.image_url && <Badge variant="default">Ativo</Badge>}
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
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

          {/* Time Remaining */}
          {timeRemaining && (
            <div className="flex items-center gap-2 text-sm bg-accent/50 rounded-lg px-3 py-2">
              <Timer className="h-4 w-4 text-primary" />
              <span className="font-medium">{timeRemaining}</span>
              <span className="text-muted-foreground">restante</span>
            </div>
          )}

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

        <CardFooter className="flex flex-col gap-2">
          <Button className="w-full" size="lg" onClick={handleBuyClick}>
            <ShoppingCart className="mr-2 h-5 w-5" />
            Comprar Cartela
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to={`/empresa/${companySlug}/sorteio/${raffle.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              Ver Detalhes
            </Link>
          </Button>
        </CardFooter>
      </Card>

      {/* Purchase Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprar Cartela</DialogTitle>
            <DialogDescription>
              {raffle.name} - R$ {ticketPrice.toFixed(2)} por cartela
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade de Cartelas</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">
                Cada cartela terá {raffle.numbers_per_ticket} números aleatórios
              </p>
            </div>

            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Cartela × {quantity}</span>
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
            <Button variant="outline" onClick={() => setBuyDialogOpen(false)}>
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
    </>
  );
}
