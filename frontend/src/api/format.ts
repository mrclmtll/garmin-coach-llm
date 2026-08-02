export function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

import type { Goal, Target } from "./types";

export function formatGoal(goal: Goal): string {
  if (goal.kind === "time") {
    const m = Math.floor(goal.value / 60);
    const s = Math.round(goal.value % 60);
    return s === 0 ? `${m} min` : `${m}:${s.toString().padStart(2, "0")} min`;
  }
  if (goal.kind === "distance") {
    return goal.value >= 1000 ? `${(goal.value / 1000).toFixed(1)} km` : `${goal.value} m`;
  }
  if (goal.kind === "lap_button") return "Lap button";
  if (goal.kind === "calories") return `${goal.value} kcal`;
  return `HR ${goal.value} bpm`; // heart_rate
}

export function formatTarget(target: Target): string {
  switch (target.kind) {
    case "pace":
      return `${formatPace(target.min_sec_per_km)} – ${formatPace(target.max_sec_per_km)}`;
    case "power":
      return `${target.min_watts}–${target.max_watts} W`;
    case "power_zone":
      return `Power Zone ${target.zone}`;
    case "cadence":
      return `${target.min_cadence}–${target.max_cadence} spm`;
    case "hr_zone":
      return `HR Zone ${target.zone}`;
    case "hr_custom":
      return `${target.min_bpm}–${target.max_bpm} bpm`;
    case "no_target":
      return "No target";
  }
}
