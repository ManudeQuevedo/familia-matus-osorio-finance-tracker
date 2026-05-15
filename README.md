# Finance tracker

Next.js app (App Router) for a **family finance panel**: Supabase email/password auth, optional **TOTP MFA**, `next-intl` (`en` / `es`), and route protection via **`src/proxy.ts`** (not `middleware.ts` — see `AGENTS.md`).

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Allowed sign-in emails are defined in `src/lib/auth/allowed-emails.ts`.

```bash
npm run dev
```

## SQL

`sql/family_finance_schema.sql` is kept for the finance data model (run against your Postgres/Supabase as needed).
