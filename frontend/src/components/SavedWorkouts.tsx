import { useCallback, useEffect, useRef, useState } from "react";
import { getWorkout, listWorkouts } from "../api/client";
import { formatDateTime } from "../api/format";
import type { Workout, WorkoutSummary } from "../api/types";
import { usePolling } from "../hooks/usePolling";
import { SportIcon } from "./SportIcon";

// Keeps the list current without a manual refresh, and re-tries promptly
// after a failed fetch or a stint in a background tab. While there's no data
// yet (e.g. the backend hasn't come up) or the last fetch failed, poll much
// faster so a slow/late-starting backend gets picked up within seconds
// instead of waiting out the full interval.
const POLL_INTERVAL_MS = 60_000;
const RETRY_INTERVAL_MS = 3_000;

interface Props {
  // Bumped after a generate/push so the list refreshes.
  refreshKey: number;
  // Set when a row is clicked; the parent uses it to load the full workout
  // into the editor.
  onLoad: (id: number, workout: Workout) => void;
  // Currently-loaded workout id, for highlighting the active row.
  activeId: number | null;
  // Expand/collapse is controlled by the parent so it can size this pane
  // relative to its sibling (GarminWorkouts).
  open: boolean;
  onToggle: () => void;
}

export function SavedWorkouts({ refreshKey, onLoad, activeId, open, onToggle }: Props) {
  const [items, setItems] = useState<WorkoutSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchItems = useCallback(() => {
    listWorkouts()
      .then((rows) => {
        if (mountedRef.current) {
          setItems(rows);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (mountedRef.current) setError(e.message);
      });
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  usePolling(fetchItems, items === null || error ? RETRY_INTERVAL_MS : POLL_INTERVAL_MS);

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
          Saved workouts
        </h2>
        <span className="ml-auto text-xs text-slate-500">
          {items ? `${items.length} total` : "loading…"}
        </span>
      </button>
      {open && (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {error && <p className="text-sm text-slate-400">Daten konnten nicht geladen werden</p>}
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
                      className={`flex w-full items-center gap-3 py-2 text-left text-sm transition-colors ${
                        isActive ? "text-accent-400" : "text-slate-200 hover:text-accent-400"
                      }`}
                      onClick={() => handleClick(row.id)}
                      disabled={isLoading}
                    >
                      <SportIcon sport={row.sport} className="h-5 w-5 shrink-0 [&>svg]:h-full [&>svg]:w-full" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium" title={row.name}>{row.name}</div>
                        <div className="text-xs text-slate-500">{formatDateTime(row.created_at)}</div>
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
        </div>
      )}
    </section>
  );
}
