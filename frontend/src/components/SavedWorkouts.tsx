import { useEffect, useState } from "react";
import { getWorkout, listWorkouts } from "../api/client";
import type { Workout, WorkoutSummary } from "../api/types";

interface Props {
  // Bumped after a generate/push so the list refreshes.
  refreshKey: number;
  // Set when a row is clicked; the parent uses it to load the full workout
  // into the editor.
  onLoad: (id: number, workout: Workout) => void;
  // Currently-loaded workout id, for highlighting the active row.
  activeId: number | null;
}

export function SavedWorkouts({ refreshKey, onLoad, activeId }: Props) {
  const [items, setItems] = useState<WorkoutSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    listWorkouts()
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

  const handleClick = async (id: number) => {
    setLoadingId(id);
    setError(null);
    try {
      const workout = await getWorkout(id);
      onLoad(id, workout);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Saved workouts
        </h2>
        <span className="text-xs text-slate-500">
          {items ? `${items.length} total` : "loading…"}
        </span>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {items && items.length === 0 && (
        <p className="text-sm text-slate-500">No saved workouts yet.</p>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y divide-slate-800">
          {items.map((row) => {
            const isActive = row.id === activeId;
            const isLoading = row.id === loadingId;
            return (
              <li key={row.id}>
                <button
                  className={`flex w-full items-center justify-between gap-3 py-2 text-left text-sm transition-colors ${
                    isActive ? "text-accent-400" : "text-slate-200 hover:text-accent-400"
                  }`}
                  onClick={() => handleClick(row.id)}
                  disabled={isLoading}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="text-xs text-slate-500">
                      {row.sport} · {row.source} · {formatDate(row.created_at)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    {row.garmin_workout_id ? (
                      <span className="text-emerald-400">pushed</span>
                    ) : (
                      <span className="text-slate-500">not pushed</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}
