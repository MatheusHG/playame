import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Users,
  DollarSign,
  FileText,
  LogOut,
  Menu,
  X,
  Network,
  Webhook,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

interface SuperAdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const navigation = [
  { name: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
  { name: 'Empresas', href: '/super-admin/empresas', icon: Building2 },
  { name: 'Usuários', href: '/super-admin/usuarios', icon: Users },
  { name: 'Afiliados', href: '/super-admin/afiliados', icon: Network },
  { name: 'Financeiro', href: '/super-admin/financeiro', icon: DollarSign },
  { name: 'Auditoria', href: '/super-admin/auditoria', icon: FileText },
  { name: 'Webhook Logs', href: '/super-admin/webhook-logs', icon: Webhook },
];

const SIDEBAR_KEY = 'superadmin-sidebar-collapsed';

export function SuperAdminLayout({ children, title, description }: SuperAdminLayoutProps) {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SIDEBAR_KEY) === 'true';
    }
    return false;
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

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
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64',
          collapsed ? 'lg:w-[72px]' : 'lg:w-64'
        )}
      >
        {/* Header */}
        <div className={cn(
          'flex h-16 items-center border-b px-4',
          collapsed ? 'lg:justify-center lg:px-0' : 'justify-between'
        )}>
          <div className={cn('flex items-center gap-3', collapsed && 'lg:justify-center')}>
            <img
              src="/logo-default3.png"
              alt="Logo"
              className={cn('h-10 w-auto flex-shrink-0', collapsed && 'lg:h-9 lg:w-9 lg:object-contain')}
            />
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
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
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
      </aside>

      {/* Main content */}
      <div className={cn('transition-all duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
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

          <div>
            <h1 className="text-lg font-semibold">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
