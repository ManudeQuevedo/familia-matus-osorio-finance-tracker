"use client";

import { motion } from "framer-motion";
import {
  Loader2,
  Monitor,
  Moon,
  Pencil,
  Plus,
  Sun,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState, useTransition } from "react";

import { UserAvatar } from "@/components/finance/UserAvatar";
import { useUserPreferences } from "@/components/providers/UserPreferencesProvider";

import { MfaSettingsCompact } from "@/components/auth/mfa-settings-compact";
import {
  useThemePreference,
  type ThemePreference,
} from "@/components/providers/ThemeProvider";
import { ThemePreferenceOption } from "@/components/shared/theme-toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryLucideIcon } from "@/features/finance/category-lucide";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  ACCENT_COLORS,
  ACCENT_SWATCH,
  type AccentColor,
} from "@/lib/finance/accent";
import {
  changePassword,
  createCustomSubcategory,
  deleteAccount,
  toggleSubcategoryActive,
  updateProfileFullName,
  updateProfilePreferences,
  uploadProfileAvatar,
  upsertAccount,
} from "@/lib/finance/settings-actions";
import type { SettingsSnapshot } from "@/lib/finance/settings-queries";
import { FinancePageShell } from "@/components/finance/FinancePageShell";
import { cn } from "@/lib/utils";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

const ACCOUNT_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f97316",
  "#ec4899",
  "#0ea5e9",
  "#eab308",
];

function initialsFrom(name: string | null, email: string) {
  const src = name?.trim() || email;
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}

function ToggleGroup<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <motion.div
      className="inline-flex rounded-lg border border-border-default bg-bg-card p-0.5 dark:border-border-default bg-bg-card"
      role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition",
            value === opt.value
              ? "bg-accent text-accent-foreground shadow-sm"
              : "text-text-secondary hover:text-text-primary dark:text-text-muted hover:text-text-primary",
          )}>
          {opt.label}
        </button>
      ))}
    </motion.div>
  );
}

export function SettingsPageClient({
  locale,
  initial,
  loadError,
}: {
  locale: string;
  initial: SettingsSnapshot | null;
  loadError: string | null;
}) {
  const t = useTranslations("Finance.settings");
  const intlLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { avatarUrl, setAvatarUrl, accentColor, setAccentColor } =
    useUserPreferences();
  const [pending, startTransition] = useTransition();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [profile, setProfile] = useState(initial?.profile ?? null);
  const serverTheme =
    (profile?.preferred_theme as ThemePreference | undefined) ?? "system";
  const { displayTheme, setTheme } = useThemePreference(serverTheme);
  const [accounts, setAccounts] = useState(initial?.accounts ?? []);
  const [categories] = useState(initial?.categories ?? []);
  const [subcategories, setSubcategories] = useState(
    initial?.subcategories ?? [],
  );

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");

  const [accountForm, setAccountForm] = useState<{
    id?: string;
    name: string;
    type: "savings" | "checking" | "cash";
    color: string;
  } | null>(null);

  const [newSub, setNewSub] = useState({
    categoryId: categories[0]?.id ?? "",
    name: "",
    description: "",
  });

  const lang = (profile?.preferred_language ?? intlLocale) as "es" | "en";

  const categoryName = useMemo(
    () => (c: (typeof categories)[0]) =>
      intlLocale === "es" ? c.name_es : c.name_en,
    [intlLocale],
  );

  const customSubsByCategory = useMemo(() => {
    const map = new Map<string, typeof subcategories>();
    for (const s of subcategories) {
      if (!s.user_id) continue;
      const list = map.get(s.category_id) ?? [];
      list.push(s);
      map.set(s.category_id, list);
    }
    return map;
  }, [subcategories]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setMessage(t("saved"));
        router.refresh();
      } else {
        setError(t(`errors.${res.error}` as "errors.generic"));
      }
    });
  };

  const profileInitials = initialsFrom(
    profile?.full_name ?? null,
    profile?.email ?? "",
  );
  const displayAvatarUrl =
    avatarPreview ?? avatarUrl ?? profile?.avatar_url ?? null;

  const onAvatarSelected = (file: File | undefined) => {
    if (!file) return;
    if (!AVATAR_MIME.has(file.type) || file.size > AVATAR_MAX_BYTES) {
      setError(t("errors.invalid_avatar"));
      return;
    }
    setError(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSaveProfile = () => {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      if (avatarFile) {
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        const uploadRes = await uploadProfileAvatar(formData);
        if (!uploadRes.ok) {
          setError(t(`errors.${uploadRes.error}` as "errors.generic"));
          return;
        }
        setAvatarUrl(uploadRes.avatarUrl);
        setProfile((p) => (p ? { ...p, avatar_url: uploadRes.avatarUrl } : p));
        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
        setAvatarFile(null);
      }

      const res = await updateProfileFullName({ locale, fullName });
      if (res.ok) {
        setMessage(t("saved"));
        router.refresh();
      } else {
        setError(t(`errors.${res.error}` as "errors.generic"));
      }
    });
  };

  const onLanguage = (next: "es" | "en") => {
    if (next === lang) return;
    startTransition(async () => {
      const res = await updateProfilePreferences({
        locale,
        preferredLanguage: next,
      });
      if (!res.ok) {
        setError(t("errors.generic"));
        return;
      }
      setProfile((p) => (p ? { ...p, preferred_language: next } : p));
      router.replace(pathname, { locale: next });
      router.refresh();
    });
  };

  const onTheme = (next: ThemePreference) => {
    void setTheme(next, locale);
    setProfile((p) => (p ? { ...p, preferred_theme: next } : p));
  };

  const onAccent = (next: AccentColor) => {
    setAccentColor(next);
    setProfile((p) => (p ? { ...p, accent_color: next } : p));
    startTransition(async () => {
      const res = await updateProfilePreferences({
        locale,
        accentColor: next,
      });
      if (!res.ok) setError(t("errors.generic"));
    });
  };

  const onChangePassword = () =>
    run(() =>
      changePassword({
        locale,
        currentPassword: pwdCurrent,
        newPassword: pwdNew,
        confirmPassword: pwdConfirm,
      }).then((res) => {
        if (res.ok) {
          setPwdCurrent("");
          setPwdNew("");
          setPwdConfirm("");
        }
        return res;
      }),
    );

  const onSaveAccount = () => {
    if (!accountForm) return;
    run(() =>
      upsertAccount({
        locale,
        id: accountForm.id,
        name: accountForm.name,
        type: accountForm.type,
        color: accountForm.color,
      }).then((res) => {
        if (res.ok) setAccountForm(null);
        return res;
      }),
    );
  };

  const onDeleteAccount = (id: string) => {
    if (!confirm(t("accounts.deleteConfirm"))) return;
    run(() =>
      deleteAccount({ locale, id }).then((res) => {
        if (res.ok) setAccounts((a) => a.filter((x) => x.id !== id));
        return res;
      }),
    );
  };

  const onAddSub = () =>
    run(() =>
      createCustomSubcategory({
        locale,
        categoryId: newSub.categoryId,
        name: newSub.name,
        description: newSub.description,
      }).then((res) => {
        if (res.ok) {
          setNewSub((s) => ({ ...s, name: "", description: "" }));
          router.refresh();
        }
        return res;
      }),
    );

  const onToggleSub = (id: string, isActive: boolean) =>
    run(() =>
      toggleSubcategoryActive({ locale, id, isActive }).then((res) => {
        if (res.ok) {
          setSubcategories((subs) =>
            subs.map((s) => (s.id === id ? { ...s, is_active: isActive } : s)),
          );
        }
        return res;
      }),
    );

  if (loadError || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {loadError ?? t("loadError")}
        </p>
      </div>
    );
  }

  return (
    <FinancePageShell className="space-y-8 pb-8 md:pb-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-text-secondary dark:text-text-muted">
          {t("subtitle")}
        </p>
      </header>

      {message ? (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Section
        id="profile"
        title={t("profile.title")}
        description={t("profile.description")}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <UserAvatar
              avatarUrl={displayAvatarUrl}
              initials={profileInitials}
              size="lg"
              onClick={() => avatarInputRef.current?.click()}
            />
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                onAvatarSelected(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="text-center text-xs text-text-muted">
              {t("profile.avatarHint")}
            </p>
          </div>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full-name">{t("profile.fullName")}</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("profile.email")}</Label>
              <Input
                id="email"
                readOnly
                value={profile.email}
                className="bg-bg-card-nested bg-bg-card-nested"
              />
            </div>
            <Button type="button" disabled={pending} onClick={onSaveProfile}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("profile.save")
              )}
            </Button>
          </div>
        </div>
      </Section>

      <Section
        id="preferences"
        title={t("preferences.title")}
        description={t("preferences.description")}>
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium">
              {t("preferences.language")}
            </p>
            <ToggleGroup
              value={lang}
              options={[
                { value: "es", label: "ES" },
                { value: "en", label: "EN" },
              ]}
              onChange={onLanguage}
              disabled={pending}
            />
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">{t("preferences.theme")}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    value: "light" as const,
                    label: t("preferences.themeLight"),
                    Icon: Sun,
                  },
                  {
                    value: "dark" as const,
                    label: t("preferences.themeDark"),
                    Icon: Moon,
                  },
                  {
                    value: "system" as const,
                    label: t("preferences.themeSystem"),
                    Icon: Monitor,
                  },
                ] as const
              ).map(({ value, label, Icon }) => (
                <ThemePreferenceOption
                  key={value}
                  value={value}
                  label={label}
                  Icon={Icon}
                  active={displayTheme === value}
                  disabled={pending}
                  onSelect={onTheme}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-medium">
              {t("preferences.accent")}
            </p>
            <div className="flex flex-wrap gap-3">
              {ACCENT_COLORS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={pending}
                  onClick={() => onAccent(key)}
                  className={cn(
                    "flex h-11 min-w-22 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    accentColor === key
                      ? "border-accent ring-2 ring-accent/40"
                      : "border-border-default",
                  )}
                  aria-pressed={accentColor === key}>
                  <span
                    className="h-6 w-6 shrink-0 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: ACCENT_SWATCH[key] }}
                  />
                  {t(
                    `preferences.accent${key.charAt(0).toUpperCase()}${key.slice(1)}` as
                      | "preferences.accentEmerald"
                      | "preferences.accentBlue"
                      | "preferences.accentPurple"
                      | "preferences.accentRose"
                      | "preferences.accentAmber"
                      | "preferences.accentSlate",
                  )}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">
              {t("preferences.currency")}
            </p>
            <Badge variant="secondary">MXN</Badge>
            <p className="mt-1 text-xs text-text-muted">
              {t("preferences.currencyHint")}
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="security"
        title={t("security.title")}
        description={t("security.description")}>
        <div className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">
              {t("security.passwordTitle")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="pwd-current">
                  {t("security.currentPassword")}
                </Label>
                <Input
                  id="pwd-current"
                  type="password"
                  autoComplete="current-password"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwd-new">{t("security.newPassword")}</Label>
                <Input
                  id="pwd-new"
                  type="password"
                  autoComplete="new-password"
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pwd-confirm">
                  {t("security.confirmPassword")}
                </Label>
                <Input
                  id="pwd-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending || !pwdCurrent || !pwdNew}
              onClick={onChangePassword}>
              {t("security.changePassword")}
            </Button>
          </div>
          <motion.div className="border-t border-border-default pt-6 dark:border-border-default">
            <h3 className="mb-3 text-sm font-semibold">
              {t("security.mfaTitle")}
            </h3>
            <MfaSettingsCompact />
          </motion.div>
        </div>
      </Section>

      <Section
        id="accounts"
        title={t("accounts.title")}
        description={t("accounts.description")}>
        <ul className="space-y-3">
          {accounts.map((acc) => (
            <li
              key={acc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-default px-4 py-3 dark:border-border-default">
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: acc.color }}
                />
                <motion.div>
                  <p className="font-medium">{acc.name}</p>
                  <p className="text-xs text-text-muted">
                    {t(`accounts.types.${acc.type}`)}
                    {acc.transaction_count > 0
                      ? ` · ${t("accounts.txCount", { count: acc.transaction_count })}`
                      : ""}
                  </p>
                </motion.div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setAccountForm({
                      id: acc.id,
                      name: acc.name,
                      type: acc.type,
                      color: acc.color,
                    })
                  }>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={acc.transaction_count > 0 || pending}
                  title={
                    acc.transaction_count > 0
                      ? t("accounts.cannotDelete")
                      : undefined
                  }
                  onClick={() => onDeleteAccount(acc.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {accountForm ? (
          <div className="mt-4 space-y-3 rounded-xl border border-dashed border-zinc-300 p-4 border-border-default">
            <div className="space-y-2">
              <Label>{t("accounts.name")}</Label>
              <Input
                value={accountForm.name}
                onChange={(e) =>
                  setAccountForm((f) =>
                    f ? { ...f, name: e.target.value } : f,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("accounts.type")}</Label>
              <Select
                value={accountForm.type}
                onValueChange={(v) =>
                  setAccountForm((f) =>
                    f
                      ? {
                          ...f,
                          type: v as "savings" | "checking" | "cash",
                        }
                      : f,
                  )
                }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["savings", "checking", "cash"] as const).map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`accounts.types.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("accounts.color")}</Label>
              <motion.div className="flex flex-wrap gap-2">
                {ACCOUNT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-full border-2 transition",
                      accountForm.color === c
                        ? "border-zinc-900 dark:border-white"
                        : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() =>
                      setAccountForm((f) => (f ? { ...f, color: c } : f))
                    }
                  />
                ))}
              </motion.div>
            </div>
            <div className="flex gap-2">
              <Button type="button" disabled={pending} onClick={onSaveAccount}>
                {t("accounts.save")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAccountForm(null)}>
                {t("accounts.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() =>
              setAccountForm({
                name: "",
                type: "checking",
                color: ACCOUNT_COLORS[0]!,
              })
            }>
            <Plus className="mr-2 h-4 w-4" />
            {t("accounts.add")}
          </Button>
        )}
      </Section>

      <Section
        id="categories"
        title={t("categories.title")}
        description={t("categories.description")}>
        <div className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-medium text-text-secondary dark:text-text-muted">
              {t("categories.systemTitle")}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {categories
                .filter((c) => c.is_system)
                .map((c) => {
                  const Icon = categoryLucideIcon(c.icon);
                  return (
                    <li
                      key={c.id}
                      className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-card-nested/80 px-3 py-2 text-sm dark:border-border-default dark:bg-bg-card-nested">
                      <Icon
                        className="h-4 w-4 shrink-0"
                        style={{ color: c.color }}
                      />
                      <span>{categoryName(c)}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        {t("categories.systemBadge")}
                      </Badge>
                    </li>
                  );
                })}
            </ul>
          </div>

          <div className="border-t border-border-default pt-6 dark:border-border-default">
            <p className="mb-3 text-sm font-medium">
              {t("categories.customTitle")}
            </p>
            <div className="space-y-4 rounded-xl border border-border-default p-4 dark:border-border-default">
              <motion.div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t("categories.pickCategory")}</Label>
                  <Select
                    value={newSub.categoryId}
                    onValueChange={(v) =>
                      setNewSub((s) => ({ ...s, categoryId: v }))
                    }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {categoryName(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("categories.subName")}</Label>
                  <Input
                    value={newSub.name}
                    onChange={(e) =>
                      setNewSub((s) => ({ ...s, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("categories.subDescription")}</Label>
                  <Input
                    value={newSub.description}
                    onChange={(e) =>
                      setNewSub((s) => ({ ...s, description: e.target.value }))
                    }
                  />
                </div>
              </motion.div>
              <Button
                type="button"
                disabled={pending || !newSub.name.trim()}
                onClick={onAddSub}>
                <Plus className="mr-2 h-4 w-4" />
                {t("categories.addSub")}
              </Button>
            </div>

            {categories.map((cat) => {
              const custom = customSubsByCategory.get(cat.id) ?? [];
              if (custom.length === 0) return null;
              return (
                <div key={cat.id} className="mt-4">
                  <p className="mb-2 text-sm font-medium">
                    {categoryName(cat)}
                  </p>
                  <ul className="space-y-2">
                    {custom.map((sub) => (
                      <li
                        key={sub.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border-default px-3 py-2 dark:border-border-default">
                        <div>
                          <p className="text-sm font-medium">{sub.name}</p>
                          {sub.description ? (
                            <p className="text-xs text-text-muted">
                              {sub.description}
                            </p>
                          ) : null}
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={sub.is_active}
                            disabled={pending}
                            onChange={(e) =>
                              onToggleSub(sub.id, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-zinc-300"
                          />
                          {sub.is_active
                            ? t("categories.active")
                            : t("categories.inactive")}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    </FinancePageShell>
  );
}
