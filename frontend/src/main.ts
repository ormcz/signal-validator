import L from "leaflet";
import "leaflet/dist/leaflet.css";

import "./style.css";
import {Api} from "./api.ts";
import {ValidationManager} from "./validation.ts";
import {register_all} from "./validators/all_for_now.ts";

// export default {};

/**
 * --------------------------------------------------------------------------
 * 1. GLOBAL CONFIGURATION & STATE
 * --------------------------------------------------------------------------
 */


const api = new Api();
const validator = new ValidationManager();

register_all(validator);


const map = L.map('map', {
    zoomControl: false
}).setView([49.8, 15.5], 7);

const layers = {} as any;

layers["OSM"] = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 23,
        maxNativeZoom: 19,
        attribution: '© OpenStreetMap'
    }
);

// Satellite layer (Esri World Imagery)
layers["Esri"] = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
        maxZoom: 23,
        maxNativeZoom: 19,
        attribution: 'Tiles © Esri'
    }
);

layers["CUZK"] = L.tileLayer.wms(
    "https://ags.cuzk.cz/arcgis1/services/ORTOFOTO/MapServer/WMSServer",
    {
        layers: "0",
        format: "image/jpeg",
        transparent: false,
        attribution: "© ČÚZK",
        maxZoom: 23
    }
);


let currentLayer: any = null;



let layer: any;
let currentData: any = null;

const CATEGORIES = [
    "main", "main_repeated", "distant", "distant_repeated", "minor", "minor_repeated", "minor_distant", "combined", "combined_repeated",
"shunting", "shunting_repeated", "crossing", "crossing_repeated", "crossing_distant", "crossing_info", "crossing_hint",
"electricity", "humping", "humping_repeated", "speed_limit", "speed_limit_distant", "whistle",
"ring", "route", "route_distant", "wrong_road", "stop", "stop_demand",
"station_distant", "radio", "departure", "resetting_switch",
"resetting_switch_distant", "snowplow", "short_route", "brake_test",
"fouling_point", "helper_engine", "train_protection", "steam_locomotive",
"station", "rack", "wheel_cleaning"
];


/**
 * --------------------------------------------------------------------------
 * 3. INITIALIZATION FUNCTIONS
 * --------------------------------------------------------------------------
 */

function initButtons() {
    const downloadBtn = document.getElementById("btn");
    downloadBtn!.onclick = async () => {
        setUIEnabled(false);
        showLoading(true);
        try {
            await api.refresh()
            await loadData();
        } catch (e) {
            console.error("Download failed:", e);
        } finally {
            showLoading(false);
            setUIEnabled(true);
        }
    };

    document.getElementById('zoom-in')!.onclick = () => map.zoomIn();
    document.getElementById('zoom-out')!.onclick = () => map.zoomOut();
}

function initToggle() {
    const container = document.getElementById('layer-switch')!;

    Object.entries(layers).forEach(([name, layer]: [string, any], index) => {
        const btn = document.createElement('div');
        btn.className = 'segment';
        btn.textContent = name;

        // First one = default active
        if (index === 0) {
            btn.classList.add('active');
            currentLayer = layer;
            layer.addTo(map);
        }

        btn.addEventListener('click', () => {
            if (layer === currentLayer) return;

            // Switch layer
            map.removeLayer(currentLayer);
            currentLayer = layer;
            map.addLayer(currentLayer);

            // Update UI
            document.querySelectorAll('.segment').forEach(el => {
                el.classList.remove('active');
            });
            btn.classList.add('active');
        });

        container.appendChild(btn);
    });
}

function initCategories() {
    const container = document.getElementById("error-list")!;
    container.innerHTML = "";

    const helperRow = document.createElement("div");
    helperRow.style.cssText = "display: flex; gap: 5px; margin-bottom: 12px;";
    helperRow.innerHTML = `
    <button id="sel-all" class="action-btn">Select All</button>
    <button id="sel-none" class="action-btn">Clear</button>
    `;
    container.appendChild(helperRow);

    // valid state
    container.appendChild(
        createFilterItem("valid", "Valid signals", true, false)
    );
    container.appendChild(
        createFilterItem("basic", "Undetailed signals", false, false)
    );

    container.appendChild(document.createElement("hr"));

    container.appendChild(
        createFilterItem("warning", "Show otherwise valid signals", true, true)
    );



    validator.getNames().forEach((name, idx) => {
        container.appendChild(
            createFilterItem(idx, name, false, true)
        );
    })

    document.getElementById('sel-all')!.onclick = () => {
        document.querySelectorAll('.filter-check').forEach(cb => (cb as any).checked = true);
        render(currentData);
    };

    document.getElementById('sel-none')!.onclick = () => {
        document.querySelectorAll('.filter-check').forEach(cb => (cb as any).checked = false);
        render(currentData);
    };

    document.querySelectorAll('.filter-check').forEach(el => {
        (el as any).onchange = () => render(currentData);
    });
}

/**
 * --------------------------------------------------------------------------
 * 4. STATE & UI HELPERS
 * --------------------------------------------------------------------------
 */

function setUIEnabled(enabled: boolean) {
    const controls = document.querySelectorAll('#btn, .zoom-btn, .filter-check, .action-btn');
    controls.forEach(el => {
        if (enabled) {
            el.classList.remove('disabled');
            (el as any).style.pointerEvents = 'auto';
        } else {
            el.classList.add('disabled');
            (el as any).style.pointerEvents = 'none';
        }
    });
}

function showLoading(on: boolean) {
    document.getElementById("overlay")!.classList.toggle("active", on);
    document.body.classList.toggle("disabled", on);
}

function createFilterItem(value: any, label: any, isBold: any, checked: any) {
    const item = document.createElement("label");
    item.className = "filter-item";
    if (isBold) item.style.fontWeight = "bold";

    item.innerHTML = `
    <input type="checkbox" class="filter-check" value="${value}" ${checked ? 'checked' : ''}>
    <span style="margin-left: 8px;">${label}</span>
    `;
    return item;
}

/**
 * --------------------------------------------------------------------------
 * 5. VALIDATION
 * --------------------------------------------------------------------------
 */

function render(data: any) {
    if (layer) map.removeLayer(layer);
    if (!data) return;

    const bounds = map.getBounds();

    const activeFilters = new Set(
        Array.from(document.querySelectorAll('.filter-check:checked'))
            .map(cb => validator.getNames()[(cb as any).value] ?? (cb as any).value)
    );

    const zoom = map.getZoom();
    const useBounds = zoom >= 12;

    // 🔥 Filter BEFORE creating GeoJSON
    const visibleFeatures = data.map((item: any) => {
        // Apply error filters
        if (item.errors.length === 0) {
            if (Object.keys(item.tags).every(tag => !tag.includes("railway") || ["railway", "railway:signal:position", "railway:signal:direction", "railway:position", "railway:position:exact"].includes(tag)))
                return { ...item, cat: "basic"};
            else
                return { ...item, cat: "valid"};
        }

        if (item.errors.some((err: any) => activeFilters.has(err.name))) {
            return { ...item, cat: "error" };
        } else {
            return { ...item, cat: "warning" };
        }
    }).filter((item: any) => {
        const latlng = L.latLng(item.pos.lat, item.pos.lon);
        if (useBounds && !bounds.contains(latlng)) return false;

        switch (item.cat) {
            case "basic":
                return activeFilters.has("basic");
            case "valid":
                return activeFilters.has("valid");
            case "warning":
                return activeFilters.has("warning");
            default:
                return true;
        }
    });

    const geoData = {
        type: "FeatureCollection",
        features: visibleFeatures.map((item: any) => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [item.pos.lon, item.pos.lat]
            },
            ...item
        }))
    };

    layer = L.geoJSON(geoData as any, {
        pointToLayer: (f2, latlng) => {
            const f = f2 as any;

            const hasErrors = f.cat == "error";
            const fillColor =
                f.cat == "error" ? "#ff4d4d" :
                    f.cat == "warning" ? "#ffd54d" :
                        f.cat == "valid" ? "#2ecc71" :
                            "#2ea2cc";


            // LOW ZOOM → simple dots
            if (zoom < 16) {
                return L.circleMarker(latlng, {
                    radius: hasErrors ? 7 : 4,
                    fillColor: fillColor,
                    color: "#000",
                    weight: 1,
                    fillOpacity: 0.9
                });
            }


            const r = hasErrors ? 5 : 4;
            const size = r * 4; // Increased container size to ensure the "tail" doesn't clip

            let finalAzimuth = f.pos.azm;
            let isDirectional = false;

            if (finalAzimuth !== null && ["forward", "backward"].includes(f.tags["railway:signal:direction"])) {
                isDirectional = true;
                if (f.tags["railway:signal:direction"] === "backward") {
                    finalAzimuth += 180;
                }
            }

            let svgContent;

            if (isDirectional) {

                /**
                 * SVG Path Breakdown (viewBox 24x24):
                 * Center point is (12, 12).
                 * 1. Move to (2, 12) - Left side of the flat edge.
                 * 2. Arc to (22, 12) - The semicircle (Radius 10).
                 * 3. Line to (22, 17) - Down to form one side of the rectangle (r/2 = 5 units).
                 * 4. Line to (2, 17)  - The bottom flat edge of the rectangle.
                 * 5. Close path back to (2, 12).
                 */
                svgContent = `
                    <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="transform: rotate(${finalAzimuth}deg); transform-origin: center; display: block;">
                        <path 
                            d="M 2 12 
                               A 10 10 0 0 1 22 12 
                               L 22 17 
                               L 2 17 
                               Z" 
                            fill="${fillColor}" 
                            fill-opacity="0.9" 
                            stroke="#000" 
                            stroke-width="2" 
                            stroke-linejoin="round"
                        />
                    </svg>
                `;
            } else {
                // Standard full circle
                svgContent = `
                    <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display: block;">
                        <circle cx="12" cy="12" r="10" fill="${fillColor}" fill-opacity="0.9" stroke="#000" stroke-width="2" />
                    </svg>
                `;
            }

            const marker = L.marker(latlng, {
                icon: L.divIcon({
                    html: svgContent,
                    className: '',
                    iconSize: [size, size],
                    iconAnchor: [size / 2, size / 2]
                })
            });

            return L.layerGroup([marker]);
        },

        onEachFeature: (f2, l) => {
            const f = f2 as any;

            const popupHtml = `
                    <b>ID:</b> ${f.osm.id} 
                    <a href="https://osm.org/node/${f.osm.id}" target="_blank">View</a> 
                    <a href="https://osm.org/edit?node=${f.osm.id}" target="_blank">Edit</a>
                <br>
                    <b>Errors:</b> ${f.errors.length ? f.errors.map((e: any) => e.name).join(", ") : "none"}
                <hr>
                    <div class="popup-tags">${formatTags(f.tags)}</div>
            `;

            // Case 1: single layer (CircleMarker etc.)
            if (l instanceof L.Layer && !(l instanceof L.LayerGroup)) {
                l.bindPopup(popupHtml);
                return;
            }

            // Case 2: group (your azimuth + marker combo)
            if (l instanceof L.LayerGroup) {
                l.eachLayer(subLayer => {
                    if (subLayer instanceof L.CircleMarker || subLayer instanceof L.Marker) {
                        subLayer.bindPopup(popupHtml);
                    }
                });
            }

        }
    }).addTo(map);
}

/**
 * --------------------------------------------------------------------------
 * 7. TAG FORMATTING
 * --------------------------------------------------------------------------
 */

function formatTags(tags: any) {
    const prefix = "railway:signal:";
    const grouped: any = {};
    const ungrouped: any[] = [];

    // --- 1. Group tags ---
    for (const [key, value] of Object.entries(tags)) {
        if (key.startsWith(prefix)) {
            const rest = key.slice(prefix.length);
            const parts = rest.split(":");
            // Check if the base part is one of our categories
            const maybeCategory = parts[0];

            if (CATEGORIES.includes(maybeCategory)) {
                grouped[maybeCategory] ??= { __main: null, sub: [] };
                if (parts.length === 1) {
                    grouped[maybeCategory].__main = value;
                } else {
                    grouped[maybeCategory].sub.push({
                        key: ":" + parts.slice(1).join(":"),
                                                    value: value
                    });
                }
                continue;
            }
        }
        ungrouped.push({ key, value });
    }

    // --- 2. Sort ---
    const sortedCategories = Object.keys(grouped).sort();
    ungrouped.sort((a, b) => a.key.localeCompare(b.key));

    // --- 3. Render ---
    const lines = [];
    const formatValue = (v: any) => String(v).replace(/CZ-D1:/g, `<span class="prefix">CZ-D1:</span>`);

    // Render non-signal tags first
    for (const { key, value } of ungrouped) {
        lines.push(`<b>${key}</b>: ${value}`);
    }

    // Render grouped signal tags
    for (const cat of sortedCategories) {
        const group = grouped[cat];
        lines.push(`<b>${cat}${group.__main ? `: ${formatValue(group.__main)}` : ""}</b>`);

        group.sub
        .sort((a: any, b: any) => a.key.localeCompare(b.key))
        .forEach(({ key, value }: { key: any, value: any }) => {
            lines.push(`&nbsp;&nbsp;<b>${key}</b>: ${formatValue(value)}`);
        });
    }

    return lines.join("<br>");
}

function initRendering() {
    const ZOOM_THRESHOLD = 12;

    let lastZoom = map.getZoom();

    function shouldRerenderOnZoomChange(oldZoom: any, newZoom: any) {
        return oldZoom >= ZOOM_THRESHOLD || newZoom >= ZOOM_THRESHOLD;
    }

    function shouldRenderOnMove() {
        return map.getZoom() >= ZOOM_THRESHOLD;
    }

    map.on('zoomend', () => {
        const newZoom = map.getZoom();

        if (shouldRerenderOnZoomChange(lastZoom, newZoom)) {
            render(currentData);
        }

        lastZoom = newZoom;
    });

    map.on('moveend', () => {
        if (shouldRenderOnMove()) {
            render(currentData);
        }
    });
}


/**
 * --------------------------------------------------------------------------
 * 8. DATA LOADING
 * --------------------------------------------------------------------------
 */

async function loadData() {
    try {
        const raw = await api.load();

        currentData = raw.data.map((item: any) => ({
            ...item,
            errors: validator.validate(item.tags)
        }));

        render(currentData);
    } catch (e) {
        console.error("Data load failed:", e);
    }
}

/**
 * --------------------------------------------------------------------------
 * 9. EXECUTION
 * --------------------------------------------------------------------------
 */
;(async () => {
    initButtons();
    initToggle();
    initCategories();
    initRendering();

    showLoading(true);
    await loadData();
    showLoading(false);

})();

