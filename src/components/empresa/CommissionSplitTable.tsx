import { useAffiliateCommissions } from '@/hooks/useAffiliates';
import { DataTable, Column } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CommissionSplitTableProps {
  companyId?: string;
}

export function CommissionSplitTable({ companyId }: CommissionSplitTableProps) {
  const { commissions, isLoading } = useAffiliateCommissions(companyId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const columns: Column<typeof commissions[0]>[] = [
    {
      key: 'created_at',
      header: 'Data',
      render: (item) => format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    },
    {
      key: 'raffle',
      header: 'Sorteio',
      render: (item) => (item as any).raffle?.name || '-',
    },
    {
      key: 'sale_amount',
      header: 'Venda',
      render: (item) => (
        <span className="font-medium">{formatCurrency(Number(item.sale_amount))}</span>
      ),
    },
    {
      key: 'super_admin_amount',
      header: 'Super-Admin',
      render: (item) => (
        <div className="text-sm">
          <div className="font-medium">{formatCurrency(Number(item.super_admin_amount))}</div>
          <div className="text-muted-foreground">{item.super_admin_percent}%</div>
        </div>
      ),
    },
    {
      key: 'manager',
      header: 'Gerente',
      render: (item) => {
        if (!item.manager_id) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="text-sm">
            <div className="font-medium">{(item as any).manager?.name}</div>
            <div className="text-muted-foreground">
              {formatCurrency(Number(item.manager_net_amount))} ({item.manager_percent}%)
            </div>
          </div>
        );
      },
    },
    {
      key: 'cambista',
      header: 'Cambista',
      render: (item) => {
        if (!item.cambista_id) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="text-sm">
            <div className="font-medium">{(item as any).cambista?.name}</div>
            <div className="text-muted-foreground">
              {formatCurrency(Number(item.cambista_amount))} ({item.cambista_percent_of_manager}%)
            </div>
          </div>
        );
      },
    },
    {
      key: 'company_net_amount',
      header: 'Empresa (Líq.)',
      render: (item) => (
        <Badge variant="outline" className="font-mono">
          {formatCurrency(Number(item.company_net_amount))}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Histórico de Comissões</h3>
        <p className="text-sm text-muted-foreground">
          Detalhamento de splits por venda com auditoria completa
        </p>
      </div>

      <DataTable
        data={commissions}
        columns={columns}
        loading={isLoading}
        searchPlaceholder="Buscar por sorteio..."
        emptyMessage="Nenhuma comissão registrada"
        pageSize={20}
      />
    </div>
  );
}
