export function mapSeverity(impact) {
  if (!impact) return "INFO";

  const normalized = impact.toLowerCase();

  switch (normalized) {
    case "critical":
    case "serious":
      return "CRITICAL";

    case "moderate":
      return "WARNING";

    case "minor":
    default:
      return "INFO";
  }
}