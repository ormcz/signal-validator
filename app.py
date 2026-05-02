#!/usr/bin/env python3

from flask import Flask, send_from_directory, jsonify
import json
import os
from downloader import run, DATA_PATH

app = Flask(__name__, static_folder="static")

@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/data")
def data():
    if not os.path.exists(DATA_PATH):
        return jsonify({"error": "no data"}), 404

    with open(DATA_PATH) as f:
        return jsonify(json.load(f))

@app.route("/api/redownload", methods=["POST"])
def redownload():
    count = run()
    return jsonify({
        "status": "ok",
        "downloaded": count
    })


if __name__ == "__main__":
    app.run(port=8090, debug=True)
