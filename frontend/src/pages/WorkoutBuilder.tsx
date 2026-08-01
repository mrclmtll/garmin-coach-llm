import { useEffect, useRef, useState } from "react";
import {
  createWorkout,
  generateFromText,
  pushWorkout,
  saveWorkout,
} from "../api/client";
import type { Sport, Step, Workout, WorkoutTemplate } from "../api/types";
import { AddSectionButton } from "../components/AddSectionButton";
import { GarminWorkouts } from "../components/GarminWorkouts";
import type { PushTarget } from "../components/PushButton";
import { PushButton } from "../components/PushButton";
import { RepeatBlockView } from "../components/RepeatBlockView";
import { SavedWorkouts } from "../components/SavedWorkouts";
import { SportToggle } from "../components/SportToggle";
import { StepCard } from "../components/StepCard";
import { TemplateGallery } from "../components/TemplateGallery";
import { Toasts } from "../components/Toasts";
import { useToasts } from "../hooks/useToasts";
import { blankStep } from "../lib/steps";

type Mode = "free_text" | "templates";

const SAMPLE_FREE_TEXT = "6x800m Intervalle bei 4:10/km, 400m Trabpause. 10 min Warmup, 5 min Cooldown.";

export function WorkoutBuilder() {
  const [mode, setMode] = useState<Mode>("free_text");
  const [sport, setSport] = useState<Sport>("running");
  const [input, setInput] = useState<string>(SAMPLE_FREE_TEXT);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Bumped after each successful generate/push so SavedWorkouts re-fetches.
  const [refreshKey, setRefreshKey] = useState(0);
  const [savedOpen, setSavedOpen] = useState(true);
  const [garminOpen, setGarminOpen] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const { toasts, pushToast } = useToasts();

  // Source recorded on first save — mirrors how the workout was produced.
  const sourceForMode = () => (mode === "free_text" ? "text" : "template");

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateFromText(input, sport);
      setWorkout(res.workout);
      setWorkoutId(null);
      setDirty(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = (tpl: WorkoutTemplate) => {
    // Deep-cloned so re-selecting the same template never shares references
    // with a previously-loaded, since-edited workout.
    setWorkout(JSON.parse(JSON.stringify(tpl.workout)));
    setWorkoutId(null);
    setDirty(true);
    setError(null);
  };

  // Persists the current workout: creates it on first save, updates it after.
  const persist = async (): Promise<number> => {
    if (!workout) throw new Error("no workout to save");
    if (workoutId == null) {
      const res = await createWorkout(workout, sourceForMode());
      setWorkoutId(res.id);
      setDirty(false);
      return res.id;
    }
    if (dirty) {
      await saveWorkout(workoutId, workout);
      setDirty(false);
    }
    return workoutId;
  };

  const save = async () => {
    if (!workout) return;
    const wasExisting = workoutId != null;
    setLoading(true);
    setError(null);
    try {
      await persist();
      setRefreshKey((k) => k + 1);
      pushToast(wasExisting ? `Updated workout "${workout.name}"` : "Saved to workouts");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Persists the current (edited) workout as a brand-new row, leaving the
  // original saved workout untouched.
  const saveAsNew = async () => {
    if (!workout) return;
    setLoading(true);
    setError(null);
    try {
      const res = await createWorkout(workout, sourceForMode());
      setWorkoutId(res.id);
      setDirty(false);
      setRefreshKey((k) => k + 1);
      pushToast("Saved as new workout");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const push = async (target: PushTarget) => {
    if (!workout) return;
    setLoading(true);
    setError(null);
    try {
      const id = await persist();
      const deviceId = target.kind === "device" ? target.id : null;
      await pushWorkout(id, deviceId);
      setRefreshKey((k) => k + 1);
      pushToast(
        target.kind === "device"
          ? `Pushed to Garmin and queued to ${target.name}`
          : "Pushed to Garmin Connect",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkout = (id: number, w: Workout) => {
    setWorkout(w);
    setWorkoutId(id);
    setDirty(false);
    setError(null);
  };

  // Mark dirty whenever the workout is edited after a generate/save.
  const mutate = (next: Workout) => {
    setWorkout(next);
    setDirty(true);
  };

  const setStep = (slot: "warmup" | "cooldown", next: Step | null) => {
    if (!workout) return;
    mutate({ ...workout, [slot]: next });
  };

  const updateBody = (i: number, next: any) => {
    if (!workout) return;
    mutate({ ...workout, body: workout.body.map((b, idx) => (idx === i ? next : b)) });
  };
  const removeBody = (i: number) => {
    if (!workout) return;
    mutate({ ...workout, body: workout.body.filter((_, idx) => idx !== i) });
  };
  const addBodyStep = (step: Step) => {
    if (!workout) return;
    mutate({ ...workout, body: [...workout.body, step] });
  };
  const addRepeat = () => {
    if (!workout) return;
    mutate({
      ...workout,
      body: [
        ...workout.body,
        {
          kind: "repeat", count: 4,
          steps: [{
            kind: "step", label: "Work",
            goal: { kind: "time", value: 300 },
            target: { kind: "pace", min_sec_per_km: 300, max_sec_per_km: 270 },
            role: "work", sport: workout.sport,
          }],
        },
      ],
    });
  };
  const moveBody = (from: number, to: number) => {
    if (!workout || from === to) return;
    const next = [...workout.body];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    mutate({ ...workout, body: next });
  };

  // Custom mouse-driven drag instead of native HTML5 DnD: native drag
  // requires the browser's own drag gesture to kick in, which is finicky
  // to trigger reliably from a handle nested inside interactive elements
  // (inputs/selects) and behaves inconsistently across browsers. Tracking
  // mousedown/mousemove/mouseup ourselves works the same everywhere.
  const dragOverIndexRef = useRef<number | null>(null);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const startDrag = (index: number, e: { clientX: number; clientY: number }) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    setDraggedIndex(index);
    dragOverIndexRef.current = index;
    setDragOverIndex(index);
  };
  useEffect(() => {
    if (draggedIndex === null) return;
    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const updateDragOverAt = (x: number, y: number) => {
      const target = document.elementFromPoint(x, y) as HTMLElement | null;
      const row = target?.closest<HTMLElement>("[data-body-index]");
      if (!row) return;
      const idx = Number(row.dataset.bodyIndex);
      if (idx !== dragOverIndexRef.current) {
        dragOverIndexRef.current = idx;
        setDragOverIndex(idx);
      }
    };

    // Scroll the page when the pointer nears the top/bottom edge — the
    // grip stays put while dragging, so this is the only way to reach
    // body items above/below the current viewport. Runs every frame
    // rather than only on mousemove so it keeps scrolling even while the
    // mouse is held still at the edge, and re-checks the drop target
    // after each scroll since the row under the cursor moves too.
    const EDGE = 80;
    const MAX_SPEED = 18;
    let rafId: number;
    const tick = () => {
      const { x, y } = mousePosRef.current;
      const vh = window.innerHeight;
      let dy = 0;
      if (y < EDGE) dy = -MAX_SPEED * (1 - y / EDGE);
      else if (y > vh - EDGE) dy = MAX_SPEED * (1 - (vh - y) / EDGE);
      if (dy !== 0) {
        window.scrollBy(0, dy);
        updateDragOverAt(x, y);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    const onMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      updateDragOverAt(e.clientX, e.clientY);
    };
    const onUp = () => {
      const to = dragOverIndexRef.current;
      if (to !== null) moveBody(draggedIndex, to);
      dragOverIndexRef.current = null;
      setDraggedIndex(null);
      setDragOverIndex(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      cancelAnimationFrame(rafId);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggedIndex]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <Toasts toasts={toasts} />
      <div className="min-w-0 space-y-6">
        <section className="card space-y-3">
        <SportToggle value={sport} onChange={setSport} />
        <div className="flex gap-2">
          <button
            className={mode === "free_text" ? "btn-primary" : "btn-ghost"}
            onClick={() => setMode("free_text")}
          >Free text</button>
          <button
            className={mode === "templates" ? "btn-primary" : "btn-ghost"}
            onClick={() => setMode("templates")}
          >Templates</button>
        </div>
        {mode === "free_text" ? (
          <>
            <textarea
              className="input min-h-[140px] font-mono text-xs"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
            />
            <div className="flex items-center gap-3">
              <button className="btn-primary" onClick={generate} disabled={loading || !input.trim()}>
                {loading ? "Generating…" : "Generate workout"}
              </button>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
          </>
        ) : (
          <TemplateGallery sport={sport} onSelect={selectTemplate} />
        )}
      </section>

      {workout && (
        <section className="space-y-3">
          <div className="card space-y-3">
            <label className="label">Name</label>
            <input
              className="input"
              value={workout.name}
              onChange={(e) => mutate({ ...workout, name: e.target.value })}
            />
            <div className="flex flex-wrap items-center gap-3">
              {!workout.warmup && (
                <button className="btn-ghost" onClick={() => setStep("warmup", blankStep(workout.sport, "warmup"))}>
                  + Add warmup
                </button>
              )}
              {!workout.cooldown && (
                <button className="btn-ghost" onClick={() => setStep("cooldown", blankStep(workout.sport, "cooldown"))}>
                  + Add cooldown
                </button>
              )}
              <AddSectionButton sport={workout.sport} onAdd={addBodyStep} />
              <button className="btn-ghost" onClick={addRepeat}>+ Add repeat block</button>
              <span className="ml-auto text-xs text-slate-500">Sport: {workout.sport}</span>
            </div>
          </div>

          {workout.warmup && (
            <StepCard step={workout.warmup} onChange={(s) => setStep("warmup", s)} onRemove={() => setStep("warmup", null)} />
          )}
          {workout.body.map((item, i) => (
            <div
              key={i}
              data-body-index={i}
              className={`flex items-stretch gap-0 rounded-lg transition-opacity ${
                draggedIndex === i ? "opacity-40" : ""
              } ${dragOverIndex === i && draggedIndex !== null && draggedIndex !== i ? "outline outline-2 outline-offset-2 outline-accent-500" : ""}`}
            >
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  startDrag(i, e);
                }}
                className="flex w-8 shrink-0 cursor-grab select-none items-center justify-center rounded-l-lg text-lg leading-none text-slate-600 hover:bg-surface-800 hover:text-slate-300 active:cursor-grabbing"
                aria-label="Drag to reorder"
              >
                ⠿
              </div>
              <div className="min-w-0 flex-1">
                {item.kind === "step" ? (
                  <StepCard step={item} onChange={(s) => updateBody(i, s)} onRemove={() => removeBody(i)} />
                ) : (
                  <RepeatBlockView block={item} sport={workout.sport} onChange={(b) => updateBody(i, b)} onRemove={() => removeBody(i)} />
                )}
              </div>
            </div>
          ))}
          {workout.cooldown && (
            <StepCard step={workout.cooldown} onChange={(s) => setStep("cooldown", s)} onRemove={() => setStep("cooldown", null)} />
          )}

          <div className="sticky bottom-4 z-10 mx-6 flex items-center gap-3 rounded-xl border border-white/10 bg-surface-800/50 p-4 shadow-lg backdrop-blur-md">
            <PushButton loading={loading} onPush={push} />
            <button className="btn-ghost" onClick={save} disabled={loading || !dirty}>
              {loading ? "Saving…" : "Save"}
            </button>
            {workoutId !== null && dirty && (
              <button className="btn-ghost" onClick={saveAsNew} disabled={loading}>
                {loading ? "Saving…" : "Save as new workout"}
              </button>
            )}
            {dirty && <span className="text-xs text-amber-400">Unsaved changes</span>}
            {workoutId !== null && <span className="ml-auto text-xs text-slate-500">Workout id: {workoutId}</span>}
          </div>
        </section>
      )}
      </div>
      <aside
        className={`sticky top-4 hidden self-start lg:flex lg:flex-col lg:gap-4 ${
          savedOpen || garminOpen ? "lg:h-[calc(100vh-10rem)]" : ""
        }`}
      >
        <SavedWorkouts
          refreshKey={refreshKey}
          activeId={workoutId}
          onLoad={loadWorkout}
          open={savedOpen}
          onToggle={() => setSavedOpen((v) => !v)}
        />
        <GarminWorkouts
          refreshKey={refreshKey}
          open={garminOpen}
          onToggle={() => setGarminOpen((v) => !v)}
        />
      </aside>
    </div>
  );
}
