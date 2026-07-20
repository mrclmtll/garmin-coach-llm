import { useCallback, useState } from "react";

export interface ToastItem {
  id: number;
  message: string;
}

const TOAST_DURATION_MS = 3000;

let nextToastId = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((message: string) => {
    const id = ++nextToastId;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  return { toasts, pushToast };
}
