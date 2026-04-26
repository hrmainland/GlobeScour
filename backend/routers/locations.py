import uuid
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


class LocationUpdate(BaseModel):
    name: str


class NotesUpdate(BaseModel):
    notes: str
    edited_by: str


class UserLinkIn(BaseModel):
    url: str
    title: str
    description: str = ""
    added_by: str = ""


def serialize(doc) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
def list_locations(map_id: str = Query(...)):
    return [serialize(doc) for doc in locations.find({"map_id": map_id})]


@router.get("/{location_id}")
def get_location(location_id: str):
    try:
        oid = ObjectId(location_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid location id")
    doc = locations.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Location not found")
    return serialize(doc)


@router.patch("/{location_id}")
def update_location(location_id: str, body: LocationUpdate):
    try:
        oid = ObjectId(location_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid location id")
    result = locations.update_one({"_id": oid}, {"$set": {"name": body.name}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    doc = locations.find_one({"_id": oid})
    return serialize(doc)


@router.patch("/{location_id}/notes")
def update_notes(location_id: str, body: NotesUpdate):
    try:
        oid = ObjectId(location_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid location id")
    result = locations.update_one(
        {"_id": oid},
        {
            "$set": {
                "notes": body.notes,
                "notes_last_edited_by": body.edited_by,
                "notes_last_edited_at": datetime.now(timezone.utc).isoformat(),
            }
        },
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    doc = locations.find_one({"_id": oid})
    return serialize(doc)


@router.post("/{location_id}/links", status_code=201)
def add_link(location_id: str, body: UserLinkIn):
    try:
        oid = ObjectId(location_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid location id")
    link = {
        "id": str(uuid.uuid4()),
        "url": body.url,
        "title": body.title,
        "description": body.description,
        "added_by": body.added_by,
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    result = locations.update_one({"_id": oid}, {"$push": {"user_links": link}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return link


@router.delete("/{location_id}/links/{link_id}", status_code=204)
def delete_link(location_id: str, link_id: str):
    try:
        oid = ObjectId(location_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid location id")
    locations.update_one({"_id": oid}, {"$pull": {"user_links": {"id": link_id}}})


@router.delete("/{location_id}/research/sources", status_code=204)
def delete_source(location_id: str, url: str = Query(...)):
    try:
        oid = ObjectId(location_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid location id")
    locations.update_one({"_id": oid}, {"$pull": {"research.sources": url}})


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
