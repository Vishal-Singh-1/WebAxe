function extractJsonObject(text = "") {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export async function generateAiSuggestions({ scan, recommendations }) {
  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  const placeholderKeys = new Set(["your_key_here", "your-api-key-here", "replace_me"]);

  if (placeholderKeys.has(apiKey.toLowerCase())) {
    return {
      aiUsed: false,
      reason: "OPENAI_API_KEY is still set to a placeholder value",
      suggestionsByIssueId: {}
    };
  }

  if (!apiKey) {
    return {
      aiUsed: false,
      reason: "OPENAI_API_KEY missing",
      suggestionsByIssueId: {}
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 20000);

  const compactIssues = recommendations.map((r) => ({
    issueId: r.issueId,
    impact: r.impact,
    wcag: r.wcag,
    occurrences: r.occurrences,
    sampleSelectors: r.sampleSelectors,
    helpUrl: r.helpUrl,
    title: r.title,
    whyItMatters: r.whyItMatters
  }));

  const systemPrompt =
    "You are an accessibility expert. Return concise engineering-friendly remediation advice as strict JSON only.";
  const userPrompt = JSON.stringify(
    {
      task: "Generate accessibility recommendations for these issues.",
      constraints: [
        "Return strict JSON object only.",
        "Use this shape: { recommendations: [{ issueId, problemCode, suggestedFix, whyItMatters }] }",
        "problemCode should be short HTML/CSS/JS snippet when helpful; empty string otherwise.",
        "Keep suggestedFix practical and specific.",
        "Do not add markdown fences."
      ],
      context: {
        scanId: scan.scanId,
        url: scan.url
      },
      issues: compactIssues
    },
    null,
    2
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        aiUsed: false,
        reason: `AI request failed: ${response.status} ${errorText}`,
        suggestionsByIssueId: {}
      };
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || "";
    const jsonText = extractJsonObject(content);
    if (!jsonText) {
      return {
        aiUsed: false,
        reason: "AI response did not contain JSON",
        suggestionsByIssueId: {}
      };
    }

    const parsed = JSON.parse(jsonText);
    const list = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
    const suggestionsByIssueId = {};

    for (const item of list) {
      if (!item?.issueId) continue;
      suggestionsByIssueId[item.issueId] = {
        problemCode: item.problemCode || "",
        suggestedFix: item.suggestedFix || "",
        whyItMatters: item.whyItMatters || ""
      };
    }

    return {
      aiUsed: true,
      reason: null,
      suggestionsByIssueId
    };
  } catch (error) {
    return {
      aiUsed: false,
      reason: `AI request error: ${error.message}`,
      suggestionsByIssueId: {}
    };
  } finally {
    clearTimeout(timeout);
  }
}
