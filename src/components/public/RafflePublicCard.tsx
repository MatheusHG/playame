import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, Hash, Trophy, Clock, ShoppingCart, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePlayer } from '@/contexts/PlayerContext';
import { useToast } from '@/hooks/use-toast';
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

  const ticketPrice = Number(raffle.ticket_price);
  const totalPrice = ticketPrice * quantity;

  const prizeTiers = raffle.prize_tiers?.sort((a, b) => b.hits_required - a.hits_required) || [];

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
      <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{raffle.name}</CardTitle>
              {raffle.description && (
                <CardDescription className="mt-1 line-clamp-2">{raffle.description}</CardDescription>
              )}
            </div>
            <Badge variant="default">Ativo</Badge>
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
              <Hash className="h-4 w-4 text-primary" />
              <div>
                <p className="font-semibold">{raffle.numbers_per_ticket} números</p>
                <p className="text-xs text-muted-foreground">{raffle.number_range_start}-{raffle.number_range_end}</p>
              </div>
            </div>
          </div>

          {/* Prize Tiers */}
          {prizeTiers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Faixas de Prêmio
              </p>
              <div className="space-y-1">
                {prizeTiers.slice(0, 3).map((tier) => (
                  <div key={tier.id} className="flex justify-between text-sm bg-muted/50 rounded px-2 py-1">
                    <span>{tier.hits_required} acertos</span>
                    <span className="font-medium">
                      {tier.prize_type === 'object'
                        ? tier.object_description
                        : `${tier.prize_percentage}% do prêmio`}
                    </span>
                  </div>
                ))}
                {prizeTiers.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    + {prizeTiers.length - 3} faixas
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Draw count */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{raffle.current_draw_count || 0} números sorteados</span>
          </div>
        </CardContent>

        <CardFooter>
          <Button className="w-full" size="lg" onClick={handleBuyClick}>
            <ShoppingCart className="mr-2 h-5 w-5" />
            Comprar Cartela
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
