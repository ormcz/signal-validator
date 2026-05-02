/**
 * --------------------------------------------------------------------------
 * 1. GLOBAL CONFIGURATION & STATE
 * --------------------------------------------------------------------------
 */
const map = L.map('map', {
    zoomControl: false
}).setView([49.8, 15.5], 7);

const layers = {}

layers["OSM"] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
})


const customLayer = L.TileLayer.extend({
    getTileUrl: function(coords) {
        const tileSize = this.getTileSize();
        const nwPoint = coords.scaleBy(tileSize);
        const sePoint = nwPoint.add(tileSize);

        const nw = map.options.crs.project(map.unproject(nwPoint, coords.z));
        const se = map.options.crs.project(map.unproject(sePoint, coords.z));

        const bbox = [nw.x, se.y, se.x, nw.y].join(',');

        return `http://127.0.0.1:8082/EPSG:3857/256/256/${bbox}`;
    }
});
layers["ORTOFOTO"] = new customLayer(null, { maxZoom: 21 })



let layer;
let currentData = null;

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

function initButtons() {
    const downloadBtn = document.getElementById("btn");
    downloadBtn.onclick = async () => {
        setUIEnabled(false);
        showLoading(true);
        try {
            await fetch('api/redownload', { method: "POST" });
            await loadData();
        } catch (e) {
            console.error("Download failed:", e);
        } finally {
            showLoading(false);
            setUIEnabled(true);
        }
    };

    document.getElementById('zoom-in').onclick = () => map.zoomIn();
    document.getElementById('zoom-out').onclick = () => map.zoomOut();
}

function initToggle() {
    const container = document.getElementById('layer-switch');

    Object.entries(layers).forEach(([name, layer], index) => {
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
    const container = document.getElementById("error-list");
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
            createFilterItem(key, label)
        );
    }

    document.getElementById('sel-all').onclick = () => {
        document.querySelectorAll('.filter-check').forEach(cb => cb.checked = true);
        render(currentData);
    };

    document.getElementById('sel-none').onclick = () => {
        document.querySelectorAll('.filter-check').forEach(cb => cb.checked = false);
        render(currentData);
    };

    document.querySelectorAll('.filter-check').forEach(el => {
        el.onchange = () => render(currentData);
    });
}

/**
 * --------------------------------------------------------------------------
 * 4. STATE & UI HELPERS
 * --------------------------------------------------------------------------
 */

function setUIEnabled(enabled) {
    const controls = document.querySelectorAll('#btn, .zoom-btn, .filter-check, .action-btn');
    controls.forEach(el => {
        if (enabled) {
            el.classList.remove('disabled');
            el.style.pointerEvents = 'auto';
        } else {
            el.classList.add('disabled');
            el.style.pointerEvents = 'none';
        }
    });
}

function showLoading(on) {
    document.getElementById("overlay").classList.toggle("active", on);
    document.body.classList.toggle("disabled", on);
}

function createFilterItem(value, label, isBold, checked) {
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
};

VALIDATORS = {}

VALIDATORS.unknown_signal_type = (tags) => {

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

VALIDATORS.weird_ref = (tags) => {

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

VALIDATORS.weird_function = (tags) => {

    const ref = tags.ref;

    for (let category of [ "main", "main_repeated", "combined", "combined_repeated" ]) {
        const val = tags[`railway:signal:${category}:function`];
        if (!val) continue;

        const vals = val.split(";").filter(v => !!v);

        if (vals.some(v => !["entry", "exit", "intermediate", "block", "protection"].includes(v)))
            return true;
    }

    return false;
}



VALIDATORS.mismatched_function = (tags) => {

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


VALIDATORS.mismatched_ref = (tags) => {

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



VALIDATORS.weird_height = (tags) => {

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


VALIDATORS.weird_states = (tags) => {

    for (let [ category, allowedSet ] of Object.entries(ALLOWED_STATES)) {
        const key = `railway:signal:${category}:states`;
        const val = tags[key];
        if (!val) continue;

        const vals = val.split(";") ?? [];

        if (vals.some(val => val && !allowedSet.has(val)))
            return true;
    }

    return false;
}


function validate(tags) {
    const errors = [];
    if (!tags) return errors;

    for (let [key, validator] of Object.entries(VALIDATORS))
        if (validator(tags))
            errors.push(key);

    return errors;
}

/**
 * --------------------------------------------------------------------------
 * 6. RENDERING
 * --------------------------------------------------------------------------
 */

function render(data) {
    if (layer) map.removeLayer(layer);
    if (!data) return;

    const activeFilters = new Set(
        Array.from(document.querySelectorAll('.filter-check:checked'))
        .map(cb => cb.value)
    );

    layer = L.geoJSON(data, {
        filter: (f) => {
            const errors = validate(f.properties.tags);

            if (errors.length === 0) return activeFilters.has("valid");

            return errors.some(err => activeFilters.has(err));
        },

        pointToLayer: (f, latlng) => {
            const errors = validate(f.properties.tags);
            const hasErrors = errors.length > 0;

            return L.circleMarker(latlng, {
                radius: hasErrors ? 7 : 4,
                fillColor: hasErrors ? "#ff4d4d" : "#2ecc71",
                color: "#000",
                weight: 1,
                fillOpacity: 0.9
            });
        },

        onEachFeature: (f, l) => {
            const errors = validate(f.properties.tags);

            const errorText = errors.length
            ? errors.map(e => ERRORS[e] ?? e).join(", ")
            : "none";

            l.bindPopup(`
            <b>ID:</b> ${f.properties.id} <a href="https://osm.org/node/${f.properties.id}" target="_blank">View</a> <a href="https://osm.org/edit?node=${f.properties.id}" target="_blank">Edit</a><br>
            <b>Errors:</b> ${errorText}<hr>
            <div class="popup-tags">${formatTags(f.properties.tags)}</div>
            `);
        }
    }).addTo(map);
}

/**
 * --------------------------------------------------------------------------
 * 7. TAG FORMATTING
 * --------------------------------------------------------------------------
 */

function formatTags(tags) {
    const prefix = "railway:signal:";
    const grouped = {};
    const ungrouped = [];

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
    const formatValue = (v) => String(v).replace(/CZ-D1:/g, `<span class="prefix">CZ-D1:</span>`);

    // Render non-signal tags first
    for (const { key, value } of ungrouped) {
        lines.push(`<b>${key}</b>: ${value}`);
    }

    // Render grouped signal tags
    for (const cat of sortedCategories) {
        const group = grouped[cat];
        lines.push(`<b>${cat}${group.__main ? `: ${formatValue(group.__main)}` : ""}</b>`);

        group.sub
        .sort((a, b) => a.key.localeCompare(b.key))
        .forEach(({ key, value }) => {
            lines.push(`&nbsp;&nbsp;<b>${key}</b>: ${formatValue(value)}`);
        });
    }

    return lines.join("<br>");
}

/**
 * --------------------------------------------------------------------------
 * 8. DATA LOADING
 * --------------------------------------------------------------------------
 */

async function loadData() {
    try {
        const res = await fetch('api/data');
        currentData = await res.json();
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

    showLoading(true);
    await loadData();
    showLoading(false);
})();

