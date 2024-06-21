"""
(c) 2024 Zachariah Michael Lagden (All Rights Reserved)
You may not use, copy, distribute, modify, or sell this code without the express permission of the author.

This is the api endpoints file for the website. It contains the api endpoints for the website.
"""

# Import the required modules

# Python Standard Library
import json
import os
import random
import string
import subprocess
import uuid

# Third Party Modules
from datetime import datetime
from spotipy.oauth2 import SpotifyClientCredentials
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
import pytz
import spotipy
import zipfile

# Flask Modules
from flask import (
    Blueprint,
    jsonify,
    request,
    send_file,
    session,
)

# Local Helper Modules
from db import users_cl

# Import config from file
with open("config.json", "r") as file:
    CONFIG = json.load(file)

# Create a Blueprint for main routes
blueprint = Blueprint("api", __name__, url_prefix="/api")

# Spotify API
sp = spotipy.Spotify(
    auth_manager=SpotifyClientCredentials(
        client_id=CONFIG["spotify"]["client_id"],
        client_secret=CONFIG["spotify"]["client_secret"],
    )
)


# Pass the config to the templates
@blueprint.context_processor
def inject_global_variable():
    global CONFIG
    return dict(CONFIG=CONFIG)


# Helpers


def get_uk_timestamp():
    # Define the time zone for London
    london_tz = pytz.timezone("Europe/London")

    # Get the current time in UTC
    utc_now = datetime.utcnow().replace(tzinfo=pytz.utc)

    # Convert UTC time to London time
    london_now = utc_now.astimezone(london_tz)

    # Return the Unix timestamp
    return int(london_now.timestamp())


# Return Helpers


def ok(data: dict):
    data["ok"] = True
    return jsonify(data)


def error(message: str, code: int, **kwargs):
    response = {"ok": False, "error": message}

    for key, value in kwargs.items():
        response[key] = value

    return jsonify(response), code


# Route Endpoints


@blueprint.route("/")
def _index():
    return ok({"message": "Hello World!"})


@blueprint.route("/login", methods=["POST"])
def _login():
    # Check if the user is already logged in
    if "sid" in session:
        return error("You are already logged in.", 400)

    # Get the request body
    reqbody = request.json

    # Check if the body is provided
    if not reqbody:
        return error("No body provided.", 400)

    # Check if the username is provided
    if (
        "username" not in reqbody
        or not reqbody["username"]
        or reqbody["username"] == ""
    ):
        return error("No username provided.", 400)

    # Check if the user exists
    query = users_cl.find_one({"username": reqbody["username"]})

    # Check if the user exists
    if not query:
        return error("User not found.", 404)

    # Check if the user is an admin
    if query.get("admin", False) or query.get("superuser", False):
        if (
            "password" not in reqbody
            or not reqbody["password"]
            or reqbody["password"] == ""
        ):
            return error("No password provided.", 400, action="provide_password")

        # Check if the user has a password
        if "password" not in query:
            return error(
                "User is an admin but has no password. Please contact the administrator.",
                400,
            )

        # Check if the password is correct
        if not check_password_hash(query["password"], reqbody["password"]):
            return error("Invalid password.", 401)

    # Create a new session
    new_session = {
        "user": query["username"],
        "sid": str(uuid.uuid4()),
        "created_at": get_uk_timestamp(),
    }

    # Check if the user has a sessions field
    if "sessions" not in query:
        users_cl.update_one({"username": query["username"]}, {"$set": {"sessions": []}})

    # Add the new session to the user's sessions
    users_cl.update_one(
        {"username": query["username"]}, {"$push": {"sessions": new_session}}
    )

    # Set the session to expire after 24 hours
    users_cl.create_index("sessions.created_at", expireAfterSeconds=86400)

    # Set the session cookie
    session["sid"] = new_session["sid"]

    # Return the response
    return ok({"message": "Logged in successfully."})


@blueprint.route("/logout")
def _logout():
    # Check if the user is logged in
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        return error("Session not found.", 404)

    # Remove the session from the user's sessions
    users_cl.update_one(
        {"sessions.sid": session_id}, {"$pull": {"sessions": {"sid": session_id}}}
    )

    # Clear the session cookie
    session.clear()

    # Return the response
    return ok({"message": "Logged out successfully."})


@blueprint.route("/whoami")
def _whoami():
    # Check if the user is logged in
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    user_data = query

    # Remove the _id, password, and sessions fields
    user_data.pop("_id", None)
    user_data.pop("password", None)
    user_data.pop("sessions", None)

    if "banned" not in user_data:
        user_data["banned"] = False

    if "admin" not in user_data:
        user_data["admin"] = False

    if "superuser" not in user_data:
        user_data["superuser"] = False

    if "superuser" in user_data and user_data["superuser"]:
        user_data["admin"] = True

    if "suggestions" not in user_data:
        user_data["suggestions"] = []

    if "drinks" not in user_data:
        user_data["drinks"] = []

    return ok(user_data)


"""
Search Endpoints

These endpoints are used to search for tracks on spotify.
"""


@blueprint.route("/search/<string:search>")
def _search(search):
    if not search or search == "":
        return error("No search query provided.", 400)

    if len(search) == 0:
        return error("Search query is empty.", 400)

    if "sid" not in session:
        return error("You are not logged in.", 401)

    query = users_cl.find_one({"sessions.sid": session["sid"]})

    if not query:
        return error("Session not found.", 404)

    results = sp.search(search, limit=30)

    if not results:
        return error("No results found", 404)

    return ok(results)


"""
Download Endpoints

These endpoints are used to download files from spotify.
"""


@blueprint.route("/admin/download/<string:track_id>")
def _download(track_id):
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    if not track_id:
        return error("No track ID provided", 400)

    # Assuming `sp` is an instance of the Spotify client already initialized
    track = sp.track(track_id)

    if not track:
        return error("Track not found", 404)

    # Get the track URL from the track information
    track_url = f"https://open.spotify.com/track/{track_id}"

    artists = [artist["name"] for artist in track["artists"]]
    artists = ", ".join(artists)

    file_path = f"downloads/{artists} - {track['name']}.mp3"

    # Check if the file already exists
    if os.path.exists(file_path):
        return send_file(file_path, as_attachment=True)

    os.chdir("downloads")

    command = "/var/www/apps/party.zachlagden.uk/.venv/bin/spotdl download " + track_url
    print(f"Executing command: {command}")

    # Use subprocess for better control
    result = subprocess.run(
        command, shell=True, check=True, capture_output=True, text=True
    )

    print(f"Command output: {result.stdout}")

    os.chdir("..")

    if "No results found for song" in str(result.stdout):
        print("no results found")
        return error("No results found for song", 404)

    # Return the file
    return send_file(file_path, as_attachment=True)


@blueprint.route("/admin/download_all", methods=["POST"])
def _download_all():
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    body = request.json
    if not body:
        return error("No body provided", 400)

    if "tracks" not in body:
        return error("No tracks provided", 400)

    tracks = body["tracks"]

    if not tracks:
        return error("No tracks provided, or tracks is empty", 400)

    all_tracks = []

    already_downloaded = []

    for track_id in tracks:
        track = sp.track(track_id)

        if not track:
            return error("Track not found", 404)

        track_url = f"https://open.spotify.com/track/{track_id}"

        artists = [artist["name"] for artist in track["artists"]]
        artists = ", ".join(artists)
        file_path = f"downloads/{artists} - {track['name']}.mp3"

        # Check if the file already exists
        if os.path.exists(file_path):
            already_downloaded.append({"track": track, "url": track_url})
            continue

        all_tracks.append({"track": track, "url": track_url})

    cmd = f"/var/www/apps/party.zachlagden.uk/.venv/bin/spotdl download {' '.join([track['url'] for track in all_tracks])}"

    if len(all_tracks) > 0:
        os.chdir("downloads")
        os.system(cmd)
        os.chdir("..")

    all_tracks.extend(already_downloaded)

    file_paths = []
    for track in all_tracks:
        artists = [artist["name"] for artist in track["track"]["artists"]]
        artists = ", ".join(artists)

        file_path = f"downloads/{artists} - {track['track']['name']}.mp3"
        file_paths.append(file_path)

    random_string = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
    zip_path = f"zipcache/all_tracks_{random_string}.zip"

    # check if the zipcache directory exists
    if not os.path.exists("zipcache"):
        os.makedirs("zipcache")

    # Check if the zip json file exists
    if not os.path.exists("zipcache/zips.json"):
        with open("zipcache/zips.json", "w+") as f:
            f.write("[]")

    with open("zipcache/zips.json", "r") as f:
        zips = json.load(f)

    # make a list with all the track ids
    this_zip_log = [track["track"]["id"] for track in all_tracks]

    for zip_log in zips:
        for track_id in this_zip_log:
            if track_id in zip_log:
                return send_file(zip_log["zip_path"], as_attachment=True)

    zips.append({"zip_path": zip_path, "tracks": this_zip_log})

    with open("zipcache/zips.json", "w") as f:
        json.dump(zips, f)

    # Zip the files
    with zipfile.ZipFile(zip_path, "w") as zipf:
        for file_path in file_paths:
            # Check if the file exists
            if not os.path.exists(file_path):
                continue

            zipf.write(file_path)

    # Return the zip file
    return send_file(zip_path, as_attachment=True)


"""
Suggestion Endpoints

These endpoints are used to manage suggestions.
"""


@blueprint.route("/suggest", methods=["POST"])
def _suggest():
    """
    Suggest a song.
    """

    if "sid" not in session:
        return error("You must be logged in to suggest a song.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    reqbody = request.json

    if not reqbody:
        return error("No body provided.", 400)

    spotify_url = reqbody.get("spotifyLink", None)

    # Check if the URL is a valid Spotify URL
    if not spotify_url:
        return error("No Spotify URL provided.", 400)

    if "open.spotify.com/track/" not in spotify_url:
        return error("Invalid Spotify URL.", 400)

    # Check the url with the Spotify API
    try:
        track = sp.track(spotify_url)

        if not track:
            return error("Track not found.", 404)
    except Exception as e:
        return error("Track not found.", 404)

    if "suggestions" not in query:
        users_cl.update_one(
            {"sessions.sid": session_id},
            {"$set": {"suggestions": []}},
        )

        suggestions = []
    else:
        suggestions = query["suggestions"]

    # Check if the song has already been suggested
    for suggestion in suggestions:
        if suggestion["track_id"] == track["id"]:
            return error("You have already suggested this song.", 400)

    new_suggestion = {
        "track_id": track["id"],
        "track_name": track["name"],
        "track_artists": [artist["name"] for artist in track["artists"]],
        "track_url": spotify_url,
        "suggested_at": datetime.now().timestamp(),
    }

    users_cl.update_one(
        {"sessions.sid": session_id},
        {"$push": {"suggestions": new_suggestion}},
    )

    return ok(
        {
            "message": f"`{new_suggestion['track_name'].capitalize()}` has been suggested."
        }
    )


@blueprint.route("/suggestion/<track_id>", methods=["DELETE"])
def delete_suggestion(track_id):
    if "sid" not in session:
        return error("You must be logged in to delete a suggestion.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if "suggestions" not in query:
        return error("No suggestions found.", 404)

    # Check if the suggestion exists
    suggestion_exists = False
    for suggestion in query["suggestions"]:
        if suggestion["track_id"] == track_id:
            suggestion_exists = True
            break

    if not suggestion_exists:
        return error("Suggestion not found.", 404)

    users_cl.update_one(
        {"sessions.sid": session_id},
        {"$pull": {"suggestions": {"track_id": track_id}}},
    )

    return ok({"message": "Suggestion deleted."})


"""
Admin Endpoints

These endpoints are used for the admin panel.
"""


@blueprint.route("/admin/suggestions")
def get_suggestions():
    if "sid" not in session:
        return error("You must be logged in to view this page.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    all_users = users_cl.find({})

    all_suggestions = []
    user_suggestions = {}
    track_popularity = {}

    for user in all_users:
        if "suggestions" in user:
            this_user_suggestions = user["suggestions"]

            for suggestion in this_user_suggestions:
                suggestion["suggested_by"] = user["username"]
                track_id = suggestion["track_id"]

                # Calculate popularity
                if track_id in track_popularity:
                    track_popularity[track_id] += 1
                else:
                    track_popularity[track_id] = 1

                all_suggestions.append(suggestion)

            user_suggestions[user["username"]] = user["suggestions"]

    # Add popularity to each suggestion
    for suggestion in all_suggestions:
        track_id = suggestion["track_id"]
        suggestion["popularity"] = track_popularity[track_id]

    return ok(
        {
            "info": {"total_suggestions": len(all_suggestions)},
            "suggestions": all_suggestions,
            "user_suggestions": user_suggestions,
        }
    )


"""
Voucher Management Endpoints

These endpoints are used to manage vouchers.
"""


@blueprint.route("/admin/create_voucher", methods=["POST"])
def create_voucher():
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    data = request.get_json()
    username = data.get("username")

    if not username:
        return error("No username provided.", 400)

    user = users_cl.find_one({"username": username})
    if not user:
        return error("User not found.", 404)

    new_voucher = {"uuid": str(uuid.uuid4()), "used": False}

    if "drinks" not in user:
        user["drinks"] = []

    user["drinks"].append(new_voucher)
    users_cl.update_one({"username": username}, {"$set": {"drinks": user["drinks"]}})

    return ok({"success": "Voucher created successfully.", "uuid": new_voucher["uuid"]})


@blueprint.route("/admin/delete_voucher/<uuid>", methods=["DELETE"])
def delete_voucher(uuid):
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    users_cl.update_many({}, {"$pull": {"drinks": {"uuid": uuid}}})
    return ok({"success": "Voucher deleted."})


@blueprint.route("/admin/vouchers/status/<uuid>/use", methods=["PATCH"])
def use_voucher(uuid):
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    user = users_cl.find_one({"drinks.uuid": uuid})

    if not user:
        return error("Voucher not found.", 404)

    for drink in user["drinks"]:
        if drink["uuid"] == uuid:
            if drink["used"]:
                return error("Voucher already used.", 400)

    users_cl.update_one(
        {"_id": user["_id"], "drinks.uuid": uuid}, {"$set": {"drinks.$.used": True}}
    )
    return ok({"success": "Voucher marked as used."})


@blueprint.route("/admin/vouchers/status/<uuid>/unuse", methods=["PATCH"])
def unuse_voucher(uuid):
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    user = users_cl.find_one({"drinks.uuid": uuid})

    if not user:
        return error("Voucher not found.", 404)

    for drink in user["drinks"]:
        if drink["uuid"] == uuid:
            if not drink["used"]:
                return error("Voucher already unused.", 400)

    users_cl.update_one(
        {"_id": user["_id"], "drinks.uuid": uuid}, {"$set": {"drinks.$.used": False}}
    )
    return ok({"success": "Voucher marked as unused."})


@blueprint.route("/admin/users")
def get_users():
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    all_users = users_cl.find({})

    user_data = []

    for user in all_users:
        if not query.get("superuser", False):
            if user.get("superuser", False):
                continue

        user.pop("_id", None)
        user.pop("sessions", None)
        user_data.append(user)

    return ok({"users": user_data})


@blueprint.route("/admin/users", methods=["POST"])
def _add_user():
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    data = request.get_json()
    username = data.get("username").strip().replace(" ", "")
    admin = data.get("admin", False)
    password = data.get("password", "").strip().replace(" ", "")

    if not username:
        return error("No username provided.", 400)

    existing_user = users_cl.find_one({"username": username})
    if existing_user:
        return error("User already exists.", 400)

    new_user = {
        "username": username.strip().lower(),
        "admin": admin,
        "suggestions": [],
    }

    if password and password != "":
        new_user["password"] = password.strip()
        new_user["password"] = generate_password_hash(new_user["password"])

    users_cl.insert_one(new_user)
    return ok({"success": "User added successfully."})


@blueprint.route("/admin/users/<username>", methods=["DELETE"])
def _delete_user(username):
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    user = users_cl.find_one({"username": username})

    if not user:
        return error("User not found.", 404)

    if user.get("superuser", False):
        return error("Cannot delete superuser.", 400)

    # Delete profile picture if exists
    if "pfp" in user and user["pfp"]:
        pfp_path = os.path.join("static/profiles", user["pfp"])
        if os.path.exists(pfp_path):
            os.remove(pfp_path)

    users_cl.delete_one({"username": username})
    return ok({"success": "User deleted successfully."})


@blueprint.route("/admin/users/<username>/admin", methods=["PATCH"])
def _toggle_admin(username):
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    data = request.get_json()
    admin = data.get("admin", False)

    user = users_cl.find_one({"username": username})

    if not user:
        return error("User not found.", 404)

    if admin:
        if "password" not in user or (not user["password"] or user["password"] == ""):
            return error("To grant admin rights, user must have a password.", 400)

    if user.get("superuser", False):
        return error("Cannot change admin rights for superuser.", 400)

    users_cl.update_one({"username": username}, {"$set": {"admin": admin}})
    return ok(
        {
            "success": f"User {'granted' if admin else 'revoked'} admin rights successfully."
        }
    )


@blueprint.route("/admin/users/<username>/ban", methods=["PATCH"])
def _ban_user(username):
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    data = request.get_json()
    ban = data.get("ban", False)

    user = users_cl.find_one({"username": username})

    if not user:
        return error("User not found.", 404)

    if not query.get("superuser", False):
        if user.get("admin", False) or user.get("superuser", False):
            return error("Cannot ban admin.", 400)

    users_cl.update_one({"username": username}, {"$set": {"banned": ban}})
    return ok({"success": f"User {'banned' if ban else 'unbanned'} successfully."})


@blueprint.route("/admin/users/<username>/password", methods=["PATCH"])
def _change_password(username):
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    data = request.get_json()
    password = data.get("password", None)

    user = users_cl.find_one({"username": username})
    if not user:
        return error("User not found.", 404)

    if user.get("superuser", False):
        return error("Cannot change password for superuser.", 400)

    if not password:
        if user.get("admin", False):
            return error("User is an admin. Please provide a password.", 400)

        if "password" not in user:
            return error("User has no password to remove.", 400)

        users_cl.update_one({"username": username}, {"$unset": {"password": ""}})
        return ok({"success": "Password removed successfully."})

    else:
        password = generate_password_hash(password)

        users_cl.update_one({"username": username}, {"$set": {"password": password}})
        return ok({"success": "Password changed successfully."})


@blueprint.route("/admin/users/<username>/pfp", methods=["POST"])
def _set_pfp(username):
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    if "file" not in request.files:
        return error("No file provided.", 400)

    file = request.files["file"]
    if file.filename == "":
        return error("No file selected.", 400)

    if file and allowed_file(file.filename):
        user = users_cl.find_one({"username": username})
        if not user:
            return error("User not found.", 404)

        filename = secure_filename(
            f"{username}.{file.filename.rsplit('.', 1)[1].lower()}"  # type: ignore
        )

        with open(os.path.join("static/profiles", filename), "wb") as f:
            f.write(file.read())

        users_cl.update_one({"username": username}, {"$set": {"pfp": filename}})
        return ok({"message": "Profile picture updated successfully."})
    else:
        return error("Invalid file type. Only PNG, JPG, JPEG are allowed.", 400)


@blueprint.route("/admin/users/<username>/pfp", methods=["DELETE"])
def _remove_pfp(username):
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    user = users_cl.find_one({"username": username})

    if not user:
        return error("User not found.", 404)

    if "pfp" not in user or not user["pfp"]:
        return error("User has no profile picture.", 400)

    pfp_path = os.path.join("static/profiles", user["pfp"])
    if os.path.exists(pfp_path):
        os.remove(pfp_path)

    users_cl.update_one({"username": username}, {"$unset": {"pfp": ""}})
    return ok({"message": "Profile picture removed successfully."})


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in {
        "png",
        "jpg",
        "jpeg",
    }


@blueprint.route("/admin/drinks/validate", methods=["POST"])
def _validate_drink():
    if "sid" not in session:
        return error("You are not logged in.", 401)

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        session.clear()
        return error("Session not found, deauthenticating.", 401)

    if not query.get("admin", False) and not query.get("superuser", False):
        return error("You are not an admin.", 401)

    data = request.get_json()
    uuid = data.get("uuid")

    user = users_cl.find_one({"drinks.uuid": uuid})

    if not user:
        return error("Voucher not found.", 404, status="invalid")

    for drink in user["drinks"]:
        if drink["uuid"] == uuid:
            if drink.get("used", False):
                return jsonify(
                    {
                        "status": "already used",
                        "user": {
                            "username": user["username"],
                            "pfp": user.get("pfp", ""),
                        },
                    }
                )
            else:
                return jsonify(
                    {
                        "status": "okay",
                        "user": {
                            "username": user["username"],
                            "pfp": user.get("pfp", ""),
                        },
                    }
                )

    return error("Voucher not found.", 404, status="invalid")
