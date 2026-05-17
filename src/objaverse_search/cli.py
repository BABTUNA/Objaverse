"""Top-level CLI — wires pipeline stages together."""

from __future__ import annotations

import typer
from rich.console import Console

app = typer.Typer(help="Objaverse-LVIS semantic search pipeline.", no_args_is_help=True)
console = Console()


@app.command()
def metadata(
    limit: int = typer.Option(0, help="Only load N entries (0 = all)."),
    strategy: str = typer.Option(
        "random",
        help="Sampling strategy when limit > 0: random | stratified | sequential.",
    ),
    seed: int = typer.Option(42, help="Sampling RNG seed."),
) -> None:
    """Fetch Objaverse-LVIS metadata into a Daft DataFrame."""
    from . import metadata as md

    console.print("[bold cyan]→[/] loading objaverse-lvis metadata")
    df = md.build_metadata_df(limit=limit, strategy=strategy, seed=seed)
    md.save_metadata(df)
    df.show(5)


@app.command()
def download(
    limit: int = typer.Option(0, help="Only download N models (0 = all)."),
    chunk_size: int = typer.Option(256, help="Uids per objaverse.load_objects call."),
) -> None:
    """Download glb files referenced by the metadata DataFrame."""
    from . import download as dl

    console.print("[bold cyan]→[/] downloading glbs")
    dl.run(limit=limit, chunk_size=chunk_size)


@app.command()
def render(limit: int = typer.Option(0, help="Only render N models (0 = all).")) -> None:
    """Render multi-view images for each model."""
    from . import render as rd

    console.print("[bold cyan]→[/] rendering multi-view images")
    rd.run(limit=limit)


@app.command()
def embed(
    batch_size: int = typer.Option(64, help="CLIP batch size."),
    explain: bool = typer.Option(False, help="Print the Daft execution plan before running."),
) -> None:
    """Embed rendered thumbnails through Daft's native embed_image."""
    from . import embed as eb

    eb.run(batch_size=batch_size, explain=explain)


@app.command()
def explain(out: str = typer.Option("docs/pipeline-plan.mmd", help="Mermaid output path.")) -> None:
    """Dump the optimized Daft plan for the embed pipeline to a .mmd file (for the README)."""
    from pathlib import Path as _Path

    from . import embed as eb

    df = eb.build_image_embedding_df()
    target = _Path(out)
    target.parent.mkdir(parents=True, exist_ok=True)
    # `format="mermaid"` emits a Mermaid graph definition; pipe it through any
    # mermaid renderer to get the SVG/PNG.
    diagram = df.explain(show_all=True, format="mermaid")
    if diagram is None:
        # Older Daft variants print to stdout and return None; capture via repr fallback.
        import io
        import contextlib

        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            df.explain(show_all=True, format="mermaid")
        diagram = buf.getvalue()
    target.write_text(diagram)
    console.print(f"[green]✓[/] wrote {target}")


@app.command()
def index() -> None:
    """Write embeddings + metadata to LanceDB."""
    from . import index as ix

    console.print("[bold cyan]→[/] writing LanceDB index")
    ix.build_index()


@app.command()
def project(
    n_neighbors: int = typer.Option(25, help="UMAP n_neighbors."),
    min_dist: float = typer.Option(0.15, help="UMAP min_dist."),
    seed: int = typer.Option(42, help="UMAP random_state."),
) -> None:
    """UMAP-reduce embeddings to 3D for the atlas view."""
    from . import projection as pr

    console.print("[bold cyan]→[/] projecting embeddings to 3D (UMAP)")
    pr.build_projection(n_neighbors=n_neighbors, min_dist=min_dist, seed=seed)


@app.command()
def bench(n: int = typer.Option(20, help="Number of models to benchmark.")) -> None:
    """Benchmark Daft vs naive render on N downloaded models."""
    from . import bench as bn

    console.print("[bold cyan]→[/] benchmarking render: naive vs Daft")
    bn.run(n=n)


@app.command()
def serve(
    host: str = "127.0.0.1",
    port: int = 8000,
    reload: bool = typer.Option(False, help="Auto-reload on source change."),
) -> None:
    """Run the FastAPI search backend."""
    import uvicorn

    uvicorn.run(
        "objaverse_search.server:app",
        host=host,
        port=port,
        reload=reload,
        reload_dirs=["src/objaverse_search"] if reload else None,
    )


if __name__ == "__main__":
    app()
