import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';

type RaffleDiscount = {
  id: string;
  raffle_id: string;
  min_quantity: number;
  discount_percent: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function RaffleDiscountsManager({ raffleId }: { raffleId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newMinQty, setNewMinQty] = useState<number>(5);
  const [newPercent, setNewPercent] = useState<number>(10);

  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ['raffle-discounts', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raffle_discounts')
        .select('*')
        .eq('raffle_id', raffleId)
        .order('min_quantity', { ascending: false });
      if (error) throw error;
      return (data || []) as RaffleDiscount[];
    },
  });

  const discountsById = useMemo(() => {
    const map: Record<string, RaffleDiscount> = {};
    for (const d of discounts) map[d.id] = d;
    return map;
  }, [discounts]);

  const [draft, setDraft] = useState<Record<string, { min_quantity: number; discount_percent: number; is_active: boolean }>>(
    {}
  );

  const upsertDraftFromRow = (id: string) => {
    const row = discountsById[id];
    if (!row) return;
    setDraft((prev) => ({
      ...prev,
      [id]: {
        min_quantity: Number(row.min_quantity),
        discount_percent: Number(row.discount_percent),
        is_active: !!row.is_active,
      },
    }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        raffle_id: raffleId,
        min_quantity: Math.max(1, Math.floor(Number(newMinQty) || 1)),
        discount_percent: round2(Math.min(100, Math.max(0, Number(newPercent) || 0))),
        is_active: true,
      };
      const { data, error } = await supabase.from('raffle_discounts').insert(payload).select('*').single();
      if (error) throw error;
      return data as RaffleDiscount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-discounts', raffleId] });
      toast({ title: 'Regra de desconto criada!' });
    },
    onError: (e: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar desconto',
        description: e?.message ?? 'Tente novamente.',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (id: string) => {
      const d = draft[id];
      if (!d) throw new Error('Nada para salvar.');

      const payload = {
        min_quantity: Math.max(1, Math.floor(Number(d.min_quantity) || 1)),
        discount_percent: round2(Math.min(100, Math.max(0, Number(d.discount_percent) || 0))),
        is_active: !!d.is_active,
      };

      const { data, error } = await supabase.from('raffle_discounts').update(payload).eq('id', id).select('*').single();
      if (error) throw error;
      return data as RaffleDiscount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-discounts', raffleId] });
      toast({ title: 'Desconto atualizado!' });
    },
    onError: (e: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar desconto',
        description: e?.message ?? 'Tente novamente.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('raffle_discounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-discounts', raffleId] });
      toast({ title: 'Regra removida.' });
    },
    onError: (e: any) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover desconto',
        description: e?.message ?? 'Tente novamente.',
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Descontos</CardTitle>
        <CardDescription>
          Configure promoções por quantidade de cartelas (ex.: a cada 5 cartelas, 10% off). A regra aplicada é sempre a de
          maior <span className="font-medium">quantidade mínima</span> atingida.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="min_qty">A partir de (cartelas)</Label>
              <Input
                id="min_qty"
                type="number"
                min={1}
                value={newMinQty}
                onChange={(e) => setNewMinQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pct">Desconto (%)</Label>
              <Input
                id="pct"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={newPercent}
                onChange={(e) => setNewPercent(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar regra
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-6 text-sm text-muted-foreground">Carregando regras...</div>
        ) : discounts.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">Nenhuma regra cadastrada ainda.</div>
        ) : (
          <div className="space-y-3">
            {discounts.map((row) => {
              const d = draft[row.id] ?? {
                min_quantity: row.min_quantity,
                discount_percent: row.discount_percent,
                is_active: row.is_active,
              };

              const isDirty =
                d.min_quantity !== row.min_quantity ||
                Number(d.discount_percent) !== Number(row.discount_percent) ||
                d.is_active !== row.is_active;

              return (
                <div key={row.id} className="rounded-lg border p-4">
                  <div className="grid gap-4 sm:grid-cols-12 sm:items-end">
                    <div className="sm:col-span-3 space-y-2">
                      <Label>A partir de (cartelas)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={d.min_quantity}
                        onFocus={() => upsertDraftFromRow(row.id)}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [row.id]: { ...d, min_quantity: Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-2">
                      <Label>Desconto (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={d.discount_percent}
                        onFocus={() => upsertDraftFromRow(row.id)}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [row.id]: { ...d, discount_percent: Number(e.target.value) },
                          }))
                        }
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <Switch
                        checked={!!d.is_active}
                        onCheckedChange={(checked) =>
                          setDraft((prev) => ({
                            ...prev,
                            [row.id]: { ...d, is_active: checked },
                          }))
                        }
                      />
                      <span className="text-sm text-muted-foreground">{d.is_active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                    <div className="sm:col-span-4 flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => updateMutation.mutate(row.id)}
                        disabled={!isDirty || updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Salvar
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(row.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Removendo...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

