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
        "group relative flex w-full flex-col items-center gap-0.5 overflow-hidden rounded-lg border border-border/70 bg-secondary/40 px-2 py-2.5 text-center",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/70 hover:bg-secondary/70 hover:shadow-[0_4px_18px_-8px_var(--color-primary)]",
        "active:translate-y-0 active:scale-[0.98]",
        selected && "border-primary bg-primary/15 ring-1 ring-primary shadow-[0_0_20px_-6px_var(--color-primary)]",
        className,
      )}
    >
      {label && <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>}
      <span className={cn("text-sm font-bold tabular-nums transition-colors", price > 0 ? "text-primary" : "text-foreground")}>
        {formatPrice(price)}
      </span>
    </button>
  );
}
