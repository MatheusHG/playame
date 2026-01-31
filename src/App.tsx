import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";

// Super Admin Pages
import SuperAdminDashboard from "./pages/super-admin/Dashboard";
import SuperAdminEmpresas from "./pages/super-admin/Empresas";
import SuperAdminEmpresaConfig from "./pages/super-admin/EmpresaConfig";
import SuperAdminUsuarios from "./pages/super-admin/Usuarios";
import SuperAdminFinanceiro from "./pages/super-admin/Financeiro";
import SuperAdminAuditoria from "./pages/super-admin/Auditoria";

// Company Admin Pages
import EmpresaDashboard from "./pages/empresa/Dashboard";
import EmpresaSorteios from "./pages/empresa/Sorteios";
import EmpresaJogadores from "./pages/empresa/Jogadores";
import EmpresaFinanceiro from "./pages/empresa/Financeiro";
import EmpresaConfiguracoes from "./pages/empresa/Configuracoes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />

              {/* Super Admin routes */}
              <Route
                path="/super-admin/dashboard"
                element={
                  <ProtectedRoute requiredRole="SUPER_ADMIN">
                    <SuperAdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/empresas"
                element={
                  <ProtectedRoute requiredRole="SUPER_ADMIN">
                    <SuperAdminEmpresas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/empresas/:id/configurar"
                element={
                  <ProtectedRoute requiredRole="SUPER_ADMIN">
                    <SuperAdminEmpresaConfig />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/usuarios"
                element={
                  <ProtectedRoute requiredRole="SUPER_ADMIN">
                    <SuperAdminUsuarios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/financeiro"
                element={
                  <ProtectedRoute requiredRole="SUPER_ADMIN">
                    <SuperAdminFinanceiro />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/super-admin/auditoria"
                element={
                  <ProtectedRoute requiredRole="SUPER_ADMIN">
                    <SuperAdminAuditoria />
                  </ProtectedRoute>
                }
              />
              <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />

              {/* Company Admin routes */}
              <Route
                path="/empresa/:slug/dashboard"
                element={
                  <ProtectedRoute requiredRole="COLABORADOR">
                    <EmpresaDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresa/:slug/sorteios"
                element={
                  <ProtectedRoute requiredRole="COLABORADOR">
                    <EmpresaSorteios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresa/:slug/jogadores"
                element={
                  <ProtectedRoute requiredRole="COLABORADOR">
                    <EmpresaJogadores />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresa/:slug/financeiro"
                element={
                  <ProtectedRoute requiredRole="ADMIN_EMPRESA">
                    <EmpresaFinanceiro />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresa/:slug/configuracoes"
                element={
                  <ProtectedRoute requiredRole="ADMIN_EMPRESA">
                    <EmpresaConfiguracoes />
                  </ProtectedRoute>
                }
              />
              <Route path="/empresa/:slug" element={<Navigate to="dashboard" replace />} />

              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TenantProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
