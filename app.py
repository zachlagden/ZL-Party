"""
(c) 2024 Zachariah Michael Lagden (All Rights Reserved)
You may not use, copy, distribute, modify, or sell this code without the express permission of the author.

This is the main application file for the AR15 website. It contains the main application logic and configuration.
"""

# Import the required modules

# Third Party Modules
from werkzeug.middleware.proxy_fix import ProxyFix
from datetime import datetime

# Flask Modules
from flask import Flask, session, redirect, url_for, flash

# Flask Extensions
from flask_minify import Minify
from flask_session import Session

# MongoDB
from db import get_mongo_client, users_cl

# Endpoints
from endpoints import main_endpoints, admin_endpoints, api_endpoints

# Configuration
from config import CONFIG

# Create the Flask app and load extentions

# Flask App
app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1, x_port=1)

# Configurations

# Flask Session Config / Cookie
app.config["SESSION_COOKIE_NAME"] = CONFIG["flask_session"]["cookie_name"]
app.config["SESSION_COOKIE_SECURE"] = CONFIG["flask_session"]["cookie_secure"]
app.config["SESSION_COOKIE_HTTPONLY"] = CONFIG["flask_session"]["cookie_httponly"]
app.config["SESSION_COOKIE_SAMESITE"] = CONFIG["flask_session"]["cookie_samesite"]

# Flask Session Config / MongoDB
client = get_mongo_client()
app.config["SESSION_TYPE"] = "mongodb"
app.config["SESSION_MONGODB"] = client
app.config["SESSION_MONGODB_DB"] = CONFIG["mongodb"]["db"]
app.config["SESSION_MONGODB_COLLECTION"] = CONFIG["mongodb"]["collection"]

# Extensions
Session(app)
Minify(app)


# Pass the config to the templates
@app.context_processor
def inject_global_variable():
    global CONFIG
    return dict(CONFIG=CONFIG)


# Ensuring session exists


@app.before_request
def before_request_func():
    if "sid" in session:
        query = users_cl.find_one({"sessions.sid": session["sid"]})

        if not query:
            session.clear()
            flash("Session Expired", "error")
            return redirect(url_for("main._index"))


# Custom Error Handlers


@app.errorhandler(404)
def page_not_found(e):
    return "The page you are looking for does not exist.", 404


# Template Filters


@app.template_filter("format_date")
def format_date(timestamp: int):
    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime("%Y-%m-%d %H:%M:%S")


# Register the all the blueprints

app.register_blueprint(main_endpoints.blueprint)
app.register_blueprint(admin_endpoints.blueprint)
app.register_blueprint(api_endpoints.blueprint)

# Run the built-in development server when ran as a script.
if __name__ == "__main__":
    app.run(
        debug=True,
        port=44333,
    )
