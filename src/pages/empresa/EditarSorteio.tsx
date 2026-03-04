import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { RaffleForm, type RaffleFormData, type PrizeTierInput } from '@/components/empresa/RaffleForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRaffle, useRaffleMutations, usePrizeTierMutations } from '@/hooks/useRaffles';

export default function EditarSorteio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { company, loading: tenantLoading } = useTenant();
  const { data: raffle, isLoading: raffleLoading } = useRaffle(id);
  const { updateRaffle } = useRaffleMutations(company?.id);
  const { savePrizeTiers } = usePrizeTierMutations(id);

  const handleSubmit = (data: RaffleFormData, tiers: PrizeTierInput[]) => {
    if (!raffle) return;

    // Save raffle data
    updateRaffle.mutate(
      {
        id: raffle.id,
        data: {
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
          rules_version: (raffle.rules_version || 1) + 1,
        },
      },
      {
        onSuccess: () => {
          navigate(`/admin/sorteios/${id}`);
        },
      }
    );

    // Save prize tiers in parallel
    savePrizeTiers.mutate(tiers.map(({ id: _id, ...rest }) => rest));
  };

  if (tenantLoading || raffleLoading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  if (!raffle) {
    return (
      <EmpresaLayout title="Sorteio não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">O sorteio solicitado não foi encontrado.</p>
          <Button onClick={() => navigate('/admin/sorteios')} className="rounded-xl">Voltar</Button>
        </div>
      </EmpresaLayout>
    );
  }

  return (
    <EmpresaLayout title={`Editar: ${raffle.name}`} description="Edite as configurações do sorteio">
      <Button variant="ghost" className="mb-6 rounded-xl" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <RaffleForm
        companyId={company?.id || ''}
        adminFeePercent={company?.admin_fee_percentage ?? 10}
        raffleId={raffle.id}
        currentDrawCount={raffle.current_draw_count || 0}
        defaultPrizeTiers={raffle.prize_tiers || []}
        defaultValues={{
          name: raffle.name,
          description: raffle.description || '',
          regulations: (raffle as any).regulations || '',
          ticket_price: Number(raffle.ticket_price),
          number_range_start: raffle.number_range_start,
          number_range_end: raffle.number_range_end,
          numbers_per_ticket: raffle.numbers_per_ticket,
          prize_mode: raffle.prize_mode || 'PERCENT_ONLY',
          fixed_prize_value: Number(raffle.fixed_prize_value) || 0,
          prize_percent_of_sales: Number(raffle.prize_percent_of_sales) || 100,
          company_profit_percent: Number(raffle.company_profit_percent) || 0,
          status: raffle.status || 'draft',
          scheduled_at: raffle.scheduled_at?.slice(0, 16) || '',
          image_url: raffle.image_url || null,
        }}
        onSubmit={handleSubmit}
        isLoading={updateRaffle.isPending || savePrizeTiers.isPending}
        submitLabel="Salvar Alterações"
      />
    </EmpresaLayout>
  );
}
