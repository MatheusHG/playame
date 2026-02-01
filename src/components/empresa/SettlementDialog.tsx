import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSettleRaffle } from '@/hooks/useTickets';
import { Trophy, DollarSign, Users, AlertTriangle, CheckCircle } from 'lucide-react';

interface SettlementDialogProps {
  raffleId: string;
  raffleName: string;
  isFinished: boolean;
}

interface Winner {
  ticket_id: string;
  player_id: string;
  hits: number;
  tier_id: string;
  prize_type: string;
  prize_value: number;
  object_description: string | null;
}

export function SettlementDialog({ raffleId, raffleName, isFinished }: SettlementDialogProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    total_sales: number;
    prize_pool: number;
    winners: Winner[];
    error?: string;
  } | null>(null);
  
  const settleRaffle = useSettleRaffle();

  const handleSettle = async () => {
    const data = await settleRaffle.mutateAsync(raffleId);
    if (data) {
      setResult(data);
    }
  };

  if (isFinished && !result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            Sorteio Finalizado
          </CardTitle>
          <CardDescription>
            Este sorteio já foi apurado e finalizado.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="lg" className="gap-2">
          <Trophy className="h-5 w-5" />
          Encerrar e Apurar Sorteio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Encerrar Sorteio: {raffleName}
          </DialogTitle>
          <DialogDescription>
            Esta ação é irreversível. O sorteio será finalizado e os ganhadores serão determinados automaticamente.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                O que acontecerá:
              </h4>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• O status do sorteio será alterado para "Finalizado"</li>
                <li>• Ganhadores serão identificados com base no ranking atual</li>
                <li>• Elegibilidade RF105 será verificada para cada cartela</li>
                <li>• Logs financeiros e de auditoria serão gerados</li>
                <li>• Não será mais possível vender cartelas ou sortear números</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {result.error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
                {result.error}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <DollarSign className="h-4 w-4" />
                        Total de Vendas
                      </div>
                      <div className="text-2xl font-bold">
                        R$ {result.total_sales.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Trophy className="h-4 w-4" />
                        Prêmio Total
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        R$ {result.prize_pool.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Ganhadores ({result.winners.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.winners.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        Nenhum ganhador encontrado neste sorteio.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cartela</TableHead>
                            <TableHead className="text-center">Acertos</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Prêmio</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.winners.map((winner, index) => (
                            <TableRow key={winner.ticket_id}>
                              <TableCell className="font-mono text-xs">
                                {winner.ticket_id.slice(0, 8)}...
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="default">{winner.hits}</Badge>
                              </TableCell>
                              <TableCell>
                                {winner.prize_type === 'money' ? (
                                  <Badge variant="outline">Dinheiro</Badge>
                                ) : (
                                  <Badge variant="secondary">{winner.object_description || 'Prêmio Físico'}</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {winner.prize_type === 'money' 
                                  ? `R$ ${winner.prize_value.toFixed(2)}`
                                  : winner.object_description
                                }
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleSettle}
                disabled={settleRaffle.isPending}
              >
                {settleRaffle.isPending ? 'Apurando...' : 'Confirmar Encerramento'}
              </Button>
            </>
          ) : (
            <Button onClick={() => setOpen(false)}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
