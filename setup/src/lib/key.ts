export function normalizeKeyFromEvent(e: KeyboardEvent): string {
  if (e.key === " " || e.code === "Space") return "Space";
  if (typeof e.key === "string" && e.key.length === 1) return e.key.toLowerCase();
  return e.key; // ArrowUp, Enter, Escape, etc.
}