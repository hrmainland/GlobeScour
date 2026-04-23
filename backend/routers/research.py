import os
from fastapi import APIRouter, HTTPException
from bson import ObjectId
import anthropic
from db import locations, maps

router = APIRouter(prefix="/api/locations")

DEFAULT_CRITERIA = ["Waves", "Crowds", "Accessibility", "Accommodation", "Vibe"]


def build_system_prompt(criteria: list[str], vision: str) -> str:
    criteria_list = ", ".join(criteria)
    vision_line = f"\nTrip vision: {vision}" if vision.strip() else ""
    return f"""You are a travel researcher.{vision_line} Use web_search to look up the destination, then call record_research with your findings.

Evaluate the location across these criteria: {criteria_list}

Rating guide:
- green = excellent / highly recommended
- amber = moderate / some caveats
- red = poor / significant downsides"""


def build_record_tool(criteria: list[str]) -> dict:
    return {
        "name": "record_research",
        "description": "Record the final research findings for the location.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {
                    "type": "string",
                    "description": "2-3 sentence overview of the location",
                },
                "ratings": {
                    "type": "object",
                    "properties": {c: {"type": "string", "enum": ["green", "amber", "red"]} for c in criteria},
                    "required": criteria,
                },
                "ratings_notes": {
                    "type": "object",
                    "properties": {c: {"type": "string"} for c in criteria},
                    "required": criteria,
                },
                "sources": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "URLs or titles of sources used",
                },
            },
            "required": ["summary", "ratings", "ratings_notes", "sources"],
        },
    }


def research_location(name: str, lat: float, lng: float, location_type: str, criteria: list[str], vision: str) -> dict:
    if location_type == "named":
        user_msg = f"Research the destination: {name}. Focus on the criteria: {', '.join(criteria)}."
    else:
        user_msg = f"Research destinations near coordinates {lat:.4f}, {lng:.4f}. Focus on the criteria: {', '.join(criteria)}."

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    messages = [{"role": "user", "content": user_msg}]
    tools = [{"type": "web_search_20260209", "name": "web_search"}, build_record_tool(criteria)]

    while True:
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=4096,
            system=build_system_prompt(criteria, vision),
            tools=tools,
            tool_choice={"type": "any"},
            messages=messages,
        )

        record_block = next(
            (b for b in response.content if getattr(b, "type", None) == "tool_use" and b.name == "record_research"),
            None,
        )
        if record_block:
            return record_block.input

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "pause_turn":
            messages.append({
                "role": "user",
                "content": "Now call record_research with your findings.",
            })


@router.post("/{location_id}/research", status_code=200)
def run_research(location_id: str):
    try:
        oid = ObjectId(location_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid location id")

    doc = locations.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Location not found")

    # Pull criteria from the map this location belongs to
    criteria = DEFAULT_CRITERIA
    vision = ""
    map_id = doc.get("map_id")
    if map_id:
        try:
            map_doc = maps.find_one({"_id": ObjectId(map_id)})
            if map_doc and map_doc.get("criteria"):
                criteria = map_doc["criteria"].get("items", DEFAULT_CRITERIA) or DEFAULT_CRITERIA
                vision = map_doc["criteria"].get("vision", "")
        except Exception:
            pass

    result = research_location(
        name=doc["name"],
        lat=doc["lat"],
        lng=doc["lng"],
        location_type=doc.get("location_type", "named"),
        criteria=criteria,
        vision=vision,
    )

    locations.update_one(
        {"_id": oid},
        {"$set": {"research": result, "research_status": "done"}},
    )

    return result
