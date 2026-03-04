import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Ticket, TicketNumber, TicketRanking, Player } from '@/types/database.types';

export interface TicketWithDetails extends Ticket {
  ticket_numbers: TicketNumber[];
  player: Pick<Player, 'id' | 'name' | 'cpf_last4' | 'city'> & { cpf_encrypted?: string | null } | null;
  payments?: Array<{ id: string }>;
  affiliate?: { id: string; name: string; type: string } | null;
}

export interface RankingEntry extends TicketRanking {
  ticket: {
    id: string;
    purchased_at: string | null;
    snapshot_data: Record<string, unknown> | null;
    ticket_numbers: TicketNumber[];
    eligible_prize_tiers: string[];
  } | null;
  player: Pick<Player, 'id' | 'name' | 'cpf_last4' | 'city'> & { cpf_encrypted?: string | null; phone?: string | null } | null;
}

export function useRaffleTickets(raffleId: string | undefined) {
  return useQuery({
    queryKey: ['raffle-tickets', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      return api.get<TicketWithDetails[]>(`/tickets/raffle/${raffleId}`);
    },
  });
}

export function useRaffleRanking(raffleId: string | undefined) {
  return useQuery({
    queryKey: ['raffle-ranking', raffleId],
    enabled: !!raffleId,
    refetchInterval: 30000,
    queryFn: async () => {
      return api.get<RankingEntry[]>(`/tickets/raffle/${raffleId}/ranking`);
    },
  });
}

export function useTicketMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cancelTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      return api.patch(`/tickets/${ticketId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['raffle-ranking'] });
      toast({ title: 'Cartela cancelada' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao cancelar', description: error.message });
    },
  });

  return { cancelTicket };
}

export function useSettleRaffle() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (raffleId: string) => {
      return api.post<{
        success: boolean;
        total_sales: number;
        prize_pool: number;
        winners: Array<{
          ticket_id: string;
          player_id: string;
          hits: number;
          tier_id: string;
          prize_type: string;
          prize_value: number;
          object_description: string | null;
        }>;
        error?: string;
      }>(`/raffles/${raffleId}/settle`);
    },
    onSuccess: (data, raffleId) => {
      if (data?.error) {
        toast({ variant: 'destructive', title: 'Erro na apuração', description: data.error });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['raffle', raffleId] });
      queryClient.invalidateQueries({ queryKey: ['raffles'] });
      queryClient.invalidateQueries({ queryKey: ['raffle-ranking', raffleId] });
      toast({
        title: 'Sorteio apurado!',
        description: `${data?.winners?.length || 0} ganhador(es) encontrado(s)`
      });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro na apuração', description: error.message });
    },
  });
}
