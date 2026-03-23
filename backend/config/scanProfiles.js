export const CATEGORY_KEYS = [
  "security",
  "privacy",
  "accessibility",
  "performance",
  "content"
];

const PROFILE_DEFINITIONS = {
  general: {
    label: "General website",
    weights: {
      security: 0.35,
      privacy: 0.25,
      accessibility: 0.15,
      performance: 0.15,
      content: 0.1
    }
  },
  kids: {
    label: "Kids website",
    weights: {
      security: 0.25,
      privacy: 0.4,
      accessibility: 0.2,
      performance: 0,
      content: 0.15
    }
  },
  healthcare: {
    label: "Healthcare",
    weights: {
      security: 0.5,
      privacy: 0.3,
      accessibility: 0.1,
      performance: 0.1,
      content: 0
    }
  },
  government: {
    label: "Government",
    weights: {
      security: 0.3,
      privacy: 0.2,
      accessibility: 0.35,
      performance: 0,
      content: 0.15
    }
  },
  ecommerce: {
    label: "E-commerce",
    weights: {
      security: 0.4,
      privacy: 0.3,
      accessibility: 0,
      performance: 0.2,
      content: 0.1
    }
  }
};

function normalizeWeights(rawWeights = {}) {
  const seeded = CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = Number(rawWeights[key] || 0);
    return acc;
  }, {});

  const total = Object.values(seeded).reduce((sum, value) => sum + value, 0) || 1;

  return CATEGORY_KEYS.reduce((acc, key) => {
    acc[key] = Number((seeded[key] / total).toFixed(4));
    return acc;
  }, {});
}

export function listScanProfiles() {
  return Object.entries(PROFILE_DEFINITIONS).map(([key, value]) => ({
    key,
    label: value.label,
    weights: normalizeWeights(value.weights)
  }));
}

export function resolveScanProfile(input) {
  const key = String(input || "general").trim().toLowerCase();
  const profile = PROFILE_DEFINITIONS[key] || PROFILE_DEFINITIONS.general;
  const resolvedKey = PROFILE_DEFINITIONS[key] ? key : "general";

  return {
    key: resolvedKey,
    label: profile.label,
    weights: normalizeWeights(profile.weights)
  };
}
