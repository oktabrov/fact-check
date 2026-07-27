UPDATE trusted_sources
SET category = CASE category_key
  WHEN 'international-institutions' THEN 'International institutions'
  WHEN 'government-and-law' THEN 'Government and law'
  WHEN 'economy-and-finance' THEN 'Economy and finance'
  WHEN 'public-health' THEN 'Public health'
  WHEN 'weather-and-emergencies' THEN 'Weather and emergencies'
  WHEN 'science-and-environment' THEN 'Science and environment'
  WHEN 'elections-and-civic-information' THEN 'Elections and civic information'
  WHEN 'cyber-and-digital-safety' THEN 'Cyber and digital safety'
  WHEN 'fact-checking-and-verification' THEN 'Fact-checking and verification'
  WHEN 'public-interest-journalism' THEN 'Public-interest journalism'
  ELSE category
END;

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
    'fact-checking-and-verification',
    'public-interest-journalism'
  )),
  ADD CONSTRAINT trusted_sources_https_url CHECK (url LIKE 'https://%'),
  ADD CONSTRAINT trusted_sources_normalized_domain CHECK (
    domain = LOWER(domain)
    AND domain NOT LIKE '%/%'
    AND domain NOT LIKE '%@%'
    AND domain NOT LIKE '%:%'
  );
