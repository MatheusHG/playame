-- Corrigir funções sem search_path definido

-- Corrigir update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Corrigir update_raffle_draw_count
CREATE OR REPLACE FUNCTION public.update_raffle_draw_count()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

-- Corrigir policies de audit_logs e financial_logs
-- Remover as policies permissivas e criar versões mais restritivas

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert financial logs" ON public.financial_logs;

-- Audit logs: apenas usuários autenticados podem inserir logs relacionados ao seu contexto
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR 
    public.is_super_admin(auth.uid()) OR
    (company_id IS NOT NULL AND company_id IN (SELECT unnest(public.get_user_company_ids(auth.uid()))))
  );

-- Financial logs: apenas admins podem inserir logs financeiros de suas empresas
CREATE POLICY "Company admins can insert financial logs"
  ON public.financial_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_role_in_company(auth.uid(), 'ADMIN_EMPRESA', company_id)
  );