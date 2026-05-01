# 3D Model Generator

Text-to-3D mesh generation with a GUI. Generates meshes from text prompts using a hybrid analytic SDF + neural OccupancyNetwork pipeline. Supports training on open-source datasets.

## Install

```bash
pip install -r requirements.txt

# Optional — faster training and Objaverse dataset support:
pip install torch objaverse
```

## Run

```bash
# Launch the GUI:
python main.py

# Generate from the command line:
python main.py --prompt "a tall hollow cylinder" --output model.obj
python main.py --prompt "a twisted torus"        --output torus.stl --res 64
python main.py --prompt "mountain terrain"        --output terrain.glb
```

## Supported file formats

| Format | Read | Write |
|--------|------|-------|
| `.obj` | ✓ | ✓ |
| `.stl` | ✓ | ✓ |
| `.ply` | ✓ | ✓ |
| `.glb` | ✓ | ✓ |
| `.gltf`| ✓ | ✓ |
| `.off` | ✓ | ✓ |
| `.blend`| ✓ | — |
| `.fbx` | ✓ | — |

## Prompt grammar

The generator understands multi-keyword prompts with adjectives and boolean ops — no training required for these:

```
a tall cylinder
a hollow sphere
a twisted torus
a sphere on top of a box
a bumpy wide cube
a small flat disc
a torus with a hole
mountain terrain
```

**Shape keywords:** sphere, cube, cylinder, cone, torus, terrain, capsule, ellipsoid, disc, pipe, barrel, pillar, plate, plane, …

**Adjectives:** tall, short, wide, narrow, thin, flat, large, small, round, sharp, bumpy, twisted, hollow, stacked, …

## Training

Training teaches the neural network real shape geometry from 3D datasets. After training, set **neural blend > 0** in the GUI (or `--blend` on the CLI) to use learned weights.

### Open-source datasets (no data needed)

```bash
# ModelNet10 — 10 categories, ~70 MB, no registration:
python train.py --dataset modelnet10

# ModelNet40 — 40 categories, ~435 MB, no registration:
python train.py --dataset modelnet40

# Train on specific categories only:
python train.py --dataset modelnet40 --categories chair,table,lamp

# Limit number of meshes (faster):
python train.py --dataset modelnet40 --categories chair --n 300 --epochs 200

# One weights file per category (generator picks the right one per prompt):
python train.py --dataset modelnet10 --per-shape

# Objaverse — 800K+ objects, filtered by tag (requires: pip install objaverse):
python train.py --dataset objaverse --categories chair --n 200
```

### Explore available datasets

```bash
# List all datasets:
python train.py --list-datasets

# List categories in a dataset:
python train.py --list-categories modelnet10
python train.py --list-categories modelnet40
```

### Your own data

```bash
# Train on a folder of .obj / .stl / .ply / .glb files:
python train.py --data ./my_shapes/

# With options:
python train.py --data ./my_shapes/ --epochs 200 --lr 1e-3 --batch 1024

# Resume training:
python train.py --dataset modelnet10 --resume models/weights/model.npz
```

Weights are saved to `models/weights/model.npz` (or `<category>.npz` with `--per-shape`) and auto-loaded by the generator.

## GUI controls

| Input | Action |
|-------|--------|
| Left-drag | Rotate |
| Right-drag / scroll | Zoom |
| `R` | Reset view |
| `Ctrl+O` | Open file |
| `Ctrl+S` | Save mesh |
| `Ctrl+G` | Generate |
