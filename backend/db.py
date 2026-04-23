import os
from pymongo import MongoClient

uri = os.environ.get("MONGODB_URI")
if not uri:
    raise RuntimeError("MONGODB_URI environment variable is not set")

client = MongoClient(uri)
db = client["GlobeScour"]
locations = db["locations"]
maps = db["maps"]
