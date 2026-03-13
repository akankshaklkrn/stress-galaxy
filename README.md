# The Stress Galaxy

Interactive data story + analysis workspace for workplace mental health patterns across 5,000 workers.

The project has two user-facing experiences:
- `index.html`: guided story mode (slide-style narrative over the galaxy)
- `explore.html`: free exploration mode (lasso, linked charts, find-your-star, zoom/layout switches)

---

## Tech Stack

### Frontend
- HTML/CSS/JavaScript (ES modules)
- [D3.js 7.8.5](https://cdnjs.com/libraries/d3) (via CDN)

### Data / ML pipeline
- Python 3
- `pandas`, `numpy`
- `scikit-learn` (imputation, scaling, KMeans, silhouette, cosine similarity)
- `umap-learn` (2D embedding)
- `matplotlib`, `seaborn`, `jupyter` (analysis/notebook workflow)

---

## Setup

### 1) Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Build processed data

Run from repo root:

```bash
python python/process.py
python python/validate.py
```

This generates/validates:
- `data/processed/workers.json`
- `data/processed/clusters.json`
- `data/processed/similarity.json`

### 3) Run locally

Serve as static files from repo root:

```bash
python3 -m http.server 8000
```

Open:
- `http://localhost:8000/index.html`
- `http://localhost:8000/explore.html`

---

## Key Features

- **Galaxy view:** each worker is a star; color = cluster, size = stress, opacity = resources.
- **Layout morphs:** `similarity`, `stress-spectrum`, `age-orbit`, `work-hours-axis`.
- **Zoom + pan:** cluster zoom and reset.
- **Lasso selection:** freeform subset selection directly on the galaxy.
- **Linked views:** bubble chart, age ring, burnout bars update from selected subset.
- **Parallel coordinates:** profile lines for workers with filtering/highlight support.
- **Tooltips:** rich hover tooltips across galaxy + charts, including modal/enlarged charts.
- **Chart enlarge modal:** expand each lower-panel chart for focused exploration.
- **Find Your Star:** profile matching (age/industry/location/stress) with animated placement.
- **Story mode:** guided narrative progression with camera choreography and contextual annotations.
- **Global Clear reset:** returns to default main galaxy state.