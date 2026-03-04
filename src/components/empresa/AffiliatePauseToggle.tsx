import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Pause, Play } from 'lucide-react';

interface AffiliatePauseToggleProps {
  affiliateId: string;
  affiliateName: string;
  isPaused: boolean;
  onUpdate?: () => void;
  variant?: 'switch' | 'button';
}

export function AffiliatePauseToggle({
  affiliateId,
  affiliateName,
  isPaused,
  onUpdate,
  variant = 'switch',
}: AffiliatePauseToggleProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggleMutation = useMutation({
    mutationFn: async (newState: boolean) => {
      await api.patch(`/affiliates/${affiliateId}/pause`, {
        is_sales_paused: newState,
        paused_at: newState ? new Date().toISOString() : null,
        paused_by: newState ? user?.id : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      queryClient.invalidateQueries({ queryKey: ['affiliate', affiliateId] });
      onUpdate?.();
      toast({
        title: isPaused ? 'Vendas reativadas' : 'Vendas pausadas',
        description: isPaused
          ? `${affiliateName} pode voltar a vender.`
          : `${affiliateName} não poderá fazer novas vendas.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleToggle = () => {
    if (!isPaused) {
      // Pausing - confirm first
      setConfirmOpen(true);
    } else {
      // Resuming - no confirmation needed
      toggleMutation.mutate(false);
    }
  };

  const confirmPause = () => {
    toggleMutation.mutate(true);
    setConfirmOpen(false);
  };

  if (variant === 'button') {
    return (
      <>
        <Button
          variant={isPaused ? 'default' : 'destructive'}
          size="sm"
          onClick={handleToggle}
          disabled={toggleMutation.isPending}
        >
          {isPaused ? (
            <>
              <Play className="h-4 w-4 mr-2" />
              Reativar
            </>
          ) : (
            <>
              <Pause className="h-4 w-4 mr-2" />
              Pausar
            </>
          )}
        </Button>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Pausar vendas de {affiliateName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Ao pausar as vendas, este afiliado não poderá mais:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Receber comissões de novos clientes pelo link</li>
                  <li>Registrar vendas manuais no sistema</li>
                </ul>
                Você pode reativar a qualquer momento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmPause} className="bg-destructive text-destructive-foreground">
                Pausar Vendas
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Switch
          id={`pause-${affiliateId}`}
          checked={!isPaused}
          onCheckedChange={handleToggle}
          disabled={toggleMutation.isPending}
        />
        <Label htmlFor={`pause-${affiliateId}`} className="text-sm">
          {isPaused ? 'Pausado' : 'Ativo'}
        </Label>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pausar vendas de {affiliateName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao pausar as vendas, este afiliado não poderá mais receber comissões
              de novos clientes ou registrar vendas manuais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPause} className="bg-destructive text-destructive-foreground">
              Pausar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
