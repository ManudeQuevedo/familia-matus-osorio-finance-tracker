import { cn } from "@/lib/utils";

/** Full-width main content area with standard app padding (1rem mobile, 2rem desktop). */
export function FinancePageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("w-full min-w-0 flex-1 p-4 md:p-8", className)}>
      {children}
    </main>
  );
}
