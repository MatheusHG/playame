import { ReactNode, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Ticket,
  Users,
  DollarSign,
  BarChart3,
  Link as LinkIcon,
  LogOut,
  Menu,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface AffiliateLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AffiliateLayout({ children, title, description }: AffiliateLayoutProps) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { affiliate, loading, error, signOut, hasPermission } = useAffiliate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !affiliate && !error) {
      navigate(`/afiliado/${slug}/login`);
    }
  }, [loading, affiliate, error, navigate, slug]);

  if (loading) {
    return <LoadingState fullScreen message="Carregando portal..." />;
  }

  if (error || !affiliate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center p-8">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground mb-4">{error || 'Você não tem permissão para acessar este portal.'}</p>
          <Button onClick={() => navigate(`/afiliado/${slug}/login`)}>
            Fazer Login
          </Button>
        </div>
      </div>
    );
  }

  const isManager = affiliate.type === 'manager';
  const baseUrl = `/afiliado/${slug}`;

  const navItems = [
    { href: `${baseUrl}/dashboard`, label: 'Dashboard', icon: LayoutDashboard, show: true },
    { href: `${baseUrl}/vendas`, label: 'Minhas Vendas', icon: Ticket, show: hasPermission('can_view_own_sales') },
    { href: `${baseUrl}/nova-venda`, label: 'Nova Venda', icon: Ticket, show: hasPermission('can_create_sales') },
    { href: `${baseUrl}/equipe`, label: 'Minha Equipe', icon: Users, show: isManager && hasPermission('can_manage_cambistas') },
    { href: `${baseUrl}/comissoes`, label: 'Comissões', icon: DollarSign, show: hasPermission('can_view_own_commissions') },
    { href: `${baseUrl}/relatorios`, label: 'Relatórios', icon: BarChart3, show: hasPermission('can_view_reports') },
    { href: `${baseUrl}/meu-link`, label: 'Meu Link', icon: LinkIcon, show: true },
  ].filter(item => item.show);

  const handleSignOut = async () => {
    await signOut();
    navigate(`/afiliado/${slug}/login`);
  };

  // Apply company branding
  const primaryColor = affiliate.company.primary_color || '#3B82F6';

  return (
    <div className="min-h-screen bg-background" style={{ '--company-primary': primaryColor } as any}>
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold">{affiliate.company.name}</h1>
        </div>
        <UserMenu affiliate={affiliate} onSignOut={handleSignOut} />
      </header>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 border-r bg-card transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center gap-3 border-b px-4">
          {affiliate.company.logo_url ? (
            <img src={affiliate.company.logo_url} alt="" className="h-8 w-auto" />
          ) : (
            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold">{affiliate.company.name.charAt(0)}</span>
            </div>
          )}
          <div className="flex-1 truncate">
            <p className="font-semibold truncate">{affiliate.company.name}</p>
            <p className="text-xs text-muted-foreground">Portal do Afiliado</p>
          </div>
        </div>

        {affiliate.is_sales_paused && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              Vendas Pausadas
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Suas vendas estão temporariamente pausadas. Entre em contato com seu gerente.
            </p>
          </div>
        )}

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block border-t p-4">
          <UserMenu affiliate={affiliate} onSignOut={handleSignOut} showFull />
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="container py-6 px-4 lg:px-8">
          {(title || description) && (
            <div className="mb-6">
              {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
              {description && <p className="text-muted-foreground">{description}</p>}
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

function UserMenu({ 
  affiliate, 
  onSignOut, 
  showFull = false 
}: { 
  affiliate: any; 
  onSignOut: () => void;
  showFull?: boolean;
}) {
  if (showFull) {
    return (
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback>{affiliate.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{affiliate.name}</p>
          <Badge variant="outline" className="text-xs">
            {affiliate.type === 'manager' ? 'Gerente' : 'Cambista'}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{affiliate.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{affiliate.name}</p>
          <p className="text-xs text-muted-foreground">
            {affiliate.type === 'manager' ? 'Gerente' : 'Cambista'}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
