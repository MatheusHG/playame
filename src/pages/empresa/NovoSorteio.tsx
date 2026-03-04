import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { RaffleForm, type RaffleFormData, type PrizeTierInput } from '@/components/empresa/RaffleForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRaffleMutations } from '@/hooks/useRaffles';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

export default function NovoSorteio() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { setCompanySlug, company, loading } = useTenant();
  const { createRaffle } = useRaffleMutations(company?.id);
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  const handleSubmit = (data: RaffleFormData, tiers: PrizeTierInput[]) => {
    setIsSaving(true);
    createRaffle.mutate(
      {
        name: data.name,
        description: data.description || null,
        regulations: (data as any).regulations || null,
        ticket_price: data.ticket_price,
        number_range_start: data.number_range_start,
        number_range_end: data.number_range_end,
        numbers_per_ticket: data.numbers_per_ticket,
        prize_mode: data.prize_mode,
        fixed_prize_value: data.fixed_prize_value,
        prize_percent_of_sales: data.prize_percent_of_sales,
        company_profit_percent: data.company_profit_percent,
        status: data.status,
        scheduled_at: data.scheduled_at || null,
        image_url: data.image_url || null,
      },
      {
        onSuccess: async (raffle) => {
          // Save prize tiers with the new raffle ID
          if (tiers.length > 0) {
            try {
              await api.put(`/raffles/${raffle.id}/prize-tiers`, {
                tiers: tiers.map(({ id, ...rest }) => rest),
              });
            } catch (error: any) {
              toast({
                variant: 'destructive',
                title: 'Sorteio criado, mas erro ao salvar faixas',
                description: error.message || 'Você pode configurar as faixas na página do sorteio.',
              });
            }
          }
          navigate(`/empresa/${slug}/sorteios/${raffle.id}`);
        },
        onSettled: () => setIsSaving(false),
      }
    );
  };

  if (loading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  return (
    <EmpresaLayout title="Novo Sorteio" description="Crie um novo sorteio para sua empresa">
      <Button variant="ghost" className="mb-6 rounded-xl" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <RaffleForm
        companyId={company?.id || ''}
        adminFeePercent={company?.admin_fee_percentage ?? 10}
        onSubmit={handleSubmit}
        isLoading={createRaffle.isPending || isSaving}
        submitLabel="Criar Sorteio"
      />
    </EmpresaLayout>
  );
}
