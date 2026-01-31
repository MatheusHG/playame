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
import { Plus, Search, Filter } from 'lucide-react';
import { useRaffles, useRaffleMutations } from '@/hooks/useRaffles';
import type { Database } from '@/integrations/supabase/types';

type RaffleStatus = Database['public']['Enums']['raffle_status'];

export default function EmpresaSorteios() {
  const { slug } = useParams<{ slug: string }>();
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RaffleStatus | 'all'>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  if (tenantLoading) {
    return <LoadingState fullScreen message="Carregando empresa..." />;
  }

  return (
    <EmpresaLayout title="Sorteios" description="Gerencie os sorteios da empresa">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar sorteios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as RaffleStatus | 'all')}>
            <SelectTrigger className="w-40">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="paused">Pausado</SelectItem>
              <SelectItem value="finished">Finalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button asChild>
          <Link to={`/empresa/${slug}/sorteios/novo`}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Sorteio
          </Link>
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Carregando sorteios..." className="py-12" />
      ) : filteredRaffles?.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <p className="text-muted-foreground mb-4">
            {raffles?.length === 0
              ? 'Nenhum sorteio cadastrado ainda.'
              : 'Nenhum sorteio encontrado com os filtros aplicados.'}
          </p>
          {raffles?.length === 0 && (
            <Button asChild>
              <Link to={`/empresa/${slug}/sorteios/novo`}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Sorteio
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRaffles?.map((raffle) => (
            <RaffleCard
              key={raffle.id}
              raffle={raffle}
              slug={slug!}
              onChangeStatus={(id, status) => changeStatus.mutate({ id, status })}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
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
    </EmpresaLayout>
  );
}
