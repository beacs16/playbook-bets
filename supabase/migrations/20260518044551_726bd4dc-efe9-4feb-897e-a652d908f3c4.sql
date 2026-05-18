
-- Unified per-user stats helper
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_bets INT := 0;
  v_wins INT := 0;
  v_losses INT := 0;
  v_voids INT := 0;
  v_pending INT := 0;
  v_staked NUMERIC := 0;
  v_returned NUMERIC := 0;
  v_avg_stake NUMERIC := 0;
  v_fav_sport TEXT;
  v_current_streak INT := 0;
  v_best_streak INT := 0;
  v_balance NUMERIC := 0;
  v_username TEXT;
  v_run INT := 0;
  v_best INT := 0;
  v_cur INT := 0;
  v_first_done BOOLEAN := FALSE;
  r RECORD;
BEGIN
  SELECT username, balance INTO v_username, v_balance
  FROM public.profiles WHERE user_id = p_user_id;

  -- Aggregate singles + parlays into a unified ticket view
  WITH tickets AS (
    SELECT status, stake,
           CASE WHEN status = 'won' THEN potential_payout
                WHEN status = 'void' THEN stake
                ELSE 0 END AS returned,
           placed_at, settled_at
    FROM public.bets WHERE user_id = p_user_id
    UNION ALL
    SELECT status, stake,
           CASE WHEN status = 'won' THEN potential_payout
                WHEN status = 'void' THEN stake
                ELSE 0 END AS returned,
           placed_at, settled_at
    FROM public.parlays WHERE user_id = p_user_id
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'won'),
    COUNT(*) FILTER (WHERE status = 'lost'),
    COUNT(*) FILTER (WHERE status = 'void'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COALESCE(SUM(stake), 0),
    COALESCE(SUM(returned), 0),
    COALESCE(AVG(stake), 0)
  INTO v_total_bets, v_wins, v_losses, v_voids, v_pending, v_staked, v_returned, v_avg_stake
  FROM tickets;

  -- Favorite sport (by ticket count across singles + parlay legs)
  SELECT sport INTO v_fav_sport FROM (
    SELECT g.sport, COUNT(*) AS c
    FROM public.bets b JOIN public.games g ON g.id = b.game_id
    WHERE b.user_id = p_user_id
    GROUP BY g.sport
    UNION ALL
    SELECT g.sport, COUNT(*) AS c
    FROM public.parlay_legs pl
    JOIN public.parlays p ON p.id = pl.parlay_id
    JOIN public.games g ON g.id = pl.game_id
    WHERE p.user_id = p_user_id
    GROUP BY g.sport
  ) s
  GROUP BY sport
  ORDER BY SUM(c) DESC
  LIMIT 1;

  -- Streaks across settled tickets ordered most recent first
  FOR r IN
    SELECT status FROM (
      SELECT status, COALESCE(settled_at, placed_at) AS t
      FROM public.bets WHERE user_id = p_user_id AND status IN ('won','lost')
      UNION ALL
      SELECT status, COALESCE(settled_at, placed_at) AS t
      FROM public.parlays WHERE user_id = p_user_id AND status IN ('won','lost')
    ) z
    ORDER BY t DESC
  LOOP
    IF NOT v_first_done THEN
      -- current streak: count consecutive matching results from most recent
      v_cur := 1;
      v_first_done := TRUE;
    END IF;
    -- compute best win streak going backwards in time (chronological reversed is fine for max run length)
    IF r.status = 'won' THEN
      v_run := v_run + 1;
      IF v_run > v_best THEN v_best := v_run; END IF;
    ELSE
      v_run := 0;
    END IF;
  END LOOP;
  v_best_streak := v_best;

  -- current streak: from most-recent settled ticket, count consecutive same-result entries
  v_cur := 0;
  DECLARE
    v_last TEXT;
  BEGIN
    FOR r IN
      SELECT status FROM (
        SELECT status, COALESCE(settled_at, placed_at) AS t
        FROM public.bets WHERE user_id = p_user_id AND status IN ('won','lost')
        UNION ALL
        SELECT status, COALESCE(settled_at, placed_at) AS t
        FROM public.parlays WHERE user_id = p_user_id AND status IN ('won','lost')
      ) z
      ORDER BY t DESC
    LOOP
      IF v_last IS NULL THEN v_last := r.status; END IF;
      IF r.status = v_last THEN
        v_cur := v_cur + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
    v_current_streak := CASE WHEN v_last = 'won' THEN v_cur
                             WHEN v_last = 'lost' THEN -v_cur
                             ELSE 0 END;
  END;

  RETURN jsonb_build_object(
    'username', v_username,
    'balance', v_balance,
    'total_bets', v_total_bets,
    'wins', v_wins,
    'losses', v_losses,
    'voids', v_voids,
    'pending', v_pending,
    'total_staked', v_staked,
    'total_returned', v_returned,
    'profit', v_returned - v_staked,
    'roi', CASE WHEN v_staked > 0 THEN round(((v_returned - v_staked) / v_staked) * 100, 2) ELSE 0 END,
    'avg_stake', round(v_avg_stake, 2),
    'favorite_sport', v_fav_sport,
    'current_streak', v_current_streak,
    'best_streak', v_best_streak
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO anon, authenticated;

-- Leaderboards: returns top 20 per category, public username + stat only
CREATE OR REPLACE FUNCTION public.get_leaderboards()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH tickets AS (
    SELECT user_id, status, stake,
           CASE WHEN status = 'won' THEN potential_payout
                WHEN status = 'void' THEN stake
                ELSE 0 END AS returned,
           COALESCE(settled_at, placed_at) AS t
    FROM public.bets
    UNION ALL
    SELECT user_id, status, stake,
           CASE WHEN status = 'won' THEN potential_payout
                WHEN status = 'void' THEN stake
                ELSE 0 END AS returned,
           COALESCE(settled_at, placed_at) AS t
    FROM public.parlays
  ),
  agg AS (
    SELECT
      p.user_id,
      COALESCE(p.username, 'player') AS username,
      p.balance,
      COUNT(t.*) AS total_bets,
      COUNT(*) FILTER (WHERE t.status = 'won') AS wins,
      COALESCE(SUM(t.stake), 0) AS staked,
      COALESCE(SUM(t.returned), 0) AS returned
    FROM public.profiles p
    LEFT JOIN tickets t ON t.user_id = p.user_id
    GROUP BY p.user_id, p.username, p.balance
  ),
  streaks AS (
    SELECT user_id, MAX(run) AS best_streak FROM (
      SELECT user_id,
             COUNT(*) AS run
      FROM (
        SELECT user_id, status, t,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY t)
             - ROW_NUMBER() OVER (PARTITION BY user_id, status ORDER BY t) AS grp
        FROM tickets
        WHERE status IN ('won','lost')
      ) x
      WHERE status = 'won'
      GROUP BY user_id, grp
    ) y
    GROUP BY user_id
  ),
  full_agg AS (
    SELECT a.*, COALESCE(s.best_streak, 0) AS best_streak,
           a.returned - a.staked AS profit,
           CASE WHEN a.staked > 0 THEN round(((a.returned - a.staked) / a.staked) * 100, 2) ELSE 0 END AS roi
    FROM agg a LEFT JOIN streaks s ON s.user_id = a.user_id
  )
  SELECT jsonb_build_object(
    'bankroll', (SELECT jsonb_agg(jsonb_build_object('username', username, 'value', balance) ORDER BY balance DESC)
                 FROM (SELECT username, balance FROM full_agg ORDER BY balance DESC LIMIT 20) z),
    'roi', (SELECT jsonb_agg(jsonb_build_object('username', username, 'value', roi) ORDER BY roi DESC)
            FROM (SELECT username, roi FROM full_agg WHERE total_bets >= 3 ORDER BY roi DESC LIMIT 20) z),
    'streak', (SELECT jsonb_agg(jsonb_build_object('username', username, 'value', best_streak) ORDER BY best_streak DESC)
               FROM (SELECT username, best_streak FROM full_agg WHERE best_streak > 0 ORDER BY best_streak DESC LIMIT 20) z),
    'wins', (SELECT jsonb_agg(jsonb_build_object('username', username, 'value', wins) ORDER BY wins DESC)
             FROM (SELECT username, wins FROM full_agg WHERE wins > 0 ORDER BY wins DESC LIMIT 20) z),
    'profit', (SELECT jsonb_agg(jsonb_build_object('username', username, 'value', profit) ORDER BY profit DESC)
               FROM (SELECT username, profit FROM full_agg WHERE total_bets > 0 ORDER BY profit DESC LIMIT 20) z)
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboards() TO anon, authenticated;
