"""Central config — paths, model names, knobs."""

from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"

RAW_DIR = DATA_DIR / "raw"                 # downloaded .glb files
RENDERS_DIR = DATA_DIR / "renders"         # per-uid multi-view PNGs
THUMBS_DIR = DATA_DIR / "thumbnails"       # canonical 1 view per uid for the UI
EMB_DIR = DATA_DIR / "embeddings"          # parquet of (uid, embedding)
LANCEDB_DIR = DATA_DIR / "lancedb"         # vector index

for _p in (RAW_DIR, RENDERS_DIR, THUMBS_DIR, EMB_DIR, LANCEDB_DIR):
    _p.mkdir(parents=True, exist_ok=True)

# Rendering
RENDER_VIEWS = 8                # cameras evenly spaced around object
RENDER_SIZE = 224               # CLIP input resolution
RENDER_BG_COLOR = (1.0, 1.0, 1.0, 0.0)  # transparent

# CLIP
CLIP_MODEL = "ViT-L-14"
CLIP_PRETRAINED = "openai"
CLIP_EMBED_DIM = 768

# LanceDB
LANCE_TABLE = "objaverse_lvis"
