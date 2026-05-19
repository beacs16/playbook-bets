import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SPORTS = [
  { key: "basketball_nba", sport: "Basketball", league: "NBA" },
  { key: "americanfootball_nfl", sport: "Football", league: "NFL" },
  { key: "baseball_mlb", sport: "Baseball", league: "MLB" },
  { key: "icehockey_nhl", sport: "Hockey", league: "NHL" },
] as const;

const CACHE_TTL_MS = 5 * 60 * 1000;
let lastSyncAt = 0;
let inflight: Promise<{ synced: number; source: string }> | null = null;

type ApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    markets: Array<{
      key: "h2h" | "spreads" | "totals";
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
};

function toAmerican(price: number): number {
  // The Odds API returns american when oddsFormat=american
  return Math.round(price);
}

async function fetchSport(key: string, apiKey: string): Promise<ApiEvent[]> {
  const url = `https://api.the-odds-api.com/v4/sports/${key}/odds/?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american&dateFormat=iso`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Odds API ${key} failed [${res.status}]: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as ApiEvent[];
}

async function syncOnce(): Promise<{ synced: number; source: string }> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("ODDS_API_KEY is not configured");

  let totalGames = 0;

  for (const s of SPORTS) {
    let events: ApiEvent[] = [];
    try {
      events = await fetchSport(s.key, apiKey);
    } catch (e) {
      console.error("[odds-api] sport fetch failed", s.key, e);
      continue;
    }

    for (const ev of events) {
      const gameExt = `odds-api:${ev.id}`;
      const { data: gameRow, error: gErr } = await supabaseAdmin
        .from("games")
        .upsert(
          {
            external_id: gameExt,
            sport: s.sport,
            league: s.league,
            home_team: ev.home_team,
            away_team: ev.away_team,
            start_time: ev.commence_time,
            status: "scheduled",
          },
          { onConflict: "external_id" },
        )
        .select("id")
        .single();
      if (gErr || !gameRow) {
        console.error("[odds-api] upsert game failed", ev.id, gErr);
        continue;
      }
      totalGames++;

      const book = ev.bookmakers?.[0];
      if (!book) continue;

      const rows: Array<{
        external_id: string;
        game_id: string;
        market: string;
        selection: string;
        label: string;
        price: number;
      }> = [];

      for (const m of book.markets ?? []) {
        if (m.key === "h2h") {
          for (const o of m.outcomes) {
            const side = o.name === ev.home_team ? "home" : "away";
            rows.push({
              external_id: `${gameExt}:moneyline:${side}`,
              game_id: gameRow.id,
              market: "moneyline",
              selection: side,
              label: `${o.name} ML`,
              price: toAmerican(o.price),
            });
          }
        } else if (m.key === "spreads") {
          for (const o of m.outcomes) {
            const side = o.name === ev.home_team ? "home" : "away";
            const pt = o.point ?? 0;
            rows.push({
              external_id: `${gameExt}:spread:${side}`,
              game_id: gameRow.id,
              market: "spread",
              selection: side,
              label: `${o.name} ${pt > 0 ? "+" : ""}${pt}`,
              price: toAmerican(o.price),
            });
          }
        } else if (m.key === "totals") {
          for (const o of m.outcomes) {
            const side = o.name.toLowerCase() === "over" ? "over" : "under";
            const pt = o.point ?? 0;
            rows.push({
              external_id: `${gameExt}:total:${side}`,
              game_id: gameRow.id,
              market: "total",
              selection: side,
              label: `${side === "over" ? "O" : "U"} ${pt}`,
              price: toAmerican(o.price),
            });
          }
        }
      }

      if (rows.length) {
        const { error: oErr } = await supabaseAdmin
          .from("odds")
          .upsert(rows, { onConflict: "external_id" });
        if (oErr) console.error("[odds-api] upsert odds failed", ev.id, oErr);
      }
    }
  }

  return { synced: totalGames, source: "the-odds-api" };
}

export const syncLiveOdds = createServerFn({ method: "POST" }).handler(async () => {
  const now = Date.now();
  if (now - lastSyncAt < CACHE_TTL_MS) {
    return { cached: true, ageMs: now - lastSyncAt };
  }
  if (inflight) {
    const r = await inflight;
    return { cached: false, ...r };
  }
  inflight = syncOnce()
    .then((r) => {
      lastSyncAt = Date.now();
      return r;
    })
    .finally(() => {
      inflight = null;
    });
  try {
    const r = await inflight;
    return { cached: false, ...r };
  } catch (e: any) {
    return { cached: false, error: e?.message ?? "sync failed" };
  }
});

// ===== Scores sync =====
const SCORES_TTL_MS = 30 * 1000;
let lastScoresAt = 0;
let scoresInflight: Promise<{ updated: number; settled: number; lastUpdated: string }> | null = null;

type ApiScoreEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: Array<{ name: string; score: string }> | null;
  last_update: string | null;
};

async function fetchScores(key: string, apiKey: string): Promise<ApiScoreEvent[]> {
  const url = `https://api.the-odds-api.com/v4/sports/${key}/scores/?apiKey=${apiKey}&daysFrom=3`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Scores API ${key} [${res.status}]: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as ApiScoreEvent[];
}

async function scoresOnce() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) throw new Error("ODDS_API_KEY is not configured");

  let updated = 0;
  let settled = 0;

  for (const s of SPORTS) {
    let events: ApiScoreEvent[] = [];
    try {
      events = await fetchScores(s.key, apiKey);
    } catch (e) {
      console.error("[scores] fetch failed", s.key, e);
      continue;
    }

    for (const ev of events) {
      const ext = `odds-api:${ev.id}`;
      const home = ev.scores?.find((x) => x.name === ev.home_team);
      const away = ev.scores?.find((x) => x.name === ev.away_team);
      const homeScore = home ? Number(home.score) : null;
      const awayScore = away ? Number(away.score) : null;

      const { data: gameRow, error: gErr } = await supabaseAdmin
        .from("games")
        .update({
          home_score: homeScore,
          away_score: awayScore,
          last_score_update: new Date().toISOString(),
          status: ev.completed ? "final" : undefined,
        })
        .eq("external_id", ext)
        .neq("status", "final")
        .select("id, status, home_team, away_team")
        .maybeSingle();

      if (gErr) {
        console.error("[scores] update failed", ev.id, gErr);
        continue;
      }
      if (!gameRow) continue;
      updated++;

      if (ev.completed && homeScore != null && awayScore != null && homeScore !== awayScore) {
        const winner = homeScore > awayScore ? ev.home_team : ev.away_team;
        const { error: sErr } = await supabaseAdmin.rpc("settle_game_by_winner", {
          p_game_id: gameRow.id,
          p_winner: winner,
        });
        if (sErr) {
          console.error("[scores] settle failed", ev.id, sErr);
        } else {
          settled++;
        }
      }
    }
  }

  return { updated, settled, lastUpdated: new Date().toISOString() };
}

export const syncLiveScores = createServerFn({ method: "POST" }).handler(async () => {
  const now = Date.now();
  if (now - lastScoresAt < SCORES_TTL_MS) {
    return { cached: true, ageMs: now - lastScoresAt, lastUpdated: new Date(lastScoresAt).toISOString() };
  }
  if (scoresInflight) {
    const r = await scoresInflight;
    return { cached: false, ...r };
  }
  scoresInflight = scoresOnce()
    .then((r) => {
      lastScoresAt = Date.now();
      return r;
    })
    .finally(() => {
      scoresInflight = null;
    });
  try {
    const r = await scoresInflight;
    return { cached: false, ...r };
  } catch (e: any) {
    return { cached: false, error: e?.message ?? "scores sync failed", lastUpdated: new Date().toISOString() };
  }
});