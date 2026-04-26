from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from db import maps

router = APIRouter(prefix="/api/maps")

DEFAULT_CRITERIA = {
    "items": ["Waves", "Crowds", "Accessibility", "Accommodation", "Vibe"],
    "vision": "",
}


class MapIn(BaseModel):
    name: str
    created_by: str


class CriteriaIn(BaseModel):
    items: list[str]
    vision: str = ""


class MemberAdd(BaseModel):
    username: str


def serialize(doc) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.get("")
def list_maps(user: str):
    return [serialize(doc) for doc in maps.find({"$or": [{"created_by": user}, {"members": user}]})]


@router.post("", status_code=201)
def create_map(body: MapIn):
    doc = {
        "name": body.name,
        "created_by": body.created_by,
        "criteria": DEFAULT_CRITERIA,
        "created_at": datetime.now(timezone.utc),
    }
    result = maps.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("/{map_id}")
def get_map(map_id: str):
    try:
        oid = ObjectId(map_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid map id")
    doc = maps.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Map not found")
    return serialize(doc)


@router.post("/{map_id}/members", status_code=200)
def add_member(map_id: str, body: MemberAdd):
    try:
        oid = ObjectId(map_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid map id")
    result = maps.update_one({"_id": oid}, {"$addToSet": {"members": body.username}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Map not found")
    doc = maps.find_one({"_id": oid})
    return serialize(doc)


@router.delete("/{map_id}/members/{username}", status_code=204)
def remove_member(map_id: str, username: str):
    try:
        oid = ObjectId(map_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid map id")
    maps.update_one({"_id": oid}, {"$pull": {"members": username}})


@router.patch("/{map_id}/criteria", status_code=200)
def update_criteria(map_id: str, body: CriteriaIn):
    try:
        oid = ObjectId(map_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid map id")
    result = maps.update_one(
        {"_id": oid},
        {"$set": {"criteria": {"items": body.items, "vision": body.vision}}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Map not found")
    return {"ok": True}
