// Internal Workout shape — mirror of backend/app/schemas/workout.py.
// Kept in sync manually; if the backend schema grows, this file follows.

export type Sport = "running" | "cycling" | "swimming";
// Garmin "Abschnittstyp" — each value is a distinct Garmin stepType id
// (warmup=1, cooldown=2, interval=3, recovery=4, rest=5, other=7). Garmin has
// no separate "walk" step type.
export type StepRole = "warmup" | "work" | "recovery" | "rest" | "other" | "cooldown";

export type Goal =
  | { kind: "time"; value: number } // seconds
  | { kind: "distance"; value: number } // meters
  | { kind: "lap_button" } // open-ended: ends on lap-button press
  | { kind: "calories"; value: number } // kcal
  | { kind: "heart_rate"; value: number }; // ends once heart rate reaches this bpm

export type Target =
  | { kind: "pace"; min_sec_per_km: number; max_sec_per_km: number }
  | { kind: "power"; min_watts: number; max_watts: number } // custom watt range
  | { kind: "power_zone"; zone: 1 | 2 | 3 | 4 | 5 | 6 | 7 } // predefined power zone
  | { kind: "cadence"; min_cadence: number; max_cadence: number } // spm (run) / rpm (bike)
  | { kind: "hr_zone"; zone: 1 | 2 | 3 | 4 | 5 }
  | { kind: "hr_custom"; min_bpm: number; max_bpm: number }
  | { kind: "no_target" };

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

// A device registered on the Garmin account — backend GET /workouts/devices.
export interface GarminDevice {
  id: string;
  name: string;
  is_primary: boolean;
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
