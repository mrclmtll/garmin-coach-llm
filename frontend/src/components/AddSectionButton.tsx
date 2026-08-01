import { useEffect, useRef, useState } from "react";
import type { Sport, Step, StepRole } from "../api/types";
import { blankStep } from "../lib/steps";

// Mirrors StepRole in app/schemas/workout.py — one option per backend role,
// nothing UI-only. Finer distinctions (e.g. "Walk" vs "Recovery") belong in
// the step's own label/notes, not in a separate role.
const ROLES: { label: string; role: StepRole }[] = [
  { label: "Warmup", role: "warmup" },
  { label: "Work", role: "work" },
  { label: "Recovery", role: "recovery" },
  { label: "Cooldown", role: "cooldown" },
];

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

  const choose = (role: StepRole, label: string) => {
    setOpen(false);
    onAdd(blankStep(sport, role, label));
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
              onClick={() => choose(role, label)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
