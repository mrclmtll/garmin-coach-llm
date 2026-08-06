import type { Goal, PowerCurveInterval, SwimDrillType, SwimEffort, SwimEquipment, SwimStroke, Sport, Step, StepRole, Target } from "../api/types";

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
    stroke: null,
    equipment: null,
    drill: null,
    secondary_target: null,
  };
}

// Swim sets are almost always followed by a rest until the athlete presses
// lap — so every swim block (a "Swim" section, or one repetition of a
// repeat block) gets one of these tacked on automatically.
export function blankSwimPauseStep(): Step {
  return {
    kind: "step",
    label: "",
    goal: { kind: "lap_button" },
    target: { kind: "no_target" },
    role: "rest",
    sport: "swimming",
    stroke: null,
    equipment: null,
    drill: null,
    secondary_target: null,
  };
}

// A swim block is a Swim step immediately followed by a rest-until-lap —
// this is what every "add a swim section" entry point produces.
export function blankSwimBlock(): Step[] {
  return [blankStep("swimming", "work"), blankSwimPauseStep()];
}

// Garmin's own labels for the "Step Type" dropdown. Garmin Connect's own
// editor round-trips "Walk" as the exact same stepType as "Run" (interval/3),
// and "Schwimmen" (Swim) as the same id for swimming — confirmed via the
// API — so neither is a separate role here. Use "work" for all of them and
// tell them apart via the step's label. The label itself is sport-dependent
// (see stepRoleLabel below) since Garmin calls this role "Run" for running
// and "Swim" for swimming.
export const STEP_ROLE_LABELS: Record<StepRole, string> = {
  warmup: "Warmup",
  work: "Run",
  recovery: "Recovery",
  rest: "Rest",
  other: "Other",
  cooldown: "Cool Down",
};

export function stepRoleLabel(role: StepRole, sport: Sport): string {
  if (role !== "work") return STEP_ROLE_LABELS[role];
  if (sport === "swimming") return "Swim";
  if (sport === "cycling") return "Ride";
  return STEP_ROLE_LABELS[role];
}

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
  power: "Power",
};

export const TARGET_KIND_LABELS: Record<Target["kind"], string> = {
  no_target: "No Target",
  pace: "Pace",
  cadence: "Cadence",
  hr_zone: "Heart Rate Zone",
  hr_custom: "Custom Heart Rate",
  power_zone: "Power Zone",
  power: "Custom Power",
  swim_pace: "Target Pace",
  swim_css_pace: "CSS-Based Target Pace",
  swim_effort: "Effort-Based",
  speed: "Speed",
  power_curve: "Power Curve",
};

// Garmin's fixed set of power-curve interval durations — same 11 options as
// the "Leistungskurveninterval" dropdown, confirmed against a workout
// created directly in Garmin Connect's own cycling editor.
export const POWER_CURVE_INTERVAL_LABELS: Record<PowerCurveInterval, string> = {
  "5s": "5 sec",
  "10s": "10 sec",
  "20s": "20 sec",
  "30s": "30 sec",
  "1min": "1 min",
  "2min": "2 min",
  "5min": "5 min",
  "10min": "10 min",
  "20min": "20 min",
  "30min": "30 min",
  "1hour": "1 hour",
};

// Swimming only. Ids confirmed by round-tripping candidates through Garmin
// Connect's own editor — id 4 ("Choice + Drill") isn't one of the 9 real
// choices and is deliberately left unexposed.
export const SWIM_STROKE_LABELS: Record<SwimStroke, string> = {
  choice: "Choice",
  freestyle: "Freestyle",
  backstroke: "Backstroke",
  breaststroke: "Breaststroke",
  butterfly: "Butterfly",
  im: "Individual Medley",
  im_ladder: "Individual Medley Ladder",
  im_reverse: "Individual Medley Reverse Order",
  various: "Various",
};

export const SWIM_EQUIPMENT_LABELS: Record<SwimEquipment, string> = {
  fins: "Fins",
  kickboard: "Kickboard",
  paddles: "Paddles",
  pull_buoy: "Pull Buoy",
  snorkel: "Snorkel",
};

// Garmin's "Übungstyp" (exercise type) dropdown — separate from stroke and
// equipment. Ids confirmed against Garmin Connect's own editor (see backend
// docstring).
export const SWIM_DRILL_TYPE_LABELS: Record<SwimDrillType, string> = {
  kick: "Kick",
  pull: "Pull",
  drill: "Drill",
};

// Effort-based swim target levels. Ids confirmed by round-tripping all 8
// through Garmin Connect's own editor — ids 2 and 8 don't correspond to any
// of these and are left out.
export const SWIM_EFFORT_LABELS: Record<SwimEffort, string> = {
  recovery: "Recovery",
  easy: "Easy",
  moderate: "Moderate",
  hard: "Hard",
  very_hard: "Very Hard",
  maximum: "Maximum",
  ascending: "Ascending",
  descending: "Descending",
};
