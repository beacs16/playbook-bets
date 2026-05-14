
-- Profiles table (bankroll)
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  balance NUMERIC NOT NULL DEFAULT 10000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Games table
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view games" ON public.games FOR SELECT USING (true);

-- Odds table
CREATE TABLE public.odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  market TEXT NOT NULL, -- moneyline, spread, total
  selection TEXT NOT NULL, -- home, away, over, under
  label TEXT NOT NULL, -- display label e.g. "Lakers -3.5"
  price INTEGER NOT NULL, -- american odds e.g. -110, +145
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.odds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view odds" ON public.odds FOR SELECT USING (true);
CREATE INDEX odds_game_idx ON public.odds(game_id);

-- Bets table
CREATE TABLE public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  odds_id UUID NOT NULL REFERENCES public.odds(id),
  game_id UUID NOT NULL REFERENCES public.games(id),
  selection_label TEXT NOT NULL,
  price INTEGER NOT NULL,
  stake NUMERIC NOT NULL CHECK (stake > 0),
  potential_payout NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, won, lost, void
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own bets" ON public.bets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own bets" ON public.bets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX bets_user_idx ON public.bets(user_id);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- signup_bonus, bet_placed, bet_won, bet_refund
  amount NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX tx_user_idx ON public.transactions(user_id);

-- Trigger: auto-create profile + signup bonus on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, balance)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)), 10000);
  INSERT INTO public.transactions (user_id, type, amount, balance_after)
  VALUES (NEW.id, 'signup_bonus', 10000, 10000);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC: place a bet atomically (decrement balance, insert bet + tx)
CREATE OR REPLACE FUNCTION public.place_bet(
  p_odds_id UUID,
  p_stake NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_balance NUMERIC;
  v_price INTEGER;
  v_game UUID;
  v_label TEXT;
  v_payout NUMERIC;
  v_bet_id UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_stake <= 0 THEN RAISE EXCEPTION 'Stake must be positive'; END IF;

  SELECT price, game_id, label INTO v_price, v_game, v_label
  FROM public.odds WHERE id = p_odds_id;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Odds not found'; END IF;

  SELECT balance INTO v_balance FROM public.profiles WHERE user_id = v_user FOR UPDATE;
  IF v_balance < p_stake THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  -- american odds payout (stake returned + profit)
  IF v_price > 0 THEN
    v_payout := p_stake + p_stake * v_price / 100.0;
  ELSE
    v_payout := p_stake + p_stake * 100.0 / abs(v_price);
  END IF;

  UPDATE public.profiles SET balance = balance - p_stake WHERE user_id = v_user;

  INSERT INTO public.bets (user_id, odds_id, game_id, selection_label, price, stake, potential_payout)
  VALUES (v_user, p_odds_id, v_game, v_label, v_price, p_stake, v_payout)
  RETURNING id INTO v_bet_id;

  INSERT INTO public.transactions (user_id, type, amount, balance_after, reference_id)
  VALUES (v_user, 'bet_placed', -p_stake, v_balance - p_stake, v_bet_id);

  RETURN v_bet_id;
END;
$$;
