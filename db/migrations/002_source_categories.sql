ALTER TABLE trusted_sources
  ADD COLUMN IF NOT EXISTS category_key VARCHAR(64);

UPDATE trusted_sources
SET category_key = CASE LOWER(category)
  WHEN 'international authority' THEN 'international-institutions'
  WHEN 'fact-checking / verification' THEN 'fact-checking-and-verification'
  WHEN 'news / public-interest journalism' THEN 'public-interest-journalism'
  ELSE 'government-and-law'
END
WHERE category_key IS NULL OR category_key = '';

ALTER TABLE trusted_sources
  ALTER COLUMN category_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS trusted_sources_active_category
  ON trusted_sources (active, category_key);

CREATE TABLE IF NOT EXISTS source_admission_reviews (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES trusted_sources(id) ON DELETE SET NULL,
  candidate_url TEXT NOT NULL,
  candidate_domain VARCHAR(253) NOT NULL,
  recommended_category_key VARCHAR(64) NOT NULL,
  eligible BOOLEAN NOT NULL,
  manual_reviewed BOOLEAN NOT NULL,
  reason VARCHAR(600) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS source_admission_reviews_source
  ON source_admission_reviews (source_id, created_at DESC);
