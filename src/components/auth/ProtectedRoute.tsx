import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingState } from '@/components/shared/LoadingState';
import { AppRole } from '@/types/database.types';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: AppRole;
  companyId?: string;
  redirectTo?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  companyId,
  redirectTo = '/auth' 
}: ProtectedRouteProps) {
  const { user, loading, isSuperAdmin, isAdminEmpresa, isColaborador } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState fullScreen message="Verificando autenticação..." />;
  }

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requiredRole) {
    let hasAccess = false;

    switch (requiredRole) {
      case 'SUPER_ADMIN':
        hasAccess = isSuperAdmin;
        break;
      case 'ADMIN_EMPRESA':
        hasAccess = isAdminEmpresa(companyId);
        break;
      case 'COLABORADOR':
        hasAccess = isColaborador(companyId);
        break;
    }

    if (!hasAccess) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h1>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}
