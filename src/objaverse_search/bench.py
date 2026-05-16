"""Stage 7 (optional): benchmark Daft against a naive baseline.

The render stage is the headline comparison — it's CPU-bound, embarrassingly
parallel, and the speedup from Daft's process pool is honest and reproducible.
We time the same N glbs two ways:

  - naive:  single Python process, sequential for-loop, one renderer per model
  - daft:   the same render_views function called through a Daft UDF, which
            distributes the work across Daft's worker pool

Hardware specs are captured so a screenshot of /perf doesn't lie about the
machine the numbers came from.
"""

from __future__ import annotations

import json
import platform
import time
from datetime import datetime, timezone
from pathlib import Path

import daft
import psutil
from rich.console import Console

from .config import EMB_DIR
from .download import load_with_paths
from .render import render_views, render_views_udf

console = Console()

BENCH_JSON = EMB_DIR / "benchmarks.json"


# ---------- hardware ---------------------------------------------------------


def _detect_hardware() -> dict:
    """Snapshot machine specs. GPU detection is lazy and torch-optional."""
    info: dict = {
        "platform": platform.system() + " " + platform.release(),
        "cpu": platform.processor() or "unknown",
        "cpu_logical_cores": psutil.cpu_count(logical=True) or 0,
        "cpu_physical_cores": psutil.cpu_count(logical=False) or 0,
        "ram_gb": round(psutil.virtual_memory().total / (1024**3), 1),
        "gpu": None,
    }
    try:
        import torch

        if torch.cuda.is_available() and torch.cuda.device_count() > 0:
            info["gpu"] = torch.cuda.get_device_name(0)
    except Exception:  # noqa: BLE001
        pass
    return info


# ---------- timing helpers ---------------------------------------------------


def _time_sequential_render(samples: list[dict]) -> dict:
    """Render N models one at a time in this process."""
    successes = 0
    failures = 0
    t0 = time.perf_counter()
    for s in samples:
        try:
            render_views(s["glb_path"])
            successes += 1
        except Exception as exc:  # noqa: BLE001
            failures += 1
            console.print(f"[yellow]naive skip[/] {s['uid']}: {exc}")
    elapsed = time.perf_counter() - t0
    return {
        "elapsed_seconds": round(elapsed, 3),
        "models_rendered": successes,
        "models_failed": failures,
        "throughput_models_per_sec": round(successes / elapsed, 3) if elapsed > 0 else 0,
    }


def _time_daft_render(samples: list[dict]) -> dict:
    """Render N models through the Daft UDF pipeline."""
    df = daft.from_pylist([{"uid": s["uid"], "glb_path": s["glb_path"]} for s in samples])

    t0 = time.perf_counter()
    df = df.with_column(
        "views",
        render_views_udf(daft.col("uid"), daft.col("glb_path")),
    )
    df = df.where(~daft.col("views").is_null())
    # collect() forces materialization end-to-end so we time the whole plan.
    result = df.collect()
    elapsed = time.perf_counter() - t0

    successes = result.count_rows()
    return {
        "elapsed_seconds": round(elapsed, 3),
        "models_rendered": successes,
        "models_failed": len(samples) - successes,
        "throughput_models_per_sec": round(successes / elapsed, 3) if elapsed > 0 else 0,
    }


# ---------- public entry -----------------------------------------------------


def run(n: int = 20) -> None:
    """Benchmark sequential vs Daft render on N sampled models."""
    df = load_with_paths().limit(n)
    samples = df.select("uid", "glb_path").to_pylist()
    if not samples:
        raise RuntimeError("no downloaded glbs — run download first")

    hardware = _detect_hardware()
    console.print(
        f"[cyan]bench[/] {len(samples)} models  ·  "
        f"{hardware['cpu_physical_cores']}c/{hardware['cpu_logical_cores']}t  ·  "
        f"{hardware['ram_gb']} GB  ·  GPU: {hardware['gpu'] or 'none'}"
    )

    console.print("[cyan]→[/] naive sequential render")
    naive = _time_sequential_render(samples)
    console.print(
        f"  {naive['elapsed_seconds']}s, "
        f"{naive['throughput_models_per_sec']} models/sec"
    )

    console.print("[cyan]→[/] Daft parallel render")
    daft_result = _time_daft_render(samples)
    console.print(
        f"  {daft_result['elapsed_seconds']}s, "
        f"{daft_result['throughput_models_per_sec']} models/sec"
    )

    speedup = (
        round(naive["elapsed_seconds"] / daft_result["elapsed_seconds"], 2)
        if daft_result["elapsed_seconds"] > 0
        else 0
    )

    payload = {
        "ran_at": datetime.now(timezone.utc).isoformat(),
        "n_models": len(samples),
        "hardware": hardware,
        "render": {
            "naive": naive,
            "daft": daft_result,
            "speedup_x": speedup,
        },
    }

    BENCH_JSON.parent.mkdir(parents=True, exist_ok=True)
    BENCH_JSON.write_text(json.dumps(payload, indent=2))
    console.print(f"[green]✓[/] {speedup}× speedup  ·  wrote {BENCH_JSON}")


def load_results() -> dict | None:
    if not BENCH_JSON.exists():
        return None
    return json.loads(BENCH_JSON.read_text())
