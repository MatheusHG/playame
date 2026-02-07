-- =====================================================
-- RAFFLE DISCOUNTS (PROMOÇÕES POR QUANTIDADE DE CARTELAS)
-- =====================================================

-- 1. Tabela de regras de desconto por sorteio
CREATE TABLE IF NOT EXISTS public.raffle_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL CHECK (min_quantity > 0),
  discount_percent NUMERIC(5,2) NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),
  UNIQUE(raffle_id, min_quantity)
);

CREATE INDEX IF NOT EXISTS idx_raffle_discounts_raffle_id ON public.raffle_discounts(raffle_id);
CREATE INDEX IF NOT EXISTS idx_raffle_discounts_active ON public.raffle_discounts(is_active);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_raffle_discounts_updated_at ON public.raffle_discounts;
CREATE TRIGGER trg_raffle_discounts_updated_at
BEFORE UPDATE ON public.raffle_discounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Campos no payment para auditar desconto aplicado
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0 CHECK (discount_amount >= 0),
ADD COLUMN IF NOT EXISTS discount_rule_id UUID REFERENCES public.raffle_discounts(id);

-- backfill de registros antigos
UPDATE public.payments
SET
  original_amount = COALESCE(original_amount, amount),
  discount_percent = COALESCE(discount_percent, 0),
  discount_amount = COALESCE(discount_amount, 0)
WHERE original_amount IS NULL OR discount_percent IS NULL OR discount_amount IS NULL;

-- 3. RLS
ALTER TABLE public.raffle_discounts ENABLE ROW LEVEL SECURITY;

-- Admin da empresa gerencia promoções do seu sorteio
DROP POLICY IF EXISTS "Company admins can manage their raffle discounts" ON public.raffle_discounts;
CREATE POLICY "Company admins can manage their raffle discounts"
  ON public.raffle_discounts FOR ALL
  TO authenticated
  USING (
    raffle_id IN (
      SELECT id
      FROM public.raffles r
      WHERE public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', r.company_id)
    )
  )
  WITH CHECK (
    raffle_id IN (
      SELECT id
      FROM public.raffles r
      WHERE public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', r.company_id)
    )
  );

-- Equipe pode visualizar promoções dos seus sorteios
DROP POLICY IF EXISTS "Company staff can view their raffle discounts" ON public.raffle_discounts;
CREATE POLICY "Company staff can view their raffle discounts"
  ON public.raffle_discounts FOR SELECT
  TO authenticated
  USING (
    raffle_id IN (
      SELECT id
      FROM public.raffles r
      WHERE r.company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid())))
    )
  );

-- Promoções de sorteios ativos são públicas (para exibir no checkout)
DROP POLICY IF EXISTS "Discounts of active raffles are publicly viewable" ON public.raffle_discounts;
CREATE POLICY "Discounts of active raffles are publicly viewable"
  ON public.raffle_discounts FOR SELECT
  TO anon
  USING (
    is_active = true
    AND (starts_at IS NULL OR now() >= starts_at)
    AND (ends_at IS NULL OR now() <= ends_at)
    AND raffle_id IN (SELECT id FROM public.raffles WHERE status = 'active' AND deleted_at IS NULL)
  );

