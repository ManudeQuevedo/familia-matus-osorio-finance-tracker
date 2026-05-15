"use client";

import type { CSSProperties, ReactNode } from "react";

import type { PresentationTheme } from "@/types/presentation";

type Props = {
  theme: PresentationTheme;
  children: ReactNode;
  className?: string;
};

export function PresentationThemeRoot({
  theme,
  children,
  className = "",
}: Props) {
  const bg =
    theme.background.kind === "solid"
      ? theme.background.value
      : theme.background.value;

  const style = {
    ["--pres-bg" as string]: bg,
    ["--pres-surface" as string]: theme.surface,
    ["--pres-text" as string]: theme.textPrimary,
    ["--pres-muted" as string]: theme.textMuted,
    ["--pres-accent" as string]: theme.accent,
    ["--pres-radius" as string]: `${theme.radius}px`,
    ["--pres-font-heading" as string]: theme.fontHeading,
    ["--pres-font-body" as string]: theme.fontBody,
    fontFamily: theme.fontBody,
    color: theme.textPrimary,
    background: bg,
  } as CSSProperties;

  return (
    <div style={style} className={`min-h-0 ${className}`}>
      {children}
    </div>
  );
}
