import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { categoryKeyFor, categoryLabel } from "./categories.mjs";
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
  return {
    id: String(rawSource.id || "").trim(),
    name: String(rawSource.name || "").trim(),
    url,
    domain: sourceDomain(url),
    categoryKey,
    category: categoryLabel(categoryKey),
    rationale: String(rawSource.rationale || "").trim(),
    active: rawSource.active !== false,
    timestamp,
  };
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

    for (const rawSource of seed.sources) {
      const source = sourceForSeed(rawSource, timestamp);
      if (!source.id || source.name.length < 2 || source.rationale.length < 8) {
        throw new Error("The trusted-source seed file contains an incomplete source.");
      }
      const present = byId.get(source.id) || byUrl.get(source.url.toLowerCase());
      if (present) {
        if (!present.category_key) {
          await client.query("UPDATE trusted_sources SET category_key = $2, category = $3 WHERE id = $1", [present.id, source.categoryKey, source.category]);
          categorized += 1;
        }
        continue;
      }

      await client.query(
        "INSERT INTO trusted_sources (id, name, url, domain, category, category_key, rationale, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)",
        [source.id, source.name, source.url, source.domain, source.category, source.categoryKey, source.rationale, source.active, source.timestamp],
      );
      const inserted = { id: source.id, url: source.url.toLowerCase(), category_key: source.categoryKey };
      byId.set(inserted.id, inserted);
      byUrl.set(inserted.url, inserted);
      seeded += 1;
    }

    if (seeded || categorized) {
      const registry = await client.query("SELECT version FROM source_registry WHERE singleton = TRUE FOR UPDATE");
      const currentVersion = Number(registry.rows[0]?.version || 1);
      const seedVersion = Number(seed.version) || 1;
      await client.query(
        "UPDATE source_registry SET version = $1, updated_at = $2 WHERE singleton = TRUE",
        [Math.max(currentVersion + 1, seedVersion), timestamp],
      );
    }
    await client.query("COMMIT");
    return { seeded, categorized, skipped: seeded === 0 && categorized === 0 };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
