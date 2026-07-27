import crypto from "node:crypto";

const MAX_TEXT = 420;
export const MAX_SOURCE_DOMAINS = 100;

function asText(value, maxLength = MAX_TEXT) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function iso(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function canonicalUrl(value) {
  const url = new URL(asText(value, 2048));
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only HTTP and HTTPS source links are allowed.");
  url.hash = "";
  url.search = "";
  return url.toString();
}

export function sourceDomain(value) {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

export function normaliseSource(value, existing = {}) {
  const name = asText(value.name, 120);
  const url = canonicalUrl(value.url);
  const category = asText(value.category || "Community source", 90);
  const rationale = asText(value.rationale || value.description || "Reviewed source in the Fact-Check registry.", 360);
  if (name.length < 2) throw new Error("A source name is required.");
  if (rationale.length < 8) throw new Error("Please add a short reason for trusting this source.");

  return {
    id: existing.id || value.id || ("src-" + crypto.randomUUID()),
    name,
    url,
    domain: sourceDomain(url),
    category,
    rationale,
    active: value.active === undefined ? (existing.active ?? true) : Boolean(value.active),
    createdAt: existing.createdAt || value.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function sourceFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    domain: row.domain,
    category: row.category,
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

async function ensureDomainLimit(client, { id = "", domain, active }) {
  const result = await client.query(
    "SELECT domain FROM trusted_sources WHERE active = TRUE AND id <> $1",
    [id],
  );
  const domains = new Set(result.rows.map((row) => row.domain));
  if (active) domains.add(domain);
  if (domains.size > MAX_SOURCE_DOMAINS) {
    throw new Error("The trusted registry cannot contain more than 100 active domains.");
  }
}

async function duplicateUrl(client, url, id = "") {
  const result = await client.query(
    "SELECT id FROM trusted_sources WHERE LOWER(url) = LOWER($1) AND id <> $2 LIMIT 1",
    [url, id],
  );
  return Boolean(result.rows[0]);
}

export function createSourceStore(pool) {
  if (!pool?.query || !pool?.connect) throw new Error("A PostgreSQL pool is required for the source registry.");

  async function snapshot() {
    const [registryResult, sourcesResult] = await Promise.all([
      pool.query("SELECT version, updated_at FROM source_registry WHERE singleton = TRUE"),
      pool.query("SELECT id, name, url, domain, category, rationale, active, created_at, updated_at FROM trusted_sources ORDER BY category ASC, name ASC"),
    ]);
    if (!registryResult.rows[0]) throw new Error("The PostgreSQL source registry has not been initialized. Run npm run db:setup first.");
    return {
      ...registryFromRow(registryResult.rows[0]),
      sources: sourcesResult.rows.map(sourceFromRow),
    };
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
    publicSources,
    activeDomains,
    async isApprovedUrl(candidate) {
      try {
        const hostname = sourceDomain(candidate);
        const domains = await activeDomains();
        return domains.some((domain) => hostname === domain || hostname.endsWith("." + domain));
      } catch {
        return false;
      }
    },
    async add(value) {
      return transaction(pool, async (client) => {
        await lockRegistry(client);
        const source = normaliseSource(value);
        if (await duplicateUrl(client, source.url)) throw new Error("That exact source link is already in the registry.");
        await ensureDomainLimit(client, source);
        await client.query(
          "INSERT INTO trusted_sources (id, name, url, domain, category, rationale, active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
          [source.id, source.name, source.url, source.domain, source.category, source.rationale, source.active, source.createdAt, source.updatedAt],
        );
        const registry = await nextRegistryVersion(client);
        return { source, ...registry };
      });
    },
    async update(id, changes) {
      return transaction(pool, async (client) => {
        await lockRegistry(client);
        const existingResult = await client.query(
          "SELECT id, name, url, domain, category, rationale, active, created_at, updated_at FROM trusted_sources WHERE id = $1 FOR UPDATE",
          [id],
        );
        if (!existingResult.rows[0]) throw new Error("Source not found.");
        const existing = sourceFromRow(existingResult.rows[0]);
        const source = normaliseSource({ ...existing, ...changes }, existing);
        if (await duplicateUrl(client, source.url, id)) throw new Error("That exact source link is already in the registry.");
        await ensureDomainLimit(client, source);
        await client.query(
          "UPDATE trusted_sources SET name = $2, url = $3, domain = $4, category = $5, rationale = $6, active = $7, updated_at = $8 WHERE id = $1",
          [id, source.name, source.url, source.domain, source.category, source.rationale, source.active, source.updatedAt],
        );
        const registry = await nextRegistryVersion(client);
        return { source, ...registry };
      });
    },
    async remove(id) {
      return transaction(pool, async (client) => {
        await lockRegistry(client);
        const result = await client.query(
          "DELETE FROM trusted_sources WHERE id = $1 RETURNING id, name, url, domain, category, rationale, active, created_at, updated_at",
          [id],
        );
        if (!result.rows[0]) throw new Error("Source not found.");
        const registry = await nextRegistryVersion(client);
        return { source: sourceFromRow(result.rows[0]), ...registry };
      });
    },
  };
}
