import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ManualPaymentApprovalProps {
  payment: {
    id: string;
    ticket_id: string;
    status: string | null;
    amount: number;
  };
  onSuccess?: () => void;
}

export function ManualPaymentApproval({ payment, onSuccess }: ManualPaymentApprovalProps) {
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('manual-payment-action', {
        body: { action: 'approve', paymentId: payment.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return true;
    },
    onSuccess: () => {
      // Invalidate all payment-related queries immediately
      queryClient.invalidateQueries({ queryKey: ['company-payments'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['payments-list'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['company-financial-logs'], exact: false });
      
      toast({
        title: 'Pagamento Aprovado',
        description: 'O pagamento foi aprovado manualmente com sucesso.',
      });
      setIsApproveOpen(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível aprovar o pagamento.',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('manual-payment-action', {
        body: { action: 'reject', paymentId: payment.id, reason: reason || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return true;
    },
    onSuccess: () => {
      // Invalidate all payment-related queries immediately
      queryClient.invalidateQueries({ queryKey: ['company-payments'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['payments-list'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['company-financial-logs'], exact: false });
      
      toast({
        title: 'Pagamento Rejeitado',
        description: 'O pagamento foi rejeitado.',
      });
      setIsRejectOpen(false);
      setReason('');
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível rejeitar o pagamento.',
      });
    },
  });

  // Hide buttons if status is no longer pending
  if (payment.status !== 'pending' && payment.status !== 'processing') {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Button 
        size="sm" 
        variant="outline"
        className="text-primary border-primary hover:bg-primary/10"
        onClick={() => setIsApproveOpen(true)}
      >
        <CheckCircle className="h-4 w-4 mr-1" />
        Aprovar
      </Button>
      <Button 
        size="sm" 
        variant="outline"
        className="text-destructive border-destructive hover:bg-destructive/10"
        onClick={() => setIsRejectOpen(true)}
      >
        <XCircle className="h-4 w-4 mr-1" />
        Rejeitar
      </Button>

      {/* Approve Dialog */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Pagamento Manualmente</DialogTitle>
            <DialogDescription>
              Você está prestes a aprovar manualmente o pagamento de R$ {Number(payment.amount).toFixed(2)}.
              Esta ação irá ativar a cartela do jogador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Pagamento</DialogTitle>
            <DialogDescription>
              Você está prestes a rejeitar o pagamento de R$ {Number(payment.amount).toFixed(2)}.
              A cartela será cancelada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Informe o motivo da rejeição..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
