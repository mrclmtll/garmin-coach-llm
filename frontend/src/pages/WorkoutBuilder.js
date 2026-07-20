import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { generateFromTemplate, generateFromText, pushWorkout, saveWorkout } from "../api/client";
import { RepeatBlockView } from "../components/RepeatBlockView";
import { SavedWorkouts } from "../components/SavedWorkouts";
import { StepCard } from "../components/StepCard";
import { useSidebarOpen } from "../hooks/useSidebarOpen";
const SAMPLE_FREE_TEXT = "6x800m Intervalle bei 4:10/km, 400m Trabpause. 10 min Warmup, 5 min Cooldown.";
const SAMPLE_TEMPLATE = JSON.stringify({
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
}, null, 2);
export function WorkoutBuilder() {
    const [mode, setMode] = useState("free_text");
    const [input, setInput] = useState(SAMPLE_FREE_TEXT);
    const [workout, setWorkout] = useState(null);
    const [workoutId, setWorkoutId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pushInfo, setPushInfo] = useState(null);
    const [dirty, setDirty] = useState(false);
    // Bumped after each successful generate/push so SavedWorkouts re-fetches.
    const [refreshKey, setRefreshKey] = useState(0);
    const [sidebarOpen] = useSidebarOpen();
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
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setLoading(false);
        }
    };
    const push = async () => {
        if (!workout || workoutId == null)
            return;
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
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setLoading(false);
        }
    };
    const loadWorkout = (id, w) => {
        setWorkout(w);
        setWorkoutId(id);
        setDirty(false);
        setError(null);
        setPushInfo(null);
    };
    // Mark dirty whenever the workout is edited after a generate/save.
    const mutate = (next) => {
        setWorkout(next);
        setDirty(true);
    };
    const setStep = (slot, next) => {
        if (!workout)
            return;
        mutate({ ...workout, [slot]: next });
    };
    const updateBody = (i, next) => {
        if (!workout)
            return;
        mutate({ ...workout, body: workout.body.map((b, idx) => (idx === i ? next : b)) });
    };
    const removeBody = (i) => {
        if (!workout)
            return;
        mutate({ ...workout, body: workout.body.filter((_, idx) => idx !== i) });
    };
    const addStep = () => {
        if (!workout)
            return;
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
        if (!workout)
            return;
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
    return (_jsxs("div", { className: sidebarOpen ? "lg:pr-[344px]" : "", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("section", { className: "card space-y-3", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: mode === "free_text" ? "btn-primary" : "btn-ghost", onClick: () => { setMode("free_text"); setInput(SAMPLE_FREE_TEXT); }, children: "Free text" }), _jsx("button", { className: mode === "template" ? "btn-primary" : "btn-ghost", onClick: () => { setMode("template"); setInput(SAMPLE_TEMPLATE); }, children: "Template / JSON" })] }), _jsx("textarea", { className: "input min-h-[140px] font-mono text-xs", value: input, onChange: (e) => setInput(e.target.value), spellCheck: false }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { className: "btn-primary", onClick: generate, disabled: loading || !input.trim(), children: loading ? "Generating…" : "Generate workout" }), error && _jsx("p", { className: "text-sm text-red-400", children: error })] })] }), workout && (_jsxs("section", { className: "space-y-3", children: [_jsxs("div", { className: "card space-y-3", children: [_jsx("label", { className: "label", children: "Name" }), _jsx("input", { className: "input", value: workout.name, onChange: (e) => mutate({ ...workout, name: e.target.value }) }), _jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [_jsxs("button", { className: "btn-ghost", onClick: () => setStep("warmup", workout.warmup ?? blankStep(workout.sport, "warmup")), children: ["+ ", workout.warmup ? "Edit" : "Add", " warmup"] }), _jsxs("button", { className: "btn-ghost", onClick: () => setStep("cooldown", workout.cooldown ?? blankStep(workout.sport, "cooldown")), children: ["+ ", workout.cooldown ? "Edit" : "Add", " cooldown"] }), _jsx("button", { className: "btn-ghost", onClick: addStep, children: "+ Step" }), _jsx("button", { className: "btn-ghost", onClick: addRepeat, children: "+ Repeat block" }), _jsxs("span", { className: "ml-auto text-xs text-slate-500", children: ["Sport: ", workout.sport] })] })] }), workout.warmup && (_jsx(StepCard, { step: workout.warmup, onChange: (s) => setStep("warmup", s), onRemove: () => setStep("warmup", null) })), workout.body.map((item, i) => item.kind === "step" ? (_jsx(StepCard, { step: item, onChange: (s) => updateBody(i, s), onRemove: () => removeBody(i) }, i)) : (_jsx(RepeatBlockView, { block: item, onChange: (b) => updateBody(i, b), onRemove: () => removeBody(i) }, i))), workout.cooldown && (_jsx(StepCard, { step: workout.cooldown, onChange: (s) => setStep("cooldown", s), onRemove: () => setStep("cooldown", null) })), _jsxs("div", { className: "card flex items-center gap-3", children: [_jsx("button", { className: "btn-primary", onClick: push, disabled: loading, children: loading ? "Pushing…" : "Push to Garmin" }), dirty && _jsx("span", { className: "text-xs text-amber-400", children: "Unsaved changes \u2014 will be saved on push" }), pushInfo && _jsx("p", { className: "text-sm text-slate-300", children: pushInfo }), workoutId !== null && _jsxs("span", { className: "ml-auto text-xs text-slate-500", children: ["Workout id: ", workoutId] })] })] }))] }), sidebarOpen && (_jsx("aside", { className: "hidden lg:block fixed right-4 top-24 w-[320px] max-h-[calc(100vh-7rem)] overflow-y-auto", children: _jsx(SavedWorkouts, { refreshKey: refreshKey, activeId: workoutId, onLoad: loadWorkout }) }))] }));
}
WorkoutBuilder.SidebarToggle = function SidebarToggle() {
    const [open, setOpen] = useSidebarOpen();
    return (_jsx("button", { type: "button", className: "btn-ghost shrink-0", "aria-expanded": open, onClick: () => setOpen((v) => !v), children: open ? "▸ Hide saved" : "◂ Show saved" }));
};
function blankStep(sport, role) {
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
