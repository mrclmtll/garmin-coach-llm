import type { Sport, Step, StepRole, Target } from "../api/types";

export function defaultTargetForSport(sport: Sport): Target {
  if (sport === "cycling") return { kind: "power", min_watts: 200, max_watts: 250 };
  if (sport === "running" || sport === "swimming")
    return { kind: "pace", min_sec_per_km: 330, max_sec_per_km: 300 };
  return { kind: "hr_zone", zone: 2 };
}

export function blankStep(sport: Sport, role: StepRole, label: string = role): Step {
  return {
    kind: "step",
    label,
    goal: { kind: "time", value: 300 },
    target: defaultTargetForSport(sport),
    role,
    sport,
  };
}
