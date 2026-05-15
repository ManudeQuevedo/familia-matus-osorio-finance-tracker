"use server";

import { revalidatePath } from "next/cache";

import { isAccentColor, type AccentColor } from "@/lib/finance/accent";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFamilyIdForUser } from "@/lib/supabase/family";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function revalidateSettings(locale: string) {
  revalidatePath(`/${locale}`, "layout");
  revalidatePath(`/${locale}/settings`, "page");
  revalidatePath(`/${locale}/dashboard`, "page");
  revalidatePath(`/${locale}/expenses`, "page");
  revalidatePath(`/${locale}/incomes`, "page");
}

export async function updateProfileFullName(input: {
  locale: string;
  fullName: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const name = input.fullName.trim();
  if (!name) return { ok: false as const, error: "invalid_name" };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: name })
    .eq("id", user.id);

  if (error) return { ok: false as const, error: error.message };
  revalidateSettings(input.locale);
  return { ok: true as const };
}

export async function uploadProfileAvatar(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "invalid_avatar" };
  }
  if (!AVATAR_MIME.has(file.type) || file.size > AVATAR_MAX_BYTES) {
    return { ok: false as const, error: "invalid_avatar" };
  }

  const ext = extFromMime(file.type);
  const path = `${user.id}/profile.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (uploadError) {
    return { ok: false as const, error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (profileError) {
    return { ok: false as const, error: profileError.message };
  }

  return { ok: true as const, avatarUrl };
}

export async function updateProfilePreferences(input: {
  locale: string;
  preferredLanguage?: "es" | "en";
  preferredTheme?: "light" | "dark" | "system";
  accentColor?: AccentColor;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const patch: Record<string, string> = {};
  if (input.preferredLanguage) patch.preferred_language = input.preferredLanguage;
  if (input.preferredTheme) patch.preferred_theme = input.preferredTheme;
  if (input.accentColor) {
    if (!isAccentColor(input.accentColor)) {
      return { ok: false as const, error: "invalid_accent" };
    }
    patch.accent_color = input.accentColor;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false as const, error: "nothing_to_update" };
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id);

  if (error) return { ok: false as const, error: error.message };
  revalidateSettings(input.locale);
  return { ok: true as const };
}

export async function changePassword(input: {
  locale: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false as const, error: "unauthorized" };

  if (input.newPassword.length < 8) {
    return { ok: false as const, error: "password_too_short" };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false as const, error: "password_mismatch" };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (signInError) {
    return { ok: false as const, error: "current_password_invalid" };
  }

  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
  });
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const };
}

export async function upsertAccount(input: {
  locale: string;
  id?: string;
  name: string;
  type: "savings" | "checking" | "cash";
  color: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "invalid_name" };

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  if (input.id) {
    const { error } = await supabase
      .from("accounts")
      .update({ name, type: input.type, color: input.color })
      .eq("id", input.id)
      .eq("family_id", familyId);
    if (error) return { ok: false as const, error: error.message };
  } else {
    const { error } = await supabase.from("accounts").insert({
      user_id: user.id,
      family_id: familyId,
      name,
      type: input.type,
      color: input.color,
    });
    if (error) return { ok: false as const, error: error.message };
  }

  revalidateSettings(input.locale);
  return { ok: true as const };
}

export async function deleteAccount(input: { locale: string; id: string }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const [exp, inc, rec] = await Promise.all([
    supabase
      .from("expense_records")
      .select("id", { count: "exact", head: true })
      .eq("account_id", input.id),
    supabase
      .from("incomes")
      .select("id", { count: "exact", head: true })
      .eq("account_id", input.id),
    supabase
      .from("recurring_expenses")
      .select("id", { count: "exact", head: true })
      .eq("account_id", input.id),
  ]);

  const total =
    (exp.count ?? 0) + (inc.count ?? 0) + (rec.count ?? 0);
  if (total > 0) {
    return { ok: false as const, error: "account_has_transactions" };
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", input.id)
    .eq("family_id", familyId);

  if (error) return { ok: false as const, error: error.message };
  revalidateSettings(input.locale);
  return { ok: true as const };
}

export async function createCustomSubcategory(input: {
  locale: string;
  categoryId: string;
  name: string;
  description?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "invalid_name" };

  const familyId = await getFamilyIdForUser(supabase, user.id);
  if (!familyId) {
    return { ok: false as const, error: "family_not_configured" };
  }

  const { error } = await supabase.from("subcategories").insert({
    category_id: input.categoryId,
    name,
    description: input.description?.trim() || null,
    user_id: user.id,
    family_id: familyId,
    is_active: true,
  });

  if (error) return { ok: false as const, error: error.message };
  revalidateSettings(input.locale);
  return { ok: true as const };
}

export async function toggleSubcategoryActive(input: {
  locale: string;
  id: string;
  isActive: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const { error } = await supabase
    .from("subcategories")
    .update({ is_active: input.isActive })
    .eq("id", input.id);

  if (error) return { ok: false as const, error: error.message };
  revalidateSettings(input.locale);
  return { ok: true as const };
}

export async function deleteCustomSubcategory(input: {
  locale: string;
  id: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "unauthorized" };

  const { error } = await supabase
    .from("subcategories")
    .delete()
    .eq("id", input.id);

  if (error) return { ok: false as const, error: error.message };
  revalidateSettings(input.locale);
  return { ok: true as const };
}
