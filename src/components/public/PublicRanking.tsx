import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/shared/LoadingState';
import { Trophy, Medal, Award } from 'lucide-react';

interface PublicRankingProps {
  raffleId: string;
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

export function PublicRanking({ raffleId }: PublicRankingProps) {
  const { data: rankings, isLoading } = useQuery({
    queryKey: ['public-ranking', raffleId],
    queryFn: async () => {
      // Fetch ranking with player data
      const { data, error } = await supabase
        .from('ticket_ranking')
        .select(`
          *,
          players!inner(name, city, cpf_last4),
          tickets!inner(purchased_at)
        `)
        .eq('raffle_id', raffleId)
        .order('missing', { ascending: true })
        .order('hits', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const { data: raffle } = useQuery({
    queryKey: ['raffle-info', raffleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raffles')
        .select('name, numbers_per_ticket')
        .eq('id', raffleId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <LoadingState message="Carregando ranking..." className="py-12" />;
  }

  const getRankIcon = (position: number) => {
    if (position === 1) return <Trophy className="h-5 w-5 text-primary" />;
    if (position === 2) return <Medal className="h-5 w-5 text-muted-foreground" />;
    if (position === 3) return <Award className="h-5 w-5 text-primary/70" />;
    return null;
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
                {rankings?.map((ranking, index) => {
                  const position = index + 1;
                  const player = ranking.players as { name: string; city: string | null; cpf_last4: string };
                  
                  return (
                    <TableRow key={ranking.id} className={position <= 3 ? 'bg-primary/5' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getRankIcon(position)}
                          {position}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {maskName(player.name)}
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
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
