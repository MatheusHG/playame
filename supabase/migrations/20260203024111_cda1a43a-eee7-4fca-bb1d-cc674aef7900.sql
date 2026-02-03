-- =====================================================
-- AFFILIATE RBAC & PORTAL SYSTEM
-- =====================================================

-- 1. Add unique link code and sales pause to affiliates
ALTER TABLE public.affiliates 
ADD COLUMN IF NOT EXISTS link_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_sales_paused BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paused_by UUID REFERENCES auth.users(id);

-- Generate unique link codes for existing affiliates
UPDATE public.affiliates 
SET link_code = LOWER(SUBSTRING(MD5(id::text || created_at::text) FROM 1 FOR 8))
WHERE link_code IS NULL;

-- Make link_code NOT NULL after populating
ALTER TABLE public.affiliates 
ALTER COLUMN link_code SET NOT NULL;

-- 2. Create permission profiles table (empresa define os perfis)
CREATE TABLE public.permission_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  affiliate_type affiliate_type NOT NULL, -- 'manager' ou 'cambista'
  permissions JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- 3. Link affiliates to permission profiles
ALTER TABLE public.affiliates
ADD COLUMN IF NOT EXISTS permission_profile_id UUID REFERENCES public.permission_profiles(id);

-- 4. Create permission audit logs table
CREATE TABLE public.permission_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES auth.users(id),
  target_type TEXT NOT NULL, -- 'profile' or 'affiliate'
  target_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'assign'
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Enable RLS on new tables
ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for permission_profiles
CREATE POLICY "Company admins can manage their permission profiles"
ON public.permission_profiles FOR ALL
USING (has_role_in_company(auth.uid(), 'ADMIN_EMPRESA'::app_role, company_id))
WITH CHECK (has_role_in_company(auth.uid(), 'ADMIN_EMPRESA'::app_role, company_id));

CREATE POLICY "Super admins can manage all permission profiles"
ON public.permission_profiles FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Affiliates can view their own profile permissions"
ON public.permission_profiles FOR SELECT
USING (
  id IN (
    SELECT permission_profile_id FROM public.affiliates 
    WHERE user_id = auth.uid() AND permission_profile_id IS NOT NULL
  )
);

-- 7. RLS Policies for permission_audit_logs
CREATE POLICY "Company admins can view their permission audit logs"
ON public.permission_audit_logs FOR SELECT
USING (company_id IN (SELECT unnest(get_user_company_ids(auth.uid()))));

CREATE POLICY "Super admins can view all permission audit logs"
ON public.permission_audit_logs FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "System can insert permission audit logs"
ON public.permission_audit_logs FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid()) OR 
  has_role_in_company(auth.uid(), 'ADMIN_EMPRESA'::app_role, company_id)
);

-- 8. Function to check affiliate permissions
CREATE OR REPLACE FUNCTION public.affiliate_has_permission(
  _user_id UUID,
  _permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _permissions JSONB;
BEGIN
  SELECT pp.permissions INTO _permissions
  FROM public.affiliates a
  JOIN public.permission_profiles pp ON pp.id = a.permission_profile_id
  WHERE a.user_id = _user_id
  AND a.is_active = true
  AND a.deleted_at IS NULL
  AND a.is_sales_paused = false;
  
  IF _permissions IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN COALESCE((_permissions->>_permission)::boolean, false);
END;
$$;

-- 9. Function to get affiliate by link code
CREATE OR REPLACE FUNCTION public.get_affiliate_by_link_code(
  _link_code TEXT
)
RETURNS TABLE(
  id UUID,
  company_id UUID,
  name TEXT,
  type affiliate_type,
  parent_affiliate_id UUID,
  is_sales_paused BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.company_id,
    a.name,
    a.type,
    a.parent_affiliate_id,
    a.is_sales_paused
  FROM public.affiliates a
  WHERE a.link_code = _link_code
  AND a.is_active = true
  AND a.deleted_at IS NULL;
END;
$$;

-- 10. Function to generate unique link code
CREATE OR REPLACE FUNCTION public.generate_affiliate_link_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.link_code IS NULL THEN
    NEW.link_code := LOWER(SUBSTRING(MD5(NEW.id::text || now()::text || random()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_generate_affiliate_link_code
BEFORE INSERT ON public.affiliates
FOR EACH ROW
EXECUTE FUNCTION public.generate_affiliate_link_code();

-- 11. Insert default permission profiles for existing companies
INSERT INTO public.permission_profiles (company_id, name, description, affiliate_type, permissions, is_default)
SELECT 
  c.id,
  'Gerente Padrão',
  'Perfil padrão para gerentes com acesso completo à sua equipe',
  'manager'::affiliate_type,
  '{
    "can_view_own_sales": true,
    "can_view_team_sales": true,
    "can_view_own_commissions": true,
    "can_view_team_commissions": true,
    "can_manage_cambistas": true,
    "can_create_sales": true,
    "can_view_reports": true,
    "can_export_data": false,
    "can_view_company_revenue": false,
    "can_edit_commission": false
  }'::jsonb,
  true
FROM public.companies c
WHERE c.deleted_at IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.permission_profiles (company_id, name, description, affiliate_type, permissions, is_default)
SELECT 
  c.id,
  'Cambista Padrão',
  'Perfil padrão para cambistas com acesso básico',
  'cambista'::affiliate_type,
  '{
    "can_view_own_sales": true,
    "can_view_team_sales": false,
    "can_view_own_commissions": true,
    "can_view_team_commissions": false,
    "can_manage_cambistas": false,
    "can_create_sales": true,
    "can_view_reports": false,
    "can_export_data": false,
    "can_view_company_revenue": false,
    "can_edit_commission": false
  }'::jsonb,
  true
FROM public.companies c
WHERE c.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- 12. RLS policy for affiliates to view their own data
CREATE POLICY "Affiliates can view their own data"
ON public.affiliates FOR SELECT
USING (user_id = auth.uid());

-- 13. RLS for tickets - affiliates can view their own tickets
CREATE POLICY "Affiliates can view tickets sold by them"
ON public.tickets FOR SELECT
USING (
  affiliate_id IN (
    SELECT id FROM public.affiliates WHERE user_id = auth.uid()
  )
);

-- 14. RLS for affiliate_commissions - affiliates can view their own
CREATE POLICY "Affiliates can view their own commissions"
ON public.affiliate_commissions FOR SELECT
USING (
  manager_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  OR cambista_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
);

-- 15. Allow affiliates to insert tickets (for manual sales)
CREATE POLICY "Active affiliates can create tickets"
ON public.tickets FOR INSERT
WITH CHECK (
  affiliate_id IN (
    SELECT id FROM public.affiliates 
    WHERE user_id = auth.uid() 
    AND is_active = true 
    AND is_sales_paused = false
    AND deleted_at IS NULL
  )
  AND affiliate_has_permission(auth.uid(), 'can_create_sales')
);

-- 16. Allow affiliates to view players they created
CREATE POLICY "Affiliates can view their players"
ON public.players FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.affiliates WHERE user_id = auth.uid()
  )
);

-- 17. Allow affiliates to create players (for manual sales)
CREATE POLICY "Active affiliates can create players"
ON public.players FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.affiliates 
    WHERE user_id = auth.uid() 
    AND is_active = true 
    AND is_sales_paused = false
    AND deleted_at IS NULL
  )
  AND affiliate_has_permission(auth.uid(), 'can_create_sales')
);

-- 18. Allow affiliates to view active raffles
CREATE POLICY "Affiliates can view active raffles"
ON public.raffles FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.affiliates WHERE user_id = auth.uid()
  )
  AND status = 'active'
  AND deleted_at IS NULL
);