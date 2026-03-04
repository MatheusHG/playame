import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { KeyRound, Mail, Loader2 } from 'lucide-react';

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affiliate: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
  companySlug: string;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  affiliate,
  companySlug,
}: ResetPasswordDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const effectiveEmail = affiliate?.email || email;

  const handleSendResetEmail = async () => {
    if (!effectiveEmail) {
      toast({
        title: 'E-mail obrigatório',
        description: 'Informe o e-mail do afiliado para enviar o link de redefinição.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/afiliado/redefinir-senha`;

      await api.post('/auth/reset-password', {
        email: effectiveEmail,
        redirectTo: redirectUrl,
      });

      toast({
        title: 'E-mail enviado',
        description: `Um link de redefinição de senha foi enviado para ${effectiveEmail}.`,
      });

      onOpenChange(false);
      setEmail('');
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar e-mail',
        description: error.message || 'Não foi possível enviar o e-mail de redefinição.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Resetar Senha
          </DialogTitle>
          <DialogDescription>
            Envie um link de redefinição de senha para <strong>{affiliate?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {affiliate?.email ? (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{affiliate.email}</span>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-mail do afiliado</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Este afiliado não possui e-mail cadastrado. Informe o e-mail para enviar o link.
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            O afiliado receberá um e-mail com instruções para criar uma nova senha.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSendResetEmail} disabled={loading || !effectiveEmail}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Enviar Link
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
