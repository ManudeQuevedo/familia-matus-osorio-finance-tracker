/** First word of full name, else email local-part, else fallback. */
export function shortAccountName(
  fullName: string | null,
  email: string | null,
  fallback: string,
): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    const first = trimmed.split(/\s+/)[0];
    return first && first.length > 0 ? first : trimmed;
  }
  if (email) {
    const local = email.split("@")[0];
    return local && local.length > 0 ? local : email;
  }
  return fallback;
}

/** Full name, else email, else fallback — for sidebar label / menu subtitle context. */
export function accountDisplayTitle(
  fullName: string | null,
  email: string | null,
  fallback: string,
): string {
  const trimmed = fullName?.trim();
  if (trimmed) return trimmed;
  if (email) return email;
  return fallback;
}

export function accountInitials(
  fullName: string | null,
  email: string | null,
): string {
  const trimmed = fullName?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]![0];
      const b = parts[parts.length - 1]![0];
      if (a && b) return `${a}${b}`.toUpperCase();
    }
    const w = parts[0]!;
    return w.slice(0, Math.min(2, w.length)).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}
