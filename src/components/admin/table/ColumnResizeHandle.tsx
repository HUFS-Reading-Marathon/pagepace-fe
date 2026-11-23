import { useRef } from 'react';

const MAX_WIDTH = 3200;

export default function ColumnResizeHandle({
  label,
  width,
  minWidth,
  onChange,
  onReset,
}: {
  label: string;
  width: number;
  minWidth: number;
  onChange: (width: number) => void;
  onReset: () => void;
}) {
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(null);
  function resize(value: number) {
    onChange(Math.min(MAX_WIDTH, Math.max(minWidth, Math.round(value))));
  }
  return (
    <span
      className="roster-resize"
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      aria-label={label + ' 열 너비'}
      aria-valuemin={minWidth}
      aria-valuemax={MAX_WIDTH}
      aria-valuenow={width}
      aria-valuetext={width + '픽셀'}
      title="드래그하거나 좌우 방향키로 너비 조절 · 두 번 클릭하면 기본 너비"
      onPointerDown={(e) => {
        if (!e.isPrimary || e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.focus({ preventScroll: true });
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { pointerId: e.pointerId, x: e.clientX, width };
      }}
      onPointerMove={(e) => {
        const start = drag.current;
        if (start?.pointerId === e.pointerId) resize(start.width + e.clientX - start.x);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const step = e.shiftKey ? 40 : 8;
          resize(width + (e.key === 'ArrowLeft' ? -step : step));
        } else if (e.key === 'Home') {
          e.preventDefault();
          onReset();
        }
      }}
    />
  );
}
