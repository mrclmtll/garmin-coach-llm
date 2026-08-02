import { useEffect, useRef, useState } from "react";
import type { Sport, Step, StepRole } from "../api/types";
import { blankStep, STEP_ROLE_LABELS } from "../lib/steps";

// One option per backend role (STEP_ROLE_LABELS mirrors StepRole in
// app/schemas/workout.py), nothing UI-only. Finer distinctions that aren't a
// distinct Garmin step type (e.g. "Walk") belong in the step's own
// label/notes, not in a separate role.
const ROLES: { label: string; role: StepRole }[] = (
  Object.keys(STEP_ROLE_LABELS) as StepRole[]
).map((role) => ({ role, label: STEP_ROLE_LABELS[role] }));

interface Props {
  sport: Sport;
  onAdd: (step: Step) => void;
}

export function AddSectionButton({ sport, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // See PushButton for why this is a document listener rather than a
  // `fixed inset-0` overlay.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const choose = (role: StepRole) => {
    setOpen(false);
    onAdd(blankStep(sport, role));
  };

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
        className="btn-primary"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        + Add section
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-2 w-48 overflow-hidden rounded-lg border border-slate-700 bg-surface-800 shadow-lg">
          {ROLES.map(({ label, role }) => (
            <button
              key={role}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-surface-700"
              onClick={() => choose(role)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
