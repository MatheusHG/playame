-- Add policy to allow public read access to active companies for landing pages
CREATE POLICY "Active companies are publicly viewable"
  ON public.companies
  FOR SELECT
  USING (status = 'active' AND deleted_at IS NULL);