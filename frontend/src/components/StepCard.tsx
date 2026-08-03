import type { Goal, Step, SwimEquipment, SwimStroke, Target } from "../api/types";
import { formatGoal, formatTarget } from "../api/format";
import {
  GOAL_KIND_LABELS,
  STEP_ROLE_STYLES,
  stepRoleLabel,
  SWIM_EQUIPMENT_LABELS,
  SWIM_STROKE_LABELS,
} from "../lib/steps";
import { TargetEditor } from "./TargetEditor";

interface Props {
  step: Step;
  onChange: (next: Step) => void;
  onRemove: () => void;
}

const ROLES = ["warmup", "work", "recovery", "rest", "other", "cooldown"] as const;
const STROKES = ["choice", "freestyle", "backstroke", "breaststroke", "butterfly", "im", "im_ladder", "im_reverse", "various"] as const;
const EQUIPMENT = ["fins", "kickboard", "paddles", "pull_buoy", "snorkel"] as const;
// Swimming has no calories/heart_rate/power end condition. Cycling adds
// power (ends once power reaches a threshold) on top of the running set.
const GOAL_KINDS_BY_SPORT: Record<Step["sport"], Goal["kind"][]> = {
  running: ["time", "distance", "lap_button", "calories", "heart_rate"],
  cycling: ["time", "distance", "lap_button", "calories", "heart_rate", "power"],
  swimming: ["time", "distance", "lap_button"],
};
// Steps inherit their sport from the workout (set once via the sport toggle)
// — it isn't editable per step, since a workout is pushed to Garmin as a
// single sport regardless of what any individual step says.
const TARGET_KINDS_BY_SPORT: Record<Step["sport"], Target["kind"][]> = {
  running: ["pace", "cadence", "hr_zone", "hr_custom", "no_target"],
  swimming: ["swim_pace", "swim_css_pace", "swim_effort", "no_target"],
  cycling: ["speed", "cadence", "power_curve", "power_zone", "power", "hr_zone", "hr_custom", "no_target"],
};

function defaultTargetForKind(kind: Target["kind"]): Target {
  switch (kind) {
    case "pace":
      return { kind: "pace", min_sec_per_km: 300, max_sec_per_km: 270 };
    case "speed":
      return { kind: "speed", min_kmh: 28, max_kmh: 32 };
    case "power":
      return { kind: "power", min_watts: 200, max_watts: 250 };
    case "power_zone":
      return { kind: "power_zone", zone: 3 };
    case "cadence":
      return { kind: "cadence", min_cadence: 170, max_cadence: 180 };
    case "hr_zone":
      return { kind: "hr_zone", zone: 2 };
    case "hr_custom":
      return { kind: "hr_custom", min_bpm: 140, max_bpm: 160 };
    case "no_target":
      return { kind: "no_target" };
    case "swim_pace":
      return { kind: "swim_pace", sec_per_100m: 120 }; // 2:00/100m — Garmin's own default
    case "swim_css_pace":
      return { kind: "swim_css_pace", offset_seconds: 0 };
    case "swim_effort":
      return { kind: "swim_effort", level: "moderate" };
    case "power_curve":
      return { kind: "power_curve", interval: "20min", percent: 100 };
  }
}

function defaultGoalForKind(kind: Goal["kind"], current: Goal): Goal {
  switch (kind) {
    case "time":
      return { kind: "time", value: current.kind === "time" ? current.value : 300 };
    case "distance":
      return { kind: "distance", value: current.kind === "distance" ? current.value : 1000 };
    case "lap_button":
      return { kind: "lap_button" };
    case "calories":
      return { kind: "calories", value: current.kind === "calories" ? current.value : 200 };
    case "heart_rate":
      return { kind: "heart_rate", value: current.kind === "heart_rate" ? current.value : 160 };
    case "power":
      return { kind: "power", value: current.kind === "power" ? current.value : 300 };
  }
}

export function StepCard({ step, onChange, onRemove }: Props) {
  const set = <K extends keyof Step>(key: K, value: Step[K]) => onChange({ ...step, [key]: value });

  const setGoalKind = (kind: Goal["kind"]) => onChange({ ...step, goal: defaultGoalForKind(kind, step.goal) });

  // Clearing the primary target also clears the secondary one — Garmin
  // grays out "Sekundäres Ziel" whenever no primary target is selected.
  const setTargetKind = (kind: Target["kind"]) =>
    onChange({
      ...step,
      target: defaultTargetForKind(kind),
      secondary_target: kind === "no_target" ? null : step.secondary_target,
    });
  const setSecondaryTargetKind = (kind: Target["kind"]) =>
    onChange({ ...step, secondary_target: defaultTargetForKind(kind) });

  const targetKinds = TARGET_KINDS_BY_SPORT[step.sport];
  const goalKinds = GOAL_KINDS_BY_SPORT[step.sport];
  const isCycling = step.sport === "cycling";
  const secondaryDisabled = step.target.kind === "no_target";
  const secondaryTarget = step.secondary_target ?? { kind: "no_target" as const };
  // Power curve has no confirmed shape as a *secondary* target (only ever
  // observed as primary), so it's left out here even though Garmin's own
  // dropdown lists it.
  const secondaryKinds = targetKinds.filter((k) => k !== step.target.kind && k !== "power_curve");

  const roleStyle = STEP_ROLE_STYLES[step.role];

  return (
    <div className={`card space-y-3 border-l-4 ${roleStyle.border}`}>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${roleStyle.text}`}>{stepRoleLabel(step.role, step.sport)}</span>
        <button className="btn-ghost ml-2" onClick={onRemove} aria-label="Remove step">
          ×
        </button>
      </div>

      <textarea
        className="input w-48 resize-y pb-5 leading-snug"
        rows={3}
        value={step.label}
        onChange={(e) => set("label", e.target.value)}
        placeholder="Notes"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Step Type</label>
          <select className="input" value={step.role} onChange={(e) => set("role", e.target.value as Step["role"])}>
            {ROLES.map((r) => <option key={r} value={r}>{stepRoleLabel(r, step.sport)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Duration</label>
          <select className="input" value={step.goal.kind} onChange={(e) => setGoalKind(e.target.value as Goal["kind"])}>
            {goalKinds.map((k) => <option key={k} value={k}>{GOAL_KIND_LABELS[k]}</option>)}
          </select>
        </div>
        {step.goal.kind !== "lap_button" && (
          <div>
            <label className="label">
              {step.goal.kind === "time" && "Seconds"}
              {step.goal.kind === "distance" && "Meters"}
              {step.goal.kind === "calories" && "kcal"}
              {step.goal.kind === "heart_rate" && "Target bpm"}
              {step.goal.kind === "power" && "Target watts"}
            </label>
            <input
              className="input"
              type="number"
              min={0}
              value={step.goal.value}
              onChange={(e) => {
                if (step.goal.kind === "lap_button") return;
                onChange({ ...step, goal: { ...step.goal, value: Number(e.target.value) } });
              }}
            />
          </div>
        )}
      </div>

      {step.sport === "swimming" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Stroke</label>
            <select
              className="input"
              value={step.stroke ?? ""}
              onChange={(e) => set("stroke", (e.target.value || null) as SwimStroke | null)}
            >
              <option value="">—</option>
              {STROKES.map((s) => <option key={s} value={s}>{SWIM_STROKE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Equipment</label>
            <select
              className="input"
              value={step.equipment ?? ""}
              onChange={(e) => set("equipment", (e.target.value || null) as SwimEquipment | null)}
            >
              <option value="">—</option>
              {EQUIPMENT.map((eq) => <option key={eq} value={eq}>{SWIM_EQUIPMENT_LABELS[eq]}</option>)}
            </select>
          </div>
        </div>
      )}

      <TargetEditor
        label="Target"
        target={step.target}
        targetKinds={targetKinds}
        onKindChange={setTargetKind}
        onChange={(next) => set("target", next)}
      />

      {isCycling && (
        <TargetEditor
          label="Secondary Target"
          target={secondaryTarget}
          targetKinds={secondaryKinds}
          disabled={secondaryDisabled}
          onKindChange={setSecondaryTargetKind}
          onChange={(next) => set("secondary_target", next)}
        />
      )}

      <p className="text-xs text-slate-500">
        {formatGoal(step.goal)} · {formatTarget(step.target)}
        {step.secondary_target && step.secondary_target.kind !== "no_target" && ` · ${formatTarget(step.secondary_target)}`}
      </p>
    </div>
  );
}
