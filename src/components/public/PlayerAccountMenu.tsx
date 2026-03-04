import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Ticket, Trophy, Settings, LogOut, User } from 'lucide-react';

type Player = {
  name: string;
  cpf_last4?: string;
};

interface PlayerAccountMenuProps {
  player: Player;
  onLogout: () => void;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive';
  className?: string;
}

export function PlayerAccountMenu({ player, onLogout, variant = 'secondary', className }: PlayerAccountMenuProps) {
  const navigate = useNavigate();
  const firstName = player.name?.split(' ')[0] || 'Conta';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="sm" className={className}>
          <User className="h-4 w-4 mr-2" />
          {firstName}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <div className="font-semibold leading-tight">{player.name}</div>
          {player.cpf_last4 && (
            <div className="text-xs text-muted-foreground font-normal">***.***.***-{player.cpf_last4}</div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/minha-conta?tab=bilhetes">
            <Ticket className="mr-2 h-4 w-4" />
            Minhas cartelas
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/minha-conta?tab=sorteios">
            <Trophy className="mr-2 h-4 w-4" />
            Meus sorteios
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/minha-conta?tab=configuracoes">
            <Settings className="mr-2 h-4 w-4" />
            Editar perfil
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onLogout();
            navigate('/');
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

