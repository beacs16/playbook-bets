
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS home_score integer,
  ADD COLUMN IF NOT EXISTS away_score integer,
  ADD COLUMN IF NOT EXISTS last_score_update timestamptz;

CREATE OR REPLACE FUNCTION public.settle_game_by_winner(p_game_id uuid, p_winner text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game RECORD;
  v_winning_side TEXT;
  v_bet RECORD;
  v_leg RECORD;
  v_balance NUMERIC;
  v_credit NUMERIC;
  v_outcome TEXT;
  v_txn_type TEXT;
  v_won INT := 0;
  v_lost INT := 0;
  v_void INT := 0;
  v_parlay RECORD;
  v_p_status TEXT;
  v_p_credit NUMERIC;
  v_p_decimal NUMERIC;
  v_p_payout NUMERIC;
  v_pending_legs INT;
  v_lost_legs INT;
  v_won_legs INT;
  v_parlays_touched uuid[];
BEGIN
  SELECT * INTO v_game FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF v_game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF v_game.status = 'final' THEN
    RETURN jsonb_build_object('already_final', true);
  END IF;

  IF p_winner = v_game.home_team THEN v_winning_side := 'home';
  ELSIF p_winner = v_game.away_team THEN v_winning_side := 'away';
  ELSE RAISE EXCEPTION 'Winner does not match either team';
  END IF;

  UPDATE public.games SET status = 'final', winner = p_winner WHERE id = p_game_id;

  FOR v_bet IN
    SELECT b.*, o.market, o.selection
    FROM public.bets b JOIN public.odds o ON o.id = b.odds_id
    WHERE b.game_id = p_game_id AND b.status = 'pending'
    FOR UPDATE OF b
  LOOP
    IF v_bet.market = 'moneyline' THEN
      IF v_bet.selection = v_winning_side THEN
        v_outcome := 'won'; v_credit := v_bet.potential_payout; v_txn_type := 'bet_won'; v_won := v_won + 1;
      ELSE
        v_outcome := 'lost'; v_credit := 0; v_txn_type := 'bet_lost'; v_lost := v_lost + 1;
      END IF;
    ELSE
      v_outcome := 'void'; v_credit := v_bet.stake; v_txn_type := 'bet_void'; v_void := v_void + 1;
    END IF;

    UPDATE public.bets SET status = v_outcome, settled_at = now() WHERE id = v_bet.id;

    IF v_credit > 0 THEN
      SELECT balance INTO v_balance FROM public.profiles WHERE user_id = v_bet.user_id FOR UPDATE;
      UPDATE public.profiles SET balance = balance + v_credit WHERE user_id = v_bet.user_id;
      INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id)
      VALUES (v_bet.user_id, v_txn_type, v_credit, v_balance + v_credit, v_bet.id);
    ELSE
      SELECT balance INTO v_balance FROM public.profiles WHERE user_id = v_bet.user_id;
      INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id)
      VALUES (v_bet.user_id, v_txn_type, 0, v_balance, v_bet.id);
    END IF;
  END LOOP;

  v_parlays_touched := ARRAY[]::uuid[];
  FOR v_leg IN
    SELECT * FROM public.parlay_legs
    WHERE game_id = p_game_id AND status = 'pending'
    FOR UPDATE
  LOOP
    IF v_leg.market = 'moneyline' THEN
      IF v_leg.selection = v_winning_side THEN v_outcome := 'won'; ELSE v_outcome := 'lost'; END IF;
    ELSE
      v_outcome := 'void';
    END IF;
    UPDATE public.parlay_legs SET status = v_outcome, settled_at = now() WHERE id = v_leg.id;
    IF NOT (v_leg.parlay_id = ANY(v_parlays_touched)) THEN
      v_parlays_touched := array_append(v_parlays_touched, v_leg.parlay_id);
    END IF;
  END LOOP;

  FOREACH v_parlay.id IN ARRAY v_parlays_touched LOOP
    SELECT * INTO v_parlay FROM public.parlays WHERE id = v_parlay.id AND status = 'pending' FOR UPDATE;
    CONTINUE WHEN v_parlay.id IS NULL;

    SELECT COUNT(*) FILTER (WHERE status = 'pending'),
           COUNT(*) FILTER (WHERE status = 'lost'),
           COUNT(*) FILTER (WHERE status = 'won')
    INTO v_pending_legs, v_lost_legs, v_won_legs
    FROM public.parlay_legs WHERE parlay_id = v_parlay.id;

    IF v_lost_legs > 0 THEN
      v_p_status := 'lost'; v_p_credit := 0;
    ELSIF v_pending_legs = 0 THEN
      IF v_won_legs = 0 THEN
        v_p_status := 'void'; v_p_credit := v_parlay.stake;
      ELSE
        SELECT COALESCE(EXP(SUM(LN(public.american_to_decimal(price)))), 1) INTO v_p_decimal
        FROM public.parlay_legs WHERE parlay_id = v_parlay.id AND status = 'won';
        v_p_payout := round(v_parlay.stake * v_p_decimal, 2);
        v_p_status := 'won'; v_p_credit := v_p_payout;
        UPDATE public.parlays SET combined_decimal_odds = v_p_decimal, potential_payout = v_p_payout
        WHERE id = v_parlay.id;
      END IF;
    ELSE
      CONTINUE;
    END IF;

    UPDATE public.parlays SET status = v_p_status, settled_at = now() WHERE id = v_parlay.id;

    SELECT balance INTO v_balance FROM public.profiles WHERE user_id = v_parlay.user_id FOR UPDATE;
    IF v_p_credit > 0 THEN
      UPDATE public.profiles SET balance = balance + v_p_credit WHERE user_id = v_parlay.user_id;
      INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id)
      VALUES (v_parlay.user_id, 'parlay_' || v_p_status, v_p_credit, v_balance + v_p_credit, v_parlay.id);
    ELSE
      INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id)
      VALUES (v_parlay.user_id, 'parlay_' || v_p_status, 0, v_balance, v_parlay.id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('winner', p_winner, 'won', v_won, 'lost', v_lost, 'void', v_void);
END;
$$;
