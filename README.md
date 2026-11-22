# CareFinder India — CMU Datathon Fall 2026

**Input:** a service (or a condition like "kidney failure") plus a location (PIN code, district or GPS).
**Output:** ranked facilities, each with a 0–100 match score, the quoted evidence behind it, a factor-by-factor breakdown, and warnings wherever the data is uncertain.

## What's in this folder

| Folder | What it is | Where it runs |
|---|---|---|
| `notebook/datathon_trust_layer.py` | Builds the trust tables: cleaning, PIN lookup, evidence scoring, OSM cross-check, 11-factor ranking | Databricks notebook |
| `data_prep/osm_health_facilities_india.csv` | 121,575 OpenStreetMap hospitals/clinics, flattened (© OpenStreetMap contributors, ODbL) | Upload to a Databricks volume |
| `data_prep/osm_to_csv.py` | Script that made the CSV from the HOT OSM GeoJSON export | Your laptop (already run) |
| `databricks_app/` | **The deployable app**: FastAPI backend (`server/`), built React UI (`static/`), `app.yaml` | Databricks Apps |
| `app/` | React source (from your Figma Make export). Edit here, then rebuild. | Cursor / Figma Make |

The ranking rules live in one place, `app/src/scoring.ts`, and the "How we decided" page reads from it. Step 11 of the notebook is the same rulebook in SQL, and I checked both against the same facilities: the scores match.

## Order of work

### 1. Run the notebook (Databricks)
1. Workspace → Import → `notebook/datathon_trust_layer.py`. Connect to **Serverless**.
2. Edit the three **EDIT ME** cells (catalog name, table names, column map) and run Steps 1–8 and 7b.
3. **Step 9 (OpenStreetMap):** run the cell that creates the `external` volume. In Catalog → workspace → datathon → external, click **Upload to this volume** and upload `osm_health_facilities_india.csv`. Then run the load-and-match cell.
4. Spot-check 20 OSM matches and write down how many are correct. That number goes on a slide.
5. Run Steps 10–12. In Step 12, every table should say **OK**.

### 2. Deploy the app (Databricks Apps)
1. **Compute → Apps → Create app → Custom.** Name it `carefinder`.
2. On the resources step, add a **SQL warehouse** resource with resource key **`sql-warehouse`** and permission *Can use*. (app.yaml reads that key.)
3. Upload the **contents** of `databricks_app/` (`app.yaml`, `requirements.txt`, `server/`, `static/`) to a workspace folder, e.g. `/Workspace/Users/<you>/carefinder`. With the Databricks CLI:
   ```bash
   databricks sync ./databricks_app /Workspace/Users/<you>/carefinder
   databricks apps deploy carefinder --source-code-path /Workspace/Users/<you>/carefinder
   ```
   Or deploy from that folder in the app's page in the UI.
4. **Give the app permission to read your tables.** The app runs as its own service principal (its name is shown on the app page). In Catalog → `workspace` → Permissions, grant it **USE CATALOG**. On `workspace.datathon`, grant **USE SCHEMA** and **SELECT**.
5. Open the app URL. If you see the amber **SAMPLE MODE** banner, the backend isn't reachable. Check the app logs.

**Free Edition limits:** an app stops 24 h after it was last started or deployed, so **restart it right before judging**. Apps only open for signed-in Databricks users, so **record a 1–2 min demo video** in case judges can't open the link.

### 3. Changing the UI later
Edit files in `app/src/` (Cursor or Figma Make), then:
```bash
cd app && pnpm install && pnpm build
rm -rf ../databricks_app/static && cp -r dist ../databricks_app/static
```
and redeploy. In Figma Make the app runs in **sample mode** (fictional Jaipur facilities), so you can design without Databricks.

## How a recommendation is made (for the "HOW did you decide?" question)
1. **Match:** keyword dictionary per service, searched in procedures, equipment, description and specialties.
2. **Evidence score (0–90):** procedures +30, equipment +25, description +15, specialties +10, staff/bed data +10. Tiers: STRONG / MODERATE / WEAK.
3. **Cross-check:** name + distance matching against OpenStreetMap. HIGH = name similarity ≥ 0.85 and ≤ 2 km. MEDIUM = ≥ 0.70 and ≤ 1 km. OSM ownership tags override keyword guesses.
4. **Location check:** facility coordinates vs. PIN centroid. More than 25 km apart is flagged.
5. **Rank:** 11 weighted factors (each mode adds up to 100). Emergencies favor travel time and being open. Planned care favors evidence, cost and insurance. Missing data (e.g. wait time) is left out and the remaining weights rescaled, never invented. WEAK evidence always ranks below the rest.

## Known limits (say these out loud. Judges reward honesty)
- **Wait times:** no source exists, so they're shown as "not reported."
- **Opening hours:** only "24/7" keyword mentions. OSM's India export has no opening-hours tag.
- **Travel time:** an estimate (straight line × 1.3 ÷ 35 km/h), not live traffic.
- **Ownership:** OSM tags cover about 9,300 facilities. Elsewhere it's a keyword guess or "unknown."
- **OSM matching:** facilities in neighbouring ~11 km grid cells can be missed.
