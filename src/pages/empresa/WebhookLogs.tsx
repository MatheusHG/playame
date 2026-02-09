import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmpresaLayout } from '@/components/layouts/EmpresaLayout';
import { useTenant } from '@/contexts/TenantContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RefreshCw } from 'lucide-react';

export default function EmpresaWebhookLogs() {
  const { company } = useTenant();
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['webhook-logs', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!company?.id,
    refetchInterval: 30000,
  });

  const statusVariant = (status: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    switch (status) {
      case 'processed': return 'default';
      case 'error': return 'destructive';
      case 'received': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <EmpresaLayout title="Webhook Logs" description="Logs de eventos recebidos do Stripe">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Últimos 200 eventos</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum log de webhook registrado</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tempo (ms)</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{log.event_type}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.processing_time_ms ?? '-'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Webhook</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Evento:</span>
                  <p className="font-mono">{selectedLog.event_type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <p><Badge variant={statusVariant(selectedLog.status)}>{selectedLog.status}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Event ID:</span>
                  <p className="font-mono text-xs">{selectedLog.event_id || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tempo:</span>
                  <p>{selectedLog.processing_time_ms ? `${selectedLog.processing_time_ms}ms` : '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <p>{new Date(selectedLog.created_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>
              {selectedLog.error_message && (
                <div>
                  <span className="text-sm text-muted-foreground">Erro:</span>
                  <pre className="mt-1 p-3 bg-destructive/10 text-destructive rounded text-xs overflow-auto">
                    {selectedLog.error_message}
                  </pre>
                </div>
              )}
              <div>
                <span className="text-sm text-muted-foreground">Payload:</span>
                <pre className="mt-1 p-3 bg-muted rounded text-xs overflow-auto max-h-60">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </EmpresaLayout>
  );
}
