import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, Coins, LineChart, ShieldCheck, Trophy, Zap, Target, TrendingUp } from "lucide-react";

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
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-card p-6 hover-lift hover:border-primary/40">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl transition-opacity group-hover:bg-primary/15" />
      <div className="relative mb-4 grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30 transition-transform group-hover:scale-110 group-hover:rotate-3">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="relative text-base font-bold tracking-tight">{title}</h3>
      <p className="relative mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function Home() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-24">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px]" style={{ background: "var(--gradient-hero)" }} />

      <section className="text-center animate-fade-in">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-primary backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Virtual currency only · No real money
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
          Bet sharp.
          <br />
          <span className="text-gradient-primary">Risk nothing.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          A free-to-play sportsbook simulator. Claim <span className="font-bold text-foreground">10,000 virtual coins</span> and place fake bets on real-style markets to sharpen your edge.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/signup">
            <Button size="lg" className="group w-full bg-gradient-primary font-bold text-primary-foreground shadow-glow transition-all hover:shadow-[0_0_50px_-8px_var(--color-primary)] sm:w-auto">
              Claim 10,000 coins
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link to="/sportsbook">
            <Button size="lg" variant="secondary" className="w-full border border-border hover:border-primary/40 sm:w-auto">
              Browse games
            </Button>
          </Link>
        </div>

        {/* Floating stat chips */}
        <div className="mx-auto mt-12 flex flex-wrap items-center justify-center gap-3 text-xs">
          {[
            { icon: Trophy, label: "5 leagues" },
            { icon: Target, label: "ML · Spread · Totals" },
            { icon: TrendingUp, label: "Live bankroll" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-muted-foreground backdrop-blur">
              <Icon className="h-3.5 w-3.5 text-primary" /> {label}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24 grid gap-4 sm:grid-cols-3">
        <Feature icon={Coins} title="10,000 virtual coins" body="Every new account starts with a fat virtual bankroll. No deposits, ever." />
        <Feature icon={LineChart} title="Real-style markets" body="Moneyline, spread, and totals on sample games across major leagues." />
        <Feature icon={ShieldCheck} title="Zero real money" body="No payments. No crypto. No withdrawals. Just betting fundamentals for fun." />
      </section>

      <section className="mt-20 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-card p-8 text-center sm:p-12">
        <Zap className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to test your instincts?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Sign up in seconds. No card, no commitment, just strategy.</p>
        <Link to="/signup" className="mt-6 inline-block">
          <Button size="lg" className="bg-gradient-primary font-bold text-primary-foreground shadow-glow">Start playing free</Button>
        </Link>
      </section>
    </div>
  );
}
