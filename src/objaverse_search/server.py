"""FastAPI search backend.

Endpoints
---------
GET /search?q=...&k=24     text query → ranked list of (uid, category, score, thumb, glb)
GET /thumb/{uid}           pre-rendered thumbnail PNG
GET /model/{uid}           the original glb, streamed
GET /healthz               liveness
"""

from __future__ import annotations

from pathlib import Path

import objaverse
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .bench import load_results as load_bench_results
from .config import THUMBS_DIR
from .embed import embed_text
from .index import search as ann_search
from .projection import load_projection

app = FastAPI(title="Objaverse Search", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


class Hit(BaseModel):
    uid: str
    category: str
    score: float
    thumb_url: str
    glb_url: str


class SearchResponse(BaseModel):
    query: str
    hits: list[Hit]


class AtlasPoint(BaseModel):
    uid: str
    category: str
    x: float
    y: float
    z: float
    thumb_url: str


class AtlasResponse(BaseModel):
    count: int
    points: list[AtlasPoint]


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/search", response_model=SearchResponse)
def search(q: str = Query(..., min_length=1), k: int = Query(24, ge=1, le=100)) -> SearchResponse:
    if not q.strip():
        raise HTTPException(status_code=400, detail="empty query")

    qvec = embed_text(q)
    rows = ann_search(qvec, k=k)

    hits: list[Hit] = []
    for row in rows:
        uid = row["uid"]
        # LanceDB returns distance under "_distance" for cosine; smaller is closer.
        score = 1.0 - float(row.get("_distance", 0.0))
        hits.append(
            Hit(
                uid=uid,
                category=row.get("category", ""),
                score=score,
                thumb_url=f"/thumb/{uid}",
                glb_url=f"/model/{uid}",
            )
        )
    return SearchResponse(query=q, hits=hits)


@app.get("/benchmarks")
def benchmarks() -> dict:
    """Return the latest bench run as raw JSON; 404 if never run."""
    data = load_bench_results()
    if data is None:
        raise HTTPException(
            status_code=404,
            detail="no benchmark results; run `objaverse-search bench`",
        )
    return data


@app.get("/atlas", response_model=AtlasResponse)
def atlas() -> AtlasResponse:
    """Return the full latent-space projection as 3D points."""
    rows = load_projection()
    if not rows:
        raise HTTPException(status_code=404, detail="projection not built; run `objaverse-search project`")
    points = [
        AtlasPoint(
            uid=r["uid"],
            category=r.get("category", ""),
            x=r["x"],
            y=r["y"],
            z=r["z"],
            thumb_url=f"/thumb/{r['uid']}",
        )
        for r in rows
    ]
    return AtlasResponse(count=len(points), points=points)


@app.get("/thumb/{uid}")
def thumb(uid: str) -> FileResponse:
    p = THUMBS_DIR / f"{uid}.png"
    if not p.exists():
        raise HTTPException(status_code=404, detail="thumbnail not rendered")
    return FileResponse(p, media_type="image/png")


@app.get("/model/{uid}")
def model(uid: str) -> FileResponse:
    """Serve the original glb. Falls back to objaverse.load_objects if missing."""
    paths = objaverse.load_objects(uids=[uid])
    if uid not in paths:
        raise HTTPException(status_code=404, detail="glb not found")
    p = Path(paths[uid])
    return FileResponse(p, media_type="model/gltf-binary", filename=f"{uid}.glb")
