
-- Helper: American odds -> decimal odds
CREATE OR REPLACE FUNCTION public.american_to_decimal(p_price integer)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_price > 0 THEN 1 + p_price::numeric / 100
    ELSE 1 + 100::numeric / abs(p_price)
  END
$$;

-- Parlays
CREATE TABLE public.parlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  stake NUMERIC NOT NULL,
  combined_decimal_odds NUMERIC NOT NULL,
  potential_payout NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
ALTER TABLE public.parlays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own parlays" ON public.parlays FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE public.parlay_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parlay_id UUID NOT NULL REFERENCES public.parlays(id) ON DELETE CASCADE,
  odds_id UUID NOT NULL REFERENCES public.odds(id),
  game_id UUID NOT NULL REFERENCES public.games(id),
  selection_label TEXT NOT NULL,
  price INTEGER NOT NULL,
  market TEXT NOT NULL,
  selection TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  settled_at TIMESTAMPTZ
);
ALTER TABLE public.parlay_legs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own parlay legs" ON public.parlay_legs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.parlays p WHERE p.id = parlay_id AND p.user_id = auth.uid())
);

CREATE INDEX idx_parlay_legs_parlay ON public.parlay_legs(parlay_id);
CREATE INDEX idx_parlay_legs_game ON public.parlay_legs(game_id);

-- Place parlay
CREATE OR REPLACE FUNCTION public.place_parlay(p_odds_ids uuid[], p_stake numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_balance NUMERIC;
  v_combined NUMERIC := 1;
  v_payout NUMERIC;
  v_parlay_id UUID;
  v_odds RECORD;
  v_count INT;
  v_games INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;
  IF p_odds_ids IS NULL OR array_length(p_odds_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Parlay needs at least 2 selections';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT game_id) INTO v_count, v_games
  FROM public.odds WHERE id = ANY(p_odds_ids);
  IF v_count <> array_length(p_odds_ids, 1) THEN
    RAISE EXCEPTION 'Invalid selection';
  END IF;
  IF v_games <> v_count THEN
    RAISE EXCEPTION 'Parlay legs must be from different games';
  END IF;

  SELECT balance INTO v_balance FROM public.profiles WHERE user_id = v_user FOR UPDATE;
  IF v_balance < p_stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  FOR v_odds IN SELECT * FROM public.odds WHERE id = ANY(p_odds_ids) LOOP
    v_combined := v_combined * public.american_to_decimal(v_odds.price);
  END LOOP;

  v_payout := round(p_stake * v_combined, 2);

  UPDATE public.profiles SET balance = balance - p_stake WHERE user_id = v_user;

  INSERT INTO public.parlays (user_id, stake, combined_decimal_odds, potential_payout)
  VALUES (v_user, p_stake, v_combined, v_payout)
  RETURNING id INTO v_parlay_id;

  INSERT INTO public.parlay_legs (parlay_id, odds_id, game_id, selection_label, price, market, selection)
  SELECT v_parlay_id, o.id, o.game_id, o.label, o.price, o.market, o.selection
  FROM public.odds o WHERE o.id = ANY(p_odds_ids);

  INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (v_user, 'parlay_placed', -p_stake, v_balance - p_stake, v_parlay_id);

  RETURN v_parlay_id;
END;
$$;

-- Updated finalize_game: also settle parlay legs and resolve parlays
CREATE OR REPLACE FUNCTION public.finalize_game(p_game_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_game RECORD;
  v_winner TEXT;
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
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_game FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF v_game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF v_game.status = 'final' THEN RAISE EXCEPTION 'Game already finalized'; END IF;

  IF random() < 0.5 THEN
    v_winner := v_game.home_team; v_winning_side := 'home';
  ELSE
    v_winner := v_game.away_team; v_winning_side := 'away';
  END IF;

  UPDATE public.games SET status = 'final', winner = v_winner WHERE id = p_game_id;

  -- Settle single bets
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

  -- Settle parlay legs for this game
  v_parlays_touched := ARRAY[]::uuid[];
  FOR v_leg IN
    SELECT * FROM public.parlay_legs
    WHERE game_id = p_game_id AND status = 'pending'
    FOR UPDATE
  LOOP
    IF v_leg.market = 'moneyline' THEN
      IF v_leg.selection = v_winning_side THEN v_outcome := 'won';
      ELSE v_outcome := 'lost';
      END IF;
    ELSE
      v_outcome := 'void';
    END IF;

    UPDATE public.parlay_legs SET status = v_outcome, settled_at = now() WHERE id = v_leg.id;
    IF NOT (v_leg.parlay_id = ANY(v_parlays_touched)) THEN
      v_parlays_touched := array_append(v_parlays_touched, v_leg.parlay_id);
    END IF;
  END LOOP;

  -- Resolve parlays that had legs touched
  FOREACH v_parlay.id IN ARRAY v_parlays_touched LOOP
    SELECT * INTO v_parlay FROM public.parlays WHERE id = v_parlay.id AND status = 'pending' FOR UPDATE;
    CONTINUE WHEN v_parlay.id IS NULL;

    SELECT
      COUNT(*) FILTER (WHERE status = 'pending'),
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
        -- Recompute combined decimal odds over won legs (void legs => 1.0)
        SELECT COALESCE(EXP(SUM(LN(public.american_to_decimal(price)))), 1)
        INTO v_p_decimal
        FROM public.parlay_legs
        WHERE parlay_id = v_parlay.id AND status = 'won';
        v_p_payout := round(v_parlay.stake * v_p_decimal, 2);
        v_p_status := 'won'; v_p_credit := v_p_payout;
        UPDATE public.parlays SET combined_decimal_odds = v_p_decimal, potential_payout = v_p_payout
        WHERE id = v_parlay.id;
      END IF;
    ELSE
      CONTINUE; -- still pending
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

  RETURN jsonb_build_object('winner', v_winner, 'won', v_won, 'lost', v_lost, 'void', v_void);
END;
$$;
