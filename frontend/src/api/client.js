const BASE = "/api"; // proxied to backend in dev
async function jsonOrThrow(res) {
    const requestId = res.headers.get("X-Debug-Request-Id");
    if (requestId) {
        // Surfaced to the browser console so you can grep `logs/garmin-coach.log`
        // for the full LLM trace of the request that just produced this response.
        // eslint-disable-next-line no-console
        console.debug(`[garmin-coach] request id: ${requestId} (${res.url} -> ${res.status})`);
    }
    if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const message = detail.detail ?? `HTTP ${res.status}`;
        throw new Error(requestId ? `${message} (request ${requestId})` : message);
    }
    return (await res.json());
}
export async function generateFromText(text) {
    const res = await fetch(`${BASE}/workouts/from-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    return jsonOrThrow(res);
}
export async function generateFromTemplate(text) {
    const res = await fetch(`${BASE}/workouts/from-template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
    });
    return jsonOrThrow(res);
}
export async function pushWorkout(id) {
    const res = await fetch(`${BASE}/workouts/${id}/push`, { method: "POST" });
    return jsonOrThrow(res);
}
export async function saveWorkout(id, workout) {
    const res = await fetch(`${BASE}/workouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(workout),
    });
    return jsonOrThrow(res);
}
export async function listWorkouts() {
    const res = await fetch(`${BASE}/workouts`);
    return jsonOrThrow(res);
}
export async function getWorkout(id) {
    const res = await fetch(`${BASE}/workouts/${id}`);
    return jsonOrThrow(res);
}
