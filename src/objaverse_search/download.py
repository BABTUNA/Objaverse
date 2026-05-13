"""Stage 2: download .glb files for each uid and attach the local path.

The `objaverse` package handles the actual fetch, sharded across HF
repos with its own threadpool. We chunk uids to keep memory bounded
and to make resuming after interruption cheap (already-downloaded
files are skipped by `objaverse.load_objects`).
"""

from __future__ import annotations

import daft
import objaverse
from rich.console import Console
from rich.progress import Progress

from .config import EMB_DIR
from .metadata import load_metadata

console = Console()

WITH_PATHS_PARQUET = EMB_DIR / "metadata_with_paths.parquet"


def download_chunk(uids: list[str], processes: int = 8) -> dict[str, str]:
    """Wrapper around objaverse.load_objects that returns a uid -> local path map."""
    return objaverse.load_objects(uids=uids, download_processes=processes)


def attach_glb_paths(df: daft.DataFrame, chunk_size: int = 256) -> daft.DataFrame:
    """Download every glb referenced by the DataFrame, attach the path column.

    We collect uids out of the Daft frame, chunk them, hand each chunk to
    `objaverse.load_objects`, then join the resulting path map back in.
    """
    uids = [row["uid"] for row in df.select("uid").to_pylist()]
    console.print(f"[cyan]downloading[/] {len(uids):,} glbs in chunks of {chunk_size}")

    uid_to_path: dict[str, str] = {}
    with Progress() as bar:
        task = bar.add_task("[cyan]downloading", total=len(uids))
        for i in range(0, len(uids), chunk_size):
            chunk = uids[i : i + chunk_size]
            uid_to_path.update(download_chunk(chunk))
            bar.update(task, advance=len(chunk))

    paths_df = daft.from_pylist(
        [{"uid": uid, "glb_path": path} for uid, path in uid_to_path.items()]
    )
    return df.join(paths_df, on="uid", how="inner")


def run(limit: int = 0, chunk_size: int = 256) -> None:
    df = load_metadata()
    if limit > 0:
        df = df.limit(limit)
    df = attach_glb_paths(df, chunk_size=chunk_size)
    df.write_parquet(str(WITH_PATHS_PARQUET))
    console.print(f"[green]✓[/] wrote {WITH_PATHS_PARQUET}")


def load_with_paths() -> daft.DataFrame:
    return daft.read_parquet(str(WITH_PATHS_PARQUET))
