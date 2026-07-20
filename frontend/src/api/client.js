const BASE = "/api"; // proxied to backend in dev
export class ApiError extends Error {
    kind;
    status;
    constructor(message, kind, status) {
        super(message);
        this.kind = kind;
        this.status = status;
        this.name = "ApiError";
    }
}
async function request(path, init) {
    let res;
    try {
        res = await fetch(`${BASE}${path}`, init);
    }
    catch {
        throw new ApiError("Backend nicht erreichbar", "network");
    }
    const requestId = res.headers.get("X-Debug-Request-Id");
    if (requestId) {
        // eslint-disable-next-line no-console
        console.debug(`[garmin-coach] request id: ${requestId} (${res.url} -> ${res.status})`);
    }
    if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const message = detail.detail ?? `HTTP ${res.status}`;
        throw new ApiError(message, "http", res.status);
    }
    return (await res.json());
}
export async function generateFromText(text) {
    return request("/workouts/from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
}
export async function generateFromTemplate(text) {
    return request("/workouts/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
}
export async function pushWorkout(id) {
    return request(`/workouts/${id}/push`, { method: "POST" });
}
export async function saveWorkout(id, workout) {
    return request(`/workouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workout),
    });
}
export async function listWorkouts() {
    return request("/workouts");
}
export async function getWorkout(id) {
    return request(`/workouts/${id}`);
}
