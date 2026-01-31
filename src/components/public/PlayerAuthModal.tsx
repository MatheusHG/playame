import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  cpf: z.string().min(11, 'CPF inválido').max(14),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const registerSchema = z.object({
  cpf: z.string().min(11, 'CPF inválido').max(14),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  city: z.string().optional(),
  phone: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

interface PlayerAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'login' | 'register';
  onModeChange: (mode: 'login' | 'register') => void;
  companyId: string;
}

function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
}

export function PlayerAuthModal({ open, onOpenChange, mode, onModeChange, companyId }: PlayerAuthModalProps) {
  const { login, register } = usePlayer();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { cpf: '', password: '' },
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { cpf: '', password: '', confirmPassword: '', name: '', city: '', phone: '' },
  });

  const handleLogin = async (data: LoginData) => {
    setIsLoading(true);
    const result = await login(companyId, data.cpf, data.password);
    setIsLoading(false);

    if (result.error) {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    } else {
      toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso.' });
      onOpenChange(false);
      loginForm.reset();
    }
  };

  const handleRegister = async (data: RegisterData) => {
    setIsLoading(true);
    const result = await register(companyId, {
      cpf: data.cpf,
      password: data.password,
      name: data.name,
      city: data.city,
      phone: data.phone,
    });
    setIsLoading(false);

    if (result.error) {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    } else {
      toast({ title: 'Conta criada!', description: 'Cadastro realizado com sucesso.' });
      onOpenChange(false);
      registerForm.reset();
    }
  };

  const handleLoginCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    loginForm.setValue('cpf', formatted);
  };

  const handleRegisterCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    registerForm.setValue('cpf', formatted);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'login' ? 'Entrar na sua conta' : 'Criar nova conta'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'login'
              ? 'Digite seu CPF e senha para acessar.'
              : 'Preencha os dados abaixo para criar sua conta.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                {...loginForm.register('cpf')}
                onChange={handleLoginCPFChange}
                maxLength={14}
              />
              {loginForm.formState.errors.cpf && (
                <p className="text-sm text-destructive">{loginForm.formState.errors.cpf.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" {...loginForm.register('password')} />
              {loginForm.formState.errors.password && (
                <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Não tem conta?{' '}
              <button type="button" className="text-primary hover:underline" onClick={() => onModeChange('register')}>
                Cadastre-se
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Completo *</Label>
              <Input id="name" {...registerForm.register('name')} />
              {registerForm.formState.errors.name && (
                <p className="text-sm text-destructive">{registerForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                {...registerForm.register('cpf')}
                onChange={handleRegisterCPFChange}
                maxLength={14}
              />
              {registerForm.formState.errors.cpf && (
                <p className="text-sm text-destructive">{registerForm.formState.errors.cpf.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input id="city" {...registerForm.register('city')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" {...registerForm.register('phone')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha *</Label>
              <Input id="password" type="password" {...registerForm.register('password')} />
              {registerForm.formState.errors.password && (
                <p className="text-sm text-destructive">{registerForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
              <Input id="confirmPassword" type="password" {...registerForm.register('confirmPassword')} />
              {registerForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">{registerForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Conta
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{' '}
              <button type="button" className="text-primary hover:underline" onClick={() => onModeChange('login')}>
                Faça login
              </button>
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
