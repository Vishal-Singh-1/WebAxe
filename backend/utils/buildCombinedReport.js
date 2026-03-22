function buildCombinedReport(rawReport) {
  const flatIssues = [];

  const severityDistribution = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0
  };

  const weights = {
    critical: 15,
    serious: 10,
    moderate: 5,
    minor: 2
  };

  const issueGroups = rawReport.issues || {};

  Object.keys(issueGroups).forEach(group => {
    (issueGroups[group] || []).forEach(issue => {

      const impact = issue.impact?.toLowerCase() || "minor";

      // Count severity
      if (severityDistribution.hasOwnProperty(impact)) {
        severityDistribution[impact]++;
      }

      // WCAG already structured by wcagMapper
      const wcagData = issue.wcag || {
        tags: [],
        level: null,
        guideline: null
      };

      flatIssues.push({
        id: issue.ruleId,
        severityGroup: group,  // CRITICAL / WARNING / INFO (DB grouping)
        impact,                // critical / serious / moderate / minor (UI severity)

        description: issue.description || null,
        help: issue.help || null,
        helpUrl: issue.helpUrl || null,

        wcag: {
          tags: wcagData.tags || [],
          level: wcagData.level || null,
          guideline: wcagData.guideline || null
        },

        elementsAffected: issue.occurrences || issue.nodes?.length || 0,

        elements: (issue.nodes || []).map(node => ({
          selector: node.target?.[0] || null,
          htmlSnippet: node.html || null
        }))
      });

    });
  });

  // Total issues
  const totalIssues = flatIssues.length;

  // Health score calculation
  let healthScore = 100;

  Object.keys(severityDistribution).forEach(level => {
    healthScore -= severityDistribution[level] * weights[level];
  });

  healthScore = Math.max(healthScore, 0);

  // Grade logic
  function getGrade(score) {
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  return {
    scanId: rawReport.scanId,
    url: rawReport.url,
    status: rawReport.status,
    phase: rawReport.phase,

    timings: rawReport.timings || null,
    artifacts: rawReport.artifacts || null,

    error: rawReport.error || null,
    errorType: rawReport.errorType || null,
    userMessage: rawReport.userMessage || null,

    summary: {
      totalIssues,
      healthScore,
      grade: getGrade(healthScore),
      severityDistribution
    },

    issues: flatIssues,

    // Keep raw grouping for debugging / backward compatibility
    rawIssueGroups: rawReport.issues || {}
  };
}

export default buildCombinedReport;