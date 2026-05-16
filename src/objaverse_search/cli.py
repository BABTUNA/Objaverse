"""Top-level CLI — wires pipeline stages together."""

from __future__ import annotations

import typer
from rich.console import Console

app = typer.Typer(help="Objaverse-LVIS semantic search pipeline.", no_args_is_help=True)
console = Console()


@app.command()
def metadata(limit: int = typer.Option(0, help="Only load N entries (0 = all).")) -> None:
    """Fetch Objaverse-LVIS metadata into a Daft DataFrame."""
    from . import metadata as md

    console.print("[bold cyan]→[/] loading objaverse-lvis metadata")
    df = md.build_metadata_df(limit=limit)
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
def embed(batch_size: int = typer.Option(64, help="CLIP batch size.")) -> None:
    """CLIP-embed rendered views, mean-pool per model."""
    from . import embed as eb

    eb.run(batch_size=batch_size)


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
