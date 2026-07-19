const BASE = "/api"; // proxied to backend in dev
async function jsonOrThrow(res) {
    if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const message = detail.detail ?? `HTTP ${res.status}`;
        throw new Error(message);
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
