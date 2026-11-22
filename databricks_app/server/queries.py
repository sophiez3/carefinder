"""SQL used by the CareFinder backend. Tables are built by the notebook (datathon_trust_layer.py)."""

CATALOG_SQL = """
SELECT service, default_urgency FROM {schema}.services ORDER BY service
"""

CONDITIONS_SQL = """
SELECT condition, service FROM {schema}.condition_to_service ORDER BY condition
"""

ORIGIN_BY_PIN_SQL = """
SELECT pincode, district, state, pin_lat AS lat, pin_lon AS lon
FROM {schema}.pin_lookup
WHERE pincode = :pin AND pin_lat IS NOT NULL
"""

# City/district name -> average location. Tries district names first, then post-office names.
ORIGIN_BY_NAME_SQL = """
WITH d AS (
  SELECT 1 AS pri, max(district) AS district, max(state) AS state, avg(pin_lat) AS lat, avg(pin_lon) AS lon, count(*) AS n
  FROM {schema}.pin_lookup WHERE district = upper(trim(:place)) AND pin_lat IS NOT NULL
),
o AS (
  SELECT 2 AS pri, max(upper(district)) AS district, max(upper(statename)) AS state,
         avg(try_cast(latitude AS DOUBLE)) AS lat, avg(try_cast(longitude AS DOUBLE)) AS lon, count(*) AS n
  FROM {schema}.pin_raw
  WHERE upper(trim(officename)) IN (upper(trim(:place)), upper(trim(:place)) || ' H.O', upper(trim(:place)) || ' HO')
    AND try_cast(latitude AS DOUBLE) BETWEEN 6 AND 38
)
SELECT district, state, lat, lon FROM (SELECT * FROM d UNION ALL SELECT * FROM o)
WHERE n > 0 AND lat IS NOT NULL ORDER BY pri LIMIT 1
"""

# Raw facts for every facility with evidence for the service within max_km.
# Scoring happens in the browser (src/scoring.ts) so the method page and the ranking share one rulebook.
CANDIDATES_SQL = """
WITH svc AS (SELECT * FROM {schema}.services WHERE service = :service),
d AS (
  SELECT
    e.facility_id, e.name, e.city, e.district, e.state, e.lat, e.lon,
    e.evidence_score, e.evidence_tier, e.matched_fields, e.evidence_quotes, e.source_urls,
    e.location_confidence, e.flags, e.doctors_n, e.beds_n,
    fs.address, fs.phone, fs.year_est,
    ff.is_24x7, ff.mentions_govt_scheme, ff.mentions_private_insurance,
    CASE WHEN v.osm_ownership IN ('PUBLIC', 'PRIVATE', 'NONPROFIT') THEN v.osm_ownership ELSE ff.ownership END AS ownership,
    CASE WHEN v.osm_ownership IN ('PUBLIC', 'PRIVATE', 'NONPROFIT') THEN 'OpenStreetMap'
         WHEN ff.ownership <> 'UNKNOWN' THEN 'listing keywords' ELSE 'unknown' END AS ownership_source,
    ff.full_text rlike concat('(?i)', s.equip_pattern)      AS has_equipment,
    ff.full_text rlike concat('(?i)', s.specialist_pattern) AS has_specialist,
    v.verification, v.verification_sources, v.osm_url,
    2 * 6371 * asin(sqrt(
      pow(sin(radians(e.lat - :lat) / 2), 2) +
      cos(radians(:lat)) * cos(radians(e.lat)) * pow(sin(radians(e.lon - :lon) / 2), 2))) AS km
  FROM {schema}.facility_service_evidence e
  JOIN {schema}.facility_features ff USING (facility_id)
  LEFT JOIN {schema}.facilities_std fs USING (facility_id)
  LEFT JOIN {schema}.facility_verification v USING (facility_id)
  CROSS JOIN svc s
  WHERE e.service = :service
    AND e.lat IS NOT NULL
    AND abs(e.lat - :lat) <= :max_km / 111.0 + 0.05      -- cheap bounding-box prefilter
)
SELECT * FROM d WHERE km <= :max_km ORDER BY km LIMIT 300
"""
