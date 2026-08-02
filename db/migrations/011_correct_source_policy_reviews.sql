UPDATE trusted_sources
SET
  usage_policy_url = 'https://www.sony.com/en/copyright/index.html',
  usage_review_note = 'Official site terms were reviewed for direct linking and citation. Fact-Check links to source pages only and does not reproduce protected content, use marks, or imply endorsement.',
  usage_reviewed_at = '2026-08-02T00:00:00.000Z',
  updated_at = NOW()
WHERE id = 'src-243';

UPDATE trusted_sources
SET
  usage_status = 'legacy-review-pending',
  usage_policy_url = NULL,
  usage_review_note = NULL,
  usage_reviewed_at = NULL,
  updated_at = NOW()
WHERE id = 'src-281';

UPDATE source_registry
SET version = GREATEST(version, 9), updated_at = '2026-08-02T00:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM trusted_sources WHERE id IN ('src-243', 'src-281'));
