import { useState } from "react";
import { generateFromTemplate, generateFromText, pushWorkout, saveWorkout } from "../api/client";
import type { Step, Workout } from "../api/types";
import { GarminWorkouts } from "../components/GarminWorkouts";
import { RepeatBlockView } from "../components/RepeatBlockView";
import { SavedWorkouts } from "../components/SavedWorkouts";
import { StepCard } from "../components/StepCard";

type Mode = "free_text" | "template";

const SAMPLE_FREE_TEXT = "6x800m Intervalle bei 4:10/km, 400m Trabpause. 10 min Warmup, 5 min Cooldown.";
const SAMPLE_TEMPLATE = JSON.stringify(
  {
    name: "Classic 5x1000",
    sport: "running",
    warmup: { kind: "step", label: "Warmup", goal: { kind: "time", value: 600 }, target: { kind: "pace", min_sec_per_km: 360, max_sec_per_km: 330 }, role: "warmup", sport: "running" },
    body: [
      {
        kind: "repeat", count: 5,
        steps: [
          { kind: "step", label: "1000m", goal: { kind: "distance", value: 1000 }, target: { kind: "pace", min_sec_per_km: 255, max_sec_per_km: 245 }, role: "work", sport: "running" },
          { kind: "step", label: "Recovery", goal: { kind: "distance", value: 400 }, target: { kind: "pace", min_sec_per_km: 360, max_sec_per_km: 330 }, role: "recovery", sport: "running" },
        ],
      },
    ],
    cooldown: { kind: "step", label: "Cooldown", goal: { kind: "time", value: 300 }, target: { kind: "hr_zone", zone: 2 }, role: "cooldown", sport: "running" },
  },
  null,
  2,
);

export function WorkoutBuilder() {
  const [mode, setMode] = useState<Mode>("free_text");
  const [input, setInput] = useState<string>(SAMPLE_FREE_TEXT);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushInfo, setPushInfo] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Bumped after each successful generate/push so SavedWorkouts re-fetches.
  const [refreshKey, setRefreshKey] = useState(0);
  const [savedOpen, setSavedOpen] = useState(true);
  const [garminOpen, setGarminOpen] = useState(true);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setPushInfo(null);
    try {
      const fn = mode === "free_text" ? generateFromText : generateFromTemplate;
      const res = await fn(input);
      setWorkout(res.workout);
      setWorkoutId(res.id);
      setDirty(false);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const push = async () => {
    if (!workout || workoutId == null) return;
    setLoading(true);
    setError(null);
    setPushInfo(null);
    try {
      if (dirty) {
        await saveWorkout(workoutId, workout);
        setDirty(false);
      }
      const result = await pushWorkout(workoutId);
      const idPart = result.garmin_workout_id ? ` (Garmin id ${result.garmin_workout_id})` : "";
      setPushInfo(`Pushed "${workout.name}"${idPart}.`);
      setRefreshKey((k) => k + 1);
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
    setPushInfo(null);
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
      <div className="space-y-6">
        <section className="card space-y-3">
        <div className="flex gap-2">
          <button
            className={mode === "free_text" ? "btn-primary" : "btn-ghost"}
            onClick={() => { setMode("free_text"); setInput(SAMPLE_FREE_TEXT); }}
          >Free text</button>
          <button
            className={mode === "template" ? "btn-primary" : "btn-ghost"}
            onClick={() => { setMode("template"); setInput(SAMPLE_TEMPLATE); }}
          >Template / JSON</button>
        </div>
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

          <div className="card flex items-center gap-3">
            <button className="btn-primary" onClick={push} disabled={loading}>
              {loading ? "Pushing…" : "Push to Garmin"}
            </button>
            {dirty && <span className="text-xs text-amber-400">Unsaved changes — will be saved on push</span>}
            {pushInfo && <p className="text-sm text-slate-300">{pushInfo}</p>}
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
