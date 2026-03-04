import { useState } from 'react';
import { api } from '@/lib/api';
import { getDisplayCpf } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, Target, CheckCircle, XCircle } from 'lucide-react';
import type { PrizeTier } from '@/types/database.types';

interface SearchCartelaDialogProps {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchCartelaDialog({ companyId, open, onOpenChange }: SearchCartelaDialogProps) {
  const [searchRef, setSearchRef] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!searchRef.trim() || searchRef.trim().length < 3) {
      setError('Digite pelo menos 3 caracteres');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.get(`/tickets/company/${companyId}/search?ref=${encodeURIComponent(searchRef.trim())}`);
      setResult(data);
    } catch (err: any) {
      if (err?.message?.includes('404') || err?.message?.includes('não encontrada')) {
        setError('Cartela não encontrada para esta referência.');
      } else {
        setError(err?.message || 'Erro ao buscar cartela');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setSearchRef('');
      setResult(null);
      setError('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: '#EDE9FE' }}>
              <Search className="h-4 w-4" style={{ color: '#7C3AED' }} />
            </div>
            <DialogTitle>Buscar Cartela</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex gap-2">
            <Input
              placeholder="Digite a Ref da cartela (ex: A1B2C3D4)"
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="font-mono"
            />
            <Button onClick={handleSearch} disabled={loading} className="rounded-xl shrink-0">
              {loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {result && <SearchResultDisplay result={result} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SearchResultDisplay({ result }: { result: any }) {
  const numbers: number[] = result.numbers || [];
  const matchedSet = new Set<number>(result.matched_numbers || []);
  const hits = numbers.filter(n => matchedSet.has(n));
  const missing = numbers.filter(n => !matchedSet.has(n));
  const drawCountAtPurchase = (result.snapshot_data as Record<string, unknown>)?.draw_count_at_purchase as number | undefined;
  const eligibleTierIds: string[] = result.eligible_prize_tiers || [];
  const allEligible = eligibleTierIds.length === 0;
  const prizeTiers: PrizeTier[] = result.raffle?.prize_tiers || [];
  const sortedTiers = [...prizeTiers].sort((a, b) => b.hits_required - a.hits_required);
  const numbersPerTicket = result.raffle?.numbers_per_ticket || numbers.length;

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Ativa', variant: 'default' },
    pending_payment: { label: 'Aguardando Pagamento', variant: 'outline' },
    winner: { label: 'Ganhadora', variant: 'default' },
    cancelled: { label: 'Cancelada', variant: 'destructive' },
  };
  const statusCfg = statusLabels[result.status || 'active'] || statusLabels.active;

  return (
    <div className="space-y-4">
      {/* Ref + Status */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="font-mono text-sm px-3 py-1">
          Ref: {result.ref}
        </Badge>
        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
      </div>

      {/* Raffle name */}
      {result.raffle?.name && (
        <div className="rounded-xl border bg-muted/30 p-3">
          <span className="text-xs text-muted-foreground">Sorteio</span>
          <p className="font-medium">{result.raffle.name}</p>
        </div>
      )}

      {/* Player Info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-muted-foreground">Jogador</span>
          <p className="font-medium">{result.player?.name || 'Desconhecido'}</p>
        </div>
        {result.player?.cpf_encrypted ? (
          <div>
            <span className="text-muted-foreground">CPF</span>
            <p className="font-mono font-medium">{getDisplayCpf(result.player)}</p>
          </div>
        ) : (
          <div>
            <span className="text-muted-foreground">Tipo</span>
            <p className="font-medium">Venda de rua</p>
          </div>
        )}
        {result.player?.cpf_encrypted ? (
          <div>
            <span className="text-muted-foreground">Cidade</span>
            <p className="font-medium">{result.player?.city || 'N/A'}</p>
          </div>
        ) : (
          <div>
            <span className="text-muted-foreground">Telefone</span>
            <p className="font-medium">{result.player?.phone || 'N/A'}</p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Compra</span>
          <p className="font-medium">
            {result.purchased_at
              ? new Date(result.purchased_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'N/A'
            }
          </p>
        </div>
      </div>

      {/* Draw round entry */}
      <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 p-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-blue-500" />
        <span className="text-sm">
          Entrou na <strong>{drawCountAtPurchase != null ? `${drawCountAtPurchase}ª` : '—'}</strong> rodada
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-green-50 dark:bg-green-950/30 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{hits.length}</p>
          <p className="text-xs text-green-600/80">Acertos</p>
        </div>
        <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{missing.length}</p>
          <p className="text-xs text-amber-600/80">Faltando</p>
        </div>
        <div className="rounded-xl border bg-muted/50 p-3 text-center">
          <p className="text-2xl font-bold">{numbersPerTicket}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Progresso</span>
          <span>{((hits.length / numbersPerTicket) * 100).toFixed(0)}%</span>
        </div>
        <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all rounded-full"
            style={{ width: `${(hits.length / numbersPerTicket) * 100}%` }}
          />
        </div>
      </div>

      {/* Prize Tier Eligibility */}
      {sortedTiers.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Prêmios Elegíveis</p>
          <div className="space-y-1.5">
            {sortedTiers.map((tier) => {
              const isEligible = allEligible || eligibleTierIds.includes(tier.id);
              return (
                <div
                  key={tier.id}
                  className={`flex items-center gap-2 rounded-lg border p-2 text-sm ${
                    isEligible
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                      : 'bg-muted/30 border-muted opacity-50'
                  }`}
                >
                  {isEligible
                    ? <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <span className={isEligible ? 'font-medium' : 'line-through text-muted-foreground'}>
                    {tier.hits_required} acertos — {tier.prize_percentage}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Numbers Grid */}
      <div>
        <p className="text-sm font-medium mb-2">Números da Cartela</p>
        <div className="flex flex-wrap gap-2">
          {numbers.sort((a, b) => a - b).map((num) => {
            const isHit = matchedSet.has(num);
            return (
              <span
                key={num}
                className={`
                  inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-mono font-semibold transition-all
                  ${isHit
                    ? 'bg-green-600 text-white shadow-sm ring-2 ring-green-300 dark:ring-green-800'
                    : 'bg-muted/60 text-muted-foreground border'
                  }
                `}
              >
                {num.toString().padStart(2, '0')}
              </span>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-green-600" />
          Acertou (sorteado)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-muted border" />
          Ainda não sorteado
        </div>
      </div>

      {/* Ranking position */}
      {result.rank_position && (
        <div className="rounded-xl border bg-muted/30 p-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Posição no ranking</span>
          <Badge variant="outline" className="text-base px-3 py-1 font-bold">
            #{result.rank_position}
          </Badge>
        </div>
      )}
    </div>
  );
}
