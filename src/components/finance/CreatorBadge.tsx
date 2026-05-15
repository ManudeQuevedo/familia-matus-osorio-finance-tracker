import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CreatorBadgeProps = {
  letter: string;
  title?: string;
  className?: string;
};

export function CreatorBadge({ letter, title, className }: CreatorBadgeProps) {
  const ch = letter.slice(0, 1).toUpperCase() || "?";
  const inner = (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent-muted px-1 text-[10px] font-semibold leading-none text-accent",
        className,
      )}>
      {ch}
    </span>
  );
  if (!title) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="top">{title}</TooltipContent>
    </Tooltip>
  );
}
