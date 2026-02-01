import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Crown, Medal, Star, Gift, CheckCircle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PrizeTier = Database['public']['Tables']['prize_tiers']['Row'];

interface WinnerInfo {
  tier_id: string;
  hits: number;
  player_name_masked: string;
  player_city: string | null;
  player_cpf_last4: string;
  won_at: string;
}

interface PrizeTiersDisplayProps {
  raffleId: string;
  prizeTiers: PrizeTier[];
  prizePool: number;
  currentDrawCount: number;
}

function maskName(name: string): string {
  const parts = name.split(' ');
  return parts.map(part => {
    if (part.length <= 2) return part;
    return part.slice(0, 2) + '***';
  }).join(' ');
}

function maskCity(city: string | null): string {
  if (!city) return '';
  if (city.length <= 3) return city;
  return city.slice(0, 3) + '***';
}

export function PrizeTiersDisplay({ raffleId, prizeTiers, prizePool, currentDrawCount }: PrizeTiersDisplayProps) {
  // Fetch winners for each tier
  const { data: winners = [], isLoading: loadingWinners } = useQuery({
    queryKey: ['raffle-winners', raffleId],
    queryFn: async () => {
      // Get tickets that are winners
      const { data: winnerTickets, error } = await supabase
        .from('tickets')
        .select(`
          id,
          purchased_at,
          eligible_prize_tiers,
          player:players!inner(name, city, cpf_last4),
          ranking:ticket_ranking!inner(hits)
        `)
        .eq('raffle_id', raffleId)
        .eq('status', 'winner');

      if (error) throw error;

      // Map winners to their tiers
      const winnersMap: WinnerInfo[] = [];
      
      if (winnerTickets) {
        for (const ticket of winnerTickets) {
          const player = ticket.player as unknown as { name: string; city: string | null; cpf_last4: string };
          const ranking = ticket.ranking as unknown as { hits: number };
          
          if (ticket.eligible_prize_tiers) {
            for (const tierId of ticket.eligible_prize_tiers) {
              winnersMap.push({
                tier_id: tierId,
                hits: ranking?.hits || 0,
                player_name_masked: maskName(player?.name || ''),
                player_city: player?.city,
                player_cpf_last4: player?.cpf_last4 || '',
                won_at: ticket.purchased_at || '',
              });
            }
          }
        }
      }

      return winnersMap;
    },
  });

  const sortedTiers = [...prizeTiers].sort((a, b) => b.hits_required - a.hits_required);

  const getTierIcon = (index: number, totalTiers: number) => {
    if (totalTiers === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 0) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <Star className="h-5 w-5 text-primary" />;
  };

  const getTierWinners = (tierId: string) => {
    return winners.filter(w => w.tier_id === tierId);
  };

  if (sortedTiers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Premiação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Nenhuma faixa de prêmio configurada</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Premiação
        </CardTitle>
        <CardDescription>
          Pool atual: R$ {prizePool.toFixed(2)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedTiers.map((tier, index) => {
          const tierPrize = tier.prize_type === 'money' 
            ? prizePool * (Number(tier.prize_percentage) / 100) 
            : 0;
          const tierWinners = getTierWinners(tier.id);
          const hasWinner = tierWinners.length > 0;
          const isEligibleForPurchase = tier.purchase_allowed_until_draw_count 
            ? currentDrawCount < tier.purchase_allowed_until_draw_count 
            : true;

          return (
            <div 
              key={tier.id} 
              className={`p-4 rounded-lg border transition-all ${
                hasWinner 
                  ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' 
                  : isEligibleForPurchase 
                    ? 'bg-muted/50 border-transparent hover:border-primary/20' 
                    : 'bg-muted/30 border-transparent opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {getTierIcon(index, sortedTiers.length)}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{tier.hits_required} acertos</span>
                      {hasWinner && (
                        <Badge variant="default" className="bg-green-600 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Premiado
                        </Badge>
                      )}
                    </div>
                    
                    {tier.prize_type === 'money' ? (
                      <p className="text-lg font-bold text-primary">
                        R$ {tierPrize.toFixed(2)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          ({tier.prize_percentage}% do pool)
                        </span>
                      </p>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Gift className="h-4 w-4 text-primary" />
                        <span className="font-medium">Prêmio Físico</span>
                      </div>
                    )}

                    {tier.prize_type === 'object' && tier.object_description && (
                      <p className="text-sm text-muted-foreground">{tier.object_description}</p>
                    )}

                    {tier.purchase_allowed_until_draw_count && (
                      <p className={`text-xs ${isEligibleForPurchase ? 'text-muted-foreground' : 'text-destructive'}`}>
                        {isEligibleForPurchase 
                          ? `Compra permitida até a ${tier.purchase_allowed_until_draw_count}ª rodada`
                          : `Encerrado na ${tier.purchase_allowed_until_draw_count}ª rodada`
                        }
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Winners Section */}
              {loadingWinners ? (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : hasWinner ? (
                <div className="mt-3 pt-3 border-t border-dashed border-green-300 dark:border-green-700">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
                    🏆 Ganhador{tierWinners.length > 1 ? 'es' : ''}:
                  </p>
                  <div className="space-y-1">
                    {tierWinners.map((winner, idx) => (
                      <div key={idx} className="text-sm flex items-center gap-2">
                        <span className="font-medium">{winner.player_name_masked}</span>
                        {winner.player_city && (
                          <span className="text-muted-foreground">
                            ({maskCity(winner.player_city)})
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs font-mono">
                          ***{winner.player_cpf_last4}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-dashed">
                  <p className="text-xs text-muted-foreground">
                    Ainda sem ganhador
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
