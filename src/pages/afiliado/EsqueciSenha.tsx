import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/shared/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const emailSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

export default function EsqueciSenha() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Fetch company data
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company', slug],
    queryFn: async () => {
      const data = await api.get<any>(`/companies/by-slug/${slug}`);
      return data;
    },
    enabled: !!slug,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/afiliado/${slug}/redefinir-senha`;

      await api.post('/auth/reset-password', {
        email,
        redirectTo: redirectUrl,
      });

      setSent(true);
      toast({
        title: 'E-mail enviado!',
        description: 'Verifique sua caixa de entrada para redefinir sua senha.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro',
        description: err.message || 'Erro ao enviar e-mail de recuperação',
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

  if (sent) {
    return (
      <div 
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4"
        style={{ '--company-primary': primaryColor } as any}
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">E-mail Enviado!</h1>
            <p className="text-muted-foreground mb-6">
              Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Verifique também sua pasta de spam.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to={`/afiliado/${slug}/login`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para o login
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
          <CardTitle>Esqueci minha senha</CardTitle>
          <CardDescription>
            Digite seu e-mail para receber um link de recuperação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </Button>
          </form>

          <div className="text-center mt-6">
            <Link 
              to={`/afiliado/${slug}/login`}
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
