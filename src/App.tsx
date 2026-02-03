import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import LandingPage from "./pages/public/LandingPage";
import SorteioPage from "./pages/public/SorteioPage";
import CompraSucesso from "./pages/public/CompraSucesso";
import MinhaConta from "./pages/public/MinhaConta";

// Super Admin Pages
import SuperAdminDashboard from "./pages/super-admin/Dashboard";
import SuperAdminEmpresas from "./pages/super-admin/Empresas";
import SuperAdminEmpresaConfig from "./pages/super-admin/EmpresaConfig";
import SuperAdminUsuarios from "./pages/super-admin/Usuarios";
import SuperAdminFinanceiro from "./pages/super-admin/Financeiro";
import SuperAdminAuditoria from "./pages/super-admin/Auditoria";
import SuperAdminAfiliados from "./pages/super-admin/Afiliados";

// Company Admin Pages
import EmpresaDashboard from "./pages/empresa/Dashboard";
import EmpresaSorteios from "./pages/empresa/Sorteios";
import NovoSorteio from "./pages/empresa/NovoSorteio";
import EditarSorteio from "./pages/empresa/EditarSorteio";
import VisualizarSorteio from "./pages/empresa/VisualizarSorteio";
import EmpresaJogadores from "./pages/empresa/Jogadores";
import EmpresaAfiliados from "./pages/empresa/Afiliados";
import AfiliadoDetalhe from "./pages/empresa/AfiliadoDetalhe";
import EmpresaFinanceiro from "./pages/empresa/Financeiro";
import EmpresaConfiguracoes from "./pages/empresa/Configuracoes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TenantProvider>
        <PlayerProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                
                {/* Public Company Landing Page */}
                <Route path="/empresa/:slug" element={<LandingPage />} />
                <Route path="/empresa/:slug/sorteio/:raffleId" element={<SorteioPage />} />
                <Route path="/empresa/:slug/compra-sucesso" element={<CompraSucesso />} />
                <Route path="/empresa/:slug/minha-conta" element={<MinhaConta />} />

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
                path="/super-admin/afiliados"
                element={
                  <ProtectedRoute requiredRole="SUPER_ADMIN">
                    <SuperAdminAfiliados />
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
                path="/empresa/:slug/sorteios/novo"
                element={
                  <ProtectedRoute requiredRole="ADMIN_EMPRESA">
                    <NovoSorteio />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresa/:slug/sorteios/:id"
                element={
                  <ProtectedRoute requiredRole="COLABORADOR">
                    <VisualizarSorteio />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresa/:slug/sorteios/:id/editar"
                element={
                  <ProtectedRoute requiredRole="ADMIN_EMPRESA">
                    <EditarSorteio />
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
                path="/empresa/:slug/afiliados"
                element={
                  <ProtectedRoute requiredRole="ADMIN_EMPRESA">
                    <EmpresaAfiliados />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresa/:slug/afiliados/:affiliateId"
                element={
                  <ProtectedRoute requiredRole="ADMIN_EMPRESA">
                    <AfiliadoDetalhe />
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
              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PlayerProvider>
    </TenantProvider>
  </AuthProvider>
</QueryClientProvider>
);

export default App;
