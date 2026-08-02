import type { Goal, Step, SwimEffort, SwimEquipment, SwimStroke, Target } from "../api/types";
import { formatGoal, formatPace, formatSwimPace, formatTarget } from "../api/format";
import {
  GOAL_KIND_LABELS,
  STEP_ROLE_STYLES,
  stepRoleLabel,
  SWIM_EFFORT_LABELS,
  SWIM_EQUIPMENT_LABELS,
  SWIM_STROKE_LABELS,
  TARGET_KIND_LABELS,
} from "../lib/steps";

interface Props {
  step: Step;
  onChange: (next: Step) => void;
  onRemove: () => void;
}

const ROLES = ["warmup", "work", "recovery", "rest", "other", "cooldown"] as const;
const STROKES = ["choice", "freestyle", "backstroke", "breaststroke", "butterfly", "im", "im_ladder", "im_reverse", "various"] as const;
const EQUIPMENT = ["fins", "kickboard", "paddles", "pull_buoy", "snorkel"] as const;
const EFFORTS = ["recovery", "easy", "moderate", "hard", "very_hard", "maximum", "ascending", "descending"] as const;
// Swimming has no calories/heart_rate end condition, and only accepts pace
// as an intensity target (no HR zone, no cadence) — confirmed against
// Garmin Connect's own swim editor.
const GOAL_KINDS_BY_SPORT: Record<Step["sport"], Goal["kind"][]> = {
  running: ["time", "distance", "lap_button", "calories", "heart_rate"],
  cycling: ["time", "distance", "lap_button", "calories", "heart_rate"],
  swimming: ["time", "distance", "lap_button"],
};
// Steps inherit their sport from the workout (set once via the sport toggle)
// — it isn't editable per step, since a workout is pushed to Garmin as a
// single sport regardless of what any individual step says.
const TARGET_KINDS_BY_SPORT: Record<Step["sport"], Target["kind"][]> = {
  running: ["pace", "cadence", "hr_zone", "hr_custom", "no_target"],
  swimming: ["swim_pace", "swim_css_pace", "swim_effort", "no_target"],
  cycling: ["power", "power_zone", "cadence", "hr_zone", "hr_custom", "no_target"],
};

function defaultTargetForKind(kind: Target["kind"]): Target {
  switch (kind) {
    case "pace":
      return { kind: "pace", min_sec_per_km: 300, max_sec_per_km: 270 };
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
  }
}

export function StepCard({ step, onChange, onRemove }: Props) {
  const set = <K extends keyof Step>(key: K, value: Step[K]) => onChange({ ...step, [key]: value });

  const setGoalKind = (kind: Goal["kind"]) => onChange({ ...step, goal: defaultGoalForKind(kind, step.goal) });
  const setTargetKind = (kind: Target["kind"]) => onChange({ ...step, target: defaultTargetForKind(kind) });

  const targetKinds = TARGET_KINDS_BY_SPORT[step.sport];
  const goalKinds = GOAL_KINDS_BY_SPORT[step.sport];

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

      <div>
        <label className="label">Target</label>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={step.target.kind} onChange={(e) => setTargetKind(e.target.value as Target["kind"])}>
            {targetKinds.map((k) => <option key={k} value={k}>{TARGET_KIND_LABELS[k]}</option>)}
          </select>
          <span className="text-sm text-slate-300">{formatTarget(step.target)}</span>
        </div>
        {step.target.kind === "pace" && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label className="label">min (sec/km)</label>
              <input
                className="input"
                type="number"
                value={step.target.min_sec_per_km}
                onChange={(e) => {
                  if (step.target.kind !== "pace") return;
                  onChange({ ...step, target: { ...step.target, min_sec_per_km: Number(e.target.value) } });
                }}
              />
              <p className="mt-1 text-xs text-slate-500">{formatPace(step.target.min_sec_per_km)}</p>
            </div>
            <div>
              <label className="label">max (sec/km)</label>
              <input
                className="input"
                type="number"
                value={step.target.max_sec_per_km}
                onChange={(e) => {
                  if (step.target.kind !== "pace") return;
                  onChange({ ...step, target: { ...step.target, max_sec_per_km: Number(e.target.value) } });
                }}
              />
              <p className="mt-1 text-xs text-slate-500">{formatPace(step.target.max_sec_per_km)}</p>
            </div>
          </div>
        )}
        {step.target.kind === "power" && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label className="label">min watts</label>
              <input
                className="input"
                type="number"
                value={step.target.min_watts}
                onChange={(e) => {
                  if (step.target.kind !== "power") return;
                  onChange({ ...step, target: { ...step.target, min_watts: Number(e.target.value) } });
                }}
              />
            </div>
            <div>
              <label className="label">max watts</label>
              <input
                className="input"
                type="number"
                value={step.target.max_watts}
                onChange={(e) => {
                  if (step.target.kind !== "power") return;
                  onChange({ ...step, target: { ...step.target, max_watts: Number(e.target.value) } });
                }}
              />
            </div>
          </div>
        )}
        {step.target.kind === "power_zone" && (
          <div className="mt-2 w-32">
            <label className="label">Zone</label>
            <select
              className="input"
              value={step.target.zone}
              onChange={(e) => {
                if (step.target.kind !== "power_zone") return;
                onChange({ ...step, target: { ...step.target, zone: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 | 7 } });
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        )}
        {step.target.kind === "cadence" && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label className="label">min (spm/rpm)</label>
              <input
                className="input"
                type="number"
                value={step.target.min_cadence}
                onChange={(e) => {
                  if (step.target.kind !== "cadence") return;
                  onChange({ ...step, target: { ...step.target, min_cadence: Number(e.target.value) } });
                }}
              />
            </div>
            <div>
              <label className="label">max (spm/rpm)</label>
              <input
                className="input"
                type="number"
                value={step.target.max_cadence}
                onChange={(e) => {
                  if (step.target.kind !== "cadence") return;
                  onChange({ ...step, target: { ...step.target, max_cadence: Number(e.target.value) } });
                }}
              />
            </div>
          </div>
        )}
        {step.target.kind === "hr_zone" && (
          <div className="mt-2 w-32">
            <label className="label">Zone</label>
            <select
              className="input"
              value={step.target.zone}
              onChange={(e) => {
                if (step.target.kind !== "hr_zone") return;
                onChange({ ...step, target: { ...step.target, zone: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 } });
              }}
            >
              {[1, 2, 3, 4, 5].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        )}
        {step.target.kind === "hr_custom" && (
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label className="label">min bpm</label>
              <input
                className="input"
                type="number"
                value={step.target.min_bpm}
                onChange={(e) => {
                  if (step.target.kind !== "hr_custom") return;
                  onChange({ ...step, target: { ...step.target, min_bpm: Number(e.target.value) } });
                }}
              />
            </div>
            <div>
              <label className="label">max bpm</label>
              <input
                className="input"
                type="number"
                value={step.target.max_bpm}
                onChange={(e) => {
                  if (step.target.kind !== "hr_custom") return;
                  onChange({ ...step, target: { ...step.target, max_bpm: Number(e.target.value) } });
                }}
              />
            </div>
          </div>
        )}
        {step.target.kind === "swim_pace" && (
          <div className="mt-2 w-40">
            <label className="label">sec / 100m</label>
            <input
              className="input"
              type="number"
              value={step.target.sec_per_100m}
              onChange={(e) => {
                if (step.target.kind !== "swim_pace") return;
                onChange({ ...step, target: { ...step.target, sec_per_100m: Number(e.target.value) } });
              }}
            />
            <p className="mt-1 text-xs text-slate-500">{formatSwimPace(step.target.sec_per_100m)}</p>
          </div>
        )}
        {step.target.kind === "swim_css_pace" && (
          <div className="mt-2 w-40">
            <label className="label">Offset (sec)</label>
            <input
              className="input"
              type="number"
              value={step.target.offset_seconds}
              onChange={(e) => {
                if (step.target.kind !== "swim_css_pace") return;
                onChange({ ...step, target: { ...step.target, offset_seconds: Number(e.target.value) } });
              }}
            />
            <p className="mt-1 text-xs text-slate-500">Relative to your device's Critical Swim Speed</p>
          </div>
        )}
        {step.target.kind === "swim_effort" && (
          <div className="mt-2 w-48">
            <label className="label">Level</label>
            <select
              className="input"
              value={step.target.level}
              onChange={(e) => {
                if (step.target.kind !== "swim_effort") return;
                onChange({ ...step, target: { ...step.target, level: e.target.value as SwimEffort } });
              }}
            >
              {EFFORTS.map((l) => <option key={l} value={l}>{SWIM_EFFORT_LABELS[l]}</option>)}
            </select>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {formatGoal(step.goal)} · {formatTarget(step.target)}
      </p>
    </div>
  );
}
