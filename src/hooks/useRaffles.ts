import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Raffle = Database['public']['Tables']['raffles']['Row'];
type RaffleInsert = Database['public']['Tables']['raffles']['Insert'];
type RaffleUpdate = Database['public']['Tables']['raffles']['Update'];
type PrizeTier = Database['public']['Tables']['prize_tiers']['Row'];
type PrizeTierInsert = Database['public']['Tables']['prize_tiers']['Insert'];
type DrawBatch = Database['public']['Tables']['draw_batches']['Row'];
type DrawNumber = Database['public']['Tables']['draw_numbers']['Row'];

export interface RaffleWithTiers extends Raffle {
  prize_tiers: PrizeTier[];
}

export interface DrawBatchWithNumbers extends DrawBatch {
  draw_numbers: DrawNumber[];
}

export function useRaffles(companyId: string | undefined) {
  return useQuery({
    queryKey: ['raffles', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raffles')
        .select('*, prize_tiers(*)')
        .eq('company_id', companyId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RaffleWithTiers[];
    },
  });
}

export function useRaffle(raffleId: string | undefined) {
  return useQuery({
    queryKey: ['raffle', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raffles')
        .select('*, prize_tiers(*)')
        .eq('id', raffleId!)
        .single();

      if (error) throw error;
      return data as RaffleWithTiers;
    },
  });
}

export function useDrawBatches(raffleId: string | undefined) {
  return useQuery({
    queryKey: ['draw-batches', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draw_batches')
        .select('*, draw_numbers(*)')
        .eq('raffle_id', raffleId!)
        .order('draw_order', { ascending: true });

      if (error) throw error;
      return data as DrawBatchWithNumbers[];
    },
  });
}

export function useRaffleMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createRaffle = useMutation({
    mutationFn: async (data: Omit<RaffleInsert, 'company_id'>) => {
      const { data: raffle, error } = await supabase
        .from('raffles')
        .insert({ ...data, company_id: companyId! })
        .select()
        .single();

      if (error) throw error;
      return raffle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffles', companyId] });
      toast({ title: 'Sorteio criado com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao criar sorteio', description: error.message });
    },
  });

  const updateRaffle = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RaffleUpdate }) => {
      // Increment rules_version on significant changes
      const { data: raffle, error } = await supabase
        .from('raffles')
        .update({ ...data, rules_version: data.rules_version })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return raffle;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['raffles', companyId] });
      queryClient.invalidateQueries({ queryKey: ['raffle', variables.id] });
      toast({ title: 'Sorteio atualizado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: error.message });
    },
  });

  const deleteRaffle = useMutation({
    mutationFn: async (raffleId: string) => {
      const { error } = await supabase
        .from('raffles')
        .update({ deleted_at: new Date().toISOString(), status: 'finished' })
        .eq('id', raffleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffles', companyId] });
      toast({ title: 'Sorteio removido' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao remover', description: error.message });
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Database['public']['Enums']['raffle_status'] }) => {
      const updateData: RaffleUpdate = { status };
      if (status === 'finished') {
        updateData.finished_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('raffles')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['raffles', companyId] });
      queryClient.invalidateQueries({ queryKey: ['raffle', variables.id] });
      toast({ title: 'Status alterado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao alterar status', description: error.message });
    },
  });

  return { createRaffle, updateRaffle, deleteRaffle, changeStatus };
}

export function usePrizeTierMutations(raffleId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const savePrizeTiers = useMutation({
    mutationFn: async (tiers: Omit<PrizeTierInsert, 'raffle_id'>[]) => {
      // Get current rules_version
      const { data: currentRaffle } = await supabase
        .from('raffles')
        .select('rules_version')
        .eq('id', raffleId!)
        .single();

      // Delete existing tiers
      await supabase.from('prize_tiers').delete().eq('raffle_id', raffleId!);

      // Insert new tiers
      if (tiers.length > 0) {
        const { error } = await supabase
          .from('prize_tiers')
          .insert(tiers.map(t => ({ ...t, raffle_id: raffleId! })));

        if (error) throw error;
      }

      // Increment rules version
      await supabase
        .from('raffles')
        .update({ rules_version: (currentRaffle?.rules_version || 1) + 1 })
        .eq('id', raffleId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raffle', raffleId] });
      toast({ title: 'Faixas de prêmio salvas!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar faixas', description: error.message });
    },
  });

  return { savePrizeTiers };
}

export function useDrawBatchMutations(raffleId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createBatch = useMutation({
    mutationFn: async (data: { name?: string }) => {
      // Get next draw_order
      const { data: batches } = await supabase
        .from('draw_batches')
        .select('draw_order')
        .eq('raffle_id', raffleId!)
        .order('draw_order', { ascending: false })
        .limit(1);

      const nextOrder = (batches?.[0]?.draw_order || 0) + 1;

      const { data: batch, error } = await supabase
        .from('draw_batches')
        .insert({
          raffle_id: raffleId!,
          name: data.name || `Rodada ${nextOrder}`,
          draw_order: nextOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return batch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draw-batches', raffleId] });
      toast({ title: 'Rodada criada!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao criar rodada', description: error.message });
    },
  });

  const addNumber = useMutation({
    mutationFn: async ({ batchId, number }: { batchId: string; number: number }) => {
      const { error } = await supabase
        .from('draw_numbers')
        .insert({
          draw_batch_id: batchId,
          raffle_id: raffleId!,
          number,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draw-batches', raffleId] });
      toast({ title: 'Número adicionado!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao adicionar número', description: error.message });
    },
  });

  const removeNumber = useMutation({
    mutationFn: async (numberId: string) => {
      const { error } = await supabase
        .from('draw_numbers')
        .delete()
        .eq('id', numberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draw-batches', raffleId] });
      toast({ title: 'Número removido!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao remover número', description: error.message });
    },
  });

  const finalizeBatch = useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase
        .from('draw_batches')
        .update({ finalized_at: new Date().toISOString() })
        .eq('id', batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draw-batches', raffleId] });
      toast({ title: 'Rodada finalizada!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao finalizar rodada', description: error.message });
    },
  });

  const deleteBatch = useMutation({
    mutationFn: async (batchId: string) => {
      // Delete numbers first
      await supabase.from('draw_numbers').delete().eq('draw_batch_id', batchId);
      
      const { error } = await supabase
        .from('draw_batches')
        .delete()
        .eq('id', batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draw-batches', raffleId] });
      toast({ title: 'Rodada removida!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao remover rodada', description: error.message });
    },
  });

  return { createBatch, addNumber, removeNumber, finalizeBatch, deleteBatch };
}
