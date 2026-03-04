import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant, useCompanyBranding } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  Webhook,
  Store,
  ArrowLeft,
  ScrollText,
  ClipboardList,
  PanelLeftClose,
  PanelLeft,
  Search,
} from 'lucide-react';
import { LoadingState } from '@/components/shared/LoadingState';
import { SearchCartelaDialog } from '@/components/empresa/SearchCartelaDialog';

interface EmpresaLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  headerActions?: ReactNode;
}

const SIDEBAR_KEY = 'empresa-sidebar-collapsed';

export function EmpresaLayout({ children, title, description, headerActions }: EmpresaLayoutProps) {
  const { signOut, user, isAdminEmpresa, isSuperAdmin } = useAuth();
  const { company, loading } = useTenant();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SIDEBAR_KEY) === 'true';
    }
    return false;
  });
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  useCompanyBranding();

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

  const isAdmin = company ? isAdminEmpresa(company.id) : false;

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard, show: true },
    { name: 'Sorteios', href: '/admin/sorteios', icon: Trophy, show: true },
    { name: 'Venda de Rua', href: '/admin/venda-rua', icon: Store, show: isAdmin },
    { name: 'Jogadores', href: '/admin/jogadores', icon: Users, show: true },
    { name: 'Afiliados', href: '/admin/afiliados', icon: Network, show: isAdmin },
    { name: 'Financeiro', href: '/admin/financeiro', icon: DollarSign, show: isAdmin },
    { name: 'Webhook Logs', href: '/admin/webhook-logs', icon: Webhook, show: isAdmin },
    { name: 'Regulamento', href: '/admin/regulamento', icon: ScrollText, show: isAdmin },
    { name: 'Auditoria', href: '/admin/auditoria', icon: ClipboardList, show: isAdmin },
    { name: 'Personalização', href: '/admin/configuracoes', icon: Settings, show: isAdmin },
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

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-64';
  const mainPadding = collapsed ? 'lg:pl-[72px]' : 'lg:pl-64';

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
          'fixed inset-y-0 left-0 z-50 transform border-r transition-all duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64',
          `lg:${sidebarWidth}`
        )}
        style={{
          backgroundColor: 'hsl(var(--card))',
          width: undefined,
        }}
      >
        <div
          className={cn(
            'hidden lg:block transition-all duration-200',
            collapsed ? 'w-[72px]' : 'w-64'
          )}
        />
        <div
          className={cn(
            'fixed inset-y-0 left-0 flex flex-col transition-all duration-200 border-r bg-card',
            'lg:w-auto',
            collapsed ? 'lg:w-[72px]' : 'lg:w-64',
            sidebarOpen ? 'w-64' : 'w-64'
          )}
        >
          {/* Header */}
          <div className={cn(
            'flex h-16 items-center border-b px-4',
            collapsed ? 'lg:justify-center lg:px-0' : 'justify-between'
          )}>
            <div className={cn('flex items-center gap-3 min-w-0', collapsed && 'lg:justify-center')}>
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className={cn('h-9 w-9 rounded-xl object-contain flex-shrink-0', collapsed && 'lg:h-10 lg:w-10')}
                />
              ) : (
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: company.primary_color }}
                >
                  {company.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className={cn(
                'font-semibold truncate transition-opacity duration-200',
                collapsed && 'lg:hidden'
              )}>
                {company.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden flex-shrink-0"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className={cn('flex-1 flex flex-col gap-1 p-3 overflow-y-auto', collapsed && 'lg:items-center lg:px-2')}>
            <TooltipProvider delayDuration={0}>
              {navigation.map((item) => {
                const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
                const linkContent = (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                      collapsed && 'lg:justify-center lg:px-0 lg:w-11 lg:h-11 lg:mx-auto',
                      isActive
                        ? 'text-white shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                    style={isActive ? { backgroundColor: company.primary_color } : undefined}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon className={cn('h-5 w-5 flex-shrink-0', collapsed && 'lg:h-5 lg:w-5')} />
                    <span className={cn('transition-opacity duration-200', collapsed && 'lg:hidden')}>
                      {item.name}
                    </span>
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild className="hidden lg:flex">
                        {linkContent}
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.name}
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
            {isSuperAdmin && !collapsed && (
              <Link to="/super-admin/empresas">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 mb-2 text-muted-foreground hover:text-foreground rounded-xl"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar ao painel
                </Button>
              </Link>
            )}
            {isSuperAdmin && collapsed && (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/super-admin/empresas" className="hidden lg:block">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-11 h-11 mx-auto mb-2 text-muted-foreground hover:text-foreground rounded-xl"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Voltar ao painel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div className={cn('mb-3 text-sm', collapsed && 'lg:hidden')}>
              <p className="text-muted-foreground">Logado como</p>
              <p className="font-medium truncate">{user?.email}</p>
            </div>
            {collapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="hidden lg:flex w-11 h-11 mx-auto rounded-xl"
                      onClick={signOut}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sair</TooltipContent>
                </Tooltip>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 rounded-xl lg:hidden"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </Button>
              </TooltipProvider>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start gap-2 rounded-xl"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn('transition-all duration-200', mainPadding)}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
          {/* Mobile menu */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden rounded-xl"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Desktop collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex rounded-xl h-9 w-9"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>

          <div className="flex flex-1 items-center justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground truncate">{description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setSearchDialogOpen(true)}
              >
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Buscar Cartela</span>
              </Button>
              {headerActions}
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <a href="/" target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Abrir site</span>
                </a>
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>

      {/* Global Search Cartela Dialog */}
      {company && (
        <SearchCartelaDialog
          companyId={company.id}
          open={searchDialogOpen}
          onOpenChange={setSearchDialogOpen}
        />
      )}
    </div>
  );
}
