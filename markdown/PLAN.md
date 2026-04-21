# Surf Trip Planner — Project Plan

## Overview

A web app for planning a one-month remote surf trip. The app helps two users (a couple) collaboratively discover, research, and evaluate surf destinations around the world. The core experience is a large interactive globe with pins and regions overlaid on it, backed by AI-powered research and collaborative notes.

---

## Core Criteria

Every destination is evaluated against criteria.
The user should be able to write these and change them dynamically. Every spot is rated according to these.

As an example:

1. **Consistent surf** — reliable swell patterns during the travel window
2. **Warm** — comfortable water and air temperatures
3. **Culturally interesting** — engaging local culture worth experiencing
4. **Remote** — off the beaten path, away from crowds and tourist infrastructure

---

## Core Functionality

### 1. The Globe (Home Screen)

- The primary UI is a full-screen interactive globe/map
- Two types of geographical entities live on the globe:
  - **Regions** — large areas (e.g. "West African coast from Senegal to Ghana"), displayed as semi-transparent polygon overlays
  - **Towns/Spots** — specific locations, displayed as pins
- Neither is required to exist — towns don't need to belong to a region, and regions don't need towns inside them
- A tab bar or filter panel allows the user to toggle between viewing all regions, all towns, or both
- All research and notes live inside these entities — the globe is the single source of truth

---

### 2. Adding Locations (Manual Entry)

- Any user can manually drop a pin or define a region on the globe without using the AI discovery flow
- Discovery is **not** the only entry point — the user may hear about a spot from a friend, video, or forum and want to add it directly
- Manually added towns go through a geocoding lookup (see implementation notes) to place them on the map
- Once added, any town or region can optionally trigger the AI research flow

---

### 3. Discovery Mode (AI-Powered)

Discovery is split into two parallel sub-flows, accessible via a Discovery tab with two options:

#### 3a. Region Discovery
- User specifies a geographic scope (e.g. "the whole world" or "Central America") and a travel window (e.g. "December")
- AI returns a list of broad regions that match the four core criteria
- Regions are described in text (e.g. "southern coast of Nicaragua to northern El Salvador") — they are **not** auto-plotted with polygon coordinates
- User manually draws or confirms the region on the globe
- This flow is used at the start of planning to narrow down a huge world into shortlisted zones

#### 3b. Town/Spot Discovery
- User specifies a region or area and asks for specific towns, surf breaks, or access points
- AI returns a structured list of place names with country and region
- These are geocoded and plotted as pins on the globe (see implementation notes)
- User confirms or corrects each pin placement before it is saved

**Important:** The AI discovery flow should produce candidates that feed naturally into the deep research flow — not two separate systems.

---

### 4. Deep Research (Per Location)

- Available for any town or region, whether discovered by AI or added manually
- User triggers research with a "Research this spot" button
- AI performs real-time web search and synthesises findings against the four core criteria
- Research is run asynchronously — user does not wait for it to complete

#### Research Dashboard (per location)
Each town or region has a dashboard view containing:

- **Name and location**
- **Traffic light ratings** for each of the four criteria (red / amber / green)
- **Confidence indicators** per criterion — e.g. "green but based on 2022 data" or "amber — sources conflict"
- **Brief summary** — one paragraph overview of the location
- **Sources panel** — 4–5 of the most valuable URLs the AI found, with direct clickable links. Sources should prioritise:
  - Weather and swell data archives
  - Surf-specific forums and trip reports
  - Local news and government data
  - Niche travel blogs
  - Scientific or meteorological papers
  - Explicitly **de-prioritise** mainstream travel guides (Lonely Planet, Travel and Leisure, etc.)
- **Collaborative notes** (see below)

---

### 5. Collaborative Notes

- Each town and region has a shared markdown document attached to it
- Both users can read and edit the document
- No real-time collaboration required — last write wins
- A "last edited by [user] at [time]" timestamp is shown so users can spot recent changes
- The editor renders formatted markdown visually (user does not need to know markdown syntax)
- Notes are freeform — users can add anything: personal impressions, logistics, links, quotes from friends, concerns, etc.

---

### 6. Authentication

- Two users (the couple) each have an account and log in
- All pins, regions, research, and notes are shared between both users
- System is architected to support additional users in future (i.e. not hardcoded for two)

---

## What the AI Should and Should Not Do

| Task | AI handles it? |
|---|---|
| Suggest regions matching criteria at global or regional scope | Yes |
| Suggest specific towns/spots within a region | Yes |
| Deep research on a specific town or region | Yes |
| Generate polygon coordinates for regions | No — user draws manually |
| Geocode a place name to lat/long | No — use a geocoding API |
| Access the user's existing notes or saved spots during discovery | No — avoid anchoring bias |
| Reference existing notes during deep research on a specific spot | Optional / second phase |

---

## Tech Stack (Recommended)

### Frontend
- **React** — component-based UI
- **Mapbox GL JS** — interactive globe and map rendering
- **Mapbox Geocoding API** — converting place names to coordinates
- **Lightweight markdown editor** (e.g. MDEditor or similar) — collaborative notes UI

### Backend
- **Python / FastAPI** — REST API server with native async support
- **FastAPI BackgroundTasks** — built-in async task runner for AI research jobs (no extra infrastructure needed; replaces Celery + Redis)
  - Trade-off: jobs don't survive a server restart, but for 2 users doing occasional research this is acceptable

### Database
- **MongoDB** — document store for towns, regions, research results, and notes (unstructured data suits this well)

### AI
- **Anthropic Claude API** with web search tool enabled — for both discovery and deep research
- AI returns structured data (town name, country, region) which is then geocoded — not raw coordinates

### Auth
- **JWT tokens** — stateless auth, no extra infrastructure needed

### Deployment
- **Render** — simple, sufficient for this scale

---

## Data Model (High Level)

```
Location {
  id
  type: "region" | "town"
  name
  coordinates: lat/long (towns) | polygon (regions)
  criteria_ratings: { surf, warmth, culture, remoteness } // traffic light + confidence
  summary: string
  sources: [ { title, url } ]
  research_status: "none" | "pending" | "complete" | "failed"
  notes: markdown string
  notes_last_edited_by: user
  notes_last_edited_at: timestamp
  created_by: user
  created_at: timestamp
}
```

---

## Key Design Principles

- **Globe is the home screen** — everything lives on the map, floating UI on top
- **Discovery feeds deep-dive** — discovered spots use the same data structure as manually added ones
- **No forced hierarchy** — towns don't need regions, regions don't need towns
- **Notes are simple** — last write wins, no real-time sync
- **AI is a research accelerator, not an oracle** — always show sources, always show confidence
- **Start small** — validate AI quality first, then build UI around it
