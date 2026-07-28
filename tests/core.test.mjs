import assert from "node:assert/strict";
import test from "node:test";
import { newDb } from "pg-mem";
import { bootstrapEnvironmentAdministrator, createAuth, createUserAuth } from "../lib/auth.mjs";
import { runMigrations } from "../lib/migrations.mjs";
import { trustedSourcesPdf } from "../lib/pdf.mjs";
import { seedTrustedSources } from "../lib/seed.mjs";
import { createSourceStore, selectSourcesForCategories } from "../lib/store.mjs";
import { createApp } from "../server.mjs";

const TEST_ADMIN_EMAIL = "factcheck-admin@example.test";
const TEST_ADMIN_PASSWORD = "a-long-admin-test-password";

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
    assert.equal(await store.isApprovedUrl("http://who.int/updates"), false);
    assert.equal(await store.isApprovedUrl("ftp://who.int/updates"), false);
    assert.equal(await store.isApprovedUrl("https://who.int.evil.example"), false);
    const added = await store.add({ name: "CDC", url: "https://www.cdc.gov/", category: "Authority", rationale: "Public health authority." });
    assert.equal(added.source.active, true);
    assert.equal((await store.publicSources()).length, 2);
    await assert.rejects(
      () => store.add({ name: "Duplicate WHO", url: "https://www.who.int/", category: "Authority", rationale: "Duplicate source." }),
      /already in the registry/i,
    );
    await assert.rejects(
      () => store.add({ name: "Telegram channel", url: "https://t.me/example", categoryKey: "government-and-law", rationale: "A platform account is not a first-party source domain." }),
      /social-platform/i,
    );
  } finally {
    await pool.end();
  }
});

test("PostgreSQL migration seeds the categorized 235-source public registry once", async () => {
  const pool = await testDatabase();
  try {
    const firstSeed = await seedTrustedSources(pool);
    const secondSeed = await seedTrustedSources(pool);
    const snapshot = await createSourceStore(pool).snapshot();
    assert.equal(firstSeed.seeded, 235);
    assert.equal(secondSeed.skipped, true);
    assert.equal(snapshot.sources.length, 235);
    assert.equal((await createSourceStore(pool).activeDomains()).length, 235);
    assert.equal(snapshot.sources.find((source) => source.id === "src-106").categoryKey, "economy-and-finance");
    assert.ok(snapshot.sources.some((source) => source.categoryKey === "weather-and-emergencies"));
    const reviewedSource = snapshot.sources.find((source) => source.id === "src-215");
    assert.deepEqual(
      { usageStatus: reviewedSource?.usageStatus, usagePolicyUrl: reviewedSource?.usagePolicyUrl },
      {
        usageStatus: "reviewed-link-and-citation",
        usagePolicyUrl: "https://data.gov/privacy-policy/",
      },
    );
  } finally {
    await pool.end();
  }
});

test("generated trusted-source PDF has a valid PDF header", () => {
  const pdf = trustedSourcesPdf({
    version: 7,
    updatedAt: "2026-07-27T00:00:00.000Z",
    sources: [{ name: "WHO", url: "https://www.who.int/", category: "Authority", rationale: "Global health authority.", usageStatus: "reviewed-link-and-citation", usagePolicyUrl: "https://www.who.int/about/policies" }],
  });
  assert.equal(pdf.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  assert.ok(pdf.toString("latin1").includes("Fact-Check"));
  assert.ok(pdf.toString("latin1").includes("Published source terms"));
});

test("category selection keeps each evidence search inside selected source categories", async () => {
  const pool = await testDatabase({ seed: true });
  try {
    const snapshot = await createSourceStore(pool).snapshot();
    const selection = selectSourcesForCategories(snapshot.sources, ["economy-and-finance", "government-and-law"]);
    assert.ok(selection.domains.includes("cbu.uz"));
    assert.ok(selection.sources.length > 0);
    assert.ok(selection.sources.every((source) => ["economy-and-finance", "government-and-law"].includes(source.categoryKey)));
    assert.ok(selection.domains.length <= 100);
  } finally {
    await pool.end();
  }
});

test("domain limits keep representation from every selected category", () => {
  const source = (id, categoryKey) => ({
    id,
    name: id,
    domain: id + ".example",
    categoryKey,
    active: true,
  });
  const selection = selectSourcesForCategories([
    source("finance-a", "economy-and-finance"),
    source("finance-b", "economy-and-finance"),
    source("law-a", "government-and-law"),
    source("law-b", "government-and-law"),
    source("weather-a", "weather-and-emergencies"),
  ], ["economy-and-finance", "government-and-law", "weather-and-emergencies"], 3);

  assert.equal(selection.domains.length, 3);
  assert.deepEqual(new Set(selection.sources.map((item) => item.categoryKey)), new Set([
    "economy-and-finance", "government-and-law", "weather-and-emergencies",
  ]));
  assert.equal(selection.truncated, true);
});

test("environment-backed administrator sessions are stored in PostgreSQL", async () => {
  const pool = await testDatabase();
  try {
    const bootstrap = await bootstrapEnvironmentAdministrator({ pool, email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
    assert.equal(bootstrap.created, true);
    const auth = createAuth({ pool, adminEmail: TEST_ADMIN_EMAIL, adminPassword: TEST_ADMIN_PASSWORD });
    assert.equal(auth.usernameRequired(), true);
    assert.equal(await auth.login("wrong-user@example.test", TEST_ADMIN_PASSWORD), null);
    const token = await auth.login(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    assert.ok(token);
    const persisted = await pool.query("SELECT email, role, password_hash FROM app_users WHERE email = $1", [TEST_ADMIN_EMAIL]);
    assert.equal(persisted.rows[0].role, "admin");
    assert.notEqual(persisted.rows[0].password_hash, TEST_ADMIN_PASSWORD);
    const restartedAuth = createAuth({ pool, adminEmail: TEST_ADMIN_EMAIL, adminPassword: TEST_ADMIN_PASSWORD });
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
  await bootstrapEnvironmentAdministrator({ pool, email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
  const auth = createAuth({ pool, adminEmail: TEST_ADMIN_EMAIL, adminPassword: TEST_ADMIN_PASSWORD });
  const userAuth = createUserAuth({ pool });
  const app = createApp({
    pool,
    config: {
      apiKey: "",
      adminEmail: TEST_ADMIN_EMAIL,
      adminPassword: TEST_ADMIN_PASSWORD,
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
    assert.equal(sourceData.sourceCount, 235);
    assert.equal(sourceData.categoryCounts.length, 10);

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

    const loginAsAdministrator = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }),
    });
    const administratorLoginPayload = await loginAsAdministrator.json();
    assert.equal(loginAsAdministrator.status, 200, JSON.stringify(administratorLoginPayload));
    assert.equal(administratorLoginPayload.administrator, true);
    const redirectedAdminCookie = loginAsAdministrator.headers.get("set-cookie").split(";")[0];
    const redirectedAllowed = await fetch(baseUrl + "/api/admin/sources", { headers: { Cookie: redirectedAdminCookie } });
    assert.equal(redirectedAllowed.status, 200);

    const adminLogin = await fetch(baseUrl + "/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }),
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

test("claim checks classify categories before a separate restricted evidence request", async () => {
  const pool = await testDatabase({ seed: true });
  const events = [];
  let evidenceArguments;
  const app = createApp({
    pool,
    config: {
      apiKey: "test-key",
      adminEmail: TEST_ADMIN_EMAIL,
      adminPassword: TEST_ADMIN_PASSWORD,
      model: "test-model",
      nodeEnv: "test",
      port: 0,
    },
    classifyClaimCategories: async (arguments_) => {
      events.push("classify");
      assert.equal(arguments_.claim, "O'zbekistonda naqd pul ishlatish mumkin emasmi?");
      return {
        categoryKeys: ["economy-and-finance", "government-and-law"],
        reason: "The claim concerns national payment rules and financial regulation.",
      };
    },
    checkClaimWithOpenAI: async (arguments_) => {
      events.push("check");
      evidenceArguments = arguments_;
      assert.equal(arguments_.isApprovedUrl("https://cbu.uz/en/"), true);
      assert.equal(arguments_.isApprovedUrl("http://cbu.uz/en/"), false);
      assert.equal(arguments_.isApprovedUrl("ftp://cbu.uz/en/"), false);
      return {
        verdict: "SUPPORTED",
        explanation: "Selected official sources confirm the relevant rule.",
        sources: [{ url: "https://cbu.uz/en/", title: "Central Bank of Uzbekistan" }],
        checkedAt: "2026-07-27T00:00:00.000Z",
        model: "test-model",
      };
    },
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const port = app.address().port;
  try {
    const response = await fetch("http://127.0.0.1:" + port + "/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim: "O'zbekistonda naqd pul ishlatish mumkin emasmi?" }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(events, ["classify", "check"]);
    assert.deepEqual(body.categorySelection.categoryKeys, ["economy-and-finance", "government-and-law"]);
    assert.ok(evidenceArguments.domains.includes("cbu.uz"));
    assert.ok(evidenceArguments.sources.every((source) => ["economy-and-finance", "government-and-law"].includes(source.categoryKey)));
    assert.equal(body.explanation, "Selected official sources confirm the relevant rule.");
  } finally {
    await new Promise((resolve) => app.close(resolve));
    await pool.end();
  }
});

test("anonymous claim checks are rate-limited before paid AI work", async () => {
  const pool = await testDatabase({ seed: true });
  const app = createApp({
    pool,
    config: {
      apiKey: "test-key",
      adminEmail: TEST_ADMIN_EMAIL,
      adminPassword: TEST_ADMIN_PASSWORD,
      model: "test-model",
      nodeEnv: "test",
      port: 0,
    },
    classifyClaimCategories: async () => ({
      categoryKeys: ["government-and-law"],
      reason: "Government information is relevant.",
    }),
    checkClaimWithOpenAI: async () => ({
      verdict: "INSUFFICIENT",
      explanation: "The selected sources do not provide enough evidence.",
      sources: [],
      checkedAt: "2026-07-27T00:00:00.000Z",
      model: "test-model",
    }),
  });
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const port = app.address().port;

  try {
    const statuses = [];
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const response = await fetch("http://127.0.0.1:" + port + "/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: "Is this public notice accurate?" }),
      });
      statuses.push(response.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 200, 200, 429]);
  } finally {
    await new Promise((resolve) => app.close(resolve));
    await pool.end();
  }
});

test("administrator source admission assigns the AI-reviewed category and records an audit entry", async () => {
  const pool = await testDatabase({ seed: true });
  await bootstrapEnvironmentAdministrator({ pool, email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
  const auth = createAuth({ pool, adminEmail: TEST_ADMIN_EMAIL, adminPassword: TEST_ADMIN_PASSWORD });
  const app = createApp({
    pool,
    auth,
    config: {
      apiKey: "test-key",
      adminEmail: TEST_ADMIN_EMAIL,
      adminPassword: TEST_ADMIN_PASSWORD,
      model: "test-model",
      nodeEnv: "test",
      port: 0,
    },
    assessTrustedSourceWithOpenAI: async ({ source }) => ({
      eligible: source.name !== "Unclear source",
      categoryKey: "economy-and-finance",
      confidence: source.name === "Unclear source" ? "low" : "high",
      reason: source.name === "Unclear source"
        ? "Official ownership cannot be confirmed from this domain."
        : "The first-party site is an official central-bank authority.",
      sources: [],
      model: "test-model",
    }),
  });

  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  const port = app.address().port;
  try {
    const login = await fetch("http://127.0.0.1:" + port + "/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD }),
    });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const preview = await fetch("http://127.0.0.1:" + port + "/api/admin/sources/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        name: "Unclear source",
        url: "https://unclear.example/",
        rationale: "The ownership of this candidate is not yet clear.",
      }),
    });
    assert.equal(preview.status, 200);
    assert.equal((await preview.json()).assessment.eligible, false);
    const missingUsageReview = await fetch("http://127.0.0.1:" + port + "/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        name: "No source-use review",
        url: "https://terms-missing.example/",
        rationale: "Official authority submitted without a terms or licence record.",
        manualReviewed: true,
      }),
    });
    assert.equal(missingUsageReview.status, 400);
    assert.match((await missingUsageReview.json()).error, /source was reviewed|source-use review/i);
    const added = await fetch("http://127.0.0.1:" + port + "/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        name: "Example Central Bank",
        url: "https://centralbank.example/",
        rationale: "Official central-bank source for monetary policy and payment rules.",
        categoryKey: "public-health",
        usageStatus: "reviewed-link-and-citation",
        usagePolicyUrl: "https://centralbank.example/terms",
        usageReviewNote: "The official terms were reviewed for direct linking and citation.",
        usageReviewed: true,
        manualReviewed: true,
      }),
    });
    assert.equal(added.status, 201);
    const body = await added.json();
    assert.equal(body.source.categoryKey, "economy-and-finance");
    assert.equal(body.source.category, "Economy and finance");
    const review = await pool.query("SELECT source_id, usage_status, usage_policy_url, usage_reviewed FROM source_admission_reviews WHERE candidate_domain = 'centralbank.example'");
    assert.equal(review.rows.length, 1);
    assert.equal(review.rows[0].source_id, body.source.id);
    assert.equal(review.rows[0].usage_status, "reviewed-link-and-citation");
    assert.equal(review.rows[0].usage_policy_url, "https://centralbank.example/terms");
    assert.equal(review.rows[0].usage_reviewed, true);
    const unlinkedPreview = await pool.query("SELECT source_id, eligible FROM source_admission_reviews WHERE candidate_domain = 'unclear.example'");
    assert.equal(unlinkedPreview.rows.length, 1);
    assert.equal(unlinkedPreview.rows[0].source_id, null);
    assert.equal(unlinkedPreview.rows[0].eligible, false);
  } finally {
    await new Promise((resolve) => app.close(resolve));
    await pool.end();
  }
});
