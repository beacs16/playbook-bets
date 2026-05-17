ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS home_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS away_logo_url TEXT;