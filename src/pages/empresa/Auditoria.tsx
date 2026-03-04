import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingState } from '@/components/shared/LoadingState';
import { ChevronLeft, ChevronRight, Eye, Search, X } from 'lucide-react';
import { AuditLog } from '@/types/database.types';

interface AuditLogWithRelations extends AuditLog {
  user?: { id: string; email: string } | null;
  player?: { id: string; name: string; cpf_last4: string } | null;
}

interface AuditResponse {
  data: AuditLogWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const ACTION_LABELS: Record<string, string> = {
  RAFFLE_CREATED: 'Sorteio criado',
  RAFFLE_UPDATED: 'Sorteio atualizado',
  RAFFLE_DELETED: 'Sorteio excluído',
  RAFFLE_STATUS_CHANGED: 'Status do sorteio',
  PRIZE_TIERS_UPDATED: 'Faixas de prêmio',
  DRAW_BATCH_CREATED: 'Rodada criada',
  DRAW_BATCH_UPDATED: 'Rodada atualizada',
  DRAW_BATCH_DELETED: 'Rodada excluída',
  DRAW_BATCH_FINALIZED: 'Rodada finalizada',
  DRAW_NUMBER_ADDED: 'Número adicionado',
  DRAW_NUMBER_REMOVED: 'Número removido',
  AFFILIATE_CREATED: 'Afiliado criado',
  AFFILIATE_UPDATED: 'Afiliado atualizado',
  AFFILIATE_DELETED: 'Afiliado excluído',
  AFFILIATE_TOGGLED: 'Afiliado pausado/ativado',
  AFFILIATE_USER_CREATED: 'Usuário afiliado criado',
  AFFILIATE_COMMISSION_UPDATED: 'Comissão alterada',
  BANNER_CREATED: 'Banner criado',
  BANNER_UPDATED: 'Banner atualizado',
  BANNER_DELETED: 'Banner excluído',
  SETTING_UPDATED: 'Configuração alterada',
  SETTING_CREATED: 'Configuração criada',
  RAFFLE_DISCOUNT_CREATED: 'Desconto criado',
  RAFFLE_DISCOUNT_REMOVED: 'Desconto removido',
  TICKET_CANCELLED: 'Bilhete cancelado',
  STRIPE_KEYS_SAVED: 'Chaves Stripe salvas',
  STRIPE_KEYS_CLEARED: 'Chaves Stripe removidas',
  PLAYER_REGISTERED: 'Jogador registrado',
  PLAYER_PROFILE_UPDATED: 'Perfil do jogador',
  PLAYER_UPDATED: 'Jogador atualizado',
  PAYMENT_APPROVED: 'Pagamento aprovado',
  PAYMENT_REJECTED: 'Pagamento rejeitado',
  STREET_SALE_CREATED: 'Venda de rua',
  PERMISSION_PROFILE_CREATED: 'Perfil de permissão criado',
  PERMISSION_PROFILE_UPDATED: 'Perfil de permissão atualizado',
  PERMISSION_PROFILE_DELETED: 'Perfil de permissão excluído',
  RAFFLE_SETTLED: 'Sorteio liquidado',
};

const ENTITY_LABELS: Record<string, string> = {
  raffle: 'Sorteio',
  draw_batch: 'Rodada',
  draw_number: 'Número',
  affiliate: 'Afiliado',
  company: 'Empresa',
  banner: 'Banner',
  setting: 'Configuração',
  raffle_discount: 'Desconto',
  ticket: 'Bilhete',
  stripe: 'Stripe',
  player: 'Jogador',
  payment: 'Pagamento',
  street_sale: 'Venda de rua',
  permission_profile: 'Perfil de permissão',
  prize_tier: 'Faixa de prêmio',
};

function getActionColor(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const lower = action.toLowerCase();
  if (lower.includes('created') || lower.includes('registered')) return 'default';
  if (lower.includes('updated') || lower.includes('changed') || lower.includes('toggled')) return 'secondary';
  if (lower.includes('deleted') || lower.includes('removed') || lower.includes('cancelled') || lower.includes('rejected')) return 'destructive';
  return 'outline';
}

function formatChangesJson(changes: Record<string, unknown> | null) {
  if (!changes) return null;

  // Format before/after
  if ('before' in changes && 'after' in changes) {
    return {
      type: 'update' as const,
      before: changes.before as Record<string, unknown>,
      after: changes.after as Record<string, unknown>,
    };
  }
  // Format created
  if ('created' in changes) {
    return {
      type: 'create' as const,
      data: changes.created as Record<string, unknown>,
    };
  }
  // Format deleted
  if ('deleted' in changes) {
    return {
      type: 'delete' as const,
      data: changes.deleted as Record<string, unknown>,
    };
  }
  // Generic format
  return {
    type: 'generic' as const,
    data: changes,
  };
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function ChangeDetail({ label, before, after }: { label: string; before: unknown; after: unknown }) {
  return (
    <div className="flex flex-col gap-1 py-2 border-b last:border-b-0">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 text-sm">
        <span className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded text-xs font-mono break-all">
          {formatValue(before)}
        </span>
        <span className="text-muted-foreground">&rarr;</span>
        <span className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 px-2 py-0.5 rounded text-xs font-mono break-all">
          {formatValue(after)}
        </span>
      </div>
    </div>
  );
}

function ChangesDialog({
  log,
  open,
  onOpenChange,
}: {
  log: AuditLogWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!log) return null;

  const formatted = formatChangesJson(log.changes_json);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant={getActionColor(log.action)}>
              {ACTION_LABELS[log.action] || log.action}
            </Badge>
            <span className="text-sm font-normal text-muted-foreground">
              {ENTITY_LABELS[log.entity_type] || log.entity_type}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data/Hora</span>
              <span>{new Date(log.created_at).toLocaleString('pt-BR')}</span>
            </div>
            {log.user?.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Usuário</span>
                <span>{log.user.email}</span>
              </div>
            )}
            {log.player?.name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jogador</span>
                <span>{log.player.name}</span>
              </div>
            )}
            {log.entity_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID da entidade</span>
                <span className="font-mono text-xs">{log.entity_id.slice(0, 12)}...</span>
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            {!formatted ? (
              <p className="text-sm text-muted-foreground">Sem detalhes registrados</p>
            ) : formatted.type === 'update' ? (
              <div>
                <h4 className="text-sm font-medium mb-2">Alterações</h4>
                {Object.keys(formatted.before).map((key) => (
                  <ChangeDetail
                    key={key}
                    label={key}
                    before={formatted.before[key]}
                    after={formatted.after[key]}
                  />
                ))}
              </div>
            ) : formatted.type === 'create' ? (
              <div>
                <h4 className="text-sm font-medium mb-2">Dados criados</h4>
                <div className="bg-green-50 dark:bg-green-950 rounded p-3">
                  {Object.entries(formatted.data).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1 text-sm border-b last:border-b-0 border-green-200 dark:border-green-800">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-mono text-xs break-all max-w-[60%] text-right">
                        {formatValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : formatted.type === 'delete' ? (
              <div>
                <h4 className="text-sm font-medium mb-2">Dados excluídos</h4>
                <div className="bg-red-50 dark:bg-red-950 rounded p-3">
                  {Object.entries(formatted.data).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1 text-sm border-b last:border-b-0 border-red-200 dark:border-red-800">
                      <span className="text-muted-foreground">{key}</span>
                      <span className="font-mono text-xs break-all max-w-[60%] text-right">
                        {formatValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <h4 className="text-sm font-medium mb-2">Detalhes</h4>
                <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60">
                  {JSON.stringify(formatted.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EmpresaAuditoria() {
  const { company, loading } = useTenant();

  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogWithRelations | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', company?.id, page, startDate, endDate, action, entityType],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '30');
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (action) params.set('action', action);
      if (entityType) params.set('entityType', entityType);
      return api.get<AuditResponse>(`/audit-logs/company/${company!.id}?${params.toString()}`);
    },
    enabled: !!company?.id,
  });

  const logs = data?.data ?? [];
  const pagination = data?.pagination;

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setAction('');
    setEntityType('');
    setPage(1);
  };

  const hasFilters = startDate || endDate || action || entityType;

  if (loading) return <LoadingState fullScreen message="Carregando empresa..." />;

  return (
    <EmpresaLayout title="Auditoria" description="Registro de todas as ações realizadas no sistema">
      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-[150px] h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-[150px] h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Ação</Label>
            <Select value={action} onValueChange={(v) => { setAction(v === '_all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="Todas as ações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas as ações</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Entidade</Label>
            <Select value={entityType} onValueChange={(v) => { setEntityType(v === '_all' ? '' : v); setPage(1); }}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Todas as entidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todas as entidades</SelectItem>
                {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Data/Hora</th>
                <th className="text-left p-3 font-medium">Ação</th>
                <th className="text-left p-3 font-medium">Entidade</th>
                <th className="text-left p-3 font-medium">Usuário</th>
                <th className="text-center p-3 font-medium w-20">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhum log encontrado
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3">
                      <Badge variant={getActionColor(log.action)} className="text-xs">
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {ENTITY_LABELS[log.entity_type] || log.entity_type}
                    </td>
                    <td className="p-3 text-xs">
                      {log.user?.email || log.player?.name || '-'}
                    </td>
                    <td className="p-3 text-center">
                      {log.changes_json ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">
              {pagination.total} registros &middot; Página {pagination.page} de {pagination.totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ChangesDialog
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(open) => { if (!open) setSelectedLog(null); }}
      />
    </EmpresaLayout>
  );
}
