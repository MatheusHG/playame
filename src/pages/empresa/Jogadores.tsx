import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';

export default function EmpresaJogadores() {
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
    <EmpresaLayout title="Jogadores" description="Gerencie os jogadores da empresa">
      <div className="rounded-lg border bg-card p-6">
        <p className="text-muted-foreground text-center py-12">
          Módulo de jogadores será implementado na Fase 4.
        </p>
      </div>
    </EmpresaLayout>
  );
}
