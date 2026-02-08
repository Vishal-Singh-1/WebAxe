const { mapSeverity } = require("./severityMapper");
const { extractWCAG } = require("./wcagMapper");

function processAxeResults(axeResults) {
  const categorized = {
    CRITICAL: [],
    WARNING: [],
    INFO: []
  };

  axeResults.violations.forEach((violation) => {
    const severity = mapSeverity(violation.impact);

    const issue = {
      ruleId: violation.id,
      severity,
      impact: violation.impact,
      description: violation.description,
      help: violation.help,
      helpUrl: violation.helpUrl,
      wcag: extractWCAG(violation.tags),
      occurrences: violation.nodes.length,
      nodes: violation.nodes.map(node => ({
        html: node.html,
        target: node.target
      }))
    };

    categorized[severity].push(issue);
  });

  return categorized;
}

module.exports = { processAxeResults };
