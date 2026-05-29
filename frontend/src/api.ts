
export type ApiSignal = {
    osm: {
        id: number,
        ver: number,
    },
    pos : {
        lat: number,
        lon: number,
        azm: number | null,
    },
    tags: Record<string, string>,
}

export type ApiResponse = {
    meta: {
        data_timestamp: Date,
        fetch_timestamp: Date,
    },
    data: ApiSignal[],
}

export class Api {
    // private baseUrl = "/api/";
    // private baseUrl = "http://localhost:8090/api/";
    private baseUrl = "https://validator.detectivefiasco.cz/api/";

    async load(): Promise<ApiResponse> {
        try {
            const res = await fetch(this.baseUrl + "data");
            const raw = await res.json();

            return {
                meta: {
                    data_timestamp: new Date(raw.meta.data_timestamp),
                    fetch_timestamp: new Date(raw.meta.fetch_timestamp)
                },
                data: raw.data,
            };

        } catch (e) {
            throw e; // TODO: Proper error handling
        }
    }

    async refresh(): Promise<void> {
        try {
            await fetch(this.baseUrl + "refresh", { method: "POST" });
        } catch (e) {
            throw e; // TODO: Proper error handling
        }
    }


}
