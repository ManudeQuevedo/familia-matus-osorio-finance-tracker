import { NextResponse } from "next/server";

import {
  fetchReportsSnapshot,
  type ReportPeriodType,
} from "@/lib/finance/reports-queries";
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
  const periodType = (url.searchParams.get("periodType") ??
    "monthly") as ReportPeriodType;
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

  if (!["monthly", "quarterly", "annual"].includes(periodType)) {
    return NextResponse.json({ error: "Invalid period type" }, { status: 400 });
  }

  const { data, error } = await fetchReportsSnapshot(supabase, {
    periodType,
    year,
    month,
    locale,
  });

  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Failed to load reports" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
