import type { SupabaseClient } from "@supabase/supabase-js";

import { getFamilyIdForUser } from "@/lib/supabase/family-core";

export type ProfileSettings = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  preferred_language: "es" | "en";
  preferred_theme: "light" | "dark" | "system";
  accent_color: string;
  currency_display: string;
};

export type AccountRow = {
  id: string;
  name: string;
  type: "savings" | "checking" | "cash";
  color: string;
  is_active: boolean;
  transaction_count: number;
};

export type CategoryRow = {
  id: string;
  name_es: string;
  name_en: string;
  icon: string;
  color: string;
  type: string;
  is_system: boolean;
};

export type SubcategoryRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  user_id: string | null;
};

export type SettingsSnapshot = {
  profile: ProfileSettings;
  accounts: AccountRow[];
  categories: CategoryRow[];
  subcategories: SubcategoryRow[];
};

export async function fetchSettingsSnapshot(
  supabase: SupabaseClient,
  userId: string,
  locale: "es" | "en",
): Promise<{ data: SettingsSnapshot | null; error: string | null }> {
  const familyId = await getFamilyIdForUser(supabase, userId);
  if (!familyId) {
    return { data: null, error: "family_not_configured" };
  }

  const [profileRes, accountsRes, categoriesRes, subcategoriesRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, email, full_name, avatar_url, preferred_language, preferred_theme, accent_color, currency_display",
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("accounts")
        .select("id, name, type, color, is_active")
        .eq("family_id", familyId)
        .order("name"),
      supabase
        .from("categories")
        .select("id, name_es, name_en, icon, color, type, is_system")
        .order(locale === "es" ? "name_es" : "name_en"),
      supabase
        .from("subcategories")
        .select("id, category_id, name, description, is_active, user_id")
        .order("name"),
    ]);

  const profile = profileRes.data;
  if (profileRes.error || !profile) {
    return {
      data: null,
      error: profileRes.error?.message ?? "profile_not_found",
    };
  }

  if (accountsRes.error) {
    return { data: null, error: accountsRes.error.message };
  }

  const accounts = accountsRes.data;

  const accountIds = (accounts ?? []).map((a) => a.id);
  const txCounts = new Map<string, number>();

  if (accountIds.length > 0) {
    const [expRes, incRes, recRes] = await Promise.all([
      supabase.from("expense_records").select("account_id").in("account_id", accountIds),
      supabase.from("incomes").select("account_id").in("account_id", accountIds),
      supabase
        .from("recurring_expenses")
        .select("account_id")
        .in("account_id", accountIds),
    ]);

    for (const row of expRes.data ?? []) {
      txCounts.set(row.account_id, (txCounts.get(row.account_id) ?? 0) + 1);
    }
    for (const row of incRes.data ?? []) {
      txCounts.set(row.account_id, (txCounts.get(row.account_id) ?? 0) + 1);
    }
    for (const row of recRes.data ?? []) {
      txCounts.set(row.account_id, (txCounts.get(row.account_id) ?? 0) + 1);
    }
  }

  if (categoriesRes.error) {
    return { data: null, error: categoriesRes.error.message };
  }

  if (subcategoriesRes.error) {
    return { data: null, error: subcategoriesRes.error.message };
  }

  const categories = categoriesRes.data;
  const subcategories = subcategoriesRes.data;

  return {
    data: {
      profile: profile as ProfileSettings,
      accounts: (accounts ?? []).map((a) => ({
        ...a,
        type: a.type as AccountRow["type"],
        transaction_count: txCounts.get(a.id) ?? 0,
      })),
      categories: (categories ?? []) as CategoryRow[],
      subcategories: (subcategories ?? []) as SubcategoryRow[],
    },
    error: null,
  };
}
