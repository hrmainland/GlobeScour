import os
import time
import json
import urllib.parse
import urllib.request
from fastapi import APIRouter
from pydantic import BaseModel
import anthropic

router = APIRouter(prefix="/api")

DEFAULT_CRITERIA = ["Waves", "Crowds", "Accessibility", "Accommodation", "Vibe"]


class DiscoverRequest(BaseModel):
    mode: str  # "regions" | "spots"
    region: str = ""
    instructions: str = ""
    criteria: list[str] = []
    vision: str = ""


def _nominatim_resolve(name: str, country: str) -> dict | None:
    # Claude sometimes stuffs the full admin path into name (e.g. "Barra de la Cruz, Oaxaca, Mexico").
    # Use only the first term as the search query; remaining terms are used to validate the result.
    parts = [p.strip() for p in name.split(",")]
    primary = parts[0]
    context_hints = [p.lower() for p in parts[1:] if p.strip()]

    query = f"{primary}, {country}" if country else primary
    try:
        url = (
            "https://nominatim.openstreetmap.org/search"
            f"?q={urllib.parse.quote(query)}&format=json&limit=5&addressdetails=1"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "GlobeScour/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        print(f"[discover] nominatim returned {len(data)} result(s) for {query!r}")
        if not data:
            return None

        # Pick the first result whose display_name matches at least one context hint
        match = None
        if context_hints:
            for candidate in data:
                display_lower = candidate["display_name"].lower()
                if any(hint in display_lower for hint in context_hints):
                    match = candidate
                    break
            if not match:
                print(f"[discover] no result matched context {context_hints} for {query!r}")
                return None
        else:
            match = data[0]

        a = match.get("address", {})
        region_text = a.get("state") or a.get("county") or None
        country_text = a.get("country") or None
        ctx = [
            x
            for x in [
                region_text and {"id": "region.0", "text": region_text},
                country_text and {"id": "country.0", "text": country_text},
            ]
            if x
        ]
        return {
            "name": primary,
            "placeName": match["display_name"],
            "lat": float(match["lat"]),
            "lng": float(match["lon"]),
            "context": ctx,
            "isSuggestion": True,
        }
    except Exception as e:
        print(f"[discover] nominatim failed for '{name}': {e}")
        return None


@router.post("/discover")
def discover(body: DiscoverRequest):
    criteria = body.criteria or DEFAULT_CRITERIA
    vision_line = f"\nTrip vision: {body.vision}" if body.vision.strip() else ""
    criteria_list = ", ".join(criteria)
    region_desc = body.region.strip() or "the world"

    system = f"You are a travel researcher.{vision_line} Evaluate against these criteria: {criteria_list}."
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    if body.mode == "regions":
        user_msg = f"Suggest the best regions in {region_desc} that match the criteria."
        if body.instructions.strip():
            user_msg += f"\nAdditional instructions from user, be sure to follow these carefully: {body.instructions.strip()}"

        tool = {
            "name": "record_regions",
            "description": "Record a summary of recommended regions.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "4-8 sentence paragraph about the best regions",
                    }
                },
                "required": ["summary"],
            },
        }

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=system,
            tools=[tool],
            tool_choice={"type": "tool", "name": "record_regions"},
            messages=[{"role": "user", "content": user_msg}],
        )
        record = next(
            (b for b in response.content if getattr(b, "type", None) == "tool_use"),
            None,
        )
        if not record:
            raise RuntimeError("no record_regions call in response")
        return {"mode": "regions", "summary": record.input["summary"]}

    else:  # spots
        user_msg = (
            f"Suggest up to 6 specific spots in {region_desc} that best match the criteria. "
            "Fewer is fine if quality is limited. "
            "Use names specific enough for Nominatim geocoding to find (e.g. include town/village name, not just beach name)."
        )
        if body.instructions.strip():
            user_msg += f"\n{body.instructions.strip()}"

        tool = {
            "name": "record_spots",
            "description": "Record suggested spots.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "spots": {
                        "type": "array",
                        "maxItems": 6,
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "country": {"type": "string"},
                                "why": {
                                    "type": "string",
                                    "description": "1-2 sentence reason this spot matches the criteria",
                                },
                            },
                            "required": ["name", "country", "why"],
                        },
                    }
                },
                "required": ["spots"],
            },
        }

        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1000,
            system=system,
            tools=[tool],
            tool_choice={"type": "tool", "name": "record_spots"},
            messages=[{"role": "user", "content": user_msg}],
        )
        record = next(
            (b for b in response.content if getattr(b, "type", None) == "tool_use"),
            None,
        )
        if not record:
            raise RuntimeError("no record_spots call in response")

        print("[discover] claude spots response:", json.dumps(record.input, indent=2))

        found = []
        not_found = []
        for spot in record.input["spots"]:
            time.sleep(0.5)
            resolved = _nominatim_resolve(spot["name"], spot.get("country", ""))
            if resolved:
                found.append({**resolved, "why": spot["why"]})
            else:
                not_found.append(spot["name"])

        print(f"[discover] {len(found)} found, {len(not_found)} not found")
        return {"mode": "spots", "found": found, "not_found": not_found}
