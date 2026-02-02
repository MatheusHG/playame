-- Add user_id column to financial_logs to track who performed the operation
ALTER TABLE public.financial_logs 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_financial_logs_user_id ON public.financial_logs(user_id);

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS idx_financial_logs_created_at ON public.financial_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);