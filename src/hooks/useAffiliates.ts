import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Affiliate, AffiliateType, PlatformSettings } from '@/types/affiliate.types';

interface CreateAffiliateData {
  company_id: string;
  parent_affiliate_id?: string;
  type: AffiliateType;
  name: string;
  phone?: string;
  email?: string;
  password?: string;
  commission_percent: number;
  permission_profile_id?: string;
  create_user_account?: boolean;
}

interface UpdateAffiliateData {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  commission_percent?: number;
  is_active?: boolean;
}

export function useAffiliates(companyId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: affiliates = [], isLoading } = useQuery({
    queryKey: ['affiliates', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return api.get<Affiliate[]>(`/affiliates/company/${companyId}`);
    },
    enabled: !!companyId,
  });

  const managers = affiliates.filter(a => a.type === 'manager');

  const getCambistas = (managerId: string) =>
    affiliates.filter(a => a.type === 'cambista' && a.parent_affiliate_id === managerId);

  const createAffiliate = useMutation({
    mutationFn: async (data: CreateAffiliateData) => {
      const affiliate = await api.post<Affiliate>(`/affiliates/company/${data.company_id}`, {
        type: data.type,
        name: data.name,
        phone: data.phone,
        email: data.email,
        commission_percent: data.commission_percent,
        parent_affiliate_id: data.parent_affiliate_id,
        permission_profile_id: data.permission_profile_id,
      });

      // If creating user account, call the create-user endpoint
      if (data.create_user_account && data.email && data.password) {
        try {
          await api.post(`/affiliates/${affiliate.id}/create-user`, {
            email: data.email,
            password: data.password,
          });
        } catch (err) {
          // Delete the affiliate if user creation failed
          await api.delete(`/affiliates/${affiliate.id}`);
          throw err;
        }
      }

      return affiliate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast({
        title: 'Afiliado criado',
        description: 'O afiliado foi cadastrado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar afiliado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateAffiliate = useMutation({
    mutationFn: async ({ id, ...data }: UpdateAffiliateData) => {
      return api.patch<Affiliate>(`/affiliates/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast({
        title: 'Afiliado atualizado',
        description: 'As informações foram atualizadas com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar afiliado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteAffiliate = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/affiliates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast({
        title: 'Afiliado removido',
        description: 'O afiliado foi removido com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover afiliado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    affiliates,
    managers,
    getCambistas,
    isLoading,
    createAffiliate,
    updateAffiliate,
    deleteAffiliate,
  };
}

// Hook para taxa global do super-admin
export function usePlatformSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: async () => {
      return api.get<PlatformSettings[]>('/settings');
    },
  });

  const getSuperAdminFeePercent = () => {
    const setting = settings?.find(s => s.key === 'super_admin_fee_percent');
    return setting?.value?.value ?? 10;
  };

  const updateSuperAdminFee = useMutation({
    mutationFn: async (newPercent: number) => {
      return api.put('/settings/super_admin_fee_percent', { value: newPercent });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      toast({
        title: 'Taxa atualizada',
        description: 'A taxa global do Super-Admin foi atualizada.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar taxa',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    settings,
    isLoading,
    getSuperAdminFeePercent,
    updateSuperAdminFee,
  };
}

// Hook para buscar comissões
export function useAffiliateCommissions(companyId?: string) {
  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['affiliate-commissions', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      return api.get<any[]>(`/commissions/company/${companyId}`);
    },
  });

  return { commissions, isLoading };
}
