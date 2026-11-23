import { Fragment, useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import type { ImportedReview } from '../../../api/reviewImportApi';
import {
  formatMeters,
  formatPages,
  formatSourceTime,
  getCompactComparisons,
  getDefaultCandidate,
  getReviewRowElementId,
  isBulkConfirmableRow,
  isConfirmableRow,
  type ReviewImportView,
} from '../../../types/adminReviewImport';
import { formatKoDateTime24 } from '../../../utils/date';
import ReviewImportStatusBadge from './ReviewImportStatusBadge';

type ReviewImportTableProps = {
  view: Exclude<ReviewImportView, 'excluded'>;
  rows: ImportedReview[];
  expandedRowId: number | null;
  selectedIds: number[];
  busy: boolean;
  readOnly: boolean;
  emptyMessage: string;
  onToggleExpand: (rowId: number) => void;
  onToggleRow: (rowId: number, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  renderDetail: (row: ImportedReview) => ReactNode;
};

function SourceCell({ row }: { row: ImportedReview }) {
  return (
    <td className="admin-review-table__side" data-label="솔라스 서평">
      <strong>
        {row.memberName || '이름 없음'} <small>{row.memberNo || '회원번호 없음'}</small>
      </strong>
      <span className="admin-review-table__book">{row.bookTitle || '도서명 없음'}</span>
      <small>
        도서 ID {row.libraryBookId ?? '—'} · 수정 {formatSourceTime(row.sourceUpdatedAt)}
      </small>
    </td>
  );
}

function MatchCell({ row }: { row: ImportedReview }) {
  if (!isConfirmableRow(row)) {
    return (
      <td className="admin-review-table__match" data-label="대조">
        <ReviewImportStatusBadge status={row.status} />
      </td>
    );
  }

  const candidate = getDefaultCandidate(row);

  if (!candidate) {
    return (
      <td className="admin-review-table__match" data-label="대조">
        <span className="admin-review-mark is-title">후보 {row.candidates.length}권</span>
      </td>
    );
  }

  return (
    <td className="admin-review-table__match" data-label="대조">
      <span className="admin-review-marks">
        {getCompactComparisons(row, candidate).map((item) => (
          <span
            key={item.key}
            className={`admin-review-mark is-${item.mark}`}
            title={`${item.label}: ${item.title}`}
          >
            {item.label}
          </span>
        ))}
      </span>
    </td>
  );
}

function RecordCell({ row }: { row: ImportedReview }) {
  if (isConfirmableRow(row)) {
    const candidate = getDefaultCandidate(row);

    if (!candidate) {
      return (
        <td className="admin-review-table__side is-record" data-label="PagePace 기록">
          <strong>후보 도서 {row.candidates.length}권</strong>
          <small>펼쳐서 반영할 참가 도서를 고르세요.</small>
        </td>
      );
    }

    return (
      <td className="admin-review-table__side is-record" data-label="PagePace 기록">
        <strong>
          {candidate.name} <small>{candidate.studentNo}</small>
        </strong>
        <span className="admin-review-table__book">{candidate.bookTitle}</span>
        <small>
          도서 ID {candidate.libraryBookId} · 승인 누적 {formatPages(candidate.approvedPages)}
        </small>
      </td>
    );
  }

  if (row.status === 'ALREADY_APPLIED' && row.verification) {
    return (
      <td className="admin-review-table__side is-record" data-label="처리 결과">
        <strong>
          {formatPages(row.verification.creditedPages)} ·{' '}
          {formatMeters(row.verification.creditedDistanceMeter)} 인정
        </strong>
        <small>
          {row.verification.verifiedBy} · {formatKoDateTime24(row.verification.verifiedAt)}
        </small>
      </td>
    );
  }

  if (row.status === 'BOOK_VERIFIED') {
    return (
      <td className="admin-review-table__side is-record" data-label="처리 결과">
        <strong>다른 서평으로 이미 인정된 책</strong>
        <small>이후 승인되는 독서일지도 자동으로 반영됩니다.</small>
      </td>
    );
  }

  const [first, ...rest] = row.warnings;

  return (
    <td className="admin-review-table__side is-record is-reason" data-label="사유">
      <span>{first ?? '—'}</span>
      {rest.length > 0 && <small>외 {rest.length}건</small>}
    </td>
  );
}

function CreditCell({ row }: { row: ImportedReview }) {
  const candidate = getDefaultCandidate(row);

  return (
    <td className="admin-review-table__credit" data-label="이번 인정">
      {candidate ? (
        <>
          <strong>{formatPages(candidate.uncreditedPages)}</strong>
          <span>{formatMeters(candidate.distanceToCreditMeter)}</span>
        </>
      ) : (
        <span className="admin-review-table__muted">선택 후 계산</span>
      )}
    </td>
  );
}

/**
 * 솔라스 서평(왼쪽)과 PagePace 독서 기록(오른쪽)을 한 줄에 나란히 놓는 대조표입니다.
 * 행을 펼치면 서평 원문·인정 계산·확인 항목이 화면 폭 전체로 열립니다.
 * 반영 가능 보기에서는 경고 없는 행을 골라 한 번에 반영할 수 있습니다.
 */
function ReviewImportTable({
  view,
  rows,
  expandedRowId,
  selectedIds,
  busy,
  readOnly,
  emptyMessage,
  onToggleExpand,
  onToggleRow,
  onToggleAll,
  renderDetail,
}: ReviewImportTableProps) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selectable = view === 'ready' && !readOnly;
  const showCredit = view === 'ready' || view === 'review';
  const columnCount = (selectable ? 1 : 0) + 4 + (showCredit ? 1 : 0) + 1;
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

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>, rowId: number) => {
    const target = event.target as HTMLElement;
    if (target.closest('input, button, a, label')) return;
    onToggleExpand(rowId);
  };

  return (
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
                aria-label="표에 보이는 반영 가능 서평 전체 선택"
                onChange={(event) => onToggleAll(event.target.checked)}
              />
            </th>
          )}
          <th scope="col" className="admin-review-table__row-no">
            행
          </th>
          <th scope="col" className="admin-review-table__side-head">
            <span>솔라스 서평</span>
          </th>
          <th scope="col" className="admin-review-table__match-head">
            {showCredit ? '대조' : '상태'}
          </th>
          <th scope="col" className="admin-review-table__side-head is-record">
            <span>
              {showCredit ? 'PagePace 독서 기록' : view === 'done' ? '처리 결과' : '사유'}
            </span>
          </th>
          {showCredit && (
            <th scope="col" className="admin-review-table__credit">
              이번 인정
            </th>
          )}
          <th scope="col" className="admin-review-table__toggle-cell">
            <span className="admin-review-table__sr">펼치기</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const expanded = row.id === expandedRowId;
          const canSelect = selectable && isBulkConfirmableRow(row);
          const detailId = `reviewImportDetail-${row.id}`;

          return (
            <Fragment key={row.id}>
              <tr
                id={getReviewRowElementId(row.id)}
                className={`admin-review-table__row${expanded ? ' is-expanded' : ''}${
                  selectedIds.includes(row.id) ? ' is-selected' : ''
                }`}
                onClick={(event) => handleRowClick(event, row.id)}
              >
                {selectable && (
                  <td className="admin-review-table__check">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      disabled={busy || !canSelect}
                      aria-label={`엑셀 ${row.sourceRow}행 ${row.memberName ?? ''} 서평 선택`}
                      onChange={(event) => onToggleRow(row.id, event.target.checked)}
                    />
                  </td>
                )}
                <td className="admin-review-table__row-no" data-label="엑셀 행">
                  {row.sourceRow}
                </td>
                <SourceCell row={row} />
                <MatchCell row={row} />
                <RecordCell row={row} />
                {showCredit && <CreditCell row={row} />}
                <td className="admin-review-table__toggle-cell">
                  <button
                    type="button"
                    className="admin-review-table__toggle"
                    aria-expanded={expanded}
                    aria-controls={expanded ? detailId : undefined}
                    aria-label={`엑셀 ${row.sourceRow}행 ${expanded ? '접기' : '원문·계산 펼치기'}`}
                    onClick={() => onToggleExpand(row.id)}
                  >
                    <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
                      <path
                        d="M1.5 1.75 6 6.25l4.5-4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
              {expanded && (
                <tr className="admin-review-table__detail-row">
                  <td id={detailId} colSpan={columnCount}>
                    {renderDetail(row)}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

export default ReviewImportTable;
