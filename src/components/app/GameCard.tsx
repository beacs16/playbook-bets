import { OddsButton } from "./OddsButton";
import { useBetSlip, type SlipPick } from "@/hooks/use-bet-slip";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export type GameWithOdds = {
  id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
  home_logo_url?: string | null;
  away_logo_url?: string | null;
  external_id?: string | null;
  status?: string | null;
  home_score?: number | null;
  away_score?: number | null;
  odds: { id: string; market: string; selection: string; label: string; price: number }[];
};

export function GameCard({ game }: { game: GameWithOdds }) {
  const { add, remove, has } = useBetSlip();
  const matchup = `${game.away_team} @ ${game.home_team}`;
  const isLive = !!game.external_id && game.external_id.startsWith("odds-api:");
  const hasScore = game.home_score != null && game.away_score != null;
  const isFinal = game.status === "final";
  const inProgress = hasScore && !isFinal && new Date(game.start_time).getTime() <= Date.now();

  const get = (market: string, selection: string) =>
    game.odds.find((o) => o.market === market && o.selection === selection);

  const toggle = (oId?: { id: string; label: string; price: number }) => {
    if (!oId) return;
    if (has(oId.id)) return remove(oId.id);
    const pick: SlipPick = {
      oddsId: oId.id, gameId: game.id, matchup, label: oId.label, price: oId.price,
    };
    add(pick);
  };

  const Row = ({ team, side }: { team: string; side: "home" | "away" }) => {
    const ml = get("moneyline", side);
    const sp = get("spread", side);
    const tot = get("total", side === "home" ? "over" : "under");
    const logo = side === "home" ? game.home_logo_url : game.away_logo_url;
    const score = side === "home" ? game.home_score : game.away_score;
    return (
      <div className="grid grid-cols-[1fr_repeat(3,_minmax(0,72px))] items-center gap-2 py-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {logo ? (
            <img src={logo} alt="" loading="lazy" className="h-7 w-7 shrink-0 object-contain" />
          ) : (
            <div className="h-7 w-7 shrink-0 rounded-full bg-secondary/60" />
          )}
          <span className="truncate font-medium">{team}</span>
          {hasScore && (
            <span className="ml-auto pr-1 text-sm font-bold tabular-nums text-foreground">{score}</span>
          )}
        </div>
        <OddsButton label="Spread" price={sp?.price ?? 0} selected={sp ? has(sp.id) : false}
          onClick={() => toggle(sp)} />
        <OddsButton label="Total" price={tot?.price ?? 0} selected={tot ? has(tot.id) : false}
          onClick={() => toggle(tot)} />
        <OddsButton label="ML" price={ml?.price ?? 0} selected={ml ? has(ml.id) : false}
          onClick={() => toggle(ml)} />
      </div>
    );
  };

  return (
    <article className="group overflow-hidden rounded-2xl border border-border/70 bg-gradient-card shadow-card hover-lift hover:border-primary/40 animate-fade-in">
      <header className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold tracking-wide">{game.league}</Badge>
          <span className="text-muted-foreground uppercase text-[10px] tracking-widest">{game.sport}</span>
          {isLive ? (
            <Badge className="rounded-full bg-success/15 text-success border border-success/30 text-[10px] font-bold uppercase tracking-widest">● Live Odds</Badge>
          ) : (
            <Badge className="rounded-full bg-accent/15 text-accent border border-accent/30 text-[10px] font-bold uppercase tracking-widest">Demo / Simulated</Badge>
          )}
          {inProgress && (
            <Badge className="rounded-full bg-destructive/15 text-destructive border border-destructive/30 text-[10px] font-bold uppercase tracking-widest animate-pulse">● Live</Badge>
          )}
          {isFinal && (
            <Badge className="rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-bold uppercase tracking-widest">Final</Badge>
          )}
        </div>
        <time className="text-xs font-medium text-muted-foreground tabular-nums">
          {format(new Date(game.start_time), "EEE, MMM d • h:mm a")}
        </time>
      </header>
      <div className="px-4 py-1">
        <Row team={game.away_team} side="away" />
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <Row team={game.home_team} side="home" />
      </div>
    </article>
  );
}
