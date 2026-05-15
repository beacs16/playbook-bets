import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { Shield } from "lucide-react";
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

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [bets, setBets] = useState<PendingBet[]>([]);
  const [busy, setBusy] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("bets")
      .select("id, selection_label, price, stake, potential_payout, placed_at, games(home_team, away_team, league)")
      .eq("status", "pending")
      .order("placed_at", { ascending: false });
    if (error) toast.error(error.message);
    setBets((data ?? []) as any);
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Settle bets</h1>
          <p className="text-sm text-muted-foreground">Test tool · virtual currency only</p>
        </div>
      </header>

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