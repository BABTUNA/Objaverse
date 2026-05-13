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
    console.print("[bold cyan]→[/] rendering multi-view images")
    raise typer.Exit(code=0)


@app.command()
def embed(batch_size: int = typer.Option(64, help="CLIP batch size.")) -> None:
    """CLIP-embed rendered views, mean-pool per model."""
    console.print("[bold cyan]→[/] embedding views with CLIP")
    raise typer.Exit(code=0)


@app.command()
def index() -> None:
    """Write embeddings + metadata to LanceDB."""
    console.print("[bold cyan]→[/] writing LanceDB index")
    raise typer.Exit(code=0)


@app.command()
def serve(host: str = "127.0.0.1", port: int = 8000) -> None:
    """Run the FastAPI search backend."""
    import uvicorn

    uvicorn.run(
        "objaverse_search.server:app",
        host=host,
        port=port,
        reload=True,
    )


if __name__ == "__main__":
    app()
