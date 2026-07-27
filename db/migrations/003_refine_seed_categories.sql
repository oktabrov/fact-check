UPDATE trusted_sources
SET category_key = 'public-health', category = 'Public health'
WHERE id IN (
  'src-026', 'src-032', 'src-033', 'src-035', 'src-037', 'src-039', 'src-041',
  'src-043', 'src-045', 'src-048', 'src-050', 'src-052', 'src-054', 'src-056'
);

UPDATE trusted_sources
SET category_key = 'weather-and-emergencies', category = 'Weather and emergencies'
WHERE id IN (
  'src-027', 'src-028', 'src-029', 'src-030', 'src-034', 'src-036', 'src-038',
  'src-040', 'src-042', 'src-044', 'src-046', 'src-047', 'src-049', 'src-051',
  'src-053', 'src-055', 'src-057', 'src-058', 'src-059', 'src-060'
);

UPDATE trusted_sources
SET category_key = 'science-and-environment', category = 'Science and environment'
WHERE id = 'src-031';

UPDATE source_registry
SET version = version + 1, updated_at = NOW()
WHERE singleton = TRUE
  AND EXISTS (SELECT 1 FROM trusted_sources);
