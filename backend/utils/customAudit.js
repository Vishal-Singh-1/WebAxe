import { CATEGORY_KEYS } from "../config/scanProfiles.js";

const RULE_DEFINITIONS = [
  { id: "https-enabled", name: "HTTPS enabled", category: "security", weight: 3 },
  { id: "ssl-valid", name: "SSL certificate valid", category: "security", weight: 3 },
  { id: "no-mixed-content", name: "No mixed content", category: "security", weight: 2 },
  { id: "csp-header", name: "Content-Security-Policy header", category: "security", weight: 2 },
  { id: "hsts-header", name: "HSTS header", category: "security", weight: 2 },
  { id: "x-frame-options", name: "X-Frame-Options header", category: "security", weight: 1 },
  { id: "secure-cookies", name: "Cookies use Secure flag", category: "security", weight: 2 },
  { id: "http-only-cookies", name: "Cookies use HttpOnly flag", category: "security", weight: 2 },
  { id: "admin-surface", name: "No exposed admin surface", category: "security", weight: 1 },

  { id: "privacy-policy", name: "Privacy policy page exists", category: "privacy", weight: 3 },
  { id: "cookie-banner", name: "Cookie consent banner present", category: "privacy", weight: 2 },
  { id: "tracking-scripts", name: "Tracking scripts declared", category: "privacy", weight: 2 },
  { id: "secure-password-forms", name: "Password fields served securely", category: "privacy", weight: 2 },
  { id: "sensitive-get-forms", name: "No sensitive data in GET forms", category: "privacy", weight: 2 },
  { id: "third-party-integrations", name: "Third-party integrations inventoried", category: "privacy", weight: 1 },

  { id: "alt-text", name: "Images have alt text", category: "accessibility", weight: 3 },
  { id: "heading-structure", name: "Proper heading structure", category: "accessibility", weight: 2 },
  { id: "color-contrast", name: "Color contrast", category: "accessibility", weight: 2 },
  { id: "button-labels", name: "Buttons have labels", category: "accessibility", weight: 2 },
  { id: "keyboard-basics", name: "Keyboard accessibility basics", category: "accessibility", weight: 1 },

  { id: "page-load-time", name: "Page load time", category: "performance", weight: 3 },
  { id: "image-optimization", name: "Image optimization", category: "performance", weight: 2 },
  { id: "asset-weight", name: "JS/CSS weight", category: "performance", weight: 2 },
  { id: "lazy-loading", name: "Lazy loading usage", category: "performance", weight: 1 },
  { id: "broken-links", name: "Broken links", category: "performance", weight: 2 },

  { id: "mobile-responsive", name: "Mobile responsiveness signal", category: "content", weight: 2 },
  { id: "meta-tags", name: "SEO meta tags", category: "content", weight: 2 },
  { id: "favicon", name: "Favicon present", category: "content", weight: 1 },
  { id: "clear-navigation", name: "Clear navigation landmarks", category: "content", weight: 2 },
  { id: "console-errors", name: "No console errors", category: "content", weight: 1 }
];

const RULE_BY_ID = RULE_DEFINITIONS.reduce((acc, rule) => {
  acc[rule.id] = rule;
  return acc;
}, {});

function statusValue(status) {
  switch (status) {
    case "pass":
      return 1;
    case "warn":
      return 0.5;
    case "fail":
      return 0;
    default:
      return null;
  }
}

function clampScore(value) {
  return Math.max(0, Math.min(Math.round(value), 100));
}

function titleCase(input) {
  return String(input || "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function pickImpactFromAxe(axeIssues = [], ruleIds = []) {
  const ranks = { critical: 4, serious: 3, moderate: 2, minor: 1 };
  let highest = "minor";

  axeIssues.forEach((issue) => {
    if (!ruleIds.includes(issue.ruleId)) return;
    const impact = String(issue.impact || "minor").toLowerCase();
    if ((ranks[impact] || 0) > (ranks[highest] || 0)) {
      highest = impact;
    }
  });

  return highest;
}

function buildRuleResult(id, status, message, extra = {}) {
  const rule = RULE_BY_ID[id];
  if (!rule) {
    throw new Error(`Unknown rule: ${id}`);
  }

  const categoryWeight = extra.categoryWeight ?? 1;
  const priorityScore = Number((rule.weight * categoryWeight).toFixed(2));

  return {
    id: rule.id,
    name: rule.name,
    category: rule.category,
    weight: rule.weight,
    priorityScore,
    status,
    message,
    details: extra.details || null,
    source: extra.source || "custom-audit"
  };
}

function buildAccessibilityRules(axeIssues, profile) {
  const hasIssue = (ids) => axeIssues.some((issue) => ids.includes(issue.ruleId));
  const impacts = {
    alt: pickImpactFromAxe(axeIssues, ["image-alt", "input-image-alt"]),
    headings: pickImpactFromAxe(axeIssues, ["heading-order", "empty-heading"]),
    contrast: pickImpactFromAxe(axeIssues, ["color-contrast"]),
    buttons: pickImpactFromAxe(axeIssues, ["button-name", "aria-command-name"]),
    keyboard: pickImpactFromAxe(axeIssues, ["aria-hidden-focus", "focus-order-semantics", "scrollable-region-focusable"])
  };

  return [
    buildRuleResult(
      "alt-text",
      hasIssue(["image-alt", "input-image-alt"]) ? "fail" : "pass",
      hasIssue(["image-alt", "input-image-alt"])
        ? `Axe detected missing or insufficient alternative text (${impacts.alt}).`
        : "No alt-text violations were detected in the automated pass.",
      { source: "axe-core", categoryWeight: profile.weights.accessibility }
    ),
    buildRuleResult(
      "heading-structure",
      hasIssue(["heading-order", "empty-heading"]) ? "warn" : "pass",
      hasIssue(["heading-order", "empty-heading"])
        ? `Heading structure needs review (${impacts.headings}).`
        : "Heading order and naming passed the automated checks.",
      { source: "axe-core", categoryWeight: profile.weights.accessibility }
    ),
    buildRuleResult(
      "color-contrast",
      hasIssue(["color-contrast"]) ? "fail" : "pass",
      hasIssue(["color-contrast"])
        ? `Color contrast issues were found (${impacts.contrast}).`
        : "No color contrast violations were detected.",
      { source: "axe-core", categoryWeight: profile.weights.accessibility }
    ),
    buildRuleResult(
      "button-labels",
      hasIssue(["button-name", "aria-command-name"]) ? "fail" : "pass",
      hasIssue(["button-name", "aria-command-name"])
        ? `Some interactive controls are missing accessible labels (${impacts.buttons}).`
        : "Buttons and command controls appear to be labeled.",
      { source: "axe-core", categoryWeight: profile.weights.accessibility }
    ),
    buildRuleResult(
      "keyboard-basics",
      hasIssue(["aria-hidden-focus", "focus-order-semantics", "scrollable-region-focusable"]) ? "warn" : "pass",
      hasIssue(["aria-hidden-focus", "focus-order-semantics", "scrollable-region-focusable"])
        ? `Keyboard-related heuristics need manual review (${impacts.keyboard}).`
        : "No major keyboard accessibility heuristics were flagged.",
      { source: "axe-core", categoryWeight: profile.weights.accessibility }
    )
  ];
}

export function runCustomAudit(input) {
  const {
    url,
    profile,
    headers = {},
    securityDetails = null,
    cookies = [],
    consoleErrors = [],
    requestFailures = [],
    pageSignals = {},
    axeIssues = []
  } = input;

  const lowerHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  const mixedContentCount = Array.isArray(pageSignals.mixedContent)
    ? pageSignals.mixedContent.length
    : 0;
  const insecureCookies = cookies.filter((cookie) => !cookie.secure);
  const nonHttpOnlyCookies = cookies.filter((cookie) => !cookie.httpOnly);
  const trackingScripts = Array.isArray(pageSignals.trackingScripts) ? pageSignals.trackingScripts : [];
  const passwordForms = Array.isArray(pageSignals.passwordForms) ? pageSignals.passwordForms : [];
  const sensitiveGetForms = passwordForms.filter((form) => form.method === "get");
  const thirdPartyIntegrations = Array.isArray(pageSignals.thirdPartyIntegrations)
    ? pageSignals.thirdPartyIntegrations
    : [];
  const navCount = Number(pageSignals.navCount || 0);
  const brokenLinks = Array.isArray(requestFailures) ? requestFailures : [];
  const pageMetrics = pageSignals.performance || {};
  const totalAssetKb = Math.round(((pageMetrics.totalTransferSize || 0) / 1024) * 10) / 10;
  const jsCssKb = Math.round((((pageMetrics.jsTransferSize || 0) + (pageMetrics.cssTransferSize || 0)) / 1024) * 10) / 10;
  const modernImageRatio = Number(pageSignals.imageOptimization?.modernFormatRatio || 0);
  const lazyImageRatio = Number(pageSignals.imageOptimization?.lazyImageRatio || 0);
  const hasMetaViewport = !!pageSignals.metaViewport;
  const hasMetaDescription = !!pageSignals.metaDescription;
  const hasTitle = !!pageSignals.title;
  const contactSignals = pageSignals.contactSignals || {};
  const trustedSsl = !!securityDetails?.issuer;

  const ruleResults = [
    buildRuleResult(
      "https-enabled",
      String(url || "").startsWith("https://") ? "pass" : "fail",
      String(url || "").startsWith("https://")
        ? "The scanned page loaded over HTTPS."
        : "The page loaded over HTTP, which lowers transport security.",
      { categoryWeight: profile.weights.security }
    ),
    buildRuleResult(
      "ssl-valid",
      securityDetails ? "pass" : "warn",
      securityDetails
        ? `TLS details were exposed by the browser. Issuer: ${securityDetails.issuer || "Unknown"}, valid to ${securityDetails.validTo || "unknown"}.`
        : "TLS certificate details were not available from the browser response.",
      {
        categoryWeight: profile.weights.security,
        details: securityDetails
      }
    ),
    buildRuleResult(
      "no-mixed-content",
      mixedContentCount === 0 ? "pass" : "fail",
      mixedContentCount === 0
        ? "No HTTP subresources were detected on the page."
        : `${mixedContentCount} HTTP subresource(s) were detected on an HTTPS page.`,
      {
        categoryWeight: profile.weights.security,
        details: pageSignals.mixedContent || []
      }
    ),
    buildRuleResult(
      "csp-header",
      lowerHeaders["content-security-policy"] ? "pass" : "warn",
      lowerHeaders["content-security-policy"]
        ? "A Content-Security-Policy header was present."
        : "No Content-Security-Policy header was detected on the main response.",
      { categoryWeight: profile.weights.security }
    ),
    buildRuleResult(
      "hsts-header",
      lowerHeaders["strict-transport-security"] ? "pass" : "warn",
      lowerHeaders["strict-transport-security"]
        ? "Strict-Transport-Security was present."
        : "Strict-Transport-Security was not detected.",
      { categoryWeight: profile.weights.security }
    ),
    buildRuleResult(
      "x-frame-options",
      lowerHeaders["x-frame-options"] ? "pass" : "warn",
      lowerHeaders["x-frame-options"]
        ? "X-Frame-Options was present."
        : "X-Frame-Options was not detected.",
      { categoryWeight: profile.weights.security }
    ),
    buildRuleResult(
      "secure-cookies",
      cookies.length === 0 ? "warn" : insecureCookies.length === 0 ? "pass" : "fail",
      cookies.length === 0
        ? "No cookies were observed during the scan."
        : insecureCookies.length === 0
          ? "Observed cookies used the Secure flag."
          : `${insecureCookies.length} cookie(s) were missing the Secure flag.`,
      {
        categoryWeight: profile.weights.security,
        details: insecureCookies.map((cookie) => cookie.name)
      }
    ),
    buildRuleResult(
      "http-only-cookies",
      cookies.length === 0 ? "warn" : nonHttpOnlyCookies.length === 0 ? "pass" : "fail",
      cookies.length === 0
        ? "No cookies were observed during the scan."
        : nonHttpOnlyCookies.length === 0
          ? "Observed cookies used the HttpOnly flag."
          : `${nonHttpOnlyCookies.length} cookie(s) were missing the HttpOnly flag.`,
      {
        categoryWeight: profile.weights.security,
        details: nonHttpOnlyCookies.map((cookie) => cookie.name)
      }
    ),
    buildRuleResult(
      "admin-surface",
      Array.isArray(pageSignals.adminLinks) && pageSignals.adminLinks.length > 0 ? "warn" : "pass",
      Array.isArray(pageSignals.adminLinks) && pageSignals.adminLinks.length > 0
        ? "The page exposes admin-like routes in visible links."
        : "No obvious admin routes were exposed in the scanned page markup.",
      {
        categoryWeight: profile.weights.security,
        details: pageSignals.adminLinks || []
      }
    ),

    buildRuleResult(
      "privacy-policy",
      pageSignals.privacyPolicy?.exists ? "pass" : "fail",
      pageSignals.privacyPolicy?.exists
        ? `Privacy policy signal found: ${pageSignals.privacyPolicy.match || "policy link detected"}.`
        : "No privacy policy signal was detected on the page.",
      { categoryWeight: profile.weights.privacy }
    ),
    buildRuleResult(
      "cookie-banner",
      pageSignals.cookieBanner?.present ? "pass" : "warn",
      pageSignals.cookieBanner?.present
        ? "A cookie or consent banner signal was detected."
        : "No cookie consent banner was detected on the scanned page.",
      { categoryWeight: profile.weights.privacy }
    ),
    buildRuleResult(
      "tracking-scripts",
      trackingScripts.length === 0 ? "pass" : "warn",
      trackingScripts.length === 0
        ? "No common analytics or ad tracking libraries were detected."
        : `Tracking-related scripts detected: ${trackingScripts.join(", ")}.`,
      {
        categoryWeight: profile.weights.privacy,
        details: trackingScripts
      }
    ),
    buildRuleResult(
      "secure-password-forms",
      passwordForms.length === 0 ? "warn" : String(url || "").startsWith("https://") ? "pass" : "fail",
      passwordForms.length === 0
        ? "No password fields were found on the scanned page."
        : String(url || "").startsWith("https://")
          ? "Password fields were found on an HTTPS page."
          : "Password fields were found on a non-HTTPS page.",
      {
        categoryWeight: profile.weights.privacy,
        details: passwordForms
      }
    ),
    buildRuleResult(
      "sensitive-get-forms",
      sensitiveGetForms.length === 0 ? "pass" : "fail",
      sensitiveGetForms.length === 0
        ? "No sensitive GET forms were detected."
        : `${sensitiveGetForms.length} form(s) with password fields use GET and should be reviewed.`,
      {
        categoryWeight: profile.weights.privacy,
        details: sensitiveGetForms
      }
    ),
    buildRuleResult(
      "third-party-integrations",
      thirdPartyIntegrations.length > 0 ? "pass" : "warn",
      thirdPartyIntegrations.length > 0
        ? `${thirdPartyIntegrations.length} third-party integration host(s) were inventoried.`
        : "No third-party integration hosts were inventoried from scripts, images, or frames.",
      {
        categoryWeight: profile.weights.privacy,
        details: thirdPartyIntegrations
      }
    ),

    ...buildAccessibilityRules(axeIssues, profile),

    buildRuleResult(
      "page-load-time",
      pageMetrics.loadEventEndMs <= 3000 ? "pass" : pageMetrics.loadEventEndMs <= 6000 ? "warn" : "fail",
      pageMetrics.loadEventEndMs
        ? `Window load completed in ${pageMetrics.loadEventEndMs} ms.`
        : "Page load timing was not available.",
      {
        categoryWeight: profile.weights.performance,
        details: pageMetrics
      }
    ),
    buildRuleResult(
      "image-optimization",
      pageSignals.imageCount === 0 ? "warn" : modernImageRatio >= 0.6 ? "pass" : modernImageRatio >= 0.3 ? "warn" : "fail",
      pageSignals.imageCount === 0
        ? "No images were detected on the scanned page."
        : `${pageSignals.imageCount} image(s) detected. Modern-format ratio: ${Math.round(modernImageRatio * 100)}%.`,
      {
        categoryWeight: profile.weights.performance,
        details: pageSignals.imageOptimization || null
      }
    ),
    buildRuleResult(
      "asset-weight",
      jsCssKb <= 700 ? "pass" : jsCssKb <= 1500 ? "warn" : "fail",
      `Transferred JS/CSS weight was about ${jsCssKb} KB (total assets: ${totalAssetKb} KB).`,
      {
        categoryWeight: profile.weights.performance,
        details: pageMetrics
      }
    ),
    buildRuleResult(
      "lazy-loading",
      pageSignals.imageCount === 0 ? "warn" : lazyImageRatio >= 0.5 ? "pass" : lazyImageRatio >= 0.2 ? "warn" : "fail",
      pageSignals.imageCount === 0
        ? "No images were present, so lazy loading was not applicable."
        : `${Math.round(lazyImageRatio * 100)}% of images used lazy loading.`,
      {
        categoryWeight: profile.weights.performance,
        details: pageSignals.imageOptimization || null
      }
    ),
    buildRuleResult(
      "broken-links",
      brokenLinks.length === 0 ? "pass" : brokenLinks.length <= 3 ? "warn" : "fail",
      brokenLinks.length === 0
        ? "No failed page/resource requests were detected by the browser."
        : `${brokenLinks.length} failed request(s) were observed while loading the page.`,
      {
        categoryWeight: profile.weights.performance,
        details: brokenLinks.slice(0, 10)
      }
    ),

    buildRuleResult(
      "mobile-responsive",
      hasMetaViewport ? "pass" : "warn",
      hasMetaViewport
        ? "A responsive viewport meta tag was present."
        : "No responsive viewport meta tag was detected.",
      { categoryWeight: profile.weights.content }
    ),
    buildRuleResult(
      "meta-tags",
      hasTitle && hasMetaDescription ? "pass" : hasTitle || hasMetaDescription ? "warn" : "fail",
      hasTitle && hasMetaDescription
        ? "Title and meta description were both present."
        : hasTitle || hasMetaDescription
          ? "Only part of the basic metadata set was detected."
          : "Neither title nor meta description was detected.",
      { categoryWeight: profile.weights.content }
    ),
    buildRuleResult(
      "favicon",
      pageSignals.favicon ? "pass" : "warn",
      pageSignals.favicon
        ? "A favicon link was detected."
        : "No favicon link was detected.",
      { categoryWeight: profile.weights.content }
    ),
    buildRuleResult(
      "clear-navigation",
      navCount > 0 ? "pass" : "warn",
      navCount > 0
        ? `${navCount} navigation landmark(s) detected.`
        : "No clear navigation landmarks were detected.",
      { categoryWeight: profile.weights.content }
    ),
    buildRuleResult(
      "console-errors",
      consoleErrors.length === 0 ? "pass" : consoleErrors.length <= 3 ? "warn" : "fail",
      consoleErrors.length === 0
        ? "No console errors were observed during the scan."
        : `${consoleErrors.length} console error(s) were observed during the scan.`,
      {
        categoryWeight: profile.weights.content,
        details: consoleErrors.slice(0, 10)
      }
    )
  ];

  const categories = CATEGORY_KEYS.reduce((acc, key) => {
    const categoryRules = ruleResults.filter((rule) => rule.category === key);
    const weighted = categoryRules.reduce(
      (state, rule) => {
        const value = statusValue(rule.status);
        if (value === null) return state;
        state.totalWeight += rule.weight;
        state.earned += value * rule.weight;
        return state;
      },
      { totalWeight: 0, earned: 0 }
    );

    const score =
      weighted.totalWeight > 0 ? clampScore((weighted.earned / weighted.totalWeight) * 100) : 100;

    acc[key] = {
      score,
      weight: profile.weights[key],
      label: titleCase(key),
      pass: categoryRules.filter((rule) => rule.status === "pass").length,
      warn: categoryRules.filter((rule) => rule.status === "warn").length,
      fail: categoryRules.filter((rule) => rule.status === "fail").length,
      rules: categoryRules.length
    };

    return acc;
  }, {});

  const overallScore = clampScore(
    CATEGORY_KEYS.reduce((sum, key) => sum + categories[key].score * (profile.weights[key] || 0), 0)
  );

  const trustIndicators = [
    {
      id: "ssl-verified",
      label: "SSL verified",
      status: securityDetails ? "pass" : "warn",
      message: securityDetails
        ? `Certificate issuer: ${securityDetails.issuer || "Unknown"}`
        : "Certificate details were not available."
    },
    {
      id: "mixed-content",
      label: "Mixed content",
      status: mixedContentCount === 0 ? "pass" : "fail",
      message: mixedContentCount === 0 ? "No mixed content detected." : "Mixed content detected."
    },
    {
      id: "security-headers",
      label: "Core security headers",
      status:
        lowerHeaders["content-security-policy"] &&
        lowerHeaders["strict-transport-security"] &&
        lowerHeaders["x-frame-options"]
          ? "pass"
          : "warn",
      message:
        lowerHeaders["content-security-policy"] &&
        lowerHeaders["strict-transport-security"] &&
        lowerHeaders["x-frame-options"]
          ? "CSP, HSTS, and X-Frame-Options were present."
          : "One or more core security headers were missing."
    },
    {
      id: "contact-info",
      label: "Contact info present",
      status: contactSignals.hasContactInfo ? "pass" : "warn",
      message: contactSignals.hasContactInfo
        ? "Contact email, phone, or contact page signal found."
        : "No strong contact-info signal was found."
    }
  ];

  return {
    profile,
    overallScore,
    categories,
    ruleResults,
    trustIndicators,
    stats: {
      totalRules: ruleResults.length,
      passedRules: ruleResults.filter((rule) => rule.status === "pass").length,
      warningRules: ruleResults.filter((rule) => rule.status === "warn").length,
      failedRules: ruleResults.filter((rule) => rule.status === "fail").length
    },
    evidence: {
      headers: lowerHeaders,
      securityDetails,
      cookies: cookies.map((cookie) => ({
        name: cookie.name,
        domain: cookie.domain,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly
      })),
      trackingScripts,
      integrations: thirdPartyIntegrations
    }
  };
}
