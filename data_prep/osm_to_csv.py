"""Flatten the HOT/OSM India health-facilities GeoJSON into a small CSV for Databricks.

Usage:  python osm_to_csv.py health_facilities.geojson osm_health_facilities_india.csv

Keeps hospitals, clinics, doctors and health posts (drops pharmacies, dentists, alternative medicine).
Polygons are reduced to the average of their outer-ring points (good enough for ~100 m matching).
Ownership is normalised to PUBLIC / PRIVATE / NONPROFIT / UNKNOWN from operator:type.
License: OpenStreetMap contributors, ODbL. Keep the attribution in your app.
"""
import csv, json, sys

KEEP_AMENITY = {"hospital", "clinic", "doctors", "health_post", "hospital;clinic", "clinic;hospital"}
KEEP_HEALTHCARE = {"hospital", "clinic", "centre", "doctor", "yes", "blood_bank", "laboratory"}
PUBLIC = ("government", "public", "state", "municipal", "military")
NONPROFIT = ("charity", "ngo", "non_profit", "religious", "community")
PRIVATE = ("private", "business", "for_profit", "corporate")

def ownership(raw):
    t = (raw or "").lower()
    if not t:
        return "UNKNOWN"
    if any(k in t for k in NONPROFIT):
        return "NONPROFIT"
    if any(k in t for k in PUBLIC):
        return "PUBLIC"
    if any(k in t for k in PRIVATE):
        return "PRIVATE"
    return "UNKNOWN"

def centroid(geom):
    if not geom:
        return None, None
    t, c = geom["type"], geom["coordinates"]
    if t == "Point":
        return c[1], c[0]
    if t == "Polygon":
        ring = c[0]
    elif t == "MultiPolygon":
        ring = c[0][0]
    elif t == "LineString":
        ring = c
    else:
        return None, None
    return sum(p[1] for p in ring) / len(ring), sum(p[0] for p in ring) / len(ring)

def main(src, dst):
    feats = json.load(open(src, encoding="utf-8"))["features"]
    kept = 0
    with open(dst, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["osm_id", "name", "amenity", "healthcare", "speciality", "operator_type_raw",
                    "ownership", "addr_full", "addr_city", "district", "state", "lat", "lon", "osm_url"])
        for f in feats:
            p = f["properties"] or {}
            am, hc = p.get("amenity"), p.get("healthcare")
            if am not in KEEP_AMENITY and hc not in KEEP_HEALTHCARE:
                continue
            name = p.get("name_latin") or p.get("name_en") or p.get("name")
            if not name:
                continue
            lat, lon = centroid(f.get("geometry"))
            if lat is None:
                continue
            w.writerow([p["id"], name, am, hc, p.get("healthcare_speciality"), p.get("operator_type"),
                        ownership(p.get("operator_type")), p.get("addr_full"), p.get("addr_city"),
                        p.get("adm2_name"), p.get("adm1_name"), round(lat, 6), round(lon, 6),
                        f"https://www.openstreetmap.org/{p['id']}"])
            kept += 1
    print(f"kept {kept:,} of {len(feats):,} features -> {dst}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
