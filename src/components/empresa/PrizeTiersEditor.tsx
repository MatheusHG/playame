import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PrizeTier = Database['public']['Tables']['prize_tiers']['Row'];
type PrizeType = Database['public']['Enums']['prize_type'];

interface PrizeTierInput {
  id?: string;
  hits_required: number;
  prize_percentage: number;
  prize_type: PrizeType;
  purchase_allowed_until_draw_count: number | null;
  object_description: string | null;
}

interface PrizeTiersEditorProps {
  tiers: PrizeTier[];
  onSave: (tiers: Omit<PrizeTierInput, 'id'>[]) => void;
  isLoading?: boolean;
  maxHits?: number;
}

export function PrizeTiersEditor({ tiers, onSave, isLoading, maxHits = 20 }: PrizeTiersEditorProps) {
  const [editedTiers, setEditedTiers] = useState<PrizeTierInput[]>([]);

  useEffect(() => {
    if (tiers.length > 0) {
      setEditedTiers(
        tiers.map(t => ({
          id: t.id,
          hits_required: t.hits_required,
          prize_percentage: Number(t.prize_percentage),
          prize_type: t.prize_type || 'money',
          purchase_allowed_until_draw_count: t.purchase_allowed_until_draw_count,
          object_description: t.object_description,
        }))
      );
    } else {
      // Default tiers
      setEditedTiers([
        { hits_required: maxHits, prize_percentage: 50, prize_type: 'money', purchase_allowed_until_draw_count: null, object_description: null },
        { hits_required: maxHits - 1, prize_percentage: 30, prize_type: 'money', purchase_allowed_until_draw_count: null, object_description: null },
        { hits_required: maxHits - 2, prize_percentage: 20, prize_type: 'money', purchase_allowed_until_draw_count: null, object_description: null },
      ]);
    }
  }, [tiers, maxHits]);

  const addTier = () => {
    const lowestHits = Math.min(...editedTiers.map(t => t.hits_required), maxHits);
    setEditedTiers([
      ...editedTiers,
      {
        hits_required: Math.max(1, lowestHits - 1),
        prize_percentage: 0,
        prize_type: 'money',
        purchase_allowed_until_draw_count: null,
        object_description: null,
      },
    ]);
  };

  const removeTier = (index: number) => {
    setEditedTiers(editedTiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, updates: Partial<PrizeTierInput>) => {
    setEditedTiers(
      editedTiers.map((tier, i) => (i === index ? { ...tier, ...updates } : tier))
    );
  };

  const handleSave = () => {
    const tiersToSave = editedTiers.map(({ id, ...rest }) => rest);
    onSave(tiersToSave);
  };

  const totalPercentage = editedTiers.reduce((sum, t) => sum + t.prize_percentage, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faixas de Premiação</CardTitle>
        <CardDescription>
          Configure as faixas de acertos e percentual de prêmio para cada uma.
          Total: {totalPercentage}% {totalPercentage !== 100 && <span className="text-destructive">(deve ser 100%)</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {editedTiers
          .sort((a, b) => b.hits_required - a.hits_required)
          .map((tier, index) => (
            <div key={index} className="grid grid-cols-12 gap-3 items-start p-4 border rounded-lg">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Acertos</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxHits}
                  value={tier.hits_required}
                  onChange={(e) => updateTier(index, { hits_required: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">% do Prêmio</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={tier.prize_percentage}
                  onChange={(e) => updateTier(index, { prize_percentage: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={tier.prize_type}
                  onValueChange={(value: PrizeType) => updateTier(index, { prize_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="money">Dinheiro</SelectItem>
                    <SelectItem value="object">Objeto</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Limite Rodada</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Sem limite"
                  value={tier.purchase_allowed_until_draw_count ?? ''}
                  onChange={(e) =>
                    updateTier(index, {
                      purchase_allowed_until_draw_count: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
                />
              </div>

              {tier.prize_type === 'object' && (
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Descrição do Objeto</Label>
                  <Textarea
                    value={tier.object_description || ''}
                    onChange={(e) => updateTier(index, { object_description: e.target.value || null })}
                    placeholder="Ex: Moto Honda CG 160"
                    rows={1}
                  />
                </div>
              )}

              <div className={`${tier.prize_type === 'object' ? 'col-span-1' : 'col-span-4'} flex justify-end`}>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeTier(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={addTier}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Faixa
          </Button>

          <Button onClick={handleSave} disabled={isLoading || totalPercentage !== 100}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Faixas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
