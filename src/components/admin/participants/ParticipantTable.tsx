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
  onSort: (column: RosterColumn) => void;
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
  return (
    <div className="roster-scroll" tabIndex={0} role="region" aria-label="참가자 명단 표">
      <table className="roster-table" aria-busy={busy}>
        <caption className="sr-only">참가자 명단</caption>
        <colgroup>
          <col className="roster-col-check" />
          {columns.map((key) => (
            <col key={key} className={'roster-col-' + key} />
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
                    return (
                      <td key={key} data-column={key} title={value || undefined}>
                        {key === 'name' ? (
                          <button
                            className="roster-name"
                            type="button"
                            onClick={() => onOpen(row)}
                            disabled={locked}
                          >
                            {value}
                          </button>
                        ) : (
                          <span data-status={key === 'status' ? rosterStatus(row) : undefined}>
                            {value || '—'}
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
