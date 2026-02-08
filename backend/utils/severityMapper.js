function mapSeverity(impact) {
  switch (impact) {
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

module.exports = { mapSeverity };
