import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Eye, EyeOff, Check, X, Loader2, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

interface StripeConfigCardProps {
  companyId: string;
  hasStripeConfigured: boolean;
}

export function StripeConfigCard({ companyId, hasStripeConfigured }: StripeConfigCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [isValidated, setIsValidated] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  const validateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-stripe-keys', {
        body: {
          action: 'validate',
          companyId,
          stripeSecretKey,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.valid) {
        setIsValidated(true);
        toast({ title: 'Chave Stripe válida!', description: 'Você pode salvar as credenciais.' });
      } else {
        toast({ variant: 'destructive', title: 'Chave inválida', description: data.message });
      }
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao validar', description: error.message });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-stripe-keys', {
        body: {
          action: 'save',
          companyId,
          stripeSecretKey,
          stripeWebhookSecret: stripeWebhookSecret || undefined,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      setStripeSecretKey('');
      setStripeWebhookSecret('');
      setIsValidated(false);
      toast({ title: 'Credenciais Stripe salvas com sucesso!' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-stripe-keys', {
        body: {
          action: 'clear',
          companyId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      toast({ title: 'Credenciais Stripe removidas' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Erro ao remover', description: error.message });
    },
  });

  const handleValidate = () => {
    if (!stripeSecretKey.startsWith('sk_')) {
      toast({
        variant: 'destructive',
        title: 'Chave inválida',
        description: 'A chave secreta do Stripe deve começar com "sk_"',
      });
      return;
    }
    validateMutation.mutate();
  };

  const handleSave = () => {
    if (!isValidated) {
      toast({
        variant: 'destructive',
        title: 'Validação necessária',
        description: 'Valide a chave antes de salvar',
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Integração Stripe
          </CardTitle>
          <CardDescription>
            Configure as credenciais do Stripe para esta empresa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasStripeConfigured && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Stripe configurado</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setShowClearDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remover
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="stripe_secret_key">Chave Secreta (sk_...)</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="stripe_secret_key"
                  type={showSecretKey ? 'text' : 'password'}
                  value={stripeSecretKey}
                  onChange={(e) => {
                    setStripeSecretKey(e.target.value);
                    setIsValidated(false);
                  }}
                  placeholder="sk_live_..."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                >
                  {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleValidate}
                disabled={!stripeSecretKey || validateMutation.isPending}
              >
                {validateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isValidated ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  'Validar'
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stripe_webhook_secret">Webhook Secret (whsec_...) - Opcional</Label>
            <div className="relative">
              <Input
                id="stripe_webhook_secret"
                type={showWebhookSecret ? 'text' : 'password'}
                value={stripeWebhookSecret}
                onChange={(e) => setStripeWebhookSecret(e.target.value)}
                placeholder="whsec_..."
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowWebhookSecret(!showWebhookSecret)}
              >
                {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Necessário para processar webhooks de pagamento
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={!isValidated || saveMutation.isPending}
            className="w-full"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Credenciais Stripe'
            )}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        title="Remover configuração Stripe"
        description="Isso irá remover as chaves do Stripe e desabilitar pagamentos para esta empresa. Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => clearMutation.mutate()}
        loading={clearMutation.isPending}
      />
    </>
  );
}
