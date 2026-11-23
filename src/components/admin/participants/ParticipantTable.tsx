import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  CHECK_WIDTH,
  MIN_WIDTH,
  MAX_WIDTH,
  defaultColumnWidths,
  measureRosterText,
  type ColumnWidths,
} from './rosterColumns';
import { rosterKey, rosterStatus } from '../../../api/adminRosterApi';
import {
  ROSTER_COLUMNS,
  rosterCell,
  type NumberedRow,
  type RosterColumn,
  type RosterSort,
} from '../../../utils/participantRoster';

const columns = Object.keys(ROSTER_COLUMNS) as RosterColumn[];
type Props = {
  rows: NumberedRow[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  onOpen: (row: NumberedRow) => void;
  sort: RosterSort;
  onSort: (column: RosterSort['column']) => void;
  busy: boolean;
  message: string;
};

export default function ParticipantTable({
  rows,
  selected,
  onSelect,
  onOpen,
  sort,
  onSort,
  busy,
  message,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const drag = useRef<{
    id: number;
    column: RosterColumn;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [viewport, setViewport] = useState(0);
  const [custom, setCustom] = useState<Partial<ColumnWidths>>({});
  const [fitText, setFitText] = useState<ReturnType<typeof measureRosterText> | null>(null);
  const hasCells = !message && rows.length > 0;
  useLayoutEffect(() => {
    const wrapper = container.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => setViewport(wrapper.clientWidth));
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!hasCells) return;
    let active = true;
    const measure = () => {
      if (active && table.current) {
        const fit = measureRosterText(table.current);
        setFitText(() => fit);
      }
    };
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener('loadingdone', measure);
    return () => {
      active = false;
      document.fonts.removeEventListener('loadingdone', measure);
    };
  }, [hasCells]);

  const defaults = defaultColumnWidths(viewport);
  const widths = { ...defaults, ...custom };
  const tableWidth = CHECK_WIDTH + columns.reduce((total, key) => total + widths[key], 0);
  function resize(key: RosterColumn, width: number) {
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH[key], Math.round(width)));
    setCustom((current) => ({ ...current, [key]: next }));
  }
  function resetWidth(key: RosterColumn) {
    setCustom((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }
  function startDrag(e: PointerEvent<HTMLSpanElement>, column: RosterColumn) {
    if (!e.isPrimary || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, column, startX: e.clientX, startWidth: widths[column] };
  }
  function moveDrag(e: PointerEvent<HTMLSpanElement>) {
    const active = drag.current;
    if (active?.id === e.pointerId)
      resize(active.column, active.startWidth + e.clientX - active.startX);
  }
  function onResizeKey(e: KeyboardEvent<HTMLSpanElement>, column: RosterColumn) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.shiftKey ? 40 : 8;
      resize(column, widths[column] + (e.key === 'ArrowLeft' ? -step : step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      resetWidth(column);
    }
  }
  return (
    <div
      ref={container}
      className="roster-scroll"
      tabIndex={0}
      role="region"
      aria-label="참가자 명단 표"
    >
      <table ref={table} className="roster-table" style={{ width: tableWidth }} aria-busy={busy}>
        <caption className="sr-only">참가자 명단</caption>
        <colgroup>
          <col style={{ width: CHECK_WIDTH }} />
          {columns.map((key) => (
            <col key={key} style={{ width: widths[key] }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="roster-check">
              <span className="sr-only">선택</span>
            </th>
            {columns.map((key) => {
              const direction = key === sort.column ? sort.direction : undefined;
              return (
                <th key={key} scope="col" data-column={key} aria-sort={direction}>
                  {key === 'number' ? (
                    ROSTER_COLUMNS.number
                  ) : (
                    <button
                      type="button"
                      className="roster-sort"
                      onClick={() => onSort(key)}
                      title={
                        ROSTER_COLUMNS[key] +
                        ' ' +
                        (direction === 'ascending' ? '내림차순' : '오름차순') +
                        ' 정렬'
                      }
                    >
                      {ROSTER_COLUMNS[key]}
                      <span className="sort-mark" aria-hidden="true" />
                    </button>
                  )}
                  <span
                    className="roster-resize"
                    role="separator"
                    aria-orientation="vertical"
                    tabIndex={0}
                    aria-label={ROSTER_COLUMNS[key] + ' 열 너비'}
                    aria-valuemin={MIN_WIDTH[key]}
                    aria-valuemax={MAX_WIDTH}
                    aria-valuenow={widths[key]}
                    aria-valuetext={widths[key] + '픽셀'}
                    title="드래그하거나 좌우 방향키로 너비 조절 · 두 번 클릭하면 기본 너비"
                    onPointerDown={(e) => startDrag(e, key)}
                    onPointerMove={moveDrag}
                    onLostPointerCapture={() => {
                      drag.current = null;
                    }}
                    onDoubleClick={() => resetWidth(key)}
                    onKeyDown={(e) => onResizeKey(e, key)}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {message ? (
            <tr>
              <td colSpan={columns.length + 1} className="roster-empty">
                {message}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = rosterKey(row),
                checked = selected === id,
                locked = busy || (selected !== null && !checked);
              const toggle = () => onSelect(checked ? null : id);
              return (
                <tr
                  key={id}
                  data-selected={checked || undefined}
                  data-locked={locked || undefined}
                  onClick={(e) => {
                    if (!locked && !(e.target as Element).closest('button,input,label')) toggle();
                  }}
                >
                  <td className="roster-check">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={toggle}
                      aria-label={row.name + ' 선택'}
                    />
                  </td>
                  {columns.map((key) => {
                    const value = rosterCell(row, key);
                    const visible = fitText ? fitText(key, value, widths[key]) : value;
                    return (
                      <td
                        key={key}
                        data-column={key}
                        title={value || undefined}
                        aria-label={visible !== value && key !== 'name' ? value : undefined}
                      >
                        {key === 'name' ? (
                          <button
                            className="roster-name"
                            aria-label={visible !== value ? value : undefined}
                            type="button"
                            onClick={() => onOpen(row)}
                            disabled={locked}
                          >
                            {visible}
                          </button>
                        ) : (
                          <span data-status={key === 'status' ? rosterStatus(row) : undefined}>
                            {visible || '—'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
