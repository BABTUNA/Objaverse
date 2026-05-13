"""Stage 3: multi-view rendering of each glb (PyVista / VTK backend).

PyVista wraps VTK, which has reliable offscreen rendering on Windows,
macOS, and Linux without needing EGL/OSMesa system libs. For each
model we:
  1. load the glb with trimesh, normalize to a unit bounding sphere,
  2. place N cameras evenly on a tilted circle around it,
  3. render each view to an RGB uint8 array via a single off_screen
     plotter that's reused across views.

Heavy imports (pyvista, trimesh) are deferred to function bodies so
downstream modules (embed, index, server) can be imported on machines
that don't have the rendering deps available.
"""

from __future__ import annotations

from pathlib import Path

import daft
import numpy as np

from .config import RENDER_SIZE, RENDER_VIEWS, THUMBS_DIR
from .download import load_with_paths


# ---------- pure rendering helpers ------------------------------------------------


def _load_mesh(glb_path: str):
    """Load a glb, collapse its scene to a single Trimesh, normalize to a unit sphere."""
    import trimesh

    obj = trimesh.load(glb_path, force="scene")
    if isinstance(obj, trimesh.Scene):
        meshes = [g for g in obj.geometry.values() if isinstance(g, trimesh.Trimesh)]
        if not meshes:
            raise ValueError(f"no mesh geometry in {glb_path}")
        mesh = trimesh.util.concatenate(meshes)
    else:
        mesh = obj

    if not isinstance(mesh, trimesh.Trimesh):
        raise ValueError(f"unsupported geometry type for {glb_path}: {type(mesh).__name__}")

    mesh.apply_translation(-mesh.centroid)
    radius = float(np.linalg.norm(mesh.bounds, axis=1).max())
    if radius > 0:
        mesh.apply_scale(1.0 / radius)
    return mesh


def _to_pyvista(tm):
    """Convert a trimesh.Trimesh to a pyvista.PolyData without relying on optional interop."""
    import pyvista as pv

    faces = np.asarray(tm.faces, dtype=np.int64)
    # PyVista expects a flat array of [n_verts, v0, v1, ..., n_verts, v0, v1, ...]
    flat = np.hstack([np.full((faces.shape[0], 1), 3, dtype=np.int64), faces]).ravel()
    return pv.PolyData(np.asarray(tm.vertices, dtype=np.float64), flat)


def _camera_positions(n_views: int, radius: float = 2.4, elevation_deg: float = 18.0) -> list[tuple[float, float, float]]:
    """N evenly-spaced camera eye positions on a tilted circle around the origin."""
    elev = np.deg2rad(elevation_deg)
    positions = []
    for i in range(n_views):
        theta = 2.0 * np.pi * i / n_views
        eye = (
            radius * np.cos(elev) * np.cos(theta),
            radius * np.sin(elev),
            radius * np.cos(elev) * np.sin(theta),
        )
        positions.append(eye)
    return positions


def render_views(
    glb_path: str,
    n_views: int = RENDER_VIEWS,
    size: int = RENDER_SIZE,
    thumb_path: Path | None = None,
) -> list[np.ndarray]:
    """Render `n_views` RGB images of the model. Returns a list of HxWx3 uint8 arrays."""
    import pyvista as pv
    from PIL import Image

    mesh = _to_pyvista(_load_mesh(glb_path))

    plotter = pv.Plotter(off_screen=True, window_size=(size, size))
    plotter.set_background("white")
    plotter.add_mesh(mesh, color=(0.78, 0.78, 0.82), smooth_shading=True, specular=0.3)
    plotter.enable_lightkit()
    try:
        views: list[np.ndarray] = []
        for i, eye in enumerate(_camera_positions(n_views)):
            plotter.camera_position = [eye, (0.0, 0.0, 0.0), (0.0, 1.0, 0.0)]
            plotter.camera.zoom(1.1)
            img = plotter.screenshot(return_img=True)  # (H, W, 3 or 4) uint8
            img = np.asarray(img)[..., :3]
            views.append(img.astype(np.uint8))
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
            views = render_views(glb_path, thumb_path=thumb if not thumb.exists() else None)
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
    df = df.where(daft.col("views").is_not_null())

    df.write_parquet(str(RENDERS_PARQUET))
    console.print(f"[green]✓[/] wrote {RENDERS_PARQUET}")


def load_renders() -> daft.DataFrame:
    return daft.read_parquet(str(RENDERS_PARQUET))
