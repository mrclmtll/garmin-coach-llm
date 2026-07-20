import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { WorkoutBuilder } from "./pages/WorkoutBuilder";
export default function App() {
    return (_jsxs("div", { className: "mx-auto max-w-6xl px-4 py-8", children: [_jsxs("header", { className: "mb-8 flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-accent-400", children: "Garmin Coach" }), _jsx("p", { className: "text-sm text-slate-400", children: "Describe a workout. Push to your device." })] }), _jsx(WorkoutBuilder.SidebarToggle, {})] }), _jsx(WorkoutBuilder, {})] }));
}
