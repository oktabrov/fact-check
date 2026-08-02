-- Expand the usable evidence network with existing first-party sources whose
-- source-use terms have been reviewed. The application links and cites these
-- pages; it does not republish protected material or imply endorsement.
UPDATE trusted_sources
SET
  usage_status = CASE id
    WHEN 'src-042' THEN 'reviewed-open-license'
    WHEN 'src-162' THEN 'reviewed-open-license'
    WHEN 'src-164' THEN 'reviewed-open-license'
    WHEN 'src-168' THEN 'reviewed-open-license'
    ELSE 'reviewed-link-and-citation'
  END,
  usage_policy_url = CASE id
    WHEN 'src-001' THEN 'https://www.who.int/about/policies/terms-of-use'
    WHEN 'src-005' THEN 'https://public.wmo.int/copyright'
    WHEN 'src-020' THEN 'https://www.ema.europa.eu/en/about-us/about-website/legal-notice'
    WHEN 'src-022' THEN 'https://www.copernicus.eu/en/access-data/copyright-and-licences'
    WHEN 'src-026' THEN 'https://www.cdc.gov/other/agencymaterials.html'
    WHEN 'src-030' THEN 'https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted'
    WHEN 'src-032' THEN 'https://www.fda.gov/about-fda/about-website/website-policies'
    WHEN 'src-042' THEN 'https://www.jma.go.jp/jma/en/copyright.html'
    WHEN 'src-066' THEN 'https://fullfact.org/terms-and-conditions/'
    WHEN 'src-068' THEN 'https://www.politifact.com/copyright/'
    WHEN 'src-100' THEN 'https://theconversation.com/us/republishing-guidelines'
    WHEN 'src-155' THEN 'https://oceanservice.noaa.gov/about/faq.html'
    WHEN 'src-159' THEN 'https://www.nist.gov/copyrights-disclaimers'
    WHEN 'src-161' THEN 'https://www.enisa.europa.eu/about-enisa/legal-notice'
    WHEN 'src-162' THEN 'https://www.ncsc.gov.uk/section/about-this-website/terms-and-conditions'
    WHEN 'src-164' THEN 'https://www.cyber.gov.au/about-us/copyright'
    WHEN 'src-166' THEN 'https://www.eac.gov/main/privacy-statement'
    WHEN 'src-167' THEN 'https://www.elections.ca/content.aspx?document=index&lang=e&section=pri'
    WHEN 'src-168' THEN 'https://aec.gov.au/footer/Copyright.htm'
  END,
  usage_review_note = CASE id
    WHEN 'src-001' THEN 'WHO website terms were reviewed. Fact-Check links and cites source pages only, preserves attribution, and does not reproduce content, use WHO marks, or imply endorsement.'
    WHEN 'src-005' THEN 'WMO permits short excerpts with attribution. Fact-Check links and cites source pages only and does not reproduce restricted material, use WMO marks, or imply endorsement.'
    WHEN 'src-020' THEN 'EMA permits citations and source-acknowledged use subject to stated exclusions. Fact-Check links and cites only and excludes third-party material and agency marks.'
    WHEN 'src-022' THEN 'Copernicus data and information terms were reviewed. Fact-Check links and cites source pages only and does not use EU or Copernicus marks or imply endorsement.'
    WHEN 'src-026' THEN 'CDC permits use of most public-domain material with attribution. Fact-Check links and cites only, avoids third-party content, and does not imply endorsement.'
    WHEN 'src-030' THEN 'USGS-authored content is public domain. Fact-Check links and cites only, credits USGS, excludes third-party materials, and does not imply endorsement.'
    WHEN 'src-032' THEN 'FDA website content is public domain unless noted. Fact-Check links and cites only, avoids marks and third-party content, and does not imply endorsement.'
    WHEN 'src-042' THEN 'JMA website terms use Japan''s Public Data License, compatible with CC BY 4.0. Fact-Check credits sources, excludes logos and third-party content, and does not issue forecasts.'
    WHEN 'src-066' THEN 'Full Fact retains copyright. Fact-Check links and cites source pages only and does not reproduce, republish, or imply endorsement.'
    WHEN 'src-068' THEN 'PolitiFact permits hyperlinks that do not imply sponsorship or endorsement. Fact-Check links and cites only and does not copy, archive, or republish site content.'
    WHEN 'src-100' THEN 'The Conversation publishes articles under a Creative Commons Attribution-NoDerivatives policy. Fact-Check links and cites original pages only and does not edit, reproduce, or use logos.'
    WHEN 'src-155' THEN 'NOAA material is generally public domain unless noted. Fact-Check links and cites only, avoids third-party content and marks, and does not imply endorsement.'
    WHEN 'src-159' THEN 'NIST information is public unless marked otherwise. Fact-Check links and cites only, credits NIST, excludes restricted material, and does not imply endorsement.'
    WHEN 'src-161' THEN 'ENISA authorizes source-acknowledged use unless otherwise stated. Fact-Check links and cites only and excludes third-party photos and agency marks.'
    WHEN 'src-162' THEN 'NCSC website content normally falls under the Open Government Licence v3. Fact-Check credits NCSC, excludes third-party content, and does not imply endorsement.'
    WHEN 'src-164' THEN 'Australian Cyber Security Centre material is CC BY 4.0 unless excluded. Fact-Check credits the source, excludes marks and third-party material, and does not imply endorsement.'
    WHEN 'src-166' THEN 'EAC permits free linking and asks to be credited. Fact-Check links and cites only and does not imply EAC endorsement.'
    WHEN 'src-167' THEN 'Elections Canada states conditions for non-commercial reproduction. Fact-Check links and cites only, does not bulk-download or reproduce content, and excludes official marks.'
    WHEN 'src-168' THEN 'AEC site material is generally CC BY 4.0. Fact-Check credits the AEC, excludes maps, logos, and third-party material, and does not imply endorsement.'
  END,
  usage_reviewed_at = '2026-08-02T00:00:00.000Z',
  updated_at = NOW()
WHERE id IN (
  'src-001', 'src-005', 'src-020', 'src-022', 'src-026', 'src-030', 'src-032',
  'src-042', 'src-066', 'src-068', 'src-100', 'src-155', 'src-159', 'src-161',
  'src-162', 'src-164', 'src-166', 'src-167', 'src-168'
);

UPDATE source_registry
SET version = GREATEST(version, 7), updated_at = '2026-08-02T00:00:00.000Z'
WHERE EXISTS (
  SELECT 1 FROM trusted_sources WHERE id IN (
    'src-001', 'src-005', 'src-020', 'src-022', 'src-026', 'src-030', 'src-032',
    'src-042', 'src-066', 'src-068', 'src-100', 'src-155', 'src-159', 'src-161',
    'src-162', 'src-164', 'src-166', 'src-167', 'src-168'
  )
);
