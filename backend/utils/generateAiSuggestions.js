export async function generateAiSuggestions() {
  return {
    aiUsed: false,
    reason: "AI suggestions disabled. Using rule-based recommendations.",
    suggestionsByIssueId: {}
  };
}
