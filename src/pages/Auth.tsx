import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/shared/LoadingState';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { api } from '@/lib/api';

const authSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const { signIn, user, loading, isSuperAdmin, roles, affiliateInfo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  // Redirect if already authenticated (e.g. navigating to /auth while logged in)
  useEffect(() => {
    if (loading || !user) return;
    redirectByRole(roles, affiliateInfo);
  }, [user, loading]);

  const redirectByRole = (loginRoles: typeof roles, affInfo: typeof affiliateInfo) => {
    const hasSuperAdmin = loginRoles.some(r => r.role === 'SUPER_ADMIN');

    if (hasSuperAdmin) {
      const target = from && from.startsWith('/super-admin') ? from : '/super-admin/dashboard';
      navigate(target, { replace: true });
      return;
    }

    if (affInfo) {
      navigate('/afiliado/dashboard', { replace: true });
      return;
    }

    if (from && from !== '/' && !from.startsWith('/auth')) {
      navigate(from, { replace: true });
      return;
    }

    const companyRole = loginRoles.find(r => r.role === 'ADMIN_EMPRESA' || r.role === 'COLABORADOR');
    if (companyRole && companyRole.company_id) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }

    if (loginRoles.length > 0) {
      navigate('/', { replace: true });
    }
  };

  const validateForm = (): boolean => {
    const result = authSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as 'email' | 'password'] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    const result = await signIn(email, password);
    setIsLoading(false);

    if (result.error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao fazer login',
        description: result.error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos'
          : result.error.message,
      });
    } else {
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso.',
      });
      // Redirect immediately using the returned data (don't wait for useEffect)
      redirectByRole(result.roles, result.affiliateInfo);
    }
  };

  if (loading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">PlayAME</CardTitle>
          <CardDescription>
            Faça login para continuar
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignIn}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
