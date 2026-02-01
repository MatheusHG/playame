import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRaffleRanking, RankingEntry } from '@/hooks/useTickets';
import { LoadingState } from '@/components/shared/LoadingState';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trophy, Medal, Award, Target, Hash } from 'lucide-react';

interface RankingTableProps {
  raffleId: string;
  numbersPerTicket: number;
}

export function RankingTable({ raffleId, numbersPerTicket }: RankingTableProps) {
  const { data: ranking, isLoading, error } = useRaffleRanking(raffleId);

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Jogador</TableHead>
                <TableHead className="text-center">Acertos</TableHead>
                <TableHead className="text-center">Faltando</TableHead>
                <TableHead>Números</TableHead>
                <TableHead>Compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((entry, index) => (
                <RankingRow 
                  key={entry.id} 
                  entry={entry} 
                  position={entry.rank_position || index + 1}
                  numbersPerTicket={numbersPerTicket}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RankingRow({ 
  entry, 
  position, 
  numbersPerTicket 
}: { 
  entry: RankingEntry; 
  position: number;
  numbersPerTicket: number;
}) {
  const numbers = entry.tickets?.ticket_numbers?.map(n => n.number).sort((a, b) => a - b) || [];
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
          <div className="font-medium">{entry.players?.name || 'Desconhecido'}</div>
          <div className="text-xs text-muted-foreground">
            ***{entry.players?.cpf_last4} • {entry.players?.city || 'N/A'}
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
            <Badge key={num} variant="outline" className="text-xs font-mono">
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
          {entry.tickets?.purchased_at 
            ? formatDistanceToNow(new Date(entry.tickets.purchased_at), { addSuffix: true, locale: ptBR })
            : 'N/A'
          }
        </div>
      </TableCell>
    </TableRow>
  );
}
