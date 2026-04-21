from datetime import datetime, timezone
from fastapi import APIRouter
from pydantic import BaseModel
from db import locations

router = APIRouter(prefix="/api/locations")


class LocationIn(BaseModel):
    name: str
    lat: float
    lng: float
    created_by: str
    location_type: str = "named"  # "named" | "coordinate"


def serialize(doc) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
def list_locations():
    return [serialize(doc) for doc in locations.find()]


@router.post("", status_code=201)
def create_location(body: LocationIn):
    doc = {
        **body.model_dump(),
        "type": "town",
        "research_status": "none",
        "created_at": datetime.now(timezone.utc),
    }
    result = locations.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc
