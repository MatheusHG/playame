import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LoadingState } from '@/components/shared/LoadingState';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SaleDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
}

export function SaleDetailDialog({ open, onOpenChange, ticketId }: SaleDetailDialogProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['sale-detail', ticketId],
    queryFn: async () => {
      if (!ticketId) return null;

      // Fetch ticket with relations
      const { data: ticket, error: ticketError } = await (supabase as any)
        .from('tickets')
        .select(`
          *,
          raffle:raffles(name, ticket_price),
          player:players(name, cpf_last4, city)
        `)
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;

      // Fetch ticket numbers
      const { data: numbers, error: numbersError } = await (supabase as any)
        .from('ticket_numbers')
        .select('number')
        .eq('ticket_id', ticketId)
        .order('number', { ascending: true });

      if (numbersError) throw numbersError;

      // Fetch payment
      const { data: payments, error: paymentError } = await (supabase as any)
        .from('payments')
        .select('*')
        .eq('ticket_id', ticketId)
        .limit(1);

      if (paymentError) throw paymentError;
      const payment = payments?.[0] || null;

      // Fetch commission split
      let commission = null;
      if (payment) {
        const { data: commData } = await (supabase as any)
          .from('affiliate_commissions')
          .select(`
            *,
            manager:affiliates!affiliate_commissions_manager_id_fkey(name),
            cambista:affiliates!affiliate_commissions_cambista_id_fkey(name)
          `)
          .eq('payment_id', payment.id)
          .limit(1);

        commission = commData?.[0] || null;
      }

      return { ticket, numbers: numbers || [], payment, commission };
    },
    enabled: !!ticketId && open,
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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
                        <span>Valor para empresa (após taxa)</span>
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
                                └ Operador: {data.commission.cambista?.name} ({data.commission.cambista_percent_of_manager}% do gerente)
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

                      <div className="flex justify-between border-t pt-2 font-semibold">
                        <span>Empresa (líquido final)</span>
                        <span>{formatCurrency(Number(data.commission.company_net_amount))}</span>
                      </div>
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
      </DialogContent>
    </Dialog>
  );
}
