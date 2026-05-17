import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Coins, History, TrendingUp, User as UserIcon, Layers } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/hooks/use-bet-slip";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — PlayBook" }, { name: "description", content: "Your bankroll, stats, and bet history." }] }),
  component: Profile,
});

type Profile = { username: string | null; balance: number; created_at: string };
type Bet = {
  id: string; selection_label: string; price: number; stake: number;
  potential_payout: number; status: string; placed_at: string;
  games: { home_team: string; away_team: string; league: string } | null;
};
type ParlayLeg = {
  id: string; selection_label: string; price: number; status: string;
  games: { home_team: string; away_team: string; league: string } | null;
};
type Parlay = {
  id: string; stake: number; combined_decimal_odds: number;
  potential_payout: number; status: string; placed_at: string;
  parlay_legs: ParlayLeg[];
};

function Profile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [parlays, setParlays] = useState<Parlay[]>([]);
  const [busy, setBusy] = useState(true);
  const [settling, setSettling] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    void refresh();
  }, [user, loading, navigate]);

  const refresh = async () => {
    if (!user) return;
    const [{ data: p }, { data: b }, { data: pl }] = await Promise.all([
      supabase.from("profiles").select("username, balance, created_at").eq("user_id", user.id).maybeSingle(),
      supabase.from("bets").select("id, selection_label, price, stake, potential_payout, status, placed_at, games(home_team, away_team, league)").order("placed_at", { ascending: false }),
      supabase.from("parlays").select("id, stake, combined_decimal_odds, potential_payout, status, placed_at, parlay_legs(id, selection_label, price, status, games(home_team, away_team, league))").order("placed_at", { ascending: false }),
    ]);
    setProfile(p as any);
    setBets((b ?? []) as any);
    setParlays((pl ?? []) as any);
    setBusy(false);
  };

  const settle = async (id: string, outcome: "won" | "lost" | "void") => {
    setSettling(id);
    const { error } = await supabase.rpc("settle_bet", { p_bet_id: id, p_outcome: outcome });
    setSettling(null);
    if (error) return toast.error(error.message);
    toast.success(`Bet marked ${outcome}`);
    await refresh();
  };

  if (loading || busy) {
    return <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>;
  }

  const totalStaked = bets.reduce((s, b) => s + Number(b.stake), 0)
    + parlays.reduce((s, p) => s + Number(p.stake), 0);
  const pending = bets.filter((b) => b.status === "pending").length
    + parlays.filter((p) => p.status === "pending").length;

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-accent/20 text-accent border-accent/40",
      won: "bg-success/20 text-success border-success/40",
      lost: "bg-destructive/20 text-destructive border-destructive/40",
      void: "bg-muted text-muted-foreground border-border",
    };
    return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase ${map[s] ?? map.void}`}>{s}</span>;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-card p-6 shadow-card sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
              <UserIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">@{profile?.username ?? "player"}</h1>
              <p className="text-sm text-muted-foreground">Joined {profile && format(new Date(profile.created_at), "MMM d, yyyy")}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-primary/40 bg-primary/10 px-6 py-4 text-right backdrop-blur">
            <div className="text-[10px] uppercase tracking-[0.18em] text-primary/80">Bankroll</div>
            <div className="flex items-center gap-2 text-3xl font-bold text-primary tabular-nums">
              <Coins className="h-6 w-6" />
              {Number(profile?.balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        <div className="relative mt-6 grid grid-cols-3 gap-3">
          <Stat icon={History} label="Bets placed" value={bets.length.toString()} />
          <Stat icon={TrendingUp} label="Pending" value={pending.toString()} />
          <Stat icon={Coins} label="Total staked" value={totalStaked.toLocaleString()} />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-bold tracking-tight">Bet history</h2>
        {bets.length === 0 && parlays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center">
            <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No bets yet.</p>
            <Link to="/sportsbook" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">Browse the sportsbook →</Link>
          </div>
        ) : (
          <>
          {parlays.length > 0 && (
            <div className="mb-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-card shadow-card">
              <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" /> Parlays
              </div>
              <ul className="divide-y divide-border/60">
                {parlays.map((p) => (
                  <li key={p.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{p.parlay_legs.length}-leg parlay</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {format(new Date(p.placed_at), "MMM d, h:mm a")} · {Number(p.combined_decimal_odds).toFixed(2)}x
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Stake → Payout</div>
                          <div className="font-bold tabular-nums">
                            {Number(p.stake).toLocaleString()}
                            <span className="text-muted-foreground"> → </span>
                            <span className="text-primary">{Number(p.potential_payout).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                        </div>
                        {statusBadge(p.status)}
                      </div>
                    </div>
                    <ul className="mt-3 space-y-1.5 rounded-lg bg-secondary/30 p-3">
                      {p.parlay_legs.map((leg) => (
                        <li key={leg.id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{leg.selection_label}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {leg.games ? `${leg.games.away_team} @ ${leg.games.home_team}` : "—"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary tabular-nums">{formatPrice(leg.price)}</span>
                            {statusBadge(leg.status)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {bets.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-card shadow-card">
            <ul className="divide-y divide-border/60">
              {bets.map((b, i) => (
                <li
                  key={b.id}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 p-4 transition-colors hover:bg-secondary/30 animate-fade-in sm:grid-cols-[2fr_1fr_1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{b.selection_label}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.games ? `${b.games.away_team} @ ${b.games.home_team} • ${b.games.league}` : "—"}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">{format(new Date(b.placed_at), "MMM d, h:mm a")}</div>
                  </div>
                  <div className="hidden text-sm sm:block">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Odds</div>
                    <div className="font-bold text-primary tabular-nums">{formatPrice(b.price)}</div>
                  </div>
                  <div className="hidden text-right text-sm sm:block">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Stake → Payout</div>
                    <div className="font-bold tabular-nums">{Number(b.stake).toLocaleString()} <span className="text-muted-foreground">→</span> <span className="text-primary">{Number(b.potential_payout).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                  </div>
                  <div className="text-right">{statusBadge(b.status)}</div>
                  {b.status === "pending" && (
                    <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-4 sm:justify-end">
                      <span className="mr-auto text-[11px] uppercase tracking-widest text-muted-foreground sm:mr-2 sm:self-center">Test settle</span>
                      <Button size="sm" variant="secondary" disabled={settling === b.id} onClick={() => settle(b.id, "won")}>Win</Button>
                      <Button size="sm" variant="secondary" disabled={settling === b.id} onClick={() => settle(b.id, "lost")}>Loss</Button>
                      <Button size="sm" variant="ghost" disabled={settling === b.id} onClick={() => settle(b.id, "void")}>Void</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          )}
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/30 p-3 transition-all hover:border-primary/40 hover:bg-secondary/50">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
