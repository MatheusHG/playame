import { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCompanyBranding, useTenant } from '@/contexts/TenantContext';
import { usePlayer } from '@/contexts/PlayerContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

interface ThemedLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  className?: string;
}

export function ThemedLayout({ children, showHeader = true, className }: ThemedLayoutProps) {
  const { loading, error } = useTenant();
  const company = useCompanyBranding();
  const { player, isAuthenticated } = usePlayer();
  const { slug } = useParams<{ slug: string }>();

  if (loading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Erro</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn('min-h-screen bg-background', className)}
      style={{
        '--company-primary': company?.primary_color ?? 'hsl(var(--primary))',
        '--company-secondary': company?.secondary_color ?? 'hsl(var(--secondary))',
      } as React.CSSProperties}
    >
      {showHeader && company && (
        <header className="border-b bg-card">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <Link to={`/empresa/${slug}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              {company.logo_url ? (
                <img 
                  src={company.logo_url} 
                  alt={company.name}
                  className="h-8 w-auto object-contain"
                />
              ) : (
                <div 
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: company.primary_color }}
                >
                  {company.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-semibold text-lg">{company.name}</span>
            </Link>

            {/* Player Account Link */}
            {isAuthenticated && player && slug && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/empresa/${slug}/minha-conta`}>
                  <User className="h-4 w-4 mr-2" />
                  {player.name.split(' ')[0]}
                </Link>
              </Button>
            )}
          </div>
        </header>
      )}
      
      <main>{children}</main>
    </div>
  );
}
