import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categoryKeyFor, categoryKeysFor, categoryLabel } from "./categories.mjs";
import { canonicalUrl, sourceDomain } from "./store.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SEED_FILE = path.join(moduleDirectory, "..", "data", "trusted-sources.json");

const seedCategoryOverrides = new Map([
  ["src-026", "public-health"], ["src-032", "public-health"], ["src-033", "public-health"], ["src-035", "public-health"],
  ["src-037", "public-health"], ["src-039", "public-health"], ["src-041", "public-health"], ["src-043", "public-health"],
  ["src-045", "public-health"], ["src-048", "public-health"], ["src-050", "public-health"], ["src-052", "public-health"],
  ["src-054", "public-health"], ["src-056", "public-health"],
  ["src-027", "weather-and-emergencies"], ["src-028", "weather-and-emergencies"], ["src-029", "weather-and-emergencies"],
  ["src-030", "weather-and-emergencies"], ["src-034", "weather-and-emergencies"], ["src-036", "weather-and-emergencies"],
  ["src-038", "weather-and-emergencies"], ["src-040", "weather-and-emergencies"], ["src-042", "weather-and-emergencies"],
  ["src-044", "weather-and-emergencies"], ["src-046", "weather-and-emergencies"], ["src-047", "weather-and-emergencies"],
  ["src-049", "weather-and-emergencies"], ["src-051", "weather-and-emergencies"], ["src-053", "weather-and-emergencies"],
  ["src-055", "weather-and-emergencies"], ["src-057", "weather-and-emergencies"], ["src-058", "weather-and-emergencies"],
  ["src-059", "weather-and-emergencies"], ["src-060", "weather-and-emergencies"],
  ["src-031", "science-and-environment"],
]);

function readSeedFile(seedFile) {
  const parsed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  if (!Array.isArray(parsed.sources) || !parsed.sources.length) throw new Error("The trusted-source seed file is malformed.");
  return parsed;
}

function sourceForSeed(rawSource, timestamp) {
  const url = canonicalUrl(rawSource.url);
  const categoryKey = seedCategoryOverrides.get(String(rawSource.id || "")) || categoryKeyFor(rawSource, "government-and-law");
  const categoryKeys = categoryKeysFor({ ...rawSource, categoryKey }, "government-and-law");
  return {
    id: String(rawSource.id || "").trim(),
    name: String(rawSource.name || "").trim(),
    url,
    domain: sourceDomain(url),
    categoryKey,
    categoryKeys,
    category: categoryLabel(categoryKey),
    rationale: String(rawSource.rationale || "").trim(),
    active: rawSource.active !== false,
    usageStatus: String(rawSource.usageStatus || "legacy-review-pending").trim(),
    usagePolicyUrl: rawSource.usagePolicyUrl ? canonicalUrl(rawSource.usagePolicyUrl) : null,
    usageReviewNote: String(rawSource.usageReviewNote || "").trim(),
    usageReviewedAt: rawSource.usageReviewedAt || (rawSource.usageStatus && rawSource.usageStatus !== "legacy-review-pending" ? timestamp : null),
    timestamp,
  };
}

async function seedSecondaryCategories(client, sourceId, primaryCategoryKey, categoryKeys) {
  let added = 0;
  for (const categoryKey of categoryKeys) {
    if (categoryKey === primaryCategoryKey) continue;
    const existing = await client.query(
      "SELECT 1 FROM trusted_source_secondary_categories WHERE source_id = $1 AND category_key = $2",
      [sourceId, categoryKey],
    );
    if (existing.rows.length) continue;
    await client.query(
      "INSERT INTO trusted_source_secondary_categories (source_id, category_key) VALUES ($1, $2) ON CONFLICT (source_id, category_key) DO NOTHING",
      [sourceId, categoryKey],
    );
    added += 1;
  }
  return added;
}

export async function seedTrustedSources(pool, { seedFile = DEFAULT_SEED_FILE } = {}) {
  const seed = readSeedFile(seedFile);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT id, LOWER(url) AS url, category_key FROM trusted_sources");
    const byId = new Map(existing.rows.map((row) => [row.id, row]));
    const byUrl = new Map(existing.rows.map((row) => [row.url, row]));
    const timestamp = seed.updatedAt || new Date().toISOString();
    let seeded = 0;
    let categorized = 0;
    let secondaryCategories = 0;

    for (const rawSource of seed.sources) {
      const source = sourceForSeed(rawSource, timestamp);
      if (!source.id || source.name.length < 2 || source.rationale.length < 8) {
        throw new Error("The trusted-source seed file contains an incomplete source.");
      }
      if (source.usageStatus !== "legacy-review-pending" && (!source.usagePolicyUrl || source.usageReviewNote.length < 8)) {
        throw new Error("A reviewed trusted-source seed entry needs an official terms link and a usage note.");
      }
      const present = byId.get(source.id) || byUrl.get(source.url.toLowerCase());
      if (present) {
        if (!present.category_key) {
          await client.query("UPDATE trusted_sources SET category_key = $2, category = $3 WHERE id = $1", [present.id, source.categoryKey, source.category]);
          categorized += 1;
        }
        secondaryCategories += await seedSecondaryCategories(client, present.id, present.category_key || source.categoryKey, source.categoryKeys);
      } else {
        await client.query(
          "INSERT INTO trusted_sources (id, name, url, domain, category, category_key, rationale, active, usage_status, usage_policy_url, usage_review_note, usage_reviewed_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)",
          [source.id, source.name, source.url, source.domain, source.category, source.categoryKey, source.rationale, source.active, source.usageStatus, source.usagePolicyUrl, source.usageReviewNote || null, source.usageReviewedAt, source.timestamp],
        );
        const inserted = { id: source.id, url: source.url.toLowerCase(), category_key: source.categoryKey };
        byId.set(inserted.id, inserted);
        byUrl.set(inserted.url, inserted);
        seeded += 1;
        secondaryCategories += await seedSecondaryCategories(client, inserted.id, inserted.category_key, source.categoryKeys);
      }
    }

    if (seeded || categorized || secondaryCategories) {
      const registry = await client.query("SELECT version FROM source_registry WHERE singleton = TRUE FOR UPDATE");
      const currentVersion = Number(registry.rows[0]?.version || 1);
      const seedVersion = Number(seed.version) || 1;
      await client.query(
        "UPDATE source_registry SET version = $1, updated_at = $2 WHERE singleton = TRUE",
        [Math.max(currentVersion, seedVersion), timestamp],
      );
    }
    await client.query("COMMIT");
    return { seeded, categorized, secondaryCategories, skipped: seeded === 0 && categorized === 0 && secondaryCategories === 0 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
