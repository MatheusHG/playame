import { ReactNode, useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Trophy,
  Users,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  Network,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import { LoadingState } from '@/components/shared/LoadingState';

interface EmpresaLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function EmpresaLayout({ children, title, description }: EmpresaLayoutProps) {
  const { signOut, user, isAdminEmpresa } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const { company, loading, setCompanySlug } = useTenant();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const publicCompanyIdentifier = company?.id ?? slug ?? company?.slug;

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  useCompanyBranding();

  const isAdmin = company ? isAdminEmpresa(company.id) : false;

  const navigation = [
    { name: 'Dashboard', href: `/empresa/${slug}/dashboard`, icon: LayoutDashboard, show: true },
    { name: 'Sorteios', href: `/empresa/${slug}/sorteios`, icon: Trophy, show: true },
    { name: 'Jogadores', href: `/empresa/${slug}/jogadores`, icon: Users, show: true },
    { name: 'Afiliados', href: `/empresa/${slug}/afiliados`, icon: Network, show: isAdmin },
    { name: 'Financeiro', href: `/empresa/${slug}/financeiro`, icon: DollarSign, show: isAdmin },
    { name: 'Configurações', href: `/empresa/${slug}/configuracoes`, icon: Settings, show: isAdmin },
  ].filter(item => item.show);

  if (loading) {
    return <LoadingState fullScreen message="Carregando empresa..." />;
  }

  if (!company) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Empresa não encontrada</h1>
          <p className="text-muted-foreground">A empresa solicitada não existe ou está inativa.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform border-r transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ backgroundColor: 'hsl(var(--card))' }}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <div className="flex items-center gap-2">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="h-8 w-auto" />
            ) : (
              <div
                className="h-8 w-8 rounded flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: company.primary_color }}
              >
                {company.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-semibold truncate">{company.name}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'text-white'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
                style={isActive ? { backgroundColor: company.primary_color } : undefined}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t p-4">
          <div className="mb-3 text-sm">
            <p className="text-muted-foreground">Logado como</p>
            <p className="font-medium truncate">{user?.email}</p>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex flex-1 items-center justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground truncate">{description}</p>
              )}
            </div>

            {publicCompanyIdentifier && (
              <Button asChild variant="outline" size="sm">
                <a href={`/empresa/${publicCompanyIdentifier}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Abrir site
                </a>
              </Button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
