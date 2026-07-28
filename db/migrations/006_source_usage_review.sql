ALTER TABLE trusted_sources
  ADD COLUMN IF NOT EXISTS usage_status VARCHAR(32) NOT NULL DEFAULT 'legacy-review-pending',
  ADD COLUMN IF NOT EXISTS usage_policy_url TEXT,
  ADD COLUMN IF NOT EXISTS usage_review_note VARCHAR(420),
  ADD COLUMN IF NOT EXISTS usage_reviewed_at TIMESTAMPTZ;

ALTER TABLE trusted_sources
  ADD CONSTRAINT trusted_sources_usage_status_allowed CHECK (usage_status IN (
    'legacy-review-pending',
    'reviewed-link-and-citation',
    'reviewed-open-license'
  )),
  ADD CONSTRAINT trusted_sources_usage_policy_url_https CHECK (
    usage_policy_url IS NULL OR usage_policy_url LIKE 'https://%'
  );

ALTER TABLE source_admission_reviews
  ADD COLUMN IF NOT EXISTS usage_status VARCHAR(32),
  ADD COLUMN IF NOT EXISTS usage_policy_url TEXT,
  ADD COLUMN IF NOT EXISTS usage_review_note VARCHAR(420),
  ADD COLUMN IF NOT EXISTS usage_reviewed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS trusted_sources_usage_status
  ON trusted_sources (usage_status, active);
