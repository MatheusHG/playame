import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/shared/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { Lock, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { company, loading: companyLoading } = useTenant();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sessionReady, setSessionReady] = useState(false);

  // Check for recovery token in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token'))) {
      // Extract token from hash
      const params = new URLSearchParams(hash.replace('#', ''));
      const accessToken = params.get('access_token');
      if (accessToken) {
        localStorage.setItem('recovery_token', accessToken);
        setSessionReady(true);
      }
    } else if (localStorage.getItem('recovery_token')) {
      setSessionReady(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      const recoveryToken = localStorage.getItem('recovery_token');
      await api.post('/auth/update-password', {
        password,
        token: recoveryToken,
      });
      localStorage.removeItem('recovery_token');

      setSuccess(true);
      toast({
        title: 'Senha redefinida!',
        description: 'Sua senha foi alterada com sucesso.',
      });

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/afiliado/login');
      }, 3000);
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao redefinir senha',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (companyLoading) {
    return <LoadingState fullScreen message="Carregando..." />;
  }

  if (!company) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Empresa não encontrada</h1>
            <p className="text-muted-foreground">
              A empresa que você está tentando acessar não existe ou está inativa.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryColor = company.primary_color || '#3B82F6';

  if (success) {
    return (
      <div 
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4"
        style={{ '--company-primary': primaryColor } as any}
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Senha Redefinida!</h1>
            <p className="text-muted-foreground mb-6">
              Sua senha foi alterada com sucesso. Você será redirecionado para o login em instantes...
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to={'/afiliado/login'}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Ir para o login
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div 
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4"
        style={{ '--company-primary': primaryColor } as any}
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Link Inválido ou Expirado</h1>
            <p className="text-muted-foreground mb-6">
              Este link de recuperação de senha não é válido ou já expirou. 
              Solicite um novo link.
            </p>
            <Button asChild className="w-full" style={{ backgroundColor: primaryColor }}>
              <Link to={"/afiliado/esqueci-senha"}>
                Solicitar novo link
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4"
      style={{ '--company-primary': primaryColor } as any}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {company.logo_url ? (
            <img 
              src={company.logo_url} 
              alt={company.name} 
              className="h-16 w-auto mx-auto mb-4"
            />
          ) : (
            <div 
              className="h-16 w-16 rounded-xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              {company.name.charAt(0)}
            </div>
          )}
          <CardTitle>Redefinir Senha</CardTitle>
          <CardDescription>
            Digite sua nova senha abaixo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Salvando...' : 'Redefinir Senha'}
            </Button>
          </form>

          <div className="text-center mt-6">
            <Link 
              to={'/afiliado/login'}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar para o login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
