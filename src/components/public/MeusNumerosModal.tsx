import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Loader2, Hash, Trophy, CheckCircle, Medal, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MeusNumerosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
}

interface LookupTicket {
  id: string;
  status: string;
  numbers: number[];
  matched_numbers: number[];
  hits: number;
  missing: number;
  rank_position: number | null;
  raffle: {
    id: string;
    name: string;
    status: string;
    image_url: string | null;
  };
}

interface LookupResult {
  player_name: string;
  cpf_last4: string;
  tickets: LookupTicket[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCpf(value: string): boolean {
  const cleaned = value.replace(/\D/g, '');
  return cleaned.length === 11;
}

function isRef(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function MeusNumerosModal({ open, onOpenChange, companyId }: MeusNumerosModalProps) {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [submittedCpf, setSubmittedCpf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: lookupResult, isLoading, isFetching } = useQuery({
    queryKey: ['ticket-lookup-cpf', companyId, submittedCpf],
    enabled: !!companyId && !!submittedCpf,
    queryFn: async () => {
      const data = await api.get<LookupResult>(
        `/tickets/lookup-by-cpf/${companyId}`,
        { cpf: submittedCpf! },
      );
      return data;
    },
    retry: false,
  });

  const handleSearch = () => {
    setError(null);
    const trimmed = searchValue.trim();

    if (!trimmed) {
      setError('Digite um CPF ou número de Ref.');
      return;
    }

    if (isRef(trimmed)) {
      // Ref - we don't know the raffleId, but the tracking page will handle it
      // We need to find the raffle from the payment. Let's redirect to a generic tracking.
      // Actually the track endpoint returns raffle_id, so let's open the existing flow.
      onOpenChange(false);
      setSearchValue('');
      setSubmittedCpf(null);
      // Navigate to the tracking page - we need to get raffle_id from the ref first
      navigateToRef(trimmed);
      return;
    }

    const cleaned = trimmed.replace(/\D/g, '');
    if (cleaned.length === 11) {
      setSubmittedCpf(cleaned);
    } else {
      setError('CPF inválido. Digite os 11 dígitos do CPF ou um número de Ref.');
    }
  };

  const navigateToRef = async (ref: string) => {
    try {
      const data = await api.get<any>(`/tickets/track/${ref}`);
      if (data && data.tickets && data.tickets.length > 0) {
        // Get the raffle_id from the payment
        const paymentData = await api.get<any>(`/payments/ref-raffle/${ref}`).catch(() => null);
        if (paymentData?.raffle_id) {
          navigate(`/sorteio/${paymentData.raffle_id}/acompanhar?ref=${ref}`);
        } else {
          // Fallback: just show that data was found but can't redirect without raffle_id
          setError('Ref encontrado, mas não foi possível determinar o sorteio.');
          onOpenChange(true);
        }
      }
    } catch {
      setError('Ref não encontrado. Verifique o código e tente novamente.');
      onOpenChange(true);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setSearchValue('');
      setSubmittedCpf(null);
      setError(null);
    }
    onOpenChange(isOpen);
  };

  // Group tickets by raffle
  const ticketsByRaffle: Record<string, { raffle: LookupTicket['raffle']; tickets: LookupTicket[] }> = {};
  if (lookupResult?.tickets) {
    for (const t of lookupResult.tickets) {
      if (!ticketsByRaffle[t.raffle.id]) {
        ticketsByRaffle[t.raffle.id] = { raffle: t.raffle, tickets: [] };
      }
      ticketsByRaffle[t.raffle.id].tickets.push(t);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Meus Números
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Digite seu CPF ou número do Ref"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isLoading || isFetching}>
              {isLoading || isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {submittedCpf && !isLoading && !lookupResult && !error && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum jogador encontrado com este CPF.
            </p>
          )}

          {lookupResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Jogador: <strong className="text-foreground">{lookupResult.player_name}</strong></span>
                <Badge variant="outline" className="text-xs">***{lookupResult.cpf_last4}</Badge>
              </div>

              {lookupResult.tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma cartela encontrada.
                </p>
              ) : (
                Object.values(ticketsByRaffle).map(({ raffle, tickets }) => (
                  <Card key={raffle.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-sm">{raffle.name}</span>
                        </div>
                        <Badge variant={raffle.status === 'finished' ? 'secondary' : 'default'} className="text-xs">
                          {raffle.status === 'finished' ? 'Finalizado' : raffle.status === 'active' ? 'Ativo' : raffle.status}
                        </Badge>
                      </div>

                      {tickets.map((ticket, idx) => {
                        const matchedSet = new Set(ticket.matched_numbers);
                        return (
                          <div key={ticket.id} className="space-y-2">
                            {tickets.length > 1 && (
                              <p className="text-xs text-muted-foreground">Cartela {idx + 1}</p>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              {ticket.numbers.map((num) => (
                                <span
                                  key={num}
                                  className={cn(
                                    'inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-mono font-bold',
                                    matchedSet.has(num)
                                      ? 'bg-green-600 text-white'
                                      : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {String(num).padStart(2, '0')}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                <span className="font-medium text-green-700">{ticket.hits} acerto{ticket.hits !== 1 ? 's' : ''}</span>
                              </div>
                              <span className="text-muted-foreground">{ticket.missing} faltando</span>
                              {ticket.rank_position != null && (
                                <div className="flex items-center gap-1">
                                  <Medal className="h-3.5 w-3.5 text-amber-500" />
                                  <span className="font-bold text-amber-600">{ticket.rank_position}º</span>
                                </div>
                              )}
                              {ticket.status === 'winner' && (
                                <Badge className="bg-yellow-500 text-white text-xs">Ganhador!</Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {raffle.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/sorteio/${raffle.id}`);
                          }}
                        >
                          Ver Sorteio
                          <ArrowRight className="h-3.5 w-3.5 ml-2" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
