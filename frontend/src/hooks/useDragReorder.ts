import { useEffect, useRef, useState } from "react";

// Custom mouse-driven drag instead of native HTML5 DnD: native drag requires
// the browser's own drag gesture to kick in, which is finicky to trigger
// reliably from a handle nested inside interactive elements (inputs/selects)
// and behaves inconsistently across browsers. Tracking
// mousedown/mousemove/mouseup ourselves works the same everywhere, and lets
// us auto-scroll the page while dragging near the top/bottom edge.
//
// `attr` is the DOM attribute (e.g. "data-step-index") each draggable row
// carries with its own index — scoped per list so a drag inside a nested
// list (e.g. steps within a repeat block) never picks up the outer list's
// rows.
export function useDragReorder(attr: string, onReorder: (from: number, to: number) => void) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
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
      const row = target?.closest<HTMLElement>(`[${attr}]`);
      if (!row) return;
      const idx = Number(row.getAttribute(attr));
      if (idx !== dragOverIndexRef.current) {
        dragOverIndexRef.current = idx;
        setDragOverIndex(idx);
      }
    };

    // Scroll the page when the pointer nears the top/bottom edge — the
    // grip stays put while dragging, so this is the only way to reach rows
    // above/below the current viewport. Runs every frame rather than only
    // on mousemove so it keeps scrolling even while the mouse is held
    // still at the edge, and re-checks the drop target after each scroll
    // since the row under the cursor moves too.
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
      if (to !== null) onReorder(draggedIndex, to);
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

  return { draggedIndex, dragOverIndex, startDrag };
}

// Shared classes for a draggable row and its grip handle, so every list
// using this hook looks and behaves the same.
export function dragRowClassName(isDragged: boolean, isDropTarget: boolean): string {
  return `flex items-stretch gap-0 rounded-lg transition-opacity ${isDragged ? "opacity-40" : ""} ${
    isDropTarget ? "outline outline-2 outline-offset-2 outline-accent-500" : ""
  }`;
}

export const dragHandleClassName =
  "flex w-8 shrink-0 cursor-grab select-none items-center justify-center rounded-l-lg text-lg leading-none text-slate-600 hover:bg-surface-800 hover:text-slate-300 active:cursor-grabbing";
