import { useEffect, useRef, useState } from "react";
import {
  createWorkout,
  generateFromText,
  pushWorkout,
  saveGarminWorkout,
  saveWorkout,
} from "../api/client";
import type { Sport, Step, Workout, WorkoutTemplate } from "../api/types";
import { AddSectionButton } from "../components/AddSectionButton";
import { GarminWorkouts } from "../components/GarminWorkouts";
import type { PushTarget } from "../components/PushButton";
import { PushButton } from "../components/PushButton";
import { RepeatBlockView } from "../components/RepeatBlockView";
import { SavedWorkouts } from "../components/SavedWorkouts";
import { SportIcon, SPORT_LABELS } from "../components/SportIcon";
import { SportToggle } from "../components/SportToggle";
import { StepCard } from "../components/StepCard";
import { TemplateGallery } from "../components/TemplateGallery";
import { Toasts } from "../components/Toasts";
import { dragHandleClassName, dragRowClassName, useDragReorder } from "../hooks/useDragReorder";
import { useToasts } from "../hooks/useToasts";
import { blankStep, blankSwimBlock, blankSwimPauseStep } from "../lib/steps";

type Mode = "free_text" | "templates" | "scratch";

const SAMPLE_FREE_TEXT = "6x800m intervals at 4:10/km, 400m jog recovery. 10 min warmup, 5 min cooldown.";

export function WorkoutBuilder() {
  const [mode, setMode] = useState<Mode>("free_text");
  const [sport, setSport] = useState<Sport>("running");
  const [input, setInput] = useState<string>(SAMPLE_FREE_TEXT);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  // Set when the loaded workout came from the Garmin pane (mutually
  // exclusive with workoutId — a workout is either a local saved row or a
  // Garmin-library one, never both at once).
  const [garminWorkoutId, setGarminWorkoutId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Bumped after each successful generate/push so SavedWorkouts re-fetches.
  const [refreshKey, setRefreshKey] = useState(0);
  const [savedOpen, setSavedOpen] = useState(true);
  const [garminOpen, setGarminOpen] = useState(true);
  const { toasts, pushToast } = useToasts();

  // Detects when the action bar has scrolled into its "stuck" (sticky)
  // state so it can pick up its floating-bar styling only then — while in
  // normal flow it stays visually merged into the name card above it. A
  // sticky element's own top clamps to its `top-4` offset (16px) exactly
  // once stuck, so that's the signal — cheaper than an IntersectionObserver
  // and unaffected by observer throttling on backgrounded tabs.
  const [actionBarStuck, setActionBarStuck] = useState(false);
  const actionBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = actionBarRef.current;
    if (!bar) return;
    const checkStuck = () => setActionBarStuck(bar.getBoundingClientRect().top <= 16);
    checkStuck();
    window.addEventListener("scroll", checkStuck, { passive: true });
    window.addEventListener("resize", checkStuck);
    return () => {
      window.removeEventListener("scroll", checkStuck);
      window.removeEventListener("resize", checkStuck);
    };
  }, [workout !== null]);

  // Source recorded on first save — mirrors how the workout was produced.
  const sourceForMode = () =>
    mode === "free_text" ? "text" : mode === "templates" ? "template" : "manual";

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateFromText(input, sport);
      setWorkout(res.workout);
      setWorkoutId(null);
      setGarminWorkoutId(null);
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
    setGarminWorkoutId(null);
    setDirty(true);
    setError(null);
  };

  const startFromScratch = () => {
    setWorkout({ name: "New workout", sport, warmup: null, body: [], cooldown: null, pool_length_m: 25 });
    setWorkoutId(null);
    setGarminWorkoutId(null);
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
    setGarminWorkoutId(null);
    setDirty(false);
    setError(null);
  };

  const loadGarminWorkout = (id: string, w: Workout) => {
    setWorkout(w);
    setWorkoutId(null);
    setGarminWorkoutId(id);
    setDirty(false);
    setError(null);
  };

  // Replaces the Garmin-side workout in place with the edited version — the
  // Garmin counterpart to `save` (which persists to the local DB instead).
  const saveToGarmin = async () => {
    if (!workout || garminWorkoutId == null) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await saveGarminWorkout(garminWorkoutId, workout);
      setWorkout(updated);
      setDirty(false);
      setRefreshKey((k) => k + 1);
      pushToast(`Updated "${updated.name}" on Garmin`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
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
  const addBodyStep = (steps: Step[]) => {
    if (!workout) return;
    mutate({ ...workout, body: [...workout.body, ...steps] });
  };
  const addRepeat = () => {
    if (!workout) return;
    const isSwim = workout.sport === "swimming";
    mutate({
      ...workout,
      body: [
        ...workout.body,
        {
          kind: "repeat", count: 4,
          steps: isSwim ? blankSwimBlock(workout.pool_length_m) : [blankStep(workout.sport, "work")],
        },
        // A repeat block of swim sets is still followed by one more rest.
        ...(isSwim ? [blankSwimPauseStep()] : []),
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
  const { draggedIndex, dragOverIndex, startDrag } = useDragReorder("data-body-index", moveBody);

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
          <button
            className={mode === "scratch" ? "btn-primary" : "btn-ghost"}
            onClick={() => setMode("scratch")}
          >From scratch</button>
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
        ) : mode === "templates" ? (
          <TemplateGallery sport={sport} onSelect={selectTemplate} />
        ) : (
          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={startFromScratch}>
              + Start blank workout
            </button>
            <p className="text-sm text-slate-400">
              Build it step by step below — no generation, no template.
            </p>
          </div>
        )}
      </section>

      {workout && (
        <section className="space-y-3">
          <div className="card rounded-b-none space-y-3">
            <label className="label">Name</label>
            <input
              className="input"
              value={workout.name}
              onChange={(e) => mutate({ ...workout, name: e.target.value })}
            />
          </div>
          <div
            ref={actionBarRef}
            style={{ marginTop: 0 }}
            className={`sticky top-4 z-20 flex flex-wrap items-center gap-3 p-4 ${
              actionBarStuck
                ? "rounded-xl border border-white/10 bg-surface-800/50 shadow-lg backdrop-blur-md"
                : "rounded-t-none rounded-b-xl border border-t-0 border-slate-800 bg-surface-800"
            }`}
          >
            {!workout.warmup && (
              <button className="btn-ghost" onClick={() => setStep("warmup", blankStep(workout.sport, "warmup", "", workout.pool_length_m))}>
                + Add warmup
              </button>
            )}
            {!workout.cooldown && (
              <button className="btn-ghost" onClick={() => setStep("cooldown", blankStep(workout.sport, "cooldown", "", workout.pool_length_m))}>
                + Add cooldown
              </button>
            )}
            <AddSectionButton sport={workout.sport} poolLengthM={workout.pool_length_m} onAdd={addBodyStep} />
            <button className="btn-ghost" onClick={addRepeat}>+ Add repeat block</button>
            {workout.sport === "swimming" && (
              <label className="ml-auto flex items-center gap-2 text-sm text-slate-300">
                Pool length
                <input
                  className="input w-20"
                  type="number"
                  min={1}
                  value={workout.pool_length_m}
                  onChange={(e) => mutate({ ...workout, pool_length_m: Number(e.target.value) })}
                />
                m
              </label>
            )}
            <span className={`inline-flex items-center gap-2 rounded-full border border-slate-700 bg-surface-900 px-3 py-1.5 text-sm font-medium text-slate-200 ${workout.sport === "swimming" ? "" : "ml-auto"}`}>
              <SportIcon sport={workout.sport} className="h-4 w-4 text-accent-400 [&>svg]:h-full [&>svg]:w-full" />
              {SPORT_LABELS[workout.sport]}
            </span>
          </div>

          {workout.warmup && (
            <StepCard step={workout.warmup} poolLengthM={workout.pool_length_m} onChange={(s) => setStep("warmup", s)} onRemove={() => setStep("warmup", null)} />
          )}
          {workout.body.map((item, i) => (
            <div
              key={i}
              data-body-index={i}
              className={dragRowClassName(draggedIndex === i, dragOverIndex === i && draggedIndex !== null && draggedIndex !== i)}
            >
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  startDrag(i, e);
                }}
                className={dragHandleClassName}
                aria-label="Drag to reorder"
              >
                ⠿
              </div>
              <div className="min-w-0 flex-1">
                {item.kind === "step" ? (
                  <StepCard step={item} poolLengthM={workout.pool_length_m} onChange={(s) => updateBody(i, s)} onRemove={() => removeBody(i)} />
                ) : (
                  <RepeatBlockView
                    block={item}
                    sport={workout.sport}
                    poolLengthM={workout.pool_length_m}
                    onChange={(b) => updateBody(i, b)}
                    onRemove={() => removeBody(i)}
                  />
                )}
              </div>
            </div>
          ))}
          {workout.cooldown && (
            <StepCard step={workout.cooldown} poolLengthM={workout.pool_length_m} onChange={(s) => setStep("cooldown", s)} onRemove={() => setStep("cooldown", null)} />
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
            {garminWorkoutId !== null && (
              <button className="btn-ghost" onClick={saveToGarmin} disabled={loading || !dirty}>
                {loading ? "Saving…" : "Update on Garmin"}
              </button>
            )}
            {dirty && <span className="text-xs text-amber-400">Unsaved changes</span>}
            {(workoutId !== null || garminWorkoutId !== null) && (
              <span className="ml-auto text-xs text-slate-500">
                {workoutId !== null ? `Workout id: ${workoutId}` : `Garmin id: ${garminWorkoutId}`}
              </span>
            )}
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
          activeId={garminWorkoutId}
          onLoad={loadGarminWorkout}
          open={garminOpen}
          onToggle={() => setGarminOpen((v) => !v)}
        />
      </aside>
    </div>
  );
}
