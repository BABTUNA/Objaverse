"""Stage 4: CLIP-embed rendered views and mean-pool per model.

A class-based Daft UDF lets us load the CLIP model once per worker and
then process batches of views without re-incurring the warmup cost.
We mean-pool across views, then L2-normalize so cosine ANN works as
plain inner-product downstream.
"""

from __future__ import annotations

import daft
import numpy as np
import open_clip
import torch
from PIL import Image

from .config import CLIP_EMBED_DIM, CLIP_MODEL, CLIP_PRETRAINED, EMB_DIR
from .render import load_renders

EMBEDDINGS_PARQUET = EMB_DIR / "embeddings.parquet"


# ---------- model loader ----------------------------------------------------------


def _load_clip(device: str | None = None):
    device = device or ("cuda" if torch.cuda.is_available() else "cpu")
    model, _, preprocess = open_clip.create_model_and_transforms(
        CLIP_MODEL, pretrained=CLIP_PRETRAINED
    )
    model = model.to(device).eval()
    tokenizer = open_clip.get_tokenizer(CLIP_MODEL)
    return model, preprocess, tokenizer, device


# ---------- image-side embed UDF --------------------------------------------------


@daft.udf(return_dtype=daft.DataType.embedding(daft.DataType.float32(), CLIP_EMBED_DIM))
class EmbedViewsUDF:
    def __init__(self) -> None:
        self.model, self.preprocess, _, self.device = _load_clip()

    @torch.inference_mode()
    def __call__(self, views_col) -> list[np.ndarray]:
        out: list[np.ndarray] = []
        for views in views_col.to_pylist():
            if views is None:
                out.append(np.zeros(CLIP_EMBED_DIM, dtype=np.float32))
                continue

            arr = np.asarray(views)  # (n_views, H, W, 3) uint8
            pil = [Image.fromarray(v) for v in arr]
            batch = torch.stack([self.preprocess(im) for im in pil]).to(self.device)

            feats = self.model.encode_image(batch).float()
            feats = feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-8)
            pooled = feats.mean(dim=0)
            pooled = pooled / pooled.norm().clamp(min=1e-8)

            out.append(pooled.cpu().numpy().astype(np.float32))
        return out


# ---------- text-side helper (for query time, kept here to share the model load) --


def embed_text(query: str) -> np.ndarray:
    """One-shot text embedding for /search; not a Daft UDF."""
    model, _, tokenizer, device = _load_clip()
    with torch.inference_mode():
        toks = tokenizer([query]).to(device)
        feats = model.encode_text(toks).float()
        feats = feats / feats.norm(dim=-1, keepdim=True).clamp(min=1e-8)
        return feats[0].cpu().numpy().astype(np.float32)


# ---------- pipeline entry point --------------------------------------------------


def run(batch_size: int = 64) -> None:
    from rich.console import Console

    console = Console()
    df = load_renders()

    console.print("[bold cyan]→[/] embedding views with CLIP")
    df = df.with_column("embedding", EmbedViewsUDF(daft.col("views")))
    df = df.select("uid", "category", "embedding")

    df.write_parquet(str(EMBEDDINGS_PARQUET))
    console.print(f"[green]✓[/] wrote {EMBEDDINGS_PARQUET}")


def load_embeddings() -> daft.DataFrame:
    return daft.read_parquet(str(EMBEDDINGS_PARQUET))
