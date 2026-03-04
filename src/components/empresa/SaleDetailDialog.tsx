import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LoadingState } from '@/components/shared/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bluetooth, Loader2 } from 'lucide-react';
import { bluetoothPrinter, formatReceiptLines } from '@/lib/bluetooth-printer';
import { useTenant } from '@/contexts/TenantContext';

interface SaleDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
}

export function SaleDetailDialog({ open, onOpenChange, ticketId }: SaleDetailDialogProps) {
  const { company } = useTenant();
  const { toast } = useToast();
  const [isPrintingBluetooth, setIsPrintingBluetooth] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sale-detail', ticketId],
    queryFn: async () => {
      if (!ticketId) return null;

      const data = await api.get<any>(`/tickets/${ticketId}/detail`);
      return data;
    },
    enabled: !!ticketId && open,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleBluetoothPrint = async () => {
    if (!data || !company) return;

    setIsPrintingBluetooth(true);
    try {
      // Group numbers into tickets (each ticket_number group = 1 cartela)
      const ticketNumbers = data.numbers?.map((n: any) => n.number) || [];
      const numbersPerTicket = data.ticket.raffle?.numbers_per_ticket || ticketNumbers.length;
      const tickets: Array<{ numbers: number[] }> = [];

      if (numbersPerTicket > 0 && ticketNumbers.length > 0) {
        for (let i = 0; i < ticketNumbers.length; i += numbersPerTicket) {
          tickets.push({ numbers: ticketNumbers.slice(i, i + numbersPerTicket) });
        }
      } else {
        tickets.push({ numbers: ticketNumbers });
      }

      const raffleId = data.ticket.raffle_id || data.ticket.raffle?.id;
      const companySlug = company.slug;
      const paymentId = data.payment?.id;
      const trackingUrl = raffleId && companySlug && paymentId
        ? `${window.location.origin}/empresa/${companySlug}/sorteio/${raffleId}/acompanhar?ref=${paymentId}`
        : undefined;

      const lines = formatReceiptLines({
        companyName: company.name,
        raffleName: data.ticket.raffle?.name || 'Sorteio',
        customerName: data.ticket.player?.name || 'Cliente',
        tickets,
        ticketPrice: Number(data.ticket.raffle?.ticket_price || 0),
        totalAmount: Number(data.payment?.amount || 0),
        paymentRef: data.payment?.id || ticketId || '',
        createdAt: new Date(data.ticket.created_at),
        trackingUrl,
      });

      await bluetoothPrinter.printReceipt(lines);
      toast({ title: 'Recibo impresso com sucesso!' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      if (message !== 'Nenhum dispositivo selecionado.') {
        toast({ variant: 'destructive', title: 'Erro na impressão Bluetooth', description: message });
      }
    } finally {
      setIsPrintingBluetooth(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Detalhes da Venda</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <LoadingState message="Carregando detalhes..." />
        ) : !data ? (
          <p className="text-muted-foreground text-center py-4">Dados não encontrados.</p>
        ) : (
          <div className="space-y-4">
            {/* Info básica */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Ref</span>
                <p className="font-mono font-medium text-xs">{(data.payment?.id || ticketId || '').slice(0, 8).toUpperCase()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Sorteio</span>
                <p className="font-medium">{data.ticket.raffle?.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Jogador</span>
                <p className="font-medium">
                  {data.ticket.player?.name}
                  <span className="text-muted-foreground ml-1">***{data.ticket.player?.cpf_last4}</span>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Data</span>
                <p className="font-medium">
                  {format(new Date(data.ticket.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <div>
                  <Badge variant={data.payment?.status === 'succeeded' ? 'default' : 'secondary'}>
                    {data.payment?.status === 'succeeded' ? 'Aprovado' : data.payment?.status || data.ticket.status}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Números escolhidos */}
            <div>
              <h4 className="text-sm font-medium mb-2">
                Números escolhidos ({data.numbers.length} cartela{data.numbers.length !== 1 ? 's' : ''})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {data.numbers.map((n: any) => (
                  <span
                    key={n.number}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary text-sm font-mono font-medium"
                  >
                    {String(n.number).padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>

            <Separator />

            {/* Detalhamento financeiro */}
            <div>
              <h4 className="text-sm font-medium mb-3">Detalhamento Financeiro</h4>
              {data.payment ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Valor da venda</span>
                    <span className="font-medium">{formatCurrency(Number(data.payment.amount))}</span>
                  </div>

                  {data.commission ? (
                    <>
                      <div className="flex justify-between text-destructive">
                        <span>Taxa administrativa ({data.commission.super_admin_percent}%)</span>
                        <span className="font-medium">- {formatCurrency(Number(data.commission.super_admin_amount))}</span>
                      </div>

                      <div className="flex justify-between border-t pt-2">
                        <span>Valor bruto empresa (após taxa admin)</span>
                        <span className="font-medium">
                          {formatCurrency(
                            Number(data.payment.amount) - Number(data.commission.super_admin_amount)
                          )}
                        </span>
                      </div>

                      {data.commission.manager_id && (
                        <>
                          <div className="flex justify-between text-blue-600 dark:text-blue-400">
                            <span>
                              Gerente: {data.commission.manager?.name} ({data.commission.manager_percent}%)
                            </span>
                            <span className="font-medium">
                              - {formatCurrency(Number(data.commission.manager_gross_amount))}
                            </span>
                          </div>

                          {data.commission.cambista_id && (
                            <div className="flex justify-between text-amber-600 dark:text-amber-400 pl-4 text-xs">
                              <span>
                                └ Operador: {data.commission.cambista?.name} ({data.commission.cambista_percent_of_manager ?? data.commission.cambista_percent}% da cartela)
                              </span>
                              <span className="font-medium">
                                {formatCurrency(Number(data.commission.cambista_amount))}
                              </span>
                            </div>
                          )}

                          {data.commission.cambista_id && (
                            <div className="flex justify-between pl-4 text-xs text-muted-foreground">
                              <span>└ Gerente (líquido)</span>
                              <span className="font-medium">
                                {formatCurrency(Number(data.commission.manager_net_amount))}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Company retention vs prize pool */}
                      {data.commission.company_retention_amount != null && Number(data.commission.company_retention_amount) > 0 && (
                        <div className="flex justify-between text-orange-600 dark:text-orange-400 border-t pt-2">
                          <span>
                            Retenção empresa ({Number(data.commission.company_profit_percent || 0).toFixed(1)}%)
                          </span>
                          <span className="font-medium">
                            {formatCurrency(Number(data.commission.company_retention_amount))}
                          </span>
                        </div>
                      )}

                      {data.commission.prize_pool_contribution != null && Number(data.commission.prize_pool_contribution) > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Contribuição ao prêmio</span>
                          <span className="font-medium">
                            {formatCurrency(Number(data.commission.prize_pool_contribution))}
                          </span>
                        </div>
                      )}

                      {/* Final summary - show retention if available, otherwise full net */}
                      {data.commission.company_retention_amount != null && Number(data.commission.company_retention_amount) > 0 ? (
                        <div className="flex justify-between border-t pt-2 font-semibold text-orange-700 dark:text-orange-300">
                          <span>Empresa (retenção)</span>
                          <span>{formatCurrency(Number(data.commission.company_retention_amount))}</span>
                        </div>
                      ) : (
                        <div className="flex justify-between border-t pt-2 font-semibold">
                          <span>Empresa (líquido final)</span>
                          <span>{formatCurrency(Number(data.commission.company_net_amount))}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-destructive">
                        <span>Taxa administrativa</span>
                        <span className="font-medium">- {formatCurrency(Number(data.payment.admin_fee || 0))}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2 font-semibold">
                        <span>Líquido empresa</span>
                        <span>{formatCurrency(Number(data.payment.net_amount))}</span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Pagamento não encontrado.</p>
              )}
            </div>
          </div>
        )}

        {/* Bluetooth print button */}
        {data && bluetoothPrinter.isSupported && (
          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleBluetoothPrint}
              disabled={isPrintingBluetooth}
            >
              {isPrintingBluetooth ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bluetooth className="h-4 w-4 mr-2" />
              )}
              {bluetoothPrinter.isConnected
                ? `Imprimir (${bluetoothPrinter.deviceName || 'Bluetooth'})`
                : 'Impressora Bluetooth'
              }
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
