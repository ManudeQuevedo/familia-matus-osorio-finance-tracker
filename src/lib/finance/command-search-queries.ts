import type { SupabaseClient } from "@supabase/supabase-js";

import { getFamilyIdForUser } from "@/lib/supabase/family-core";
import { errorMessageFromUnknown } from "@/lib/supabase/error-message";

export type ExpenseHitSubtitleKey = "variable" | "recurring_template" | "record";

export type CommandSearchExpenseHit = {
  id: string;
  label: string;
  subtitleKey: ExpenseHitSubtitleKey;
};

export type CommandSearchGoalHit = {
  id: string;
  title: string;
};

export type CommandSearchDebtHit = {
  id: string;
  name: string;
};

export type CommandSearchNoteHit = {
  id: string;
  title: string | null;
  snippet: string;
};

export type CommandSearchResult = {
  expenses: CommandSearchExpenseHit[];
  goals: CommandSearchGoalHit[];
  debts: CommandSearchDebtHit[];
  notes: CommandSearchNoteHit[];
};

/** Strip SQL ILIKE wildcard characters from user fragments. */
function sanitizeQuery(q: string): string {
  return q.trim().slice(0, 64).replace(/[%_*\\]/g, "").replace(/\s+/g, " ");
}

/** Build safe ILIKE pattern (no naked % from user alone). */
function ilikePat(safe: string): string {
  if (!safe.length) return "%";
  return `%${safe}%`;
}

function noteSnippet(content: string, safe: string): string {
  const lower = safe.toLowerCase();
  let snippet = content.slice(0, 72);
  const idx = content.toLowerCase().indexOf(lower);
  if (idx >= 0) {
    snippet = content.slice(Math.max(0, idx - 24), idx + safe.length + 48);
  }
  return snippet.replace(/\s+/g, " ").trim();
}

function mergeNoteRows(
  a: Record<string, unknown>[],
  b: Record<string, unknown>[],
  safe: string,
): CommandSearchNoteHit[] {
  const byId = new Map<string, CommandSearchNoteHit>();
  for (const row of [...a, ...b]) {
    const id = row.id as string;
    if (byId.has(id)) continue;
    const title = (row.title as string | null) ?? null;
    const content = String(row.content ?? "");
    byId.set(id, {
      id,
      title,
      snippet: noteSnippet(content, safe),
    });
  }
  return Array.from(byId.values()).slice(0, 8);
}

export async function fetchFinanceCommandSearch(
  supabase: SupabaseClient,
  args: { userId: string; q: string },
): Promise<{ data: CommandSearchResult | null; error: string | null }> {
  const { userId, q } = args;
  const safe = sanitizeQuery(q);
  if (safe.length < 2) {
    return {
      data: {
        expenses: [],
        goals: [],
        debts: [],
        notes: [],
      },
      error: null,
    };
  }

  const pattern = ilikePat(safe);

  try {
    const familyId = await getFamilyIdForUser(supabase, userId);
    if (!familyId) {
      return { data: null, error: "family_not_configured" };
    }

    const [
      varRes,
      recRes,
      recNameRes,
      goalsRes,
      debtsRes,
      notesTitleRes,
      notesContentRes,
    ] = await Promise.all([
      supabase
        .from("variable_expenses")
        .select("id, description, date")
        .eq("family_id", familyId)
        .ilike("description", pattern)
        .order("date", { ascending: false })
        .limit(5),
      supabase
        .from("expense_records")
        .select("id, name")
        .eq("family_id", familyId)
        .ilike("name", pattern)
        .limit(5),
      supabase
        .from("recurring_expenses")
        .select("id, name")
        .eq("family_id", familyId)
        .ilike("name", pattern)
        .limit(5),
      supabase
        .from("goals")
        .select("id, title")
        .eq("family_id", familyId)
        .ilike("title", pattern)
        .limit(5),
      supabase
        .from("debts")
        .select("id, name")
        .eq("family_id", familyId)
        .ilike("name", pattern)
        .limit(5),
      supabase
        .from("notes")
        .select("id, title, content")
        .eq("family_id", familyId)
        .ilike("title", pattern)
        .limit(5),
      supabase
        .from("notes")
        .select("id, title, content")
        .eq("family_id", familyId)
        .ilike("content", pattern)
        .limit(5),
    ]);

    if (varRes.error) throw varRes.error;
    if (recRes.error) throw recRes.error;
    if (recNameRes.error) throw recNameRes.error;
    if (goalsRes.error) throw goalsRes.error;
    if (debtsRes.error) throw debtsRes.error;
    if (notesTitleRes.error) throw notesTitleRes.error;
    if (notesContentRes.error) throw notesContentRes.error;

    const expenseLabels = new Map<string, CommandSearchExpenseHit>();

    for (const row of recNameRes.data ?? []) {
      const id = row.id as string;
      expenseLabels.set(id, {
        id,
        label: row.name as string,
        subtitleKey: "recurring_template",
      });
    }

    for (const row of varRes.data ?? []) {
      const id = row.id as string;
      if (expenseLabels.has(id)) continue;
      expenseLabels.set(id, {
        id,
        label: row.description as string,
        subtitleKey: "variable",
      });
    }

    for (const row of recRes.data ?? []) {
      const id = row.id as string;
      if (expenseLabels.has(id)) continue;
      expenseLabels.set(id, {
        id,
        label: row.name as string,
        subtitleKey: "record",
      });
    }

    const expenses = Array.from(expenseLabels.values()).slice(0, 8);

    return {
      data: {
        expenses,
        goals: (goalsRes.data ?? []).map((g) => ({
          id: g.id as string,
          title: g.title as string,
        })),
        debts: (debtsRes.data ?? []).map((d) => ({
          id: d.id as string,
          name: d.name as string,
        })),
        notes: mergeNoteRows(notesTitleRes.data ?? [], notesContentRes.data ?? [], safe),
      },
      error: null,
    };
  } catch (e) {
    return {
      data: null,
      error: errorMessageFromUnknown(e, "search_failed"),
    };
  }
}
