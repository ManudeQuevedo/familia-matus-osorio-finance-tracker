import { redirect } from "next/navigation";

import {
  FinanceAppShell,
  type FinanceShellUser,
} from "@/components/finance/FinanceAppShell";
import { SettingsModalHost } from "@/components/finance/SettingsModal";
import { PageTransition } from "@/components/motion/PageTransition";
import { SettingsModalProvider } from "@/contexts/settings-modal-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ToastHooksBridge } from "@/components/providers/ToastHooksBridge";
import {
  ProfileThemeBootstrap,
  type ThemePreference,
} from "@/components/providers/ThemeProvider";
import { AiChatProvider } from "@/components/providers/AiChatProvider";
import { UserPreferencesProvider } from "@/components/providers/UserPreferencesProvider";
import { normalizeAccentColor } from "@/lib/finance/accent";
import { fetchSettingsSnapshot } from "@/lib/finance/settings-queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppGroupLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
    redirect(`/${locale}/login?next=/${locale}/dashboard`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, preferred_theme, accent_color")
    .eq("id", user.id)
    .maybeSingle();

  const shellUser: FinanceShellUser = {
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  };

  const initialTheme =
    (profile?.preferred_theme as ThemePreference | undefined) ?? "system";

  const initialAccent = normalizeAccentColor(profile?.accent_color);

  const localeTag = locale === "en" ? "en" : "es";
  const { data: settingsSnapshot, error: settingsLoadError } =
    await fetchSettingsSnapshot(supabase, user.id, localeTag);

  return (
    <QueryProvider>
      <ProfileThemeBootstrap userId={user.id} initialTheme={initialTheme} />
      <UserPreferencesProvider
        userId={user.id}
        initialAvatarUrl={profile?.avatar_url ?? null}
        initialAccentColor={initialAccent}>
        <SettingsModalProvider>
          <ToastHooksBridge />
          <AiChatProvider>
            <SettingsModalHost
              locale={locale}
              initial={settingsSnapshot}
              loadError={settingsLoadError}
            />
            <FinanceAppShell user={shellUser}>
              <PageTransition>{children}</PageTransition>
            </FinanceAppShell>
          </AiChatProvider>
        </SettingsModalProvider>
      </UserPreferencesProvider>
    </QueryProvider>
  );
}
