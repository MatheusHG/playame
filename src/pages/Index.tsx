import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Building2, Users, LogIn } from 'lucide-react';

const Index = () => {
  const { user, isSuperAdmin, roles } = useAuth();

  // Get company slug from roles if user is not super admin
  const companyRole = roles.find(r => r.company_id && (r.role === 'ADMIN_EMPRESA' || r.role === 'COLABORADOR'));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Plataforma de Bolões Numéricos
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Sistema SaaS whitelabel para gestão completa de bolões e sorteios numéricos.
          </p>
        </div>

        {!user ? (
          <div className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader className="text-center">
                <CardTitle>Bem-vindo!</CardTitle>
                <CardDescription>
                  Faça login para acessar o sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/auth">
                  <Button className="w-full" size="lg">
                    <LogIn className="mr-2 h-5 w-5" />
                    Acessar Sistema
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
            {isSuperAdmin && (
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Super Admin
                  </CardTitle>
                  <CardDescription>
                    Gerencie empresas, usuários e configurações globais
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/super-admin/dashboard">
                    <Button className="w-full">Acessar Painel</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {companyRole && (
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Painel da Empresa
                  </CardTitle>
                  <CardDescription>
                    Gerencie sorteios, jogadores e vendas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to={`/empresa/${companyRole.company_id}/dashboard`}>
                    <Button className="w-full">Acessar Empresa</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Minha Conta
                </CardTitle>
                <CardDescription>
                  {user.email}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {roles.length === 0 
                    ? 'Nenhum papel atribuído'
                    : `${roles.length} papel(éis) atribuído(s)`
                  }
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
