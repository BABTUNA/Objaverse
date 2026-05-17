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
from .metadata import load_metadata

console = Console()

EMBEDDINGS_PARQUET = EMB_DIR / "embeddings.parquet"


# ---------- the entire image-side pipeline ---------------------------------------


def build_image_embedding_df() -> daft.DataFrame:
    """One DataFrame: glob thumbnails → bytes → decode → embed.

    This is the marketing asset. Every step is a native Daft expression.
    """
    thumbs_glob = str(THUMBS_DIR / "*.png")
    return (
        daft.from_glob_path(thumbs_glob)
        .with_column(
            "uid",
            daft.functions.regexp_extract(daft.col("path"), r"([0-9a-f]{32})\.png$", 1),
        )
        .with_column("image_bytes", daft.col("path").download())
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

    # Join category back from metadata.parquet so LanceDB rows carry the label.
    meta = load_metadata().select("uid", "category")
    df = df.join(meta, on="uid", how="inner")

    console.print("[bold cyan]→[/] embedding thumbnails (one Daft DataFrame, zero UDFs)")
    df.write_parquet(str(EMBEDDINGS_PARQUET))
    console.print(f"[green]✓[/] wrote {EMBEDDINGS_PARQUET}")


def load_embeddings() -> daft.DataFrame:
    return daft.read_parquet(str(EMBEDDINGS_PARQUET))
