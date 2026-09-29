/** Dates in the dashboard: readable, unambiguous, Muscat-friendly. */
export function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

export const toInput = (iso) => (iso ? String(iso).slice(0, 16) : "");
export const toIso = (local) => (local ? new Date(local).toISOString() : null);
