import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/hooks/use-bet-slip";

type Props = {
  label?: string;
  price: number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
};

export function OddsButton({ label, price, selected, onClick, className }: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col items-center gap-0.5 rounded-md border border-border bg-secondary/60 px-2 py-2 text-center transition-all hover:border-primary/60 hover:bg-secondary",
        selected && "border-primary bg-primary/15 ring-1 ring-primary",
        className,
      )}
    >
      {label && <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>}
      <span className={cn("text-sm font-bold tabular-nums", price > 0 ? "text-primary" : "text-foreground")}>
        {formatPrice(price)}
      </span>
    </button>
  );
}
