"""Stage 3: multi-view rendering of each glb.

We use PyRender in headless (EGL) mode. For each model we:
  1. load the glb with trimesh, normalize to a unit bounding sphere,
  2. place N cameras evenly on a tilted circle around it,
  3. render each view to an RGB uint8 array.

The rendered views become a Daft column of nested tensors, which the
embedding stage consumes batch-wise. The first view is also written to
disk as a thumbnail PNG so the frontend can show it without re-rendering.
"""

from __future__ import annotations

import os

# Headless GL must be selected before pyrender is imported.
os.environ.setdefault("PYOPENGL_PLATFORM", "egl")

from pathlib import Path

import daft
import numpy as np
import pyrender
import trimesh
from PIL import Image

from .config import RENDER_BG_COLOR, RENDER_SIZE, RENDER_VIEWS, THUMBS_DIR
from .download import load_with_paths


# ---------- pure rendering helpers ------------------------------------------------


def _load_mesh(glb_path: str) -> trimesh.Trimesh:
    """Load a glb, flatten its scene to a single mesh, normalize to a unit sphere."""
    obj = trimesh.load(glb_path, force="scene")
    if isinstance(obj, trimesh.Scene):
        if len(obj.geometry) == 0:
            raise ValueError(f"empty scene: {glb_path}")
        mesh = trimesh.util.concatenate(
            [g for g in obj.dump() if isinstance(g, trimesh.Trimesh)]
        )
    else:
        mesh = obj

    mesh.apply_translation(-mesh.centroid)
    radius = float(np.linalg.norm(mesh.bounds, axis=1).max())
    if radius > 0:
        mesh.apply_scale(1.0 / radius)
    return mesh


def _camera_poses(n_views: int, radius: float = 2.2, elevation_deg: float = 20.0) -> list[np.ndarray]:
    """N evenly-spaced cameras around the object on a tilted circle, looking at the origin."""
    elev = np.deg2rad(elevation_deg)
    poses = []
    for i in range(n_views):
        theta = 2.0 * np.pi * i / n_views
        eye = np.array(
            [
                radius * np.cos(elev) * np.cos(theta),
                radius * np.sin(elev),
                radius * np.cos(elev) * np.sin(theta),
            ]
        )
        forward = -eye / np.linalg.norm(eye)
        up_hint = np.array([0.0, 1.0, 0.0])
        right = np.cross(forward, up_hint)
        right /= np.linalg.norm(right) + 1e-8
        up = np.cross(right, forward)
        pose = np.eye(4)
        pose[:3, 0] = right
        pose[:3, 1] = up
        pose[:3, 2] = -forward
        pose[:3, 3] = eye
        poses.append(pose)
    return poses


def render_views(
    glb_path: str,
    n_views: int = RENDER_VIEWS,
    size: int = RENDER_SIZE,
    thumb_path: Path | None = None,
) -> list[np.ndarray]:
    """Render `n_views` RGB images of the model. Returns a list of HxWx3 uint8 arrays."""
    mesh = _load_mesh(glb_path)

    scene = pyrender.Scene(bg_color=RENDER_BG_COLOR, ambient_light=(0.4, 0.4, 0.4))
    scene.add(pyrender.Mesh.from_trimesh(mesh, smooth=False))

    light = pyrender.DirectionalLight(color=np.ones(3), intensity=3.0)
    scene.add(light, pose=np.eye(4))

    cam = pyrender.PerspectiveCamera(yfov=np.pi / 4.0, aspectRatio=1.0)
    cam_node = scene.add(cam, pose=np.eye(4))

    renderer = pyrender.OffscreenRenderer(viewport_width=size, viewport_height=size)
    try:
        views: list[np.ndarray] = []
        for i, pose in enumerate(_camera_poses(n_views)):
            scene.set_pose(cam_node, pose=pose)
            color, _ = renderer.render(scene)
            views.append(color)
            if i == 0 and thumb_path is not None:
                Image.fromarray(color).save(thumb_path)
        return views
    finally:
        renderer.delete()


# ---------- Daft UDF --------------------------------------------------------------


@daft.udf(return_dtype=daft.DataType.python())
def render_views_udf(uid_col, glb_path_col):
    """Render N views per row. Returns a Python list per row (n_views, H, W, 3) uint8."""
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
