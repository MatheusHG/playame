-- Adicionar coluna regulations à tabela raffles
ALTER TABLE public.raffles ADD COLUMN IF NOT EXISTS regulations text;
