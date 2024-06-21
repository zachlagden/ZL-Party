"""
(c) 2024 Zachariah Michael Lagden (All Rights Reserved)
You may not use, copy, distribute, modify, or sell this code without the express permission of the author.

This is the database file for the AR15 website. It contains the database connection logic.
"""

# Import the required modules

# Python Standard Library
import json

# Third Party Modules
from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

# Import config from file
with open("config.json", "r") as file:
    CONFIG = json.load(file)

client = MongoClient(CONFIG["mongodb"]["uri"], server_api=ServerApi("1"))

backend_db = client["backend"]

users_cl = backend_db["users"]


def get_mongo_client():
    return client
