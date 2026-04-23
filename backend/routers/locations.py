from datetime import datetime, timezone
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from db import locations

router = APIRouter(prefix="/api/locations")


class LocationIn(BaseModel):
    name: str
    lat: float
    lng: float
    created_by: str
    map_id: str
    location_type: str = "named"
    geocode_context: dict | None = None


def serialize(doc) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
def list_locations(map_id: str = Query(...)):
    return [serialize(doc) for doc in locations.find({"map_id": map_id})]


@router.delete("/{location_id}", status_code=204)
def delete_location(location_id: str):
    try:
        oid = ObjectId(location_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid location id")
    result = locations.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")


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
