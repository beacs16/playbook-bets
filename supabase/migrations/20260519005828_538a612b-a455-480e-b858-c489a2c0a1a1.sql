
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS external_id text UNIQUE;
ALTER TABLE public.odds ADD COLUMN IF NOT EXISTS external_id text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_games_external_id ON public.games(external_id);
CREATE INDEX IF NOT EXISTS idx_odds_external_id ON public.odds(external_id);
