import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { RaffleCard } from '@/components/empresa/RaffleCard';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Play, PauseCircle, FileEdit, CheckCircle2, Dices, LayoutGrid, List,
} from 'lucide-react';
import { useRaffles, useRaffleMutations } from '@/hooks/useRaffles';
import type { RaffleStatus } from '@/types/database.types';
import type { LucideIcon } from 'lucide-react';

/* ── Stat Item — same pattern as dashboards ── */
interface StatItemProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  onClick: () => void;
  active: boolean;
}

function StatItem({ icon: Icon, iconBg, iconColor, label, value, onClick, active }: StatItemProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border bg-card p-3 sm:p-5 flex items-center gap-3 sm:gap-4 hover:shadow-md transition-all cursor-pointer ${
        active ? 'ring-2 ring-primary shadow-md' : ''
      }`}
    >
      <div
        className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full flex-shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg sm:text-2xl font-bold tracking-tight mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function EmpresaSorteios() {
  const { slug } = useParams<{ slug: string }>();
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RaffleStatus | 'all'>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusChange, setStatusChange] = useState<{ id: string; status: RaffleStatus } | null>(null);

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  const { data: raffles, isLoading } = useRaffles(company?.id);
  const { changeStatus, deleteRaffle } = useRaffleMutations(company?.id);

  const filteredRaffles = raffles?.filter(raffle => {
    const matchesSearch = raffle.name.toLowerCase().includes(search.toLowerCase()) ||
      raffle.description?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || raffle.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = () => {
    if (deleteId) {
      deleteRaffle.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const handleStatusChange = () => {
    if (statusChange) {
      changeStatus.mutate(statusChange);
      setStatusChange(null);
    }
  };

  const statusChangeLabels: Record<string, { title: string; description: string; confirm: string }> = {
    active: {
      title: 'Ativar Sorteio',
      description: 'Tem certeza que deseja ativar este sorteio? Ele ficará visível e disponível para compra de cartelas.',
      confirm: 'Ativar',
    },
    paused: {
      title: 'Pausar Sorteio',
      description: 'Tem certeza que deseja pausar este sorteio? Ele não ficará disponível para novas compras enquanto estiver pausado.',
      confirm: 'Pausar',
    },
    finished: {
      title: 'Finalizar Sorteio',
      description: 'Tem certeza que deseja finalizar este sorteio? Esta ação não pode ser desfeita.',
      confirm: 'Finalizar',
    },
  };

  // Stats
  const totalCount = raffles?.length || 0;
  const activeCount = raffles?.filter(r => r.status === 'active').length || 0;
  const draftCount = raffles?.filter(r => r.status === 'draft').length || 0;
  const pausedCount = raffles?.filter(r => r.status === 'paused').length || 0;
  const finishedCount = raffles?.filter(r => r.status === 'finished').length || 0;

  if (tenantLoading) {
    return <LoadingState fullScreen message="Carregando empresa..." />;
  }

  return (
    <EmpresaLayout title="Sorteios" description="Gerencie os sorteios da empresa">
      {/* Summary stats — dashboard pattern */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatItem
          icon={Play}
          iconBg="#DCFCE7"
          iconColor="#16A34A"
          label="Ativos"
          value={activeCount}
          onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          active={statusFilter === 'active'}
        />
        <StatItem
          icon={FileEdit}
          iconBg="#F3F4F6"
          iconColor="#6B7280"
          label="Rascunhos"
          value={draftCount}
          onClick={() => setStatusFilter(statusFilter === 'draft' ? 'all' : 'draft')}
          active={statusFilter === 'draft'}
        />
        <StatItem
          icon={PauseCircle}
          iconBg="#FEF9C3"
          iconColor="#CA8A04"
          label="Pausados"
          value={pausedCount}
          onClick={() => setStatusFilter(statusFilter === 'paused' ? 'all' : 'paused')}
          active={statusFilter === 'paused'}
        />
        <StatItem
          icon={CheckCircle2}
          iconBg="#FEE2E2"
          iconColor="#DC2626"
          label="Finalizados"
          value={finishedCount}
          onClick={() => setStatusFilter(statusFilter === 'finished' ? 'all' : 'finished')}
          active={statusFilter === 'finished'}
        />
      </div>

      {/* Search + filter + action bar */}
      <div className="rounded-2xl border bg-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar sorteios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RaffleStatus | 'all')}>
            <SelectTrigger className="w-full sm:w-44 rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({totalCount})</SelectItem>
              <SelectItem value="draft">Rascunho ({draftCount})</SelectItem>
              <SelectItem value="active">Ativo ({activeCount})</SelectItem>
              <SelectItem value="paused">Pausado ({pausedCount})</SelectItem>
              <SelectItem value="finished">Finalizado ({finishedCount})</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild className="rounded-xl">
            <Link to={`/empresa/${slug}/sorteios/novo`}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Sorteio
            </Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Carregando sorteios..." className="py-12" />
      ) : filteredRaffles?.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border bg-card">
          <div className="flex h-16 w-16 items-center justify-center rounded-full mx-auto mb-4" style={{ backgroundColor: '#F3F4F6' }}>
            <Dices className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground mb-1 text-sm">
            {raffles?.length === 0
              ? 'Nenhum sorteio cadastrado ainda.'
              : 'Nenhum sorteio encontrado com os filtros aplicados.'}
          </p>
          {raffles?.length === 0 && (
            <Button asChild className="mt-4 rounded-xl">
              <Link to={`/empresa/${slug}/sorteios/novo`}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Sorteio
              </Link>
            </Button>
          )}
          {raffles && raffles.length > 0 && (
            <Button
              variant="ghost"
              className="mt-2 text-xs"
              onClick={() => { setStatusFilter('all'); setSearch(''); }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {filteredRaffles?.length} sorteio{(filteredRaffles?.length || 0) !== 1 ? 's' : ''}
              {statusFilter !== 'all' && ` (${statusFilter})`}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredRaffles?.map((raffle) => (
              <RaffleCard
                key={raffle.id}
                raffle={raffle}
                slug={slug!}
                primaryColor={company?.primary_color}
                onChangeStatus={(id, status) => setStatusChange({ id, status })}
                onDelete={(id) => setDeleteId(id)}
              />
            ))}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Excluir Sorteio"
        description="Tem certeza que deseja excluir este sorteio? Esta ação marca o sorteio como deletado e não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteRaffle.isPending}
      />

      <ConfirmDialog
        open={!!statusChange}
        onOpenChange={() => setStatusChange(null)}
        title={statusChange ? statusChangeLabels[statusChange.status]?.title ?? 'Alterar Status' : ''}
        description={statusChange ? statusChangeLabels[statusChange.status]?.description ?? '' : ''}
        confirmLabel={statusChange ? statusChangeLabels[statusChange.status]?.confirm ?? 'Confirmar' : 'Confirmar'}
        onConfirm={handleStatusChange}
        loading={changeStatus.isPending}
      />
    </EmpresaLayout>
  );
}
