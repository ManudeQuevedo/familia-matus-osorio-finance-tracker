import { NextResponse } from "next/server";

import { fetchDebtsSnapshot } from "@/lib/finance/debts-queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const now = new Date();
  const year = Number.parseInt(
    url.searchParams.get("year") ?? String(now.getFullYear()),
    10,
  );
  const month = Number.parseInt(
    url.searchParams.get("month") ?? String(now.getMonth() + 1),
    10,
  );
  const localeParam = url.searchParams.get("locale") ?? "en";
  const locale = localeParam === "es" ? "es" : "en";

  const { data, error } = await fetchDebtsSnapshot(supabase, {
    userId: user.id,
    year,
    month,
    locale,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Failed to load debts" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
