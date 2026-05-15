"use client";

import { LogOut, Settings } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/finance/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettingsModal } from "@/contexts/settings-modal-context";
import { useRouter } from "@/i18n/navigation";
import { signOutAndClearPreferences } from "@/lib/auth/sign-out-client";
import { accountInitials, shortAccountName } from "@/lib/finance/user-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function FinanceHeaderUserMenu({
  email,
  fullName,
  avatarUrl,
  compact = false,
}: {
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  /** Avatar only (e.g. mobile top bar next to hamburger). */
  compact?: boolean;
}) {
  const t = useTranslations("Finance.nav.userMenu");
  const tNav = useTranslations("Finance.nav");
  const router = useRouter();
  const { openSettings } = useSettingsModal();

  const initials = accountInitials(fullName, email);
  const headerName = shortAccountName(fullName, email, tNav("you"));

  const emailLine = email ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-haspopup="menu"
          aria-label={t("openMenu")}
          className={cn(
            "group flex cursor-pointer items-center gap-2 rounded-full text-left text-sm font-medium text-text-primary",
            !compact && "pr-1",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}>
          <span
            className={cn(
              "rounded-full ring-offset-2 ring-offset-background transition-shadow duration-150 ease-linear",
              "group-hover:ring-2 group-hover:ring-accent",
            )}>
            <UserAvatar avatarUrl={avatarUrl} initials={initials} size="sm" />
          </span>
          {compact ? null : (
            <span className="max-w-28 truncate sm:max-w-40">{headerName}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-56">
        {emailLine ? (
          <>
            <div className="px-3 py-2">
              <p className="truncate text-xs text-muted-foreground">
                {emailLine}
              </p>
            </div>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onSelect={() => openSettings("perfil")}>
          <Settings className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-500 data-highlighted:text-red-500"
          onSelect={async () => {
            const supabase = createSupabaseBrowserClient();
            await signOutAndClearPreferences(supabase);
            router.replace("/login");
            router.refresh();
          }}>
          <LogOut className="mr-2 h-4 w-4 shrink-0" aria-hidden />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
