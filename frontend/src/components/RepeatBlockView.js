import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StepCard } from "./StepCard";
export function RepeatBlockView({ block, onChange, onRemove }) {
    const updateStep = (i, next) => onChange({ ...block, steps: block.steps.map((s, idx) => (idx === i ? next : s)) });
    const removeStep = (i) => onChange({ ...block, steps: block.steps.filter((_, idx) => idx !== i) });
    const addStep = () => onChange({
        ...block,
        steps: [
            ...block.steps,
            {
                kind: "step",
                label: "Work",
                goal: { kind: "time", value: 60 },
                target: { kind: "pace", min_sec_per_km: 300, max_sec_per_km: 270 },
                role: "work",
                sport: "running",
            },
        ],
    });
    return (_jsxs("div", { className: "card space-y-3 border-l-4 border-l-accent-500", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "text-sm uppercase tracking-wide text-accent-400", children: "Repeat" }), _jsx("input", { className: "input w-20", type: "number", min: 1, max: 50, value: block.count, onChange: (e) => onChange({ ...block, count: Math.max(1, Number(e.target.value)) }) }), _jsx("span", { className: "text-sm text-slate-400", children: "\u00D7" })] }), _jsx("button", { className: "btn-ghost", onClick: onRemove, children: "Remove block" })] }), _jsxs("div", { className: "space-y-3 pl-2", children: [block.steps.map((s, i) => (_jsx(StepCard, { step: s, onChange: (next) => updateStep(i, next), onRemove: () => removeStep(i) }, i))), _jsx("button", { className: "btn-ghost", onClick: addStep, children: "+ Add step" })] })] }));
}
