import type { Step, Target } from "../api/types";
import { formatGoal, formatPace, formatTarget } from "../api/format";

interface Props {
  step: Step;
  onChange: (next: Step) => void;
  onRemove: () => void;
}

const SPORTS = ["running", "cycling", "swimming"] as const;
const ROLES = ["warmup", "work", "recovery", "cooldown"] as const;

function targetMatchesSport(target: Target, sport: string): boolean {
  if (target.kind === "pace") return sport === "running" || sport === "swimming";
  if (target.kind === "power") return sport === "cycling";
  return true;
}

function targetForSport(sport: string): Target {
  if (sport === "cycling") return { kind: "power", min_watts: 200, max_watts: 250 };
  if (sport === "running" || sport === "swimming")
    return { kind: "pace", min_sec_per_km: 300, max_sec_per_km: 270 };
  return { kind: "hr_zone", zone: 2 };
}

export function StepCard({ step, onChange, onRemove }: Props) {
  const set = <K extends keyof Step>(key: K, value: Step[K]) => onChange({ ...step, [key]: value });

  const setSport = (sport: Step["sport"]) => {
    const next: Step = { ...step, sport };
    if (!targetMatchesSport(step.target, sport)) next.target = targetForSport(sport);
    onChange(next);
  };

  const setGoalKind = (kind: "time" | "distance") =>
    onChange({ ...step, goal: { kind, value: step.goal.value } });

  const setTargetKind = (kind: Target["kind"]) => {
    if (kind === "pace") onChange({ ...step, target: { kind: "pace", min_sec_per_km: 300, max_sec_per_km: 270 } });
    if (kind === "power") onChange({ ...step, target: { kind: "power", min_watts: 200, max_watts: 250 } });
    if (kind === "hr_zone") onChange({ ...step, target: { kind: "hr_zone", zone: 2 } });
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <input
          className="input flex-1"
          value={step.label}
          onChange={(e) => set("label", e.target.value)}
          placeholder="Step label"
        />
        <button className="btn-ghost ml-2" onClick={onRemove} aria-label="Remove step">
          ×
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="label">Sport</label>
          <select className="input" value={step.sport} onChange={(e) => setSport(e.target.value as Step["sport"])}>
            {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={step.role} onChange={(e) => set("role", e.target.value as Step["role"])}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Goal kind</label>
          <select className="input" value={step.goal.kind} onChange={(e) => setGoalKind(e.target.value as "time" | "distance")}>
            <option value="time">time</option>
            <option value="distance">distance</option>
          </select>
        </div>
        <div>
          <label className="label">{step.goal.kind === "time" ? "Seconds" : "Meters"}</label>
          <input
            className="input"
            type="number"
            min={0}
            value={step.goal.value}
            onChange={(e) => onChange({ ...step, goal: { ...step.goal, value: Number(e.target.value) } })}
          />
        </div>
      </div>

      <div>
        <label className="label">Target</label>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={step.target.kind} onChange={(e) => setTargetKind(e.target.value as Target["kind"])}>
            <option value="pace">pace</option>
            <option value="power">power</option>
            <option value="hr_zone">hr_zone</option>
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
                onChange={(e) => onChange({ ...step, target: { ...step.target, min_sec_per_km: Number(e.target.value) } })}
              />
              <p className="mt-1 text-xs text-slate-500">{formatPace(step.target.min_sec_per_km)}</p>
            </div>
            <div>
              <label className="label">max (sec/km)</label>
              <input
                className="input"
                type="number"
                value={step.target.max_sec_per_km}
                onChange={(e) => onChange({ ...step, target: { ...step.target, max_sec_per_km: Number(e.target.value) } })}
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
                onChange={(e) => onChange({ ...step, target: { ...step.target, min_watts: Number(e.target.value) } })}
              />
            </div>
            <div>
              <label className="label">max watts</label>
              <input
                className="input"
                type="number"
                value={step.target.max_watts}
                onChange={(e) => onChange({ ...step, target: { ...step.target, max_watts: Number(e.target.value) } })}
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
              onChange={(e) => onChange({ ...step, target: { ...step.target, zone: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 } })}
            >
              {[1, 2, 3, 4, 5].map((z) => <option key={z} value={z}>{z}</option>)}
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
