import type { RepeatBlock, Step } from "../api/types";
import { StepCard } from "./StepCard";

interface Props {
  block: RepeatBlock;
  onChange: (next: RepeatBlock) => void;
  onRemove: () => void;
}

export function RepeatBlockView({ block, onChange, onRemove }: Props) {
  const updateStep = (i: number, next: Step) =>
    onChange({ ...block, steps: block.steps.map((s, idx) => (idx === i ? next : s)) });
  const removeStep = (i: number) =>
    onChange({ ...block, steps: block.steps.filter((_, idx) => idx !== i) });
  const addStep = () =>
    onChange({
      ...block,
      steps: [
        ...block.steps,
        {
          kind: "step",
          label: "Work",
          goal: { kind: "time", value: 60 },
          target: { kind: "pace", min_sec_per_km: 300, max_sec_per_km: 270 },
          role: "work",
          sport: "running",
        },
      ],
    });

  return (
    <div className="card space-y-3 border-l-4 border-l-accent-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm uppercase tracking-wide text-accent-400">Repeat</span>
          <input
            className="input w-20"
            type="number"
            min={1}
            max={50}
            value={block.count}
            onChange={(e) => onChange({ ...block, count: Math.max(1, Number(e.target.value)) })}
          />
          <span className="text-sm text-slate-400">×</span>
        </div>
        <button className="btn-ghost" onClick={onRemove}>Remove block</button>
      </div>
      <div className="space-y-3 pl-2">
        {block.steps.map((s, i) => (
          <StepCard key={i} step={s} onChange={(next) => updateStep(i, next)} onRemove={() => removeStep(i)} />
        ))}
        <button className="btn-ghost" onClick={addStep}>+ Add step</button>
      </div>
    </div>
  );
}
