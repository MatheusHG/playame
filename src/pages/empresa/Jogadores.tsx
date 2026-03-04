import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { DataTable, Column } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, ShieldAlert, ShieldCheck, Eye, Ticket, MoreVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ── Stat Item ── */
interface StatItemProps { icon: LucideIcon; iconBg: string; iconColor: string; label: string; value: string | number; subtitle?: string; }
function StatItem({ icon: Icon, iconBg, iconColor, label, value, subtitle }: StatItemProps) {
  return (
    <div className="rounded-2xl border bg-card p-3 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-shadow">
      <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full flex-shrink-0" style={{ backgroundColor: iconBg }}>
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg sm:text-2xl font-bold tracking-tight mt-0.5">{value}</p>
        {subtitle && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getDisplayCpf } from '@/lib/utils';
import type { Player } from '@/types/database.types';

export default function EmpresaJogadores() {
  const { company, loading } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['company-players', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const data = await api.get<Player[]>(`/companies/${company!.id}/players`);
      return data;
    },
  });

  const { data: ticketCounts = {} } = useQuery({
    queryKey: ['player-ticket-counts', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const data = await api.get<Record<string, number>>(`/companies/${company!.id}/players/ticket-counts`);
      return data;
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ playerId, block, reason }: { playerId: string; block: boolean; reason?: string }) => {
      await api.patch(`/players/${playerId}`, {
        status: block ? 'blocked' : 'active',
        blocked_at: block ? new Date().toISOString() : null,
        blocked_reason: block ? reason : null,
      });
    },
    onSuccess: (_, { block }) => {
      queryClient.invalidateQueries({ queryKey: ['company-players', company?.id] });
      setBlockDialogOpen(false);
      setSelectedPlayer(null);
      toast({ title: block ? 'Jogador bloqueado' : 'Jogador desbloqueado' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    },
  });

  const columns: Column<Player>[] = [
    {
      key: 'name',
      header: 'Jogador',
      render: (player) => {
        const isStreet = !(player as any).cpf_encrypted;
        return (
          <Link
            to={`/admin/jogadores/${player.id}`}
            className="block hover:opacity-80 transition-opacity"
          >
            <p className="font-medium">{player.name}</p>
            <p className="text-xs text-muted-foreground">
              {isStreet ? 'Venda de rua' : `CPF: ${getDisplayCpf(player) || `***.***.***-${player.cpf_last4}`}`}
            </p>
          </Link>
        );
      },
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (player) => {
        const isStreet = !(player as any).cpf_encrypted;
        return (
          <Badge variant={isStreet ? 'secondary' : 'outline'} className="text-xs">
            {isStreet ? 'Rua' : 'Online'}
          </Badge>
        );
      },
    },
    {
      key: 'city',
      header: 'Cidade',
      render: (player) => player.city || '-',
    },
    {
      key: 'phone',
      header: 'Telefone',
      render: (player) => player.phone || '-',
    },
    {
      key: 'tickets',
      header: 'Cartelas Ativas',
      render: (player) => (
        <Badge variant="outline" className="gap-1">
          <Ticket className="h-3 w-3" />
          {ticketCounts[player.id] || 0}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (player) => <StatusBadge status={player.status || 'active'} />,
    },
    {
      key: 'created_at',
      header: 'Cadastro',
      render: (player) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(player.created_at), { addSuffix: true, locale: ptBR })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (player) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem asChild>
              <Link to={`/admin/jogadores/${player.id}`} className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Ver perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {player.status === 'blocked' ? (
              <DropdownMenuItem
                onClick={() => blockMutation.mutate({ playerId: player.id, block: false })}
                className="gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                Desbloquear
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => {
                  setSelectedPlayer(player);
                  setBlockDialogOpen(true);
                }}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <ShieldAlert className="h-4 w-4" />
                Bloquear
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (loading) {
    return <LoadingState fullScreen message="Carregando empresa..." />;
  }

  const activePlayers = players.filter((p) => p.status === 'active').length;
  const blockedPlayers = players.filter((p) => p.status === 'blocked').length;

  return (
    <EmpresaLayout title="Jogadores" description="Gerencie os jogadores da empresa">
      {/* Stats */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 mb-6">
        <StatItem
          icon={Users}
          iconBg="#DBEAFE"
          iconColor="#2563EB"
          label="Total de Jogadores"
          value={players.length}
        />
        <StatItem
          icon={ShieldCheck}
          iconBg="#DCFCE7"
          iconColor="#16A34A"
          label="Jogadores Ativos"
          value={activePlayers}
        />
        <StatItem
          icon={ShieldAlert}
          iconBg="#FEE2E2"
          iconColor="#DC2626"
          label="Jogadores Bloqueados"
          value={blockedPlayers}
        />
      </div>

      {/* Players Table */}
      <div className="rounded-2xl border bg-card overflow-hidden p-5">
        <DataTable
          data={players}
          columns={columns}
          loading={isLoading}
          searchPlaceholder="Buscar jogadores..."
          emptyMessage="Nenhum jogador cadastrado"
        />
      </div>

      {/* Block Dialog */}
      <ConfirmDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        title="Bloquear Jogador"
        description={`Tem certeza que deseja bloquear "${selectedPlayer?.name}"? O jogador não poderá mais participar dos sorteios.`}
        confirmLabel="Bloquear"
        variant="destructive"
        onConfirm={() =>
          selectedPlayer &&
          blockMutation.mutate({ playerId: selectedPlayer.id, block: true, reason: 'Bloqueado pelo administrador' })
        }
        loading={blockMutation.isPending}
      />
    </EmpresaLayout>
  );
}
