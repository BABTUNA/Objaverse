"""Stage 6: UMAP-reduce CLIP embeddings to 3D for the atlas view.

The pipeline produces a high-dimensional CLIP embedding per
model (currently 512d under CLIP ViT-B/32). To make latent-space structure browsable we project down to
3D with UMAP, scale to a unit cube centered at the origin, and join
the coords back onto (uid, category, thumb_url) for the frontend.

We deliberately keep the projection step separate from the index
step: re-projecting after adding more models is cheap, but rebuilding
the LanceDB ANN index is not.
"""

from __future__ import annotations

import json

import daft
import numpy as np
from rich.console import Console

from .config import CLIP_EMBED_DIM, EMB_DIR
from .embed import load_embeddings

console = Console()

PROJECTION_PARQUET = EMB_DIR / "projection.parquet"
PROJECTION_JSON = EMB_DIR / "projection.json"


def _stack_embeddings(df: daft.DataFrame) -> tuple[list[str], list[str], np.ndarray]:
    """Pull (uid, category, embedding) into plain Python/Numpy for UMAP.

    Embeddings live in their own parquet; categories come from metadata via a
    best-effort left join so a stale metadata.parquet doesn't drop every row.
    """
    from .metadata import load_metadata

    cols = df.column_names if hasattr(df, "column_names") else df.schema().column_names()
    if "category" not in cols:
        try:
            meta = load_metadata().select("uid", "category")
            df = df.join(meta, on="uid", how="left")
        except Exception:  # noqa: BLE001
            df = df.with_column("category", daft.lit(None).cast(daft.DataType.string()))

    rows = df.select("uid", "category", "embedding").to_pylist()
    if not rows:
        raise RuntimeError("no embedding rows to project; check embed stage output")
    uids = [r["uid"] for r in rows]
    cats = [r.get("category") or "" for r in rows]
    vecs = np.asarray([r["embedding"] for r in rows], dtype=np.float32)
    assert vecs.shape[1] == CLIP_EMBED_DIM, f"unexpected embedding dim: {vecs.shape}"
    return uids, cats, vecs


def _fit_umap(vecs: np.ndarray, n_neighbors: int, min_dist: float, seed: int) -> np.ndarray:
    """Wrap UMAP so callers don't pay the import cost until they actually project."""
    import umap

    n = vecs.shape[0]
    # UMAP requires n_neighbors < n_samples; clamp for tiny demo runs.
    k = max(2, min(n_neighbors, n - 1))
    reducer = umap.UMAP(
        n_components=3,
        n_neighbors=k,
        min_dist=min_dist,
        metric="cosine",
        random_state=seed,
    )
    return reducer.fit_transform(vecs)


def _normalize_to_cube(coords: np.ndarray) -> np.ndarray:
    """Center at origin and scale into a [-1, 1] cube along the widest axis."""
    coords = coords - coords.mean(axis=0, keepdims=True)
    scale = float(np.max(np.abs(coords))) or 1.0
    return (coords / scale).astype(np.float32)


def build_projection(n_neighbors: int = 25, min_dist: float = 0.15, seed: int = 42) -> None:
    df = load_embeddings()
    uids, cats, vecs = _stack_embeddings(df)
    console.print(f"[cyan]projecting[/] {len(uids):,} embeddings → 3D via UMAP")

    coords = _normalize_to_cube(_fit_umap(vecs, n_neighbors, min_dist, seed))

    out_rows = [
        {
            "uid": uid,
            "category": cat,
            "x": float(c[0]),
            "y": float(c[1]),
            "z": float(c[2]),
        }
        for uid, cat, c in zip(uids, cats, coords)
    ]
    out_df = daft.from_pylist(out_rows)
    out_df.write_parquet(str(PROJECTION_PARQUET))

    # JSON sidecar so the API can serve the atlas without rehydrating Daft on every request.
    PROJECTION_JSON.write_text(json.dumps(out_rows, separators=(",", ":")))

    console.print(f"[green]✓[/] wrote {PROJECTION_PARQUET}")
    console.print(f"[green]✓[/] wrote {PROJECTION_JSON} ({PROJECTION_JSON.stat().st_size / 1024:.1f} KB)")


def load_projection() -> list[dict]:
    """Load the projection from the JSON sidecar (fast path for /atlas)."""
    if not PROJECTION_JSON.exists():
        return []
    return json.loads(PROJECTION_JSON.read_text())
