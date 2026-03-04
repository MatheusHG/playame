import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/shared/LoadingState';
import { Trophy, Medal, Award } from 'lucide-react';

interface PublicRankingProps {
  raffleId: string;
  highlightTicketIds?: string[];
}

function maskName(name: string): string {
  const parts = name.split(' ');
  return parts.map((part, i) => {
    if (part.length <= 2) return part;
    if (i === 0 || i === parts.length - 1) {
      return part.slice(0, 2) + '***';
    }
    return '***';
  }).join(' ');
}

function maskCity(city: string | null): string {
  if (!city) return '***';
  if (city.length <= 3) return city;
  return city.slice(0, 3) + '***';
}

export function PublicRanking({ raffleId, highlightTicketIds }: PublicRankingProps) {
  const { data: rankings, isLoading } = useQuery({
    queryKey: ['public-ranking', raffleId],
    queryFn: async () => {
      const data = await api.get<any[]>(`/tickets/raffle/${raffleId}/ranking`);
      return data;
    },
    refetchInterval: 30000,
  });

  const { data: raffle } = useQuery({
    queryKey: ['raffle-info', raffleId],
    queryFn: async () => {
      const data = await api.get<any>(`/raffles/${raffleId}`, { fields: 'name,numbers_per_ticket' });
      return data;
    },
    refetchInterval: 30000,
  });

  const highlightSet = useMemo(
    () => new Set(highlightTicketIds || []),
    [highlightTicketIds],
  );

  // Find user's entries that are outside top rankings shown in the table
  const pinnedEntries = useMemo(() => {
    if (!rankings || highlightSet.size === 0) return [];
    return rankings.filter(
      (r: any, idx: number) => highlightSet.has(r.ticket_id) && idx + 1 > 3,
    );
  }, [rankings, highlightSet]);

  if (isLoading) {
    return <LoadingState message="Carregando ranking..." className="py-12" />;
  }

  const getRankIcon = (position: number) => {
    if (position === 1) return <Trophy className="h-5 w-5 text-primary" />;
    if (position === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (position === 3) return <Award className="h-5 w-5 text-primary/70" />;
    return null;
  };

  const renderRow = (ranking: any, index: number, isPinned = false) => {
    const position = index + 1;
    const player = ranking.player as { name: string; city: string | null; cpf_last4: string };
    const isHighlighted = highlightSet.has(ranking.ticket_id);

    return (
      <TableRow
        key={ranking.id + (isPinned ? '-pinned' : '')}
        className={
          isHighlighted
            ? 'bg-primary/10 border-l-2 border-l-primary'
            : position <= 3
              ? 'bg-primary/5'
              : ''
        }
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {getRankIcon(position)}
            {position}
          </div>
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {maskName(player.name)}
            {isHighlighted && (
              <Badge variant="default" className="text-[10px] px-1.5 py-0">
                Você
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {maskCity(player.city)}
        </TableCell>
        <TableCell className="text-center">
          <Badge variant={ranking.hits === raffle?.numbers_per_ticket ? 'default' : 'secondary'}>
            {ranking.hits || 0}
          </Badge>
        </TableCell>
        <TableCell className="text-center">
          <Badge variant={ranking.missing === 0 ? 'default' : 'outline'}>
            {ranking.missing}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground font-mono">
          ***.***.***-{player.cpf_last4}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Ranking {raffle?.name ? `- ${raffle.name}` : ''}
        </CardTitle>
        <CardDescription>
          Top 50 cartelas ordenadas por acertos (dados de jogadores parcialmente mascarados)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rankings?.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nenhuma cartela ativa neste sorteio ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Jogador</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="text-center">Acertos</TableHead>
                  <TableHead className="text-center">Faltam</TableHead>
                  <TableHead>CPF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings?.map((ranking: any, index: number) =>
                  renderRow(ranking, index),
                )}
                {/* Pinned user entries (below 3rd place) */}
                {pinnedEntries.length > 0 && (
                  <>
                    <TableRow>
                      <TableCell colSpan={6} className="py-1 px-0">
                        <div className="border-t-2 border-dashed border-primary/30" />
                      </TableCell>
                    </TableRow>
                    {pinnedEntries.map((ranking: any) => {
                      const originalIdx = rankings!.indexOf(ranking);
                      return renderRow(ranking, originalIdx, true);
                    })}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
