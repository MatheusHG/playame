import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import type { Raffle, PrizeTier, DrawBatch, DrawNumber, RaffleStatus } from '@/types/database.types';

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
      return api.get<RaffleWithTiers[]>(`/raffles/company/${companyId}`);
    },
  });
}

export function useRaffle(raffleId: string | undefined) {
  return useQuery({
    queryKey: ['raffle', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      return api.get<RaffleWithTiers>(`/raffles/${raffleId}`);
    },
  });
}

export function useDrawnNumbers(raffleId: string | undefined) {
  return useQuery({
    queryKey: ['drawn-numbers', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      const result = await api.get<{ numbers: number[] }>(`/draws/raffle/${raffleId}/drawn-numbers`);
      return new Set(result.numbers);
    },
  });
}

export function useDrawBatches(raffleId: string | undefined) {
  return useQuery({
    queryKey: ['draw-batches', raffleId],
    enabled: !!raffleId,
    queryFn: async () => {
      return api.get<DrawBatchWithNumbers[]>(`/draws/raffle/${raffleId}`);
    },
  });
}

export function useRaffleMutations(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createRaffle = useMutation({
    mutationFn: async (data: Partial<Raffle>) => {
      return api.post<Raffle>(`/raffles/company/${companyId}`, data);
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<Raffle> }) => {
      return api.patch<Raffle>(`/raffles/${id}`, data);
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
      return api.delete(`/raffles/${raffleId}`);
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
    mutationFn: async ({ id, status }: { id: string; status: RaffleStatus }) => {
      return api.patch(`/raffles/${id}/status`, { status });
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
    mutationFn: async (tiers: Omit<PrizeTier, 'id' | 'raffle_id' | 'created_at' | 'updated_at'>[]) => {
      return api.put(`/raffles/${raffleId}/prize-tiers`, { tiers });
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
      return api.post<DrawBatch>(`/draws/raffle/${raffleId}`, data);
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
      return api.post(`/draws/${batchId}/numbers`, { raffleId, number });
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
      return api.delete(`/draws/numbers/${numberId}`);
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
      return api.patch(`/draws/${batchId}/finalize`);
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
      return api.delete(`/draws/${batchId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draw-batches', raffleId] });
      toast({ title: 'Rodada removida!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao remover rodada', description: error.message });
    },
  });

  const updateBatch = useMutation({
    mutationFn: async ({ batchId, name }: { batchId: string; name: string }) => {
      return api.patch(`/draws/${batchId}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draw-batches', raffleId] });
      toast({ title: 'Rodada atualizada!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao atualizar rodada', description: error.message });
    },
  });

  return { createBatch, addNumber, removeNumber, finalizeBatch, deleteBatch, updateBatch };
}
