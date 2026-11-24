import { useEffect, useRef } from 'react';
import type { ImportedReview } from '../../../api/reviewImportApi';
import {
  formatMeters,
  formatPages,
  formatSourceTime,
  getDefaultCandidate,
  isBulkConfirmableRow,
  type ReviewImportView,
} from '../../../types/adminReviewImport';
import { formatKoDateTime24 } from '../../../utils/date';
import SortHeaderButton from '../table/SortHeaderButton';
import ReviewImportStatusBadge from './ReviewImportStatusBadge';
import {
  REVIEW_IMPORT_SORT_COLUMNS,
  type ReviewImportSort,
  type ReviewImportSortColumn,
} from './reviewImportSort';

const HEADER_CLASS: Partial<Record<ReviewImportSortColumn, string>> = {
  sourceRow: 'admin-review-table__row-no',
  pages: 'admin-review-table__number',
  meters: 'admin-review-table__number',
};

type ReviewImportTableProps = {
  view: Exclude<ReviewImportView, 'excluded'>;
  /** 현재 쪽의 행 */
  rows: ImportedReview[];
  /** 상세 창에서 마지막으로 본 행 (표에서 구분해 보여 줍니다) */
  activeRowId: number | null;
  selectedIds: number[];
  busy: boolean;
  readOnly: boolean;
  emptyMessage: string;
  /** 현재 정렬. 표는 이미 정렬된 행(현재 쪽)을 받습니다. */
  sort: ReviewImportSort;
  /** 컬럼 제목을 눌러 정렬 (같은 컬럼을 다시 누르면 방향 전환) */
  onSort: (column: ReviewImportSortColumn) => void;
  /** 상세 창 열기 */
  onSelectRow: (rowId: number) => void;
  onToggleRow: (rowId: number, checked: boolean) => void;
  /** 이 쪽의 반영 가능 행 전체 선택·해제 */
  onToggleAll: (checked: boolean) => void;
};

function CreditCells({ row }: { row: ImportedReview }) {
  const candidate = getDefaultCandidate(row);

  if (!candidate) {
    return (
      <>
        <td className="admin-review-table__number" colSpan={2}>
          {row.candidates.length > 1 ? `후보 ${row.candidates.length}권 · 선택 필요` : '—'}
        </td>
      </>
    );
  }

  return (
    <>
      <td className="admin-review-table__number">{formatPages(candidate.uncreditedPages)}</td>
      <td className="admin-review-table__number admin-review-table__meters">
        {formatMeters(candidate.distanceToCreditMeter)}
      </td>
    </>
  );
}

function ResultCell({ row }: { row: ImportedReview }) {
  if (row.status === 'BOOK_VERIFIED') {
    return <td className="admin-review-table__note">다른 서평으로 이미 인정된 책</td>;
  }

  if (!row.verification) {
    return <td className="admin-review-table__note">—</td>;
  }

  return (
    <td className="admin-review-table__note">
      <strong>
        {formatPages(row.verification.creditedPages)} ·{' '}
        {formatMeters(row.verification.creditedDistanceMeter)}
      </strong>
      <small>
        {row.verification.verifiedBy} · {formatKoDateTime24(row.verification.verifiedAt)}
      </small>
    </td>
  );
}

function ReasonCell({ row }: { row: ImportedReview }) {
  const [first, ...rest] = row.warnings;

  return (
    <td className="admin-review-table__note">
      {first ?? '—'}
      {rest.length > 0 && <small>외 {rest.length}건</small>}
    </td>
  );
}

/**
 * 대조 결과 표(현재 쪽). 행이나 상세 보기 버튼을 누르면 상세 창에서 원문과 대조 내용을 확인합니다.
 * 반영 가능 보기에서는 경고 없는 행을 골라 한 번에 반영할 수 있습니다.
 */
function ReviewImportTable({
  view,
  rows,
  activeRowId,
  selectedIds,
  busy,
  readOnly,
  emptyMessage,
  sort,
  onSort,
  onSelectRow,
  onToggleRow,
  onToggleAll,
}: ReviewImportTableProps) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectable = view === 'ready' && !readOnly;
  const eligibleRows = selectable ? rows.filter(isBulkConfirmableRow) : [];
  const selectedCount = eligibleRows.filter((row) => selectedIds.includes(row.id)).length;
  const allSelected = eligibleRows.length > 0 && selectedCount === eligibleRows.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected;
    }
  }, [allSelected, selectedCount]);

  if (rows.length === 0) {
    return <p className="admin-review-table__empty">{emptyMessage}</p>;
  }

  return (
    <div className="admin-review-table__wrapper">
      <table className="admin-review-table">
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="admin-review-table__check">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  disabled={busy || eligibleRows.length === 0}
                  aria-label="이 쪽의 반영 가능 서평 전체 선택"
                  onChange={(event) => onToggleAll(event.target.checked)}
                />
              </th>
            )}
            {REVIEW_IMPORT_SORT_COLUMNS[view].map(([column, label]) => {
              const direction = sort.column === column ? sort.direction : undefined;
              return (
                <th key={column} scope="col" className={HEADER_CLASS[column]} aria-sort={direction}>
                  <SortHeaderButton
                    label={label}
                    direction={direction}
                    disabled={busy}
                    onSort={() => onSort(column)}
                  />
                </th>
              );
            })}
            <th scope="col" className="admin-review-table__open">
              상세
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isActive = row.id === activeRowId;
            const canSelect = selectable && isBulkConfirmableRow(row);

            return (
              <tr
                key={row.id}
                className={isActive ? 'is-active' : undefined}
                onClick={() => onSelectRow(row.id)}
              >
                {selectable && (
                  <td
                    className="admin-review-table__check"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      disabled={busy || !canSelect}
                      aria-label={`엑셀 ${row.sourceRow}행 ${row.memberName ?? ''} 서평 선택`}
                      onChange={(event) => onToggleRow(row.id, event.target.checked)}
                    />
                  </td>
                )}
                <td className="admin-review-table__row-no">{row.sourceRow}</td>
                <td className="admin-review-table__person">
                  <strong>{row.memberName || '이름 없음'}</strong>
                  <small>{row.memberNo || '회원번호 없음'}</small>
                </td>
                <td className="admin-review-table__book">
                  <strong>{row.bookTitle || '도서명 없음'}</strong>
                  <small>도서 ID {row.libraryBookId ?? '—'}</small>
                </td>
                {view === 'ready' && (
                  <>
                    <td className="admin-review-table__date">
                      {formatSourceTime(row.sourceUpdatedAt)}
                    </td>
                    <CreditCells row={row} />
                  </>
                )}
                {view === 'review' && (
                  <>
                    <ReasonCell row={row} />
                    <CreditCells row={row} />
                  </>
                )}
                {view === 'done' && (
                  <>
                    <td>
                      <ReviewImportStatusBadge status={row.status} />
                    </td>
                    <ResultCell row={row} />
                  </>
                )}
                {view === 'blocked' && (
                  <>
                    <td>
                      <ReviewImportStatusBadge status={row.status} />
                    </td>
                    <ReasonCell row={row} />
                  </>
                )}
                <td
                  className="admin-review-table__open"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    id={`review-import-row-${row.id}`}
                    className="admin-review-table__open-button"
                    aria-label={`엑셀 ${row.sourceRow}행 ${row.memberName ?? ''} 서평 상세 보기`}
                    onClick={() => onSelectRow(row.id)}
                  >
                    상세 보기
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ReviewImportTable;
