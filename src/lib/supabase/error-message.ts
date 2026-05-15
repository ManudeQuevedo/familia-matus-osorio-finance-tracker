/** PostgREST / Supabase client errors are often plain objects with `.message`, not `instanceof Error`. */
export function errorMessageFromUnknown(e: unknown, fallback = "Unknown error"): string {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === "string" && e.length > 0) return e;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.length > 0) return o.message;
    if (typeof o.error_description === "string") return o.error_description;
    if (typeof o.details === "string" && o.details.length > 0) return o.details;
    if (typeof o.hint === "string" && o.hint.length > 0) return o.hint;
    if (typeof o.code === "string" && o.code.length > 0) return o.code;
  }
  return fallback;
}
