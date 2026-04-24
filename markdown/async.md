# Phase 4 — Async Research

## The current (synchronous) flow

When you click "Research this spot", this is what happens right now:

1. Your browser sends a POST request to `/api/locations/:id/research`
2. The FastAPI server receives it and **immediately starts doing the research** — calling Claude, waiting for web searches, waiting for Claude to respond
3. The server holds the HTTP connection open the entire time
4. Only when Claude is completely finished does the server send a response back to your browser
5. Your browser receives the result and renders it

The whole thing is one long unbroken chain: **request → wait → response**. The browser is just sitting there with an open connection while all of this happens on the server.

---

## The problem this creates

### It's slow and Claude research takes a while

A single research run involves multiple round trips: Claude calls `web_search`, waits for results, calls it again, synthesises, then calls `record_research`. This typically takes **30–90 seconds**. That's a long time to hold an HTTP connection open.

### HTTP connections have timeouts

Web servers, proxies, and cloud platforms (including Render, which this is deployed on) impose timeout limits on HTTP requests — typically **30–60 seconds**. If the research takes longer than that, the connection gets cut. The server may still be running the research, but the browser gets an error and the result is lost.

### You're stuck on the page

Because the response only comes when research is done, you can't navigate away. If you close the drawer or switch maps, the connection drops and you get nothing. This is the core UX problem: **the user is held hostage waiting for a result**.

### It doesn't scale

While one research request is running, that server thread is just waiting. With two users triggering research simultaneously, you have two threads sitting idle waiting for Claude. It works at this scale but is wasteful.

---

## The async model

Instead of one long request-response, the work is split into two parts:

### Part 1 — Kick off the job (fast)

1. Browser sends POST to `/api/locations/:id/research`
2. Server immediately updates the location's `research_status` to `"pending"` in MongoDB
3. Server hands the actual research work off to a **background task** — a separate process that runs independently
4. Server immediately responds to the browser: `{ status: "pending" }` — in milliseconds
5. The HTTP connection closes. Browser and server are now decoupled.

### Part 2 — Poll for results (frontend)

1. The browser sees `research_status: "pending"` and shows a spinner
2. Every few seconds, the browser sends a GET to `/api/locations/:id` to check the status
3. Meanwhile, the background task is running the Claude research independently
4. When Claude finishes, the background task writes the result to MongoDB and sets `research_status: "done"`
5. On the next poll, the browser sees `"done"`, fetches the result, and renders it

---

## The tech: FastAPI BackgroundTasks

FastAPI has a built-in feature called `BackgroundTasks`. You pass a function to it and FastAPI runs it **after the response has been sent** — in the same process, but in a separate thread.

```
Browser                   FastAPI                   Claude
   |                         |                         |
   |--- POST /research ----→ |                         |
   |                         |-- spawn background --→  |
   |← { status: pending } ---|    task                 |
   |                         |                   (running...)
   |--- GET /locations/id --→|                         |
   |← { status: pending } ---|                         |
   |                         |                   (running...)
   |--- GET /locations/id --→|                         |
   |← { status: pending } ---|                         |
   |                         |←-- writes result -------|
   |--- GET /locations/id --→|                         |
   |← { status: done, ... } -|                         |
   |                         |                         |
```

This is the simplest possible async approach — no separate queue service, no Redis, no Celery, no separate worker process. It runs in the same FastAPI server.

---

## Tradeoffs and known limitations

### Jobs don't survive a server restart

BackgroundTasks run in-memory. If the Render instance restarts while a research job is running, the job dies. The location will be stuck at `research_status: "pending"` forever (or until someone re-triggers it).

For two casual users doing occasional research, this is acceptable. It would not be acceptable for a production app with many users. The proper fix would be a persistent job queue (e.g. Celery + Redis), but that's significant extra infrastructure.

**Mitigation:** we can add a `research_started_at` timestamp and treat any pin stuck on `"pending"` for more than 5 minutes as `"failed"` — showing a "retry" button rather than an eternal spinner.

### Polling is not instant

The browser checks every N seconds. If Claude finishes in 35 seconds, the user might wait up to 35 + N seconds before they see the result. A 3-second poll interval is a reasonable tradeoff — fast enough to feel responsive, not so fast that it hammers the server.

A more advanced approach would use WebSockets or Server-Sent Events to push the result directly to the browser the moment it's ready, but that's meaningfully more complex to implement.

### Concurrent research is now possible (and that's fine)

Because the response returns immediately, both users could trigger research on different pins at the same time without blocking each other. Each runs in its own background thread. At small scale this is fine; under heavy load you'd want a proper queue to limit concurrency.

---

## Summary of changes needed

| Layer | Current | After |
|---|---|---|
| `research.py` | Runs research inline, returns result | Spawns `BackgroundTask`, returns `{ status: "pending" }` immediately |
| `locations.py` | No change | Add `GET /api/locations/:id` single-location endpoint |
| MongoDB | `research_status: "none" \| "done"` | Add `"pending"` and `"failed"` states, add `research_started_at` |
| `Drawer.jsx` | Waits for POST response | Starts polling on `GET /locations/:id` when status is `pending` |
