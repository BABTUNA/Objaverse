"""Stage 3: multi-view rendering of each glb (PyVista / VTK backend).

Uses `Plotter.import_gltf` so the source GLB's PBR materials, base-color
textures, and per-vertex colors all survive into the rendered view —
otherwise every model comes out as flat gray clay, which is useless
both for CLIP (it learns "gray blob") and for the atlas thumbnails.

Heavy imports (pyvista, trimesh, PIL) are deferred to function bodies
so downstream modules (embed, index, server) can be imported on
machines that don't have the rendering deps available.
"""

from __future__ import annotations

import math
from pathlib import Path

import daft
import numpy as np

from .config import RENDER_SIZE, RENDER_VIEWS, THUMBS_DIR
from .download import load_with_paths


# ---------- camera helpers --------------------------------------------------------


def _scene_focus(plotter) -> tuple[tuple[float, float, float], float]:
    """Return (center, radius) of all actors currently in the scene."""
    xmin, xmax, ymin, ymax, zmin, zmax = plotter.bounds
    center = (
        (xmin + xmax) * 0.5,
        (ymin + ymax) * 0.5,
        (zmin + zmax) * 0.5,
    )
    radius = 0.5 * math.sqrt(
        (xmax - xmin) ** 2 + (ymax - ymin) ** 2 + (zmax - zmin) ** 2
    )
    return center, max(radius, 1e-6)


def _camera_eye(center, radius: float, theta: float, elevation: float = math.radians(18.0)) -> tuple[float, float, float]:
    """Position on a tilted circle of the given radius around `center`."""
    dist = radius * 2.6
    cx, cy, cz = center
    return (
        cx + dist * math.cos(elevation) * math.cos(theta),
        cy + dist * math.sin(elevation),
        cz + dist * math.cos(elevation) * math.sin(theta),
    )


# ---------- core renderer ---------------------------------------------------------


def render_views(
    glb_path: str,
    n_views: int = RENDER_VIEWS,
    size: int = RENDER_SIZE,
    thumb_path: Path | None = None,
) -> list[np.ndarray]:
    """Render `n_views` RGB images of the model. Returns a list of HxWx3 uint8 arrays.

    Uses PyVista's glTF importer so PBR materials and base-color textures from
    the source GLB are preserved instead of being overridden with a flat color.
    """
    import pyvista as pv
    from PIL import Image

    plotter = pv.Plotter(off_screen=True, window_size=(size, size))
    plotter.set_background("white")
    try:
        plotter.import_gltf(str(glb_path))
    except Exception:
        # import_gltf can fail on malformed assets; bubble up so the UDF
        # catches it and the row is filtered out downstream.
        plotter.close()
        raise

    plotter.enable_lightkit()

    if not plotter.renderer.actors:
        plotter.close()
        raise ValueError(f"no actors imported from {glb_path}")

    center, radius = _scene_focus(plotter)

    try:
        views: list[np.ndarray] = []
        for i in range(n_views):
            theta = 2.0 * math.pi * i / n_views
            eye = _camera_eye(center, radius, theta)
            plotter.camera_position = [eye, center, (0.0, 1.0, 0.0)]
            plotter.camera.zoom(1.05)
            img = plotter.screenshot(return_img=True)
            img = np.asarray(img)[..., :3].astype(np.uint8)
            views.append(img)
            if i == 0 and thumb_path is not None:
                Image.fromarray(img).save(thumb_path)
        return views
    finally:
        plotter.close()


# ---------- Daft UDF --------------------------------------------------------------


@daft.udf(return_dtype=daft.DataType.python())
def render_views_udf(uid_col, glb_path_col):
    """Render N views per row. Returns a (n_views, H, W, 3) uint8 array per row, or None on failure."""
    out = []
    for uid, glb_path in zip(uid_col.to_pylist(), glb_path_col.to_pylist()):
        try:
            thumb = THUMBS_DIR / f"{uid}.png"
            views = render_views(glb_path, thumb_path=thumb)
            out.append(np.stack(views, axis=0))
        except Exception as exc:  # noqa: BLE001
            print(f"[render] skip {uid}: {exc}")
            out.append(None)
    return out


# ---------- pipeline entry point --------------------------------------------------


RENDERS_PARQUET = THUMBS_DIR.parent / "renders.parquet"


def run(limit: int = 0) -> None:
    from rich.console import Console

    console = Console()
    df = load_with_paths()
    if limit > 0:
        df = df.limit(limit)

    console.print("[bold cyan]→[/] rendering views (this is the heavy step)")
    df = df.with_column(
        "views",
        render_views_udf(daft.col("uid"), daft.col("glb_path")),
    )
    df = df.where(~daft.col("views").is_null())

    df.write_parquet(str(RENDERS_PARQUET))
    console.print(f"[green]✓[/] wrote {RENDERS_PARQUET}")


def load_renders() -> daft.DataFrame:
    return daft.read_parquet(str(RENDERS_PARQUET))
