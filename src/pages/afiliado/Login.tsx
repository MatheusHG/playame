import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAffiliate } from '@/contexts/AffiliateContext';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/shared/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { LogIn, User, Lock, AlertTriangle } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export default function AffiliateLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { affiliate, loading: authLoading, signIn } = useAffiliate();
  const { company, loading: companyLoading } = useTenant();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && affiliate) {
      navigate('/afiliado/dashboard');
    }
  }, [authLoading, affiliate, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = loginSchema.safeParse({ email, password });
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
      const { error } = await signIn(email, password);

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast({
            title: 'Credenciais inválidas',
            description: 'E-mail ou senha incorretos.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro ao entrar',
            description: error.message,
            variant: 'destructive',
          });
        }
        return;
      }

      // Success - will redirect via useEffect
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro desconhecido',
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
          <CardTitle>{company.name}</CardTitle>
          <CardDescription>Portal do Afiliado</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
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

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? (
                'Entrando...'
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Entrar
                </>
              )}
            </Button>

            <div className="text-center">
              <Link 
                to={"/afiliado/esqueci-senha"}
                className="text-sm text-primary hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Não tem uma conta? Entre em contato com o administrador.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
