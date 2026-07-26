import { useEffect, useRef } from "react";

// Re-runs `callback` on a fixed interval, but only while the tab is visible —
// and immediately again the moment it regains focus after being hidden, so a
// pane that failed to load (or just went stale) catches up right away
// instead of waiting out the rest of the interval.
export function usePolling(callback: () => void, intervalMs: number): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") callbackRef.current();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") callbackRef.current();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);
}
