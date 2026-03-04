import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Percent, Tag } from 'lucide-react';

interface RafflePromotionsManagerProps {
  raffleId: string;
  ticketPrice: number;
}

interface RaffleDiscount {
  id: string;
  raffle_id: string;
  min_quantity: number;
  discount_percent: number;
  is_active: boolean;
  created_at: string;
}

export function RafflePromotionsManager({ raffleId, ticketPrice }: RafflePromotionsManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [minQuantity, setMinQuantity] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ['raffle-discounts', raffleId],
    queryFn: () => api.get<RaffleDiscount[]>(`/raffles/${raffleId}/discounts`),
  });

  const createMutation = useMutation({
    mutationFn: (data: { min_quantity: number; discount_percent: number }) =>
      api.post(`/raffles/${raffleId}/discounts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-discounts', raffleId] });
      setMinQuantity('');
      setDiscountPercent('');
      toast({ title: 'Promoção criada com sucesso!' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (discountId: string) =>
      api.delete(`/raffles/${raffleId}/discounts/${discountId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-discounts', raffleId] });
      toast({ title: 'Promoção removida!' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    },
  });

  const handleCreate = () => {
    const qty = parseInt(minQuantity, 10);
    const pct = parseFloat(discountPercent);

    if (!qty || qty < 2) {
      toast({ variant: 'destructive', title: 'Quantidade mínima deve ser pelo menos 2' });
      return;
    }
    if (!pct || pct <= 0 || pct > 100) {
      toast({ variant: 'destructive', title: 'Desconto deve ser entre 0.01% e 100%' });
      return;
    }

    createMutation.mutate({ min_quantity: qty, discount_percent: pct });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Promoções por Quantidade
        </CardTitle>
        <CardDescription>
          Configure descontos automáticos para compras com múltiplas cartelas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form para criar nova promoção */}
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="space-y-1 flex-1">
            <Label htmlFor="min_quantity" className="text-xs">A partir de (cartelas)</Label>
            <Input
              id="min_quantity"
              type="number"
              min={2}
              placeholder="Ex: 3"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1 flex-1">
            <Label htmlFor="discount_percent" className="text-xs">Desconto (%)</Label>
            <Input
              id="discount_percent"
              type="number"
              min={0.01}
              max={100}
              step={0.01}
              placeholder="Ex: 10"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="shrink-0"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            Adicionar
          </Button>
        </div>

        {/* Lista de promoções existentes */}
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : discounts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma promoção configurada ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {discounts.map((d) => {
              const pricePerTicket = ticketPrice * (1 - Number(d.discount_percent) / 100);
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="shrink-0">
                      <Percent className="h-3 w-3 mr-1" />
                      {Number(d.discount_percent)}%
                    </Badge>
                    <div className="text-sm">
                      <span className="font-medium">
                        A partir de {d.min_quantity} cartelas
                      </span>
                      <span className="text-muted-foreground ml-2">
                        ({formatCurrency(pricePerTicket)}/cartela)
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(d.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
