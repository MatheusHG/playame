import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { RaffleForm, type RaffleFormData } from '@/components/empresa/RaffleForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRaffle, useRaffleMutations } from '@/hooks/useRaffles';

export default function EditarSorteio() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const navigate = useNavigate();
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();
  const { data: raffle, isLoading: raffleLoading } = useRaffle(id);
  const { updateRaffle } = useRaffleMutations(company?.id);

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  const handleSubmit = (data: RaffleFormData) => {
    if (!raffle) return;

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
          navigate(`/empresa/${slug}/sorteios/${id}`);
        },
      }
    );
  };

  if (tenantLoading || raffleLoading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  if (!raffle) {
    return (
      <EmpresaLayout title="Sorteio não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">O sorteio solicitado não foi encontrado.</p>
          <Button onClick={() => navigate(`/empresa/${slug}/sorteios`)}>Voltar</Button>
        </div>
      </EmpresaLayout>
    );
  }

  return (
    <EmpresaLayout title={`Editar: ${raffle.name}`} description="Edite as configurações do sorteio">
      <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <div className="max-w-3xl">
        <RaffleForm
          companyId={company?.id || ''}
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
          isLoading={updateRaffle.isPending}
          submitLabel="Salvar Alterações"
        />
      </div>
    </EmpresaLayout>
  );
}
