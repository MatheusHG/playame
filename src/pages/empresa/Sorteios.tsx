import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';

export default function EmpresaSorteios() {
  const { slug } = useParams<{ slug: string }>();
  const { setCompanySlug, company, loading } = useTenant();

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  if (loading) {
    return <LoadingState fullScreen message="Carregando empresa..." />;
  }

  return (
    <EmpresaLayout title="Sorteios" description="Gerencie os sorteios da empresa">
      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground text-center py-12">
          Módulo de sorteios será implementado na Fase 3.
        </p>
      </div>
    </EmpresaLayout>
  );
}
