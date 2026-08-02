DELETE FROM trusted_sources
WHERE active IS NOT TRUE
  OR usage_status NOT IN ('reviewed-link-and-citation', 'reviewed-open-license')
  OR usage_policy_url IS NULL;

UPDATE source_registry
SET version = GREATEST(version, 11), updated_at = '2026-08-02T00:00:00.000Z'
WHERE EXISTS (SELECT 1 FROM trusted_sources);
