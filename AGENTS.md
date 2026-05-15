<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Proxy vs middleware (this repo)

Internationalization uses **`src/proxy.ts`** (Next.js 16 convention). **Do not add `src/middleware.ts` or root `middleware.ts`:** Next.js errors if both `middleware` and `proxy` exist. All request interception for locales belongs in `src/proxy.ts`.
