-- ============================================
-- FASE 5 & 6: Triggers de ranking automático e funções de apuração
-- ============================================

-- Função para recalcular o ranking de uma cartela específica
CREATE OR REPLACE FUNCTION public.calculate_ticket_ranking(p_ticket_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raffle_id UUID;
  v_player_id UUID;
  v_company_id UUID;
  v_hits INTEGER;
  v_missing INTEGER;
  v_numbers_per_ticket INTEGER;
  v_ticket_numbers INTEGER[];
  v_drawn_numbers INTEGER[];
BEGIN
  -- Obter informações da cartela
  SELECT t.raffle_id, t.player_id, t.company_id, r.numbers_per_ticket
  INTO v_raffle_id, v_player_id, v_company_id, v_numbers_per_ticket
  FROM tickets t
  JOIN raffles r ON r.id = t.raffle_id
  WHERE t.id = p_ticket_id AND t.status = 'active';

  IF v_raffle_id IS NULL THEN
    RETURN; -- Cartela não encontrada ou não ativa
  END IF;

  -- Obter números da cartela
  SELECT ARRAY_AGG(number) INTO v_ticket_numbers
  FROM ticket_numbers
  WHERE ticket_id = p_ticket_id;

  -- Obter todos os números sorteados (apenas de rodadas finalizadas)
  SELECT ARRAY_AGG(dn.number) INTO v_drawn_numbers
  FROM draw_numbers dn
  JOIN draw_batches db ON db.id = dn.draw_batch_id
  WHERE db.raffle_id = v_raffle_id
    AND db.finalized_at IS NOT NULL;

  -- Calcular hits (interseção)
  IF v_drawn_numbers IS NULL THEN
    v_hits := 0;
  ELSE
    SELECT COUNT(*) INTO v_hits
    FROM unnest(v_ticket_numbers) AS tn
    WHERE tn = ANY(v_drawn_numbers);
  END IF;

  -- Calcular missing
  v_missing := v_numbers_per_ticket - v_hits;

  -- Inserir ou atualizar o ranking
  INSERT INTO ticket_ranking (ticket_id, raffle_id, player_id, company_id, hits, missing, last_calculated_at)
  VALUES (p_ticket_id, v_raffle_id, v_player_id, v_company_id, v_hits, v_missing, NOW())
  ON CONFLICT (ticket_id) 
  DO UPDATE SET 
    hits = EXCLUDED.hits,
    missing = EXCLUDED.missing,
    last_calculated_at = NOW();
END;
$$;

-- Função para recalcular o ranking de todas as cartelas de um sorteio
CREATE OR REPLACE FUNCTION public.recalculate_raffle_ranking(p_raffle_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  -- Recalcular cada cartela ativa do sorteio
  FOR v_ticket IN 
    SELECT id FROM tickets 
    WHERE raffle_id = p_raffle_id AND status = 'active'
  LOOP
    PERFORM calculate_ticket_ranking(v_ticket.id);
  END LOOP;

  -- Atualizar posições do ranking (ordenação: menor missing, maior hits, cartela mais antiga)
  WITH ranked AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        ORDER BY missing ASC, hits DESC, 
        (SELECT purchased_at FROM tickets WHERE tickets.id = ticket_ranking.ticket_id) ASC
      ) AS new_rank
    FROM ticket_ranking
    WHERE raffle_id = p_raffle_id
  )
  UPDATE ticket_ranking tr
  SET rank_position = r.new_rank
  FROM ranked r
  WHERE tr.id = r.id;
END;
$$;

-- Trigger para recalcular ranking quando um número é adicionado/removido e a rodada é finalizada
CREATE OR REPLACE FUNCTION public.trigger_recalculate_ranking_on_finalize()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só recalcula quando a rodada é finalizada
  IF NEW.finalized_at IS NOT NULL AND OLD.finalized_at IS NULL THEN
    PERFORM recalculate_raffle_ranking(NEW.raffle_id);
    
    -- Atualizar current_draw_count do sorteio
    UPDATE raffles 
    SET current_draw_count = (
      SELECT COUNT(*) FROM draw_numbers dn
      JOIN draw_batches db ON db.id = dn.draw_batch_id
      WHERE db.raffle_id = NEW.raffle_id AND db.finalized_at IS NOT NULL
    )
    WHERE id = NEW.raffle_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ranking_on_batch_finalize ON draw_batches;
CREATE TRIGGER trigger_ranking_on_batch_finalize
  AFTER UPDATE ON draw_batches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_ranking_on_finalize();

-- Função para registrar log de auditoria
CREATE OR REPLACE FUNCTION public.log_audit(
  p_company_id UUID,
  p_user_id UUID,
  p_player_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_changes JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (company_id, user_id, player_id, action, entity_type, entity_id, changes_json, ip_address)
  VALUES (p_company_id, p_user_id, p_player_id, p_action, p_entity_type, p_entity_id, p_changes, p_ip_address)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Função para registrar log financeiro
CREATE OR REPLACE FUNCTION public.log_financial(
  p_company_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO financial_logs (company_id, type, amount, reference_id, reference_type, description)
  VALUES (p_company_id, p_type, p_amount, p_reference_id, p_reference_type, p_description)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- Função para apurar ganhadores de um sorteio
CREATE OR REPLACE FUNCTION public.settle_raffle_winners(p_raffle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raffle RECORD;
  v_tier RECORD;
  v_winner RECORD;
  v_total_sales NUMERIC;
  v_prize_pool NUMERIC;
  v_tier_prize NUMERIC;
  v_winners JSONB := '[]'::JSONB;
BEGIN
  -- Obter dados do sorteio
  SELECT * INTO v_raffle FROM raffles WHERE id = p_raffle_id;
  
  IF v_raffle IS NULL THEN
    RETURN jsonb_build_object('error', 'Sorteio não encontrado');
  END IF;

  IF v_raffle.status = 'finished' THEN
    RETURN jsonb_build_object('error', 'Sorteio já foi apurado');
  END IF;

  -- Calcular total de vendas
  SELECT COALESCE(SUM(amount), 0) INTO v_total_sales
  FROM payments
  WHERE raffle_id = p_raffle_id AND status = 'succeeded';

  -- Calcular prize pool baseado no modo
  CASE v_raffle.prize_mode
    WHEN 'FIXED' THEN
      v_prize_pool := COALESCE(v_raffle.fixed_prize_value, 0);
    WHEN 'PERCENT_ONLY' THEN
      v_prize_pool := v_total_sales * (COALESCE(v_raffle.prize_percent_of_sales, 0) / 100);
    WHEN 'FIXED_PLUS_PERCENT' THEN
      v_prize_pool := COALESCE(v_raffle.fixed_prize_value, 0) + 
                      (v_total_sales * (COALESCE(v_raffle.prize_percent_of_sales, 0) / 100));
  END CASE;

  -- Processar cada faixa de prêmio
  FOR v_tier IN 
    SELECT * FROM prize_tiers 
    WHERE raffle_id = p_raffle_id 
    ORDER BY hits_required DESC
  LOOP
    -- Encontrar ganhadores para esta faixa
    FOR v_winner IN
      SELECT tr.*, t.player_id, t.id as ticket_id, t.eligible_prize_tiers
      FROM ticket_ranking tr
      JOIN tickets t ON t.id = tr.ticket_id
      WHERE tr.raffle_id = p_raffle_id
        AND tr.hits >= v_tier.hits_required
        AND v_tier.id = ANY(t.eligible_prize_tiers)
      ORDER BY tr.rank_position ASC
    LOOP
      -- Calcular prêmio para este ganhador
      IF v_tier.prize_type = 'money' THEN
        v_tier_prize := v_prize_pool * (v_tier.prize_percentage / 100);
      ELSE
        v_tier_prize := 0; -- Prêmio físico
      END IF;

      -- Atualizar status da cartela
      UPDATE tickets SET status = 'winner' WHERE id = v_winner.ticket_id;

      -- Registrar log financeiro (se prêmio em dinheiro)
      IF v_tier.prize_type = 'money' AND v_tier_prize > 0 THEN
        PERFORM log_financial(
          v_raffle.company_id,
          'PRIZE_PAYOUT',
          v_tier_prize,
          v_winner.ticket_id,
          'ticket',
          format('Prêmio %s acertos - Cartela %s', v_tier.hits_required, v_winner.ticket_id)
        );
      END IF;

      -- Adicionar à lista de ganhadores
      v_winners := v_winners || jsonb_build_object(
        'ticket_id', v_winner.ticket_id,
        'player_id', v_winner.player_id,
        'hits', v_winner.hits,
        'tier_id', v_tier.id,
        'prize_type', v_tier.prize_type,
        'prize_value', v_tier_prize,
        'object_description', v_tier.object_description
      );
    END LOOP;
  END LOOP;

  -- Finalizar sorteio
  UPDATE raffles 
  SET status = 'finished', finished_at = NOW()
  WHERE id = p_raffle_id;

  -- Log de auditoria
  PERFORM log_audit(
    v_raffle.company_id,
    NULL,
    NULL,
    'RAFFLE_SETTLED',
    'raffle',
    p_raffle_id,
    jsonb_build_object('total_sales', v_total_sales, 'prize_pool', v_prize_pool, 'winners_count', jsonb_array_length(v_winners))
  );

  RETURN jsonb_build_object(
    'success', true,
    'total_sales', v_total_sales,
    'prize_pool', v_prize_pool,
    'winners', v_winners
  );
END;
$$;

-- RLS para ticket_ranking (leitura pública para ranking)
ALTER TABLE public.ticket_ranking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ranking is viewable by everyone" ON public.ticket_ranking;
CREATE POLICY "Ranking is viewable by everyone"
  ON public.ticket_ranking
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Ranking is managed by system" ON public.ticket_ranking;
CREATE POLICY "Ranking is managed by system"
  ON public.ticket_ranking
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Índices para performance do ranking
CREATE INDEX IF NOT EXISTS idx_ticket_ranking_raffle_position ON ticket_ranking(raffle_id, rank_position);
CREATE INDEX IF NOT EXISTS idx_ticket_ranking_raffle_hits ON ticket_ranking(raffle_id, hits DESC, missing ASC);
CREATE INDEX IF NOT EXISTS idx_draw_numbers_batch ON draw_numbers(draw_batch_id);
CREATE INDEX IF NOT EXISTS idx_tickets_raffle_status ON tickets(raffle_id, status);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  action TEXT NOT NULL,
  attempts INTEGER DEFAULT 1,
  first_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  UNIQUE(identifier, action)
);

-- Índice para limpeza automática
CREATE INDEX IF NOT EXISTS idx_rate_limits_last_attempt ON rate_limits(last_attempt_at);

-- Função de rate limiting
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_identifier TEXT,
  p_action TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window_seconds INTEGER DEFAULT 300,
  p_block_seconds INTEGER DEFAULT 900
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Buscar registro existente
  SELECT * INTO v_record
  FROM rate_limits
  WHERE identifier = p_identifier AND action = p_action
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Primeiro acesso
    INSERT INTO rate_limits (identifier, action)
    VALUES (p_identifier, p_action);
    RETURN TRUE;
  END IF;

  -- Verificar se está bloqueado
  IF v_record.blocked_until IS NOT NULL AND v_record.blocked_until > v_now THEN
    RETURN FALSE;
  END IF;

  -- Verificar se a janela expirou
  IF v_record.first_attempt_at < v_now - (p_window_seconds || ' seconds')::INTERVAL THEN
    -- Reset do contador
    UPDATE rate_limits
    SET attempts = 1, first_attempt_at = v_now, last_attempt_at = v_now, blocked_until = NULL
    WHERE identifier = p_identifier AND action = p_action;
    RETURN TRUE;
  END IF;

  -- Incrementar tentativas
  IF v_record.attempts >= p_max_attempts THEN
    -- Bloquear
    UPDATE rate_limits
    SET blocked_until = v_now + (p_block_seconds || ' seconds')::INTERVAL,
        last_attempt_at = v_now
    WHERE identifier = p_identifier AND action = p_action;
    RETURN FALSE;
  ELSE
    -- Incrementar
    UPDATE rate_limits
    SET attempts = attempts + 1, last_attempt_at = v_now
    WHERE identifier = p_identifier AND action = p_action;
    RETURN TRUE;
  END IF;
END;
$$;

-- Limpar rate limits antigos (pode ser chamado periodicamente)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE last_attempt_at < NOW() - INTERVAL '24 hours';
END;
$$;