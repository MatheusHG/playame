import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { PublicNavMenu } from '@/components/public/PublicNavMenu';
import { PublicFooter } from '@/components/public/PublicFooter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, ChevronDown, ChevronUp, Medal, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlayerAccountMenu } from '@/components/public/PlayerAccountMenu';
import { usePlayer } from '@/contexts/PlayerContext';

interface WinnerTicket {
  id: string;
  ticket_numbers: { number: number }[];
  player: { name: string; cpf_last4: string; city: string | null };
  ticket_ranking: { hits: number; rank_position: number | null } | null;
}

export default function Ganhadores() {
  const { company, loading: tenantLoading } = useTenant();
  const { player, isAuthenticated, logout } = usePlayer();
  const [expandedRaffle, setExpandedRaffle] = useState<string | null>(null);

  useCompanyBranding();

  const { data: finishedRaffles = [], isLoading: rafflesLoading } = useQuery({
    queryKey: ['public-finished-raffles', company?.id],
    enabled: !!company?.id,
    queryFn: () => api.get<any[]>(`/raffles/finished/${company!.id}`),
  });

  const { data: winners, isLoading: winnersLoading } = useQuery({
    queryKey: ['raffle-winners', expandedRaffle],
    enabled: !!expandedRaffle,
    queryFn: () => api.get<WinnerTicket[]>(`/tickets/winners/${expandedRaffle}`),
  });

  if (tenantLoading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Empresa não encontrada.</p>
      </div>
    );
  }

  const primaryColor = company.primary_color || '#3B82F6';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-10 w-auto" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                {company.name.charAt(0)}
              </div>
            )}
            <span className="text-white font-bold text-xl">{company.name}</span>
          </div>
          {isAuthenticated && player && (
            <PlayerAccountMenu player={player} onLogout={logout} variant="secondary" className="bg-white/20 text-white hover:bg-white/30" />
          )}
        </div>
      </header>

      <PublicNavMenu primaryColor={primaryColor} companyId={company.id} />

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">Ganhadores</h1>
        </div>

        {rafflesLoading ? (
          <LoadingState message="Carregando sorteios..." />
        ) : finishedRaffles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhum sorteio finalizado ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {finishedRaffles.map((raffle: any) => {
              const isExpanded = expandedRaffle === raffle.id;
              return (
                <Card key={raffle.id} className="overflow-hidden">
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedRaffle(isExpanded ? null : raffle.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {raffle.image_url && (
                          <img
                            src={raffle.image_url}
                            alt={raffle.name}
                            className="h-12 w-12 rounded-lg object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <div>
                          <CardTitle className="text-lg">{raffle.name}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Finalizado em {raffle.finished_at ? new Date(raffle.finished_at).toLocaleDateString('pt-BR') : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {raffle.numbers_per_ticket} de {raffle.number_range_start}-{raffle.number_range_end}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="border-t pt-4">
                      {winnersLoading ? (
                        <div className="py-8 text-center">
                          <LoadingState message="Carregando ganhadores..." />
                        </div>
                      ) : !winners || winners.length === 0 ? (
                        <p className="text-center text-muted-foreground py-6">
                          Nenhum ganhador registrado para este sorteio.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {winners.map((ticket, idx) => (
                            <div
                              key={ticket.id}
                              className="flex flex-col gap-2 p-3 rounded-lg bg-muted/30 border"
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <Medal className="h-5 w-5 text-yellow-500" />
                                  <span className="font-semibold">{ticket.player.name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    ***{ticket.player.cpf_last4}
                                  </Badge>
                                  {ticket.player.city && (
                                    <span className="text-xs text-muted-foreground">{ticket.player.city}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {ticket.ticket_ranking?.hits != null && (
                                    <Badge className="bg-green-600 text-white text-xs">
                                      {ticket.ticket_ranking.hits} acertos
                                    </Badge>
                                  )}
                                  {ticket.ticket_ranking?.rank_position != null && (
                                    <Badge variant="outline" className="text-xs font-bold">
                                      {ticket.ticket_ranking.rank_position}º lugar
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {ticket.ticket_numbers.map((tn) => (
                                  <span
                                    key={tn.number}
                                    className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-mono font-bold"
                                  >
                                    {String(tn.number).padStart(2, '0')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
