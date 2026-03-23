/**
 * Normalize URL for grouping repeated scans of the "same" site.
 * Strips hash, trims trailing slash on path (except root).
 */
export default function normalizeUrl(input) {
  if (!input || typeof input !== "string") return "";
  try {
    const u = new URL(input.trim());
    u.hash = "";
    let p = u.pathname;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    u.pathname = p || "/";
    return u.href;
  } catch {
    return String(input).trim();
  }
}
