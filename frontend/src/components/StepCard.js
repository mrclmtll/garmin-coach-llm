import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatGoal, formatPace, formatTarget } from "../api/format";
const SPORTS = ["running", "cycling", "swimming"];
const ROLES = ["warmup", "work", "recovery", "cooldown"];
function targetMatchesSport(target, sport) {
    if (target.kind === "pace")
        return sport === "running" || sport === "swimming";
    if (target.kind === "power")
        return sport === "cycling";
    return true;
}
function targetForSport(sport) {
    if (sport === "cycling")
        return { kind: "power", min_watts: 200, max_watts: 250 };
    if (sport === "running" || sport === "swimming")
        return { kind: "pace", min_sec_per_km: 300, max_sec_per_km: 270 };
    return { kind: "hr_zone", zone: 2 };
}
export function StepCard({ step, onChange, onRemove }) {
    const set = (key, value) => onChange({ ...step, [key]: value });
    const setSport = (sport) => {
        const next = { ...step, sport };
        if (!targetMatchesSport(step.target, sport))
            next.target = targetForSport(sport);
        onChange(next);
    };
    const setGoalKind = (kind) => onChange({ ...step, goal: { kind, value: step.goal.value } });
    const setTargetKind = (kind) => {
        if (kind === "pace")
            onChange({ ...step, target: { kind: "pace", min_sec_per_km: 300, max_sec_per_km: 270 } });
        if (kind === "power")
            onChange({ ...step, target: { kind: "power", min_watts: 200, max_watts: 250 } });
        if (kind === "hr_zone")
            onChange({ ...step, target: { kind: "hr_zone", zone: 2 } });
    };
    return (_jsxs("div", { className: "card space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("input", { className: "input flex-1", value: step.label, onChange: (e) => set("label", e.target.value), placeholder: "Step label" }), _jsx("button", { className: "btn-ghost ml-2", onClick: onRemove, "aria-label": "Remove step", children: "\u00D7" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3 sm:grid-cols-4", children: [_jsxs("div", { children: [_jsx("label", { className: "label", children: "Sport" }), _jsx("select", { className: "input", value: step.sport, onChange: (e) => setSport(e.target.value), children: SPORTS.map((s) => _jsx("option", { value: s, children: s }, s)) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Role" }), _jsx("select", { className: "input", value: step.role, onChange: (e) => set("role", e.target.value), children: ROLES.map((r) => _jsx("option", { value: r, children: r }, r)) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Goal kind" }), _jsxs("select", { className: "input", value: step.goal.kind, onChange: (e) => setGoalKind(e.target.value), children: [_jsx("option", { value: "time", children: "time" }), _jsx("option", { value: "distance", children: "distance" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: step.goal.kind === "time" ? "Seconds" : "Meters" }), _jsx("input", { className: "input", type: "number", min: 0, value: step.goal.value, onChange: (e) => onChange({ ...step, goal: { ...step.goal, value: Number(e.target.value) } }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Target" }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("select", { className: "input w-auto", value: step.target.kind, onChange: (e) => setTargetKind(e.target.value), children: [_jsx("option", { value: "pace", children: "pace" }), _jsx("option", { value: "power", children: "power" }), _jsx("option", { value: "hr_zone", children: "hr_zone" })] }), _jsx("span", { className: "text-sm text-slate-300", children: formatTarget(step.target) })] }), step.target.kind === "pace" && (_jsxs("div", { className: "mt-2 grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "label", children: "min (sec/km)" }), _jsx("input", { className: "input", type: "number", value: step.target.min_sec_per_km, onChange: (e) => onChange({ ...step, target: { ...step.target, min_sec_per_km: Number(e.target.value) } }) }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: formatPace(step.target.min_sec_per_km) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "max (sec/km)" }), _jsx("input", { className: "input", type: "number", value: step.target.max_sec_per_km, onChange: (e) => onChange({ ...step, target: { ...step.target, max_sec_per_km: Number(e.target.value) } }) }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: formatPace(step.target.max_sec_per_km) })] })] })), step.target.kind === "power" && (_jsxs("div", { className: "mt-2 grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "label", children: "min watts" }), _jsx("input", { className: "input", type: "number", value: step.target.min_watts, onChange: (e) => onChange({ ...step, target: { ...step.target, min_watts: Number(e.target.value) } }) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "max watts" }), _jsx("input", { className: "input", type: "number", value: step.target.max_watts, onChange: (e) => onChange({ ...step, target: { ...step.target, max_watts: Number(e.target.value) } }) })] })] })), step.target.kind === "hr_zone" && (_jsxs("div", { className: "mt-2 w-32", children: [_jsx("label", { className: "label", children: "Zone" }), _jsx("select", { className: "input", value: step.target.zone, onChange: (e) => onChange({ ...step, target: { ...step.target, zone: Number(e.target.value) } }), children: [1, 2, 3, 4, 5].map((z) => _jsx("option", { value: z, children: z }, z)) })] }))] }), _jsxs("p", { className: "text-xs text-slate-500", children: [formatGoal(step.goal), " \u00B7 ", formatTarget(step.target)] })] }));
}
