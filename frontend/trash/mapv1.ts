import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ZOOM_LEVEL = {
    CULLING: 12,
    DETAILS: 16
} as const;


export class MapController {

    private map: L.Map;
    private layer: any = null;


    constructor(map: L.Map) {
        this.map = map;


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

    private rerender() {
        if (this.layer) {
            this.map.removeLayer(this.layer);
        }

        if (!data) return;

        const bounds = this.map.getBounds();
        const zoom = options.zoom;
        const useBounds = zoom >= ZOOM_LEVEL.CULLING;

        const visible = data.filter((item: any) => {
            const latlng = L.latLng(item.pos.lat, item.pos.lon);

            if (useBounds && !bounds.contains(latlng)) return false;

            if (item.errors.length === 0)
                return options.activeFilters.has("valid");

            return item.errors.some((e: any) =>
                options.activeFilters.has(e)
            );
        });

        const geoData = {
            type: "FeatureCollection",
            features: visible.map((item: any) => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [item.pos.lon, item.pos.lat]
                },
                ...item
            }))
        };

        this.layer = L.geoJSON(geoData as any, {
            pointToLayer: (f2, latlng) => {
                const f = f2 as any;
                const hasErrors = f.errors.length > 0;

                if (zoom < ZOOM_LEVEL.DETAILS) {
                    return L.circleMarker(latlng, {
                        radius: hasErrors ? 7 : 4,
                        fillColor: hasErrors ? "#ff4d4d" : "#2ecc71",
                        color: "#000",
                        weight: 1,
                        fillOpacity: 0.9
                    });
                }

                const size = 20;
                const color = hasErrors ? "#ff4d4d" : "#2ecc71";

                const marker = L.marker(latlng, {
                    icon: L.divIcon({
                        html: `
                            <svg width="${size}" height="${size}" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="10"
                                    fill="${color}" stroke="#000" stroke-width="2"/>
                            </svg>
                        `,
                        className: "",
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
                    <br>
                    <b>Errors:</b> ${f.errors.length || "none"}
                `;

                if (l instanceof L.LayerGroup) {
                    l.eachLayer((sub: any) => sub.bindPopup(popupHtml));
                } else {
                    l.bindPopup(popupHtml);
                }
            }
        }).addTo(this.map);
    }
}