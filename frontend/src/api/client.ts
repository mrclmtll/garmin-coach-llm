import type { GarminWorkoutSummary, Workout, WorkoutSummary } from "./types";

const BASE = "/api"; // proxied to backend in dev

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: "network" | "http",
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError("Backend nicht erreichbar", "network");
  }
  const requestId = res.headers.get("X-Debug-Request-Id");
  if (requestId) {
    // eslint-disable-next-line no-console
    console.debug(`[garmin-coach] request id: ${requestId} (${res.url} -> ${res.status})`);
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    const message = (detail as { detail?: string }).detail ?? `HTTP ${res.status}`;
    throw new ApiError(message, "http", res.status);
  }
  return (await res.json()) as T;
}

export interface GeneratedWorkout {
  workout: Workout;
}

export interface CreatedWorkout {
  id: number;
  workout: Workout;
}

export async function generateFromText(text: string): Promise<GeneratedWorkout> {
  return request<GeneratedWorkout>("/workouts/from-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function generateFromTemplate(text: string): Promise<GeneratedWorkout> {
  return request<GeneratedWorkout>("/workouts/from-template", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function createWorkout(workout: Workout, source: string): Promise<CreatedWorkout> {
  return request<CreatedWorkout>("/workouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workout, source }),
  });
}

export async function pushWorkout(id: number): Promise<{ workout_id: number; garmin_workout_id: string | null; raw: unknown }> {
  return request(`/workouts/${id}/push`, { method: "POST" });
}

export async function saveWorkout(id: number, workout: Workout): Promise<Workout> {
  return request<Workout>(`/workouts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(workout),
  });
}

export async function listWorkouts(): Promise<WorkoutSummary[]> {
  return request<WorkoutSummary[]>("/workouts");
}

export async function getWorkout(id: number): Promise<Workout> {
  return request<Workout>(`/workouts/${id}`);
}

export async function listGarminWorkouts(): Promise<GarminWorkoutSummary[]> {
  return request<GarminWorkoutSummary[]>("/workouts/garmin");
}
