-- Adicionar campo de taxa administrativa da empresa no sorteio
-- Esse é o percentual que o admin da empresa vai reter do valor líquido (após taxa do whitelabel)
ALTER TABLE public.raffles 
ADD COLUMN company_profit_percent numeric NOT NULL DEFAULT 0;

-- Comentário explicativo
COMMENT ON COLUMN public.raffles.company_profit_percent IS 'Percentual do valor líquido (após taxa admin do whitelabel) que a empresa retém. O restante vai para o prêmio.';