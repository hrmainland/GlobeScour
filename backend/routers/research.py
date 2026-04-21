import os
from fastapi import APIRouter, HTTPException
from bson import ObjectId
import anthropic
from db import locations

router = APIRouter(prefix="/api/locations")

SYSTEM_PROMPT = """You are a surf travel researcher. Use web_search to look up the destination, then call record_research with your findings.

Rating guide:
- green = excellent / highly recommended
- amber = moderate / some caveats
- red = poor / significant downsides"""

# Claude calls this tool to submit structured results — no JSON parsing needed
RECORD_TOOL = {
    "name": "record_research",
    "description": "Record the final research findings for the surf spot.",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": "2-3 sentence overview of the spot",
            },
            "ratings": {
                "type": "object",
                "properties": {
                    "waves":         {"type": "string", "enum": ["green", "amber", "red"]},
                    "crowds":        {"type": "string", "enum": ["green", "amber", "red"]},
                    "accessibility": {"type": "string", "enum": ["green", "amber", "red"]},
                    "accommodation": {"type": "string", "enum": ["green", "amber", "red"]},
                    "vibe":          {"type": "string", "enum": ["green", "amber", "red"]},
                },
                "required": ["waves", "crowds", "accessibility", "accommodation", "vibe"],
            },
            "ratings_notes": {
                "type": "object",
                "properties": {
                    "waves":         {"type": "string"},
                    "crowds":        {"type": "string"},
                    "accessibility": {"type": "string"},
                    "accommodation": {"type": "string"},
                    "vibe":          {"type": "string"},
                },
                "required": ["waves", "crowds", "accessibility", "accommodation", "vibe"],
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


def research_location(name: str, lat: float, lng: float, location_type: str) -> dict:
    if location_type == "named":
        user_msg = f"Research the surf spot: {name}. Look up waves, crowds, accommodation, how to get there, and overall vibe."
    else:
        user_msg = f"Research surf spots near coordinates {lat:.4f}, {lng:.4f}. Look up waves, crowds, accommodation, access, and vibe."

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    messages = [{"role": "user", "content": user_msg}]
    tools = [{"type": "web_search_20260209", "name": "web_search"}, RECORD_TOOL]

    while True:
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=tools,
            # Force Claude to always call a tool — prevents plain-text replies
            tool_choice={"type": "any"},
            messages=messages,
        )

        # Check if Claude called record_research
        record_block = next(
            (b for b in response.content if getattr(b, "type", None) == "tool_use" and b.name == "record_research"),
            None,
        )
        if record_block:
            return record_block.input

        # Otherwise it used web_search (pause_turn) — append and continue
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "pause_turn":
            # Unexpected stop without record_research — give it one more chance
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

    result = research_location(
        name=doc["name"],
        lat=doc["lat"],
        lng=doc["lng"],
        location_type=doc.get("location_type", "named"),
    )

    locations.update_one(
        {"_id": oid},
        {"$set": {"research": result, "research_status": "done"}},
    )

    return result
