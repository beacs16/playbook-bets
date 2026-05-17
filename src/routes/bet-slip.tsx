import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Receipt, Layers } from "lucide-react";
import {
  calcPayout, formatPrice, useBetSlip,
  americanToDecimal, formatDecimalAsAmerican,
} from "@/hooks/use-bet-slip";
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
  const [mode, setMode] = useState<"single" | "parlay">("single");
  const [parlayStake, setParlayStake] = useState("10");

  const stakeFor = (id: string) => Number(stakes[id] ?? "10") || 0;

  const uniqueGameIds = useMemo(() => new Set(picks.map((p) => p.gameId)), [picks]);
  const parlayEligible = picks.length >= 2 && uniqueGameIds.size === picks.length;

  const combinedDecimal = useMemo(
    () => picks.reduce((acc, p) => acc * americanToDecimal(p.price), 1),
    [picks],
  );
  const parlayStakeNum = Number(parlayStake) || 0;
  const parlayPayout = parlayStakeNum * combinedDecimal;
  const parlayProfit = parlayPayout - parlayStakeNum;

  const placeAll = async () => {
    if (!user) return navigate({ to: "/login" });
    if (picks.length === 0) return;
    if (mode === "parlay") {
      if (!parlayEligible) {
        return toast.error("Parlay needs 2+ legs from different games");
      }
      if (parlayStakeNum <= 0) return toast.error("Enter a stake");
      setSubmitting(true);
      const { error } = await supabase.rpc("place_parlay", {
        p_odds_ids: picks.map((p) => p.oddsId),
        p_stake: parlayStakeNum,
      });
      setSubmitting(false);
      if (error) return toast.error(error.message);
      toast.success(`Parlay placed · ${picks.length} legs`);
      clear();
      navigate({ to: "/profile" });
      return;
    }
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
    <div className="mx-auto max-w-2xl px-4 py-8 animate-fade-in">
      <header className="mb-6 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30 shadow-glow">
          <Receipt className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bet Slip</h1>
          <p className="text-sm text-muted-foreground">{picks.length} selection{picks.length === 1 ? "" : "s"}</p>
        </div>
      </header>

      {picks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">Your slip is empty.</p>
          <Link to="/sportsbook" className="mt-4 inline-block">
            <Button className="bg-gradient-primary text-primary-foreground shadow-glow">Find games</Button>
          </Link>
        </div>
      ) : (
        <>
          {picks.length >= 2 && (
            <div className="mb-4 inline-flex rounded-xl border border-border/70 bg-secondary/40 p-1">
              <button
                onClick={() => setMode("single")}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${mode === "single" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
              >
                Singles
              </button>
              <button
                onClick={() => setMode("parlay")}
                disabled={!parlayEligible}
                title={!parlayEligible ? "Parlay requires legs from different games" : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${mode === "parlay" ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Layers className="h-3.5 w-3.5" /> Parlay
              </button>
            </div>
          )}

          <div className="space-y-3">
            {picks.map((p, i) => {
              const stake = stakeFor(p.oddsId);
              const payout = calcPayout(stake, p.price);
              return (
                <div
                  key={p.oddsId}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="rounded-2xl border border-border/70 bg-gradient-card p-4 shadow-card animate-slide-up hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{p.matchup}</div>
                      <div className="font-semibold">{p.label}</div>
                      <div className="mt-0.5 text-sm font-bold text-primary tabular-nums">{formatPrice(p.price)}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.oddsId)} aria-label="Remove" className="hover:bg-destructive/15 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {mode === "single" && (
                  <div className="mt-3 grid grid-cols-2 items-end gap-3">
                    <div>
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Stake (coins)</label>
                      <Input
                        type="number" min={1} inputMode="numeric"
                        value={stakes[p.oddsId] ?? "10"}
                        onChange={(e) => setStakes((s) => ({ ...s, [p.oddsId]: e.target.value }))}
                        className="mt-1 tabular-nums font-semibold focus-visible:ring-primary"
                      />
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">To win</div>
                      <div className="text-xl font-bold text-primary tabular-nums">
                        {(payout - stake).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">Payout {payout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                  </div>
                  )}
                </div>
              );
            })}
          </div>

          {mode === "parlay" && (
            <div className="mt-4 rounded-2xl border border-primary/30 bg-gradient-card p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">{picks.length}-leg parlay</span>
                </div>
                <span className="text-sm font-bold text-primary tabular-nums">
                  {formatDecimalAsAmerican(combinedDecimal)} ({combinedDecimal.toFixed(2)}x)
                </span>
              </div>
              <div className="grid grid-cols-2 items-end gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">Parlay stake</label>
                  <Input
                    type="number" min={1} inputMode="numeric"
                    value={parlayStake}
                    onChange={(e) => setParlayStake(e.target.value)}
                    className="mt-1 tabular-nums font-semibold focus-visible:ring-primary"
                  />
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">To win</div>
                  <div className="text-xl font-bold text-primary tabular-nums">
                    {parlayProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">Payout {parlayPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">All legs must win for the parlay to pay. Spread/total legs are voided when games are simulated.</p>
            </div>
          )}

          <div className="sticky bottom-3 mt-6 rounded-2xl border border-primary/30 glass p-4 shadow-glow">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Total stake</span>
              <span className="font-bold tabular-nums">
                {(mode === "parlay" ? parlayStakeNum : picks.reduce((sum, p) => sum + stakeFor(p.oddsId), 0)).toLocaleString()} coins
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={clear} className="flex-1">Clear</Button>
              <Button onClick={placeAll} className="flex-[2] bg-gradient-primary font-bold text-primary-foreground shadow-glow disabled:opacity-60" disabled={submitting}>
                {submitting
                  ? "Placing…"
                  : !user
                  ? "Log in to bet"
                  : mode === "parlay"
                  ? `Place ${picks.length}-leg parlay`
                  : `Place ${picks.length} bet${picks.length > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
