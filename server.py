"""
FastAPI backend — serves the React app and exposes 3D generation endpoints.

Start:  uvicorn server:app --reload --port 8000
"""

import sys, os, io, json, struct, tempfile, threading, asyncio
import numpy as np
from pathlib import Path
from typing import Optional, List

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from models.generator import ModelGenerator, GenerationParams, parse_prompt
from models.primitives import make_sphere, make_box, make_cylinder, make_torus, make_cone, make_plane, make_capsule
from file_io.format_manager import load as load_mesh, save as save_mesh, SUPPORTED_WRITE

app = FastAPI(title="3D Model Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── helpers ─────────────────────────────────────────────────────────────────

def mesh_to_dict(mesh) -> dict:
    return {
        "name":     mesh.name,
        "vertices": mesh.vertices.tolist(),
        "faces":    mesh.faces.tolist(),
        "normals":  mesh.normals.tolist() if mesh.normals is not None else None,
        "stats": {
            "vertices":    mesh.vertex_count,
            "faces":       mesh.face_count,
            "volume":      round(float(mesh.volume()),      4),
            "surfaceArea": round(float(mesh.surface_area()), 4),
            "extents":     mesh.extents().tolist(),
        },
    }


def dict_to_mesh(d: dict):
    from models.mesh import Mesh
    return Mesh(
        np.array(d["vertices"], np.float32),
        np.array(d["faces"],    np.int32),
        normals=np.array(d["normals"], np.float32) if d.get("normals") else None,
        name=d.get("name", "mesh"),
    )


# ─── request models ───────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    prompt:      str   = "a smooth sphere"
    resolution:  int   = 48
    neuralBlend: float = 0.0
    seed:        int   = 0
    smoothIters: int   = 1

class MorphRequest(BaseModel):
    prompt1:    str   = "a sphere"
    prompt2:    str   = "a cube"
    frames:     int   = 24
    resolution: int   = 32

class ExportRequest(BaseModel):
    mesh:   dict
    format: str = ".obj"

class PrimitiveRequest(BaseModel):
    shape: str


# ─── REST endpoints ──────────────────────────────────────────────────────────

@app.post("/api/generate")
async def generate(req: GenerateRequest):
    """Generate a mesh synchronously (use /ws/generate for progress streaming)."""
    params = GenerationParams(
        resolution=req.resolution,
        neural_blend=req.neuralBlend,
        seed=req.seed,
        smooth_iters=req.smoothIters,
    )
    gen = ModelGenerator()
    mesh = gen.generate(req.prompt, params)
    return mesh_to_dict(mesh)


@app.post("/api/primitive")
async def primitive(req: PrimitiveRequest):
    shapes = {
        "sphere":   make_sphere,
        "cube":     make_box,
        "cylinder": make_cylinder,
        "torus":    make_torus,
        "cone":     make_cone,
        "plane":    make_plane,
        "capsule":  make_capsule,
    }
    fn = shapes.get(req.shape)
    if fn is None:
        raise HTTPException(400, f"Unknown primitive '{req.shape}'")
    mesh = fn()
    mesh.name = req.shape
    return mesh_to_dict(mesh)


@app.post("/api/animate/morph")
async def animate_morph(req: MorphRequest):
    """
    Generate morph animation frames by blending two SDF fields.
    Returns an array of mesh dicts (one per frame).
    """
    from models.sdf import parse_sdf, sdf_sphere
    from models.generator import encode_text, OccupancyNetwork

    params = GenerationParams(resolution=req.resolution, neural_blend=0.0, seed=0)
    gen    = ModelGenerator()

    res = params.resolution
    lin = np.linspace(-0.58, 0.58, res, dtype=np.float32)
    gx, gy, gz = np.meshgrid(lin, lin, lin, indexing="ij")
    xyz = np.stack([gx.ravel(), gy.ravel(), gz.ravel()], axis=1)

    from models.generator import parse_prompt as pp
    fn1, fn2 = pp(req.prompt1), pp(req.prompt2)
    sdf1 = fn1(xyz).reshape(res, res, res)
    sdf2 = fn2(xyz).reshape(res, res, res)

    frames = []
    for i in range(req.frames):
        t = i / max(req.frames - 1, 1)
        blended = (1 - t) * sdf1 + t * sdf2
        mesh = gen._mc(blended, params.iso_value, 1.16 / res)
        if mesh and mesh.vertex_count >= 4:
            mesh.normalize()
            mesh.name = f"morph_{i:03d}"
            frames.append(mesh_to_dict(mesh))

    return {"frames": frames, "prompt1": req.prompt1, "prompt2": req.prompt2}


@app.post("/api/upload")
async def upload(file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix.lower()
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        mesh = load_mesh(tmp_path)
        return mesh_to_dict(mesh)
    finally:
        os.unlink(tmp_path)


@app.post("/api/export")
async def export(req: ExportRequest):
    fmt = req.format if req.format.startswith(".") else f".{req.format}"
    if fmt not in SUPPORTED_WRITE:
        raise HTTPException(400, f"Unsupported format '{fmt}'")
    mesh = dict_to_mesh(req.mesh)
    with tempfile.NamedTemporaryFile(suffix=fmt, delete=False) as tmp:
        tmp_path = tmp.name
    try:
        save_mesh(mesh, tmp_path)
        data = open(tmp_path, "rb").read()
    finally:
        os.unlink(tmp_path)
    mime = {
        ".obj": "text/plain", ".stl": "application/octet-stream",
        ".ply": "application/octet-stream", ".glb": "model/gltf-binary",
        ".gltf": "model/gltf+json", ".off": "text/plain",
    }.get(fmt, "application/octet-stream")
    filename = f"{mesh.name}{fmt}"
    return StreamingResponse(
        io.BytesIO(data),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/formats")
async def formats():
    return {"write": sorted(SUPPORTED_WRITE)}


# ─── WebSocket — streaming generation with progress ──────────────────────────

@app.websocket("/ws/generate")
async def ws_generate(ws: WebSocket):
    await ws.accept()
    try:
        data   = await ws.receive_json()
        params = GenerationParams(
            resolution=data.get("resolution", 48),
            neural_blend=data.get("neuralBlend", 0.0),
            seed=data.get("seed", 0),
            smooth_iters=data.get("smoothIters", 1),
        )
        prompt = data.get("prompt", "a sphere")
        loop   = asyncio.get_event_loop()
        q: asyncio.Queue = asyncio.Queue()

        def _cb(frac, msg):
            asyncio.run_coroutine_threadsafe(
                q.put({"type": "progress", "frac": frac, "msg": msg}), loop
            )

        def _run():
            try:
                gen = ModelGenerator()
                gen.set_progress_callback(_cb)
                mesh = gen.generate(prompt, params)
                asyncio.run_coroutine_threadsafe(
                    q.put({"type": "done", "mesh": mesh_to_dict(mesh)}), loop
                )
            except Exception as e:
                asyncio.run_coroutine_threadsafe(
                    q.put({"type": "error", "msg": str(e)}), loop
                )

        threading.Thread(target=_run, daemon=True).start()

        while True:
            msg = await q.get()
            await ws.send_json(msg)
            if msg["type"] in ("done", "error"):
                break

    except WebSocketDisconnect:
        pass


# ─── WebSocket — morph animation with progress ───────────────────────────────

@app.websocket("/ws/morph")
async def ws_morph(ws: WebSocket):
    await ws.accept()
    try:
        data = await ws.receive_json()
        prompt1    = data.get("prompt1", "a sphere")
        prompt2    = data.get("prompt2", "a cube")
        n_frames   = data.get("frames", 24)
        resolution = data.get("resolution", 32)
        loop = asyncio.get_event_loop()

        from models.generator import parse_prompt as pp
        params = GenerationParams(resolution=resolution, neural_blend=0.0)
        gen    = ModelGenerator()

        res = resolution
        lin = np.linspace(-0.58, 0.58, res, dtype=np.float32)
        gx, gy, gz = np.meshgrid(lin, lin, lin, indexing="ij")
        xyz  = np.stack([gx.ravel(), gy.ravel(), gz.ravel()], axis=1)
        sdf1 = pp(prompt1)(xyz).reshape(res, res, res)
        sdf2 = pp(prompt2)(xyz).reshape(res, res, res)

        frames = []
        for i in range(n_frames):
            t       = i / max(n_frames - 1, 1)
            blended = (1 - t) * sdf1 + t * sdf2
            mesh    = gen._mc(blended, 0.0, 1.16 / res)
            if mesh and mesh.vertex_count >= 4:
                mesh.normalize()
                frames.append(mesh_to_dict(mesh))
            frac = (i + 1) / n_frames
            await ws.send_json({"type": "progress", "frac": frac,
                                 "msg": f"Frame {i+1}/{n_frames}"})

        await ws.send_json({"type": "done", "frames": frames})

    except WebSocketDisconnect:
        pass


# ─── serve built React app ───────────────────────────────────────────────────

_DIST = os.path.join(os.path.dirname(__file__), "web", "dist")
if os.path.isdir(_DIST):
    app.mount("/", StaticFiles(directory=_DIST, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
