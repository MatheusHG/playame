import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Ticket = Database['public']['Tables']['tickets']['Row'];
type TicketNumber = Database['public']['Tables']['ticket_numbers']['Row'];
type TicketRanking = Database['public']['Tables']['ticket_ranking']['Row'];
type Player = Database['public']['Tables']['players']['Row'];

export interface TicketWithDetails extends Ticket {
  ticket_numbers: TicketNumber[];
  players: Pick<Player, 'id' | 'name' | 'cpf_last4' | 'city'> | null;
}

export interface RankingEntry extends TicketRanking {
  tickets: {
    id: string;
    purchased_at: string | null;
    snapshot_data: Record<string, unknown> | null;
    ticket_numbers: TicketNumber[];
  } | null;
  players: Pick<Player, 'id' | 'name' | 'cpf_last4' | 'city'> | null;
}

export function useRaffleTickets(raffleId: string | undefined) {
  return useQuery({
    queryKey: ['raffle-tickets', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          ticket_numbers(*),
          players(id, name, cpf_last4, city)
        `)
        .eq('raffle_id', raffleId!)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TicketWithDetails[];
    },
  });
}

export function useRaffleRanking(raffleId: string | undefined) {
  return useQuery({
    queryKey: ['raffle-ranking', raffleId],
    enabled: !!raffleId,
    refetchInterval: 30000, // Refresh every 30 seconds
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_ranking')
        .select(`
          *,
          tickets(id, purchased_at, snapshot_data, ticket_numbers(*)),
          players(id, name, cpf_last4, city)
        `)
        .eq('raffle_id', raffleId!)
        .order('rank_position', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as RankingEntry[];
    },
  });
}

export function useTicketMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const cancelTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'cancelled' })
        .eq('id', ticketId);

      if (error) throw error;
    },
    onSuccess: (_, ticketId) => {
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
      const { data, error } = await supabase
        .rpc('settle_raffle_winners', { p_raffle_id: raffleId });

      if (error) throw error;
      return data as {
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
      };
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
