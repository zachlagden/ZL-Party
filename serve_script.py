from waitress import serve
from app import app

serve(app, host="0.0.0.0", port=44333, threads=100)
