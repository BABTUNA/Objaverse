"""Stage 1: load Objaverse-LVIS metadata into a Daft DataFrame.

LVIS is a ~46k-model curated subset of Objaverse with category labels
borrowed from the LVIS vocabulary. We pull the (uid -> category) map
from the `objaverse` package, then materialize a Daft DataFrame with
the columns the rest of the pipeline needs.
"""

from __future__ import annotations

import daft
import objaverse
from rich.console import Console

from .config import EMB_DIR

console = Console()

METADATA_PARQUET = EMB_DIR / "metadata.parquet"


def build_metadata_df(limit: int = 0) -> daft.DataFrame:
    """Build a Daft DataFrame of (uid, category) for Objaverse-LVIS.

    Args:
        limit: cap the number of rows; 0 means all ~46k.
    """
    console.print("[cyan]fetching LVIS annotations...[/]")
    lvis: dict[str, list[str]] = objaverse.load_lvis_annotations()

    rows = [
        {"uid": uid, "category": category}
        for category, uids in lvis.items()
        for uid in uids
    ]
    if limit > 0:
        rows = rows[:limit]

    console.print(f"[green]✓[/] {len(rows):,} models across {len(lvis):,} categories")

    return daft.from_pylist(rows)


def save_metadata(df: daft.DataFrame) -> None:
    """Persist the metadata DataFrame to parquet for downstream stages."""
    df.write_parquet(str(METADATA_PARQUET))
    console.print(f"[green]✓[/] wrote {METADATA_PARQUET}")


def load_metadata() -> daft.DataFrame:
    """Re-read the metadata parquet."""
    return daft.read_parquet(str(METADATA_PARQUET))
