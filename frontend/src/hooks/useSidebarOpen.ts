import { useSyncExternalStore } from "react";

let open = true;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSidebarOpen(): [boolean, (next: (prev: boolean) => boolean) => void] {
  const value = useSyncExternalStore(subscribe, () => open, () => open);
  const set = (next: (prev: boolean) => boolean) => {
    open = next(open);
    emit();
  };
  return [value, set];
}
