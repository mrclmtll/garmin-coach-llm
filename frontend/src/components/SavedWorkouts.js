import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getWorkout, listWorkouts } from "../api/client";
export function SavedWorkouts({ refreshKey, onLoad, activeId }) {
    const [items, setItems] = useState(null);
    const [error, setError] = useState(null);
    const [loadingId, setLoadingId] = useState(null);
    const [open, setOpen] = useState(true);
    useEffect(() => {
        let cancelled = false;
        setError(null);
        listWorkouts()
            .then((rows) => {
            if (!cancelled)
                setItems(rows);
        })
            .catch((e) => {
            if (!cancelled)
                setError(e.message);
        });
        return () => {
            cancelled = true;
        };
    }, [refreshKey]);
    const handleClick = async (id) => {
        setLoadingId(id);
        setError(null);
        try {
            const workout = await getWorkout(id);
            onLoad(id, workout);
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setLoadingId(null);
        }
    };
    return (_jsxs("section", { className: `card flex flex-col overflow-hidden p-0 ${open ? "h-[calc(100vh-10rem)]" : "h-auto"}`, children: [_jsxs("button", { type: "button", className: "sticky top-0 z-10 flex w-full items-center gap-2 rounded-t-xl border-b border-slate-800 bg-surface-800 px-4 py-3 text-left", "aria-expanded": open, onClick: () => setOpen((v) => !v), children: [_jsx("span", { className: `inline-block text-slate-500 transition-transform ${open ? "rotate-90" : ""}`, "aria-hidden": true, children: "\u25B8" }), _jsx("h2", { className: "text-sm font-semibold uppercase tracking-wide text-slate-300", children: "Saved workouts" }), _jsx("span", { className: "ml-auto text-xs text-slate-500", children: items ? `${items.length} total` : "loading…" })] }), open && (_jsxs("div", { className: "min-h-0 flex-1 space-y-3 overflow-y-auto p-4", children: [error && _jsx("p", { className: "text-sm text-slate-400", children: "Daten konnten nicht geladen werden" }), items && items.length === 0 && (_jsx("p", { className: "text-sm text-slate-500", children: "No saved workouts yet." })), items && items.length > 0 && (_jsx("ul", { className: "divide-y divide-slate-800", children: items.map((row) => {
                            const isActive = row.id === activeId;
                            const isLoading = row.id === loadingId;
                            return (_jsx("li", { children: _jsxs("button", { className: `flex w-full items-center justify-between gap-3 py-2 text-left text-sm transition-colors ${isActive ? "text-accent-400" : "text-slate-200 hover:text-accent-400"}`, onClick: () => handleClick(row.id), disabled: isLoading, children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "truncate font-medium", children: row.name }), _jsxs("div", { className: "text-xs text-slate-500", children: [row.sport, " \u00B7 ", row.source, " \u00B7 ", formatDate(row.created_at)] })] }), _jsx("div", { className: "shrink-0 text-right text-xs", children: row.garmin_workout_id ? (_jsx("span", { className: "text-emerald-400", children: "pushed" })) : (_jsx("span", { className: "text-slate-500", children: "not pushed" })) })] }) }, row.id));
                        }) }))] }))] }));
}
function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleString();
}
