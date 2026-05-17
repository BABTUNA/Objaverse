"""Stage 1: load Objaverse-LVIS metadata into a Daft DataFrame.

LVIS is a ~46k-model curated subset of Objaverse with category labels
borrowed from the LVIS vocabulary. We pull the (uid -> category) map
from the `objaverse` package, then materialize a Daft DataFrame with
the columns the rest of the pipeline needs.
"""

from __future__ import annotations

import random

import daft
import objaverse
from rich.console import Console

from .config import EMB_DIR

console = Console()

METADATA_PARQUET = EMB_DIR / "metadata.parquet"


def build_metadata_df(
    limit: int = 0,
    strategy: str = "random",
    seed: int = 42,
) -> daft.DataFrame:
    """Build a Daft DataFrame of (uid, category) for Objaverse-LVIS.

    Args:
        limit: cap the number of rows; 0 means all ~46k.
        strategy: how to sample when limit > 0.
            - 'random'      uniform random across all uids
            - 'stratified'  ceil(limit/n_categories) from each category until full
            - 'sequential'  legacy head-N behavior (alphabetical by category)
        seed: RNG seed for reproducibility on the non-sequential strategies.
    """
    console.print("[cyan]fetching LVIS annotations...[/]")
    lvis: dict[str, list[str]] = objaverse.load_lvis_annotations()

    rows = [
        {"uid": uid, "category": category}
        for category, uids in lvis.items()
        for uid in uids
    ]

    if limit > 0 and limit < len(rows):
        if strategy == "sequential":
            rows = rows[:limit]
        elif strategy == "stratified":
            rows = _stratified_sample(lvis, limit, seed)
        else:  # 'random'
            rng = random.Random(seed)
            rng.shuffle(rows)
            rows = rows[:limit]

    distinct = len({r["category"] for r in rows})
    console.print(
        f"[green]✓[/] {len(rows):,} models across {distinct:,} categories "
        f"(strategy={strategy}, seed={seed})"
    )

    return daft.from_pylist(rows)


def _stratified_sample(lvis: dict[str, list[str]], limit: int, seed: int) -> list[dict]:
    """Sample evenly across categories so every category is represented when possible."""
    rng = random.Random(seed)
    categories = list(lvis.keys())
    rng.shuffle(categories)

    per_cat: dict[str, list[str]] = {c: list(lvis[c]) for c in categories}
    for c in categories:
        rng.shuffle(per_cat[c])

    picked: list[dict] = []
    # Round-robin: take one from each category until we hit the limit.
    while len(picked) < limit:
        progressed = False
        for c in categories:
            if not per_cat[c]:
                continue
            picked.append({"uid": per_cat[c].pop(), "category": c})
            progressed = True
            if len(picked) >= limit:
                break
        if not progressed:
            break
    return picked


def save_metadata(df: daft.DataFrame) -> None:
    """Persist the metadata DataFrame to parquet for downstream stages."""
    df.write_parquet(str(METADATA_PARQUET))
    console.print(f"[green]✓[/] wrote {METADATA_PARQUET}")


def load_metadata() -> daft.DataFrame:
    """Re-read the metadata parquet."""
    return daft.read_parquet(str(METADATA_PARQUET))
