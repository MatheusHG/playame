import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { RaffleForm, type RaffleFormData } from '@/components/empresa/RaffleForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRaffleMutations } from '@/hooks/useRaffles';

export default function NovoSorteio() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { setCompanySlug, company, loading } = useTenant();
  const { createRaffle } = useRaffleMutations(company?.id);

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  const handleSubmit = (data: RaffleFormData) => {
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
        onSuccess: (raffle) => {
          navigate(`/empresa/${slug}/sorteios/${raffle.id}`);
        },
      }
    );
  };

  if (loading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  return (
    <EmpresaLayout title="Novo Sorteio" description="Crie um novo sorteio para sua empresa">
      <Button variant="ghost" className="mb-6" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <div className="max-w-3xl">
        <RaffleForm 
          companyId={company?.id || ''} 
          onSubmit={handleSubmit} 
          isLoading={createRaffle.isPending} 
          submitLabel="Criar Sorteio" 
        />
      </div>
    </EmpresaLayout>
  );
}
