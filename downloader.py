#!/usr/bin/env python3

import requests
import json
import os

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

QUERY = """
[out:json][timeout:120];
area["ISO3166-1"="CZ"]->.cz;
node(area.cz)["railway"="signal"];
out body meta;
"""

DATA_PATH = "data/signals.json"


def download():
    r = requests.post(
        OVERPASS_URL,
        data={"data": QUERY},
        headers={"User-Agent": "railway-signal-validator/1.0"}
    )
    r.raise_for_status()
    return r.json()


def normalize(raw):
    features = []

    for el in raw.get("elements", []):
        if el.get("type") != "node":
            continue

        # IMPORTANT: keep full metadata for later OSM export
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [el["lon"], el["lat"]]
            },
            "properties": {
                "id": el["id"],
                "lat": el["lat"],          # 🔴 REQUIRED for Level0/JOSM export
                "lon": el["lon"],          # 🔴 REQUIRED for Level0/JOSM export
                "version": el.get("version", 1),  # may be missing in Overpass fallback
                "tags": el.get("tags", {})
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }


def save(data):
    os.makedirs("data", exist_ok=True)

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def run_download():
    raw = download()
    geojson = normalize(raw)
    save(geojson)
    return len(geojson["features"])


if __name__ == "__main__":
    print("Downloading...")
    count = run_download()
    print(f"Saved {count} signals")
