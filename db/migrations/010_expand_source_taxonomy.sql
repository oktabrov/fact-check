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
    'sports-and-entertainment',
    'news-and-current-affairs',
    'fact-checking-and-verification',
    'public-interest-journalism'
  ));

UPDATE source_registry
SET version = GREATEST(version, 8), updated_at = '2026-08-02T00:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM trusted_sources);
