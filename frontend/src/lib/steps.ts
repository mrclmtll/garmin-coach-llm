import type { Goal, Sport, Step, StepRole, Target } from "../api/types";

// No target is a valid choice for every sport, so it's the sensible default
// — no need to guess a sport-specific pace/power range upfront.
export function defaultTarget(): Target {
  return { kind: "no_target" };
}

export function blankStep(sport: Sport, role: StepRole, label: string = ""): Step {
  return {
    kind: "step",
    label,
    goal: { kind: "time", value: 300 },
    target: defaultTarget(),
    role,
    sport,
  };
}

// Garmin's own labels for the "Step Type" dropdown. Garmin Connect's own
// editor round-trips "Walk" as the exact same stepType as "Run"
// (interval/3) — confirmed via the API — so it isn't a separate role here.
// Use "work" for both and tell them apart via the step's label.
export const STEP_ROLE_LABELS: Record<StepRole, string> = {
  warmup: "Warmup",
  work: "Run",
  recovery: "Recovery",
  rest: "Rest",
  other: "Other",
  cooldown: "Cool Down",
};

// One accent color per step type, shown as the step's heading + left
// border — so the step's kind is visible at a glance without needing the
// (optional) notes field filled in.
export const STEP_ROLE_STYLES: Record<StepRole, { border: string; text: string }> = {
  warmup: { border: "border-l-rose-500", text: "text-rose-400" },
  work: { border: "border-l-accent-500", text: "text-accent-400" },
  recovery: { border: "border-l-slate-500", text: "text-slate-400" },
  rest: { border: "border-l-amber-500", text: "text-amber-400" },
  other: { border: "border-l-violet-500", text: "text-violet-400" },
  cooldown: { border: "border-l-emerald-500", text: "text-emerald-400" },
};

export const GOAL_KIND_LABELS: Record<Goal["kind"], string> = {
  time: "Time",
  distance: "Distance",
  lap_button: "Lap Button Press",
  calories: "Calories",
  heart_rate: "Heart Rate",
};

export const TARGET_KIND_LABELS: Record<Target["kind"], string> = {
  no_target: "No Target",
  pace: "Pace",
  cadence: "Cadence",
  hr_zone: "Heart Rate Zone",
  hr_custom: "Custom Heart Rate",
  power_zone: "Power Zone",
  power: "Custom Power",
};
