import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Coins, Menu, Receipt, Trophy, User as UserIcon, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useBetSlip } from "@/hooks/use-bet-slip";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";

export function Header() {
  const { user, signOut } = useAuth();
  const { picks } = useBetSlip();
  const [balance, setBalance] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { setBalance(null); return; }
    let cancel = false;
    const load = async () => {
      const { data } = await supabase.from("profiles").select("balance").eq("user_id", user.id).maybeSingle();
      if (!cancel) setBalance(data?.balance ?? null);
    };
    load();
    const ch = supabase
      .channel(`profile:${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
          (payload) => setBalance((payload.new as any).balance))
      .subscribe();
    return () => { cancel = true; supabase.removeChannel(ch); };
  }, [user]);

  const navLinks = (
    <>
      <Link to="/sportsbook" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Sportsbook</Link>
      <Link to="/bet-slip" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Bet Slip</Link>
      <Link to="/profile" className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Profile</Link>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-glow transition-transform hover:scale-105">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="leading-none">
            <div className="text-lg font-bold tracking-tight">Play<span className="text-primary">Book</span></div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Virtual Sportsbook</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">{navLinks}</nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <div className="hidden items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-sm font-bold text-primary sm:flex tabular-nums transition-all hover:bg-primary/15 hover:shadow-glow">
                <Coins className="h-4 w-4" />
                {balance !== null ? balance.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
              </div>
              <Link to="/bet-slip" className="relative">
                <Button variant="secondary" size="icon" aria-label="Bet slip" className="hover:border-primary/50">
                  <Receipt className="h-4 w-4" />
                </Button>
                {picks.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground animate-glow-pulse">
                    {picks.length}
                  </span>
                )}
              </Link>
              <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate({ to: "/" }); }} className="hidden md:inline-flex" aria-label="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm">Log in</Button></Link>
              <Link to="/signup"><Button size="sm">Sign up</Button></Link>
            </>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-8 flex flex-col gap-4 text-base">
                {user && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-primary font-semibold">
                    <Coins className="h-4 w-4" /> {balance?.toLocaleString() ?? "—"} coins
                  </div>
                )}
                {navLinks}
                {user ? (
                  <Button variant="secondary" onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                    <LogOut className="mr-2 h-4 w-4" />Sign out
                  </Button>
                ) : (
                  <>
                    <Link to="/login"><Button variant="secondary" className="w-full">Log in</Button></Link>
                    <Link to="/signup"><Button className="w-full">Sign up</Button></Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
