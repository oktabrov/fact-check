const definitions = [
  {
    key: "international-institutions",
    label: "International institutions",
    description: "Intergovernmental bodies, multilateral agencies, and international standards organisations.",
  },
  {
    key: "government-and-law",
    label: "Government and law",
    description: "Official government services, legislation, public administration, and public notices.",
  },
  {
    key: "economy-and-finance",
    label: "Economy and finance",
    description: "Central banks, financial regulators, official statistics, and public economic policy.",
  },
  {
    key: "public-health",
    label: "Public health",
    description: "Health ministries, national health agencies, medicine regulators, and disease surveillance.",
  },
  {
    key: "weather-and-emergencies",
    label: "Weather and emergencies",
    description: "Official weather, disaster, civil-protection, earthquake, and emergency-alert authorities.",
  },
  {
    key: "science-and-environment",
    label: "Science and environment",
    description: "Public science agencies, environmental authorities, and official research institutions.",
  },
  {
    key: "elections-and-civic-information",
    label: "Elections and civic information",
    description: "Election commissions, public registries, and official civic-information bodies.",
  },
  {
    key: "cyber-and-digital-safety",
    label: "Cyber and digital safety",
    description: "National cyber agencies, digital-security authorities, and public online-safety guidance.",
  },
  {
    key: "companies-and-products",
    label: "Companies and products",
    description: "Official company newsrooms, investor releases, product announcements, and service notices.",
  },
  {
    key: "games-and-interactive-entertainment",
    label: "Games and interactive entertainment",
    description: "Official game publishers, platforms, ratings bodies, award programmes, and interactive-entertainment organisations.",
  },
  {
    key: "sports-and-entertainment",
    label: "Sports and entertainment",
    description: "Official sports governing bodies, leagues, studios, music and film organisations, and award programmes.",
  },
  {
    key: "news-and-current-affairs",
    label: "News and current affairs",
    description: "Established newsrooms and public-interest reporting for time-sensitive claims.",
  },
  {
    key: "fact-checking-and-verification",
    label: "Fact-checking and verification",
    description: "Established verification organisations with published methodology and corrections practices.",
  },
  {
    key: "public-interest-journalism",
    label: "Public-interest journalism",
    description: "Selected public-service and international newsrooms used for time-sensitive reporting.",
  },
];

export const SOURCE_CATEGORIES = Object.freeze(definitions.map((category) => Object.freeze(category)));
export const SOURCE_CATEGORY_KEYS = Object.freeze(SOURCE_CATEGORIES.map((category) => category.key));
const categoryByKey = new Map(SOURCE_CATEGORIES.map((category) => [category.key, category]));

const legacyKeys = new Map([
  ["international authority", "international-institutions"],
  ["official public authority", "government-and-law"],
  ["fact-checking / verification", "fact-checking-and-verification"],
  ["news / public-interest journalism", "public-interest-journalism"],
]);

const platformDomains = [
  "t.me",
  "telegram.me",
  "telegram.org",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "youtube.com",
  "linkedin.com",
  "threads.net",
  "reddit.com",
  "discord.com",
  "whatsapp.com",
  "vk.com",
  "weibo.com",
];

export const CATEGORY_FALLBACK_KEYS = Object.freeze([
  "government-and-law",
  "international-institutions",
  "fact-checking-and-verification",
]);

export function categoryForKey(value) {
  return categoryByKey.get(String(value || "").trim()) || null;
}

export function categoryLabel(value) {
  return categoryForKey(value)?.label || "Uncategorized";
}

export function categoryKeyFor(value, fallback = "") {
  const explicit = String(value?.categoryKey || "").trim();
  if (explicit) {
    if (!categoryForKey(explicit)) throw new Error("Choose a supported trusted-source category.");
    return explicit;
  }

  const legacy = legacyKeys.get(String(value?.category || "").trim().toLowerCase());
  if (legacy) return legacy;
  if (fallback && categoryForKey(fallback)) return fallback;
  throw new Error("A supported trusted-source category is required.");
}

export function categoryKeysFor(value, fallback = "") {
  const primary = categoryKeyFor(value, fallback);
  const additional = Array.isArray(value?.categoryKeys) ? value.categoryKeys : [];
  const keys = [primary, ...additional].map((valueKey) => String(valueKey || "").trim()).filter(Boolean);
  const unique = [...new Set(keys)];
  for (const key of unique) {
    if (!categoryForKey(key)) throw new Error("Choose supported trusted-source categories.");
  }
  return unique;
}

export function sourceCategory(value) {
  const key = categoryKeyFor(value);
  return { key, label: categoryLabel(key) };
}

export function isBlockedPlatformDomain(domain) {
  const hostname = String(domain || "").trim().toLowerCase();
  return platformDomains.some((platform) => hostname === platform || hostname.endsWith("." + platform));
}

export function categorySummary(sources) {
  const counts = new Map(SOURCE_CATEGORY_KEYS.map((key) => [key, 0]));
  for (const source of sources) {
    for (const key of categoryKeysFor(source, "government-and-law")) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return SOURCE_CATEGORIES
    .map((category) => ({ ...category, count: counts.get(category.key) || 0 }))
    .filter((category) => category.count > 0);
}
