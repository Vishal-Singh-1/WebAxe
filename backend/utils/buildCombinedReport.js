function buildCombinedReport(rawReport) {
  const flatIssues = [];
  const audit = rawReport.audit || null;

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
        elements: (issue.nodes || []).map((node) => ({
          selector: node.target?.[0] || null,
          htmlSnippet: node.html || null
        }))
      });
    });
  });

  const totalIssues = flatIssues.length;

  let healthScore = 100;
  Object.keys(severityDistribution).forEach((level) => {
    healthScore -= severityDistribution[level] * weights[level];
  });
  healthScore = Math.max(healthScore, 0);

  if (typeof audit?.overallScore === "number") {
    healthScore = audit.overallScore;
  }

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
    rating: audit
      ? {
          profile: rawReport.scanProfile || null,
          overallScore: audit.overallScore,
          categories: audit.categories || {},
          trustIndicators: audit.trustIndicators || [],
          stats: audit.stats || {}
        }
      : {
          profile: rawReport.scanProfile || null,
          overallScore: healthScore,
          categories: {},
          trustIndicators: [],
          stats: {}
        },
    issues: flatIssues,
    audit: rawReport.audit || null,
    rawIssueGroups: rawReport.issues || {}
  };
}

export default buildCombinedReport;
