import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GameCard, type GameWithOdds } from "@/components/app/GameCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export const Route = createFileRoute("/sportsbook")({
  head: () => ({ meta: [{ title: "Sportsbook — PlayBook" }, { name: "description", content: "Browse upcoming games and place virtual bets across NBA, NFL, EPL, MLB, NHL." }] }),
  component: Sportsbook,
});

function Sportsbook() {
  const [sport, setSport] = useState<string>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["sportsbook"],
    queryFn: async (): Promise<GameWithOdds[]> => {
      const { data: games, error } = await supabase
        .from("games")
        .select("id, sport, league, home_team, away_team, start_time, odds(id, market, selection, label, price)")
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (games ?? []) as any;
    },
  });

  const sports = ["All", ...Array.from(new Set((data ?? []).map((g) => g.sport)))];
  const filtered = (data ?? []).filter((g) => sport === "All" || g.sport === sport);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sportsbook</h1>
          <p className="text-sm text-muted-foreground">Tap any odds to add it to your bet slip.</p>
        </div>
      </header>

      {sports.length > 1 && (
        <Tabs value={sport} onValueChange={setSport} className="mb-6">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 bg-secondary/50">
            {sports.map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">No games available.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      )}
    </div>
  );
}
