import "./style.css";
import {Api} from "./api.ts";
import {Map} from "./map.ts";

// export default {};

/**
 * --------------------------------------------------------------------------
 * 1. GLOBAL CONFIGURATION & STATE
 * --------------------------------------------------------------------------
 */


const api = new Api();

const map = new Map("map");

// const map = L.map('map', {
//     zoomControl: false
// }).setView([49.8, 15.5], 7);
//
// const layers = {} as any;
//
// layers["OSM"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     maxZoom: 21,        // allow user to zoom further
//     maxNativeZoom: 19,  // OSM only provides tiles up to 19
//     attribution: '© OpenStreetMap'
// })
//
//
// const customLayer = L.TileLayer.extend({
//     getTileUrl: function(coords: any) {
//         const tileSize = this.getTileSize();
//         const nwPoint = coords.scaleBy(tileSize);
//         const sePoint = nwPoint.add(tileSize);
//
//         const nw = map.options.crs!.project(map.unproject(nwPoint, coords.z));
//         const se = map.options.crs!.project(map.unproject(sePoint, coords.z));
//
//         const bbox = [nw.x, se.y, se.x, nw.y].join(',');
//
//         return `http://127.0.0.1:8082/EPSG:3857/256/256/${bbox}`;
//     }
// });
// layers["ORTOFOTO"] = new (customLayer as any)(null, { maxZoom: 21 });
// let currentLayer: any = null;



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
 * 2. ERROR REGISTRY (SINGLE SOURCE OF TRUTH)
 * --------------------------------------------------------------------------
 */
const ERRORS = {
    unknown_signal_type: "Unknown signal type",

    weird_ref: "Weird signal ref given the category",
    weird_function: "Weird signal function",
    mismatched_function: "Mismatched signal function",
    mismatched_ref: "Ref and Cs-D1:ref mismatched",

    weird_height: "Weird height value",
    weird_states: "Weird signal states",
};

/**
 * --------------------------------------------------------------------------
 * 3. INITIALIZATION FUNCTIONS
 * --------------------------------------------------------------------------
 */

// function initButtons() {
//     const downloadBtn = document.getElementById("btn");
//     downloadBtn!.onclick = async () => {
//         setUIEnabled(false);
//         showLoading(true);
//         try {
//             await api.refresh()
//             await loadData();
//         } catch (e) {
//             console.error("Download failed:", e);
//         } finally {
//             showLoading(false);
//             setUIEnabled(true);
//         }
//     };
//
//     document.getElementById('zoom-in')!.onclick = () => map.zoomIn();
//     document.getElementById('zoom-out')!.onclick = () => map.zoomOut();
// }

// function initToggle() {
//     const container = document.getElementById('layer-switch')!;
//
//     Object.entries(layers).forEach(([name, layer]: [string, any], index) => {
//         const btn = document.createElement('div');
//         btn.className = 'segment';
//         btn.textContent = name;
//
//         // First one = default active
//         if (index === 0) {
//             btn.classList.add('active');
//             currentLayer = layer;
//             layer.addTo(map);
//         }
//
//         btn.addEventListener('click', () => {
//             if (layer === currentLayer) return;
//
//             // Switch layer
//             map.removeLayer(currentLayer);
//             currentLayer = layer;
//             map.addLayer(currentLayer);
//
//             // Update UI
//             document.querySelectorAll('.segment').forEach(el => {
//                 el.classList.remove('active');
//             });
//             btn.classList.add('active');
//         });
//
//         container.appendChild(btn);
//     });
// }

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
        createFilterItem("valid", "Valid signals", true, true)
    );

    container.appendChild(document.createElement("hr"));

    for (const [key, label] of Object.entries(ERRORS)) {
        container.appendChild(
            createFilterItem(key, label, false, false)
        );
    }

    // document.getElementById('sel-all')!.onclick = () => {
    //     document.querySelectorAll('.filter-check').forEach(cb => (cb as any).checked = true);
    //     render(currentData);
    // };
    //
    // document.getElementById('sel-none')!.onclick = () => {
    //     document.querySelectorAll('.filter-check').forEach(cb => (cb as any).checked = false);
    //     render(currentData);
    // };

    // document.querySelectorAll('.filter-check').forEach(el => {
    //     (el as any).onchange = () => render(currentData);
    // });
}

/**
 * --------------------------------------------------------------------------
 * 4. STATE & UI HELPERS
 * --------------------------------------------------------------------------
 */

// function setUIEnabled(enabled: boolean) {
//     const controls = document.querySelectorAll('#btn, .zoom-btn, .filter-check, .action-btn');
//     controls.forEach(el => {
//         if (enabled) {
//             el.classList.remove('disabled');
//             (el as any).style.pointerEvents = 'auto';
//         } else {
//             el.classList.add('disabled');
//             (el as any).style.pointerEvents = 'none';
//         }
//     });
// }

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

const ALLOWED_COMBINATIONS = {
    main: new Set(["CZ-D1:hlavni_navestidlo", "CZ-D1:stuj"]),
    distant: new Set(["CZ-D1:samostatna_predvest", "CZ-D1:tabulka_s_krizem", "CZ-D1:vystraha"]),
    minor: new Set(["CZ-D1:stuj"]),
    minor_distant: new Set(["CZ-D1:vystraha"]),
    combined: new Set(["CZ-D1:hlavni_navestidlo"]),
    shunting: new Set([
        "CZ-D1:seradovaci_navestidlo", "CZ-D1:vyckavaci_navestidlo",
        "CZ-D1:posun_zakazan", "CZ-D1:oznacnik",
        "CZ-D1:hranice_obvodu_nakladiste_nebo_vlecky", "CZ-D1:navestidlo_vykolejky"
    ]),
    crossing: new Set(["CZ-D1:prejezdnik"]),
    crossing_info: new Set(["CZ-D1:kilometricka_poloha_prejezdu"]),
    crossing_hint: new Set(["CZ-D1:stit_op"]),
    humping: new Set(["CZ-D1:spadovistni_navestidlo", "CZ-D1:seradovaci_navestidlo", "CZ-D1:hlavni_navestidlo"]),
    speed_limit: new Set([
        "CZ-D1:rychlostnik", "CZ-D1:hlavni_navestidlo",
        "CZ-D1:rychlostnik_n", "CZ-D1:horni_rychlostnik_n",
        "CZ-D1:rychlostnik_n_s_pruhy", "CZ-D1:rychlostnik_r", "CZ-D1:rychlostnik_ns"
    ]),
    speed_limit_distant: new Set([
        "CZ-D1:predvestnik", "CZ-D1:hlavni_navestidlo", "CZ-D1:samostatna_predvest",
        "CZ-D1:predvestnik_n", "CZ-D1:horni_predvestnik_n",
        "CZ-D1:predvestnik_r", "CZ-D1:predvestnik_ns"
    ]),
    whistle: new Set(["CZ-D1:piskejte"]),
    stop: new Set(["CZ-D1:lichobeznikova_tabulka", "CZ-D1:konec_nastupiste", "CZ-D1:misto_zastaveni"]),
    station_distant: new Set([
        "CZ-D1:vlak_se_blizi_k_zastavce", "CZ-D1:stanoviste_samostatne_predvesti",
        "CZ-D1:stanoviste_posledniho_oddiloveho_navestidla", "CZ-D1:hlavni_navestidlo_slouceno_s_predvesti"
    ]),
    resetting_switch: new Set(["CZ-D1:navestidlo_vyhybky_se_samovratnym_prestavnikem"])
} as any;

const VALIDATORS = {} as any;

VALIDATORS.unknown_signal_type = (tags: any) => {

    for (const category of CATEGORIES) {
        const key = `railway:signal:${category}`;
        const val = tags[key];
        if (!val) continue;

        if (val.startsWith("CZ-D1:")) {
            const allowedSet = ALLOWED_COMBINATIONS[category];
            if (allowedSet && allowedSet.has(val))
                continue;
        }

        if (val.startsWith("Cs-D1:") || val == "Cs-D1" || val == "CZ" || val == "yes" || val == "ETCS:marker")
            continue;

        return true;
    }

    return false;
}

VALIDATORS.weird_ref = (tags: any) => {

    const ref = tags.ref;
    if (!ref) return false;

    if (tags["railway:signal:main"] || tags["railway:signal:main_repeated"] || tags["railway:signal:combined"] || tags["railway:signal:combined_repeated"])
        return !/^(_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]|((_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]c?\s*(_|[0-9]+)?(z?[a-z]|_)?(-[0-9]+(z?[a-z]|_)?)?|[LS][ok]\s*(_|[0-9]+)?|([0-9]+-)?(_|[0-9]+)?)$/.test(ref);

    if (tags["railway:signal:shunting_repeated"] || (tags["railway:signal:shunting"] && tags["railway:signal:shunting:repeated"] == "yes"))
        return ! /^(I?X|VI{0,3}|I?V|I{0,3})?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*O\s*Se\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*(_|[1-9][0-9]*)?$/.test(ref);

    if (tags["railway:signal:shunting"])
        return ! /^([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*(Vy|Se)\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*(_|[1-9][0-9]*)?$/.test(ref);

    if (tags["railway:signal:distant_repeated"] || (tags["railway:signal:distant"] && tags["railway:signal:distant:repeated"] == "yes"))
        return ! /^(I?X|VI{0,3}|I?V|I{0,3})?\s*O\s*Př\s*((_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]|[LS]c?\s*(_|[0-9]+)?(z?[a-z]|_)?(-[0-9]+(z?[a-z]|_)?)?|[LS][ok]\s*(_|[0-9]+)?|([0-9]+-)?(_|[0-9]+)?)$/.test(ref);

    if (tags["railway:signal:distant"])
        return ! /^Př\s*((_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]|[LS]c?\s*(_|[0-9]+)?(z?[a-z]|_)?(-[0-9]+(z?[a-z]|_)?)?|[LS][ok]\s*(_|[0-9]+)?|([0-9]+-)?(_|[0-9]+)?)*$/.test(ref);

    if (tags["railway:signal:humping_repeated"] || (tags["railway:signal:humping"] && tags["railway:signal:humping:repeated"] == "yes"))
        return ! /^(I?X|VI{0,3}|I?V|I{0,3})?\s*O\s*Sp\s*(_|[1-9][0-9]*)?$/.test(ref);

    if (tags["railway:signal:humping"])
        return ! /^Sp\s*(_|[1-9][0-9]*)?$/.test(ref);


    return false;
}

VALIDATORS.weird_function = (tags: any) => {

    for (let category of [ "main", "main_repeated", "combined", "combined_repeated" ]) {
        const val: string | undefined = tags[`railway:signal:${category}:function`];
        if (!val) continue;

        const vals = val.split(";").filter(v => !!v);

        if (vals.some((v) => !["entry", "exit", "intermediate", "block", "protection"].includes(v)))
            return true;
    }

    return false;
}



VALIDATORS.mismatched_function = (tags: any) => {

    const ref = tags.ref;
    const fun =
        tags["railway:signal:main:function"] ??
        tags["railway:signal:main_repeated:function"] ??
        tags["railway:signal:combined:function"] ??
        tags["railway:signal:combined_repeated:function"];

    if (!ref || !fun) return false;

    const patterns = {
        entry: /^(_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]$/,
        exit: /^(_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]\s*(_|[0-9]+)?(z?[a-z]|_)?(-[0-9]+(z?[a-z]|_)?)?$/,
        intermediate: /^(_|[0-9]+)?\s*([ABD-ZČĎŇŘŠŤŽ]|CH?)?\s*[LS]c\s*(_|[0-9]+)?(z?[a-z]|_)?(-[0-9]+(z?[a-z]|_)?)?$/,
        block: /^[LS]o\s*(_|[0-9]+)?|([0-9]+-)?(_|[0-9]+)?$/,
        protection: /^[LS]k\s*(_|[0-9]+)?$/,
    };

    if (fun.includes("entry"))
        return !patterns.entry.test(ref);
    if (fun.includes("exit"))
        return !patterns.exit.test(ref);
    if (fun.includes("intermediate"))
        return !patterns.intermediate.test(ref);
    if (fun.includes("block"))
        return !patterns.block.test(ref);
    if (fun.includes("protection"))
        return !patterns.protection.test(ref);

    return false;
}


VALIDATORS.mismatched_ref = (tags: any) => {

    let ref = tags.ref;
    if (!ref) return;
    ref = ref.replaceAll(/[_\s]+/g,"");

    for (let category of [ "main", "main_repeated", "combined", "combined_repeated", "distant", "distant_repeated", "shunting", "shutning_repeated", "humping", "humping_repeated" ]) {
        let val = tags[`railway:signal:${category}`];
        if (!val) continue;

        val = val.replaceAll(/[_\s]+/g,"");
        if (!val.startsWith("Cs-D1:") || val.length <= "Cs-D1:".length) continue;

        const pred = val.substring("Cs-D1:".length);
        if (pred == ref)
            continue;

        if (pred == "Se" && ref.startsWith("Se"))
            continue;

        return true;
    }


    return false;
}



VALIDATORS.weird_height = (tags: any) => {

    for (const category of CATEGORIES) {
        const key = `railway:signal:${category}:height`;
        const val = tags[key];
        if (!val) continue;

        if (!['normal', 'dwarf', 'tall', 'short', 'low', 'high'].includes(val)) {
            return true
        }
    }

    return false;
}

const ALLOWED_STATES = {
    "main": new Set([
        "CZ-D1:stuj", "CZ-D1:volno", "CZ-D1:jizda_vlaku_dovolena", "CZ-D1:posun_dovolen", "stop", "approach", "clear", "shunting_enabled", "call_signal", "speed_limit", "..."
    ]),
    "main_repeated": new Set([
        "stop", "approach", "clear", "shunting_enabled", "call_signal", "speed_limit", "..."
    ]),
    "combined": new Set([
        "CZ-D1:stuj", "CZ-D1:vystraha", "CZ-D1:opakovani_vystraha", "CZ-D1:volno", "CZ-D1:posun_dovolen", "stop", "approach", "clear", "shunting_enabled", "call_signal", "speed_limit", "..."
    ]),
    "combined_repeated": new Set([
        "stop", "approach", "clear", "shunting_enabled", "call_signal", "speed_limit", "..."
    ]),
    "shunting": new Set([
        "off", "CZ-D1:posun_dovolen", "CZ-D1:posun_zakazan", "shunting_enabled", "shunting_disabled", "..."
    ]),
    "shunting_repeated": new Set([
        "off", "shunting_enabled", "shunting_disabled", "..."
    ]),
    "distant": new Set([
        "CZ-D1:vystraha", "CZ-D1:opakovani_vystraha", "CZ-D1:volno", "CZ-D1:opakovani_volno", "approach", "clear", "..."
    ]),
    "distant_repeated": new Set([
        "approach", "clear", "..."
    ]),
}


VALIDATORS.weird_states = (tags: any) => {

    for (let [ category, allowedSet ] of Object.entries(ALLOWED_STATES)) {
        const key = `railway:signal:${category}:states`;
        const val = tags[key] as string | undefined;
        if (!val) continue;

        const vals = val.split(";") ?? [];

        if (vals.some(val => val && !allowedSet.has(val)))
            return true;
    }

    return false;
}


function validate(tags: any) {
    const errors: any[] = [];
    if (!tags) return errors;

    for (let [key, validator] of Object.entries(VALIDATORS))
        if ((validator as any)(tags))
            errors.push(key);

    return errors;
}

/**
 * --------------------------------------------------------------------------
 * 6. RENDERING
 * --------------------------------------------------------------------------
 */

// function render(data: any) {
//     if (layer) map.removeLayer(layer);
//     if (!data) return;
//
//     const bounds = map.getBounds();
//
//     const activeFilters = new Set(
//         Array.from(document.querySelectorAll('.filter-check:checked'))
//             .map(cb => (cb as any).value)
//     );
//
//     const zoom = map.getZoom();
//     const useBounds = zoom >= 12;
//
//     // 🔥 Filter BEFORE creating GeoJSON
//     const visibleFeatures = data.filter((item: any) => {
//         const latlng = L.latLng(item.pos.lat, item.pos.lon);
//
//         // Only keep points inside current map view
//         if (useBounds && !bounds.contains(latlng)) return false;
//
//         // Apply error filters
//         if (item.errors.length === 0)
//             return activeFilters.has("valid");
//
//         return item.errors.some((err: any) => activeFilters.has(err));
//     });
//
//     const geoData = {
//         type: "FeatureCollection",
//         features: visibleFeatures.map((item: any) => ({
//             type: "Feature",
//             geometry: {
//                 type: "Point",
//                 coordinates: [item.pos.lon, item.pos.lat]
//             },
//             ...item
//         }))
//     };
//
//     layer = L.geoJSON(geoData as any, {
//         pointToLayer: (f2, latlng) => {
//             const f = f2 as any;
//
//             const hasErrors = f.errors.length > 0;
//
//             // LOW ZOOM → simple dots
//             if (zoom < 16) {
//                 return L.circleMarker(latlng, {
//                     radius: hasErrors ? 7 : 4,
//                     fillColor: hasErrors ? "#ff4d4d" : "#2ecc71",
//                     color: "#000",
//                     weight: 1,
//                     fillOpacity: 0.9
//                 });
//             }
//
//
//             const r = hasErrors ? 5 : 4;
//             const size = r * 4; // Increased container size to ensure the "tail" doesn't clip
//             const fillColor = hasErrors ? "#ff4d4d" : "#2ecc71";
//
//             let finalAzimuth = f.pos.azm;
//             let isDirectional = false;
//
//             if (finalAzimuth !== null && ["forward", "backward"].includes(f.tags["railway:signal:direction"])) {
//                 isDirectional = true;
//                 if (f.tags["railway:signal:direction"] === "backward") {
//                     finalAzimuth += 180;
//                 }
//             }
//
//             let svgContent;
//
//             if (isDirectional) {
//
//                 /**
//                  * SVG Path Breakdown (viewBox 24x24):
//                  * Center point is (12, 12).
//                  * 1. Move to (2, 12) - Left side of the flat edge.
//                  * 2. Arc to (22, 12) - The semicircle (Radius 10).
//                  * 3. Line to (22, 17) - Down to form one side of the rectangle (r/2 = 5 units).
//                  * 4. Line to (2, 17)  - The bottom flat edge of the rectangle.
//                  * 5. Close path back to (2, 12).
//                  */
//                 svgContent = `
//                     <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="transform: rotate(${finalAzimuth}deg); transform-origin: center; display: block;">
//                         <path
//                             d="M 2 12
//                                A 10 10 0 0 1 22 12
//                                L 22 17
//                                L 2 17
//                                Z"
//                             fill="${fillColor}"
//                             fill-opacity="0.9"
//                             stroke="#000"
//                             stroke-width="2"
//                             stroke-linejoin="round"
//                         />
//                     </svg>
//                 `;
//             } else {
//                 // Standard full circle
//                 svgContent = `
//                     <svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display: block;">
//                         <circle cx="12" cy="12" r="10" fill="${fillColor}" fill-opacity="0.9" stroke="#000" stroke-width="2" />
//                     </svg>
//                 `;
//             }
//
//             const marker = L.marker(latlng, {
//                 icon: L.divIcon({
//                     html: svgContent,
//                     className: '',
//                     iconSize: [size, size],
//                     iconAnchor: [size / 2, size / 2]
//                 })
//             });
//
//             return L.layerGroup([marker]);
//         },
//
//         onEachFeature: (f2, l) => {
//             const f = f2 as any;
//
//             const popupHtml = `
//                     <b>ID:</b> ${f.osm.id}
//                     <a href="https://osm.org/node/${f.osm.id}" target="_blank">View</a>
//                     <a href="https://osm.org/edit?node=${f.osm.id}" target="_blank">Edit</a>
//                 <br>
//                     <b>Errors:</b> ${f.errors.length ? f.errors.map((e: any) => (ERRORS as any)[e] ?? e).join(", ") : "none"}
//                 <br>
//                     <b>Asimuth:</b> ${f.pos.azm}
//                 <hr>
//                     <div class="popup-tags">${formatTags(f.tags)}</div>
//             `;
//
//             // Case 1: single layer (CircleMarker etc.)
//             if (l instanceof L.Layer && !(l instanceof L.LayerGroup)) {
//                 l.bindPopup(popupHtml);
//                 return;
//             }
//
//             // Case 2: group (your azimuth + marker combo)
//             if (l instanceof L.LayerGroup) {
//                 l.eachLayer(subLayer => {
//                     if (subLayer instanceof L.CircleMarker || subLayer instanceof L.Marker) {
//                         subLayer.bindPopup(popupHtml);
//                     }
//                 });
//             }
//
//         }
//     }).addTo(map);
// }

/**
 * --------------------------------------------------------------------------
 * 7. TAG FORMATTING
 * --------------------------------------------------------------------------
 */

// function formatTags(tags: any) {
//     const prefix = "railway:signal:";
//     const grouped: any = {};
//     const ungrouped: any[] = [];
//
//     // --- 1. Group tags ---
//     for (const [key, value] of Object.entries(tags)) {
//         if (key.startsWith(prefix)) {
//             const rest = key.slice(prefix.length);
//             const parts = rest.split(":");
//             // Check if the base part is one of our categories
//             const maybeCategory = parts[0];
//
//             if (CATEGORIES.includes(maybeCategory)) {
//                 grouped[maybeCategory] ??= { __main: null, sub: [] };
//                 if (parts.length === 1) {
//                     grouped[maybeCategory].__main = value;
//                 } else {
//                     grouped[maybeCategory].sub.push({
//                         key: ":" + parts.slice(1).join(":"),
//                                                     value: value
//                     });
//                 }
//                 continue;
//             }
//         }
//         ungrouped.push({ key, value });
//     }
//
//     // --- 2. Sort ---
//     const sortedCategories = Object.keys(grouped).sort();
//     ungrouped.sort((a, b) => a.key.localeCompare(b.key));
//
//     // --- 3. Render ---
//     const lines = [];
//     const formatValue = (v: any) => String(v).replace(/CZ-D1:/g, `<span class="prefix">CZ-D1:</span>`);
//
//     // Render non-signal tags first
//     for (const { key, value } of ungrouped) {
//         lines.push(`<b>${key}</b>: ${value}`);
//     }
//
//     // Render grouped signal tags
//     for (const cat of sortedCategories) {
//         const group = grouped[cat];
//         lines.push(`<b>${cat}${group.__main ? `: ${formatValue(group.__main)}` : ""}</b>`);
//
//         group.sub
//         .sort((a: any, b: any) => a.key.localeCompare(b.key))
//         .forEach(({ key, value }: { key: any, value: any }) => {
//             lines.push(`&nbsp;&nbsp;<b>${key}</b>: ${formatValue(value)}`);
//         });
//     }
//
//     return lines.join("<br>");
// }

// function initRendering() {
//     const ZOOM_THRESHOLD = 12;
//
//     let lastZoom = map.getZoom();
//
//     function shouldRerenderOnZoomChange(oldZoom: any, newZoom: any) {
//         return oldZoom >= ZOOM_THRESHOLD || newZoom >= ZOOM_THRESHOLD;
//     }
//
//     function shouldRenderOnMove() {
//         return map.getZoom() >= ZOOM_THRESHOLD;
//     }
//
//     map.on('zoomend', () => {
//         const newZoom = map.getZoom();
//
//         if (shouldRerenderOnZoomChange(lastZoom, newZoom)) {
//             render(currentData);
//         }
//
//         lastZoom = newZoom;
//     });
//
//     map.on('moveend', () => {
//         if (shouldRenderOnMove()) {
//             render(currentData);
//         }
//     });
// }


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
            errors: validate(item.tags)
        }));


        const geoData = {
            type: "FeatureCollection",
            features: currentData.map((item: any) => {

                let azm: number | null = null;
                const direction = item.tags["railway:signal:direction"];

                if (!direction) {
                    azm = null;
                } else if (direction == "forward") {
                    if (item.pos.azm) azm = item.pos.azm;
                } else if (direction == "backward") {
                    if (item.pos.azm) azm = (item.pos.azm + 180) % 360;
                } else if (/([0-2]?[0-9]{1,2}|3[0-5][0-9]|360)/.test(direction)) {
                    azm = parseInt(direction, 10);
                }

                return {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [item.pos.lon, item.pos.lat]
                    },
                    properties: {
                        id: item.osm.id,
                        col: item.errors.length > 0 ? "#ff4d4d" : "#2ecc71",
                        azm: azm,
                    }
                };

            })
        } as const;

        console.log(geoData);

        map.update(geoData);
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
    // initButtons();
    // initToggle();
    // initCategories();
    // initRendering();

    showLoading(true);
    await loadData();
    showLoading(false);

})();

