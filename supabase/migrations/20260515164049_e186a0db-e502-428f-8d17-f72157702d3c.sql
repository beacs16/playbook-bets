ALTER TABLE public.games ADD COLUMN IF NOT EXISTS winner TEXT;

CREATE OR REPLACE FUNCTION public.finalize_game(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_game RECORD;
  v_winner TEXT;
  v_winning_side TEXT;
  v_bet RECORD;
  v_balance NUMERIC;
  v_credit NUMERIC;
  v_outcome TEXT;
  v_txn_type TEXT;
  v_won INT := 0;
  v_lost INT := 0;
  v_void INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_game FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF v_game IS NULL THEN RAISE EXCEPTION 'Game not found'; END IF;
  IF v_game.status = 'final' THEN RAISE EXCEPTION 'Game already finalized'; END IF;

  -- Random winner
  IF random() < 0.5 THEN
    v_winner := v_game.home_team;
    v_winning_side := 'home';
  ELSE
    v_winner := v_game.away_team;
    v_winning_side := 'away';
  END IF;

  UPDATE public.games SET status = 'final', winner = v_winner WHERE id = p_game_id;

  FOR v_bet IN
    SELECT b.*, o.market, o.selection
    FROM public.bets b
    JOIN public.odds o ON o.id = b.odds_id
    WHERE b.game_id = p_game_id AND b.status = 'pending'
    FOR UPDATE OF b
  LOOP
    IF v_bet.market = 'moneyline' THEN
      IF v_bet.selection = v_winning_side THEN
        v_outcome := 'won'; v_credit := v_bet.potential_payout; v_txn_type := 'bet_won';
        v_won := v_won + 1;
      ELSE
        v_outcome := 'lost'; v_credit := 0; v_txn_type := 'bet_lost';
        v_lost := v_lost + 1;
      END IF;
    ELSE
      -- No simulated scores for spreads/totals — void and refund stake
      v_outcome := 'void'; v_credit := v_bet.stake; v_txn_type := 'bet_void';
      v_void := v_void + 1;
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

  RETURN jsonb_build_object('winner', v_winner, 'won', v_won, 'lost', v_lost, 'void', v_void);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_game(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_game(uuid) TO authenticated;
