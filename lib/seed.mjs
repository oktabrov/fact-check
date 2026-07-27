import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalUrl, sourceDomain } from "./store.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_SEED_FILE = path.join(moduleDirectory, "..", "data", "trusted-sources.json");

function readSeedFile(seedFile) {
  const parsed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  if (!Array.isArray(parsed.sources) || !parsed.sources.length) throw new Error("The trusted-source seed file is malformed.");
  return parsed;
}

export async function seedTrustedSources(pool, { seedFile = DEFAULT_SEED_FILE } = {}) {
  const seed = readSeedFile(seedFile);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT COUNT(*)::int AS count FROM trusted_sources");
    if (Number(existing.rows[0].count) > 0) {
      await client.query("COMMIT");
      return { seeded: 0, skipped: true };
    }

    const timestamp = seed.updatedAt || new Date().toISOString();
    for (const rawSource of seed.sources) {
      const url = canonicalUrl(rawSource.url);
      await client.query(
        "INSERT INTO trusted_sources (id, name, url, domain, category, rationale, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)",
        [
          rawSource.id,
          String(rawSource.name || "").trim(),
          url,
          sourceDomain(url),
          String(rawSource.category || "Community source").trim(),
          String(rawSource.rationale || "").trim(),
          rawSource.active !== false,
          timestamp,
        ],
      );
    }
    await client.query(
      "UPDATE source_registry SET version = $1, updated_at = $2 WHERE singleton = TRUE",
      [Number(seed.version) || 1, timestamp],
    );
    await client.query("COMMIT");
    return { seeded: seed.sources.length, skipped: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
