import type { RepeatBlock, Sport, Step } from "../api/types";
import { dragHandleClassName, dragRowClassName, useDragReorder } from "../hooks/useDragReorder";
import { blankStep } from "../lib/steps";
import { StepCard } from "./StepCard";

interface Props {
  block: RepeatBlock;
  sport: Sport;
  onChange: (next: RepeatBlock) => void;
  onRemove: () => void;
}

export function RepeatBlockView({ block, sport, onChange, onRemove }: Props) {
  const updateStep = (i: number, next: Step) =>
    onChange({ ...block, steps: block.steps.map((s, idx) => (idx === i ? next : s)) });
  const removeStep = (i: number) =>
    onChange({ ...block, steps: block.steps.filter((_, idx) => idx !== i) });
  const addStep = () =>
    onChange({ ...block, steps: [...block.steps, blankStep(sport, "work")] });
  const moveStep = (from: number, to: number) => {
    if (from === to) return;
    const next = [...block.steps];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange({ ...block, steps: next });
  };
  const { draggedIndex, dragOverIndex, startDrag } = useDragReorder("data-step-index", moveStep);

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
          <div
            key={i}
            data-step-index={i}
            className={dragRowClassName(draggedIndex === i, dragOverIndex === i && draggedIndex !== null && draggedIndex !== i)}
          >
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                startDrag(i, e);
              }}
              className={dragHandleClassName}
              aria-label="Drag to reorder"
            >
              ⠿
            </div>
            <div className="min-w-0 flex-1">
              <StepCard step={s} onChange={(next) => updateStep(i, next)} onRemove={() => removeStep(i)} />
            </div>
          </div>
        ))}
        <button className="btn-ghost" onClick={addStep}>+ Add step</button>
      </div>
    </div>
  );
}
