-- =============================================
-- FASE 1: INFRAESTRUTURA BASE COMPLETA
-- Plataforma SaaS Whitelabel de Bolões Numéricos
-- =============================================

-- 1. ENUMS para status e roles
CREATE TYPE public.company_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE public.app_role AS ENUM ('SUPER_ADMIN', 'ADMIN_EMPRESA', 'COLABORADOR');
CREATE TYPE public.player_status AS ENUM ('active', 'blocked', 'deleted');
CREATE TYPE public.raffle_status AS ENUM ('draft', 'active', 'paused', 'finished');
CREATE TYPE public.prize_mode AS ENUM ('FIXED', 'FIXED_PLUS_PERCENT', 'PERCENT_ONLY');
CREATE TYPE public.prize_type AS ENUM ('money', 'object');
CREATE TYPE public.ticket_status AS ENUM ('pending_payment', 'active', 'winner', 'cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded');

-- 2. TABELA: companies (Tenants da plataforma)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  secondary_color TEXT DEFAULT '#1E40AF',
  stripe_secret_key_encrypted TEXT,
  stripe_webhook_secret_encrypted TEXT,
  payments_enabled BOOLEAN DEFAULT false,
  admin_fee_percentage NUMERIC(5,2) DEFAULT 10.00 CHECK (admin_fee_percentage >= 0 AND admin_fee_percentage <= 100),
  status public.company_status DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. TABELA: user_roles (RBAC separado - segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role, company_id)
);

-- 4. TABELA: players (Jogadores por empresa)
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cpf_hash TEXT NOT NULL,
  cpf_last4 TEXT NOT NULL CHECK (length(cpf_last4) = 4),
  name TEXT NOT NULL,
  city TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  status public.player_status DEFAULT 'active',
  blocked_at TIMESTAMPTZ,
  blocked_reason TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(company_id, cpf_hash)
);

-- 5. TABELA: raffles (Sorteios por empresa)
CREATE TABLE public.raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  ticket_price NUMERIC(10,2) NOT NULL CHECK (ticket_price > 0),
  number_range_start INTEGER NOT NULL DEFAULT 0,
  number_range_end INTEGER NOT NULL DEFAULT 99,
  numbers_per_ticket INTEGER NOT NULL DEFAULT 10 CHECK (numbers_per_ticket > 0),
  status public.raffle_status DEFAULT 'draft',
  prize_mode public.prize_mode DEFAULT 'PERCENT_ONLY',
  fixed_prize_value NUMERIC(12,2) DEFAULT 0,
  prize_percent_of_sales NUMERIC(5,2) DEFAULT 100 CHECK (prize_percent_of_sales >= 0 AND prize_percent_of_sales <= 100),
  current_draw_count INTEGER DEFAULT 0,
  rules_version INTEGER DEFAULT 1,
  scheduled_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CHECK (number_range_end > number_range_start)
);

-- 6. TABELA: prize_tiers (Faixas de prêmio por sorteio)
CREATE TABLE public.prize_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  hits_required INTEGER NOT NULL CHECK (hits_required >= 0),
  prize_percentage NUMERIC(5,2) NOT NULL CHECK (prize_percentage >= 0 AND prize_percentage <= 100),
  prize_type public.prize_type DEFAULT 'money',
  purchase_allowed_until_draw_count INTEGER,
  object_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(raffle_id, hits_required)
);

-- 7. TABELA: draw_batches (Rodadas de números)
CREATE TABLE public.draw_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  name TEXT,
  draw_order INTEGER NOT NULL,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(raffle_id, draw_order)
);

-- 8. TABELA: draw_numbers (Números sorteados por rodada)
CREATE TABLE public.draw_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_batch_id UUID NOT NULL REFERENCES public.draw_batches(id) ON DELETE CASCADE,
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(raffle_id, number)
);

-- 9. TABELA: tickets (Cartelas compradas)
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status public.ticket_status DEFAULT 'pending_payment',
  purchased_at TIMESTAMPTZ,
  snapshot_data JSONB,
  eligible_prize_tiers UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. TABELA: ticket_numbers (Números de cada cartela)
CREATE TABLE public.ticket_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(ticket_id, number)
);

-- 11. TABELA: ticket_ranking (Ranking pré-calculado)
CREATE TABLE public.ticket_ranking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE UNIQUE,
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  hits INTEGER DEFAULT 0,
  missing INTEGER NOT NULL,
  rank_position INTEGER,
  last_calculated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. TABELA: payments (Transações financeiras)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  admin_fee NUMERIC(12,2) DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  status public.payment_status DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 13. TABELA: audit_logs (Logs de auditoria)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes_json JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 14. TABELA: financial_logs (Logs financeiros)
CREATE TABLE public.financial_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================
-- INDEXES para performance
-- =============================================
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_company_id ON public.user_roles(company_id);
CREATE INDEX idx_players_company_id ON public.players(company_id);
CREATE INDEX idx_players_cpf_hash ON public.players(cpf_hash);
CREATE INDEX idx_raffles_company_id ON public.raffles(company_id);
CREATE INDEX idx_raffles_status ON public.raffles(status);
CREATE INDEX idx_prize_tiers_raffle_id ON public.prize_tiers(raffle_id);
CREATE INDEX idx_draw_batches_raffle_id ON public.draw_batches(raffle_id);
CREATE INDEX idx_draw_numbers_raffle_id ON public.draw_numbers(raffle_id);
CREATE INDEX idx_draw_numbers_batch_id ON public.draw_numbers(draw_batch_id);
CREATE INDEX idx_tickets_raffle_id ON public.tickets(raffle_id);
CREATE INDEX idx_tickets_player_id ON public.tickets(player_id);
CREATE INDEX idx_tickets_company_id ON public.tickets(company_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_ticket_numbers_ticket_id ON public.ticket_numbers(ticket_id);
CREATE INDEX idx_ticket_ranking_raffle_id ON public.ticket_ranking(raffle_id);
CREATE INDEX idx_ticket_ranking_company_id ON public.ticket_ranking(company_id);
CREATE INDEX idx_ticket_ranking_position ON public.ticket_ranking(raffle_id, rank_position);
CREATE INDEX idx_payments_company_id ON public.payments(company_id);
CREATE INDEX idx_payments_player_id ON public.payments(player_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_financial_logs_company_id ON public.financial_logs(company_id);
CREATE INDEX idx_financial_logs_created_at ON public.financial_logs(created_at DESC);

-- =============================================
-- FUNÇÕES SECURITY DEFINER para RBAC
-- =============================================

-- Função para verificar se usuário tem role específica
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para verificar se usuário tem role em empresa específica
CREATE OR REPLACE FUNCTION public.has_role_in_company(_user_id UUID, _role public.app_role, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND company_id = _company_id
  )
$$;

-- Função para obter company_ids do usuário
CREATE OR REPLACE FUNCTION public.get_user_company_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(company_id), '{}')
  FROM public.user_roles
  WHERE user_id = _user_id
    AND company_id IS NOT NULL
$$;

-- Função para verificar se é SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'SUPER_ADMIN')
$$;

-- =============================================
-- ENABLE RLS em todas as tabelas
-- =============================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_ranking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES: companies
-- =============================================
CREATE POLICY "Super admins can do everything on companies"
  ON public.companies FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company admins can view their company"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
  );

CREATE POLICY "Company admins can update their company branding"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', id)
  )
  WITH CHECK (
    public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', id)
  );

-- =============================================
-- RLS POLICIES: user_roles
-- =============================================
CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- RLS POLICIES: players
-- =============================================
CREATE POLICY "Super admins can manage all players"
  ON public.players FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company staff can view their company players"
  ON public.players FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
  );

CREATE POLICY "Company admins can manage their company players"
  ON public.players FOR ALL
  TO authenticated
  USING (
    public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
  )
  WITH CHECK (
    public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
  );

-- =============================================
-- RLS POLICIES: raffles
-- =============================================
CREATE POLICY "Super admins can manage all raffles"
  ON public.raffles FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company staff can view their company raffles"
  ON public.raffles FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
  );

CREATE POLICY "Company admins can manage their company raffles"
  ON public.raffles FOR ALL
  TO authenticated
  USING (
    public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
  )
  WITH CHECK (
    public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
  );

CREATE POLICY "Active raffles are publicly viewable"
  ON public.raffles FOR SELECT
  TO anon
  USING (status = 'active' AND deleted_at IS NULL);

-- =============================================
-- RLS POLICIES: prize_tiers
-- =============================================
CREATE POLICY "Super admins can manage all prize tiers"
  ON public.prize_tiers FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company staff can view their raffle prize tiers"
  ON public.prize_tiers FOR SELECT
  TO authenticated
  USING (
    raffle_id IN (
      SELECT id FROM public.raffles 
      WHERE company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
    )
  );

CREATE POLICY "Company admins can manage their raffle prize tiers"
  ON public.prize_tiers FOR ALL
  TO authenticated
  USING (
    raffle_id IN (
      SELECT id FROM public.raffles 
      WHERE public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
    )
  )
  WITH CHECK (
    raffle_id IN (
      SELECT id FROM public.raffles 
      WHERE public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
    )
  );

CREATE POLICY "Prize tiers of active raffles are publicly viewable"
  ON public.prize_tiers FOR SELECT
  TO anon
  USING (
    raffle_id IN (SELECT id FROM public.raffles WHERE status = 'active' AND deleted_at IS NULL)
  );

-- =============================================
-- RLS POLICIES: draw_batches
-- =============================================
CREATE POLICY "Super admins can manage all draw batches"
  ON public.draw_batches FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company staff can view their raffle draw batches"
  ON public.draw_batches FOR SELECT
  TO authenticated
  USING (
    raffle_id IN (
      SELECT id FROM public.raffles 
      WHERE company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
    )
  );

CREATE POLICY "Company admins can manage their raffle draw batches"
  ON public.draw_batches FOR ALL
  TO authenticated
  USING (
    raffle_id IN (
      SELECT id FROM public.raffles 
      WHERE public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
    )
  )
  WITH CHECK (
    raffle_id IN (
      SELECT id FROM public.raffles 
      WHERE public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
    )
  );

CREATE POLICY "Draw batches of active raffles are publicly viewable"
  ON public.draw_batches FOR SELECT
  TO anon
  USING (
    raffle_id IN (SELECT id FROM public.raffles WHERE status = 'active' AND deleted_at IS NULL)
  );

-- =============================================
-- RLS POLICIES: draw_numbers
-- =============================================
CREATE POLICY "Super admins can manage all draw numbers"
  ON public.draw_numbers FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company staff can view their raffle draw numbers"
  ON public.draw_numbers FOR SELECT
  TO authenticated
  USING (
    raffle_id IN (
      SELECT id FROM public.raffles 
      WHERE company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
    )
  );

CREATE POLICY "Company admins can manage their raffle draw numbers"
  ON public.draw_numbers FOR ALL
  TO authenticated
  USING (
    raffle_id IN (
      SELECT id FROM public.raffles 
      WHERE public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
    )
  )
  WITH CHECK (
    raffle_id IN (
      SELECT id FROM public.raffles 
      WHERE public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
    )
  );

CREATE POLICY "Draw numbers of active raffles are publicly viewable"
  ON public.draw_numbers FOR SELECT
  TO anon
  USING (
    raffle_id IN (SELECT id FROM public.raffles WHERE status = 'active' AND deleted_at IS NULL)
  );

-- =============================================
-- RLS POLICIES: tickets
-- =============================================
CREATE POLICY "Super admins can manage all tickets"
  ON public.tickets FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company staff can view their company tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
  );

CREATE POLICY "Company admins can manage their company tickets"
  ON public.tickets FOR ALL
  TO authenticated
  USING (
    public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
  )
  WITH CHECK (
    public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
  );

-- =============================================
-- RLS POLICIES: ticket_numbers
-- =============================================
CREATE POLICY "Super admins can manage all ticket numbers"
  ON public.ticket_numbers FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company staff can view their ticket numbers"
  ON public.ticket_numbers FOR SELECT
  TO authenticated
  USING (
    ticket_id IN (
      SELECT id FROM public.tickets 
      WHERE company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
    )
  );

-- =============================================
-- RLS POLICIES: ticket_ranking
-- =============================================
CREATE POLICY "Super admins can manage all rankings"
  ON public.ticket_ranking FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company staff can view their company rankings"
  ON public.ticket_ranking FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
  );

CREATE POLICY "Rankings of active raffles are publicly viewable"
  ON public.ticket_ranking FOR SELECT
  TO anon
  USING (
    raffle_id IN (SELECT id FROM public.raffles WHERE status = 'active' AND deleted_at IS NULL)
  );

-- =============================================
-- RLS POLICIES: payments
-- =============================================
CREATE POLICY "Super admins can manage all payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Company admins can view their company payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
  );

-- =============================================
-- RLS POLICIES: audit_logs
-- =============================================
CREATE POLICY "Super admins can view all audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Company admins can view their company audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- RLS POLICIES: financial_logs
-- =============================================
CREATE POLICY "Super admins can view all financial logs"
  ON public.financial_logs FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Company admins can view their company financial logs"
  ON public.financial_logs FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
  );

CREATE POLICY "System can insert financial logs"
  ON public.financial_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- TRIGGERS para updated_at automático
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_raffles_updated_at
  BEFORE UPDATE ON public.raffles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prize_tiers_updated_at
  BEFORE UPDATE ON public.prize_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TRIGGER para atualizar current_draw_count
-- =============================================
CREATE OR REPLACE FUNCTION public.update_raffle_draw_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.raffles
  SET current_draw_count = (
    SELECT COUNT(DISTINCT db.id) 
    FROM public.draw_batches db 
    WHERE db.raffle_id = NEW.raffle_id
  )
  WHERE id = NEW.raffle_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_draw_count_on_batch_insert
  AFTER INSERT ON public.draw_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_raffle_draw_count();