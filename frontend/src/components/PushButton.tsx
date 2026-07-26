import { useEffect, useRef, useState } from "react";
import { listGarminDevices } from "../api/client";
import type { GarminDevice } from "../api/types";

export type PushTarget = { kind: "connect" } | { kind: "device"; id: string; name: string };

const CONNECT_TARGET: PushTarget = { kind: "connect" };

function targetLabel(target: PushTarget): string {
  return target.kind === "connect" ? "Push to Garmin Connect" : `Push to ${target.name}`;
}

interface Props {
  loading: boolean;
  onPush: (target: PushTarget) => void;
}

export function PushButton({ loading, onPush }: Props) {
  const [devices, setDevices] = useState<GarminDevice[]>([]);
  const [defaultTarget, setDefaultTarget] = useState<PushTarget>(CONNECT_TARGET);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listGarminDevices()
      .then(setDevices)
      // Device list is a bonus for the dropdown — pushing to Garmin Connect
      // itself still works without it.
      .catch(() => setDevices([]));
  }, []);

  // A `fixed inset-0` click-catcher would normally do this, but the sticky
  // action bar uses `backdrop-blur`, which makes it a new containing block
  // for `position: fixed` descendants — the overlay would end up clipped to
  // the bar instead of covering the page. A document listener sidesteps that.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const choose = (target: PushTarget) => {
    setDefaultTarget(target);
    setOpen(false);
    onPush(target);
  };

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <button
        className="btn-primary rounded-r-none"
        onClick={() => onPush(defaultTarget)}
        disabled={loading}
      >
        {loading ? "Pushing…" : targetLabel(defaultTarget)}
      </button>
      <button
        type="button"
        className="btn-primary rounded-l-none border-l border-slate-900/30 px-2"
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        aria-label="Choose push target"
        aria-expanded={open}
      >
        ▾
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-60 overflow-hidden rounded-lg border border-slate-700 bg-surface-800 shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-surface-700"
            onClick={() => choose(CONNECT_TARGET)}
          >
            Push to Garmin Connect
          </button>
          {devices.map((d) => (
            <button
              key={d.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-surface-700"
              onClick={() => choose({ kind: "device", id: d.id, name: d.name })}
            >
              Push to {d.name}
              {d.is_primary && <span className="ml-1 text-xs text-slate-500">(primary)</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
