import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SuperAdminLayout } from '@/components/layouts/SuperAdminLayout';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { AuditLog, Company } from '@/types/database.types';

interface AuditLogWithCompany extends AuditLog {
  company_name?: string;
}

export default function SuperAdminAuditoria() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const data = await api.get<AuditLogWithCompany[]>('/audit-logs');
      return data;
    },
  });

  const actionColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    create: 'default',
    update: 'secondary',
    delete: 'destructive',
    login: 'outline',
    logout: 'outline',
  };

  const columns: Column<AuditLogWithCompany>[] = [
    {
      key: 'created_at',
      header: 'Data/Hora',
      render: (item) => new Date(item.created_at).toLocaleString('pt-BR'),
    },
    {
      key: 'action',
      header: 'Ação',
      render: (item) => (
        <Badge variant={actionColors[item.action.toLowerCase()] || 'outline'}>
          {item.action}
        </Badge>
      ),
    },
    {
      key: 'entity_type',
      header: 'Entidade',
      render: (item) => (
        <span className="capitalize">{item.entity_type.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'company_name',
      header: 'Empresa',
      render: (item) => item.company_name || '-',
    },
    {
      key: 'user_id',
      header: 'Usuário',
      render: (item) => (
        <span className="font-mono text-xs">
          {item.user_id ? `${item.user_id.slice(0, 8)}...` : '-'}
        </span>
      ),
    },
    {
      key: 'ip_address',
      header: 'IP',
      render: (item) => item.ip_address || '-',
    },
    {
      key: 'changes_json',
      header: 'Detalhes',
      render: (item) =>
        item.changes_json ? (
          <span className="text-xs text-muted-foreground">
            {JSON.stringify(item.changes_json).slice(0, 50)}...
          </span>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <SuperAdminLayout title="Auditoria" description="Logs de ações do sistema">
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Logs de Auditoria</h3>
          <p className="text-sm text-muted-foreground">
            Últimas 200 ações registradas no sistema
          </p>
        </div>
        <div className="p-4">
          <DataTable
            data={logs}
            columns={columns}
            loading={isLoading}
            searchPlaceholder="Buscar logs..."
            emptyMessage="Nenhum log registrado"
            pageSize={20}
          />
        </div>
      </div>
    </SuperAdminLayout>
  );
}
