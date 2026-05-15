import { getTranslations } from "next-intl/server";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Link } from "@/i18n/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const t = await getTranslations("Nav");
  let user: { email?: string | null } | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    user = sessionUser;
  } catch {
    user = null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border-default bg-bg-sidebar shadow-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-text-primary">
          {t("brand")}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-text-secondary dark:text-text-muted">
          <Link
            href="/"
            className="transition hover:text-text-primary hover:text-text-primary">
            {t("home")}
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="transition hover:text-text-primary hover:text-text-primary">
                {t("dashboard")}
              </Link>
              <Link
                href="/settings/security"
                className="transition hover:text-text-primary hover:text-text-primary">
                {t("security")}
              </Link>
              <SignOutButton label={t("signOut")} />
            </>
          ) : null}
          <span className="hidden h-4 w-px bg-zinc-200 sm:block bg-bg-card-hover" />
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
