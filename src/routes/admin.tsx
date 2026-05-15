import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { Shield, Dice5, AlertTriangle } from "lucide-react";
import { formatPrice } from "@/hooks/use-bet-slip";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · Settle bets — PlayBook" }, { name: "description", content: "Test tool to settle pending virtual bets." }] }),
  component: AdminPage,
});

type PendingBet = {
  id: string; selection_label: string; price: number; stake: number;
  potential_payout: number; placed_at: string;
  games: { home_team: string; away_team: string; league: string } | null;
};

type Game = {
  id: string; home_team: string; away_team: string; league: string;
  status: string; winner: string | null; start_time: string;
};

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [bets, setBets] = useState<PendingBet[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [{ data: betsData, error: betsErr }, { data: gamesData, error: gamesErr }] = await Promise.all([
      supabase
        .from("bets")
        .select("id, selection_label, price, stake, potential_payout, placed_at, games(home_team, away_team, league)")
        .eq("status", "pending")
        .order("placed_at", { ascending: false }),
      supabase
        .from("games")
        .select("id, home_team, away_team, league, status, winner, start_time")
        .order("start_time", { ascending: true }),
    ]);
    if (betsErr) toast.error(betsErr.message);
    if (gamesErr) toast.error(gamesErr.message);
    setBets((betsData ?? []) as any);
    setGames((gamesData ?? []) as any);
    setBusy(false);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    void refresh();
  }, [user, loading, navigate, refresh]);

  const settle = async (id: string, outcome: "won" | "lost") => {
    setActing(id);
    const { error } = await supabase.rpc("settle_bet", { p_bet_id: id, p_outcome: outcome });
    setActing(null);
    if (error) return toast.error(error.message);
    toast.success(outcome === "won" ? "Marked won — payout credited" : "Marked lost");
    await refresh();
  };

  const finalize = async (g: Game) => {
    setFinalizing(g.id);
    const { data, error } = await supabase.rpc("finalize_game", { p_game_id: g.id });
    setFinalizing(null);
    if (error) return toast.error(error.message);
    const r = (data ?? {}) as { winner?: string; won?: number; lost?: number; void?: number };
    toast.success(`${r.winner ?? "Winner"} wins · ${r.won ?? 0}W / ${r.lost ?? 0}L / ${r.void ?? 0}V`);
    await refresh();
  };

  const openGames = games.filter((g) => g.status !== "final");
  const finalGames = games.filter((g) => g.status === "final");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Test admin</h1>
          <p className="text-sm text-muted-foreground">Test tool · virtual currency only</p>
        </div>
      </header>

      <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p><strong>Simulated results for testing only.</strong> No real-money gambling. Game outcomes are randomly generated — not from any real sports data.</p>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold">Simulate game results</h2>
        {busy ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : openGames.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No open games to finalize.</div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {openGames.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-semibold">{g.away_team} @ {g.home_team}</div>
                  <div className="text-xs text-muted-foreground">{g.league} · {format(new Date(g.start_time), "MMM d, h:mm a")}</div>
                </div>
                <Button size="sm" disabled={finalizing === g.id} onClick={() => finalize(g)}>
                  <Dice5 className="mr-1.5 h-4 w-4" />
                  {finalizing === g.id ? "Simulating…" : "Simulate result"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {finalGames.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs uppercase tracking-widest text-muted-foreground">Finalized games ({finalGames.length})</summary>
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/60">
              {finalGames.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="text-muted-foreground">{g.away_team} @ {g.home_team}</span>
                  <span className="font-semibold text-success">{g.winner} won</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <h2 className="mb-3 text-lg font-bold">Manually settle a single bet</h2>

      {busy ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : bets.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">No pending bets.</p>
          <Link to="/sportsbook" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Go to sportsbook →</Link>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {bets.map((b) => (
            <li key={b.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold">{b.selection_label}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.games ? `${b.games.away_team} @ ${b.games.home_team} • ${b.games.league}` : "—"}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{format(new Date(b.placed_at), "MMM d, h:mm a")}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-xs text-muted-foreground">Odds</div>
                  <div className="font-bold text-primary">{formatPrice(b.price)}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm tabular-nums">
                  Stake <span className="font-semibold">{Number(b.stake).toLocaleString()}</span> →
                  payout <span className="font-semibold text-success">{Number(b.potential_payout).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={acting === b.id} onClick={() => settle(b.id, "won")}>Mark won</Button>
                  <Button size="sm" variant="secondary" disabled={acting === b.id} onClick={() => settle(b.id, "lost")}>Mark lost</Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}