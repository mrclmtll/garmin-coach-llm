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
  | { kind: "heart_rate"; value: number } // ends once heart rate reaches this bpm
  | { kind: "power"; value: number }; // cycling only — ends once power reaches this many watts

export type Target =
  | { kind: "pace"; min_sec_per_km: number; max_sec_per_km: number }
  | { kind: "power"; min_watts: number; max_watts: number } // custom watt range
  | { kind: "power_zone"; zone: 1 | 2 | 3 | 4 | 5 | 6 | 7 } // predefined power zone
  | { kind: "cadence"; min_cadence: number; max_cadence: number } // spm (run) / rpm (bike)
  | { kind: "hr_zone"; zone: 1 | 2 | 3 | 4 | 5 }
  | { kind: "hr_custom"; min_bpm: number; max_bpm: number }
  | { kind: "no_target" }
  | { kind: "swim_pace"; sec_per_100m: number } // single value, not a range
  | { kind: "swim_css_pace"; offset_seconds: number } // offset from the athlete's Critical Swim Speed
  | { kind: "swim_effort"; level: SwimEffort } // named exertion level, not a pace number
  | { kind: "speed"; min_kmh: number; max_kmh: number } // cycling only — ascending, unlike pace
  | { kind: "power_curve"; interval: PowerCurveInterval; percent: number }; // % of the athlete's best-ever power for that duration

// Garmin's fixed set of power-curve interval durations.
export type PowerCurveInterval =
  | "5s"
  | "10s"
  | "20s"
  | "30s"
  | "1min"
  | "2min"
  | "5min"
  | "10min"
  | "20min"
  | "30min"
  | "1hour";

// Swim-only step fields.
export type SwimStroke =
  | "choice"
  | "backstroke"
  | "breaststroke"
  | "butterfly"
  | "freestyle"
  | "im"
  | "various"
  | "im_ladder"
  | "im_reverse";

// Ids confirmed by round-tripping all 8 through Garmin Connect's own editor
// — ids 2 and 8 don't correspond to any of these and are left out.
export type SwimEffort =
  | "recovery"
  | "easy"
  | "moderate"
  | "hard"
  | "very_hard"
  | "maximum"
  | "ascending"
  | "descending";

export type SwimEquipment = "fins" | "kickboard" | "paddles" | "pull_buoy" | "snorkel";

// Garmin's "Übungstyp" (exercise type) dropdown — separate from stroke and
// equipment. Ids confirmed against Garmin Connect's own editor (see backend
// docstring).
export type SwimDrillType = "kick" | "pull" | "drill";

export interface Step {
  kind: "step";
  label: string;
  goal: Goal;
  target: Target;
  role: StepRole;
  sport: Sport;
  stroke: SwimStroke | null;
  equipment: SwimEquipment | null;
  drill: SwimDrillType | null;
  // Cycling only — a second target stacked alongside the primary one (e.g.
  // power zone + cadence). null means unset.
  secondary_target: Target | null;
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
  pool_length_m: number; // swimming only, ignored otherwise
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
