import { useEffect, useState } from "react";
import { listGarminWorkouts } from "../api/client";
import type { GarminWorkoutSummary } from "../api/types";

interface Props {
  // Bumped after a generate/push so the list refreshes.
  refreshKey: number;
  // Expand/collapse is controlled by the parent so it can size this pane
  // relative to its sibling (SavedWorkouts).
  open: boolean;
  onToggle: () => void;
}

export function GarminWorkouts({ refreshKey, open, onToggle }: Props) {
  const [items, setItems] = useState<GarminWorkoutSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listGarminWorkouts()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <section
      className={`card flex min-h-0 flex-col overflow-hidden p-0 ${open ? "flex-1" : "flex-none"}`}
    >
      <button
        type="button"
        className="sticky top-0 z-10 flex w-full items-center gap-2 rounded-t-xl border-b border-slate-800 bg-surface-800 px-4 py-3 text-left"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span
          className={`inline-block text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▸
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Workouts on Garmin
        </h2>
        <span className="ml-auto text-xs text-slate-500">
          {items ? `${items.length} total` : "loading…"}
        </span>
      </button>
      {open && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {error && <p className="text-sm text-slate-400">Daten konnten nicht geladen werden</p>}
          {items && items.length === 0 && (
            <p className="text-sm text-slate-500">No workouts on Garmin yet.</p>
          )}
          {items && items.length > 0 && (
            <ul className="divide-y divide-slate-800">
              {items.map((row) => (
                <li key={row.id}>
                  <div className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm text-slate-200">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{row.name}</div>
                      <div className="text-xs text-slate-500">
                        {row.sport ?? "unknown"} · {formatDate(row.updated_at ?? row.created_at)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
