import L from "leaflet";
import "leaflet/dist/leaflet.css";

const ZOOM_LEVEL = {
    CULLING: 12,
    DETAILS: 16
} as const;


export class Map {

    private map: L.Map;

    constructor(target: HTMLElement) {

        this.map = L.map('map', {
            zoomControl: false
        }).setView([49.8, 15.5], 7);

    }





}