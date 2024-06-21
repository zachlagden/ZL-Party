"""
(c) 2024 Zachariah Michael Lagden (All Rights Reserved)
You may not use, copy, distribute, modify, or sell this code without the express permission of the author.

This is the admin_endpoints.py file, it contains the admin routes for the application.
"""

# Import the required modules

# Python Standard Library
from functools import wraps
import json
import os

# Flask Modules
from flask import (
    Blueprint,
    redirect,
    render_template,
    session,
    url_for,
    flash,
)

# Local Helper Modules
from db import users_cl

# Import config from file
with open("config.json", "r") as file:
    CONFIG = json.load(file)

UPLOAD_FOLDER = "static/profiles"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}

# Create a Blueprint for admin routes
blueprint = Blueprint("admin", __name__, url_prefix="/admin")

# Ensure the upload folder exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)


# Pass the config to the templates
@blueprint.context_processor
def inject_global_variable():
    global CONFIG
    return dict(CONFIG=CONFIG)


# Admin required decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "sid" not in session:
            flash("You need to be logged in to access this page.", "error")
            return redirect(url_for("main._login"))

        query = users_cl.find_one({"sessions.sid": session["sid"]})

        if not query:
            flash("Logged in user not found.", "error")
            return redirect(url_for("main._login"))

        if not query.get("admin", False) and not query.get("superuser", False):
            flash("You need to be an admin to access this page.", "error")
            return redirect(url_for("main._index"))

        return f(*args, **kwargs)

    return decorated_function


# Route Endpoints


@blueprint.route("/")
@admin_required
def _index():
    return render_template("admin/index.html")


@blueprint.route("/vouchers")
@admin_required
def _drinks():
    return render_template("admin/vouchers.html")


@blueprint.route("/users")
@admin_required
def _users():
    return render_template("admin/users.html")


@blueprint.route("/drinks/scan")
@admin_required
def _scan_drinks():
    return render_template("admin/scan_drinks.html")


@blueprint.route("/suggestions")
@admin_required
def _suggestions():
    return render_template("admin/suggestions.html")
