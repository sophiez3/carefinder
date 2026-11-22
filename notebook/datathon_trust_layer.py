# Databricks notebook source
# MAGIC %md
# MAGIC # CMU Datathon: Facility Trust Layer
# MAGIC Run the cells **top to bottom**, one at a time (Shift+Enter).
# MAGIC Only edit the cells marked **EDIT ME**. Everything else just runs.
# MAGIC
# MAGIC What this builds, all in `workspace.datathon`:
# MAGIC 1. `facilities_raw`: your own copy of the Virtue Foundation data
# MAGIC 2. `facilities_std`: the same data with clean, standard column names
# MAGIC 3. `pin_lookup`: one row per PIN code (centroid, district, state)
# MAGIC 4. `services`: the service dictionary (keywords per service)
# MAGIC 5. `facility_service_evidence`: **the parallel trust table** (score, tier, quotes, flags)
# MAGIC 6. A search query: service + PIN code → ranked facilities with reasons

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 1. Find the dataset
# MAGIC **EDIT ME:** set `SOURCE_CATALOG` to the catalog name you picked when you clicked "Get instant access" in Marketplace.
# MAGIC (Not sure? Click **Catalog** in the left sidebar and look for it.)

# COMMAND ----------

SOURCE_CATALOG = "virtue_foundation_dataset"   # <-- EDIT ME

for row in spark.sql(f"SHOW SCHEMAS IN `{SOURCE_CATALOG}`").collect():
    schema = row[0]
    if schema == "information_schema":
        continue
    print(f"\n== schema: {schema}")
    for t in spark.sql(f"SHOW TABLES IN `{SOURCE_CATALOG}`.`{schema}`").collect():
        print(f"   {SOURCE_CATALOG}.{schema}.{t.tableName}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 2. Point at the tables
# MAGIC **EDIT ME:** copy the full names printed above (catalog.schema.table).

# COMMAND ----------

FACILITY_TABLE = "virtue_foundation_dataset.default.facilities"        # <-- EDIT ME
PIN_TABLE      = "virtue_foundation_dataset.default.india_post_pincode_directory"  # <-- EDIT ME

display(spark.sql(f"DESCRIBE TABLE {FACILITY_TABLE}"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 3. Make your own workspace and copy the data
# MAGIC Marketplace data is read-only, so we copy it into a schema you own.

# COMMAND ----------

spark.sql("CREATE SCHEMA IF NOT EXISTS workspace.datathon")
spark.sql(f"CREATE OR REPLACE TABLE workspace.datathon.facilities_raw AS SELECT * FROM {FACILITY_TABLE}")
spark.sql(f"CREATE OR REPLACE TABLE workspace.datathon.pin_raw AS SELECT * FROM {PIN_TABLE}")
print(spark.table("workspace.datathon.facilities_raw").count(), "facilities copied")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Coverage check: how full is each column?
# MAGIC This is good material for your "we treat every field as a claim" slide.

# COMMAND ----------

from pyspark.sql import functions as F
df = spark.table("workspace.datathon.facilities_raw")
n = df.count()
cov = df.select([
    (F.count(F.when(F.col(c).isNotNull() & (F.col(c).cast("string") != "") & (F.col(c).cast("string") != "[]"), 1)) / n * 100).alias(c)
    for c in df.columns
])
display(spark.createDataFrame(
    [(c, round(v, 1)) for c, v in cov.first().asDict().items()],
    ["column", "pct_filled"]
).orderBy("pct_filled"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 4. Map the real column names to standard names
# MAGIC **EDIT ME:** look at the DESCRIBE output from Step 2 and fill in the real column name on the right.
# MAGIC If a column doesn't exist, put `None`. Everything after this cell uses only the standard names on the left.

# COMMAND ----------

COLUMN_MAP = {
    "facility_id":   "id",               # <-- EDIT ME (unique id column)
    "name":          "name",
    "state":         "state",
    "city":          "city",
    "postcode":      "postcode",
    "lat":           "latitude",
    "lon":           "longitude",
    "description":   "description",
    "capability":    "capability",
    "procedure_txt": "procedure",
    "equipment":     "equipment",
    "specialties":   "specialties",
    "num_doctors":   "number_doctors",
    "capacity":      "capacity",
    "year_est":      "year_established",
    "source_urls":   "source_urls",
    "address":       None,               # optional: full address column, if the dataset has one
    "phone":         None,               # optional: phone column, if the dataset has one (enables the Call button)
}

raw_types = {f.name: f.dataType.typeName() for f in spark.table("workspace.datathon.facilities_raw").schema.fields}

def expr(std, real):
    if real is None:
        return f"CAST(NULL AS STRING) AS {std}"
    if std in ("lat", "lon"):
        return f"try_cast(`{real}` AS DOUBLE) AS {std}"
    if raw_types.get(real) == "array":   # ["Haemodialysis", "LSCS"] -> "Haemodialysis | LSCS" (clean quotes)
        return f"nullif(concat_ws(' | ', transform(`{real}`, x -> CAST(x AS STRING))), '') AS {std}"
    if raw_types.get(real) in ("struct", "map"):
        return f"to_json(`{real}`) AS {std}"
    return f"CAST(`{real}` AS STRING) AS {std}"

select_list = ",\n  ".join(expr(k, v) for k, v in COLUMN_MAP.items())
spark.sql(f"""
CREATE OR REPLACE TABLE workspace.datathon.facilities_std AS
SELECT
  {select_list}
FROM workspace.datathon.facilities_raw
""")
display(spark.table("workspace.datathon.facilities_std").limit(5))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 5. PIN code lookup (one row per PIN)
# MAGIC The raw file has one row **per post office**, so a PIN appears many times. We collapse it:
# MAGIC average coordinates, most common district, and a flag if a PIN spans more than one district.

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.datathon.pin_lookup AS
# MAGIC SELECT
# MAGIC   lpad(CAST(pincode AS STRING), 6, '0')        AS pincode,
# MAGIC   mode(upper(trim(district)))                  AS district,
# MAGIC   mode(upper(trim(statename)))                 AS state,
# MAGIC   avg(lat)                                     AS pin_lat,
# MAGIC   avg(lon)                                     AS pin_lon,
# MAGIC   count(DISTINCT upper(trim(district)))        AS n_districts,
# MAGIC   count(lat)                                   AS n_geocoded_offices
# MAGIC FROM (
# MAGIC   SELECT *,
# MAGIC     -- 'NA' strings become NULL; drop points outside India's bounding box
# MAGIC     CASE WHEN try_cast(latitude AS DOUBLE)  BETWEEN 6 AND 38 THEN try_cast(latitude AS DOUBLE)  END AS lat,
# MAGIC     CASE WHEN try_cast(longitude AS DOUBLE) BETWEEN 68 AND 98 THEN try_cast(longitude AS DOUBLE) END AS lon
# MAGIC   FROM workspace.datathon.pin_raw
# MAGIC )
# MAGIC GROUP BY 1;
# MAGIC
# MAGIC SELECT count(*) AS pins, sum(CASE WHEN n_districts > 1 THEN 1 ELSE 0 END) AS ambiguous_pins,
# MAGIC        sum(CASE WHEN pin_lat IS NULL THEN 1 ELSE 0 END) AS pins_without_coords
# MAGIC FROM workspace.datathon.pin_lookup;

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 6. Service dictionary
# MAGIC Each service gets a regex of keywords (`|` means OR). Matching ignores upper/lower case.
# MAGIC **Tune these.** Spot-check results and add synonyms you see in the data.

# COMMAND ----------

# MAGIC %sql
# MAGIC -- pattern          = words that show the facility offers the service
# MAGIC -- equip_pattern    = equipment that service needs
# MAGIC -- specialist_pattern = doctor types that service needs
# MAGIC -- default_urgency  = sets which weights are used (user can override in the app)
# MAGIC CREATE OR REPLACE TABLE workspace.datathon.services AS
# MAGIC SELECT * FROM VALUES
# MAGIC   ('dialysis',
# MAGIC    'dialysis|haemodialysis|hemodialysis|peritoneal dialysis|nephrology',
# MAGIC    'dialysis machine|haemodialysis machine|hemodialysis machine|dialyser|dialyzer|ro plant',
# MAGIC    'nephrolog', 'PLANNED'),
# MAGIC   ('emergency c-section',
# MAGIC    'caesarean|cesarean|c-section|c section|lscs|emergency obstetric|high.risk pregnan',
# MAGIC    'operation theat|labour room|labor room|blood bank|anaesthesia machine|anesthesia machine',
# MAGIC    'obstetric|gynaecolog|gynecolog|anaesthes|anesthes', 'EMERGENCY'),
# MAGIC   ('nicu',
# MAGIC    'nicu|neonatal intensive|neonatal icu|newborn intensive|sncu',
# MAGIC    'ventilator|incubator|radiant warmer|phototherapy|cpap',
# MAGIC    'neonatolog|paediatric|pediatric', 'EMERGENCY'),
# MAGIC   ('cardiac surgery',
# MAGIC    'cardiac surgery|cardiothoracic|cabg|bypass surgery|open.heart|valve replacement',
# MAGIC    'cath lab|cathlab|heart.lung machine|ecmo|cardiac icu|ccu',
# MAGIC    'cardiothoracic|cardiac surgeon|cardiolog', 'PLANNED'),
# MAGIC   ('mri',
# MAGIC    'mri scan|mri machine|[^a-z]mri[^a-z]|magnetic resonance',
# MAGIC    'mri|magnetic resonance|tesla',
# MAGIC    'radiolog', 'PLANNED'),
# MAGIC   ('burn care',
# MAGIC    'burn unit|burns unit|burn ward|burns ward|burn care|burn centre|burn center',
# MAGIC    'burn unit|icu|skin bank|operation theat',
# MAGIC    'plastic surg|burn', 'EMERGENCY'),
# MAGIC   ('trauma care',
# MAGIC    'trauma centre|trauma center|trauma care|polytrauma|casualty|accident and emergency',
# MAGIC    'ct scan|ct scanner|x.ray|ventilator|operation theat|blood bank|icu',
# MAGIC    'orthop|neurosurg|general surg|emergency medicine', 'EMERGENCY')
# MAGIC AS t(service, pattern, equip_pattern, specialist_pattern, default_urgency);
# MAGIC
# MAGIC -- Diagnosis/condition -> service (what the user types -> what we search)
# MAGIC CREATE OR REPLACE TABLE workspace.datathon.condition_to_service AS
# MAGIC SELECT * FROM VALUES
# MAGIC   ('kidney failure', 'dialysis'), ('chronic kidney disease', 'dialysis'), ('ckd', 'dialysis'),
# MAGIC   ('obstructed labour', 'emergency c-section'), ('high-risk pregnancy', 'emergency c-section'),
# MAGIC   ('breech baby', 'emergency c-section'),
# MAGIC   ('premature baby', 'nicu'), ('newborn breathing problem', 'nicu'), ('low birth weight', 'nicu'),
# MAGIC   ('blocked arteries', 'cardiac surgery'), ('heart valve disease', 'cardiac surgery'),
# MAGIC   ('brain scan', 'mri'), ('spine injury scan', 'mri'),
# MAGIC   ('burn injury', 'burn care'), ('fire injury', 'burn care'),
# MAGIC   ('road accident', 'trauma care'), ('head injury', 'trauma care'), ('fracture from fall', 'trauma care')
# MAGIC AS t(condition, service);

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 7. Build the trust table
# MAGIC **Scoring rules (your "HOW did you decide" answer):**
# MAGIC | Evidence | Points |
# MAGIC |---|---|
# MAGIC | Service named in **procedures** | +30 |
# MAGIC | Service named in **equipment** | +25 |
# MAGIC | Service named in **description** | +15 |
# MAGIC | Service named in **capability / specialties** | +10 |
# MAGIC | Facility reports doctor count or bed capacity | +10 |
# MAGIC
# MAGIC **Tiers:** STRONG = matched in 2+ fields, including procedures or equipment. MODERATE = 2+ fields, or procedures/equipment alone. WEAK = one soft field only.
# MAGIC
# MAGIC **Flags:** facility coordinates more than 25 km from its PIN centroid (LOCATION_MISMATCH), no coordinates (USING_PIN_CENTROID), ambiguous PIN (PIN_SPANS_DISTRICTS), WEAK tier (THIN_EVIDENCE).

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.datathon.facility_service_evidence AS
# MAGIC WITH f AS (
# MAGIC   SELECT fs.*,
# MAGIC     regexp_extract(postcode, '([0-9]{6})', 1) AS pin6
# MAGIC   FROM workspace.datathon.facilities_std fs
# MAGIC ),
# MAGIC geo AS (
# MAGIC   SELECT f.*, p.pin_lat, p.pin_lon, p.district, p.n_districts,
# MAGIC     CASE WHEN f.lat IS NOT NULL AND p.pin_lat IS NOT NULL THEN
# MAGIC       2 * 6371 * asin(sqrt(
# MAGIC         pow(sin(radians(p.pin_lat - f.lat) / 2), 2) +
# MAGIC         cos(radians(f.lat)) * cos(radians(p.pin_lat)) * pow(sin(radians(p.pin_lon - f.lon) / 2), 2)))
# MAGIC     END AS km_from_pin
# MAGIC   FROM f LEFT JOIN workspace.datathon.pin_lookup p ON f.pin6 = p.pincode
# MAGIC ),
# MAGIC m AS (
# MAGIC   SELECT g.*, s.service, s.pattern,
# MAGIC     coalesce(g.procedure_txt, '') rlike concat('(?i)', s.pattern) AS in_proc,
# MAGIC     coalesce(g.equipment, '')     rlike concat('(?i)', s.pattern) AS in_equip,
# MAGIC     coalesce(g.description, '')   rlike concat('(?i)', s.pattern) AS in_desc,
# MAGIC     concat_ws(' ', g.capability, g.specialties) rlike concat('(?i)', s.pattern) AS in_cap
# MAGIC   FROM geo g CROSS JOIN workspace.datathon.services s
# MAGIC ),
# MAGIC scored AS (
# MAGIC   SELECT *,
# MAGIC     (CASE WHEN in_proc THEN 30 ELSE 0 END) + (CASE WHEN in_equip THEN 25 ELSE 0 END) +
# MAGIC     (CASE WHEN in_desc THEN 15 ELSE 0 END) + (CASE WHEN in_cap THEN 10 ELSE 0 END) +
# MAGIC     (CASE WHEN num_doctors IS NOT NULL OR capacity IS NOT NULL THEN 10 ELSE 0 END) AS evidence_score,
# MAGIC     (CAST(in_proc AS INT) + CAST(in_equip AS INT) + CAST(in_desc AS INT) + CAST(in_cap AS INT)) AS n_fields
# MAGIC   FROM m
# MAGIC   WHERE in_proc OR in_equip OR in_desc OR in_cap
# MAGIC )
# MAGIC SELECT
# MAGIC   facility_id, name, city, state, district, pin6 AS pincode, service,
# MAGIC   evidence_score,
# MAGIC   CASE
# MAGIC     WHEN n_fields >= 2 AND (in_proc OR in_equip) THEN 'STRONG'
# MAGIC     WHEN n_fields >= 2 OR in_proc OR in_equip    THEN 'MODERATE'
# MAGIC     ELSE 'WEAK'
# MAGIC   END AS evidence_tier,
# MAGIC   filter(array(
# MAGIC     CASE WHEN in_proc  THEN 'procedures' END,
# MAGIC     CASE WHEN in_equip THEN 'equipment' END,
# MAGIC     CASE WHEN in_desc  THEN 'description' END,
# MAGIC     CASE WHEN in_cap   THEN 'capability/specialties' END), x -> x IS NOT NULL) AS matched_fields,
# MAGIC   -- citations: ~80 characters either side of the first keyword hit in each field
# MAGIC   filter(array(
# MAGIC     nullif(regexp_extract(coalesce(procedure_txt,''), concat('(?is)(.{0,80}(?:', pattern, ').{0,80})'), 1), ''),
# MAGIC     nullif(regexp_extract(coalesce(equipment,''),     concat('(?is)(.{0,80}(?:', pattern, ').{0,80})'), 1), ''),
# MAGIC     nullif(regexp_extract(coalesce(description,''),   concat('(?is)(.{0,80}(?:', pattern, ').{0,80})'), 1), '')
# MAGIC   ), x -> x IS NOT NULL) AS evidence_quotes,
# MAGIC   source_urls,
# MAGIC   try_cast(regexp_extract(coalesce(num_doctors,''), '([0-9]+)', 1) AS INT) AS doctors_n,
# MAGIC   try_cast(regexp_extract(coalesce(capacity,''),    '([0-9]+)', 1) AS INT) AS beds_n,
# MAGIC   coalesce(lat, pin_lat) AS lat,
# MAGIC   coalesce(lon, pin_lon) AS lon,
# MAGIC   CASE WHEN lat IS NOT NULL AND (km_from_pin IS NULL OR km_from_pin <= 25) THEN 'HIGH'
# MAGIC        WHEN lat IS NULL AND pin_lat IS NOT NULL THEN 'APPROX (PIN centroid)'
# MAGIC        WHEN km_from_pin > 25 THEN 'LOW (conflicting)'
# MAGIC        ELSE 'UNKNOWN' END AS location_confidence,
# MAGIC   round(km_from_pin, 1) AS km_from_pin,
# MAGIC   filter(array(
# MAGIC     CASE WHEN km_from_pin > 25 THEN 'LOCATION_MISMATCH' END,
# MAGIC     CASE WHEN lat IS NULL THEN 'USING_PIN_CENTROID' END,
# MAGIC     CASE WHEN n_districts > 1 THEN 'PIN_SPANS_DISTRICTS' END,
# MAGIC     CASE WHEN n_fields = 1 AND NOT (in_proc OR in_equip) THEN 'THIN_EVIDENCE' END
# MAGIC   ), x -> x IS NOT NULL) AS flags
# MAGIC FROM scored;
# MAGIC
# MAGIC SELECT service, evidence_tier, count(*) AS facilities
# MAGIC FROM workspace.datathon.facility_service_evidence
# MAGIC GROUP BY ALL ORDER BY service, evidence_tier;

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 8. Spot-check (do this by hand!)
# MAGIC Read 10–20 rows per service. Do the quotes actually prove the service? Fix the patterns in Step 6 if not, then re-run Steps 6–7.
# MAGIC Your notes from this step make a great "how we validated" slide.

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT name, city, evidence_tier, evidence_score, matched_fields, evidence_quotes, flags
# MAGIC FROM workspace.datathon.facility_service_evidence
# MAGIC WHERE service = 'dialysis'
# MAGIC ORDER BY rand() LIMIT 20;


# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 7b. Facility features: open hours, ownership, insurance
# MAGIC Pulled from the listing text with keywords, so these are **claims, not facts**. "UNKNOWN" stays unknown.
# MAGIC **If your dataset has a real ownership / operator-type column, use it instead of the keyword guess.**

# COMMAND ----------

# MAGIC %sql
# MAGIC CREATE OR REPLACE TABLE workspace.datathon.facility_features AS
# MAGIC WITH t AS (
# MAGIC   SELECT facility_id,
# MAGIC     concat_ws(' ', name, description, capability, specialties, procedure_txt, equipment) AS full_text
# MAGIC   FROM workspace.datathon.facilities_std
# MAGIC ),
# MAGIC k AS (
# MAGIC   SELECT *,
# MAGIC     full_text rlike '(?i)24 ?x ?7|24/7|24 hours|24-hour|24 hrs|round.the.clock' AS is_24x7,
# MAGIC     full_text rlike '(?i)government|govt|district hospital|civil hospital|primary health cent|community health cent|[^a-z]phc[^a-z]|[^a-z]chc[^a-z]|aiims|esic|municipal|medical college' AS looks_public,
# MAGIC     full_text rlike '(?i)pvt|private limited|[^a-z]ltd|limited|llp' AS looks_private,
# MAGIC     full_text rlike '(?i)ayushman|pm.?jay|cghs|[^a-z]esi[^a-z]|chiranjeevi|jyotiba|state health scheme' AS mentions_govt_scheme,
# MAGIC     full_text rlike '(?i)cashless|[^a-z]tpa[^a-z]|insurance' AS mentions_private_insurance
# MAGIC   FROM t
# MAGIC )
# MAGIC SELECT facility_id, full_text, is_24x7,
# MAGIC   CASE WHEN looks_public AND NOT looks_private THEN 'PUBLIC'
# MAGIC        WHEN looks_private AND NOT looks_public THEN 'PRIVATE'
# MAGIC        ELSE 'UNKNOWN' END AS ownership,
# MAGIC   mentions_govt_scheme, mentions_private_insurance
# MAGIC FROM k;
# MAGIC
# MAGIC SELECT ownership, sum(CAST(is_24x7 AS INT)) AS n_24x7, count(*) AS n
# MAGIC FROM workspace.datathon.facility_features GROUP BY ownership;
# MAGIC
# MAGIC -- Empty until Step 10 fills it, so later steps and the app always have something to join to.
# MAGIC CREATE TABLE IF NOT EXISTS workspace.datathon.facility_verification (
# MAGIC   facility_id STRING, verification STRING, verification_sources ARRAY<STRING>,
# MAGIC   osm_ownership STRING, osm_url STRING
# MAGIC );

# COMMAND ----------
# MAGIC %md
# MAGIC ## Step 9. Bring in outside databases (OpenStreetMap, and any others)
# MAGIC Free Edition can't download from most websites, so:
# MAGIC 1. Download the CSV on your laptop.
# MAGIC 2. In **Catalog → workspace → datathon → external** (the volume created below), click **Upload to this volume**.
# MAGIC 3. Call `load_external(...)` once per source, then `match_external(...)`.
# MAGIC
# MAGIC **OpenStreetMap is ready to go:** upload `osm_health_facilities_india.csv` (made by `data_prep/osm_to_csv.py`
# MAGIC from the HOT OSM export, © OpenStreetMap contributors, ODbL) and run the cell after the next one.
# MAGIC
# MAGIC **Matching rule** (outside lists don't share our IDs): candidate pairs share a PIN code or a ~11 km map grid cell.
# MAGIC Names are cleaned (lowercase; words like "hospital", "pvt ltd" removed) and compared by edit-distance similarity.
# MAGIC - **HIGH** = name similarity ≥ 0.85 and (same PIN or ≤ 2 km)
# MAGIC - **MEDIUM** = similarity ≥ 0.70 and ≤ 1 km
# MAGIC - Anything weaker is **not** matched. Spot-check 20 matches per source and report your precision.

# COMMAND ----------

spark.sql("CREATE VOLUME IF NOT EXISTS workspace.datathon.external")

def load_external(csv_path, slug, source_name, source_url, name_col,
                  lat_col=None, lon_col=None, pin_col=None, keep_cols=()):
    """Load one outside CSV into workspace.datathon.ext_<slug> with standard columns."""
    raw = spark.read.option("header", True).csv(csv_path)
    df = raw.select(
        F.monotonically_increasing_id().alias("ext_id"),
        F.col(f"`{name_col}`").alias("ext_name"),
        (F.col(f"`{lat_col}`").cast("double") if lat_col else F.lit(None).cast("double")).alias("ext_lat"),
        (F.col(f"`{lon_col}`").cast("double") if lon_col else F.lit(None).cast("double")).alias("ext_lon"),
        (F.regexp_extract(F.col(f"`{pin_col}`").cast("string"), "([0-9]{6})", 1) if pin_col
         else F.lit(None).cast("string")).alias("ext_pin"),
        (F.to_json(F.struct(*[F.col(f"`{c}`") for c in keep_cols])) if keep_cols
         else F.lit(None).cast("string")).alias("ext_attributes"),
        F.lit(source_name).alias("source_name"),
        F.lit(source_url).alias("source_url"),
        F.current_date().alias("loaded_on"),
    )
    df.write.mode("overwrite").saveAsTable(f"workspace.datathon.ext_{slug}")
    print(f"ext_{slug}: {df.count()} rows")

NORM = r"""trim(regexp_replace(regexp_replace(lower(coalesce({c}, '')), '[^a-z0-9 ]', ' '),
  '\\b(hospital|hospitals|clinic|centre|center|pvt|private|ltd|limited|llp|and|the|of|multi|speciality|specialty)\\b', ''))"""

def match_external(slug):
    """Match ext_<slug> to our facilities -> workspace.datathon.ext_matches_<slug>."""
    spark.sql(f"""
    CREATE OR REPLACE TABLE workspace.datathon.ext_matches_{slug} AS
    WITH fac AS (
      SELECT facility_id, name, lat, lon, regexp_extract(coalesce(postcode, ''), '([0-9]{{6}})', 1) AS pin6,
             {NORM.format(c='name')} AS n,
             round(lat, 1) AS glat, round(lon, 1) AS glon
      FROM workspace.datathon.facilities_std
    ),
    ext AS (
      SELECT *, {NORM.format(c='ext_name')} AS n, round(ext_lat, 1) AS glat, round(ext_lon, 1) AS glon
      FROM workspace.datathon.ext_{slug}
    ),
    pairs AS (
      SELECT e.ext_id, f.facility_id FROM ext e JOIN fac f ON e.ext_pin = f.pin6 AND e.ext_pin <> ''
      UNION
      SELECT e.ext_id, f.facility_id FROM ext e JOIN fac f ON e.glat = f.glat AND e.glon = f.glon
    ),
    scored AS (
      SELECT p.ext_id, p.facility_id, e.ext_name, f.name, e.source_name, e.source_url, e.ext_attributes,
        1 - levenshtein(e.n, f.n) / greatest(length(e.n), length(f.n), 1) AS name_sim,
        (e.ext_pin = f.pin6) AS same_pin,
        CASE WHEN e.ext_lat IS NOT NULL AND f.lat IS NOT NULL THEN
          2 * 6371 * asin(sqrt(pow(sin(radians(f.lat - e.ext_lat) / 2), 2) +
            cos(radians(e.ext_lat)) * cos(radians(f.lat)) * pow(sin(radians(f.lon - e.ext_lon) / 2), 2))) END AS km
      FROM pairs p JOIN ext e USING (ext_id) JOIN fac f USING (facility_id)
    ),
    labeled AS (
      SELECT *,
        CASE WHEN name_sim >= 0.85 AND (same_pin OR km <= 2) THEN 'HIGH'
             WHEN name_sim >= 0.70 AND km <= 1 THEN 'MEDIUM' END AS match_confidence
      FROM scored
    )
    SELECT ext_id, facility_id, ext_name, name, source_name, source_url, ext_attributes,
           name_sim, same_pin, km, match_confidence FROM (
      SELECT *,
        row_number() OVER (PARTITION BY ext_id      ORDER BY name_sim DESC, km ASC NULLS LAST) AS rk1,
        row_number() OVER (PARTITION BY facility_id ORDER BY name_sim DESC, km ASC NULLS LAST) AS rk2
      FROM labeled WHERE match_confidence IS NOT NULL
    ) WHERE rk1 = 1 AND rk2 = 1
    """)
    display(spark.sql(f"""SELECT match_confidence, count(*) AS n
                          FROM workspace.datathon.ext_matches_{slug} GROUP BY 1"""))

# COMMAND ----------

# Load + match OpenStreetMap (upload osm_health_facilities_india.csv to the volume first)
load_external("/Volumes/workspace/datathon/external/osm_health_facilities_india.csv", "osm",
              "OpenStreetMap", "https://www.openstreetmap.org/copyright",
              name_col="name", lat_col="lat", lon_col="lon",
              keep_cols=["ownership", "osm_url", "amenity", "speciality"])
match_external("osm")

# Add more sources the same way, e.g. a PM-JAY empanelled-hospital list:
# load_external("/Volumes/workspace/datathon/external/pmjay_hospitals.csv", "pmjay",
#               "PM-JAY empanelled hospitals", "https://...", name_col="Hospital Name",
#               pin_col="Pincode", keep_cols=["Specialities", "Hospital Type"])
# match_external("pmjay")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Spot-check the matches (do this by hand!)
# MAGIC Read 20 random matches. Count how many are truly the same facility. Report it, e.g. "19/20 OSM matches correct (95%)".

# COMMAND ----------

# MAGIC %sql
# MAGIC SELECT match_confidence, round(name_sim, 2) AS name_sim, round(km, 2) AS km, name AS our_name, ext_name AS osm_name,
# MAGIC        get_json_object(ext_attributes, '$.ownership') AS osm_ownership
# MAGIC FROM workspace.datathon.ext_matches_osm
# MAGIC ORDER BY rand() LIMIT 20;

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 10. Combine outside matches into one verification table
# MAGIC One row per facility: best match confidence, which sources confirmed it, and OSM ownership (government/private) when tagged.
# MAGIC OSM ownership **overrides** the keyword guess from Step 7b, because it is an explicit tag rather than a guess.

# COMMAND ----------

slugs = [r.tableName.replace("ext_matches_", "")
         for r in spark.sql("SHOW TABLES IN workspace.datathon LIKE 'ext_matches_*'").collect()]
print("Outside sources found:", slugs or "none yet")

if slugs:
    union = "\nUNION ALL\n".join(f"""
      SELECT facility_id, match_confidence, source_name,
             {"get_json_object(ext_attributes, '$.ownership')" if s == "osm" else "CAST(NULL AS STRING)"} AS osm_ownership,
             {"get_json_object(ext_attributes, '$.osm_url')"   if s == "osm" else "CAST(NULL AS STRING)"} AS osm_url
      FROM workspace.datathon.ext_matches_{s}""" for s in slugs)
    spark.sql(f"""
    CREATE OR REPLACE TABLE workspace.datathon.facility_verification AS
    SELECT facility_id,
      CASE WHEN bool_or(match_confidence = 'HIGH') THEN 'HIGH' ELSE 'MEDIUM' END AS verification,
      array_distinct(collect_list(source_name))                                   AS verification_sources,
      max(osm_ownership)                                                          AS osm_ownership,
      max(osm_url)                                                                AS osm_url
    FROM ({union}) GROUP BY facility_id
    """)
display(spark.sql("""SELECT verification, osm_ownership, count(*) AS facilities
                     FROM workspace.datathon.facility_verification GROUP BY ALL ORDER BY 1, 2"""))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 11. Weighted ranking: 11 factors, best option first
# MAGIC **This is the same rulebook the app uses** (`app/src/scoring.ts`). Each factor scores 0–1; points = weight × score.
# MAGIC Weights add up to 100 in each mode.
# MAGIC
# MAGIC | # | Factor | Emergency | Planned | How it's judged (0–1) |
# MAGIC |---|---|---|---|---|
# MAGIC | 1 | Travel time | 25 | 10 | halves every 45 min of estimated drive (km × 1.3 ÷ 35 km/h) |
# MAGIC | 2 | Evidence the service exists | 20 | 20 | evidence points ÷ 90 |
# MAGIC | 3 | Open when you arrive | 15 | 3 | 24/7 listed = 1 · unknown by day = 0.6 · unknown at night = 0.2 |
# MAGIC | 4 | Wait time | 10 | 7 | halves every 60 min — **no data yet, so excluded and rescaled** |
# MAGIC | 5 | Specialist (doctor type) | 7 | 10 | right doctor type named = 1, else 0 |
# MAGIC | 6 | Equipment | 8 | 10 | needed equipment named = 1, else 0 |
# MAGIC | 7 | Outside verification | 5 | 10 | HIGH match = 1 · MEDIUM = 0.6 · none = 0.3 |
# MAGIC | 8 | Cost (public vs private) | 2 | 12 | any budget or public/non-profit = 1 · unknown = 0.5 · private when preferring public = 0.2 |
# MAGIC | 9 | Insurance fit | 3 | 10 | none chosen = 1 · govt scheme: public 1, mentions 0.7, unknown 0.3 · private: mentions 1, unknown 0.3 |
# MAGIC | 10 | Location confidence | 3 | 3 | HIGH 1 · PIN centre 0.6 · conflicting 0.2 |
# MAGIC | 11 | Capacity (doctors/beds) | 2 | 5 | log-scaled, 50 doctors or 200 beds = 1 · unreported 0.3 |
# MAGIC
# MAGIC **Hard rules:** A) must have evidence for the service · B) WEAK evidence always ranks below the rest ·
# MAGIC C) `overall = points earned ÷ points possible from factors with data × 100` · D) "free only" removes private; max distance applies ·
# MAGIC E) unknown hours at night or in an emergency score low and get a "call ahead" warning.

# COMMAND ----------

FACTOR_KEYS = ["travel", "evidence", "hours", "wait", "specialist", "equipment",
               "verification", "cost", "insurance", "location", "capacity"]
WEIGHTS = {
    "EMERGENCY": dict(zip(FACTOR_KEYS, [25, 20, 15, 10, 7, 8, 5, 2, 3, 3, 2])),
    "PLANNED":   dict(zip(FACTOR_KEYS, [10, 20, 3, 7, 10, 10, 10, 12, 10, 3, 5])),
}
for mode, w in WEIGHTS.items():
    assert sum(w.values()) == 100, (mode, sum(w.values()))

for name in ["service", "pincode", "max_km", "urgency", "arrival", "budget", "insurance"]:
    try:
        dbutils.widgets.remove(name)
    except Exception:
        pass
dbutils.widgets.dropdown("service", "dialysis",
    [r.service for r in spark.table("workspace.datathon.services").collect()])
dbutils.widgets.text("pincode", "302001")   # Jaipur example
dbutils.widgets.text("max_km", "100")
dbutils.widgets.dropdown("urgency", "auto", ["auto", "EMERGENCY", "PLANNED"])
dbutils.widgets.text("arrival", "now")       # 'now' or HH:MM, e.g. 22:30
dbutils.widgets.dropdown("budget", "any", ["any", "prefer_public", "free_only"])
dbutils.widgets.dropdown("insurance", "none", ["none", "govt_scheme", "private"])

SEARCH_SQL = """
WITH origin AS (
  SELECT pin_lat AS o_lat, pin_lon AS o_lon FROM workspace.datathon.pin_lookup WHERE pincode = :pincode
),
svc AS (SELECT * FROM workspace.datathon.services WHERE service = :service),
d AS (
  SELECT e.*, ff.is_24x7, ff.mentions_govt_scheme, ff.mentions_private_insurance,
    CASE WHEN v.osm_ownership IN ('PUBLIC','PRIVATE','NONPROFIT') THEN v.osm_ownership ELSE ff.ownership END AS ownership,
    v.verification, v.verification_sources,
    ff.full_text rlike concat('(?i)', s.equip_pattern)      AS has_equipment,
    ff.full_text rlike concat('(?i)', s.specialist_pattern) AS has_specialist,
    2 * 6371 * asin(sqrt(
      pow(sin(radians(e.lat - o.o_lat) / 2), 2) +
      cos(radians(o.o_lat)) * cos(radians(e.lat)) * pow(sin(radians(e.lon - o.o_lon) / 2), 2))) AS km
  FROM workspace.datathon.facility_service_evidence e
  JOIN workspace.datathon.facility_features ff USING (facility_id)
  LEFT JOIN workspace.datathon.facility_verification v USING (facility_id)
  CROSS JOIN svc s CROSS JOIN origin o
  WHERE e.service = :service AND e.lat IS NOT NULL
),
f AS (
  SELECT d.*, km * 1.3 / 35 * 60 AS est_minutes, CAST(NULL AS DOUBLE) AS wait_minutes
  FROM d WHERE km <= :max_km AND NOT (:budget = 'free_only' AND ownership = 'PRIVATE')
),
s AS (
  SELECT f.*,
    power(0.5, est_minutes / 45.0)                                           AS s_travel,
    least(1.0, evidence_score / 90.0)                                        AS s_evidence,
    CASE WHEN is_24x7 THEN 1.0 WHEN :night THEN 0.2 ELSE 0.6 END             AS s_hours,
    CASE WHEN wait_minutes IS NOT NULL THEN power(0.5, wait_minutes / 60.0) END AS s_wait,
    CASE WHEN has_specialist THEN 1.0 ELSE 0.0 END                           AS s_specialist,
    CASE WHEN has_equipment  THEN 1.0 ELSE 0.0 END                           AS s_equipment,
    CASE verification WHEN 'HIGH' THEN 1.0 WHEN 'MEDIUM' THEN 0.6 ELSE 0.3 END AS s_verification,
    CASE WHEN :budget = 'any' OR ownership IN ('PUBLIC','NONPROFIT') THEN 1.0
         WHEN ownership = 'UNKNOWN' THEN 0.5 ELSE 0.2 END                    AS s_cost,
    CASE WHEN :insurance = 'none' THEN 1.0
         WHEN :insurance = 'govt_scheme' THEN CASE WHEN ownership = 'PUBLIC' THEN 1.0 WHEN mentions_govt_scheme THEN 0.7 ELSE 0.3 END
         ELSE CASE WHEN mentions_private_insurance THEN 1.0 ELSE 0.3 END END AS s_insurance,
    CASE WHEN location_confidence LIKE 'HIGH%' THEN 1.0 WHEN location_confidence LIKE 'APPROX%' THEN 0.6
         WHEN location_confidence LIKE 'LOW%' THEN 0.2 ELSE 0.4 END          AS s_location,
    -- note: least()/greatest() skip NULLs, so each side is guarded explicitly
    CASE WHEN doctors_n IS NULL AND beds_n IS NULL THEN 0.3
         ELSE greatest(CASE WHEN doctors_n IS NULL THEN 0.0 ELSE least(1.0, ln(1 + doctors_n) / ln(51)) END,
                       CASE WHEN beds_n    IS NULL THEN 0.0 ELSE least(1.0, ln(1 + beds_n)    / ln(201)) END) END AS s_capacity
  FROM f
),
scored AS (
  SELECT s.*,
    (:w_travel*s_travel + :w_evidence*s_evidence + :w_hours*s_hours + coalesce(:w_wait*s_wait, 0)
     + :w_specialist*s_specialist + :w_equipment*s_equipment + :w_verification*s_verification
     + :w_cost*s_cost + :w_insurance*s_insurance + :w_location*s_location + :w_capacity*s_capacity) AS points_earned,
    (100 - CASE WHEN s_wait IS NULL THEN :w_wait ELSE 0 END)                                      AS points_possible
  FROM s
)
SELECT
  row_number() OVER (ORDER BY (evidence_tier = 'WEAK'), points_earned / points_possible DESC) AS rank,
  CASE WHEN evidence_tier = 'WEAK' THEN 'Other possible options' ELSE 'Recommended' END AS list_group,
  name, city, district,
  round(km, 1) AS km, CAST(round(est_minutes) AS INT) AS est_travel_min,
  'Not reported' AS wait_time,
  CASE WHEN is_24x7 THEN 'Listed as 24/7' ELSE 'Hours not listed' END AS open_hours,
  evidence_tier, ownership, verification,
  round(100 * points_earned / points_possible, 1) AS overall_score,
  round(:w_travel*s_travel, 1) AS travel_pts, round(:w_evidence*s_evidence, 1) AS evidence_pts,
  round(:w_hours*s_hours, 1) AS hours_pts, round(:w_specialist*s_specialist, 1) AS specialist_pts,
  round(:w_equipment*s_equipment, 1) AS equipment_pts, round(:w_verification*s_verification, 1) AS verification_pts,
  round(:w_cost*s_cost, 1) AS cost_pts, round(:w_insurance*s_insurance, 1) AS insurance_pts,
  round(:w_location*s_location, 1) AS location_pts, round(:w_capacity*s_capacity, 1) AS capacity_pts,
  matched_fields, evidence_quotes, source_urls, location_confidence, flags
FROM scored
ORDER BY rank
LIMIT 15
"""

from datetime import datetime
service = dbutils.widgets.get("service")
urgency = dbutils.widgets.get("urgency")
if urgency == "auto":
    urgency = spark.sql("SELECT default_urgency FROM workspace.datathon.services WHERE service = :s",
                        args={"s": service}).first()[0]
arrival = dbutils.widgets.get("arrival").strip()
hour = datetime.now().hour if arrival == "now" else int(arrival.split(":")[0])
night = hour >= 20 or hour < 7
print(f"Urgency: {urgency} | night arrival: {night} | weights: {WEIGHTS[urgency]}")

display(spark.sql(SEARCH_SQL, args={
    "service": service, "pincode": dbutils.widgets.get("pincode"),
    "max_km": float(dbutils.widgets.get("max_km")), "night": night,
    "budget": dbutils.widgets.get("budget"), "insurance": dbutils.widgets.get("insurance"),
    **{f"w_{k}": float(v) for k, v in WEIGHTS[urgency].items()},
}))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Step 12. Ready for the app?
# MAGIC The CareFinder app (Databricks Apps) reads these tables. Every row should say OK before you deploy it.

# COMMAND ----------

needed = ["services", "condition_to_service", "pin_lookup", "pin_raw", "facilities_std",
          "facility_service_evidence", "facility_features", "facility_verification"]
existing = {r.tableName for r in spark.sql("SHOW TABLES IN workspace.datathon").collect()}
rows = []
for t in needed:
    n = spark.table(f"workspace.datathon.{t}").count() if t in existing else None
    rows.append((t, "OK" if n else ("EMPTY" if n == 0 else "MISSING"), n))
display(spark.createDataFrame(rows, "table string, status string, row_count long"))
