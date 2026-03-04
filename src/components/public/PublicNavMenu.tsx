import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Home, Hash, Trophy, Users, Phone, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MeusNumerosModal } from './MeusNumerosModal';

interface PublicNavMenuProps {
  primaryColor?: string;
  companyId?: string;
}

const navItems = [
  { key: 'inicio', label: 'Início', icon: Home, path: '' },
  { key: 'meus-numeros', label: 'Meus Números', icon: Hash, path: null },
  { key: 'ganhadores', label: 'Ganhadores', icon: Trophy, path: 'ganhadores' },
  { key: 'quem-somos', label: 'Quem Somos', icon: Users, path: 'quem-somos' },
  { key: 'contato', label: 'Fale Conosco', icon: Phone, path: 'contato' },
];

export function PublicNavMenu({ primaryColor = '#3B82F6', companyId }: PublicNavMenuProps) {
  const [meusNumerosOpen, setMeusNumerosOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav
        className="border-b bg-white/95 backdrop-blur-sm sticky top-16 z-40"
        style={{ borderColor: `${primaryColor}20` }}
      >
        <div className="container mx-auto px-4">
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1 h-12 justify-center">
            {navItems.map((item) => {
              const Icon = item.icon;
              if (item.path === null) {
                return (
                  <button
                    key={item.key}
                    onClick={() => setMeusNumerosOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              }
              return (
                <Link
                  key={item.key}
                  to={item.path ? `/${item.path}` : '/'}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors"
                >
                  {/* <Icon className="h-4 w-4" /> */}
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden flex items-center h-12">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-muted-foreground"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              <span className="ml-2 text-sm">Menu</span>
            </Button>
          </div>

          {/* Mobile expanded nav */}
          {mobileOpen && (
            <div className="md:hidden pb-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                if (item.path === null) {
                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        setMeusNumerosOpen(true);
                        setMobileOpen(false);
                      }}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors w-full"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                }
                return (
                  <Link
                    key={item.key}
                    to={item.path ? `/${item.path}` : '/'}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <MeusNumerosModal
        open={meusNumerosOpen}
        onOpenChange={setMeusNumerosOpen}
        companyId={companyId}
      />
    </>
  );
}
