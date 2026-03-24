function mapRuleStatusToImpact(status) {
  switch (String(status || "").toLowerCase()) {
    case "fail":
      return "serious";
    case "warn":
      return "moderate";
    default:
      return "minor";
  }
}

function mapRuleStatusToSeverityGroup(status) {
  switch (String(status || "").toLowerCase()) {
    case "fail":
      return "WARNING";
    case "warn":
      return "INFO";
    default:
      return "INFO";
  }
}

function buildIssueFromRule(rule) {
  return {
    id: rule.id,
    ruleId: rule.id,
    severityGroup: mapRuleStatusToSeverityGroup(rule.status),
    impact: mapRuleStatusToImpact(rule.status),
    description:
      rule.message ||
      "This is a high-level audit finding from the custom scan rules, not a direct axe element violation.",
    help: rule.name || rule.id || "Audit issue",
    helpUrl: null,
    wcag: {
      tags: [],
      level: null,
      guideline: null
    },
    elementsAffected: 0,
    occurrences: 0,
    nodes: [],
    elements: [],
    source: "custom-audit",
    category: rule.category || "content"
  };
}

export function normalizeIssues(rawReport) {
  const flatIssues = [];
  const severityDistribution = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  };

  const issueGroups = rawReport?.issues || {};

  Object.keys(issueGroups).forEach((group) => {
    (issueGroups[group] || []).forEach((issue) => {
      const impact = issue.impact?.toLowerCase() || "minor";

      if (Object.prototype.hasOwnProperty.call(severityDistribution, impact)) {
        severityDistribution[impact] += 1;
      }

      const wcagData = issue.wcag || {
        tags: [],
        level: null,
        guideline: null
      };

      flatIssues.push({
        id: issue.ruleId,
        ruleId: issue.ruleId,
        severityGroup: group,
        impact,
        description: issue.description || null,
        help: issue.help || null,
        helpUrl: issue.helpUrl || null,
        wcag: {
          tags: wcagData.tags || [],
          level: wcagData.level || null,
          guideline: wcagData.guideline || null
        },
        elementsAffected: issue.occurrences || issue.nodes?.length || 0,
        occurrences: issue.occurrences || issue.nodes?.length || 0,
        nodes: issue.nodes || [],
        elements: (issue.nodes || []).map((node) => ({
          selector: node.target?.[0] || null,
          htmlSnippet: node.html || null
        })),
        source: "axe-core"
      });
    });
  });

  if (flatIssues.length > 0) {
    return { issues: flatIssues, severityDistribution };
  }

  const ruleResults = Array.isArray(rawReport?.audit?.ruleResults) ? rawReport.audit.ruleResults : [];
  const fallbackIssues = ruleResults
    .filter((rule) => ["fail", "warn"].includes(String(rule.status || "").toLowerCase()))
    .map(buildIssueFromRule);

  fallbackIssues.forEach((issue) => {
    if (Object.prototype.hasOwnProperty.call(severityDistribution, issue.impact)) {
      severityDistribution[issue.impact] += 1;
    }
  });

  return {
    issues: fallbackIssues,
    severityDistribution
  };
}
