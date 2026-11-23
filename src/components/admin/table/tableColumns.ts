import { useLayoutEffect, useRef, useState } from 'react';

export const CHECK_WIDTH = 28;
export type ColumnSizes<K extends string> = Record<K, number>;

// Round cumulative shares so the widths still add up to the viewport.
export function distributeWidths<K extends string>(
  columns: readonly K[],
  available: number,
  reference: Record<K, readonly [number, number]>,
) {
  const widths = {} as ColumnSizes<K>;
  let base = 0;
  let growth = 0;
  for (const key of columns) {
    const [compact, desktop] = reference[key];
    widths[key] = compact;
    base += compact;
    growth += desktop - compact;
  }
  if (growth === 0 || available <= base) return widths;
  const ratio = (Math.floor(available) - base) / growth;
  let allocated = 0;
  for (const key of columns) {
    const used = Math.round(allocated * ratio);
    allocated += reference[key][1] - reference[key][0];
    widths[key] += Math.round(allocated * ratio) - used;
  }
  return widths;
}

export function useColumnSizing<K extends string>() {
  const container = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0);
  const [custom, setCustom] = useState<Partial<ColumnSizes<K>>>({});
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewport(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  function resize(key: K, width: number) {
    setCustom((current) => ({ ...current, [key]: width }));
  }
  function resetWidth(key: K) {
    setCustom((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }
  return { container, viewport, custom, resize, resetWidth };
}
