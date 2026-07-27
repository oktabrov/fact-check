import crypto from "node:crypto";

const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const USER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function safelyEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function sessionCookie(name, token, ttlMs, production) {
  const parts = [name + "=" + encodeURIComponent(token), "HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=" + Math.floor(ttlMs / 1000)];
  if (production) parts.push("Secure");
  return parts.join("; ");
}

function expiredSessionCookie(name, production) {
  const parts = [name + "=", "HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=0"];
  if (production) parts.push("Secure");
  return parts.join("; ");
}

function normaliseEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function validateAccountInput({ name, email, password }) {
  const cleanName = String(name || "").trim().replace(/\s+/g, " ");
  const cleanEmail = normaliseEmail(email);
  const cleanPassword = String(password || "");
  if (cleanName.length < 2 || cleanName.length > 80) throw new Error("Use a name between 2 and 80 characters.");
  if (!validEmail(cleanEmail)) throw new Error("Enter a valid email address.");
  if (cleanPassword.length < 12 || cleanPassword.length > 256) throw new Error("Use a password between 12 and 256 characters.");
  return { name: cleanName, email: cleanEmail, password: cleanPassword };
}

function validateAdministratorInput({ email, password }) {
  const cleanEmail = normaliseEmail(email);
  const cleanPassword = String(password || "");
  if (!validEmail(cleanEmail)) throw new Error("Set a valid ADMIN_EMAIL in environment.env.");
  if (cleanPassword.length < 12 || cleanPassword.length > 256) throw new Error("ADMIN_PASSWORD must be between 12 and 256 characters.");
  return { email: cleanEmail, password: cleanPassword };
}

function requirePool(pool) {
  if (!pool?.query || !pool?.connect) throw new Error("A PostgreSQL pool is required for authentication.");
}

function tokenFromRequest(request, cookieName) {
  return parseCookies(request.headers.cookie)[cookieName] || "";
}

async function clearExpiredSessions(db) {
  await db.query("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
}

async function issueSession(db, { principalKind, userId = null, ttlMs }) {
  await clearExpiredSessions(db);
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs);
  await db.query(
    "INSERT INTO auth_sessions (token_hash, principal_kind, user_id, expires_at) VALUES ($1, $2, $3, $4)",
    [hashToken(token), principalKind, userId, expiresAt],
  );
  return token;
}

export async function bootstrapEnvironmentAdministrator({ pool, email = "", password = "", name = "Fact-Check Administrator", rotatePassword = false } = {}) {
  requirePool(pool);
  const credentials = validateAdministratorInput({ email, password });
  const cleanName = String(name || "Fact-Check Administrator").trim().replace(/\s+/g, " ").slice(0, 80) || "Fact-Check Administrator";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingResult = await client.query(
      "SELECT id, role, password_salt, password_hash FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1 FOR UPDATE",
      [credentials.email],
    );
    const existing = existingResult.rows[0];
    if (existing) {
      if (existing.role !== "admin") {
        throw new Error("The configured administrator email already belongs to a regular account. Resolve that account before bootstrapping administrator access.");
      }
      const passwordMatches = safelyEqual(hashPassword(credentials.password, existing.password_salt), existing.password_hash);
      if (rotatePassword && !passwordMatches) {
        const salt = crypto.randomBytes(16).toString("hex");
        await client.query(
          "UPDATE app_users SET password_salt = $2, password_hash = $3 WHERE id = $1",
          [existing.id, salt, hashPassword(credentials.password, salt)],
        );
        await client.query("DELETE FROM auth_sessions WHERE principal_kind = 'admin'");
      }
      await client.query("COMMIT");
      return { id: existing.id, created: false, rotated: Boolean(rotatePassword && !passwordMatches) };
    }

    const id = "admin_" + crypto.randomBytes(12).toString("hex");
    const salt = crypto.randomBytes(16).toString("hex");
    await client.query(
      "INSERT INTO app_users (id, name, email, password_salt, password_hash, role) VALUES ($1, $2, $3, $4, $5, 'admin')",
      [id, cleanName, credentials.email, salt, hashPassword(credentials.password, salt)],
    );
    await client.query("COMMIT");
    return { id, created: true, rotated: false };
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

export function createAuth({ pool, adminEmail = "", adminUsername = "", adminPassword = "", production = false } = {}) {
  requirePool(pool);
  const envEmail = normaliseEmail(adminEmail || adminUsername);
  const envPassword = String(adminPassword || "").trim();

  async function isAuthenticated(request) {
    const token = tokenFromRequest(request, "fact_check_admin");
    if (!token) return false;
    await clearExpiredSessions(pool);
    const result = await pool.query(
      "SELECT 1 FROM auth_sessions WHERE token_hash = $1 AND principal_kind = 'admin' AND expires_at > NOW()",
      [hashToken(token)],
    );
    return Boolean(result.rows[0]);
  }

  return {
    configured() {
      return Boolean(envEmail && envPassword);
    },
    usernameRequired() {
      return true;
    },
    setupAllowed() {
      return false;
    },
    isAuthenticated,
    async login(email, password) {
      if (!this.configured()) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in environment.env before signing in.");
      const cleanEmail = normaliseEmail(email);
      if (!safelyEqual(cleanEmail, envEmail)) return null;
      const result = await pool.query(
        "SELECT id, role, password_salt, password_hash FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [cleanEmail],
      );
      const administrator = result.rows[0];
      if (!administrator || administrator.role !== "admin") return null;
      if (!safelyEqual(hashPassword(password || "", administrator.password_salt), administrator.password_hash)) return null;
      return issueSession(pool, { principalKind: "admin", ttlMs: ADMIN_SESSION_TTL_MS });
    },
    async logout(request) {
      const token = tokenFromRequest(request, "fact_check_admin");
      if (token) await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [hashToken(token)]);
    },
    cookie(token) {
      return sessionCookie("fact_check_admin", token, ADMIN_SESSION_TTL_MS, production);
    },
    expiredCookie() {
      return expiredSessionCookie("fact_check_admin", production);
    },
  };
}

export function createUserAuth({ pool, production = false } = {}) {
  requirePool(pool);

  async function currentUser(request) {
    const token = tokenFromRequest(request, "fact_check_user");
    if (!token) return null;
    await clearExpiredSessions(pool);
    const result = await pool.query(
      "SELECT u.id, u.name, u.email, u.created_at FROM auth_sessions s JOIN app_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.principal_kind = 'user' AND s.expires_at > NOW()",
      [hashToken(token)],
    );
    return publicUser(result.rows[0]);
  }

  return {
    currentUser,
    async signup(input) {
      const { name, email, password } = validateAccountInput(input);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const duplicate = await client.query("SELECT id FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
        if (duplicate.rows[0]) throw new Error("An account with that email already exists.");
        const salt = crypto.randomBytes(16).toString("hex");
        const id = "user_" + crypto.randomBytes(12).toString("hex");
        const inserted = await client.query(
          "INSERT INTO app_users (id, name, email, password_salt, password_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, created_at",
          [id, name, email, salt, hashPassword(password, salt)],
        );
        const token = await issueSession(client, { principalKind: "user", userId: id, ttlMs: USER_SESSION_TTL_MS });
        await client.query("COMMIT");
        return { token, user: publicUser(inserted.rows[0]) };
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
    },
    async login({ email, password }) {
      const cleanEmail = normaliseEmail(email);
      const result = await pool.query(
        "SELECT id, name, email, password_salt, password_hash, role, created_at FROM app_users WHERE LOWER(email) = LOWER($1) LIMIT 1",
        [cleanEmail],
      );
      const user = result.rows[0];
      if (!user || !safelyEqual(hashPassword(password || "", user.password_salt), user.password_hash)) return null;
      if (user.role === "admin") return { administrator: true };
      const token = await issueSession(pool, { principalKind: "user", userId: user.id, ttlMs: USER_SESSION_TTL_MS });
      return { token, user: publicUser(user) };
    },
    async logout(request) {
      const token = tokenFromRequest(request, "fact_check_user");
      if (token) await pool.query("DELETE FROM auth_sessions WHERE token_hash = $1", [hashToken(token)]);
    },
    cookie(token) {
      return sessionCookie("fact_check_user", token, USER_SESSION_TTL_MS, production);
    },
    expiredCookie() {
      return expiredSessionCookie("fact_check_user", production);
    },
  };
}
