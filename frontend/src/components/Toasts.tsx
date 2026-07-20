import type { ToastItem } from "../hooks/useToasts";

interface Props {
  toasts: ToastItem[];
}

export function Toasts({ toasts }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast rounded-lg border border-white/10 bg-surface-800/80 px-4 py-2 text-sm text-slate-100 shadow-lg backdrop-blur-md"
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
