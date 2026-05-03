#!/usr/bin/env python3

import requests
import json
import os
import math
from collections import defaultdict
from datetime import datetime, timezone


# --- Configuration ---
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
DATA_PATH = "../data/signals.json"
ANGLE_TOLERANCE = 45.0

QUERY = """
[out:json][timeout:120];
area["ISO3166-1"="CZ"]->.cz;
node(area.cz)["railway"="signal"]->.signals;
way(bn.signals)["railway"]->.ways;
(
    .signals;
    .ways;
    node(w.ways);
);
out meta;
"""


# --- Geometry Helpers ---

def calculate_bearing(pos1: tuple[float, float], pos2: tuple[float, float]) -> float:
    """Calculates the bearing between two points in degrees."""
    lat1, lon1 = pos1
    lat2, lon2 = pos2

    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - \
        math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)

    return (math.degrees(math.atan2(y, x)) + 360) % 360


def max_angular_difference(angles: list[float]) -> float:
    """Finds the maximum shortest-path difference between any two angles."""
    if not angles or len(angles) < 2:
        return 0

    max_diff = 0
    for i in range(len(angles)):
        for j in range(i + 1, len(angles)):
            diff = abs(angles[i] - angles[j])
            diff = diff if diff <= 180 else 360 - diff
            if diff > max_diff:
                max_diff = diff

    return max_diff


def average_azimuth(angles: list[float], *, angle_tolerance: float) -> float | None:
    """Returns the circular mean of angles, or None if empty or vastly different."""
    if not angles or len(angles) == 0:
        return None

    if max_angular_difference(angles) > angle_tolerance:
        return None

    sin_sum = sum(math.sin(math.radians(a)) for a in angles)
    cos_sum = sum(math.cos(math.radians(a)) for a in angles)
    return (math.degrees(math.atan2(sin_sum, cos_sum)) + 360) % 360


# --- Data Processing Pipeline ---

def parse_osm_elements(elements):
    """Sorts raw OSM elements into lookup dictionaries and way lists."""
    node_positions = {}
    signal_nodes = {}
    railway_ways = []

    for el in elements:
        if el["type"] == "node":
            node_positions[el["id"]] = (el["lat"], el["lon"])
            if el.get("tags", {}).get("railway") == "signal":
                signal_nodes[el["id"]] = el
        elif el["type"] == "way":
            railway_ways.append(el)

    return node_positions, signal_nodes, railway_ways


def gather_signal_azimuths(node_positions, signal_nodes, railway_ways):
    """Traverses ways to calculate tangent azimuths for watched nodes."""
    azimuths = defaultdict(list)

    for way in railway_ways:
        way_nodes = way.get("nodes", [])
        for i, node_id in enumerate(way_nodes):
            if node_id in signal_nodes:
                node_position = node_positions[node_id]

                # Vector from previous node to signal
                if i > 0:
                    prev_position = node_positions[way_nodes[i - 1]]
                    azimuths[node_id].append(calculate_bearing(prev_position, node_position))

                # Vector from signal to next node
                if i < len(way_nodes) - 1:
                    next_position = node_positions[way_nodes[i + 1]]
                    azimuths[node_id].append(calculate_bearing(node_position, next_position))

    return azimuths


def format_signal_output(signal_nodes, azimuths, *, angle_tolerance):
    """Compiles the final JSON payload with calculated averages."""
    processed_signals = []

    for node_id, el in signal_nodes.items():
        node_azimuths = azimuths.get(node_id, [])
        final_azm = average_azimuth(node_azimuths, angle_tolerance=angle_tolerance)

        processed_signals.append({
            "osm": {
                "id": node_id,
                "ver": el.get("version", 1)
            },
            "pos": {
                "lat": el["lat"],
                "lon": el["lon"],
                "azm": final_azm
            },
            "tags": el.get("tags", {})
        })

    return processed_signals


def process_data(raw_data, fetch_time, *, angle_tolerance):
    """Orchestrates the transformation from raw OSM JSON to the final schema."""
    elements = raw_data.get("elements", [])
    node_positions, signal_nodes, railway_ways = parse_osm_elements(elements)
    azimuths = gather_signal_azimuths(node_positions, signal_nodes, railway_ways)
    processed_signals = format_signal_output(signal_nodes, azimuths, angle_tolerance=angle_tolerance)

    return {
        "meta": {
            "fetch_time": fetch_time,
            "data_time": raw_data.get("osm3s", {}).get("timestamp_osm_base"),
        },
        "data": processed_signals
    }


# --- IO and Orchestration ---

def download_data(*, overpass_url, query):
    r = requests.post(
        overpass_url,
        data={"data": query},
        headers={"User-Agent": "railway-signal-validator/1.0"}
    )
    r.raise_for_status()
    return r.json()


def save_data(data, *, data_path):
    os.makedirs(os.path.dirname(data_path), exist_ok=True)
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)




def run(*, overpass_url=OVERPASS_URL, query=QUERY, angle_tolerance=ANGLE_TOLERANCE, data_path=DATA_PATH):
    fetch_time = datetime.now(timezone.utc).isoformat()
    raw_data = download_data(overpass_url=overpass_url, query=query)
    final_data = process_data(raw_data, fetch_time, angle_tolerance=angle_tolerance)
    save_data(final_data, data_path=data_path)
    return len(final_data['data'])


def main():
    try:
        print("Downloading data...")
        signal_count = run()
        print(f"Success! Saved {signal_count} signals to {DATA_PATH}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()