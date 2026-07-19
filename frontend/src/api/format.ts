export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

export function formatGoal(goal: { kind: "time" | "distance"; value: number }): string {
  if (goal.kind === "time") {
    const m = Math.floor(goal.value / 60);
    const s = Math.round(goal.value % 60);
    return s === 0 ? `${m} min` : `${m}:${s.toString().padStart(2, "0")} min`;
  }
  return goal.value >= 1000 ? `${(goal.value / 1000).toFixed(1)} km` : `${goal.value} m`;
}

export function formatTarget(target: {
  kind: "pace" | "power" | "hr_zone";
  min_sec_per_km?: number;
  max_sec_per_km?: number;
  min_watts?: number;
  max_watts?: number;
  zone?: number;
}): string {
  if (target.kind === "pace") {
    return `${formatPace(target.min_sec_per_km!)} – ${formatPace(target.max_sec_per_km!)}`;
  }
  if (target.kind === "power") {
    return `${target.min_watts}–${target.max_watts} W`;
  }
  return `Zone ${target.zone}`;
}
