import crypto from "node:crypto";
import {
  categoryForKey,
  categoryKeyFor,
  categoryLabel,
  isBlockedPlatformDomain,
} from "./categories.mjs";

const MAX_TEXT = 420;
export const MAX_SEARCH_DOMAINS = 100;

function asText(value, maxLength = MAX_TEXT) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function canonicalUrl(value) {
  const url = new URL(asText(value, 2048));
  if (url.protocol !== "https:") throw new Error("Trusted source links must use HTTPS.");
  if (url.username || url.password) throw new Error("Trusted source links cannot include credentials.");
  if (url.port) throw new Error("Trusted source links cannot use a custom port.");
  url.hash = "";
  url.search = "";
  return url.toString();
}

export function sourceDomain(value) {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

function activeValue(value, existing) {
  if (value === undefined) return existing.active ?? true;
  return value === false || value === "false" ? false : true;
}

export function normaliseSource(value, existing = {}) {
  const merged = { ...existing, ...value };
  const name = asText(merged.name, 120);
  const url = canonicalUrl(merged.url);
  const domain = sourceDomain(url);
  const categoryKey = categoryKeyFor(merged, "government-and-law");
  const rationale = asText(merged.rationale || merged.description || "Reviewed source in the Fact-Check registry.", 360);

  if (name.length < 2) throw new Error("A source name is required.");
  if (rationale.length < 8) throw new Error("Please add a short reason for trusting this source.");
  if (isBlockedPlatformDomain(domain)) {
    throw new Error("Social-platform domains cannot be used for automated source checks. Add a first-party official website instead.");
  }

  return {
    id: existing.id || value.id || ("src-" + crypto.randomUUID()),
    name,
    url,
    domain,
    categoryKey,
    category: categoryLabel(categoryKey),
    rationale,
    active: activeValue(value.active, existing),
    createdAt: existing.createdAt || value.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function sourceFromRow(row) {
  const categoryKey = categoryKeyFor({ categoryKey: row.category_key, category: row.category }, "government-and-law");
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    domain: row.domain,
    categoryKey,
    category: categoryLabel(categoryKey),
    rationale: row.rationale,
    active: Boolean(row.active),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function registryFromRow(row) {
  return { version: Number(row.version), updatedAt: iso(row.updated_at) };
}

async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function lockRegistry(client) {
  const result = await client.query("SELECT version, updated_at FROM source_registry WHERE singleton = TRUE FOR UPDATE");
  if (!result.rows[0]) throw new Error("The PostgreSQL source registry has not been initialized. Run npm run db:setup first.");
  return registryFromRow(result.rows[0]);
}

async function nextRegistryVersion(client) {
  const result = await client.query(
    "UPDATE source_registry SET version = version + 1, updated_at = NOW() WHERE singleton = TRUE RETURNING version, updated_at",
  );
  return registryFromRow(result.rows[0]);
}

async function duplicateUrl(client, url, id = "") {
  const result = await client.query(
    "SELECT id FROM trusted_sources WHERE LOWER(url) = LOWER($1) AND id <> $2 LIMIT 1",
    [url, id],
  );
  return Boolean(result.rows[0]);
}

async function insertSource(client, value) {
  const source = normaliseSource(value);
  if (await duplicateUrl(client, source.url)) throw new Error("That exact source link is already in the registry.");
  await client.query(
    "INSERT INTO trusted_sources (id, name, url, domain, category, category_key, rationale, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    [source.id, source.name, source.url, source.domain, source.category, source.categoryKey, source.rationale, source.active, source.createdAt, source.updatedAt],
  );
  return source;
}

async function updateSource(client, id, changes) {
  const existingResult = await client.query(
    "SELECT id, name, url, domain, category, category_key, rationale, active, created_at, updated_at FROM trusted_sources WHERE id = $1 FOR UPDATE",
    [id],
  );
  if (!existingResult.rows[0]) throw new Error("Source not found.");
  const existing = sourceFromRow(existingResult.rows[0]);
  const source = normaliseSource({ ...existing, ...changes }, existing);
  if (await duplicateUrl(client, source.url, id)) throw new Error("That exact source link is already in the registry.");
  await client.query(
    "UPDATE trusted_sources SET name = $2, url = $3, domain = $4, category = $5, category_key = $6, rationale = $7, active = $8, updated_at = $9 WHERE id = $1",
    [id, source.name, source.url, source.domain, source.category, source.categoryKey, source.rationale, source.active, source.updatedAt],
  );
  return source;
}

function normaliseAdmissionReview({ sourceId = null, candidateUrl, categoryKey, eligible, manualReviewed, reason }) {
  const url = canonicalUrl(candidateUrl);
  return {
    id: "review-" + crypto.randomUUID(),
    sourceId: sourceId || null,
    candidateUrl: url,
    candidateDomain: sourceDomain(url),
    categoryKey: categoryKeyFor({ categoryKey }, "government-and-law"),
    eligible: Boolean(eligible),
    manualReviewed: Boolean(manualReviewed),
    reason: asText(reason, 600),
  };
}

async function insertAdmissionReview(client, review) {
  const result = await client.query(
    "INSERT INTO source_admission_reviews (id, source_id, candidate_url, candidate_domain, recommended_category_key, eligible, manual_reviewed, reason) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at",
    [
      review.id,
      review.sourceId,
      review.candidateUrl,
      review.candidateDomain,
      review.categoryKey,
      review.eligible,
      review.manualReviewed,
      review.reason,
    ],
  );
  return { id: result.rows[0].id, createdAt: iso(result.rows[0].created_at) };
}

export function selectSourcesForCategories(sources, categoryKeys, limit = MAX_SEARCH_DOMAINS) {
  const requestedKeys = [...new Set((categoryKeys || []).filter((key) => categoryForKey(key)))];
  const categoryBuckets = new Map(requestedKeys.map((key) => [key, []]));
  for (const source of sources) {
    if (source.active && categoryBuckets.has(source.categoryKey)) categoryBuckets.get(source.categoryKey).push(source);
  }
  for (const bucket of categoryBuckets.values()) {
    bucket.sort((left, right) => left.name.localeCompare(right.name) || left.domain.localeCompare(right.domain));
  }
  const matching = [...categoryBuckets.values()].flat();

  const domains = new Set();
  const selectedSources = [];
  const cursors = new Map(requestedKeys.map((key) => [key, 0]));

  // Round-robin selection preserves evidence from every chosen category when a
  // claim's relevant source set is larger than the web-search domain limit.
  while (domains.size < limit) {
    let addedInPass = false;
    for (const key of requestedKeys) {
      const bucket = categoryBuckets.get(key) || [];
      let cursor = cursors.get(key) || 0;
      while (cursor < bucket.length && domains.has(bucket[cursor].domain)) cursor += 1;
      cursors.set(key, cursor);
      if (cursor >= bucket.length || domains.size >= limit) continue;
      const source = bucket[cursor];
      domains.add(source.domain);
      selectedSources.push(source);
      cursors.set(key, cursor + 1);
      addedInPass = true;
    }
    if (!addedInPass) break;
  }

  return {
    sources: selectedSources,
    domains: [...domains].sort(),
    matchingSourceCount: matching.length,
    truncated: selectedSources.length < matching.length,
  };
}

export function createSourceStore(pool) {
  if (!pool?.query || !pool?.connect) throw new Error("A PostgreSQL pool is required for the source registry.");

  async function snapshot() {
    const [registryResult, sourcesResult] = await Promise.all([
      pool.query("SELECT version, updated_at FROM source_registry WHERE singleton = TRUE"),
      pool.query("SELECT id, name, url, domain, category, category_key, rationale, active, created_at, updated_at FROM trusted_sources ORDER BY category_key ASC, name ASC"),
    ]);
    if (!registryResult.rows[0]) throw new Error("The PostgreSQL source registry has not been initialized. Run npm run db:setup first.");
    return {
      ...registryFromRow(registryResult.rows[0]),
      sources: sourcesResult.rows.map(sourceFromRow),
    };
  }

  async function get(id) {
    const result = await pool.query(
      "SELECT id, name, url, domain, category, category_key, rationale, active, created_at, updated_at FROM trusted_sources WHERE id = $1",
      [id],
    );
    return result.rows[0] ? sourceFromRow(result.rows[0]) : null;
  }

  async function publicSources() {
    const current = await snapshot();
    return current.sources.filter((source) => source.active);
  }

  async function activeDomains() {
    const result = await pool.query("SELECT DISTINCT domain FROM trusted_sources WHERE active = TRUE ORDER BY domain ASC");
    return result.rows.map((row) => row.domain);
  }

  return {
    snapshot,
    get,
    publicSources,
    activeDomains,
    async isApprovedUrl(candidate) {
      try {
        const url = new URL(candidate);
        if (url.protocol !== "https:") return false;
        const hostname = sourceDomain(url);
        const domains = await activeDomains();
        return domains.some((domain) => hostname === domain || hostname.endsWith("." + domain));
      } catch {
        return false;
      }
    },
    async add(value) {
      return transaction(pool, async (client) => {
        await lockRegistry(client);
        const source = await insertSource(client, value);
        const registry = await nextRegistryVersion(client);
        return { source, ...registry };
      });
    },
    async update(id, changes) {
      return transaction(pool, async (client) => {
        await lockRegistry(client);
        const source = await updateSource(client, id, changes);
        const registry = await nextRegistryVersion(client);
        return { source, ...registry };
      });
    },
    async remove(id) {
      return transaction(pool, async (client) => {
        await lockRegistry(client);
        const result = await client.query(
          "DELETE FROM trusted_sources WHERE id = $1 RETURNING id, name, url, domain, category, category_key, rationale, active, created_at, updated_at",
          [id],
        );
        if (!result.rows[0]) throw new Error("Source not found.");
        const registry = await nextRegistryVersion(client);
        return { source: sourceFromRow(result.rows[0]), ...registry };
      });
    },
    async recordAdmissionReview({ sourceId = null, candidateUrl, categoryKey, eligible, manualReviewed, reason }) {
      const client = await pool.connect();
      try {
        return await insertAdmissionReview(client, normaliseAdmissionReview({ sourceId, candidateUrl, categoryKey, eligible, manualReviewed, reason }));
      } finally {
        client.release();
      }
    },
    async addWithAdmissionReview(value, reviewValue) {
      return transaction(pool, async (client) => {
        await lockRegistry(client);
        const source = await insertSource(client, value);
        const review = await insertAdmissionReview(client, normaliseAdmissionReview({ ...reviewValue, sourceId: source.id }));
        const registry = await nextRegistryVersion(client);
        return { source, review, ...registry };
      });
    },
    async updateWithAdmissionReview(id, changes, reviewValue) {
      return transaction(pool, async (client) => {
        await lockRegistry(client);
        const source = await updateSource(client, id, changes);
        const review = await insertAdmissionReview(client, normaliseAdmissionReview({ ...reviewValue, sourceId: source.id }));
        const registry = await nextRegistryVersion(client);
        return { source, review, ...registry };
      });
    },
    async attachAdmissionReview(reviewId, sourceId) {
      if (!reviewId || !sourceId) return;
      await pool.query(
        "UPDATE source_admission_reviews SET source_id = $2 WHERE id = $1",
        [reviewId, sourceId],
      );
    },
  };
}
