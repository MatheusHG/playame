import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import type { Database } from '@/integrations/supabase/types';

type Player = Database['public']['Tables']['players']['Row'];

export default function EmpresaJogadores() {
  const { slug } = useParams<{ slug: string }>();
  const { setCompanySlug, company, loading } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['company-players', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('company_id', company!.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Player[];
    },
  });

  const { data: ticketCounts = {} } = useQuery({
    queryKey: ['player-ticket-counts', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('player_id')
        .eq('company_id', company!.id)
        .eq('status', 'active');

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((t) => {
        counts[t.player_id] = (counts[t.player_id] || 0) + 1;
      });
      return counts;
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ playerId, block, reason }: { playerId: string; block: boolean; reason?: string }) => {
      const { error } = await supabase
        .from('players')
        .update({
          status: block ? 'blocked' : 'active',
          blocked_at: block ? new Date().toISOString() : null,
          blocked_reason: block ? reason : null,
        })
        .eq('id', playerId);

      if (error) throw error;
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
      render: (player) => (
        <Link
          to={`/empresa/${slug}/jogadores/${player.id}`}
          className="block hover:opacity-80 transition-opacity"
        >
          <p className="font-medium">{player.name}</p>
          <p className="text-xs text-muted-foreground">CPF: {getDisplayCpf(player) || `***.***.***-${player.cpf_last4}`}</p>
        </Link>
      ),
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
              <Link to={`/empresa/${slug}/jogadores/${player.id}`} className="flex items-center gap-2">
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
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total de Jogadores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{players.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Jogadores Ativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{activePlayers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Jogadores Bloqueados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{blockedPlayers}</p>
          </CardContent>
        </Card>
      </div>

      {/* Players Table */}
      <DataTable
        data={players}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Buscar jogadores..."
        emptyMessage="Nenhum jogador cadastrado"
      />

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
