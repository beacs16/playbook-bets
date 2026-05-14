import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type SlipPick = {
  oddsId: string;
  gameId: string;
  matchup: string;
  label: string;
  price: number;
};

type Ctx = {
  picks: SlipPick[];
  add: (p: SlipPick) => void;
  remove: (oddsId: string) => void;
  clear: () => void;
  has: (oddsId: string) => boolean;
};

const BetSlipContext = createContext<Ctx>({
  picks: [], add: () => {}, remove: () => {}, clear: () => {}, has: () => false,
});

const KEY = "betslip:v1";

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [picks, setPicks] = useState<SlipPick[]>([]);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setPicks(JSON.parse(raw)); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch {}
  }, [picks]);

  return (
    <BetSlipContext.Provider value={{
      picks,
      add: (p) => setPicks((cur) => cur.find(x => x.oddsId === p.oddsId) ? cur : [...cur, p]),
      remove: (id) => setPicks((cur) => cur.filter(x => x.oddsId !== id)),
      clear: () => setPicks([]),
      has: (id) => picks.some(x => x.oddsId === id),
    }}>
      {children}
    </BetSlipContext.Provider>
  );
}

export const useBetSlip = () => useContext(BetSlipContext);

export const formatPrice = (p: number) => (p > 0 ? `+${p}` : `${p}`);
export const calcPayout = (stake: number, price: number) =>
  price > 0 ? stake + (stake * price) / 100 : stake + (stake * 100) / Math.abs(price);
