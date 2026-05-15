import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { createSupabaseMiddlewareClient } from "./lib/supabase/middleware";

/**
 * Request interception for i18n + Supabase session refresh + auth gates.
 *
 * Do **not** add `middleware.ts` at the repo root: Next.js errors if both `middleware`
 * and `proxy` exist. All interception lives here (Next.js 16 `proxy` convention).
 */
const intlMiddleware = createIntlMiddleware(routing);

const LOCALES = new Set(routing.locales);

function stripLocale(pathname: string): {
  locale: string;
  pathnameWithoutLocale: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && LOCALES.has(first as (typeof routing.locales)[number])) {
    const rest = segments.slice(1);
    return {
      locale: first,
      pathnameWithoutLocale: rest.length ? `/${rest.join("/")}` : "/",
    };
  }

  return { locale: routing.defaultLocale, pathnameWithoutLocale: pathname };
}

function isSafeRelativeNextPath(next: string): boolean {
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("://");
}

function needsMfaStep(aal: {
  currentLevel: string | null;
  nextLevel: string | null;
} | null): boolean {
  if (!aal) {
    return false;
  }
  return aal.currentLevel === "aal1" && aal.nextLevel === "aal2";
}

export async function proxy(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  const supabase = createSupabaseMiddlewareClient(request, intlResponse);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const { locale, pathnameWithoutLocale } = stripLocale(pathname);

  const isLogin = pathnameWithoutLocale === "/login";
  const isPublic = isLogin;

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaIncomplete = needsMfaStep(aalData);

  if (user && mfaIncomplete && !isLogin) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLogin && user && !mfaIncomplete) {
    const next = request.nextUrl.searchParams.get("next");
    const target =
      next && isSafeRelativeNextPath(next)
        ? new URL(next, request.url)
        : new URL(`/${locale}/dashboard`, request.url);
    return NextResponse.redirect(target);
  }

  if (!isPublic && !user) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
