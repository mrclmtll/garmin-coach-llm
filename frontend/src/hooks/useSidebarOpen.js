import { useSyncExternalStore } from "react";
let open = true;
const listeners = new Set();
function emit() {
    for (const l of listeners)
        l();
}
function subscribe(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
export function useSidebarOpen() {
    const value = useSyncExternalStore(subscribe, () => open, () => open);
    const set = (next) => {
        open = next(open);
        emit();
    };
    return [value, set];
}
