"""Stage 5: write embeddings + metadata into LanceDB for ANN search.

We collect the embeddings DataFrame to Arrow and let LanceDB own the
storage from there — it handles the on-disk vector format and the
IVF_PQ index used for cosine queries at serve time.
"""

from __future__ import annotations

import daft
import lancedb
import pyarrow as pa
from rich.console import Console

from .config import CLIP_EMBED_DIM, LANCE_TABLE, LANCEDB_DIR
from .embed import load_embeddings
from .metadata import load_metadata

console = Console()


def _to_arrow(df) -> pa.Table:
    """Materialize the Daft DataFrame as an Arrow table LanceDB can ingest."""
    arrow_tbl = df.to_arrow()
    # LanceDB wants embeddings as a fixed-size list of float32. Daft's
    # embedding dtype already maps to that, but if it round-tripped to a
    # plain list we coerce it back here.
    if not pa.types.is_fixed_size_list(arrow_tbl.schema.field("embedding").type):
        col = arrow_tbl.column("embedding").combine_chunks()
        flat = pa.array(
            [v.as_py() for v in col],
            type=pa.list_(pa.float32(), CLIP_EMBED_DIM),
        )
        arrow_tbl = arrow_tbl.set_column(
            arrow_tbl.schema.get_field_index("embedding"), "embedding", flat
        )
    return arrow_tbl


# LanceDB's IVF_PQ trainer needs at least 256 samples per sub-quantizer.
# Below that, brute-force scan is fast enough and produces exact results.
PQ_MIN_ROWS = 256


def _attach_categories(emb_df: daft.DataFrame) -> daft.DataFrame:
    """Left-join the category label from metadata; missing matches get null.

    LVIS uids can appear in multiple categories, so we dedupe the metadata
    side first (one category per uid) — otherwise the left join blows up
    each embedding into N rows. The post-join select also explicitly
    re-projects to (uid, embedding, category) so LanceDB doesn't see the
    `right.category` rename Daft produces on collision-safe joins.
    """
    try:
        meta_rows = load_metadata().select("uid", "category").to_pylist()
        seen: dict[str, str] = {}
        for r in meta_rows:
            if r["uid"] not in seen:
                seen[r["uid"]] = r["category"]
        meta = daft.from_pylist([{"uid": u, "category": c} for u, c in seen.items()])
        joined = emb_df.join(meta, on="uid", how="left")
        return joined.select("uid", "embedding", "category")
    except Exception as exc:  # noqa: BLE001
        console.print(f"[yellow]warn[/] couldn't join metadata: {exc}; categories will be null")
        return emb_df.with_column("category", daft.lit(None).cast(daft.DataType.string()))


def build_index() -> None:
    df = _attach_categories(load_embeddings())
    table = _to_arrow(df)
    console.print(f"[cyan]ingesting[/] {table.num_rows:,} vectors into LanceDB")

    db = lancedb.connect(str(LANCEDB_DIR))
    if LANCE_TABLE in db.table_names():
        db.drop_table(LANCE_TABLE)
    tbl = db.create_table(LANCE_TABLE, data=table)

    if table.num_rows < PQ_MIN_ROWS:
        console.print(
            f"[yellow]→[/] {table.num_rows} rows < {PQ_MIN_ROWS}; "
            "skipping ANN index, queries will run as exact cosine scan"
        )
    else:
        n_partitions = max(8, int(table.num_rows**0.5))
        tbl.create_index(
            metric="cosine",
            vector_column_name="embedding",
            num_partitions=n_partitions,
            num_sub_vectors=64,
        )
        console.print(f"[green]✓[/] built IVF_PQ index ({n_partitions} partitions)")
    console.print(f"[green]✓[/] table ready at {LANCEDB_DIR}")


def open_table():
    db = lancedb.connect(str(LANCEDB_DIR))
    return db.open_table(LANCE_TABLE)


def search(query_vec, k: int = 24) -> list[dict]:
    """Cosine-ANN over the LanceDB table; returns top-k rows as plain dicts."""
    tbl = open_table()
    rows = tbl.search(query_vec).metric("cosine").limit(k).to_list()
    return rows
