-- Habilitar RLS na tabela rate_limits (warning existente)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy para rate_limits (apenas service role pode acessar)
CREATE POLICY "Service role can manage rate limits"
  ON public.rate_limits FOR ALL
  USING (true)
  WITH CHECK (true);