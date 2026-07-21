import { useState } from "react";
import {
  createWorkout,
  generateFromText,
  pushWorkout,
  saveWorkout,
} from "../api/client";
import type { Step, Workout, WorkoutTemplate } from "../api/types";
import { GarminWorkouts } from "../components/GarminWorkouts";
import { RepeatBlockView } from "../components/RepeatBlockView";
import { SavedWorkouts } from "../components/SavedWorkouts";
import { StepCard } from "../components/StepCard";
import { TemplateGallery } from "../components/TemplateGallery";
import { Toasts } from "../components/Toasts";
import { useToasts } from "../hooks/useToasts";

type Mode = "free_text" | "templates";

const SAMPLE_FREE_TEXT = "6x800m Intervalle bei 4:10/km, 400m Trabpause. 10 min Warmup, 5 min Cooldown.";

export function WorkoutBuilder() {
  const [mode, setMode] = useState<Mode>("free_text");
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
  const { toasts, pushToast } = useToasts();

  // Source recorded on first save — mirrors how the workout was produced.
  const sourceForMode = () => (mode === "free_text" ? "text" : "template");

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateFromText(input);
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

  const push = async () => {
    if (!workout) return;
    setLoading(true);
    setError(null);
    try {
      const id = await persist();
      await pushWorkout(id);
      setRefreshKey((k) => k + 1);
      pushToast("Pushed to Garmin");
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
  const addStep = () => {
    if (!workout) return;
    mutate({
      ...workout,
      body: [
        ...workout.body,
        {
          kind: "step", label: "Step",
          goal: { kind: "time", value: 300 },
          target: { kind: "pace", min_sec_per_km: 330, max_sec_per_km: 300 },
          role: "work", sport: workout.sport,
        },
      ],
    });
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

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <Toasts toasts={toasts} />
      <div className="min-w-0 space-y-6">
        <section className="card space-y-3">
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
          <TemplateGallery onSelect={selectTemplate} />
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
              <button className="btn-ghost" onClick={() => setStep("warmup", workout.warmup ?? blankStep(workout.sport, "warmup"))}>
                + {workout.warmup ? "Edit" : "Add"} warmup
              </button>
              <button className="btn-ghost" onClick={() => setStep("cooldown", workout.cooldown ?? blankStep(workout.sport, "cooldown"))}>
                + {workout.cooldown ? "Edit" : "Add"} cooldown
              </button>
              <button className="btn-ghost" onClick={addStep}>+ Step</button>
              <button className="btn-ghost" onClick={addRepeat}>+ Repeat block</button>
              <span className="ml-auto text-xs text-slate-500">Sport: {workout.sport}</span>
            </div>
          </div>

          {workout.warmup && (
            <StepCard step={workout.warmup} onChange={(s) => setStep("warmup", s)} onRemove={() => setStep("warmup", null)} />
          )}
          {workout.body.map((item, i) =>
            item.kind === "step" ? (
              <StepCard key={i} step={item} onChange={(s) => updateBody(i, s)} onRemove={() => removeBody(i)} />
            ) : (
              <RepeatBlockView key={i} block={item} onChange={(b) => updateBody(i, b)} onRemove={() => removeBody(i)} />
            ),
          )}
          {workout.cooldown && (
            <StepCard step={workout.cooldown} onChange={(s) => setStep("cooldown", s)} onRemove={() => setStep("cooldown", null)} />
          )}

          <div className="sticky bottom-4 z-10 mx-6 flex items-center gap-3 rounded-xl border border-white/10 bg-surface-800/50 p-4 shadow-lg backdrop-blur-md">
            <button className="btn-primary" onClick={push} disabled={loading}>
              {loading ? "Pushing…" : "Push to Garmin"}
            </button>
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

function blankStep(sport: Workout["sport"], role: Step["role"]): Step {
  return {
    kind: "step",
    label: role,
    goal: { kind: "time", value: 300 },
    target: sport === "cycling"
      ? { kind: "power", min_watts: 200, max_watts: 250 }
      : { kind: "pace", min_sec_per_km: 330, max_sec_per_km: 300 },
    role,
    sport,
  };
}
