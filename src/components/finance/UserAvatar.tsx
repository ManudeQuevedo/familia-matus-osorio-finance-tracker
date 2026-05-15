"use client";

import { cn } from "@/lib/utils";

export function UserAvatar({
  avatarUrl,
  initials,
  size = "md",
  className,
  onClick,
}: {
  avatarUrl: string | null;
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}) {
  const sizeClass =
    size === "sm"
      ? "h-9 w-9 text-sm"
      : size === "lg"
        ? "h-20 w-20 text-2xl"
        : "h-10 w-10 text-sm";

  const sharedClass = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-muted font-semibold text-accent",
    sizeClass,
    onClick &&
      "cursor-pointer ring-offset-2 transition hover:ring-2 hover:ring-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Change profile photo"
        className={sharedClass}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </button>
    );
  }

  return (
    <div className={sharedClass}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}
