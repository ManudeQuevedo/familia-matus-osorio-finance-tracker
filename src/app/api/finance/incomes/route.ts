import { NextResponse } from "next/server";

import { fetchIncomesSnapshot } from "@/lib/finance/incomes-queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12
  ) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const { data, error } = await fetchIncomesSnapshot(supabase, {
    userId: user.id,
    year,
    month,
    locale,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Failed to load incomes" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
