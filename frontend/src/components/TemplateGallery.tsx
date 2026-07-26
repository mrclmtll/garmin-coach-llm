import { useEffect, useState } from "react";
import { listWorkoutTemplates } from "../api/client";
import type { Sport, WorkoutTemplate } from "../api/types";

interface Props {
  sport: Sport;
  onSelect: (template: WorkoutTemplate) => void;
}

export function TemplateGallery({ sport, onSelect }: Props) {
  const [templates, setTemplates] = useState<WorkoutTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listWorkoutTemplates()
      .then((rows) => {
        if (!cancelled) setTemplates(rows);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = templates?.filter((tpl) => tpl.workout.sport === sport) ?? null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">Pick a starting point — you can edit every step after loading it.</p>
      {error && <p className="text-sm text-slate-400">Templates could not be loaded</p>}
      {filtered === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {filtered && filtered.length === 0 && (
        <p className="text-sm text-slate-500">No {sport} templates available yet.</p>
      )}
      {filtered && filtered.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {filtered.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              className="card w-64 shrink-0 snap-start space-y-2 text-left transition-colors hover:border-accent-500"
            >
              <span className="inline-block rounded-full bg-surface-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-400">
                {tpl.category}
              </span>
              <div className="font-medium text-slate-100">{tpl.name}</div>
              <p className="text-xs text-slate-400">{tpl.structure}</p>
              <p className="text-xs text-slate-500">Intensity: {tpl.intensity}</p>
              <p className="text-xs text-slate-500">{tpl.purpose}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
