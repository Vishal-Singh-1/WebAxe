import { mapSeverity } from "./severityMapper.js";
import { extractWCAG } from "./wcagMapper.js";

export function processAxeResults(axeResults) {
  const categorized = {
    CRITICAL: [],
    WARNING: [],
    INFO: []
  };

  if (!axeResults || !axeResults.violations) {
    return categorized;
  }

  axeResults.violations.forEach((violation) => {
    const rawImpact = violation.impact || "minor";
    const impact = rawImpact.toLowerCase();

    const severity = mapSeverity(impact);

    const issue = {
      ruleId: violation.id,
      severity,
      impact,
      description: violation.description || null,
      help: violation.help || null,
      helpUrl: violation.helpUrl || null,

      wcag: extractWCAG(violation.tags || []),

      occurrences: violation.nodes?.length || 0,

      nodes: (violation.nodes || []).map((node) => ({
        html: node.html || null,
        target: node.target || []
      }))
    };

    categorized[severity].push(issue);
  });

  return categorized;
}