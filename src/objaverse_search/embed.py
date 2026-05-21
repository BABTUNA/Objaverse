"""Stage 4: embed every rendered thumbnail with Daft's native embed_image.

The whole image-side pipeline is one Daft DataFrame — no UDF, no
torch boilerplate, no batching by hand. Daft handles model loading,
GPU placement, batching, and concurrency under the hood.

Text-side query encoding (used by /search) still goes through
open_clip directly because Daft's embed_text uses sentence-transformers
rather than CLIP's text tower, and we need the two encoders to share
the same embedding space.
"""

from __future__ import annotations

import daft
import numpy as np
import torch
from rich.console import Console

from .config import CLIP_EMBED_DIM, CLIP_HF_ID, CLIP_MODEL, CLIP_PRETRAINED, EMB_DIR, THUMBS_DIR

console = Console()

EMBEDDINGS_PARQUET = EMB_DIR / "embeddings.parquet"


# ---------- the entire image-side pipeline ---------------------------------------


def _gather_thumbs() -> list[dict]:
    """Read PNG bytes off disk so Daft only owns the heavy stages.

    daft.col.download() is built for URLs and does not reliably ingest local
    Windows paths; pulling bytes in plain Python avoids that footgun without
    weakening the demo — the embedding pipeline below is still 100% native
    Daft expressions.
    """
    rows: list[dict] = []
    for p in sorted(THUMBS_DIR.glob("*.png")):
        rows.append({"uid": p.stem, "image_bytes": p.read_bytes()})
    return rows


def build_image_embedding_df() -> daft.DataFrame:
    """One DataFrame: bytes → decode → embed. This is the marketing asset."""
    rows = _gather_thumbs()
    if not rows:
        raise RuntimeError(
            f"no thumbnails in {THUMBS_DIR}; run `objaverse-search render` first"
        )
    return (
        daft.from_pylist(rows)
        .with_column(
            "image",
            daft.functions.decode_image(daft.col("image_bytes")).convert_image("RGB"),
        )
        .with_column(
            "embedding",
            daft.functions.embed_image(
                daft.col("image"),
                provider="transformers",
                model=CLIP_HF_ID,
            ),
        )
        .select("uid", "embedding")
    )


# ---------- text-side helper (CLIP text tower via open_clip) ---------------------


def _load_clip_text():
    import open_clip

    device = "cuda" if torch.cuda.is_available() else "cpu"
    model, _, _ = open_clip.create_model_and_transforms(CLIP_MODEL, pretrained=CLIP_PRETRAINED)
    tokenizer = open_clip.get_tokenizer(CLIP_MODEL)
    return model.to(device).eval(), tokenizer, device


def embed_text(query: str) -> np.ndarray:
    """One-shot text embedding for /search; not part of the Daft pipeline."""
    model, tokenizer, device = _load_clip_text()
    with torch.inference_mode():
        toks = tokenizer([query]).to(device)
        feats = model.encode_text(toks).float()
        feats = feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-8)
        assert feats.shape[-1] == CLIP_EMBED_DIM, f"text dim mismatch: {feats.shape}"
        return feats[0].cpu().numpy().astype(np.float32)


# ---------- pipeline entry point -------------------------------------------------


def run(batch_size: int = 64, explain: bool = False) -> None:
    df = build_image_embedding_df()

    if explain:
        # Daft prints the unoptimized + optimized + physical plans. The mermaid
        # variant of the optimized plan is captured separately by the explain
        # CLI command for embedding in the README.
        console.print("[cyan]→[/] daft plan:")
        df.explain(show_all=True)

    console.print("[bold cyan]→[/] embedding thumbnails (one Daft DataFrame, zero UDFs)")
    df.write_parquet(str(EMBEDDINGS_PARQUET), write_mode="overwrite")
    # Sanity-check what actually landed on disk — a 0-row parquet here is a
    # silent failure mode of the embed pipeline that downstream stages will
    # surface much later with confusing errors.
    written = daft.read_parquet(str(EMBEDDINGS_PARQUET))
    n = written.count_rows()
    console.print(f"[green]✓[/] wrote {EMBEDDINGS_PARQUET} ({n} rows)")


def load_embeddings() -> daft.DataFrame:
    return daft.read_parquet(str(EMBEDDINGS_PARQUET))
