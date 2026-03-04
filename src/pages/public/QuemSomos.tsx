import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { PublicNavMenu } from '@/components/public/PublicNavMenu';
import { PublicFooter } from '@/components/public/PublicFooter';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Info } from 'lucide-react';
import { PlayerAccountMenu } from '@/components/public/PlayerAccountMenu';
import { usePlayer } from '@/contexts/PlayerContext';

export default function QuemSomos() {
  const { company, loading: tenantLoading } = useTenant();
  const { player, isAuthenticated, logout } = usePlayer();

  useCompanyBranding();

  if (tenantLoading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Empresa não encontrada.</p>
      </div>
    );
  }

  const primaryColor = company.primary_color || '#3B82F6';
  const aboutUs = (company as any).about_us;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: primaryColor }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-10 w-auto" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                {company.name.charAt(0)}
              </div>
            )}
            <span className="text-white font-bold text-xl">{company.name}</span>
          </div>
          {isAuthenticated && player && (
            <PlayerAccountMenu player={player} onLogout={logout} variant="secondary" className="bg-white/20 text-white hover:bg-white/30" />
          )}
        </div>
      </header>

      <PublicNavMenu primaryColor={primaryColor} companyId={company.id} />

      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Quem Somos</h1>
        </div>

        <Card>
          <CardContent className="py-8">
            {aboutUs ? (
              <div className="prose max-w-none">
                {aboutUs.split('\n').map((paragraph: string, idx: number) => (
                  paragraph.trim() ? (
                    <p key={idx} className="text-foreground leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ) : (
                    <br key={idx} />
                  )
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Info className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">Informação não disponível no momento.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <PublicFooter />
    </div>
  );
}
