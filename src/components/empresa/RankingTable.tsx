import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRaffleRanking, RankingEntry } from '@/hooks/useTickets';
import { useDrawBatches } from '@/hooks/useRaffles';
import { LoadingState } from '@/components/shared/LoadingState';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trophy, Medal, Award, Target, Eye, Clock, CheckCircle, XCircle } from 'lucide-react';
import { getDisplayCpf } from '@/lib/utils';
import type { PrizeTier } from '@/types/database.types';

interface RankingTableProps {
  raffleId: string;
  numbersPerTicket: number;
  prizeTiers?: PrizeTier[];
}

export function RankingTable({ raffleId, numbersPerTicket, prizeTiers = [] }: RankingTableProps) {
  const { data: ranking, isLoading, error } = useRaffleRanking(raffleId);
  const { data: batches } = useDrawBatches(raffleId);
  const [selectedEntry, setSelectedEntry] = useState<RankingEntry | null>(null);

  // Collect all drawn numbers from finalized batches
  const drawnNumbers = useMemo(() => {
    if (!batches) return new Set<number>();
    const nums = new Set<number>();
    for (const batch of batches) {
      if (batch.finalized_at) {
        for (const dn of batch.draw_numbers) {
          nums.add(dn.number);
        }
      }
    }
    return nums;
  }, [batches]);

  if (isLoading) {
    return <LoadingState message="Carregando ranking..." />;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Erro ao carregar ranking: {error.message}
        </CardContent>
      </Card>
    );
  }

  const topHits = ranking?.[0]?.hits || 0;
  const topMissing = ranking?.[0]?.missing ?? numbersPerTicket;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Ranking em Tempo Real
          </CardTitle>
          <CardDescription>
            {ranking?.length || 0} cartelas no ranking • Líder com {topHits} acertos ({topMissing} faltando)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!ranking || ranking.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma cartela ativa para exibir no ranking.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Jogador</TableHead>
                  <TableHead className="text-center">Acertos</TableHead>
                  <TableHead className="text-center">Faltando</TableHead>
                  <TableHead>Números</TableHead>
                  <TableHead>Compra</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((entry, index) => (
                  <RankingRow
                    key={entry.id}
                    entry={entry}
                    position={entry.rank_position || index + 1}
                    numbersPerTicket={numbersPerTicket}
                    drawnNumbers={drawnNumbers}
                    onViewCartela={() => setSelectedEntry(entry)}
                  />
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cartela Detail Dialog */}
      <CartelaDialog
        entry={selectedEntry}
        open={!!selectedEntry}
        onOpenChange={(open) => !open && setSelectedEntry(null)}
        drawnNumbers={drawnNumbers}
        numbersPerTicket={numbersPerTicket}
        prizeTiers={prizeTiers}
      />
    </>
  );
}

function RankingRow({
  entry,
  position,
  numbersPerTicket,
  drawnNumbers,
  onViewCartela,
}: {
  entry: RankingEntry;
  position: number;
  numbersPerTicket: number;
  drawnNumbers: Set<number>;
  onViewCartela: () => void;
}) {
  const numbers = entry.ticket?.ticket_numbers?.map(n => n.number).sort((a, b) => a - b) || [];
  const progress = ((entry.hits || 0) / numbersPerTicket) * 100;

  const getPositionIcon = () => {
    if (position === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (position === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (position === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 text-center font-mono">{position}</span>;
  };

  const getMissingColor = () => {
    if (entry.missing === 0) return 'text-green-500 font-bold';
    if (entry.missing <= 2) return 'text-yellow-500 font-semibold';
    return 'text-muted-foreground';
  };

  return (
    <TableRow className={position <= 3 ? 'bg-muted/30' : ''}>
      <TableCell>
        <div className="flex items-center justify-center">
          {getPositionIcon()}
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{entry.player?.name || 'Desconhecido'}</div>
          <div className="text-xs text-muted-foreground">
            {entry.player?.cpf_encrypted
              ? `${getDisplayCpf(entry.player) || `***${entry.player.cpf_last4}`} • ${entry.player.city || 'N/A'}`
              : 'Venda de rua'
            }
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex flex-col items-center gap-1">
          <Badge variant={entry.hits === numbersPerTicket ? 'default' : 'secondary'}>
            <Target className="h-3 w-3 mr-1" />
            {entry.hits || 0}
          </Badge>
          <div
            className="h-1.5 w-16 bg-muted rounded-full overflow-hidden"
            title={`${progress.toFixed(0)}% completo`}
          >
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </TableCell>
      <TableCell className={`text-center ${getMissingColor()}`}>
        {entry.missing}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1 max-w-xs">
          {numbers.slice(0, 6).map((num) => (
            <Badge
              key={num}
              variant={drawnNumbers.has(num) ? 'default' : 'outline'}
              className={`text-xs font-mono ${drawnNumbers.has(num) ? 'bg-green-600 hover:bg-green-600' : ''}`}
            >
              {num.toString().padStart(2, '0')}
            </Badge>
          ))}
          {numbers.length > 6 && (
            <Badge variant="secondary" className="text-xs">
              +{numbers.length - 6}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm text-muted-foreground">
          {entry.ticket?.purchased_at
            ? formatDistanceToNow(new Date(entry.ticket.purchased_at), { addSuffix: true, locale: ptBR })
            : 'N/A'
          }
        </div>
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onViewCartela} title="Ver cartela">
          <Eye className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function CartelaDialog({
  entry,
  open,
  onOpenChange,
  drawnNumbers,
  numbersPerTicket,
  prizeTiers,
}: {
  entry: RankingEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawnNumbers: Set<number>;
  numbersPerTicket: number;
  prizeTiers: PrizeTier[];
}) {
  if (!entry) return null;

  const numbers = entry.ticket?.ticket_numbers?.map(n => n.number).sort((a, b) => a - b) || [];
  const hits = numbers.filter(n => drawnNumbers.has(n));
  const missing = numbers.filter(n => !drawnNumbers.has(n));
  const drawCountAtPurchase = (entry.ticket?.snapshot_data as Record<string, unknown>)?.draw_count_at_purchase as number | undefined;
  const eligibleTierIds = entry.ticket?.eligible_prize_tiers || [];
  const allEligible = eligibleTierIds.length === 0;
  const sortedTiers = [...prizeTiers].sort((a, b) => b.hits_required - a.hits_required);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Cartela - {entry.player?.name || 'Desconhecido'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Player Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Jogador</span>
              <p className="font-medium">{entry.player?.name || 'Desconhecido'}</p>
            </div>
            {entry.player?.cpf_encrypted ? (
              <div>
                <span className="text-muted-foreground">CPF</span>
                <p className="font-mono font-medium">{getDisplayCpf(entry.player)}</p>
              </div>
            ) : (
              <div>
                <span className="text-muted-foreground">Tipo</span>
                <p className="font-medium">Venda de rua</p>
              </div>
            )}
            {entry.player?.cpf_encrypted ? (
              <div>
                <span className="text-muted-foreground">Cidade</span>
                <p className="font-medium">{entry.player?.city || 'N/A'}</p>
              </div>
            ) : (
              <div>
                <span className="text-muted-foreground">Telefone</span>
                <p className="font-medium">{entry.player?.phone || 'N/A'}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Compra</span>
              <p className="font-medium">
                {entry.ticket?.purchased_at
                  ? format(new Date(entry.ticket.purchased_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
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
              {numbers.map((num) => {
                const isHit = drawnNumbers.has(num);
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
          <div className="rounded-xl border bg-muted/30 p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Posição no ranking</span>
            <Badge variant="outline" className="text-base px-3 py-1 font-bold">
              #{entry.rank_position}
            </Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
