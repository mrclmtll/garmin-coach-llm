import { useCallback, useEffect, useRef, useState } from "react";
import { listGarminWorkouts } from "../api/client";
import { formatDateTime } from "../api/format";
import type { GarminWorkoutSummary } from "../api/types";
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
  // Expand/collapse is controlled by the parent so it can size this pane
  // relative to its sibling (SavedWorkouts).
  open: boolean;
  onToggle: () => void;
}

export function GarminWorkouts({ refreshKey, open, onToggle }: Props) {
  const [items, setItems] = useState<GarminWorkoutSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchItems = useCallback(() => {
    listGarminWorkouts()
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
                  <div className="flex w-full items-center gap-3 py-2 text-left text-sm text-slate-200">
                    <SportIcon sport={row.sport} className="h-5 w-5 shrink-0 [&>svg]:h-full [&>svg]:w-full" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium" title={row.name}>{row.name}</div>
                      <div className="text-xs text-slate-500">
                        {formatDateTime(row.updated_at ?? row.created_at)}
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
