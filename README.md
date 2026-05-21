# Objaverse Search

> Semantic 3D search over [Objaverse-LVIS](https://objaverse.allenai.org/), built as one [Daft](https://github.com/Eventual-Inc/Daft) DataFrame.

Type *"viking helmet"* or *"art deco lamp"* and get back a ranked list of 3D models you can spin in your browser. Or flip to the latent-space atlas and fly through a CLIP-projected cloud of every indexed object.

<!-- TODO: drop hero gif/screenshot here once captured -->
<!-- Suggested: /atlas wide shot or the /perf race replay mid-animation -->
![hero](docs/hero.png)

## What it actually is

A reference implementation of a **multimodal search engine** end-to-end:

- pull 46k 3D models from Objaverse-LVIS
- render N views per model (PyVista, headless)
- embed every model with CLIP
- index into LanceDB for cosine ANN
- serve a search API + a polished frontend with a 3D viewer, a UMAP atlas, and a performance dashboard

Every stage is a **Daft DataFrame transformation**. The image embedding step is one expression:

```python
df = (
    daft.from_pylist(rows)                                  # (uid, image_bytes)
        .with_column(
            "image",
            daft.functions.decode_image(daft.col("image_bytes")).convert_image("RGB"),
        )
        .with_column(
            "embedding",
            daft.functions.embed_image(
                daft.col("image"),
                provider="transformers",
                model="openai/clip-vit-base-patch32",
            ),
        )
        .select("uid", "embedding")
)
```

No UDFs, no `torch.no_grad`, no manual batching — Daft handles model loading, batching, and concurrency.

## Why this exists

Showcases the multimodal pipeline pattern Daft is built for. The full pipeline:

```
metadata  →  download  →  render  →  embed  →  index  →  project
```

is ~250 lines of Python plus three frontend routes. The render and embed stages run in parallel via Daft's Ray runner. The bench page (`/perf`) shows real measured speedup of the parallel render path against a naive sequential baseline.

## Three frontend surfaces

### `/` — Search
Text query → CLIP-text-encoded → cosine ANN over LanceDB → ranked grid of thumbnails. Click any card to orbit the real GLB in a polished three.js modal.

<!-- TODO: screenshot of search results grid -->
![search](docs/search.png)

### `/atlas` — Latent-space dashboard
A 3D scatter of every indexed model placed by UMAP, with category labels floating above each marker. Hover for the category, click to inspect the model. The sidebar exposes a category filter and a chain-of-thoughts trail of recent picks.

<!-- TODO: screenshot of atlas -->
![atlas](docs/atlas.png)

### `/perf` — Daft vs naive
Live benchmark dashboard. The hero number is the measured speedup of the Daft render path over a single-process baseline. The **race replay** is the screenshottable artifact — hit play and watch Daft fill cells in parallel batches while naive plods through them one at a time.

<!-- TODO: screenshot of /perf with race replay paused mid-race -->
![perf](docs/perf.png)

## Pipeline diagram

`objaverse-search explain` dumps Daft's optimized query plan for the embed stage as a Mermaid graph:

<!-- TODO: paste rendered version of docs/pipeline-plan.mmd or screenshot -->
![pipeline](docs/pipeline-plan.png)

See [`docs/pipeline-plan.mmd`](docs/pipeline-plan.mmd) for the raw graph definition.

## Stack

| Stage | Tool |
| --- | --- |
| Dataset | [`objaverse-lvis`](https://huggingface.co/datasets/allenai/objaverse) (~46k GLBs) |
| Pipeline | **[Daft](https://github.com/Eventual-Inc/Daft)** (Ray runner for parallel UDFs) |
| Rendering | [PyVista](https://docs.pyvista.org/) (VTK headless, 8 views per model @ 224²) |
| Embeddings | OpenAI CLIP ViT-B/32 via `daft.functions.embed_image` (`transformers`) |
| Text-side query | [`open_clip`](https://github.com/mlfoundations/open_clip) (CLIP text tower) |
| Vector store | [LanceDB](https://lancedb.com/) (cosine, IVF_PQ above 256 rows) |
| Projection | [UMAP](https://github.com/lmcinnes/umap) (cosine metric, 3D) |
| Backend | [FastAPI](https://fastapi.tiangolo.com/) |
| Frontend | [Next.js 14](https://nextjs.org/) + [`@react-three/fiber`](https://r3f.docs.pmnd.rs/) + [`@react-three/drei`](https://drei.docs.pmnd.rs/) + Tailwind |

## Quickstart

Requires Python 3.10+ and Node 18+. [uv](https://github.com/astral-sh/uv) recommended for the Python side.

```bash
# 1. install python deps
uv venv && source .venv/bin/activate    # or .venv\Scripts\Activate.ps1 on Windows
uv pip install -e .

# 2. install web deps
cd web && npm install && cd ..

# 3. run the pipeline (default: stratified sample across all 1156 LVIS categories)
objaverse-search metadata --limit 500 --strategy stratified
objaverse-search download --limit 500
objaverse-search render   --limit 500
objaverse-search embed
objaverse-search index
objaverse-search project

# 4. optional — benchmark Daft vs naive render
objaverse-search bench --n 100

# 5. serve
objaverse-search serve            # API on :8000
# in a second terminal:
cd web && npm run dev             # UI on :3000
```

`metadata`, `download`, and `render` accept `--limit N` — pick whatever your patience allows. 500 takes ~30 min on a CPU laptop; the full 46k is a multi-hour overnight job.

## CLI reference

| Command | What it does |
| --- | --- |
| `metadata --limit N --strategy {random,stratified,sequential}` | sample N uids from LVIS into `metadata.parquet` |
| `download --limit N`     | fetch GLBs into the objaverse cache |
| `render --limit N`       | multi-view render → `renders.parquet` + thumbnails |
| `embed`                  | CLIP image embeddings → `embeddings.parquet` |
| `index`                  | write LanceDB with cosine ANN |
| `project`                | UMAP-reduce to 3D → `projection.{parquet,json}` |
| `bench --n N`            | time naive vs Daft render on N models |
| `explain`                | dump Daft's mermaid plan for the embed pipeline |
| `serve`                  | FastAPI on `127.0.0.1:8000` |

## Layout

```
src/objaverse_search/   # the Daft pipeline + FastAPI server
web/                    # Next.js + three.js frontend (3 routes)
docs/                   # screenshots, generated pipeline plan
data/                   # downloaded glbs, renders, lancedb (gitignored)
```

## Caveats and lessons

- **Windows-friendly by design.** PyVista/VTK is used for rendering specifically because pyrender's EGL backend doesn't work on Windows. Tested on Windows 11 + WSL2.
- **Daft parallel render needs Ray.** The bench command flips Daft to its Ray runner because the native runner ignores `into_partitions`. Without that, "parallel" UDFs all run in one process.
- **Some Objaverse GLBs are malformed.** `vtkGLTFImporter` errors are expected on a small percent of files; the pipeline filters them out.
- **First embed run downloads CLIP weights (~600MB)** from Hugging Face into `~/.cache/huggingface`.

## License

MIT. See [LICENSE](LICENSE).

## Credits

Built on top of [Daft](https://github.com/Eventual-Inc/Daft) by [Eventual](https://www.eventualcomputing.com/), [Objaverse](https://objaverse.allenai.org/) by Allen AI, and [OpenAI CLIP](https://github.com/openai/CLIP). 3D viewer powered by [three.js](https://threejs.org/) and [`@react-three/fiber`](https://r3f.docs.pmnd.rs/).
