import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { AffiliateProvider } from "@/contexts/AffiliateContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Pages
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import LandingPage from "./pages/public/LandingPage";
import SorteioPage from "./pages/public/SorteioPage";
import CompraSucesso from "./pages/public/CompraSucesso";
import MinhaConta from "./pages/public/MinhaConta";
import AcompanharSorteio from "./pages/public/AcompanharSorteio";
import Ganhadores from "./pages/public/Ganhadores";
import QuemSomos from "./pages/public/QuemSomos";
import Contato from "./pages/public/Contato";

// Super Admin Pages
import SuperAdminDashboard from "./pages/super-admin/Dashboard";
import SuperAdminEmpresas from "./pages/super-admin/Empresas";
import SuperAdminEmpresaConfig from "./pages/super-admin/EmpresaConfig";
import SuperAdminUsuarios from "./pages/super-admin/Usuarios";
import SuperAdminFinanceiro from "./pages/super-admin/Financeiro";
import SuperAdminAuditoria from "./pages/super-admin/Auditoria";
import SuperAdminAfiliados from "./pages/super-admin/Afiliados";
import SuperAdminWebhookLogs from "./pages/super-admin/WebhookLogs";

// Company Admin Pages
import EmpresaDashboard from "./pages/empresa/Dashboard";
import EmpresaSorteios from "./pages/empresa/Sorteios";
import NovoSorteio from "./pages/empresa/NovoSorteio";
import EditarSorteio from "./pages/empresa/EditarSorteio";
import VisualizarSorteio from "./pages/empresa/VisualizarSorteio";
import EmpresaJogadores from "./pages/empresa/Jogadores";
import JogadorDetalhe from "./pages/empresa/JogadorDetalhe";
import EmpresaAfiliados from "./pages/empresa/Afiliados";
import AfiliadoDetalhe from "./pages/empresa/AfiliadoDetalhe";
import EmpresaFinanceiro from "./pages/empresa/Financeiro";
import EmpresaConfiguracoes from "./pages/empresa/Configuracoes";
import EmpresaWebhookLogs from "./pages/empresa/WebhookLogs";
import EmpresaRegulamento from "./pages/empresa/Regulamento";
import EmpresaAuditoria from "./pages/empresa/Auditoria";
import VendaRua from "./pages/empresa/VendaRua";

// Affiliate Portal Pages
import AffiliateLogin from "./pages/afiliado/Login";
import AffiliateDashboard from "./pages/afiliado/Dashboard";
import AffiliateMeuLink from "./pages/afiliado/MeuLink";
import AffiliateNovaVenda from "./pages/afiliado/NovaVenda";
import AffiliateVendas from "./pages/afiliado/Vendas";
import AffiliateComissoes from "./pages/afiliado/Comissoes";
import AffiliateEquipe from "./pages/afiliado/Equipe";
import AffiliateEsqueciSenha from "./pages/afiliado/EsqueciSenha";
import AffiliateRedefinirSenha from "./pages/afiliado/RedefinirSenha";

const queryClient = new QueryClient();

const App = () => (
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <TenantProvider>
      <PlayerProvider>
        <AffiliateProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public routes — tenant resolved from domain */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/sorteio/:raffleId" element={<SorteioPage />} />
                <Route path="/sorteio/:raffleId/acompanhar" element={<AcompanharSorteio />} />
                <Route path="/compra-sucesso" element={<CompraSucesso />} />
                <Route path="/minha-conta" element={<MinhaConta />} />
                <Route path="/ganhadores" element={<Ganhadores />} />
                <Route path="/quem-somos" element={<QuemSomos />} />
                <Route path="/contato" element={<Contato />} />

                {/* Affiliate Portal routes */}
                <Route path="/afiliado/login" element={<AffiliateLogin />} />
                <Route path="/afiliado/esqueci-senha" element={<AffiliateEsqueciSenha />} />
                <Route path="/afiliado/redefinir-senha" element={<AffiliateRedefinirSenha />} />
                <Route path="/afiliado/dashboard" element={<AffiliateDashboard />} />
                <Route path="/afiliado/meu-link" element={<AffiliateMeuLink />} />
                <Route path="/afiliado/nova-venda" element={<AffiliateNovaVenda />} />
                <Route path="/afiliado/vendas" element={<AffiliateVendas />} />
                <Route path="/afiliado/comissoes" element={<AffiliateComissoes />} />
                <Route path="/afiliado/equipe" element={<AffiliateEquipe />} />
                <Route path="/afiliado" element={<Navigate to="dashboard" replace />} />

                {/* Super Admin routes */}
                <Route path="/super-admin/dashboard" element={<ProtectedRoute requiredRole="SUPER_ADMIN"><SuperAdminDashboard /></ProtectedRoute>} />
                <Route path="/super-admin/empresas" element={<ProtectedRoute requiredRole="SUPER_ADMIN"><SuperAdminEmpresas /></ProtectedRoute>} />
                <Route path="/super-admin/empresas/:id/configurar" element={<ProtectedRoute requiredRole="SUPER_ADMIN"><SuperAdminEmpresaConfig /></ProtectedRoute>} />
                <Route path="/super-admin/usuarios" element={<ProtectedRoute requiredRole="SUPER_ADMIN"><SuperAdminUsuarios /></ProtectedRoute>} />
                <Route path="/super-admin/financeiro" element={<ProtectedRoute requiredRole="SUPER_ADMIN"><SuperAdminFinanceiro /></ProtectedRoute>} />
                <Route path="/super-admin/afiliados" element={<ProtectedRoute requiredRole="SUPER_ADMIN"><SuperAdminAfiliados /></ProtectedRoute>} />
                <Route path="/super-admin/auditoria" element={<ProtectedRoute requiredRole="SUPER_ADMIN"><SuperAdminAuditoria /></ProtectedRoute>} />
                <Route path="/super-admin/webhook-logs" element={<ProtectedRoute requiredRole="SUPER_ADMIN"><SuperAdminWebhookLogs /></ProtectedRoute>} />
                <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />

                {/* Company Admin routes — tenant resolved from domain */}
                <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="COLABORADOR"><EmpresaDashboard /></ProtectedRoute>} />
                <Route path="/admin/sorteios" element={<ProtectedRoute requiredRole="COLABORADOR"><EmpresaSorteios /></ProtectedRoute>} />
                <Route path="/admin/sorteios/novo" element={<ProtectedRoute requiredRole="ADMIN_EMPRESA"><NovoSorteio /></ProtectedRoute>} />
                <Route path="/admin/sorteios/:id" element={<ProtectedRoute requiredRole="COLABORADOR"><VisualizarSorteio /></ProtectedRoute>} />
                <Route path="/admin/sorteios/:id/editar" element={<ProtectedRoute requiredRole="ADMIN_EMPRESA"><EditarSorteio /></ProtectedRoute>} />
                <Route path="/admin/jogadores" element={<ProtectedRoute requiredRole="COLABORADOR"><EmpresaJogadores /></ProtectedRoute>} />
                <Route path="/admin/jogadores/:playerId" element={<ProtectedRoute requiredRole="COLABORADOR"><JogadorDetalhe /></ProtectedRoute>} />
                <Route path="/admin/afiliados" element={<ProtectedRoute requiredRole="ADMIN_EMPRESA"><EmpresaAfiliados /></ProtectedRoute>} />
                <Route path="/admin/afiliados/:affiliateId" element={<ProtectedRoute requiredRole="ADMIN_EMPRESA"><AfiliadoDetalhe /></ProtectedRoute>} />
                <Route path="/admin/financeiro" element={<ProtectedRoute requiredRole="ADMIN_EMPRESA"><EmpresaFinanceiro /></ProtectedRoute>} />
                <Route path="/admin/webhook-logs" element={<ProtectedRoute requiredRole="ADMIN_EMPRESA"><EmpresaWebhookLogs /></ProtectedRoute>} />
                <Route path="/admin/regulamento" element={<ProtectedRoute requiredRole="ADMIN_EMPRESA"><EmpresaRegulamento /></ProtectedRoute>} />
                <Route path="/admin/auditoria" element={<ProtectedRoute requiredRole="ADMIN_EMPRESA"><EmpresaAuditoria /></ProtectedRoute>} />
                <Route path="/admin/configuracoes" element={<ProtectedRoute requiredRole="ADMIN_EMPRESA"><EmpresaConfiguracoes /></ProtectedRoute>} />
                <Route path="/admin/venda-rua" element={<ProtectedRoute requiredRole="ADMIN_EMPRESA"><VendaRua /></ProtectedRoute>} />

                {/* Backwards compatibility: redirect old slug-based routes */}
                <Route path="/empresa/:slug" element={<Navigate to="/" replace />} />
                <Route path="/empresa/:slug/*" element={<Navigate to="/" replace />} />
                <Route path="/afiliado/:slug/*" element={<Navigate to="/afiliado/login" replace />} />

                {/* Catch-all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AffiliateProvider>
      </PlayerProvider>
    </TenantProvider>
  </AuthProvider>
</QueryClientProvider>
);

export default App;
