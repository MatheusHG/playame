-- Enum para tipo de afiliado
CREATE TYPE public.affiliate_type AS ENUM ('manager', 'cambista');

-- Tabela de configurações da plataforma (taxa global do super-admin)
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de afiliados (gerentes e cambistas)
CREATE TABLE public.affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type affiliate_type NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  commission_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (commission_percent >= 0 AND commission_percent <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT cambista_must_have_parent CHECK (
    (type = 'cambista' AND parent_affiliate_id IS NOT NULL) OR
    (type = 'manager')
  ),
  CONSTRAINT manager_cannot_have_parent CHECK (
    (type = 'manager' AND parent_affiliate_id IS NULL) OR
    (type = 'cambista')
  )
);

-- Tabela de comissões por venda (auditoria completa)
CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  raffle_id uuid NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  
  -- Valores da venda
  sale_amount numeric(12,2) NOT NULL,
  
  -- Super-Admin split
  super_admin_percent numeric(5,2) NOT NULL,
  super_admin_amount numeric(12,2) NOT NULL,
  
  -- Empresa split
  company_net_amount numeric(12,2) NOT NULL,
  
  -- Gerente split (opcional)
  manager_id uuid REFERENCES public.affiliates(id),
  manager_percent numeric(5,2),
  manager_gross_amount numeric(12,2),
  
  -- Cambista split (opcional)
  cambista_id uuid REFERENCES public.affiliates(id),
  cambista_percent_of_manager numeric(5,2),
  cambista_amount numeric(12,2),
  
  -- Gerente valor líquido (após pagar cambista)
  manager_net_amount numeric(12,2),
  
  -- Snapshot das taxas vigentes no momento da venda
  rates_snapshot jsonb NOT NULL,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Histórico de alterações de taxas (auditoria)
CREATE TABLE public.commission_rate_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'platform', 'company', 'manager', 'affiliate'
  entity_id uuid NOT NULL,
  field_changed text NOT NULL,
  old_value numeric(5,2),
  new_value numeric(5,2),
  changed_by uuid REFERENCES auth.users(id),
  company_id uuid REFERENCES public.companies(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Adicionar affiliate_id opcional nas tickets para tracking
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.affiliates(id);

-- Índices para performance
CREATE INDEX idx_affiliates_company ON public.affiliates(company_id);
CREATE INDEX idx_affiliates_parent ON public.affiliates(parent_affiliate_id);
CREATE INDEX idx_affiliates_type ON public.affiliates(type);
CREATE INDEX idx_affiliate_commissions_payment ON public.affiliate_commissions(payment_id);
CREATE INDEX idx_affiliate_commissions_company ON public.affiliate_commissions(company_id);
CREATE INDEX idx_affiliate_commissions_manager ON public.affiliate_commissions(manager_id);
CREATE INDEX idx_affiliate_commissions_cambista ON public.affiliate_commissions(cambista_id);
CREATE INDEX idx_commission_rate_changes_entity ON public.commission_rate_changes(entity_type, entity_id);
CREATE INDEX idx_tickets_affiliate ON public.tickets(affiliate_id);

-- Trigger para updated_at
CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rate_changes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: platform_settings
CREATE POLICY "Super admins can manage platform settings"
  ON public.platform_settings FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated can view platform settings"
  ON public.platform_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies: affiliates
CREATE POLICY "Super admins can manage all affiliates"
  ON public.affiliates FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Company admins can manage their affiliates"
  ON public.affiliates FOR ALL
  USING (has_role_in_company(auth.uid(), 'ADMIN_EMPRESA'::app_role, company_id))
  WITH CHECK (has_role_in_company(auth.uid(), 'ADMIN_EMPRESA'::app_role, company_id));

CREATE POLICY "Company staff can view their affiliates"
  ON public.affiliates FOR SELECT
  USING (company_id IN (SELECT unnest(get_user_company_ids(auth.uid()))));

-- RLS Policies: affiliate_commissions
CREATE POLICY "Super admins can view all commissions"
  ON public.affiliate_commissions FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Company admins can view their commissions"
  ON public.affiliate_commissions FOR SELECT
  USING (company_id IN (SELECT unnest(get_user_company_ids(auth.uid()))));

-- RLS Policies: commission_rate_changes
CREATE POLICY "Super admins can manage rate changes"
  ON public.commission_rate_changes FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Company admins can view their rate changes"
  ON public.commission_rate_changes FOR SELECT
  USING (company_id IN (SELECT unnest(get_user_company_ids(auth.uid()))));

CREATE POLICY "Authenticated can insert rate changes"
  ON public.commission_rate_changes FOR INSERT
  WITH CHECK (
    is_super_admin(auth.uid()) OR 
    (company_id IS NOT NULL AND has_role_in_company(auth.uid(), 'ADMIN_EMPRESA'::app_role, company_id))
  );

-- Inserir taxa padrão do super-admin
INSERT INTO public.platform_settings (key, value)
VALUES ('super_admin_fee_percent', '{"value": 10}'::jsonb)
ON CONFLICT (key) DO NOTHING;