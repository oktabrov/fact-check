import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAuth, createUserAuth } from "./lib/auth.mjs";
import { assertDatabaseReady, createDatabasePool } from "./lib/db.mjs";
import { PUBLIC_DIR, loadConfig } from "./lib/config.mjs";
import { checkClaimWithOpenAI } from "./lib/openai.mjs";
import { trustedSourcesPdf } from "./lib/pdf.mjs";
import { createSourceStore, sourceDomain } from "./lib/store.mjs";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function securityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; connect-src 'self'; style-src 'self'; script-src 'self'");
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  response.end(JSON.stringify(body));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function sendFile(response, filePath, method) {
  const extension = path.extname(filePath).toLowerCase();
  const data = fs.readFileSync(filePath);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
  });
  if (method !== "HEAD") response.end(data);
  else response.end();
}

function readJson(request, maxBytes = 7 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("This request is too large. Please use an image smaller than 4 MB."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Please send a valid request."));
      }
    });
    request.on("error", (error) => reject(error));
  });
}

function safePathname(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function isAssetRequest(pathname) {
  return path.extname(pathname).length > 0;
}

function activeSourcesFromSnapshot(snapshot) {
  return snapshot.sources.filter((source) => source.active);
}

function domainsFromSources(sources) {
  return [...new Set(sources.map((source) => source.domain))].sort();
}

async function publicSourceResponse(store, url) {
  const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const category = String(url.searchParams.get("category") || "").trim();
  const snapshot = await store.snapshot();
  const activeSources = activeSourcesFromSnapshot(snapshot);
  const sources = activeSources.filter((source) => {
    if (category && source.category !== category) return false;
    if (!query) return true;
    return [source.name, source.domain, source.category, source.rationale].join(" ").toLowerCase().includes(query);
  });
  const counts = new Map();
  activeSources.forEach((source) => counts.set(source.category, (counts.get(source.category) || 0) + 1));
  return {
    version: snapshot.version,
    updatedAt: snapshot.updatedAt,
    sourceCount: activeSources.length,
    categories: [...counts.keys()].sort(),
    categoryCounts: [...counts.entries()].map(([name, count]) => ({ name, count })).sort((left, right) => left.name.localeCompare(right.name)),
    sources,
  };
}

function createRateLimiter({ maxAttempts, windowMs }) {
  const attempts = new Map();
  return (request) => {
    const key = request.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const existing = attempts.get(key);
    if (!existing || existing.resetAt <= now) {
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (existing.count >= maxAttempts) return false;
    existing.count += 1;
    return true;
  };
}

export function createApp(options = {}) {
  const config = options.config || loadConfig();
  const ownsPool = !options.pool;
  const pool = options.pool || createDatabasePool(config);
  const sourceStore = options.sourceStore || createSourceStore(pool);
  const adminAuth = options.auth || createAuth({
    pool,
    adminUsername: config.adminUsername,
    adminPassword: config.adminPassword,
    production: config.nodeEnv === "production",
  });
  const userAuth = options.userAuth || createUserAuth({
    pool,
    production: config.nodeEnv === "production",
  });
  const accountAttemptAllowed = createRateLimiter({ maxAttempts: 12, windowMs: 15 * 60 * 1000 });
  const adminAttemptAllowed = createRateLimiter({ maxAttempts: 8, windowMs: 15 * 60 * 1000 });

  async function requireAdmin(request, response) {
    if (!(await adminAuth.isAuthenticated(request))) {
      sendError(response, 401, "Please sign in to continue.");
      return false;
    }
    return true;
  }

  const app = http.createServer(async (request, response) => {
    securityHeaders(response);
    const requestUrl = new URL(request.url || "/", "http://localhost");
    const pathname = safePathname(requestUrl.pathname);

    if (!pathname) return sendError(response, 400, "Invalid request path.");

    try {
      if (pathname === "/api/health" && request.method === "GET") {
        const snapshot = await sourceStore.snapshot();
        const activeSources = activeSourcesFromSnapshot(snapshot);
        return sendJson(response, 200, {
          ok: true,
          database: "postgresql",
          apiConfigured: Boolean(config.apiKey),
          activeSources: activeSources.length,
          activeDomains: domainsFromSources(activeSources).length,
          model: config.model,
        });
      }

      if (pathname === "/api/sources" && request.method === "GET") {
        return sendJson(response, 200, await publicSourceResponse(sourceStore, requestUrl));
      }

      if (pathname === "/api/sources.pdf" && request.method === "GET") {
        const snapshot = await sourceStore.snapshot();
        const sources = activeSourcesFromSnapshot(snapshot);
        const pdf = trustedSourcesPdf({ sources, version: snapshot.version, updatedAt: snapshot.updatedAt });
        response.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=fact-check-trusted-sources-v" + snapshot.version + ".pdf",
          "Cache-Control": "no-store",
          "Content-Length": pdf.length,
        });
        return response.end(pdf);
      }

      if (pathname === "/api/auth/status" && request.method === "GET") {
        return sendJson(response, 200, { user: await userAuth.currentUser(request) });
      }

      if (pathname === "/api/auth/signup" && request.method === "POST") {
        if (!accountAttemptAllowed(request)) return sendError(response, 429, "Too many account attempts. Please try again later.");
        const body = await readJson(request, 64 * 1024);
        const account = await userAuth.signup({
          name: String(body.name || ""),
          email: String(body.email || ""),
          password: String(body.password || ""),
        });
        return sendJson(response, 201, { user: account.user }, { "Set-Cookie": userAuth.cookie(account.token) });
      }

      if (pathname === "/api/auth/login" && request.method === "POST") {
        if (!accountAttemptAllowed(request)) return sendError(response, 429, "Too many account attempts. Please try again later.");
        const body = await readJson(request, 64 * 1024);
        const account = await userAuth.login({
          email: String(body.email || ""),
          password: String(body.password || ""),
        });
        if (!account) return sendError(response, 401, "Email or password is not correct.");
        return sendJson(response, 200, { user: account.user }, { "Set-Cookie": userAuth.cookie(account.token) });
      }

      if (pathname === "/api/auth/logout" && request.method === "POST") {
        await userAuth.logout(request);
        return sendJson(response, 200, { ok: true }, { "Set-Cookie": userAuth.expiredCookie() });
      }

      if (pathname === "/api/check" && request.method === "POST") {
        const body = await readJson(request);
        const claim = String(body.claim || "").trim();
        const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
        if (!claim && !imageDataUrl) return sendError(response, 400, "Enter a claim or attach an image to check.");
        if (claim.length > 1800) return sendError(response, 400, "Please keep the claim under 1,800 characters.");
        if (!config.apiKey) return sendError(response, 503, "The fact-checking API key is not configured on this server.");

        const snapshot = await sourceStore.snapshot();
        const activeSources = activeSourcesFromSnapshot(snapshot);
        const domains = domainsFromSources(activeSources);
        const isApprovedUrl = (candidate) => {
          try {
            const hostname = sourceDomain(candidate);
            return domains.some((domain) => hostname === domain || hostname.endsWith("." + domain));
          } catch {
            return false;
          }
        };

        const result = await checkClaimWithOpenAI({
          apiKey: config.apiKey,
          model: config.model,
          claim,
          imageDataUrl,
          domains,
          isApprovedUrl,
          sourceLabelForUrl: (candidate) => {
            try {
              const domain = sourceDomain(candidate);
              const match = activeSources.find((source) => domain === source.domain || domain.endsWith("." + source.domain));
              return match?.name || "";
            } catch {
              return "";
            }
          },
        });
        return sendJson(response, 200, { ...result, registryVersion: snapshot.version });
      }

      if (pathname === "/api/admin/status" && request.method === "GET") {
        const snapshot = await sourceStore.snapshot();
        const activeSources = activeSourcesFromSnapshot(snapshot);
        return sendJson(response, 200, {
          authenticated: await adminAuth.isAuthenticated(request),
          configured: adminAuth.configured(),
          setupAllowed: false,
          usernameRequired: adminAuth.usernameRequired(),
          sourceCount: snapshot.sources.length,
          activeDomains: domainsFromSources(activeSources).length,
          version: snapshot.version,
        });
      }

      if (pathname === "/api/admin/login" && request.method === "POST") {
        if (!adminAttemptAllowed(request)) return sendError(response, 429, "Too many administrator sign-in attempts. Please try again later.");
        const body = await readJson(request, 64 * 1024);
        const token = await adminAuth.login(String(body.username || ""), String(body.password || ""));
        if (!token) return sendError(response, 401, "Those administrator credentials are not correct.");
        return sendJson(response, 200, { ok: true }, { "Set-Cookie": adminAuth.cookie(token) });
      }

      if (pathname === "/api/admin/logout" && request.method === "POST") {
        await adminAuth.logout(request);
        return sendJson(response, 200, { ok: true }, { "Set-Cookie": adminAuth.expiredCookie() });
      }

      if (pathname === "/api/admin/sources") {
        if (!(await requireAdmin(request, response))) return;
        if (request.method === "GET") return sendJson(response, 200, await sourceStore.snapshot());
        if (request.method === "POST") {
          const body = await readJson(request, 128 * 1024);
          return sendJson(response, 201, await sourceStore.add(body));
        }
      }

      if (pathname.startsWith("/api/admin/sources/")) {
        if (!(await requireAdmin(request, response))) return;
        const id = pathname.slice("/api/admin/sources/".length);
        if (!id) return sendError(response, 400, "A source ID is required.");
        if (request.method === "PATCH") {
          const body = await readJson(request, 128 * 1024);
          return sendJson(response, 200, await sourceStore.update(id, body));
        }
        if (request.method === "DELETE") return sendJson(response, 200, await sourceStore.remove(id));
      }

      if (pathname.startsWith("/api/")) return sendError(response, 404, "API route not found.");

      if (request.method !== "GET" && request.method !== "HEAD") return sendError(response, 405, "Method not allowed.");
      const assetPath = isAssetRequest(pathname) ? pathname.replace(/^\/+/, "") : "index.html";
      const resolved = path.resolve(PUBLIC_DIR, assetPath);
      if (!resolved.startsWith(PUBLIC_DIR + path.sep) && resolved !== path.join(PUBLIC_DIR, "index.html")) return sendError(response, 403, "Not allowed.");

      if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return sendFile(response, resolved, request.method);
      if (!isAssetRequest(pathname)) return sendFile(response, path.join(PUBLIC_DIR, "index.html"), request.method);
      return sendError(response, 404, "File not found.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      const status = /credentials are not correct|email or password is not correct/i.test(message)
        ? 401
        : /already exists/i.test(message)
          ? 409
          : /not found/i.test(message)
            ? 404
            : /required|valid|between|password|keep|smaller|active domains|more than 100/i.test(message)
              ? 400
              : /sign in|not allowed/i.test(message)
                ? 403
                : /database|postgresql|not initialized/i.test(message)
                  ? 503
                  : 500;
      return sendError(response, status, message);
    }
  });

  if (ownsPool) app.once("close", () => { void pool.end(); });
  return app;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  const config = loadConfig();
  let pool;
  try {
    pool = createDatabasePool(config);
    await assertDatabaseReady(pool);
    const app = createApp({ config, pool });
    app.listen(config.port, () => {
      console.log("Fact-Check is running at http://localhost:" + config.port);
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to start Fact-Check.");
    if (pool) await pool.end();
    process.exitCode = 1;
  }
}
