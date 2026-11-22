"""CareFinder India — backend for Databricks Apps.

Serves the built React app from ../static and three JSON endpoints:
  GET  /api/health    -> {"ok": true} when a SQL warehouse is configured
  GET  /api/catalog   -> services + condition-to-service mappings
  POST /api/search    -> origin + raw candidate facilities (the browser scores and ranks them)

Auth: Databricks Apps injects the app's service-principal credentials; databricks-sdk's Config()
picks them up automatically. The SQL warehouse ID comes from the app resource (see app.yaml).
"""
from __future__ import annotations

import datetime as dt
import decimal
import logging
import os
import re
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import queries

log = logging.getLogger("carefinder")
logging.basicConfig(level=logging.INFO)

SCHEMA = os.getenv("CAREFINDER_SCHEMA", "workspace.datathon")
if not re.fullmatch(r"[A-Za-z0-9_]+\.[A-Za-z0-9_]+", SCHEMA):
    raise RuntimeError("CAREFINDER_SCHEMA must look like catalog.schema")
WAREHOUSE_ID = os.getenv("DATABRICKS_WAREHOUSE_ID", "")
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

LABELS = {"nicu": "NICU", "mri": "MRI", "emergency c-section": "Emergency C-section"}
ICONS = {
    "dialysis": "droplet", "emergency c-section": "baby", "nicu": "heart", "cardiac surgery": "pulse",
    "mri": "scan", "burn care": "flame", "trauma care": "shield",
}

app = FastAPI(title="CareFinder India")


# ---------- Databricks SQL ----------

def _connect():
    from databricks import sql
    from databricks.sdk.core import Config

    cfg = Config()
    return sql.connect(
        server_hostname=cfg.host,
        http_path=f"/sql/1.0/warehouses/{WAREHOUSE_ID}",
        credentials_provider=lambda: cfg.authenticate,
    )


def _clean(v: Any) -> Any:
    """Make warehouse values JSON-friendly (Decimal, numpy arrays, dates)."""
    if isinstance(v, decimal.Decimal):
        return float(v)
    if isinstance(v, (dt.date, dt.datetime)):
        return v.isoformat()
    if hasattr(v, "tolist"):  # numpy array / scalar
        return _clean(v.tolist())
    if isinstance(v, (list, tuple)):
        return [_clean(x) for x in v]
    return v


def run(sql_text: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    with _connect() as conn, conn.cursor() as cur:
        cur.execute(sql_text.format(schema=SCHEMA), params or {})
        cols = [c[0] for c in cur.description]
        return [{k: _clean(v) for k, v in zip(cols, row)} for row in cur.fetchall()]


# ---------- API ----------

class SearchBody(BaseModel):
    service: str = Field(min_length=2, max_length=60)
    place: str = Field(default="", max_length=120)
    lat: float | None = Field(default=None, ge=6, le=38)
    lon: float | None = Field(default=None, ge=68, le=98)
    max_km: float = Field(default=100, gt=0, le=500)


@app.get("/api/health")
def health():
    return {"ok": bool(WAREHOUSE_ID), "schema": SCHEMA}


@app.get("/api/catalog")
def catalog():
    try:
        services = [
            {"service": r["service"], "label": LABELS.get(r["service"], r["service"].capitalize()),
             "icon": ICONS.get(r["service"], "info"), "defaultUrgency": r["default_urgency"]}
            for r in run(queries.CATALOG_SQL)
        ]
        conditions = run(queries.CONDITIONS_SQL)
    except Exception:
        log.exception("catalog query failed")
        raise HTTPException(503, "The facility database is not reachable right now.")
    return {"services": services, "conditions": conditions}


def _origin(body: SearchBody) -> dict[str, Any]:
    if body.lat is not None and body.lon is not None:
        return {"label": "your location", "lat": body.lat, "lon": body.lon}
    place = body.place.strip()
    if not place:
        raise HTTPException(400, "Enter a PIN code, city or district, or use your location.")
    pin = re.sub(r"\s", "", place)
    if re.fullmatch(r"\d{6}", pin):
        rows = run(queries.ORIGIN_BY_PIN_SQL, {"pin": pin})
        if not rows:
            raise HTTPException(400, f"We couldn't find PIN code {pin}. Check the number, or try a city name.")
        r = rows[0]
        label = f"{pin} ({(r['district'] or '').title()})"
    else:
        rows = run(queries.ORIGIN_BY_NAME_SQL, {"place": place})
        if not rows:
            raise HTTPException(400, f"We couldn't find “{place}”. Try a 6-digit PIN code or a district name.")
        r = rows[0]
        label = place.title()
    return {"label": label, "lat": float(r["lat"]), "lon": float(r["lon"]),
            "district": r.get("district"), "state": r.get("state")}


@app.post("/api/search")
def search(body: SearchBody):
    try:
        origin = _origin(body)
        rows = run(queries.CANDIDATES_SQL, {"service": body.service, "lat": origin["lat"],
                                            "lon": origin["lon"], "max_km": float(body.max_km)})
    except HTTPException:
        raise
    except Exception:
        log.exception("search failed")
        raise HTTPException(503, "Search is unavailable right now. Please try again in a minute.")

    candidates = []
    for r in rows:
        r = {k: _clean(v) for k, v in r.items()}
        r["facility_id"] = str(r["facility_id"])
        r["km"] = round(float(r["km"]), 1)
        for k in ("matched_fields", "evidence_quotes", "source_urls", "flags", "verification_sources"):
            v = r.get(k)
            if isinstance(v, str):  # e.g. source_urls stored as one "a | b" string
                v = [v]
            r[k] = [x for x in (v or []) if x]
        r["source_urls"] = _split_urls(r["source_urls"])
        for k in ("is_24x7", "mentions_govt_scheme", "mentions_private_insurance", "has_equipment", "has_specialist"):
            r[k] = bool(r.get(k))
        r["wait_minutes"] = None  # no wait-time source yet
        candidates.append(r)
    return {"mode": "live", "origin": origin, "candidates": candidates}


def _split_urls(values: list[str]) -> list[str]:
    """source_urls may arrive as one stringified list: '["https://a", "https://b"]'."""
    out: list[str] = []
    for v in values:
        out += re.findall(r"https?://[^\s\"',\]]+", v) or []
    return out


# ---------- Static React app ----------

if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}")
    def spa(path: str):
        f = (STATIC_DIR / path).resolve()
        if path and f.is_file() and STATIC_DIR in f.parents:
            return FileResponse(f)
        return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("DATABRICKS_APP_PORT", "8000")))
