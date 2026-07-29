-- Align existing installations with the source-use audit recorded in registry v5.
UPDATE trusted_sources
SET
  usage_status = 'reviewed-open-license',
  usage_policy_url = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
  usage_review_note = 'Site content is published under Open Government Licence v3 unless stated otherwise. Fact-Check links and cites only; third-party content and logos are not reused.',
  usage_reviewed_at = '2026-07-29T00:00:00.000Z',
  updated_at = NOW()
WHERE id = 'src-218';

UPDATE trusted_sources
SET
  usage_status = 'legacy-review-pending',
  usage_policy_url = NULL,
  usage_review_note = NULL,
  usage_reviewed_at = NULL,
  updated_at = NOW()
WHERE id = 'src-220';

UPDATE trusted_sources
SET
  usage_status = 'reviewed-link-and-citation',
  usage_policy_url = 'https://www.acma.gov.au/radiocomms-licence-data',
  usage_review_note = 'The register licence permits specified use and derivative distribution with attribution, but restricts personal licensee information. Fact-Check links and cites only; it does not copy register data.',
  usage_reviewed_at = '2026-07-29T00:00:00.000Z',
  updated_at = NOW()
WHERE id = 'src-234';

UPDATE trusted_sources
SET
  usage_status = 'reviewed-open-license',
  usage_policy_url = 'https://www.airquality.gov.wales/maps-data/open-data-services/spatial-object-register',
  usage_review_note = 'Welsh Government observational data is under the Open Government Licence with attribution. Fact-Check links and cites it and does not reuse logos, images, or third-party material.',
  usage_reviewed_at = '2026-07-29T00:00:00.000Z',
  updated_at = NOW()
WHERE id = 'src-235';

UPDATE source_registry
SET version = GREATEST(version, 5), updated_at = '2026-07-29T00:00:00.000Z'
WHERE EXISTS (
  SELECT 1 FROM trusted_sources WHERE id IN ('src-218', 'src-220', 'src-234', 'src-235')
);
