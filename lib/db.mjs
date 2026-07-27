import pg from "pg";

const { Pool } = pg;

function useSsl(value) {
  return /^(1|true|yes|require)$/i.test(String(value || "").trim());
}

export function createDatabasePool({ databaseUrl = "", databaseSsl = "" } = {}) {
  const connectionString = String(databaseUrl || "").trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required. Add your PostgreSQL connection string to environment.env.");
  }
  return new Pool({
    connectionString,
    ssl: useSsl(databaseSsl) ? { rejectUnauthorized: false } : undefined,
  });
}

export async function assertDatabaseReady(pool) {
  try {
    await pool.query("SELECT version FROM source_registry WHERE singleton = TRUE");
  } catch {
    throw new Error("PostgreSQL is reachable, but Fact-Check has not been initialized. Run npm run db:setup first.");
  }
}
