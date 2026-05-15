const ALLOWED = new Set([
  "manuel.matusdequevedo@gmail.com",
  "carolina.matus.osorio@gmail.com",
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedAuthEmail(email: string): boolean {
  return ALLOWED.has(normalizeEmail(email));
}
