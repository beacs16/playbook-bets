import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, TrendingUp, Flame, Crown, Coins, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — PlayBook" },
      { name: "description", content: "Top virtual sportsbook players: bankroll, ROI, streaks, wins, profit." },
    ],
  }),
  component: Leaderboard,
});

type Entry = { username: string; value: number };
type Boards = {
  bankroll: Entry[] | null;
  roi: Entry[] | null;
  streak: Entry[] | null;
  wins: Entry[] | null;
  profit: Entry[] | null;
};

const TABS: { key: keyof Boards; label: string; icon: any; suffix?: string; format?: (n: number) => string; blurb: string }[] = [
  { key: "bankroll", label: "Bankroll", icon: Coins, format: (n) => Math.round(n).toLocaleString(), blurb: "Biggest virtual stacks" },
  { key: "profit", label: "Profit", icon: TrendingUp, format: (n) => (n >= 0 ? "+" : "") + Math.round(n).toLocaleString(), blurb: "Most profitable bettors" },
  { key: "roi", label: "ROI", icon: Crown, suffix: "%", format: (n) => (n >= 0 ? "+" : "") + n.toFixed(1), blurb: "Best return on stake (min 3 tickets)" },
  { key: "streak", label: "Win Streak", icon: Flame, blurb: "Longest run of wins" },
  { key: "wins", label: "Total Wins", icon: Trophy, blurb: "Most settled winners" },
];

function Leaderboard() {
  const [boards, setBoards] = useState<Boards | null>(null);
  const [tab, setTab] = useState<keyof Boards>("bankroll");

  useEffect(() => {
    void supabase.rpc("get_leaderboards").then(({ data }) => setBoards((data ?? {}) as any));
  }, []);

  const active = TABS.find((t) => t.key === tab)!;
  const list = boards?.[tab] ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-card p-6 shadow-card sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Leaderboard</h1>
            <p className="text-sm text-muted-foreground">Compete for the top spot. Virtual currency only — no real-money gambling.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                isActive
                  ? "border-primary/60 bg-primary/15 text-primary shadow-glow"
                  : "border-border/60 bg-secondary/40 text-foreground/80 hover:border-primary/40 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">{active.blurb}</div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-border/70 bg-gradient-card shadow-card">
        {boards === null ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Medal className="mx-auto mb-3 h-10 w-10 opacity-50" />
            No entries yet. Be the first to claim a spot.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {list.map((e, i) => {
              const rank = i + 1;
              const rankStyle =
                rank === 1 ? "bg-gradient-to-br from-yellow-300 to-amber-500 text-black shadow-glow"
                : rank === 2 ? "bg-gradient-to-br from-slate-200 to-slate-400 text-black"
                : rank === 3 ? "bg-gradient-to-br from-amber-700 to-amber-900 text-white"
                : "bg-secondary text-muted-foreground";
              const value = active.format ? active.format(Number(e.value)) : Math.round(Number(e.value)).toLocaleString();
              return (
                <li
                  key={`${tab}-${i}`}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-secondary/30 animate-fade-in"
                >
                  <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums", rankStyle)}>
                    {rank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">@{e.username}</div>
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{active.label}</div>
                  </div>
                  <div className="text-right text-xl font-extrabold tabular-nums text-primary">
                    {value}{active.suffix ?? ""}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Simulated results for testing only. No real-money gambling.
      </p>
    </div>
  );
}