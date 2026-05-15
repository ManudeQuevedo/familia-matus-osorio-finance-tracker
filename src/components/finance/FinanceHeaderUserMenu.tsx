"use client";

import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserAvatar } from "@/components/finance/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { signOutAndClearPreferences } from "@/lib/auth/sign-out-client";
import { accountInitials, shortAccountName } from "@/lib/finance/user-display";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function FinanceHeaderUserMenu({
  email,
  fullName,
  avatarUrl,
}: {
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}) {
  const t = useTranslations("Finance.nav.userMenu");
  const tNav = useTranslations("Finance.nav");
  const router = useRouter();

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
            "group flex cursor-pointer items-center gap-2 rounded-full pr-1 text-left text-sm font-medium text-text-primary",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}>
          <span
            className={cn(
              "rounded-full ring-offset-2 ring-offset-background transition-[box-shadow] duration-150 ease-linear",
              "group-hover:ring-2 group-hover:ring-accent",
            )}>
            <UserAvatar avatarUrl={avatarUrl} initials={initials} size="sm" />
          </span>
          <span className="max-w-[7rem] truncate sm:max-w-[10rem]">
            {headerName}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="min-w-[17rem]">
        <div className="flex gap-3 px-2 py-2">
          <UserAvatar
            avatarUrl={avatarUrl}
            initials={initials}
            size="sm"
            className="h-10 w-10 text-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-text-primary">
              {headerName}
            </p>
            {emailLine ? (
              <p className="truncate text-xs text-text-muted">{emailLine}</p>
            ) : null}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex cursor-pointer items-center gap-2 [&_svg]:text-text-muted">
            <span className="min-w-0 flex-1">{t("myProfile")}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/settings#security"
            className="flex cursor-pointer items-center gap-2 [&_svg]:text-text-muted">
            <span className="min-w-0 flex-1">{t("security")}</span>
            <ChevronRight className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={async () => {
            const supabase = createSupabaseBrowserClient();
            await signOutAndClearPreferences(supabase);
            router.replace("/login");
            router.refresh();
          }}>
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
