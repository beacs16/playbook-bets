import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Coins, LineChart, ShieldCheck, Trophy } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PlayBook — Free Virtual Sportsbook" },
      { name: "description", content: "Practice sports betting with 10,000 free virtual coins. No real money, no risk — just strategy and stats." },
    ],
  }),
  component: Home,
});

function Feature({ icon: Icon, title, body }: any) {
  return (
    <div className="rounded-2xl border border-border bg-card/70 p-6">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-20">
      <section className="text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <Trophy className="h-3.5 w-3.5" /> Virtual currency only
        </div>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Bet sharp. <span className="text-primary">Risk nothing.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          PlayBook is a free-to-play sportsbook simulator. Sign up, claim your 10,000 virtual coins, and place fake bets on real-style markets to sharpen your edge.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/signup"><Button size="lg" className="w-full sm:w-auto">Claim 10,000 coins <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          <Link to="/sportsbook"><Button size="lg" variant="secondary" className="w-full sm:w-auto">Browse games</Button></Link>
        </div>
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-3">
        <Feature icon={Coins} title="10,000 virtual coins" body="Every new account starts with a fat virtual bankroll. No deposits, ever." />
        <Feature icon={LineChart} title="Real-style markets" body="Moneyline, spread, and totals on sample games across major leagues." />
        <Feature icon={ShieldCheck} title="Zero real money" body="No payments. No crypto. No withdrawals. Just betting fundamentals for fun." />
      </section>
    </div>
  );
}
