import { createDatabasePool } from "../lib/db.mjs";
import { loadConfig } from "../lib/config.mjs";
import { bootstrapEnvironmentAdministrator } from "../lib/auth.mjs";
import { seedTrustedSources } from "../lib/seed.mjs";

const config = loadConfig();
const pool = createDatabasePool(config);
try {
  const result = await seedTrustedSources(pool);
  await bootstrapEnvironmentAdministrator({
    pool,
    email: config.adminEmail || config.adminUsername,
    password: config.adminPassword,
    rotatePassword: config.adminPasswordRotate,
  });
  console.log(result.skipped ? "Trusted sources already exist; seed skipped." : "Seeded " + result.seeded + " trusted sources.");
} finally {
  await pool.end();
}
