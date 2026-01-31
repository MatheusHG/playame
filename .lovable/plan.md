

# 🎰 Plataforma SaaS Whitelabel de Bolões Numéricos
**Sistema Multi-Tenant Completo para Produção Comercial**

---

## 📋 Visão Geral do Sistema

Plataforma SaaS whitelabel B2B2C onde:
- **Super Admin** comercializa e gerencia empresas (tenants)
- Cada **Empresa** opera ambiente 100% isolado com branding e Stripe próprios
- **Jogadores** compram cartelas e acompanham sorteios
- **Sistema** executa processos automáticos (ranking, webhooks, validações)

---

## 🏗️ Arquitetura Multi-Tenant

### Isolamento Total por `company_id`
- Todas as entidades possuem `company_id` obrigatório
- RLS (Row Level Security) em todas as tabelas
- Nenhuma query sem contexto de tenant
- Dados de jogadores, sorteios, pagamentos 100% isolados

### Modelo de Dados Completo

**Entidades Principais:**

1. **companies** - Tenants da plataforma
   - id, name, slug, logo_url, primary_color, secondary_color
   - stripe_secret_key (criptografado), stripe_webhook_secret
   - payments_enabled, admin_fee_percentage
   - status (active, suspended, deleted), deleted_at

2. **user_roles** - RBAC separado (segurança)
   - id, user_id, role (SUPER_ADMIN, ADMIN_EMPRESA, COLABORADOR)
   - company_id (nullable para SUPER_ADMIN)

3. **players** - Jogadores por empresa
   - id, company_id, cpf_hash, cpf_last4
   - name, city, phone, password_hash
   - status, blocked_at, blocked_reason
   - UNIQUE(company_id, cpf_hash)

4. **raffles** - Sorteios configurados por empresa
   - id, company_id, name, description
   - ticket_price, number_range_start, number_range_end
   - numbers_per_ticket, status (draft, active, paused, finished)
   - prize_mode (FIXED, FIXED_PLUS_PERCENT, PERCENT_ONLY)
   - fixed_prize_value, prize_percent_of_sales
   - current_draw_count, rules_version, scheduled_at

5. **prize_tiers** - Faixas de prêmio por sorteio
   - id, raffle_id, hits_required (quantidade de acertos)
   - prize_percentage, prize_type (money, object)
   - purchase_allowed_until_draw_count (limite de entrada)
   - object_description (se tipo = objeto)

6. **draw_batches** - Rodadas de números
   - id, raffle_id, name, draw_order
   - created_at, finalized_at

7. **draw_numbers** - Números sorteados por rodada
   - id, draw_batch_id, number
   - UNIQUE(raffle_id, number) via constraint

8. **tickets** - Cartelas compradas
   - id, raffle_id, player_id, company_id
   - status (pending_payment, active, winner, cancelled)
   - purchased_at, snapshot_data (JSON completo)
   - eligible_prize_tiers (array de tier_ids elegíveis)

9. **ticket_numbers** - Números de cada cartela
   - id, ticket_id, number

10. **ticket_ranking** - Ranking pré-calculado
    - id, ticket_id, raffle_id, player_id
    - hits, missing, rank_position
    - last_calculated_at

11. **payments** - Transações financeiras
    - id, ticket_id, company_id, player_id
    - amount, admin_fee, net_amount
    - stripe_payment_intent_id, status
    - processed_at

12. **audit_logs** - Logs de auditoria
    - id, company_id, user_id, action
    - entity_type, entity_id, changes_json
    - ip_address, created_at

13. **financial_logs** - Logs financeiros
    - id, company_id, type, amount
    - reference_id, description, created_at

---

## 👥 Sistema de Papéis (RBAC)

### SUPER_ADMIN (Whitelabel)
- Cadastrar, editar, suspender, remover empresas
- Definir taxa administrativa por empresa (% sobre vendas)
- Configurar Stripe e branding de cada empresa
- Criar usuários (Admin/Colaborador) para empresas
- Visualizar relatórios financeiros globais
- Acessar logs de auditoria de todo sistema
- Bloquear jogadores de qualquer empresa

### ADMIN_EMPRESA
- Gerenciar sorteios completos (criar, pausar, encerrar)
- Configurar faixas de prêmio flexíveis
- Cadastrar rodadas e números sorteados
- Visualizar ranking em tempo real
- Gerenciar jogadores da empresa
- Acessar painel financeiro da empresa
- Alterar branding da empresa (logo, cores)

### COLABORADOR
- Visualizar sorteios e rankings
- Consultar cartelas e jogadores
- Acesso restrito a operações de leitura

### JOGADOR
- Criar conta (CPF, nome, cidade, telefone)
- Login com CPF + senha
- Comprar cartelas via Stripe
- Acompanhar sorteios e cartelas
- Visualizar ranking (CPF/cidade mascarados)

---

## 🎯 Motor de Sorteios

### Configuração de Sorteio
- Nome, descrição, valor da cartela
- Faixa numérica (ex: 00-99)
- Quantidade de números por cartela
- Modo de vitória e premiação

### Faixas de Prêmio (Totalmente Flexíveis)
Cada faixa define:
- **hits_required**: Quantidade de acertos necessária
- **prize_percentage**: Percentual do prêmio total
- **prize_type**: Dinheiro ou Objeto
- **purchase_allowed_until_draw_count**: Limite de rodada para entrada

**Exemplo prático:**
| Acertos | % Prêmio | Até qual rodada pode entrar |
|---------|----------|----------------------------|
| 0       | 10%      | Apenas 1ª rodada           |
| 10      | 40%      | Sem limite                 |
| 15      | 50%      | Até 5ª rodada              |

**Regras obrigatórias:**
- Soma dos percentuais = 100%
- Cartela participa de TODAS as faixas elegíveis automaticamente
- Se rodada atual > limite da faixa, novas cartelas NÃO concorrem naquela faixa

### Modos de Premiação
- **FIXO**: Valor fixo definido
- **FIXO + %**: Valor fixo + percentual das vendas
- **SOMENTE %**: Apenas percentual das vendas

### Sistema de Rodadas (draw_batches)
- Empresa cria rodadas com 1 ou mais números
- Números NÃO podem repetir dentro do mesmo sorteio
- Cada inserção recalcula ranking automaticamente
- Histórico completo mantido para auditoria

### Determinação de Vencedor
- Somente no encerramento manual do sorteio
- OU ao atingir condição automática configurada
- NÃO existem rodadas premiadas independentes

---

## 🏆 Sistema de Ranking

### Base de Cálculo
- **hits**: quantidade de acertos
- **missing**: números faltantes para completar

### Ordenação (prioridade)
1. Menor `missing`
2. Maior `hits`
3. Cartela mais antiga (`purchased_at`)

### Implementação
- Tabela `ticket_ranking` pré-calculada
- Trigger recalcula após cada inserção em `draw_numbers`
- CPF sempre mascarado na exibição pública
- Atualização assíncrona via Edge Function

---

## 💳 Fluxo de Pagamentos

### Stripe Isolado por Empresa
Cada empresa possui:
- `stripe_secret_key` (criptografado)
- `stripe_webhook_secret`
- `payments_enabled` (toggle)

### Fluxo de Compra
1. Jogador seleciona sorteio e números
2. Sistema gera snapshot da cartela (regras vigentes)
3. Checkout via Stripe da empresa específica
4. Webhook valida com secret da empresa
5. Pagamento aprovado → cartela ativada
6. Cálculo: valor - taxa admin = líquido empresa

### Metadata Obrigatória (Stripe)
- company_id
- raffle_id
- ticket_id
- player_id

### Taxa Administrativa
- Super Admin define % por empresa
- Calculada automaticamente em cada venda
- Registrada em `financial_logs`

---

## 🖥️ Estrutura de Painéis

### Rotas do Super Admin
- `/super-admin/dashboard` - Visão global
- `/super-admin/empresas` - CRUD de empresas
- `/super-admin/empresas/:id/configurar` - Stripe/branding
- `/super-admin/usuarios` - Gestão de usuários
- `/super-admin/financeiro` - Relatórios globais
- `/super-admin/auditoria` - Logs do sistema

### Rotas da Empresa (contexto por slug)
- `/empresa/:slug/dashboard` - Painel principal
- `/empresa/:slug/sorteios` - Gestão de sorteios
- `/empresa/:slug/sorteios/:id/rodadas` - Números sorteados
- `/empresa/:slug/sorteios/:id/ranking` - Ranking em tempo real
- `/empresa/:slug/jogadores` - Gestão de jogadores
- `/empresa/:slug/cartelas` - Visualização de cartelas
- `/empresa/:slug/financeiro` - Relatórios financeiros
- `/empresa/:slug/configuracoes` - Branding

### Rotas do Jogador (contexto por slug)
- `/empresa/:slug/` - Landing da empresa (branding)
- `/empresa/:slug/auth` - Login/Cadastro
- `/empresa/:slug/sorteios` - Sorteios disponíveis
- `/empresa/:slug/comprar/:raffle_id` - Compra de cartela
- `/empresa/:slug/minhas-cartelas` - Cartelas do jogador
- `/empresa/:slug/ranking/:raffle_id` - Ranking público
- `/empresa/:slug/perfil` - Edição de perfil

---

## 🔒 Segurança Enterprise

### Proteção de Dados
- CPF armazenado como: `cpf_hash` + `cpf_last4`
- Chaves Stripe criptografadas no banco
- Dados sensíveis NUNCA logados
- Soft delete em todas entidades críticas

### Controle de Acesso
- RLS em TODAS as tabelas com company_id
- RBAC via tabela separada `user_roles`
- Função `has_role()` SECURITY DEFINER

### Proteções Ativas
- Rate limiting em endpoints críticos
- Proteção contra brute force (login)
- Validação de webhooks com secret por empresa
- Antifraude básica (detecção de padrões)
- Versionamento de regras do sorteio
- Snapshot de cartelas no momento da compra

### Auditoria Completa
- Logs de todas ações administrativas
- Logs financeiros separados
- Timestamp + user_id + IP em cada ação
- Retenção configurável

---

## ⚙️ Processos Automáticos do Sistema

### Edge Functions

1. **Webhook Stripe** (`stripe-webhook`)
   - Valida assinatura com secret da empresa
   - Atualiza status do pagamento
   - Ativa cartela após confirmação
   - Registra logs financeiros

2. **Recálculo de Ranking** (`recalculate-ranking`)
   - Trigger após inserção de números
   - Atualiza tabela `ticket_ranking`
   - Calcula hits/missing para todas cartelas

3. **Snapshot de Cartela** (`create-ticket-snapshot`)
   - Captura regras vigentes do sorteio
   - Armazena faixas elegíveis
   - Salva em JSON no campo `snapshot_data`

4. **Verificação de Elegibilidade** (`check-tier-eligibility`)
   - Determina faixas válidas para nova cartela
   - Baseado em `purchase_allowed_until_draw_count`
   - Executado no momento da compra

5. **Validação de CPF** (`validate-cpf`)
   - Verifica formato válido
   - Checa duplicidade por empresa
   - Gera hash + last4

---

## 📊 APIs REST Principais

### Super Admin
- `POST /api/companies` - Criar empresa
- `PUT /api/companies/:id` - Atualizar empresa
- `PATCH /api/companies/:id/status` - Suspender/Ativar
- `POST /api/companies/:id/users` - Criar usuário
- `GET /api/admin/financial-reports` - Relatórios globais
- `GET /api/admin/audit-logs` - Logs de auditoria

### Empresa
- `POST /api/raffles` - Criar sorteio
- `PUT /api/raffles/:id` - Atualizar sorteio
- `POST /api/raffles/:id/prize-tiers` - Configurar faixas
- `POST /api/raffles/:id/draw-batches` - Criar rodada
- `POST /api/draw-batches/:id/numbers` - Adicionar números
- `PATCH /api/raffles/:id/finish` - Encerrar sorteio
- `GET /api/raffles/:id/ranking` - Ranking atual
- `GET /api/company/financial` - Relatório financeiro

### Jogador
- `POST /api/players/register` - Cadastro
- `POST /api/players/login` - Login
- `GET /api/raffles/active` - Sorteios ativos
- `POST /api/tickets/purchase` - Comprar cartela
- `GET /api/players/me/tickets` - Minhas cartelas
- `GET /api/public/ranking/:raffle_id` - Ranking público

### Sistema
- `POST /api/webhooks/stripe` - Webhook Stripe
- `POST /api/system/recalculate-ranking` - Trigger ranking

---

## 🎨 Componentização Frontend

### Componentes Compartilhados
- `ThemedLayout` - Layout com branding dinâmico
- `DataTable` - Tabelas paginadas com filtros
- `StatsCard` - Cards de métricas
- `StatusBadge` - Badges de status
- `ConfirmDialog` - Diálogos de confirmação
- `LoadingState` - Estados de carregamento

### Componentes Super Admin
- `CompanyForm` - Formulário de empresa
- `CompanyList` - Lista de tenants
- `StripeConfigForm` - Configuração Stripe
- `BrandingPreview` - Preview de branding
- `GlobalFinancialChart` - Gráficos financeiros
- `AuditLogViewer` - Visualizador de logs

### Componentes Empresa
- `RaffleWizard` - Wizard de criação de sorteio
- `PrizeTierEditor` - Editor de faixas de prêmio
- `DrawBatchManager` - Gerenciador de rodadas
- `NumberPicker` - Seletor de números
- `RankingTable` - Tabela de ranking
- `TicketViewer` - Visualizador de cartelas
- `PlayerManager` - Gestão de jogadores

### Componentes Jogador
- `RaffleCard` - Card de sorteio
- `TicketPurchaseFlow` - Fluxo de compra
- `NumberSelector` - Seleção de números
- `MyTicketsList` - Lista de cartelas
- `PublicRanking` - Ranking mascarado
- `PlayerProfile` - Perfil do jogador

---

## 📈 Fases de Implementação

### Fase 1: Infraestrutura Base
- Schema do banco de dados completo (todas entidades)
- RLS policies com company_id
- Sistema de roles (user_roles + has_role)
- Autenticação básica
- Roteamento por papel

### Fase 2: Super Admin
- Painel de gestão de empresas
- Configuração de branding e Stripe
- Criação de usuários por empresa
- Relatórios financeiros globais
- Logs de auditoria

### Fase 3: Motor de Sorteios
- CRUD completo de sorteios
- Editor de faixas de prêmio
- Sistema de rodadas e números
- Validações de regras de negócio
- Versionamento de regras

### Fase 4: Fluxo do Jogador
- Cadastro e login (CPF hash)
- Visualização de sorteios
- Compra de cartelas com Stripe
- Snapshot no momento da compra
- Acompanhamento de cartelas

### Fase 5: Ranking e Premiação
- Cálculo de hits/missing
- Tabela de ranking pré-calculada
- Triggers de recálculo
- Exibição com dados mascarados
- Elegibilidade de faixas

### Fase 6: Integrações e Segurança
- Edge Function de webhook Stripe
- Rate limiting
- Proteção brute force
- Antifraude básica
- Logs financeiros completos

---

## ✅ Resultado Final

Sistema SaaS de produção comercial com:
- ✅ Multi-tenant verdadeiro (isolamento total)
- ✅ Whitelabel por empresa (branding completo)
- ✅ Stripe isolado por tenant
- ✅ Motor de sorteio flexível (faixas, rodadas, modos)
- ✅ Ranking em tempo real pré-calculado
- ✅ Premiação automática com elegibilidade
- ✅ Snapshot de regras na compra
- ✅ Segurança enterprise (RBAC, RLS, auditoria)
- ✅ Painéis separados por papel
- ✅ Processos automáticos do sistema

**Sem MVP. Sem simplificações. Produto completo conforme documento de requisitos.**

