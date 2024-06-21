"""
(c) 2024 Zachariah Michael Lagden (All Rights Reserved)
You may not use, copy, distribute, modify, or sell this code without the express permission of the author.

This is the main endpoints file for the website. It contains the main endpoints for the website and their
associated logic.
"""

# Import the required modules

# Python Standard Library
import json

# Third Party Modules
from werkzeug.security import check_password_hash
from spotipy.oauth2 import SpotifyClientCredentials
import spotipy

# Flask Modules
from flask import (
    Blueprint,
    flash,
    redirect,
    render_template,
    send_from_directory,
    session,
    url_for,
    jsonify,
)

# Local Helper Modules
from db import users_cl

# Import config from file
with open("config.json", "r") as file:
    CONFIG = json.load(file)

# Create a Blueprint for main routes
blueprint = Blueprint("main", __name__, url_prefix="/")

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


# Route Endpoints


@blueprint.route("/")
def _index():
    if "sid" not in session:
        return render_template("login.html")

    return render_template("index.html")


@blueprint.route("/static/profiles/<string:filename>")
def _profile_image(filename):
    if "sid" not in session:
        return jsonify(
            {"ok": False, "error": "You must be logged in to view this page."}
        )

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        return jsonify({"ok": False, "error": "Session does not found."})

    if not query.get("admin", False) and not query.get("superuser", False):
        return jsonify(
            {"ok": False, "error": "You need to be an admin to access this page."}
        )

    return send_from_directory("static/profiles", filename)


@blueprint.route("/drinks")
def _drinks():
    if "sid" not in session:
        flash("You must be logged in to view this page.", "error")
        return redirect(url_for("main._index"))

    return render_template(
        "drinks.html",
    )


@blueprint.route("/suggestions")
def _suggestions():
    if "sid" not in session:
        flash("You must be logged in to view this page.", "error")
        redirect(url_for("main._index"))

    return render_template("suggestions.html")


@blueprint.route("/logout")
def _logout():
    if "sid" not in session:
        flash("You are not logged in.", "error")
        return redirect(url_for("main._index"))

    session_id = session["sid"]

    query = users_cl.find_one({"sessions.sid": session_id})

    if not query:
        flash("Session does not exist.", "error")
        return redirect(url_for("main._index"))

    users_cl.update_one(
        {"sessions.sid": session_id},
        {"$pull": {"sessions": {"sid": session_id}}},
    )

    session.clear()

    flash("You have been logged out.", "success")
    return redirect(url_for("main._index"))
