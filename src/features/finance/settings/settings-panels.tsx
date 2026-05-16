"use client";

import { motion } from "framer-motion";
import {
  Check,
  Database,
  Loader2,
  Monitor,
  Moon,
  Pencil,
  Plus,
  Shield,
  Sliders,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { MfaSettingsCompact } from "@/components/auth/mfa-settings-compact";
import { UserAvatar } from "@/components/finance/UserAvatar";
import { useUserPreferences } from "@/components/providers/UserPreferencesProvider";
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
import type { SettingsTab } from "@/contexts/settings-modal-context";
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
  deactivateAccount,
  deleteAccount,
  deleteCustomSubcategory,
  toggleSubcategoryActive,
  updateProfileFullName,
  updateProfilePreferences,
  uploadProfileAvatar,
  upsertAccount,
} from "@/lib/finance/settings-actions";
import { toastConfirmDestructive, notify } from "@/lib/toast";
import type { SettingsSnapshot } from "@/lib/finance/settings-queries";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
      className="inline-flex max-md:flex max-md:w-full rounded-lg border border-border-default bg-bg-card p-0.5"
      role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-[20px] py-[14px] text-sm font-medium transition max-md:min-h-11 max-md:flex-1 max-md:touch-manipulation",
            "md:px-3 md:py-1.5 md:min-h-0 md:flex-none",
            value === opt.value
              ? "bg-accent text-accent-foreground shadow-sm"
              : "text-text-secondary hover:text-text-primary dark:text-text-muted",
          )}>
          {opt.label}
        </button>
      ))}
    </motion.div>
  );
}

const TAB_META: {
  id: SettingsTab;
  icon: typeof User;
}[] = [
  { id: "perfil", icon: User },
  { id: "seguridad", icon: Shield },
  { id: "preferencias", icon: Sliders },
  { id: "datos", icon: Database },
];

export function SettingsPanels({
  locale,
  initial,
  loadError,
  variant,
  activeTab,
  contentClassName,
}: {
  locale: string;
  initial: SettingsSnapshot | null;
  loadError: string | null;
  variant: "page" | "modal";
  activeTab: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
  contentClassName?: string;
}) {
  const t = useTranslations("Finance.settings");
  const tc = useTranslations("Finance.common");
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

  useEffect(() => {
    if (!initial?.profile) return;
    queueMicrotask(() => {
      setProfile(initial.profile);
      setFullName(initial.profile.full_name ?? "");
      setAccounts(initial.accounts ?? []);
      setSubcategories(initial.subcategories ?? []);
    });
  }, [initial]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        notify.generic.saved();
        router.refresh();
      } else {
        notify.preferences.saveError();
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
    if (file.size > AVATAR_MAX_BYTES) {
      notify.profile.photoSizeError();
      setError(t("errors.invalid_avatar"));
      return;
    }
    if (!AVATAR_MIME.has(file.type)) {
      notify.profile.photoError();
      setError(t("errors.invalid_avatar"));
      return;
    }
    setError(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const onSaveProfile = () => {
    setError(null);
    startTransition(async () => {
      if (avatarFile) {
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        const uploadRes = await uploadProfileAvatar(formData);
        if (!uploadRes.ok) {
          notify.profile.photoError();
          setError(t(`errors.${uploadRes.error}` as "errors.generic"));
          return;
        }
        setAvatarUrl(uploadRes.avatarUrl);
        setProfile((p) => (p ? { ...p, avatar_url: uploadRes.avatarUrl } : p));
        notify.profile.photoSuccess();
        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
        setAvatarFile(null);
      }

      const res = await updateProfileFullName({ locale, fullName });
      if (res.ok) {
        notify.profile.saveSuccess();
        router.refresh();
      } else {
        notify.profile.saveError();
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
        notify.preferences.saveError();
        setError(t("errors.generic"));
        return;
      }
      notify.preferences.languageChanged(next);
      setProfile((p) => (p ? { ...p, preferred_language: next } : p));
      router.replace(pathname, { locale: next });
      router.refresh();
    });
  };

  const onTheme = (next: ThemePreference) => {
    void setTheme(next, locale);
    notify.preferences.themeChanged(next);
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
      if (!res.ok) {
        notify.preferences.saveError();
        setError(t("errors.generic"));
      } else {
        notify.preferences.accentChanged(next);
      }
    });
  };

  const onChangePassword = () => {
    if (pwdNew !== pwdConfirm) {
      notify.password.mismatch();
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await changePassword({
        locale,
        currentPassword: pwdCurrent,
        newPassword: pwdNew,
        confirmPassword: pwdConfirm,
      });
      if (res.ok) {
        notify.password.changeSuccess();
        setPwdCurrent("");
        setPwdNew("");
        setPwdConfirm("");
        router.refresh();
      } else {
        notify.password.changeError();
        setError(t(`errors.${res.error}` as "errors.generic"));
      }
    });
  };

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
        if (res.ok) {
          setAccountForm(null);
          if (accountForm.id) {
            notify.accounts.updateSuccess();
          } else {
            notify.accounts.addSuccess(accountForm.name);
          }
        }
        return res;
      }),
    );
  };

  const onDeleteAccount = (id: string) => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;

    if (acc.transaction_count > 0) {
      toast.warning(
        t("accounts.softDeleteTitle", {
          count: acc.transaction_count,
        }),
        {
          description: t("accounts.softDeleteHint"),
          duration: 5000,
          action: {
            label: t("accounts.deactivateAction"),
            onClick: () => {
              setError(null);
              startTransition(async () => {
                const res = await deactivateAccount({ locale, id });
                if (res.ok) {
                  setAccounts((list) =>
                    list.map((x) =>
                      x.id === id ? { ...x, is_active: false } : x,
                    ),
                  );
                  notify.accounts.deactivatedSuccess(acc.name);
                  router.refresh();
                } else {
                  notify.generic.unexpectedError();
                }
              });
            },
          },
          cancel: {
            label: tc("cancel"),
            onClick: () => {},
          },
        },
      );
      return;
    }

    toastConfirmDestructive({
      title: tc("deleteNamed", { name: acc.name }),
      description: tc("deleteCannotUndo"),
      duration: 5000,
      confirmLabel: tc("delete"),
      cancelLabel: tc("cancel"),
      onConfirm: () => {
        setError(null);
        startTransition(async () => {
          const res = await deleteAccount({ locale, id });
          if (res.ok) {
            setAccounts((a) => a.filter((x) => x.id !== id));
            notify.accounts.deleteSuccess(acc.name);
            router.refresh();
          } else {
            notify.accounts.deleteError();
            setError(t(`errors.${res.error}` as "errors.generic"));
          }
        });
      },
    });
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

  const onDeleteSub = (id: string, name: string) => {
    toastConfirmDestructive({
      title: tc("deleteNamed", { name }),
      description: tc("deleteCannotUndo"),
      duration: 5000,
      confirmLabel: tc("delete"),
      cancelLabel: tc("cancel"),
      onConfirm: () => {
        setError(null);
        startTransition(async () => {
          const res = await deleteCustomSubcategory({ locale, id });
          if (res.ok) {
            setSubcategories((subs) => subs.filter((s) => s.id !== id));
            notify.categories.deleteSuccess();
            router.refresh();
          } else {
            notify.categories.deleteError();
            setError(t(`errors.${res.error}` as "errors.generic"));
          }
        });
      },
    });
  };

  if (loadError || !profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {loadError ?? t("loadError")}
        </p>
      </div>
    );
  }

  const profileBlock = (
    <div
      className={cn(
        "flex flex-col gap-6 lg:flex-row lg:items-start",
        variant === "modal" && "min-h-0 flex-1",
      )}>
      <div className="flex w-full flex-col items-center gap-2 lg:w-[240px] lg:shrink-0">
        <UserAvatar
          avatarUrl={displayAvatarUrl}
          initials={profileInitials}
          size="lg"
          className="h-20 w-20 text-xl max-md:mx-auto md:h-24 md:w-24 md:text-2xl"
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
        <p className="text-center font-medium text-text-primary">
          {fullName || profile.email}
        </p>
        <p className="text-center text-sm text-text-muted">{profile.email}</p>
      </div>
      <div className="min-w-0 flex-1 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full-name">{t("profile.fullName")}</Label>
          <Input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="max-md:h-12 max-md:min-h-12 max-md:text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("profile.email")}</Label>
          <Input
            id="email"
            readOnly
            value={profile.email}
            className="bg-bg-card-nested max-md:h-12 max-md:min-h-12 max-md:text-base"
          />
        </div>
        <div className="flex justify-end max-md:justify-stretch">
          <Button
            type="button"
            disabled={pending}
            onClick={onSaveProfile}
            className="max-md:h-12 max-md:w-full max-md:px-5 max-md:py-3.5 max-md:text-base">
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("profile.save")
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const securityBlock = (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-6",
        variant === "modal" && "md:h-full md:justify-between md:gap-0",
      )}>
      <div className="space-y-3 md:flex-1">
        <h3 className="text-sm font-semibold">{t("security.passwordTitle")}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="pwd-current">{t("security.currentPassword")}</Label>
            <Input
              id="pwd-current"
              type="password"
              autoComplete="current-password"
              value={pwdCurrent}
              onChange={(e) => setPwdCurrent(e.target.value)}
              className="max-md:h-12 max-md:min-h-12 max-md:text-base"
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
              className="max-md:h-12 max-md:min-h-12 max-md:text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd-confirm">{t("security.confirmPassword")}</Label>
            <Input
              id="pwd-confirm"
              type="password"
              autoComplete="new-password"
              value={pwdConfirm}
              onChange={(e) => setPwdConfirm(e.target.value)}
              className="max-md:h-12 max-md:min-h-12 max-md:text-base"
            />
          </div>
        </div>
        <Button
          type="button"
          disabled={pending || !pwdCurrent || !pwdNew}
          onClick={onChangePassword}
          className="max-md:h-12 max-md:w-full max-md:px-5 max-md:text-base">
          {t("security.changePassword")}
        </Button>
      </div>
      <div
        className={cn(
          "border-t border-border-subtle pt-4 md:mt-4 md:flex-1 md:pt-4",
        )}>
        <h3 className="mb-3 text-sm font-semibold">
          {t("security.mfaSectionTitle")}
        </h3>
        <MfaSettingsCompact />
      </div>
    </div>
  );

  const preferencesBlock = (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-medium">{t("preferences.language")}</p>
        <ToggleGroup
          value={lang}
          options={[
            { value: "es", label: "ES" },
            { value: "en", label: "EN" },
          ]}
          onChange={onLanguage}
          disabled={pending}
        />
        <p className="mt-1.5 text-xs text-text-muted">
          {t("preferences.languageHint")}
        </p>
      </div>
      <div>
        <p className="mb-3 text-sm font-medium">{t("preferences.theme")}</p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
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
        <p className="mb-3 text-sm font-medium">{t("preferences.accent")}</p>
        <div className="flex flex-wrap justify-center gap-3 md:justify-start">
          {ACCENT_COLORS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => onAccent(key)}
              className={cn(
                "relative flex h-12 w-12 shrink-0 touch-manipulation items-center justify-center rounded-full border-2 transition md:h-11 md:w-11",
                accentColor === key
                  ? "border-accent ring-2 ring-accent/35"
                  : "border-transparent",
              )}
              style={{ backgroundColor: ACCENT_SWATCH[key] }}
              aria-pressed={accentColor === key}
              title={t(
                `preferences.accent${key.charAt(0).toUpperCase()}${key.slice(1)}` as
                  | "preferences.accentEmerald"
                  | "preferences.accentBlue"
                  | "preferences.accentPurple"
                  | "preferences.accentRose"
                  | "preferences.accentAmber"
                  | "preferences.accentSlate",
              )}>
              {accentColor === key ? (
                <Check
                  className="h-5 w-5 text-white drop-shadow"
                  strokeWidth={2.5}
                />
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">{t("preferences.currency")}</p>
        <Badge variant="secondary">MXN</Badge>
        <p className="mt-1 text-xs text-text-muted">
          {t("preferences.currencyHint")}
        </p>
      </div>
    </div>
  );

  const accountsList = (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="space-y-2 max-md:overflow-visible md:max-h-[28vh] md:overflow-y-auto">
        {accounts.map((acc) => (
          <li
            key={acc.id}
            className="group flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-default px-3 py-2.5 text-sm dark:border-border-default">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: acc.color }}
              />
              <div className="min-w-0">
                <p className="truncate font-medium">{acc.name}</p>
                <p className="text-xs text-text-muted">
                  {t(`accounts.types.${acc.type}`)}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-11 min-h-11 w-11 min-w-11 touch-manipulation md:h-8 md:min-h-8 md:w-8 md:min-w-8"
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
                className="h-11 min-h-11 w-11 min-w-11 touch-manipulation text-muted-foreground transition-[opacity,color] duration-[150ms] hover:text-red-500 md:h-8 md:min-h-8 md:w-8 md:min-w-8 md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100"
                disabled={pending}
                onClick={() => onDeleteAccount(acc.id)}
                aria-label={tc("delete")}>
                <Trash2 className="h-[15px] w-[15px]" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {accountForm ? (
        <div className="mt-3 space-y-2 rounded-xl border border-dashed border-border-default p-3">
          <div className="space-y-1.5">
            <Label>{t("accounts.name")}</Label>
            <Input
              value={accountForm.name}
              onChange={(e) =>
                setAccountForm((f) => (f ? { ...f, name: e.target.value } : f))
              }
              className="max-md:h-12 max-md:min-h-12 max-md:text-base"
            />
          </div>
          <div className="space-y-1.5">
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
              <SelectTrigger className="max-md:h-12 max-md:text-base">
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
          <div className="space-y-1.5">
            <Label>{t("accounts.color")}</Label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "h-9 min-h-9 w-9 min-w-9 touch-manipulation rounded-full border-2 transition md:h-7 md:min-h-7 md:w-7 md:min-w-7",
                    accountForm.color === c
                      ? "border-text-primary"
                      : "border-transparent",
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() =>
                    setAccountForm((f) => (f ? { ...f, color: c } : f))
                  }
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-1 max-md:w-full md:flex-row md:flex-wrap">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={onSaveAccount}
              className="max-md:h-12 max-md:w-full max-md:px-5 max-md:text-base">
              {t("accounts.save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAccountForm(null)}
              className="max-md:h-12 max-md:w-full max-md:px-5 max-md:text-base">
              {t("accounts.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-fit max-md:h-12 max-md:w-full max-md:px-5 max-md:text-base"
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
    </div>
  );

  const systemCategories = categories.filter((c) => c.is_system);

  const categoriesBlock = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {t("categories.systemTitle")}
      </p>
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {systemCategories.map((c) => {
          const Icon = categoryLucideIcon(c.icon);
          return (
            <div
              key={c.id}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-border-default bg-bg-card-nested px-2.5 py-2 text-xs dark:border-border-default">
              <Icon
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: c.color }}
                aria-hidden
              />
              <span className="min-w-0 truncate leading-tight">
                {categoryName(c)}
              </span>
            </div>
          );
        })}
      </div>
      <ul className="hidden max-h-[min(200px,35vh)] space-y-1.5 overflow-y-auto md:block md:max-h-[24vh]">
        {systemCategories.map((c) => {
          const Icon = categoryLucideIcon(c.icon);
          return (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-card-nested/80 px-2.5 py-1.5 text-sm dark:border-border-default dark:bg-bg-card-nested">
              <Icon className="h-4 w-4 shrink-0" style={{ color: c.color }} />
              <span className="min-w-0 truncate">{categoryName(c)}</span>
              <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                {t("categories.systemBadge")}
              </Badge>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border-subtle pt-3">
        <p className="mb-2 text-sm font-medium">
          {t("categories.customTitle")}
        </p>
        <div className="space-y-2 rounded-xl border border-border-default p-3 dark:border-border-default">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">{t("categories.pickCategory")}</Label>
              <Select
                value={newSub.categoryId}
                onValueChange={(v) =>
                  setNewSub((s) => ({ ...s, categoryId: v }))
                }>
                <SelectTrigger className="h-9 max-md:h-12 max-md:text-base">
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
            <div className="space-y-1.5">
              <Label className="text-xs">{t("categories.subName")}</Label>
              <Input
                className="h-9 max-md:h-12 max-md:min-h-12 max-md:text-base"
                value={newSub.name}
                onChange={(e) =>
                  setNewSub((s) => ({ ...s, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {t("categories.subDescription")}
              </Label>
              <Input
                className="h-9 max-md:h-12 max-md:min-h-12 max-md:text-base"
                value={newSub.description}
                onChange={(e) =>
                  setNewSub((s) => ({ ...s, description: e.target.value }))
                }
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={pending || !newSub.name.trim()}
            onClick={onAddSub}
            className="max-md:h-12 max-md:w-full max-md:px-5 max-md:text-base">
            <Plus className="mr-2 h-4 w-4" />
            {t("categories.addSub")}
          </Button>
        </div>
        <div className="mt-3 space-y-3 max-md:space-y-4 md:max-h-[20vh] md:overflow-y-auto">
          {categories.map((cat) => {
            const custom = customSubsByCategory.get(cat.id) ?? [];
            if (custom.length === 0) return null;
            return (
              <div key={cat.id}>
                <p className="mb-1.5 text-xs font-medium text-text-muted">
                  {categoryName(cat)}
                </p>
                <ul className="space-y-1.5">
                  {custom.map((sub) => (
                    <li
                      key={sub.id}
                      className="group flex items-center justify-between gap-2 rounded-lg border border-border-default px-2.5 py-1.5 text-sm dark:border-border-default">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{sub.name}</p>
                        {sub.description ? (
                          <p className="truncate text-xs text-text-muted">
                            {sub.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs touch-manipulation">
                          <input
                            type="checkbox"
                            checked={sub.is_active}
                            disabled={pending}
                            onChange={(e) =>
                              onToggleSub(sub.id, e.target.checked)
                            }
                            className="h-5 w-5 shrink-0 rounded border-zinc-300 md:h-3.5 md:w-3.5"
                          />
                        </label>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-11 min-h-11 w-11 min-w-11 touch-manipulation text-muted-foreground transition-[opacity,color] duration-[150ms] hover:text-red-500 md:h-8 md:min-h-8 md:w-8 md:min-w-8 md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100"
                          onClick={() => onDeleteSub(sub.id, sub.name)}
                          aria-label={tc("delete")}>
                          <Trash2 className="h-[15px] w-[15px]" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const datosBlock = (
    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2 md:gap-6">
      <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border-subtle p-3 md:border-0 md:p-0">
        <p className="mb-2 text-sm font-semibold">{t("accounts.title")}</p>
        {accountsList}
      </div>
      <div className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border-subtle p-3 md:border-0 md:p-0">
        <p className="mb-2 text-sm font-semibold">{t("categories.title")}</p>
        {categoriesBlock}
      </div>
    </div>
  );

  const tabBody = () => {
    switch (activeTab) {
      case "perfil":
        return profileBlock;
      case "seguridad":
        return securityBlock;
      case "preferencias":
        return preferencesBlock;
      case "datos":
        return datosBlock;
      default:
        return null;
    }
  };

  if (variant === "modal") {
    return (
      <>
        {error ? (
          <Alert variant="destructive" className="mb-3 shrink-0">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            contentClassName,
          )}>
          {tabBody()}
        </div>
      </>
    );
  }

  /* ----- Page variant (stacked sections) ----- */
  return (
    <>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section id="profile" className="scroll-mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("profile.title")}</CardTitle>
            <CardDescription>{t("profile.description")}</CardDescription>
          </CardHeader>
          <CardContent>{profileBlock}</CardContent>
        </Card>
      </section>

      <section id="preferences" className="scroll-mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("preferences.title")}</CardTitle>
            <CardDescription>{t("preferences.description")}</CardDescription>
          </CardHeader>
          <CardContent>{preferencesBlock}</CardContent>
        </Card>
      </section>

      <section id="security" className="scroll-mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("security.title")}</CardTitle>
            <CardDescription>{t("security.description")}</CardDescription>
          </CardHeader>
          <CardContent>{securityBlock}</CardContent>
        </Card>
      </section>

      <section id="accounts" className="scroll-mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("accounts.title")}</CardTitle>
            <CardDescription>{t("accounts.description")}</CardDescription>
          </CardHeader>
          <CardContent>{accountsList}</CardContent>
        </Card>
      </section>

      <section id="categories" className="scroll-mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("categories.title")}</CardTitle>
            <CardDescription>{t("categories.description")}</CardDescription>
          </CardHeader>
          <CardContent>{categoriesBlock}</CardContent>
        </Card>
      </section>
    </>
  );
}

export { TAB_META };
