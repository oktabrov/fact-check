import assert from "node:assert/strict";
import test from "node:test";
import { newDb } from "pg-mem";
import { createAuth, createUserAuth } from "../lib/auth.mjs";
import { runMigrations } from "../lib/migrations.mjs";
import { trustedSourcesPdf } from "../lib/pdf.mjs";
import { seedTrustedSources } from "../lib/seed.mjs";
import { createSourceStore } from "../lib/store.mjs";
import { createApp } from "../server.mjs";

async function testDatabase({ seed = false } = {}) {
  const database = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = database.adapters.createPg();
  const pool = new adapter.Pool();
  await runMigrations(pool, { advisoryLock: false });
  if (seed) await seedTrustedSources(pool);
  return pool;
}

test("PostgreSQL source registry preserves the trusted-domain boundary", async () => {
  const pool = await testDatabase();
  try {
    const store = createSourceStore(pool);
    await store.add({ name: "WHO", url: "https://www.who.int/", category: "Authority", rationale: "Global health authority." });
    assert.deepEqual(await store.activeDomains(), ["who.int"]);
    assert.equal(await store.isApprovedUrl("https://news.who.int/updates"), true);
    assert.equal(await store.isApprovedUrl("https://who.int.evil.example"), false);
    const added = await store.add({ name: "CDC", url: "https://www.cdc.gov/", category: "Authority", rationale: "Public health authority." });
    assert.equal(added.source.active, true);
    assert.equal((await store.publicSources()).length, 2);
    await assert.rejects(
      () => store.add({ name: "Duplicate WHO", url: "https://www.who.int/", category: "Authority", rationale: "Duplicate source." }),
      /already in the registry/i,
    );
  } finally {
    await pool.end();
  }
});

test("PostgreSQL migration seeds the 100-source public registry once", async () => {
  const pool = await testDatabase();
  try {
    const firstSeed = await seedTrustedSources(pool);
    const secondSeed = await seedTrustedSources(pool);
    const snapshot = await createSourceStore(pool).snapshot();
    assert.equal(firstSeed.seeded, 100);
    assert.equal(secondSeed.skipped, true);
    assert.equal(snapshot.sources.length, 100);
    assert.equal((await createSourceStore(pool).activeDomains()).length, 100);
  } finally {
    await pool.end();
  }
});

test("generated trusted-source PDF has a valid PDF header", () => {
  const pdf = trustedSourcesPdf({
    version: 7,
    updatedAt: "2026-07-27T00:00:00.000Z",
    sources: [{ name: "WHO", url: "https://www.who.int/", category: "Authority", rationale: "Global health authority." }],
  });
  assert.equal(pdf.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  assert.ok(pdf.toString("latin1").includes("Fact-Check"));
});

test("environment-backed administrator sessions are stored in PostgreSQL", async () => {
  const pool = await testDatabase();
  try {
    const auth = createAuth({ pool, adminUsername: "factcheck-admin", adminPassword: "a-long-admin-test-password" });
    assert.equal(auth.usernameRequired(), true);
    assert.equal(await auth.login("wrong-user", "a-long-admin-test-password"), null);
    const token = await auth.login("factcheck-admin", "a-long-admin-test-password");
    assert.ok(token);
    const restartedAuth = createAuth({ pool, adminUsername: "factcheck-admin", adminPassword: "a-long-admin-test-password" });
    assert.equal(await restartedAuth.isAuthenticated({ headers: { cookie: "fact_check_admin=" + token } }), true);
    await restartedAuth.logout({ headers: { cookie: "fact_check_admin=" + token } });
    assert.equal(await auth.isAuthenticated({ headers: { cookie: "fact_check_admin=" + token } }), false);
  } finally {
    await pool.end();
  }
});

test("PostgreSQL user accounts use a separate session and never expose password data", async () => {
  const pool = await testDatabase();
  try {
    const auth = createUserAuth({ pool });
    const created = await auth.signup({ name: "Amina Karimova", email: "Amina@Example.com", password: "a-long-user-test-password" });
    assert.equal(created.user.email, "amina@example.com");
    assert.equal(Object.hasOwn(created.user, "password_hash"), false);
    assert.equal(Object.hasOwn(created.user, "password_salt"), false);
    const restartedAuth = createUserAuth({ pool });
    assert.equal((await restartedAuth.currentUser({ headers: { cookie: "fact_check_user=" + created.token } })).name, "Amina Karimova");
    assert.equal(await auth.login({ email: "amina@example.com", password: "wrong-password" }), null);
    assert.ok(await auth.login({ email: "amina@example.com", password: "a-long-user-test-password" }));
    await assert.rejects(
      () => auth.signup({ name: "Amina Karimova", email: "amina@example.com", password: "a-different-long-password" }),
      /already exists/i,
    );
  } finally {
    await pool.end();
  }
});

test("public user sessions cannot access administrator routes", async () => {
  const pool = await testDatabase({ seed: true });
  const auth = createAuth({ pool, adminUsername: "factcheck-admin", adminPassword: "a-long-admin-test-password" });
  const userAuth = createUserAuth({ pool });
  const app = createApp({
    pool,
    config: {
      apiKey: "",
      adminUsername: "factcheck-admin",
      adminPassword: "a-long-admin-test-password",
      model: "test-model",
      nodeEnv: "test",
      port: 0,
    },
    auth,
    userAuth,
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const port = app.address().port;
  const baseUrl = "http://127.0.0.1:" + port;

  try {
    const sourceResponse = await fetch(baseUrl + "/api/sources");
    const sourceData = await sourceResponse.json();
    assert.equal(sourceData.sourceCount, 100);
    assert.equal(sourceData.categoryCounts.length, 4);

    const signup = await fetch(baseUrl + "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Amina Karimova", email: "amina@example.com", password: "a-long-user-test-password" }),
    });
    assert.equal(signup.status, 201);
    const userCookie = signup.headers.get("set-cookie").split(";")[0];
    const account = await signup.json();
    assert.equal(account.user.email, "amina@example.com");

    const status = await fetch(baseUrl + "/api/auth/status", { headers: { Cookie: userCookie } });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).user.name, "Amina Karimova");

    const blocked = await fetch(baseUrl + "/api/admin/sources", { headers: { Cookie: userCookie } });
    assert.equal(blocked.status, 401);

    const adminLogin = await fetch(baseUrl + "/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "factcheck-admin", password: "a-long-admin-test-password" }),
    });
    assert.equal(adminLogin.status, 200);
    const adminCookie = adminLogin.headers.get("set-cookie").split(";")[0];
    const allowed = await fetch(baseUrl + "/api/admin/sources", { headers: { Cookie: adminCookie } });
    assert.equal(allowed.status, 200);
  } finally {
    await new Promise((resolve) => app.close(resolve));
    await pool.end();
  }
});
