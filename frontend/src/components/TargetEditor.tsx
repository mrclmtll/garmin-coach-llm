import type { PowerCurveInterval, SwimEffort, Target } from "../api/types";
import { formatPace, formatSwimPace, formatTarget } from "../api/format";
import { POWER_CURVE_INTERVAL_LABELS, SWIM_EFFORT_LABELS, TARGET_KIND_LABELS } from "../lib/steps";

const EFFORTS = ["recovery", "easy", "moderate", "hard", "very_hard", "maximum", "ascending", "descending"] as const;
const POWER_CURVE_INTERVALS = ["5s", "10s", "20s", "30s", "1min", "2min", "5min", "10min", "20min", "30min", "1hour"] as const;

interface Props {
  label: string;
  target: Target;
  targetKinds: Target["kind"][];
  onKindChange: (kind: Target["kind"]) => void;
  onChange: (next: Target) => void;
  disabled?: boolean;
}

// Renders a target-kind picker plus whichever kind-specific fields apply.
// Used for both a step's primary target and (cycling only) its secondary
// target, so the ~10 target kinds only need their fields written once.
export function TargetEditor({ label, target, targetKinds, onKindChange, onChange, disabled }: Props) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="input w-auto"
          value={target.kind}
          disabled={disabled}
          onChange={(e) => onKindChange(e.target.value as Target["kind"])}
        >
          {targetKinds.map((k) => <option key={k} value={k}>{TARGET_KIND_LABELS[k]}</option>)}
        </select>
        <span className="text-sm text-slate-300">{formatTarget(target)}</span>
      </div>
      {target.kind === "pace" && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className="label">min (sec/km)</label>
            <input
              className="input"
              type="number"
              value={target.min_sec_per_km}
              onChange={(e) => {
                if (target.kind !== "pace") return;
                onChange({ ...target, min_sec_per_km: Number(e.target.value) });
              }}
            />
            <p className="mt-1 text-xs text-slate-500">{formatPace(target.min_sec_per_km)}</p>
          </div>
          <div>
            <label className="label">max (sec/km)</label>
            <input
              className="input"
              type="number"
              value={target.max_sec_per_km}
              onChange={(e) => {
                if (target.kind !== "pace") return;
                onChange({ ...target, max_sec_per_km: Number(e.target.value) });
              }}
            />
            <p className="mt-1 text-xs text-slate-500">{formatPace(target.max_sec_per_km)}</p>
          </div>
        </div>
      )}
      {target.kind === "speed" && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className="label">min km/h</label>
            <input
              className="input"
              type="number"
              value={target.min_kmh}
              onChange={(e) => {
                if (target.kind !== "speed") return;
                onChange({ ...target, min_kmh: Number(e.target.value) });
              }}
            />
          </div>
          <div>
            <label className="label">max km/h</label>
            <input
              className="input"
              type="number"
              value={target.max_kmh}
              onChange={(e) => {
                if (target.kind !== "speed") return;
                onChange({ ...target, max_kmh: Number(e.target.value) });
              }}
            />
          </div>
        </div>
      )}
      {target.kind === "power" && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className="label">min watts</label>
            <input
              className="input"
              type="number"
              value={target.min_watts}
              onChange={(e) => {
                if (target.kind !== "power") return;
                onChange({ ...target, min_watts: Number(e.target.value) });
              }}
            />
          </div>
          <div>
            <label className="label">max watts</label>
            <input
              className="input"
              type="number"
              value={target.max_watts}
              onChange={(e) => {
                if (target.kind !== "power") return;
                onChange({ ...target, max_watts: Number(e.target.value) });
              }}
            />
          </div>
        </div>
      )}
      {target.kind === "power_zone" && (
        <div className="mt-2 w-32">
          <label className="label">Zone</label>
          <select
            className="input"
            value={target.zone}
            onChange={(e) => {
              if (target.kind !== "power_zone") return;
              onChange({ ...target, zone: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6 | 7 });
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      )}
      {target.kind === "cadence" && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className="label">min (spm/rpm)</label>
            <input
              className="input"
              type="number"
              value={target.min_cadence}
              onChange={(e) => {
                if (target.kind !== "cadence") return;
                onChange({ ...target, min_cadence: Number(e.target.value) });
              }}
            />
          </div>
          <div>
            <label className="label">max (spm/rpm)</label>
            <input
              className="input"
              type="number"
              value={target.max_cadence}
              onChange={(e) => {
                if (target.kind !== "cadence") return;
                onChange({ ...target, max_cadence: Number(e.target.value) });
              }}
            />
          </div>
        </div>
      )}
      {target.kind === "hr_zone" && (
        <div className="mt-2 w-32">
          <label className="label">Zone</label>
          <select
            className="input"
            value={target.zone}
            onChange={(e) => {
              if (target.kind !== "hr_zone") return;
              onChange({ ...target, zone: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 });
            }}
          >
            {[1, 2, 3, 4, 5].map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      )}
      {target.kind === "hr_custom" && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className="label">min bpm</label>
            <input
              className="input"
              type="number"
              value={target.min_bpm}
              onChange={(e) => {
                if (target.kind !== "hr_custom") return;
                onChange({ ...target, min_bpm: Number(e.target.value) });
              }}
            />
          </div>
          <div>
            <label className="label">max bpm</label>
            <input
              className="input"
              type="number"
              value={target.max_bpm}
              onChange={(e) => {
                if (target.kind !== "hr_custom") return;
                onChange({ ...target, max_bpm: Number(e.target.value) });
              }}
            />
          </div>
        </div>
      )}
      {target.kind === "swim_pace" && (
        <div className="mt-2 w-40">
          <label className="label">sec / 100m</label>
          <input
            className="input"
            type="number"
            value={target.sec_per_100m}
            onChange={(e) => {
              if (target.kind !== "swim_pace") return;
              onChange({ ...target, sec_per_100m: Number(e.target.value) });
            }}
          />
          <p className="mt-1 text-xs text-slate-500">{formatSwimPace(target.sec_per_100m)}</p>
        </div>
      )}
      {target.kind === "swim_css_pace" && (
        <div className="mt-2 w-40">
          <label className="label">Offset (sec)</label>
          <input
            className="input"
            type="number"
            value={target.offset_seconds}
            onChange={(e) => {
              if (target.kind !== "swim_css_pace") return;
              onChange({ ...target, offset_seconds: Number(e.target.value) });
            }}
          />
          <p className="mt-1 text-xs text-slate-500">Relative to your device's Critical Swim Speed</p>
        </div>
      )}
      {target.kind === "swim_effort" && (
        <div className="mt-2 w-48">
          <label className="label">Level</label>
          <select
            className="input"
            value={target.level}
            onChange={(e) => {
              if (target.kind !== "swim_effort") return;
              onChange({ ...target, level: e.target.value as SwimEffort });
            }}
          >
            {EFFORTS.map((l) => <option key={l} value={l}>{SWIM_EFFORT_LABELS[l]}</option>)}
          </select>
        </div>
      )}
      {target.kind === "power_curve" && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label className="label">Interval</label>
            <select
              className="input"
              value={target.interval}
              onChange={(e) => {
                if (target.kind !== "power_curve") return;
                onChange({ ...target, interval: e.target.value as PowerCurveInterval });
              }}
            >
              {POWER_CURVE_INTERVALS.map((i) => <option key={i} value={i}>{POWER_CURVE_INTERVAL_LABELS[i]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Target (% of interval)</label>
            <input
              className="input"
              type="number"
              value={target.percent}
              onChange={(e) => {
                if (target.kind !== "power_curve") return;
                onChange({ ...target, percent: Number(e.target.value) });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
