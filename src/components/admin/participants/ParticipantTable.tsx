import { useEffect, useRef } from 'react';
import {
  ROSTER_STATUSES,
  rosterStatus,
  rosterKey,
  type RosterRow,
} from '../../../api/adminRosterApi';
import { ADMIN_APPLICATION_AFFILIATION_LABELS } from '../../../types/adminApplication';
import { formatKoDate } from '../../../utils/date';

type Props = {
  rows: RosterRow[];
  selected: ReadonlySet<number>;
  onSelect: (ids: number[], checked: boolean) => void;
  onOpen: (row: RosterRow) => void;
  busy: boolean;
  message: string;
};

export default function ParticipantTable({
  rows,
  selected,
  onSelect,
  onOpen,
  busy,
  message,
}: Props) {
  const selectPage = useRef<HTMLInputElement>(null);
  const checkedCount = rows.filter((r) => selected.has(rosterKey(r))).length;
  useEffect(() => {
    if (selectPage.current)
      selectPage.current.indeterminate = checkedCount > 0 && checkedCount < rows.length;
  }, [checkedCount, rows.length]);
  return (
    <div className="roster-scroll">
      <table className="roster-table" aria-busy={busy}>
        <caption className="sr-only">참가자 명단</caption>
        <thead>
          <tr>
            <th scope="col" className="roster-check">
              <input
                type="checkbox"
                aria-label="현재 페이지 전체 선택"
                ref={selectPage}
                checked={!!rows.length && checkedCount === rows.length}
                disabled={busy || !rows.length}
                onChange={(e) => onSelect(rows.map(rosterKey), e.target.checked)}
              />
            </th>
            {['순번', '이름', '학번/사번', '신분', '소속', '코스', '상태', '연락처', '등록일'].map(
              (title) => (
                <th scope="col" key={title}>
                  {title}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {message ? (
            <tr>
              <td colSpan={10} className="roster-empty">
                {message}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const status = rosterStatus(row);
              return (
                <tr key={rosterKey(row)} data-selected={selected.has(rosterKey(row)) || undefined}>
                  <td className="roster-check">
                    <input
                      type="checkbox"
                      aria-label={row.name + ' 선택'}
                      checked={selected.has(rosterKey(row))}
                      onChange={(e) => onSelect([rosterKey(row)], e.target.checked)}
                      disabled={busy}
                    />
                  </td>
                  <td className="roster-number">{row.serialNo}</td>
                  <td>
                    <button type="button" className="roster-name" onClick={() => onOpen(row)}>
                      {row.name}
                    </button>
                  </td>
                  <td>{row.studentNo}</td>
                  <td>{ADMIN_APPLICATION_AFFILIATION_LABELS[row.affiliationType]}</td>
                  <td className="roster-dept">{row.department || '—'}</td>
                  <td>{row.courseName}</td>
                  <td>
                    <span data-status={status}>{status ? ROSTER_STATUSES[status] : '—'}</span>
                  </td>
                  <td>{row.phone || '—'}</td>
                  <td className="roster-date">{formatKoDate(row.registeredAt)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
