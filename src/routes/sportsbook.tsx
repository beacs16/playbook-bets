import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { syncLiveOdds } from "@/lib/odds-api.functions";
import { supabase } from "@/integrations/supabase/client";
import { GameCard, type GameWithOdds } from "@/components/app/GameCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/sportsbook")({
  head: () => ({ meta: [{ title: "Sportsbook — PlayBook" }, { name: "description", content: "Browse upcoming games and place virtual bets across NBA, NFL, EPL, MLB, NHL." }] }),
  component: Sportsbook,
});

function Sportsbook() {
  const [sport, setSport] = useState<string>("All");
  const [demoMode, setDemoMode] = useState(false);
  const sync = useServerFn(syncLiveOdds);

  const syncQ = useQuery({
    queryKey: ["odds-sync"],
    queryFn: () => sync(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sportsbook", syncQ.dataUpdatedAt],
    enabled: !syncQ.isLoading,
    queryFn: async (): Promise<GameWithOdds[]> => {
      const { data: games, error } = await supabase
        .from("games")
        .select("id, sport, league, home_team, away_team, start_time, home_logo_url, away_logo_url, external_id, odds(id, market, selection, label, price)")
        .eq("status", "scheduled")
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (games ?? []) as any;
    },
  });

  const now = Date.now();
  const visible = (data ?? []).filter((g) => {
    const isLive =
      !!g.external_id &&
      g.external_id.startsWith("odds-api:") &&
      !!g.start_time &&
      !isNaN(new Date(g.start_time).getTime()) &&
      new Date(g.start_time).getTime() > now;
    return demoMode ? !isLive : isLive;
  });
  const sports = ["All", ...Array.from(new Set(visible.map((g) => g.sport)))];
  const filtered = visible.filter((g) => sport === "All" || g.sport === sport);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          {demoMode ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
              Demo Mode · Simulated Games
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary">
              <TrendingUp className="h-3 w-3" /> Live Odds · The Odds API
            </div>
          )}
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Sportsbook</h1>
          <p className="text-sm text-muted-foreground">
            {demoMode
              ? "Simulated test games — not real matchups. Virtual currency only."
              : "Real upcoming NBA, NFL, MLB & NHL games. Virtual currency only — no real-money gambling."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5">
            <Switch id="demo-mode" checked={demoMode} onCheckedChange={setDemoMode} />
            <Label htmlFor="demo-mode" className="text-xs font-semibold uppercase tracking-wider cursor-pointer">Demo Mode</Label>
          </div>
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            <div className="font-bold text-foreground">{filtered.length} games</div>
            <div>{sport === "All" ? "All sports" : sport}</div>
          </div>
        </div>
      </header>

      {syncQ.isError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Live odds feed unavailable</div>
            <div className="opacity-80">Showing previously cached games. We'll retry shortly.</div>
          </div>
        </div>
      )}

      {sports.length > 1 && (
        <Tabs value={sport} onValueChange={setSport} className="mb-6">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-secondary/40 p-1 backdrop-blur">
            {sports.map((s) => (
              <TabsTrigger
                key={s}
                value={s}
                className="rounded-md px-4 font-semibold transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-glow"
              >
                {s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl animate-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-12 text-center text-muted-foreground">No games available.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((g, i) => (
            <div key={g.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-slide-up">
              <GameCard game={g} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
