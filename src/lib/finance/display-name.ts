/** Friendly display name: profile full_name, else capitalized email local-part. */
export function getDisplayName(
  fullName: string | null | undefined,
  email: string | null | undefined,
  fallback = "You",
): string {
  const trimmed = fullName?.trim();
  if (trimmed) return trimmed;

  if (email) {
    const local = email.split("@")[0]?.trim();
    if (local) {
      const segment = (local.split(/[._-]/)[0] ?? local).trim();
      if (segment) {
        return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
      }
    }
  }

  return fallback;
}
