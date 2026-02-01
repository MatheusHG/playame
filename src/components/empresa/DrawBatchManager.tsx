import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Plus, Trash2, Check, X, Loader2, Pencil } from 'lucide-react';
import { useDrawBatches, useDrawBatchMutations, type DrawBatchWithNumbers } from '@/hooks/useRaffles';
import { cn } from '@/lib/utils';

interface DrawBatchManagerProps {
  raffleId: string;
  numberRangeStart: number;
  numberRangeEnd: number;
  isRaffleActive: boolean;
}

export function DrawBatchManager({
  raffleId,
  numberRangeStart,
  numberRangeEnd,
  isRaffleActive,
}: DrawBatchManagerProps) {
  const { data: batches, isLoading } = useDrawBatches(raffleId);
  const { createBatch, addNumber, removeNumber, finalizeBatch, deleteBatch, updateBatch } = useDrawBatchMutations(raffleId);

  const [newBatchName, setNewBatchName] = useState('');
  const [newNumbers, setNewNumbers] = useState<Record<string, string>>({});
  const [confirmFinalize, setConfirmFinalize] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Get all drawn numbers to prevent duplicates
  const allDrawnNumbers = new Set(
    batches?.flatMap(b => b.draw_numbers.map(n => n.number)) || []
  );

  const handleCreateBatch = () => {
    createBatch.mutate({ name: newBatchName || undefined });
    setNewBatchName('');
  };

  const handleAddNumber = (batchId: string) => {
    const numberStr = newNumbers[batchId];
    if (!numberStr) return;

    const number = parseInt(numberStr);
    if (isNaN(number) || number < numberRangeStart || number > numberRangeEnd) {
      return;
    }

    if (allDrawnNumbers.has(number)) {
      return;
    }

    addNumber.mutate({ batchId, number });
    setNewNumbers({ ...newNumbers, [batchId]: '' });
  };

  const handleFinalize = (batchId: string) => {
    finalizeBatch.mutate(batchId);
    setConfirmFinalize(null);
  };

  const handleDelete = (batchId: string) => {
    deleteBatch.mutate(batchId);
    setConfirmDelete(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rodadas de Números Sorteados</CardTitle>
        <CardDescription>
          Gerencie as rodadas e os números sorteados. Range: {numberRangeStart} a {numberRangeEnd}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create new batch */}
        {isRaffleActive && (
          <div className="flex gap-2">
            <Input
              placeholder="Nome da rodada (opcional)"
              value={newBatchName}
              onChange={(e) => setNewBatchName(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={handleCreateBatch} disabled={createBatch.isPending}>
              {createBatch.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Nova Rodada
            </Button>
          </div>
        )}

        {/* Batches list */}
        {batches?.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhuma rodada criada. {isRaffleActive && 'Crie a primeira rodada acima.'}
          </p>
        ) : (
          <div className="space-y-4">
            {batches?.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                numberRangeStart={numberRangeStart}
                numberRangeEnd={numberRangeEnd}
                allDrawnNumbers={allDrawnNumbers}
                isRaffleActive={isRaffleActive}
                newNumber={newNumbers[batch.id] || ''}
                onNewNumberChange={(value) => setNewNumbers({ ...newNumbers, [batch.id]: value })}
                onAddNumber={() => handleAddNumber(batch.id)}
                onRemoveNumber={(numberId) => removeNumber.mutate(numberId)}
                onFinalize={() => setConfirmFinalize(batch.id)}
                onDelete={() => setConfirmDelete(batch.id)}
                onUpdateName={(name) => updateBatch.mutate({ batchId: batch.id, name })}
                isAddingNumber={addNumber.isPending}
              />
            ))}
          </div>
        )}

        {/* Confirm dialogs */}
        <ConfirmDialog
          open={!!confirmFinalize}
          onOpenChange={() => setConfirmFinalize(null)}
          title="Finalizar Rodada"
          description="Após finalizar, não será possível adicionar ou remover números desta rodada. Deseja continuar?"
          confirmLabel="Finalizar"
          onConfirm={() => confirmFinalize && handleFinalize(confirmFinalize)}
          loading={finalizeBatch.isPending}
        />

        <ConfirmDialog
          open={!!confirmDelete}
          onOpenChange={() => setConfirmDelete(null)}
          title="Excluir Rodada"
          description="Esta ação removerá a rodada e todos os números associados. Isso pode afetar o ranking. Deseja continuar?"
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
          loading={deleteBatch.isPending}
        />
      </CardContent>
    </Card>
  );
}

interface BatchCardProps {
  batch: DrawBatchWithNumbers;
  numberRangeStart: number;
  numberRangeEnd: number;
  allDrawnNumbers: Set<number>;
  isRaffleActive: boolean;
  newNumber: string;
  onNewNumberChange: (value: string) => void;
  onAddNumber: () => void;
  onRemoveNumber: (numberId: string) => void;
  onFinalize: () => void;
  onDelete: () => void;
  onUpdateName: (name: string) => void;
  isAddingNumber: boolean;
}

function BatchCard({
  batch,
  numberRangeStart,
  numberRangeEnd,
  allDrawnNumbers,
  isRaffleActive,
  newNumber,
  onNewNumberChange,
  onAddNumber,
  onRemoveNumber,
  onFinalize,
  onDelete,
  onUpdateName,
  isAddingNumber,
}: BatchCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(batch.name || '');
  const isFinalized = !!batch.finalized_at;
  const canEdit = isRaffleActive && !isFinalized;
  const sortedNumbers = [...batch.draw_numbers].sort((a, b) => a.number - b.number);

  const validateNumber = (value: string): boolean => {
    const num = parseInt(value);
    if (isNaN(num)) return false;
    if (num < numberRangeStart || num > numberRangeEnd) return false;
    if (allDrawnNumbers.has(num)) return false;
    return true;
  };

  const handleSaveName = () => {
    if (editedName.trim() !== batch.name) {
      onUpdateName(editedName.trim());
    }
    setIsEditingName(false);
  };

  return (
    <div className={cn('border rounded-lg p-4', isFinalized && 'bg-muted/30')}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="h-8 w-40"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
              />
              <Button size="sm" variant="ghost" onClick={handleSaveName}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <h4 className="font-semibold">{batch.name || `Rodada ${batch.draw_order}`}</h4>
              {canEdit && (
                <Button size="sm" variant="ghost" onClick={() => setIsEditingName(true)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
          <Badge variant={isFinalized ? 'secondary' : 'default'}>
            {isFinalized ? 'Finalizada' : 'Em andamento'}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {batch.draw_numbers.length} número(s)
          </span>
        </div>

        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onFinalize}>
              <Check className="mr-1 h-4 w-4" />
              Finalizar
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Numbers display */}
      <div className="flex flex-wrap gap-2 mb-3">
        {sortedNumbers.map((dn) => (
          <div
            key={dn.id}
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-mono',
              'bg-primary text-primary-foreground'
            )}
          >
            {String(dn.number).padStart(2, '0')}
            {canEdit && (
              <button
                onClick={() => onRemoveNumber(dn.id)}
                className="hover:bg-primary-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {batch.draw_numbers.length === 0 && (
          <span className="text-muted-foreground text-sm">Nenhum número sorteado</span>
        )}
      </div>

      {/* Add number input */}
      {canEdit && (
        <div className="flex gap-2 mt-3">
          <Input
            type="number"
            min={numberRangeStart}
            max={numberRangeEnd}
            placeholder={`${numberRangeStart} - ${numberRangeEnd}`}
            value={newNumber}
            onChange={(e) => onNewNumberChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddNumber()}
            className="max-w-32"
          />
          <Button
            size="sm"
            onClick={onAddNumber}
            disabled={!validateNumber(newNumber) || isAddingNumber}
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
