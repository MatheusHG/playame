/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReactNode, useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface AffiliateLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

const SIDEBAR_KEY = 'affiliate-sidebar-collapsed';

export function AffiliateLayout({ children, title, description }: AffiliateLayoutProps) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { affiliate, loading, error, signOut, hasPermission, refetch } = useAffiliate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SIDEBAR_KEY) === 'true';
    }
    return false;
  });

  useEffect(() => {
    if (!loading && !affiliate && !error) {
      // Check if there's a token (user may have logged in via main /auth page)
      const token = localStorage.getItem('auth_token');
      if (token) {
        refetch();
      } else {
        navigate(`/afiliado/${slug}/login`);
      }
    }
  }, [loading, affiliate, error, navigate, slug, refetch]);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

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
          <Button onClick={() => navigate(`/afiliado/${slug}/login`)} className="rounded-xl">
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

  const primaryColor = affiliate.company.primary_color || '#3B82F6';

  return (
    <div className="min-h-screen bg-background" style={{ '--company-primary': primaryColor } as any}>
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur px-4">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold">{affiliate.company.name}</h1>
        </div>
        <UserMenu affiliate={affiliate} onSignOut={handleSignOut} />
      </header>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64',
        collapsed ? 'lg:w-[72px]' : 'lg:w-64'
      )}>
        {/* Header */}
        <div className={cn(
          'flex h-16 items-center border-b px-4',
          collapsed ? 'lg:justify-center lg:px-0' : 'gap-3'
        )}>
          {affiliate.company.logo_url ? (
            <img
              src={affiliate.company.logo_url}
              alt=""
              className={cn('h-9 w-9 rounded-xl object-contain flex-shrink-0', collapsed && 'lg:h-10 lg:w-10')}
            />
          ) : (
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-bold">{affiliate.company.name.charAt(0)}</span>
            </div>
          )}
          <div className={cn('flex-1 truncate', collapsed && 'lg:hidden')}>
            <p className="font-semibold truncate">{affiliate.company.name}</p>
            <p className="text-xs text-muted-foreground">Portal do Afiliado</p>
          </div>
        </div>

        {/* Paused Alert */}
        {affiliate.is_sales_paused && !collapsed && (
          <div className={cn('mx-3 mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20', collapsed && 'lg:hidden')}>
            <div className="flex items-center gap-2 text-destructive text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              Vendas Pausadas
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Suas vendas estão temporariamente pausadas.
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className={cn('flex-1 flex flex-col gap-1 p-3 overflow-y-auto', collapsed && 'lg:items-center lg:px-2')}>
          <TooltipProvider delayDuration={0}>
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const linkContent = (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    collapsed && 'lg:justify-center lg:px-0 lg:w-11 lg:h-11 lg:mx-auto',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span className={cn('transition-opacity duration-200', collapsed && 'lg:hidden')}>
                    {item.label}
                  </span>
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild className="hidden lg:flex">
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.label}
                    </TooltipContent>
                    <div className="lg:hidden">{linkContent}</div>
                  </Tooltip>
                );
              }
              return linkContent;
            })}
          </TooltipProvider>
        </nav>

        {/* Footer */}
        <div className={cn('border-t p-3', collapsed && 'lg:px-2')}>
          {collapsed ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="hidden lg:flex justify-center">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{affiliate.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="font-medium">{affiliate.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {affiliate.type === 'manager' ? 'Gerente' : 'Operador'}
                  </p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="hidden lg:flex w-11 h-11 mx-auto mt-2 rounded-xl"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
              {/* Mobile - full footer */}
              <div className="lg:hidden">
                <UserMenu affiliate={affiliate} onSignOut={handleSignOut} showFull />
              </div>
            </TooltipProvider>
          ) : (
            <div className="hidden lg:block">
              <UserMenu affiliate={affiliate} onSignOut={handleSignOut} showFull />
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn('transition-all duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        {/* Desktop top bar with collapse toggle */}
        <div className="hidden lg:flex sticky top-0 z-30 h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl h-9 w-9"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
          {title && (
            <div>
              <h1 className="text-lg font-semibold">{title}</h1>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          )}
        </div>

        <div className="container py-6 px-4 lg:px-8">
          {/* Mobile title (already in desktop topbar) */}
          {(title || description) && (
            <div className="mb-6 lg:hidden">
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
  showFull = false,
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
            {affiliate.type === 'manager' ? 'Gerente' : 'Operador'}
          </Badge>
        </div>
        <Button variant="ghost" size="icon" onClick={onSignOut} className="rounded-xl">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{affiliate.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{affiliate.name}</p>
          <p className="text-xs text-muted-foreground">
            {affiliate.type === 'manager' ? 'Gerente' : 'Operador'}
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
