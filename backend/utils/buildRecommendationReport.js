function toIssueList(issueGroups = {}) {
  return Object.entries(issueGroups).flatMap(([group, issues]) =>
    (issues || []).map((issue) => ({ ...issue, severityGroup: group }))
  );
}

function buildFixSuggestion(issue) {
  const selectors = (issue.nodes || [])
    .map((n) => n?.target?.[0])
    .filter(Boolean)
    .slice(0, 3);

  return {
    issueId: issue.ruleId || "unknown-rule",
    impact: issue.impact || "minor",
    severityGroup: issue.severityGroup || "INFO",
    title: issue.help || issue.ruleId || "Accessibility issue",
    whyItMatters:
      issue.description ||
      "This issue may reduce accessibility for users relying on assistive technologies.",
    suggestedFix:
      "Inspect affected elements, follow WCAG guidance for this rule, and update markup/ARIA to ensure semantic and keyboard-accessible behavior.",
    wcag: issue.wcag || { tags: [], level: null, guideline: null },
    occurrences: issue.occurrences || 0,
    sampleSelectors: selectors,
    helpUrl: issue.helpUrl || null
  };
}

export default function buildRecommendationReport({ scan, reportId }) {
  const issueList = toIssueList(scan?.issues || {});
  const recommendations = issueList.map(buildFixSuggestion);

  return {
    reportId,
    scanId: scan.scanId,
    url: scan.url,
    generatedAt: new Date().toISOString(),
    source: "rule-based-recommendation-generator",
    summary: {
      totalRecommendations: recommendations.length
    },
    recommendations
  };
}
