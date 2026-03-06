export function extractWCAG(tags = []) {
  const wcagTags = tags.filter(tag => tag.toLowerCase().startsWith("wcag"));

  let level = null;
  let guideline = null;

  wcagTags.forEach(tag => {
    const lower = tag.toLowerCase();

    // Detect level properly (order matters)
    if (lower.includes("wcag2aaa")) {
      level = "AAA";
    } else if (lower.includes("wcag2aa")) {
      level = "AA";
    } else if (lower.includes("wcag2a")) {
      level = "A";
    }

    // Extract guideline like 1.4.3
    const match = lower.match(/\d+\.\d+\.\d+/);
    if (match) {
      guideline = match[0];
    }
  });

  return {
    tags: wcagTags,
    level,
    guideline
  };
}
