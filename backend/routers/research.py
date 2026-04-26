import os
import json
import time
import functools
from fastapi import APIRouter, BackgroundTasks, HTTPException, Body
from pydantic import BaseModel
from bson import ObjectId
import anthropic
from db import locations, maps

DEBUG_RESEARCH = os.environ.get("DEBUG_RESEARCH", "false").lower() == "true"


def log_claude_request(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print("\n" + "=" * 60)
        print("CLAUDE API REQUEST")
        print("=" * 60)
        print(json.dumps(kwargs, indent=2, default=str))
        print("=" * 60 + "\n")
        return func(*args, **kwargs)

    return wrapper


# @log_claude_request
def _claude_create(client, **kwargs):
    return client.messages.create(**kwargs)


router = APIRouter(prefix="/api/locations")

DEFAULT_CRITERIA = ["Waves", "Crowds", "Accessibility", "Accommodation", "Vibe"]

# Research cost/depth controls
MAX_SEARCH_USES = 3       # max web searches Claude can make per research run
MAX_ITERATIONS = 5        # max agentic loop turns before giving up
MAX_TOKENS = 3000         # max tokens out per API call


def build_system_prompt(criteria: list[str], vision: str) -> str:
    criteria_list = ", ".join(criteria)
    vision_line = f"\nTrip vision: {vision}" if vision.strip() else ""
    return f"""You are a travel researcher.{vision_line} Use web_search to look up the destination, then call record_research with your findings.

Evaluate the location across these criteria: {criteria_list}

Rating guide:
- green = excellent / highly recommended
- amber = moderate / some caveats
- red = poor / significant downsides"""


def build_record_tool(criteria: list[str], include_sources: bool = True) -> dict:
    properties = {
        "summary": {
            "type": "string",
            "description": "2-3 sentence overview of the location",
        },
        "ratings": {
            "type": "object",
            "properties": {
                c: {"type": "string", "enum": ["green", "amber", "red"]}
                for c in criteria
            },
            "required": criteria,
        },
        "ratings_notes": {
            "type": "object",
            "properties": {c: {"type": "string"} for c in criteria},
            "required": criteria,
        },
    }
    required = ["summary", "ratings", "ratings_notes"]
    if include_sources:
        properties["sources"] = {
            "type": "array",
            "items": {"type": "string"},
            "description": "URLs or titles of sources used",
        }
        required.append("sources")
    return {
        "name": "record_research",
        "description": "Record the final research findings for the location.",
        "input_schema": {
            "type": "object",
            "properties": properties,
            "required": required,
        },
    }


def build_user_message(
    name: str, lat: float, lng: float, geocode_context: dict | None, criteria: list[str]
) -> str:
    lines = [
        f"User-given name: {name}",
        f"Coordinates: {lat:.6f}, {lng:.6f}",
    ]
    if geocode_context:
        place_name = geocode_context.get("placeName")
        if place_name:
            lines.append(f"Full location: {place_name}")
        ctx_levels = [
            c["text"] for c in geocode_context.get("context", []) if c.get("text")
        ]
        if ctx_levels:
            lines.append(f"Geographic context: {', '.join(ctx_levels)}")

    location_block = "\n".join(f"  {l}" for l in lines)
    return (
        f"Research this destination and evaluate it against the criteria: {', '.join(criteria)}.\n\n"
        f"Location details:\n{location_block}\n\n"
        "Use the geographic information above to identify the exact location, then search for it."
    )


def research_location(
    name: str,
    lat: float,
    lng: float,
    geocode_context: dict | None,
    criteria: list[str],
    vision: str,
) -> dict:
    user_msg = build_user_message(name, lat, lng, geocode_context, criteria)
    print(
        "\n[research] geocode_context from DB:", json.dumps(geocode_context, indent=2)
    )
    print("[research] user message:\n", user_msg)

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    messages = [{"role": "user", "content": user_msg}]
    tools = [
        {"type": "web_search_20260209", "name": "web_search", "max_uses": MAX_SEARCH_USES},
        build_record_tool(criteria),
    ]

    for iteration in range(MAX_ITERATIONS):
        response = _claude_create(
            client,
            model="claude-sonnet-4-6",
            max_tokens=MAX_TOKENS,
            system=build_system_prompt(criteria, vision),
            tools=tools,
            tool_choice={"type": "any"},
            messages=messages,
        )

        record_block = next(
            (
                b
                for b in response.content
                if getattr(b, "type", None) == "tool_use"
                and b.name == "record_research"
            ),
            None,
        )
        if record_block:
            print(f"[research] completed in {iteration + 1} iteration(s)")
            return record_block.input

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "pause_turn":
            messages.append(
                {
                    "role": "user",
                    "content": "Now call record_research with your findings.",
                }
            )

    raise RuntimeError(f"research did not complete within {MAX_ITERATIONS} iterations")


def _run_debug_task(oid: ObjectId, criteria: list[str]):
    time.sleep(5)
    ratings_cycle = ["green", "amber", "red"]
    result = {
        "summary": "Debug mode: simulated research result. This location scores well on most criteria based on mock web research conducted for testing purposes.",
        "ratings": {c: ratings_cycle[i % 3] for i, c in enumerate(criteria)},
        "ratings_notes": {c: f"Simulated note for {c}." for c in criteria},
        "sources": ["https://example.com/mock-source-1", "https://example.com/mock-source-2"],
    }
    locations.update_one(
        {"_id": oid},
        {"$set": {"research": result, "research_status": "done"}},
    )


def _run_simple_research_task(oid: ObjectId, doc: dict, criteria: list[str], vision: str):
    try:
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        user_msg = build_user_message(
            doc["name"], doc["lat"], doc["lng"], doc.get("geocode_context"), criteria
        )
        response = _claude_create(
            client,
            model="claude-sonnet-4-6",
            max_tokens=MAX_TOKENS,
            system=build_system_prompt(criteria, vision),
            tools=[build_record_tool(criteria, include_sources=False)],
            tool_choice={"type": "tool", "name": "record_research"},
            messages=[{"role": "user", "content": user_msg}],
        )
        record_block = next(
            (b for b in response.content if getattr(b, "type", None) == "tool_use"),
            None,
        )
        if not record_block:
            raise RuntimeError("no record_research call in response")
        locations.update_one(
            {"_id": oid},
            {"$set": {"research": record_block.input, "research_status": "done"}},
        )
        print("[research] simple task completed")
    except Exception as e:
        print(f"[research] simple task failed: {e}")
        locations.update_one({"_id": oid}, {"$set": {"research_status": "failed"}})


def _run_research_task(oid: ObjectId, doc: dict, criteria: list[str], vision: str):
    try:
        result = research_location(
            name=doc["name"],
            lat=doc["lat"],
            lng=doc["lng"],
            geocode_context=doc.get("geocode_context"),
            criteria=criteria,
            vision=vision,
        )
        locations.update_one(
            {"_id": oid},
            {"$set": {"research": result, "research_status": "done"}},
        )
    except Exception as e:
        print(f"[research] background task failed: {e}")
        locations.update_one(
            {"_id": oid},
            {"$set": {"research_status": "failed"}},
        )


class ResearchOptions(BaseModel):
    deep: bool = False


@router.post("/{location_id}/research", status_code=202)
def run_research(location_id: str, background_tasks: BackgroundTasks, options: ResearchOptions = Body(default=ResearchOptions())):
    try:
        oid = ObjectId(location_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid location id")

    doc = locations.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Location not found")

    criteria = DEFAULT_CRITERIA
    vision = ""
    map_id = doc.get("map_id")
    if map_id:
        try:
            map_doc = maps.find_one({"_id": ObjectId(map_id)})
            if map_doc and map_doc.get("criteria"):
                criteria = (
                    map_doc["criteria"].get("items", DEFAULT_CRITERIA)
                    or DEFAULT_CRITERIA
                )
                vision = map_doc["criteria"].get("vision", "")
        except Exception:
            pass

    locations.update_one({"_id": oid}, {"$set": {"research_status": "pending"}})
    if DEBUG_RESEARCH:
        background_tasks.add_task(_run_debug_task, oid, criteria)
    elif options.deep:
        background_tasks.add_task(_run_research_task, oid, doc, criteria, vision)
    else:
        background_tasks.add_task(_run_simple_research_task, oid, doc, criteria, vision)
    return {"status": "pending"}
