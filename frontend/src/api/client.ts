import type { Workout } from "./types";

const BASE = "/api"; // proxied to backend in dev

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const requestId = res.headers.get("X-Debug-Request-Id");
  if (requestId) {
    // Surfaced to the browser console so you can grep `logs/garmin-coach.log`
    // for the full LLM trace of the request that just produced this response.
    // eslint-disable-next-line no-console
    console.debug(`[garmin-coach] request id: ${requestId} (${res.url} -> ${res.status})`);
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const message = (detail as { detail?: string }).detail ?? `HTTP ${res.status}`;
    throw new Error(requestId ? `${message} (request ${requestId})` : message);
  }
  return (await res.json()) as T;
}

export interface CreatedWorkout {
  id: number;
  workout: Workout;
}

export async function generateFromText(text: string): Promise<CreatedWorkout> {
  const res = await fetch(`${BASE}/workouts/from-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return jsonOrThrow<CreatedWorkout>(res);
}

export async function generateFromTemplate(text: string): Promise<CreatedWorkout> {
  const res = await fetch(`${BASE}/workouts/from-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return jsonOrThrow<CreatedWorkout>(res);
}

export async function pushWorkout(id: number): Promise<{ workout_id: number; garmin_workout_id: string | null; raw: unknown }> {
  const res = await fetch(`${BASE}/workouts/${id}/push`, { method: "POST" });
  return jsonOrThrow(res);
}

export async function saveWorkout(id: number, workout: Workout): Promise<Workout> {
  const res = await fetch(`${BASE}/workouts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workout),
  });
  return jsonOrThrow<Workout>(res);
}
