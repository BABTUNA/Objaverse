# Objaverse Search

Semantic 3D model search over [Objaverse-LVIS](https://objaverse.allenai.org/) (~46k models), powered by [Daft](https://github.com/Eventual-Inc/Daft).

Type a query like *"art deco lamp"* or *"viking helmet"* — get a grid of rotating 3D models that match.

## Why Daft

The whole pipeline — download → multi-view render → CLIP embed → vector index — is one Daft DataFrame, with the heavy steps written as `@daft.udf` functions. No Spark, no Ray, no orchestration glue. Just multimodal columns (paths → tensors → embeddings) flowing through a lazy query plan.

## Stack

| Stage | Tool |
| --- | --- |
| Dataset | `objaverse-lvis` (~46k GLBs) |
| Pipeline | **Daft** |
| Rendering | PyRender (8 views per model @ 224×224) |
| Embeddings | OpenCLIP `ViT-L/14`, mean-pooled across views |
| Vector store | LanceDB |
| Backend | FastAPI |
| Frontend | Next.js + `@react-three/fiber` |

## Quickstart

```bash
# 1. install
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"

# 2. run the pipeline
objaverse-search metadata
objaverse-search render
objaverse-search embed
objaverse-search index

# 3. serve
objaverse-search serve
# then in another terminal:
cd web && pnpm install && pnpm dev
```

## Layout

```
src/objaverse_search/   # the Daft pipeline + FastAPI server
scripts/                # one-off utilities
web/                    # Next.js frontend
data/                   # downloaded glbs, renders, lancedb (gitignored)
```

## Status

🚧 Early build — see commit history for progress.
