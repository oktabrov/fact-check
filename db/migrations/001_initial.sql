CREATE TABLE IF NOT EXISTS source_registry (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  version BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO source_registry (singleton, version)
VALUES (TRUE, 1)
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS trusted_sources (
  id TEXT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  url TEXT NOT NULL,
  domain VARCHAR(253) NOT NULL,
  category VARCHAR(90) NOT NULL,
  rationale VARCHAR(360) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_sources_url_ci
  ON trusted_sources ((LOWER(url)));

CREATE INDEX IF NOT EXISTS trusted_sources_active_domain
  ON trusted_sources (active, domain);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_ci
  ON app_users ((LOWER(email)));

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  principal_kind VARCHAR(10) NOT NULL CHECK (principal_kind IN ('admin', 'user')),
  user_id TEXT REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (principal_kind = 'admin' AND user_id IS NULL)
    OR (principal_kind = 'user' AND user_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS auth_sessions_expiry
  ON auth_sessions (expires_at);
