"use client";

import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher({
  variant = "default",
}: {
  variant?: "default" | "onDark";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = useLocale();
  const query = searchParams.toString();
  const suffix = query ? `?${query}` : "";

  const shellClass =
    variant === "onDark"
      ? "border-white/20 bg-white/[0.15]"
      : "border-border-default";

  const activeClass =
    variant === "onDark"
      ? "bg-white/25 font-semibold text-white"
      : "bg-zinc-900 text-white dark:bg-bg-card-hover dark:text-text-primary";

  const idleClass =
    variant === "onDark"
      ? "text-white/50 hover:text-white/80"
      : "text-text-muted hover:text-text-primary dark:text-text-muted hover:text-text-primary";

  return (
    <div
      className={`flex items-center gap-1 rounded-full border p-1 ${shellClass}`}
      role="group"
      aria-label="Language">
      {routing.locales.map((loc) => (
        <Link
          key={loc}
          href={`${pathname}${suffix}`}
          locale={loc}
          className={`rounded-full px-2 py-0.5 text-xs font-medium transition ${
            loc === active ? activeClass : idleClass
          }`}
          aria-current={loc === active ? "true" : undefined}>
          {loc.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
