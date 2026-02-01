-- Add image_url to raffles table
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS image_url text;

-- Create banners table for company landing pages
CREATE TABLE public.company_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  redirect_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_banners ENABLE ROW LEVEL SECURITY;

-- Public can view active banners
CREATE POLICY "Active banners are publicly viewable"
  ON public.company_banners
  FOR SELECT
  USING (is_active = true);

-- Company admins can manage their banners
CREATE POLICY "Company admins can manage their banners"
  ON public.company_banners
  FOR ALL
  USING (has_role_in_company(auth.uid(), 'ADMIN_EMPRESA'::app_role, company_id))
  WITH CHECK (has_role_in_company(auth.uid(), 'ADMIN_EMPRESA'::app_role, company_id));

-- Super admins can manage all banners
CREATE POLICY "Super admins can manage all banners"
  ON public.company_banners
  FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_company_banners_updated_at
  BEFORE UPDATE ON public.company_banners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for company assets (banners, raffle images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company assets
CREATE POLICY "Company assets are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'company-assets');

CREATE POLICY "Company admins can upload assets"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'company-assets' 
    AND (
      is_super_admin(auth.uid()) 
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM companies 
        WHERE id IN (SELECT unnest(get_user_company_ids(auth.uid())))
      )
    )
  );

CREATE POLICY "Company admins can update their assets"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'company-assets' 
    AND (
      is_super_admin(auth.uid()) 
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM companies 
        WHERE id IN (SELECT unnest(get_user_company_ids(auth.uid())))
      )
    )
  );

CREATE POLICY "Company admins can delete their assets"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'company-assets' 
    AND (
      is_super_admin(auth.uid()) 
      OR (storage.foldername(name))[1] IN (
        SELECT id::text FROM companies 
        WHERE id IN (SELECT unnest(get_user_company_ids(auth.uid())))
      )
    )
  );