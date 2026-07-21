// Internal Workout shape — mirror of backend/app/schemas/workout.py.
// Kept in sync manually; if the backend schema grows, this file follows.

export type Sport = "running" | "cycling" | "swimming";
export type StepRole = "warmup" | "work" | "recovery" | "cooldown";

export type Goal =
  | { kind: "time"; value: number }
  | { kind: "distance"; value: number };

export type Target =
  | { kind: "pace"; min_sec_per_km: number; max_sec_per_km: number }
  | { kind: "power"; min_watts: number; max_watts: number }
  | { kind: "hr_zone"; zone: 1 | 2 | 3 | 4 | 5 };

export interface Step {
  kind: "step";
  label: string;
  goal: Goal;
  target: Target;
  role: StepRole;
  sport: Sport;
}

export interface RepeatBlock {
  kind: "repeat";
  count: number;
  steps: Step[];
}

export type BodyItem = Step | RepeatBlock;

export interface Workout {
  name: string;
  sport: Sport;
  warmup: Step | null;
  body: BodyItem[];
  cooldown: Step | null;
}

// Lightweight row for the saved-workouts list — backend GET /workouts.
export interface WorkoutSummary {
  id: number;
  name: string;
  sport: Sport;
  source: string;
  created_at: string;
  pushed_at: string | null;
  garmin_workout_id: string | null;
}

// Lightweight row for a workout already in the Garmin library — backend GET /workouts/garmin.
export interface GarminWorkoutSummary {
  id: string;
  name: string;
  sport: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// A predefined starting-point workout shown in the Templates gallery —
// backend GET /workout-templates. Built-in templates are seeded into the DB
// on startup; new ones can be added there without a frontend change.
export interface WorkoutTemplate {
  id: string;
  name: string;
  category: string;
  structure: string;
  intensity: string;
  purpose: string;
  workout: Workout;
}
