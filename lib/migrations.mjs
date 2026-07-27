import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MIGRATIONS_DIRECTORY = path.join(moduleDirectory, "..", "db", "migrations");

function migrationFiles(directory) {
  return fs.readdirSync(directory)
    .filter((file) => /^\d+_.+\.sql$/i.test(file))
    .sort((left, right) => left.localeCompare(right));
}

export async function runMigrations(pool, { migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY, advisoryLock = true } = {}) {
  const client = await pool.connect();
  try {
    if (advisoryLock) await client.query("SELECT pg_advisory_lock(845231901)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    const applied = new Set((await client.query("SELECT id FROM schema_migrations")).rows.map((row) => row.id));
    const pending = migrationFiles(migrationsDirectory).filter((file) => !applied.has(file));

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(migrationsDirectory, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return { applied: pending };
  } finally {
    if (advisoryLock) {
      try {
        await client.query("SELECT pg_advisory_unlock(845231901)");
      } catch {
        // Releasing the client also releases the lock if the connection is closing.
      }
    }
    client.release();
  }
}
