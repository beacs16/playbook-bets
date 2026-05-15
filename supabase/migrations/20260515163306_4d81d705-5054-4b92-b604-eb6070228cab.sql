-- Allow balance changes by the owner (still scoped to own row); bankroll integrity is enforced by SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.settle_bet(p_bet_id uuid, p_outcome text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_bet RECORD;
  v_balance NUMERIC;
  v_credit NUMERIC := 0;
  v_txn_type TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_outcome NOT IN ('won','lost','void') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;

  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id AND user_id = v_user FOR UPDATE;
  IF v_bet IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF v_bet.status <> 'pending' THEN RAISE EXCEPTION 'Bet already settled'; END IF;

  IF p_outcome = 'won' THEN
    v_credit := v_bet.potential_payout;
    v_txn_type := 'bet_won';
  ELSIF p_outcome = 'void' THEN
    v_credit := v_bet.stake;
    v_txn_type := 'bet_void';
  ELSE
    v_txn_type := 'bet_lost';
  END IF;

  UPDATE public.bets SET status = p_outcome, settled_at = now() WHERE id = p_bet_id;

  IF v_credit > 0 THEN
    SELECT balance INTO v_balance FROM public.profiles WHERE user_id = v_user FOR UPDATE;
    UPDATE public.profiles SET balance = balance + v_credit WHERE user_id = v_user;
    INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id)
    VALUES (v_user, v_txn_type, v_credit, v_balance + v_credit, p_bet_id);
  ELSE
    SELECT balance INTO v_balance FROM public.profiles WHERE user_id = v_user;
    INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id)
    VALUES (v_user, v_txn_type, 0, v_balance, p_bet_id);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_bet(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_bet(uuid, text) TO authenticated;
