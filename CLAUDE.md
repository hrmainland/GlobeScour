Explain the code you're writing to me as you do it

When you make code changes, update CLAUDE.md and README.md if anything they describe has changed — API routes, data model, collection shapes, architectural decisions, folder structure, env vars, or current phase. Keep them accurate as a living record, not a snapshot.

---

# GlobeScour — Agent context

## What this is

A collaborative trip-planning app. Users create named maps, drop pins on a globe, define criteria for what makes a destination good, and trigger Claude to research each pin against those criteria. The original use case was surf travel but the criteria system is fully generic.

## Current state (as of April 2026)

Phases 1–4 complete. Multi-map support, dynamic criteria, async research, search with suggestion pins, and pin rename all shipped.

## Architecture

```
UserSelector → MapSelector → Globe
                                ├── HamburgerMenu (top-right, back to map select)
                                ├── ToolbarPanel (top-left, Browse/Search/Criteria modes)
                                ├── PinModal (on globe click)
                                └── Drawer (bottom sheet, pin detail + research)
```

User state lives in `localStorage` (just a name string — no auth yet). Map state is fetched from the DB and held in `App`. Last-viewed map and view position (per map) are also persisted to localStorage.

## MongoDB collections

### `maps`
```
{
  _id, name, created_by,
  criteria: { items: string[], vision: string },
  created_at
}
```

### `locations`
```
{
  _id, map_id, name, lat, lng,
  created_by, location_type: "named" | "coordinate",
  research_status: "none" | "done",
  research: {
    summary, ratings: { [criterion]: "green"|"amber"|"red" },
    ratings_notes: { [criterion]: string }, sources: string[]
  },
  created_at
}
```

## Key architectural decisions

**Criteria live on the map, not on locations.** When research runs, the backend walks `location → map_id → maps collection` to fetch the current criteria. This means re-researching a pin always uses the latest criteria without any migration of existing location documents.

**The `record_research` tool schema is built dynamically** from `map.criteria.items`. Claude is given exactly the criteria the user defined — no hardcoded surf labels anywhere in the AI pipeline. See `backend/routers/research.py`.

**Research is async** (Phase 4). `POST /api/locations/:id/research` returns 202 immediately and runs in a FastAPI `BackgroundTask`. The frontend polls `GET /api/locations/:id` every 3s until `research_status` is `"done"` or `"failed"`. `DEBUG_RESEARCH=True` in `.env` skips the Claude call and writes mock data after 5s.

**Suggestion pins** are temporary red markers from Mapbox forward geocoding (Search tab). They live in Globe's local state and `localStorage` (`globescour_search_<mapId>`). Saving or researching a suggestion POSTs it to the DB and converts it to a real blue pin. Suggestion markers hide when leaving the Search tab and reappear when returning.

**Pin rename** is available by clicking the name in the Drawer header. For saved pins this PATCHes the backend. For suggestion pins it triggers save-as-new-pin with the edited name.

**No auth yet.** `created_by` is just a freetext name from `localStorage`. The plan calls for JWT auth eventually but the data model already supports multiple users.

## API routes

```
GET    /api/maps?user=           list maps for a user
POST   /api/maps                 create map { name, created_by }
GET    /api/maps/:id             get single map (includes criteria)
PATCH  /api/maps/:id/criteria    update criteria { items, vision }

GET    /api/locations?map_id=    list pins for a map
POST   /api/locations            create pin (requires map_id)
GET    /api/locations/:id        get single pin
PATCH  /api/locations/:id        rename pin { name }
DELETE /api/locations/:id        delete pin

POST   /api/locations/:id/research   trigger Claude research (202, async — pulls criteria from map)
```

## AI research flow

`research.py` runs a tool-use loop:

1. Give Claude `web_search` + a dynamically-built `record_research` tool
2. `tool_choice: "any"` forces a tool call every turn — no free-text replies
3. Loop continues while Claude uses `web_search` (`stop_reason: "pause_turn"`)
4. Loop exits when Claude calls `record_research` — its `input` is the structured result
5. Result is written to the location document

## Frontend state flow

- `App` owns `user` (string) and `map` (full map object including criteria). Restores last-viewed map from `globescour_last_map_id` on mount.
- `Globe` owns `pins` array, `suggestions` array, and local `criteria` state (initialised from `map.criteria`)
- `ToolbarPanel` has Browse / Search / Criteria tabs. Criteria edits are debounced 600ms to PATCH. Search submits forward geocoding queries and calls `onSearch` / `onSuggestionClick` / `onSearchTabClose` / `onSearchTabOpen` callbacks.
- `Globe` passes criteria and suggestion callbacks into `ToolbarPanel`; passes `onRename` and `onSaveSuggestion` into `Drawer`
- `Drawer` calls `onResearchDone` after research completes — `Globe` updates its `pins` array and the open drawer state so re-opening a pin in the same session shows results
- `Drawer` has a `key={pin.id ?? pin._sid}` so it remounts cleanly when switching between suggestion and saved pin

## Things to know

- `VITE_MAPBOX_TOKEN` lives in `frontend/.env.local` (not `backend/.env`)
- The Vite dev server proxies `/api/*` to the FastAPI backend
- In production, FastAPI serves the built `frontend/dist` as static files — single service on Render
- `markdown/PLAN.md` has the original product vision; `markdown/PHASES.md` has the build roadmap
- `TODO.md` in the repo root has outstanding small items
