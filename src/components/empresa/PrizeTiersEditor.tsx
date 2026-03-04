import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, Loader2, Save, Lock } from 'lucide-react';
import type { PrizeTier, PrizeType } from '@/types/database.types';

export interface PrizeTierInput {
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
  currentDrawCount?: number;
}

export function PrizeTiersEditor({ tiers, onSave, isLoading, maxHits = 20, currentDrawCount = 0 }: PrizeTiersEditorProps) {
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
        <TierRows tiers={editedTiers} maxHits={maxHits} onUpdate={updateTier} onRemove={removeTier} currentDrawCount={currentDrawCount} />

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

/* ── Shared tier rows UI ─────────────────────────────────────── */

function TierRows({
  tiers,
  maxHits,
  onUpdate,
  onRemove,
  currentDrawCount = 0,
}: {
  tiers: PrizeTierInput[];
  maxHits: number;
  onUpdate: (index: number, updates: Partial<PrizeTierInput>) => void;
  onRemove: (index: number) => void;
  currentDrawCount?: number;
}) {
  return (
    <>
      {[...tiers]
        .sort((a, b) => b.hits_required - a.hits_required)
        .map((tier, index) => {
          const isLocked =
            tier.purchase_allowed_until_draw_count != null &&
            currentDrawCount > 0 &&
            currentDrawCount >= tier.purchase_allowed_until_draw_count;

          return (
            <div
              key={index}
              className={`grid grid-cols-12 gap-3 items-start p-4 border rounded-lg ${
                isLocked ? 'bg-muted/40 border-amber-200 dark:border-amber-800' : ''
              }`}
            >
              {isLocked && (
                <div className="col-span-12 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 -mb-1">
                  <Lock className="h-3 w-3" />
                  <span>Rodada já passou — % do prêmio e limite de rodada não podem ser alterados</span>
                </div>
              )}

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Acertos</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxHits}
                  value={tier.hits_required}
                  onChange={(e) => onUpdate(index, { hits_required: parseInt(e.target.value) || 1 })}
                  disabled={isLocked}
                  className={isLocked ? 'bg-muted cursor-not-allowed' : ''}
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">% do Prêmio</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={tier.prize_percentage}
                          onChange={(e) => onUpdate(index, { prize_percentage: parseFloat(e.target.value) || 0 })}
                          disabled={isLocked}
                          className={isLocked ? 'bg-muted cursor-not-allowed' : ''}
                        />
                      </div>
                    </TooltipTrigger>
                    {isLocked && (
                      <TooltipContent>
                        <p>Não é possível alterar — rodada {tier.purchase_allowed_until_draw_count} já passou</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select
                  value={tier.prize_type}
                  onValueChange={(value: PrizeType) => onUpdate(index, { prize_type: value })}
                  disabled={isLocked}
                >
                  <SelectTrigger className={isLocked ? 'bg-muted cursor-not-allowed' : ''}>
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Sem limite"
                          value={tier.purchase_allowed_until_draw_count ?? ''}
                          onChange={(e) =>
                            onUpdate(index, {
                              purchase_allowed_until_draw_count: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          disabled={isLocked}
                          className={isLocked ? 'bg-muted cursor-not-allowed' : ''}
                        />
                      </div>
                    </TooltipTrigger>
                    {isLocked && (
                      <TooltipContent>
                        <p>Não é possível alterar — rodada {tier.purchase_allowed_until_draw_count} já passou</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>

              {tier.prize_type === 'object' && (
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Descrição do Objeto</Label>
                  <Textarea
                    value={tier.object_description || ''}
                    onChange={(e) => onUpdate(index, { object_description: e.target.value || null })}
                    placeholder="Ex: Moto Honda CG 160"
                    rows={1}
                    disabled={isLocked}
                    className={isLocked ? 'bg-muted cursor-not-allowed' : ''}
                  />
                </div>
              )}

              <div className={`${tier.prize_type === 'object' ? 'col-span-1' : 'col-span-4'} flex justify-end`}>
                {isLocked ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="p-2">
                          <Lock className="h-4 w-4 text-amber-500" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Faixa bloqueada — rodada já passou</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
    </>
  );
}

/* ── Controlled version (no internal state, no save button) ── */

interface PrizeTiersEditorControlledProps {
  tiers: PrizeTierInput[];
  onChange: (tiers: PrizeTierInput[]) => void;
  maxHits: number;
  currentDrawCount?: number;
}

export function PrizeTiersEditorControlled({ tiers, onChange, maxHits, currentDrawCount = 0 }: PrizeTiersEditorControlledProps) {
  const addTier = () => {
    const lowestHits = tiers.length > 0
      ? Math.min(...tiers.map(t => t.hits_required))
      : maxHits;
    onChange([
      ...tiers,
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
    onChange(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, updates: Partial<PrizeTierInput>) => {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...updates } : tier)));
  };

  const totalPercentage = tiers.reduce((sum, t) => sum + t.prize_percentage, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faixas de Premiação</CardTitle>
        <CardDescription>
          Configure as faixas de acertos e percentual de prêmio para cada uma.
          Total: {totalPercentage}%{' '}
          {totalPercentage !== 100 && <span className="text-destructive">(deve ser 100%)</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TierRows tiers={tiers} maxHits={maxHits} onUpdate={updateTier} onRemove={removeTier} currentDrawCount={currentDrawCount} />

        <div className="flex justify-start pt-4">
          <Button type="button" variant="outline" onClick={addTier}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Faixa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
