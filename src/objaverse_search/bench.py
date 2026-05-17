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
from .render import render_views

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
    per_model: list[dict] = []
    # Use wall clock so timings are comparable to the Daft run (which may
    # execute across worker processes where perf_counter epochs differ).
    t0 = time.time()
    for s in samples:
        start = time.time() - t0
        ok = True
        try:
            render_views(s["glb_path"])
            successes += 1
        except Exception as exc:  # noqa: BLE001
            failures += 1
            ok = False
            console.print(f"[yellow]naive skip[/] {s['uid']}: {exc}")
        end = time.time() - t0
        per_model.append(
            {"uid": s["uid"], "start_s": round(start, 3), "end_s": round(end, 3), "ok": ok}
        )
    elapsed = time.time() - t0
    return {
        "elapsed_seconds": round(elapsed, 3),
        "models_rendered": successes,
        "models_failed": failures,
        "throughput_models_per_sec": round(successes / elapsed, 3) if elapsed > 0 else 0,
        "per_model": per_model,
    }


# Bench-specific UDF. use_process=True forks a subprocess per replica so
# PyVista/VTK can actually render in parallel without GIL contention; without
# this flag Daft would run the UDF in the main process and the "parallel"
# speedup would only reflect scheduling overhead.
@daft.udf(return_dtype=daft.DataType.python(), use_process=True)
def _bench_render_udf(uid_col, glb_path_col, t0_col):
    out = []
    for uid, glb_path, t0 in zip(
        uid_col.to_pylist(), glb_path_col.to_pylist(), t0_col.to_pylist()
    ):
        start = time.time() - t0
        ok = True
        try:
            render_views(glb_path)
        except Exception:  # noqa: BLE001
            ok = False
        end = time.time() - t0
        out.append({"uid": uid, "start_s": round(start, 3), "end_s": round(end, 3), "ok": ok})
    return out


def _daft_workers() -> int:
    """Pick a parallelism level: physical cores capped at 8 (point of diminishing returns)."""
    physical = psutil.cpu_count(logical=False) or 4
    return max(2, min(8, physical))


def _ensure_ray_runner(workers: int) -> str:
    """Switch Daft to the Ray runner so partitioning + concurrency actually take effect.

    Returns a label describing what we ended up with — surfaced in the JSON
    so /perf can be honest about whether real parallelism was running.
    """
    try:
        import ray
    except ImportError:
        console.print(
            "[yellow]warn[/] ray not installed; native runner can't repartition, "
            "Daft bench will run single-process"
        )
        return "native"

    try:
        if not ray.is_initialized():
            ray.init(
                num_cpus=workers,
                ignore_reinit_error=True,
                log_to_driver=False,
                include_dashboard=False,
            )
        daft.set_runner_ray()
        return "ray"
    except Exception as exc:  # noqa: BLE001
        console.print(f"[yellow]warn[/] ray init failed ({exc}); falling back to native runner")
        return "native"


def _time_daft_render(samples: list[dict]) -> dict:
    """Render N models through the Daft UDF pipeline with real multi-process parallelism."""
    workers = _daft_workers()
    runner = _ensure_ray_runner(workers)
    udf = _bench_render_udf.with_concurrency(workers)

    t0 = time.time()
    df = daft.from_pylist(
        [{"uid": s["uid"], "glb_path": s["glb_path"], "t0": t0} for s in samples]
    )
    # Repartition so the concurrent UDF replicas have distinct slices. On the
    # native runner this is a no-op (Daft warns) and we'll only see one worker;
    # on Ray it splits the data correctly.
    df = df.into_partitions(workers)
    df = df.with_column(
        "timing",
        udf(daft.col("uid"), daft.col("glb_path"), daft.col("t0")),
    )
    # collect() forces materialization end-to-end so we time the whole plan.
    result = df.collect()
    elapsed = time.time() - t0

    per_model = [row["timing"] for row in result.to_pylist()]
    successes = sum(1 for m in per_model if m["ok"])
    return {
        "elapsed_seconds": round(elapsed, 3),
        "models_rendered": successes,
        "models_failed": len(samples) - successes,
        "throughput_models_per_sec": round(successes / elapsed, 3) if elapsed > 0 else 0,
        "workers": workers,
        "runner": runner,
        "per_model": per_model,
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
