import { useRef, useState, type ReactNode } from 'react';

export type SheetState = 'collapsed' | 'half' | 'expanded';

interface SheetProps {
  label: string;
  children: ReactNode;
}

const ORDER: SheetState[] = ['collapsed', 'half', 'expanded'];

/**
 * Mobile bottom sheet with three snap points, driven by dragging (or
 * tapping) the handle. On desktop widths it renders as a static sidebar
 * (see app.css) and the handle is hidden.
 */
export function Sheet({ label, children }: SheetProps) {
  const [state, setState] = useState<SheetState>('half');
  const dragStartY = useRef<number | null>(null);

  const step = (direction: 1 | -1) => {
    setState((current) => {
      const idx = ORDER.indexOf(current);
      const next = Math.min(ORDER.length - 1, Math.max(0, idx + direction));
      return ORDER[next];
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragStartY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  // Browser gesture takeover (scroll, etc.) fires pointercancel instead of
  // pointerup — reset so the interrupted drag doesn't leak into the next one.
  const onPointerCancel = () => {
    dragStartY.current = null;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const start = dragStartY.current;
    dragStartY.current = null;
    if (start === null) return;
    const delta = e.clientY - start;
    if (delta < -30) {
      step(1); // dragged up → grow
    } else if (delta > 30) {
      step(-1); // dragged down → shrink
    } else {
      // Treat as a tap: cycle up, wrap to collapsed from the top.
      setState((current) => (current === 'expanded' ? 'collapsed' : ORDER[ORDER.indexOf(current) + 1]));
    }
  };

  const className =
    state === 'expanded'
      ? 'sheet is-expanded'
      : state === 'collapsed'
        ? 'sheet is-collapsed'
        : 'sheet';

  return (
    <section className={className} aria-label={label}>
      <button
        type="button"
        className="sheet-handle"
        aria-label={`Resize court list (currently ${state})`}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {label}
      </button>
      <div className="sheet-body">{children}</div>
    </section>
  );
}
