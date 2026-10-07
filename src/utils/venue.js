/**
 * A venue name → a Google Maps link the visitor can actually follow.
 *
 * The Samithi publishes one venue — the Sri Krishna Temple in Darsait — and it
 * is stored as text on every program row, not as coordinates. So the link is a
 * plain search for that text: no address is invented, and a venue typed into
 * the dashboard tomorrow gets directions too.
 *
 * Returns "" for an empty venue, so callers can drop the button rather than
 * render a link that goes nowhere.
 */
export function directionsUrl(venue) {
  const query = String(venue || "").trim();
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
