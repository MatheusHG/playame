
-- Create enum for payment method
CREATE TYPE public.payment_method AS ENUM ('manual', 'online');

-- Add payment_method column to companies
ALTER TABLE public.companies ADD COLUMN payment_method public.payment_method NOT NULL DEFAULT 'manual';
