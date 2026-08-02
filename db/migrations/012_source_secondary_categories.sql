ALTER TABLE trusted_sources
  DROP CONSTRAINT IF EXISTS trusted_sources_category_key_allowed;

ALTER TABLE trusted_sources
  ADD CONSTRAINT trusted_sources_category_key_allowed CHECK (category_key IN (
    'international-institutions',
    'government-and-law',
    'economy-and-finance',
    'public-health',
    'weather-and-emergencies',
    'science-and-environment',
    'elections-and-civic-information',
    'cyber-and-digital-safety',
    'companies-and-products',
    'games-and-interactive-entertainment',
    'sports-and-entertainment',
    'news-and-current-affairs',
    'fact-checking-and-verification',
    'public-interest-journalism'
  ));

CREATE TABLE IF NOT EXISTS trusted_source_secondary_categories (
  source_id TEXT NOT NULL REFERENCES trusted_sources(id) ON DELETE CASCADE,
  category_key VARCHAR(64) NOT NULL CHECK (category_key IN (
    'international-institutions',
    'government-and-law',
    'economy-and-finance',
    'public-health',
    'weather-and-emergencies',
    'science-and-environment',
    'elections-and-civic-information',
    'cyber-and-digital-safety',
    'companies-and-products',
    'games-and-interactive-entertainment',
    'sports-and-entertainment',
    'news-and-current-affairs',
    'fact-checking-and-verification',
    'public-interest-journalism'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_id, category_key)
);

CREATE INDEX IF NOT EXISTS trusted_source_secondary_categories_lookup
  ON trusted_source_secondary_categories (category_key, source_id);

UPDATE source_registry
SET version = GREATEST(version, 10), updated_at = '2026-08-02T00:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM trusted_sources);
