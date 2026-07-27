import { createDatabasePool } from "../lib/db.mjs";
import { loadConfig } from "../lib/config.mjs";
import { seedTrustedSources } from "../lib/seed.mjs";

const pool = createDatabasePool(loadConfig());
try {
  const result = await seedTrustedSources(pool);
  console.log(result.skipped ? "Trusted sources already exist; seed skipped." : "Seeded " + result.seeded + " trusted sources.");
} finally {
  await pool.end();
}
