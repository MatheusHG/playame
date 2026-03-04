import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Crown, Medal, Star, Gift, CheckCircle, TrendingUp, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PrizeTier, PrizeMode } from '@/types/database.types';

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
  prizeMode?: PrizeMode | null;
  fixedPrizeValue?: number | null;
  prizePercentOfSales?: number | null;
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

function getPrizeModeLabel(mode: PrizeMode | null | undefined): string {
  switch (mode) {
    case 'FIXED': return 'Valor Fixo';
    case 'PERCENT_ONLY': return 'Percentual das Vendas';
    case 'FIXED_PLUS_PERCENT': return 'Fixo + Percentual';
    default: return 'Não definido';
  }
}

function getPrizeModeDescription(
  mode: PrizeMode | null | undefined,
  fixedValue: number | null | undefined,
  percent: number | null | undefined
): string {
  const fixed = fixedValue ?? 0;
  const pct = percent ?? 0;
  
  switch (mode) {
    case 'FIXED':
      return `Prêmio fixo de R$ ${fixed.toFixed(2)}`;
    case 'PERCENT_ONLY':
      return `${pct}% do valor das vendas`;
    case 'FIXED_PLUS_PERCENT':
      return `R$ ${fixed.toFixed(2)} + ${pct}% das vendas`;
    default:
      return '';
  }
}

export function PrizeTiersDisplay({ 
  raffleId, 
  prizeTiers, 
  prizePool, 
  currentDrawCount,
  prizeMode,
  fixedPrizeValue,
  prizePercentOfSales
}: PrizeTiersDisplayProps) {
  // Fetch winners for each tier
  const { data: winners = [], isLoading: loadingWinners } = useQuery({
    queryKey: ['raffle-winners', raffleId],
    queryFn: async () => {
      const data = await api.get<WinnerInfo[]>(`/raffles/${raffleId}/winners`);
      return data || [];
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

  const showGrowthIndicator = prizeMode === 'PERCENT_ONLY' || prizeMode === 'FIXED_PLUS_PERCENT';

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
        <CardDescription className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg text-foreground">
              R$ {prizePool.toFixed(2)}
            </span>
            {showGrowthIndicator && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-300">
                      <TrendingUp className="h-3 w-3" />
                      Acumulado
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">O prêmio aumenta a cada cartela vendida!</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {prizeMode && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>{getPrizeModeDescription(prizeMode, fixedPrizeValue, prizePercentOfSales)}</span>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{tier.hits_required} acertos</span>
                      <Badge variant="secondary" className="text-xs">
                        {tier.prize_percentage}%
                      </Badge>
                      {hasWinner && (
                        <Badge variant="default" className="bg-green-600 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Premiado
                        </Badge>
                      )}
                    </div>
                    
                    {tier.prize_type === 'money' ? (
                      <p className="text-xl font-bold text-primary">
                        R$ {tierPrize.toFixed(2)}
                      </p>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Gift className="h-4 w-4 text-primary" />
                        <span className="font-medium text-primary">Prêmio Físico</span>
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
                      <div key={idx} className="text-sm flex items-center gap-2 flex-wrap">
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
