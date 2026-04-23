# GlobeScour

A collaborative trip-planning app built around an interactive globe. Drop pins anywhere in the world, define criteria for what makes a destination worth visiting, then let Claude research each spot and rate it against those criteria.

Originally designed for surf trip planning but fully generalised — criteria are user-defined per map, so the same app works for mountaineering, backpacking, or anything else.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite, Mapbox GL JS |
| Backend | Python, FastAPI |
| Database | MongoDB Atlas |
| AI | Anthropic Claude (Sonnet 4.6 + web search) |
| Deployment | Render |

---

## Prerequisites

- Node 18+
- Python 3.12+
- A MongoDB Atlas cluster (free tier is fine)
- Anthropic API key with web search enabled
- Mapbox access token

---

## Local setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in values
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # then fill in values
npm run dev
```

The Vite dev server proxies `/api/*` to `localhost:8000` — both need to be running locally.

---

## Environment variables

### `backend/.env`

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `ANTHROPIC_API_KEY` | Anthropic API key |

### `frontend/.env.local`

| Variable | Description |
|---|---|
| `VITE_MAPBOX_TOKEN` | Mapbox public access token |

---

## Production build

```bash
cd frontend && npm run build
```

FastAPI serves the built `frontend/dist` as static files, so a single Render web service handles everything.

---

## Project structure

```
/backend
  main.py               # FastAPI app, CORS, static file serving
  db.py                 # MongoDB client + collection references
  routers/
    maps.py             # Map CRUD + criteria PATCH
    locations.py        # Pin CRUD, scoped by map_id
    research.py         # Agentic Claude research per location

/frontend/src
  App.jsx               # User → map → globe flow
  components/
    UserSelector.jsx    # Name entry (stored in localStorage)
    MapSelector.jsx     # Per-user map list + create
    Globe.jsx           # Mapbox globe, pin rendering, click-to-add
    ToolbarPanel.jsx    # Top-left Browse/Criteria panel
    Drawer.jsx          # Bottom sheet for pin detail + research
    PinModal.jsx        # Name-a-pin modal on globe click
```

---

## Where things are heading

See `markdown/PHASES.md` for the full build plan. Currently through Phase 3 (sync AI research) with multi-map and dynamic criteria added ahead of schedule. Phase 4 (async research) is next.
