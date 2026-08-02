-- Complete the source-use review for the official NHC and NWS sources used
-- to verify U.S. hurricane landfall claims. Fact-Check links and cites only.
UPDATE trusted_sources
SET
  usage_status = 'reviewed-link-and-citation',
  usage_policy_url = 'https://www.weather.gov/disclaimer',
  usage_review_note = CASE id
    WHEN 'src-028' THEN 'NHC confirms that its National Weather Service information is public domain unless noted otherwise. Fact-Check links and cites source pages only, does not imply NOAA or NWS endorsement, and preserves source dates and times.'
    WHEN 'src-029' THEN 'NWS information is public domain unless noted otherwise. Fact-Check links and cites source pages only, does not imply NOAA or NWS endorsement, and preserves source dates and times.'
  END,
  usage_reviewed_at = '2026-08-02T00:00:00.000Z',
  updated_at = NOW()
WHERE id IN ('src-028', 'src-029');

UPDATE source_registry
SET version = GREATEST(version, 6), updated_at = '2026-08-02T00:00:00.000Z'
WHERE EXISTS (
  SELECT 1 FROM trusted_sources WHERE id IN ('src-028', 'src-029')
);
