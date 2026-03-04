import { useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { PublicRanking } from '@/components/public/PublicRanking';
import { PrizeTiersDisplay } from '@/components/public/PrizeTiersDisplay';
import { PublicFooter } from '@/components/public/PublicFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Radio, Trophy, Hash, Ticket, CheckCircle, Target, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrackingTicket {
  id: string;
  numbers: number[];
  hits: number;
  missing: number;
  rank_position: number | null;
  matched_numbers: number[];
}

interface TrackingData {
  tickets: TrackingTicket[];
  total_drawn: number;
}

export default function AcompanharSorteio() {
  const { slug, raffleId } = useParams<{ slug: string; raffleId: string }>();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref');
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();

  useEffect(() => {
    if (slug) setCompanySlug(slug);
  }, [slug, setCompanySlug]);

  useCompanyBranding();

  // Fetch raffle info
  const { data: raffle, isLoading: raffleLoading } = useQuery({
    queryKey: ['public-raffle', raffleId],
    enabled: !!raffleId,
    queryFn: () => api.get<any>(`/raffles/${raffleId}`, { include: 'prize_tiers' }),
    refetchInterval: 30000,
  });

  // Fetch net sales for prize pool
  const { data: netSales = 0 } = useQuery({
    queryKey: ['raffle-total-net-sales', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const data = await api.get<{ total: number }>(`/payments/net-sales/${raffleId}`);
      return Number(data?.total || 0);
    },
    refetchInterval: 30000,
  });

  // Fetch finalized draw batches (public)
  const { data: drawBatches = [] } = useQuery({
    queryKey: ['public-draws', raffleId],
    enabled: !!raffleId,
    queryFn: () => api.get<any[]>(`/draws/raffle/${raffleId}/public`),
    refetchInterval: 30000,
  });

  // Fetch personalized tracking data when ref is present
  const { data: tracking } = useQuery({
    queryKey: ['ticket-tracking', ref],
    enabled: !!ref,
    queryFn: () => api.get<TrackingData>(`/tickets/track/${ref}`),
    refetchInterval: 30000,
  });

  // Build set of all drawn numbers for highlighting
  const drawnNumbersSet = useMemo(() => {
    const set = new Set<number>();
    drawBatches.forEach((batch: any) => {
      batch.draw_numbers?.forEach((dn: any) => set.add(dn.number));
    });
    return set;
  }, [drawBatches]);

  if (tenantLoading || raffleLoading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  if (!raffle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Sorteio não encontrado.</p>
      </div>
    );
  }

  // Calculate total drawn numbers
  const totalDrawn = drawBatches.reduce(
    (acc: number, batch: any) => acc + (batch.draw_numbers?.length || 0),
    0,
  );

  // Prize pool calculation (same logic as SorteioPage)
  const prizePool = (() => {
    if (raffle.prize_mode === 'FIXED') return Number(raffle.fixed_prize_value || 0);
    if (raffle.prize_mode === 'PERCENT_ONLY') return netSales;
    if (raffle.prize_mode === 'FIXED_PLUS_PERCENT') return Number(raffle.fixed_prize_value || 0) + netSales;
    return 0;
  })();

  const primaryColor = company?.primary_color || '#3B82F6';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header
        className="text-white py-6"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10" asChild>
              <Link to={`/empresa/${slug}/sorteio/${raffleId}`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              {company?.logo_url && (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="h-8 w-auto"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <span className="text-sm font-medium text-white/80">{company?.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Radio className="h-5 w-5 text-white/80 animate-pulse" />
            <h1 className="text-2xl font-bold">Acompanhar Sorteio</h1>
          </div>
          <p className="text-xl font-semibold text-white/90">{raffle.name}</p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/60">Prêmio Total</p>
              <div className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-yellow-400" />
                <span className="text-lg font-bold text-yellow-300">R$ {prizePool.toFixed(2)}</span>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/60">Formato</p>
              <div className="flex items-center gap-1.5">
                <Hash className="h-4 w-4 text-white/70" />
                <span className="text-lg font-bold">
                  {raffle.numbers_per_ticket} de {raffle.number_range_start}-{raffle.number_range_end}
                </span>
              </div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/60">Sorteados</p>
              <div className="flex items-center gap-1.5">
                <Ticket className="h-4 w-4 text-white/70" />
                <span className="text-lg font-bold">{totalDrawn} número{totalDrawn !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 flex-1 space-y-6">
        {/* Personalized Tracking Card (only when ?ref= is present) */}
        {ref && tracking && tracking.tickets.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Minha Compra
                </span>
                <span className="font-mono text-xs text-muted-foreground font-normal">
                  Ref: {ref.slice(0, 8).toUpperCase()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {tracking.tickets.map((ticket, idx) => {
                const matchedSet = new Set(ticket.matched_numbers);
                return (
                  <div key={ticket.id} className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs font-semibold">
                        Cartela {tracking.tickets.length > 1 ? idx + 1 : ''}
                      </Badge>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-semibold text-green-700">
                            {ticket.hits} acerto{ticket.hits !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {ticket.missing} faltando
                        </span>
                        {ticket.rank_position != null && (
                          <div className="flex items-center gap-1">
                            <Medal className="h-4 w-4 text-amber-500" />
                            <span className="text-sm font-bold text-amber-600">
                              {ticket.rank_position}º lugar
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {ticket.numbers.map((num) => {
                        const isMatched = matchedSet.has(num);
                        return (
                          <span
                            key={num}
                            className={cn(
                              'inline-flex items-center justify-center w-11 h-11 rounded-full',
                              'text-sm font-mono font-bold shadow-sm transition-all',
                              isMatched
                                ? 'bg-green-600 text-white ring-2 ring-green-400/50'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {String(num).padStart(2, '0')}
                          </span>
                        );
                      })}
                    </div>

                    {idx < tracking.tickets.length - 1 && (
                      <div className="border-t border-primary/10" />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Drawn Numbers Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              Números Sorteados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {drawBatches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum número sorteado ainda. Aguarde o início do sorteio.
              </p>
            ) : (
              <div className="space-y-6">
                {drawBatches.map((batch: any, idx: number) => (
                  <div key={batch.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-xs font-semibold">
                        {batch.name || `${idx + 1}ª Rodada`}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {batch.draw_numbers?.length || 0} número{(batch.draw_numbers?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {batch.draw_numbers?.map((dn: any) => (
                        <span
                          key={dn.id}
                          className={cn(
                            'inline-flex items-center justify-center w-11 h-11 rounded-full',
                            'text-sm font-mono font-bold shadow-sm',
                            'bg-primary text-primary-foreground',
                          )}
                        >
                          {String(dn.number).padStart(2, '0')}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}

                {/* All drawn numbers summary */}
                {drawBatches.length > 1 && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground mb-3">
                      Todos os números sorteados ({totalDrawn})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {drawBatches
                        .flatMap((b: any) => b.draw_numbers || [])
                        .sort((a: any, b: any) => a.number - b.number)
                        .map((dn: any) => (
                          <span
                            key={dn.id}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary text-xs font-mono font-bold"
                          >
                            {String(dn.number).padStart(2, '0')}
                          </span>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prize Tiers Section */}
        {raffle.prize_tiers?.length > 0 && (
          <PrizeTiersDisplay
            raffleId={raffleId!}
            prizeTiers={raffle.prize_tiers}
            prizePool={prizePool}
            currentDrawCount={raffle.current_draw_count ?? 0}
            prizeMode={raffle.prize_mode}
            fixedPrizeValue={Number(raffle.fixed_prize_value || 0)}
            prizePercentOfSales={Number(raffle.prize_percent_of_sales || 0)}
          />
        )}

        {/* Ranking Section */}
        <PublicRanking
          raffleId={raffleId!}
          highlightTicketIds={tracking?.tickets.map((t) => t.id)}
        />

        {/* Buy ticket CTA */}
        <div className="text-center py-4">
          <Button asChild size="lg">
            <Link to={`/empresa/${slug}/sorteio/${raffleId}`}>
              <Ticket className="h-4 w-4 mr-2" />
              Comprar Cartela
            </Link>
          </Button>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
