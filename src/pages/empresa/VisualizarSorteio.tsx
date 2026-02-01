import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { LoadingState } from '@/components/shared/LoadingState';
import { PrizeTiersEditor } from '@/components/empresa/PrizeTiersEditor';
import { DrawBatchManager } from '@/components/empresa/DrawBatchManager';
import { TicketsList } from '@/components/empresa/TicketsList';
import { RankingTable } from '@/components/empresa/RankingTable';
import { SettlementDialog } from '@/components/empresa/SettlementDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit, DollarSign, Hash, Trophy, Calendar, Play, Pause } from 'lucide-react';
import { useRaffle, useRaffleMutations, usePrizeTierMutations } from '@/hooks/useRaffles';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type RaffleStatus = Database['public']['Enums']['raffle_status'];

const statusConfig: Record<RaffleStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  active: { label: 'Ativo', variant: 'default' },
  paused: { label: 'Pausado', variant: 'outline' },
  finished: { label: 'Finalizado', variant: 'destructive' },
};

export default function VisualizarSorteio() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const navigate = useNavigate();
  const { setCompanySlug, company, loading: tenantLoading } = useTenant();
  const { data: raffle, isLoading } = useRaffle(id);
  const { changeStatus } = useRaffleMutations(company?.id);
  const { savePrizeTiers } = usePrizeTierMutations(id);

  useEffect(() => {
    if (slug) {
      setCompanySlug(slug);
    }
  }, [slug, setCompanySlug]);

  if (tenantLoading || isLoading) {
    return <LoadingState fullScreen message="Carregando sorteio..." />;
  }

  if (!raffle) {
    return (
      <EmpresaLayout title="Sorteio não encontrado">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">O sorteio solicitado não foi encontrado.</p>
          <Button onClick={() => navigate(`/empresa/${slug}/sorteios`)}>Voltar</Button>
        </div>
      </EmpresaLayout>
    );
  }

  const status = raffle.status || 'draft';
  const config = statusConfig[status];
  const isActive = status === 'active';
  const isPaused = status === 'paused';
  const isDraft = status === 'draft';
  const isFinished = status === 'finished';

  return (
    <EmpresaLayout title={raffle.name} description={raffle.description || 'Detalhes do sorteio'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/empresa/${slug}/sorteios`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Badge variant={config.variant} className="text-sm">
            {config.label}
          </Badge>
        </div>

        <div className="flex gap-2">
          {isDraft && (
            <Button onClick={() => changeStatus.mutate({ id: raffle.id, status: 'active' })}>
              <Play className="mr-2 h-4 w-4" />
              Ativar
            </Button>
          )}
          {isActive && (
            <Button variant="outline" onClick={() => changeStatus.mutate({ id: raffle.id, status: 'paused' })}>
              <Pause className="mr-2 h-4 w-4" />
              Pausar
            </Button>
          )}
          {isPaused && (
            <>
              <Button onClick={() => changeStatus.mutate({ id: raffle.id, status: 'active' })}>
                <Play className="mr-2 h-4 w-4" />
                Reativar
              </Button>
              <SettlementDialog 
                raffleId={raffle.id} 
                raffleName={raffle.name}
                isFinished={isFinished}
              />
            </>
          )}
          <Button variant="outline" asChild>
            <Link to={`/empresa/${slug}/sorteios/${raffle.id}/editar`}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Preço da Cartela
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {Number(raffle.ticket_price).toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Range de Números
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{raffle.number_range_start} - {raffle.number_range_end}</p>
            <p className="text-sm text-muted-foreground">{raffle.numbers_per_ticket} por cartela</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Rodadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{raffle.current_draw_count || 0}</p>
            <p className="text-sm text-muted-foreground">números sorteados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Criado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {formatDistanceToNow(new Date(raffle.created_at), { addSuffix: true, locale: ptBR })}
            </p>
            <p className="text-sm text-muted-foreground">Versão {raffle.rules_version || 1}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rodadas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rodadas">Rodadas</TabsTrigger>
          <TabsTrigger value="faixas">Faixas de Prêmio</TabsTrigger>
          <TabsTrigger value="cartelas">Cartelas</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
        </TabsList>

        <TabsContent value="rodadas">
          <DrawBatchManager
            raffleId={raffle.id}
            numberRangeStart={raffle.number_range_start}
            numberRangeEnd={raffle.number_range_end}
            isRaffleActive={isActive}
          />
        </TabsContent>

        <TabsContent value="faixas">
          <PrizeTiersEditor
            tiers={raffle.prize_tiers || []}
            onSave={(tiers) => savePrizeTiers.mutate(tiers)}
            isLoading={savePrizeTiers.isPending}
            maxHits={raffle.numbers_per_ticket}
          />
        </TabsContent>

        <TabsContent value="cartelas">
          <TicketsList raffleId={raffle.id} />
        </TabsContent>

        <TabsContent value="ranking">
          <RankingTable raffleId={raffle.id} numbersPerTicket={raffle.numbers_per_ticket} />
        </TabsContent>
      </Tabs>
    </EmpresaLayout>
  );
}
