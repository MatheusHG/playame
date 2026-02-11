
# 🎰 Plataforma SaaS Whitelabel
**Sistema Multi-Tenant Completo para Produção Comercial**

---

## 📊 Status de Implementação

### ✅ Fase 1: Infraestrutura Base (CONCLUÍDA)
- [x] Schema do banco de dados completo (13 tabelas)
- [x] RLS policies com company_id
- [x] Sistema de roles (user_roles + has_role)
- [x] Autenticação básica (login/signup)
- [x] Roteamento por papel
- [x] Contextos (AuthContext, TenantContext)
- [x] Componentes compartilhados (DataTable, StatsCard, StatusBadge, etc.)
- [x] Layouts (SuperAdminLayout, EmpresaLayout, ThemedLayout)
- [x] Páginas do Super Admin (Dashboard, Empresas, Usuários, Financeiro, Auditoria)
- [x] Páginas base da Empresa (Dashboard, Sorteios, Jogadores, Financeiro, Configurações)

### 🔄 Fase 2: Super Admin (EM PROGRESSO)
- [x] Painel de gestão de empresas
- [x] Configuração de branding
- [x] Criação de usuários por empresa
- [x] Relatórios financeiros globais
- [x] Logs de auditoria
- [ ] Configuração de Stripe por empresa

### ⏳ Fase 3: Motor de Sorteios
- [ ] CRUD completo de sorteios
- [ ] Editor de faixas de prêmio
- [ ] Sistema de rodadas e números
- [ ] Validações de regras de negócio
- [ ] Versionamento de regras

### ⏳ Fase 4: Fluxo do Jogador
- [ ] Cadastro e login (CPF hash)
- [ ] Visualização de sorteios
- [ ] Compra de cartelas com Stripe
- [ ] Snapshot no momento da compra
- [ ] Acompanhamento de cartelas

### ⏳ Fase 5: Ranking e Premiação
- [ ] Cálculo de hits/missing
- [ ] Tabela de ranking pré-calculada
- [ ] Triggers de recálculo
- [ ] Exibição com dados mascarados
- [ ] Elegibilidade de faixas

### ⏳ Fase 6: Integrações e Segurança
- [ ] Edge Function de webhook Stripe
- [ ] Rate limiting
- [ ] Proteção brute force
- [ ] Antifraude básica
- [ ] Logs financeiros completos

---

## 📋 Visão Geral do Sistema

Plataforma SaaS whitelabel B2B2C onde:
- **Super Admin** comercializa e gerencia empresas (tenants)
- Cada **Empresa** opera ambiente 100% isolado com branding e Stripe próprios
- **Jogadores** compram cartelas e acompanham sorteios
- **Sistema** executa processos automáticos (ranking, webhooks, validações)

---

## 🗄️ Modelo de Dados (Implementado)

| Tabela | Descrição |
|--------|-----------|
| companies | Tenants da plataforma |
| user_roles | RBAC separado (segurança) |
| players | Jogadores por empresa |
| raffles | Sorteios por empresa |
| prize_tiers | Faixas de prêmio |
| draw_batches | Rodadas de números |
| draw_numbers | Números sorteados |
| tickets | Cartelas compradas |
| ticket_numbers | Números das cartelas |
| ticket_ranking | Ranking pré-calculado |
| payments | Transações financeiras |
| audit_logs | Logs de auditoria |
| financial_logs | Logs financeiros |

---

## 🖥️ Estrutura de Rotas (Implementado)

### Super Admin
- `/super-admin/dashboard`
- `/super-admin/empresas`
- `/super-admin/empresas/:id/configurar`
- `/super-admin/usuarios`
- `/super-admin/financeiro`
- `/super-admin/auditoria`

### Empresa (contexto por slug)
- `/empresa/:slug/dashboard`
- `/empresa/:slug/sorteios`
- `/empresa/:slug/jogadores`
- `/empresa/:slug/financeiro`
- `/empresa/:slug/configuracoes`

---

## 🔒 Segurança Implementada

- RLS em TODAS as tabelas
- RBAC via tabela separada `user_roles`
- Funções SECURITY DEFINER: `has_role()`, `has_role_in_company()`, `is_super_admin()`, `get_user_company_ids()`
- Soft delete em entidades críticas
- Validação de email com Zod

---

## 📂 Estrutura de Arquivos

```
src/
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.tsx
│   ├── layouts/
│   │   ├── EmpresaLayout.tsx
│   │   ├── SuperAdminLayout.tsx
│   │   └── ThemedLayout.tsx
│   └── shared/
│       ├── ConfirmDialog.tsx
│       ├── DataTable.tsx
│       ├── LoadingState.tsx
│       ├── StatsCard.tsx
│       └── StatusBadge.tsx
├── contexts/
│   ├── AuthContext.tsx
│   └── TenantContext.tsx
├── pages/
│   ├── Auth.tsx
│   ├── Index.tsx
│   ├── empresa/
│   │   ├── Configuracoes.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Financeiro.tsx
│   │   ├── Jogadores.tsx
│   │   └── Sorteios.tsx
│   └── super-admin/
│       ├── Auditoria.tsx
│       ├── Dashboard.tsx
│       ├── EmpresaConfig.tsx
│       ├── Empresas.tsx
│       ├── Financeiro.tsx
│       └── Usuarios.tsx
└── types/
    └── database.types.ts
```
