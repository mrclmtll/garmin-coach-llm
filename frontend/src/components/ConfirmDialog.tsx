interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="card w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-sm font-semibold text-slate-100">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-400">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn bg-red-500 text-slate-900 hover:bg-red-400" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
