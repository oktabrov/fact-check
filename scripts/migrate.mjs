import { createDatabasePool } from "../lib/db.mjs";
import { loadConfig } from "../lib/config.mjs";
import { runMigrations } from "../lib/migrations.mjs";

const pool = createDatabasePool(loadConfig());
try {
  const result = await runMigrations(pool);
  console.log(result.applied.length ? "Applied migrations: " + result.applied.join(", ") : "PostgreSQL schema is already current.");
} finally {
  await pool.end();
}
