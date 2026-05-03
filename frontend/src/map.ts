import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoJSON } from "leaflet";


import RBush from "rbush";


type Properties = {
    id: number;
    col: string;
    azm: number | null
};

type Feature = GeoJSON.Feature<GeoJSON.Point, Properties>;
type Collection = GeoJSON.FeatureCollection<GeoJSON.Point, Properties>



const MODE = {
    SIMPLE: "simple",
    DETAILED: "detailed",
} as const;

type Mode = typeof MODE[keyof typeof MODE];


type VisibilityTreeItem = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    feature: Feature;
};

type SelectionListener = (feature: Feature | null) => void;



export class Map {
    private detailZoomThreshold = 16;


    private selectedId: number | null = null;
    private listeners: SelectionListener[] = [];

    onSelect(cb: SelectionListener) {
        this.listeners.push(cb);
    }

    private emitSelect(feature: Feature | null) {
        this.listeners.forEach(cb => cb(feature));
    }

    private selectFeature(feature: Feature) {
        const isSame = this.selectedId === feature.properties.id;

        this.selectedId = isSame ? null : feature.properties.id;

        this.render(true);

        this.emitSelect(isSame ? null : feature);
    }

    private clearSelection() {
        if (this.selectedId === null) return;

        this.selectedId = null;

        this.render(true); // force re-render (important for SIMPLE mode)

        this.emitSelect(null);
    }


    private map: L.Map;
    private layer: L.Layer | null = null;

    private data: Feature[] = [];
    private tree = new RBush<VisibilityTreeItem>();


    private mode: Mode = MODE.DETAILED;

    constructor(el: string | HTMLElement) {
        this.map = L.map(el, {
            zoomControl: false,
        }).setView([49.8, 15.5], 7);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            {
                maxZoom: 21,
                maxNativeZoom: 19,
                attribution: '© OpenStreetMap'
            }
        ).addTo(this.map);

        this.map.on("zoomend", () => this.render());
        this.map.on("moveend", () => this.render());
        this.map.on("click", () => this.clearSelection());
    }

    update(collection: Collection) {
        this.data = collection.features;
        this.refreshVisibilityTree();
        this.render();
    }


    private refreshVisibilityTree() {
        const items: VisibilityTreeItem[] = this.data.map(f => {
            const [lon, lat] = f.geometry.coordinates;

            return {
                minX: lon,
                minY: lat,
                maxX: lon,
                maxY: lat,
                feature: f
            };
        });

        this.tree.clear();
        this.tree.load(items);
    }

    private getVisibleFeatures(): Feature[] {
        const b = this.map.getBounds();

        const results = this.tree.search({
            minX: b.getWest(),
            minY: b.getSouth(),
            maxX: b.getEast(),
            maxY: b.getNorth()
        });

        return results.map(r => r.feature);
    }

    private render(force: boolean = false) {
        const zoom = this.map.getZoom();
        const nextMode: Mode = zoom < this.detailZoomThreshold ? MODE.SIMPLE : MODE.DETAILED;

        if (!force && nextMode === this.mode && nextMode === MODE.SIMPLE) {
            return;
        }

        this.mode = nextMode;

        if (this.layer) {
            this.map.removeLayer(this.layer);
        }

        const features =
            this.mode === MODE.SIMPLE ? this.data : this.getVisibleFeatures() ;

        const collection = {
            type: "FeatureCollection",
            features
        } as Collection;

        this.layer =
            this.mode === MODE.SIMPLE
                ? this.renderSimple(collection)
                : this.renderDetailed(collection);

        this.layer.addTo(this.map);
    }


    private renderSimple(data: Collection) {
        return L.geoJSON(data, {
            // renderer: L.canvas(),

            pointToLayer: (f: Feature, latlng) => {
                const isSelected = f.properties.id === this.selectedId;

                return L.circleMarker(latlng, {
                    radius: 4,
                    fillColor: f.properties.col,
                    color: isSelected ? "#fff" : "#000",
                    weight: 1,
                    fillOpacity: 0.9
                });
            },

            onEachFeature: (feature, layer) => {
                layer.on("click", (e) => {
                    L.DomEvent.stopPropagation(e); // 👈 critical
                    this.selectFeature(feature as Feature)
                });
            }
        });
    }

    private renderDetailed(data: Collection) {
        return L.geoJSON(data, {
            pointToLayer: (f: Feature, latlng) => {
                const isSelected = f.properties.id === this.selectedId;

                const p = f.properties;
                const size = 20;

                let svg: string;

                if (p.azm === null) {
                    svg = `
                        <svg width="${size}" height="${size}" viewBox="0 0 24 24">
                            <circle
                                cx="12" cy="12" r="10"
                                fill="${p.col}"
                                fill-opacity="0.9"
                                stroke="${isSelected ? "#fff" : "#000"}"
                                stroke-width="2"
                            />
                        </svg>
                    `;
                } else {
                    svg = `
                        <svg width="${size}" height="${size}" viewBox="0 0 24 24"
                            style="transform: rotate(${p.azm}deg); transform-origin: center;">
                            <path
                            d="M 2 12
                               A 10 10 0 0 1 22 12
                               L 22 17
                               L 2 17
                               Z"
                            fill="${p.col}"
                            fill-opacity="0.9"
                            stroke="${isSelected ? "#fff" : "#000"}"
                            stroke-width="2"
                            stroke-linejoin="round"
                        />
                        </svg>
                    `;
                }

                return L.marker(latlng, {
                    icon: L.divIcon({
                        html: svg,
                        className: "",
                        iconSize: [size, size],
                        iconAnchor: [size / 2, size / 2]
                    })
                });
            },

            onEachFeature: (feature, layer) => {
                layer.on("click", (e) => {
                    L.DomEvent.stopPropagation(e); // 👈 critical
                    this.selectFeature(feature as Feature)
                });
            }
        });
    }
}