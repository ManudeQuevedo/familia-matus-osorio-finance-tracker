import { NextResponse } from "next/server";

import { isAllowedAuthEmail, normalizeEmail } from "@/lib/auth/allowed-emails";

type Body = {
  email?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!email) {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }

  if (!isAllowedAuthEmail(email)) {
    return NextResponse.json(
      { error: "unauthorized_email", message: "Acceso no autorizado" },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}
