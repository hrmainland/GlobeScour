# GlobeScour — Build Phases

## Phase 1 — Skeleton + Deploy
- Set up monorepo structure: `/frontend` (React/Vite) + `/backend` (FastAPI)
- Wire up Render deployment config (both services)
- Globe renders, nothing else works
- **Done when:** live URL shows a globe

## Phase 2 — Pins + User selector
- MongoDB Atlas (free tier) + basic Location model
- "Who are you?" selector stored in localStorage
- Click globe → drop a pin, name it, save it
- Pins persist and load on refresh
- **Done when:** both users can add and see each other's pins

## Phase 3 — AI Research (synchronous)
- FastAPI endpoint calls Claude with web search
- Returns traffic light ratings, summary, sources
- Frontend: "Research this spot" → show research dashboard
- **Done when:** clicking research on a pin fills in real data

## Phase 4 — Make research async
- Swap to FastAPI `BackgroundTasks`
- Research job writes status (`pending` → `complete`) to MongoDB
- Frontend polls every 3s, shows spinner then results
- **Done when:** user triggers research and navigates away, comes back to results

## Phase 5 — Discovery mode
- AI suggests towns within a region/scope
- Geocode suggestions via Mapbox → show as candidate pins
- User confirms or discards each one
- **Done when:** "discover spots in X" produces a list of placeable pins

## Phase 6 — Collaborative notes
- Markdown editor per location (MDEditor)
- Last-write-wins, "last edited by X at Y" shown
- **Done when:** both users can write and read notes on any pin

## Phase 7 — Criteria management + polish
- User-editable criteria list (default 4, can add/remove/rename)
- Research ratings tied to current criteria
- UI polish, mobile-friendly
