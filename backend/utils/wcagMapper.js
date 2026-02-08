function extractWCAG(tags = []) {
  return tags.filter(tag => tag.startsWith("wcag"));
}

module.exports = { extractWCAG };
