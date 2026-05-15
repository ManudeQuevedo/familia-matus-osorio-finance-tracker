import { NextResponse } from "next/server";

import {
  fetchNotesSnapshot,
  fetchTodayReminders,
} from "@/lib/finance/notes-queries";
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
  if (url.searchParams.get("todayReminders") === "1") {
    const { data, error } = await fetchTodayReminders(supabase, user.id);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
    return NextResponse.json({ reminders: data });
  }

  const { data, error } = await fetchNotesSnapshot(supabase, user.id);
  if (error || !data) {
    return NextResponse.json(
      { error: error ?? "Failed to load notes" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}
