import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Receipt } from "lucide-react";
import { calcPayout, formatPrice, useBetSlip } from "@/hooks/use-bet-slip";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/bet-slip")({
  head: () => ({ meta: [{ title: "Bet Slip — PlayBook" }, { name: "description", content: "Review and place your virtual bets." }] }),
  component: BetSlipPage,
});

function BetSlipPage() {
  const { picks, remove, clear } = useBetSlip();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stakes, setStakes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const stakeFor = (id: string) => Number(stakes[id] ?? "10") || 0;

  const placeAll = async () => {
    if (!user) return navigate({ to: "/login" });
    if (picks.length === 0) return;
    setSubmitting(true);
    let placed = 0;
    for (const p of picks) {
      const stake = stakeFor(p.oddsId);
      if (stake <= 0) continue;
      const { error } = await supabase.rpc("place_bet", { p_odds_id: p.oddsId, p_stake: stake });
      if (error) { toast.error(`${p.label}: ${error.message}`); continue; }
      placed++;
    }
    setSubmitting(false);
    if (placed > 0) {
      toast.success(`Placed ${placed} bet${placed > 1 ? "s" : ""}`);
      clear();
      navigate({ to: "/profile" });
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
          <Receipt className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Bet Slip</h1>
          <p className="text-sm text-muted-foreground">{picks.length} selection{picks.length === 1 ? "" : "s"}</p>
        </div>
      </header>

      {picks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-muted-foreground">Your slip is empty.</p>
          <Link to="/sportsbook" className="mt-4 inline-block">
            <Button>Find games</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {picks.map((p) => {
              const stake = stakeFor(p.oddsId);
              const payout = calcPayout(stake, p.price);
              return (
                <div key={p.oddsId} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{p.matchup}</div>
                      <div className="font-semibold">{p.label}</div>
                      <div className="mt-0.5 text-sm font-bold text-primary">{formatPrice(p.price)}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.oddsId)} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 items-end gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Stake (coins)</label>
                      <Input
                        type="number" min={1} inputMode="numeric"
                        value={stakes[p.oddsId] ?? "10"}
                        onChange={(e) => setStakes((s) => ({ ...s, [p.oddsId]: e.target.value }))}
                        className="mt-1"
                      />
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">To win</div>
                      <div className="text-lg font-bold text-primary">
                        {(payout - stake).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Payout {payout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-3 mt-6 rounded-xl border border-primary/30 bg-card/95 p-4 backdrop-blur">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total stake</span>
              <span className="font-bold">
                {picks.reduce((sum, p) => sum + stakeFor(p.oddsId), 0).toLocaleString()} coins
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={clear} className="flex-1">Clear</Button>
              <Button onClick={placeAll} className="flex-[2]" disabled={submitting}>
                {submitting ? "Placing…" : user ? "Place bets" : "Log in to bet"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
