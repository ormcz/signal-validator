#!/usr/bin/env python3

from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
import json
import os
from downloader import run, DATA_PATH

DIST_DIR = os.path.join(os.path.dirname(__file__), "../frontend/dist")

app = Flask(__name__, static_folder=DIST_DIR, static_url_path="")

@app.route("/")
def index():
    return send_from_directory(DIST_DIR, "index.html")


CORS(app, resources={r"/api/*": {"origins": "*"}})

@app.route("/api/data")
def data():
    if not os.path.exists(DATA_PATH):
        return jsonify({"error": "no data"}), 404

    with open(DATA_PATH) as f:
        return jsonify(json.load(f))

@app.route("/api/refresh", methods=["POST"])
def redownload():
    count = run()
    return jsonify({
        "status": "ok",
        "downloaded": count
    })


if __name__ == "__main__":
    app.run(port=8090, debug=True)