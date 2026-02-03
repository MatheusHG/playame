import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Affiliate, AffiliateType, PlatformSettings } from '@/types/affiliate.types';

interface CreateAffiliateData {
  company_id: string;
  parent_affiliate_id?: string;
  type: AffiliateType;
  name: string;
  phone?: string;
  email?: string;
  commission_percent: number;
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

  // Buscar afiliados por empresa
  const { data: affiliates = [], isLoading } = useQuery({
    queryKey: ['affiliates', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      const { data, error } = await (supabase as any)
        .from('affiliates')
        .select('*')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Affiliate[];
    },
    enabled: !!companyId,
  });

  // Buscar apenas gerentes
  const managers = affiliates.filter(a => a.type === 'manager');

  // Buscar cambistas de um gerente específico
  const getCambistas = (managerId: string) => 
    affiliates.filter(a => a.type === 'cambista' && a.parent_affiliate_id === managerId);

  // Criar afiliado
  const createAffiliate = useMutation({
    mutationFn: async (data: CreateAffiliateData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: affiliate, error } = await (supabase as any)
        .from('affiliates')
        .insert({
          ...data,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Log de auditoria
      await supabase.rpc('log_audit', {
        p_company_id: data.company_id,
        p_user_id: user?.id,
        p_player_id: null,
        p_action: 'CREATE',
        p_entity_type: 'affiliate',
        p_entity_id: affiliate.id,
        p_changes: { 
          type: data.type, 
          name: data.name, 
          commission_percent: data.commission_percent 
        },
      });

      return affiliate as Affiliate;
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

  // Atualizar afiliado
  const updateAffiliate = useMutation({
    mutationFn: async ({ id, ...data }: UpdateAffiliateData) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Buscar dados antigos para log
      const { data: oldData } = await (supabase as any)
        .from('affiliates')
        .select('*')
        .eq('id', id)
        .single();

      const { data: affiliate, error } = await (supabase as any)
        .from('affiliates')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Se mudou comissão, registrar alteração
      if (data.commission_percent !== undefined && oldData?.commission_percent !== data.commission_percent) {
        await (supabase as any).from('commission_rate_changes').insert({
          entity_type: oldData?.type === 'manager' ? 'manager' : 'affiliate',
          entity_id: id,
          field_changed: 'commission_percent',
          old_value: oldData?.commission_percent,
          new_value: data.commission_percent,
          changed_by: user?.id,
          company_id: affiliate.company_id,
        });
      }

      // Log de auditoria
      await supabase.rpc('log_audit', {
        p_company_id: affiliate.company_id,
        p_user_id: user?.id,
        p_player_id: null,
        p_action: 'UPDATE',
        p_entity_type: 'affiliate',
        p_entity_id: id,
        p_changes: { before: oldData, after: data },
      });

      return affiliate as Affiliate;
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

  // Soft delete
  const deleteAffiliate = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: affiliate, error } = await (supabase as any)
        .from('affiliates')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log de auditoria
      await supabase.rpc('log_audit', {
        p_company_id: affiliate.company_id,
        p_user_id: user?.id,
        p_player_id: null,
        p_action: 'DELETE',
        p_entity_type: 'affiliate',
        p_entity_id: id,
      });

      return affiliate;
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
      const { data, error } = await (supabase as any)
        .from('platform_settings')
        .select('*');

      if (error) throw error;
      return data as PlatformSettings[];
    },
  });

  const getSuperAdminFeePercent = () => {
    const setting = settings?.find(s => s.key === 'super_admin_fee_percent');
    return setting?.value?.value ?? 10;
  };

  const updateSuperAdminFee = useMutation({
    mutationFn: async (newPercent: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      const currentPercent = getSuperAdminFeePercent();

      const { error } = await (supabase as any)
        .from('platform_settings')
        .upsert({
          key: 'super_admin_fee_percent',
          value: { value: newPercent },
          updated_by: user?.id,
        }, { onConflict: 'key' });

      if (error) throw error;

      // Registrar alteração
      await (supabase as any).from('commission_rate_changes').insert({
        entity_type: 'platform',
        entity_id: '00000000-0000-0000-0000-000000000000',
        field_changed: 'super_admin_fee_percent',
        old_value: currentPercent,
        new_value: newPercent,
        changed_by: user?.id,
        company_id: null,
      });
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
      let query = (supabase as any)
        .from('affiliate_commissions')
        .select(`
          *,
          manager:affiliates!affiliate_commissions_manager_id_fkey(id, name),
          cambista:affiliates!affiliate_commissions_cambista_id_fkey(id, name),
          raffle:raffles(name)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return { commissions, isLoading };
}
