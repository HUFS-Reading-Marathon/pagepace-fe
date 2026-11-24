import ColumnResizeHandle from '../table/ColumnResizeHandle';
import SortHeaderButton from '../table/SortHeaderButton';
import { useColumnSizing, CHECK_WIDTH } from '../table/tableColumns';
import { useTableCellText } from '../table/useTableCellText';
import { MIN_WIDTH, defaultColumnWidths } from './rosterColumns';
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
  const { container, viewport, custom, resize, resetWidth } = useColumnSizing<RosterColumn>();
  const { table, fitText } = useTableCellText(!message && rows.length > 0);
  const defaults = defaultColumnWidths(viewport);
  const widths = { ...defaults, ...custom };
  const tableWidth = CHECK_WIDTH + columns.reduce((total, key) => total + widths[key], 0);
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
                    <SortHeaderButton
                      label={ROSTER_COLUMNS[key]}
                      direction={direction}
                      onSort={() => onSort(key)}
                    />
                  )}
                  <ColumnResizeHandle
                    label={ROSTER_COLUMNS[key]}
                    width={widths[key]}
                    minWidth={MIN_WIDTH[key]}
                    onChange={(width) => resize(key, width)}
                    onReset={() => resetWidth(key)}
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
