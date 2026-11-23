import { useRef, useState } from 'react';
import type { ImportedReview } from '../../../api/reviewImportApi';
import { useModalDialog } from '../../../hooks/useModalDialog';
import { formatMeters, formatPages, getDefaultCandidate } from '../../../types/adminReviewImport';

type ReviewImportBulkDialogProps = {
  rows: ImportedReview[];
  progress: { done: number; total: number } | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/** 선택한 반영 가능 서평을 한 번에 반영하기 전에 대상과 합계를 확인하는 창입니다. */
function ReviewImportBulkDialog({
  rows,
  progress,
  onCancel,
  onConfirm,
}: ReviewImportBulkDialogProps) {
  const [checked, setChecked] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const running = progress !== null;
  const { handleBackdropMouseDown } = useModalDialog({
    onClose: () => {
      if (!running) onCancel();
    },
    initialFocusRef: cancelButtonRef,
    restoreFocus: true,
  });
  const totals = rows.reduce(
    (sum, row) => {
      const candidate = getDefaultCandidate(row);
      return {
        pages: sum.pages + (candidate?.uncreditedPages ?? 0),
        meters: sum.meters + (candidate?.distanceToCreditMeter ?? 0),
      };
    },
    { pages: 0, meters: 0 },
  );

  return (
    <div className="admin-review-bulk__backdrop" onMouseDown={handleBackdropMouseDown}>
      <section
        className="admin-review-bulk"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reviewBulkTitle"
        aria-describedby="reviewBulkDescription"
      >
        <header>
          <h2 id="reviewBulkTitle">선택한 서평 {rows.length}건 반영</h2>
          <p id="reviewBulkDescription">
            회원번호·도서 ID·이름이 모두 일치하고 확인 사항이 없는 서평입니다. 아래 분량이 각
            참가자의 인정 거리에 더해집니다.
          </p>
        </header>

        <div className="admin-review-bulk__table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">엑셀 행</th>
                <th scope="col">작성자</th>
                <th scope="col">도서</th>
                <th scope="col" className="admin-review-table__number">
                  인정 쪽수
                </th>
                <th scope="col" className="admin-review-table__number">
                  인정 거리
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const candidate = getDefaultCandidate(row);
                return (
                  <tr key={row.id}>
                    <td>{row.sourceRow}</td>
                    <td>
                      {row.memberName} <small>{row.memberNo}</small>
                    </td>
                    <td>{candidate?.bookTitle ?? row.bookTitle}</td>
                    <td className="admin-review-table__number">
                      {formatPages(candidate?.uncreditedPages ?? 0)}
                    </td>
                    <td className="admin-review-table__number">
                      {formatMeters(candidate?.distanceToCreditMeter ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3}>
                  합계
                </th>
                <td className="admin-review-table__number">{formatPages(totals.pages)}</td>
                <td className="admin-review-table__number">{formatMeters(totals.meters)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <label className="admin-review-bulk__check">
          <input
            type="checkbox"
            checked={checked}
            disabled={running}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span>선택한 서평의 작성자·도서·원문과 행사 인정 기간을 확인했습니다.</span>
        </label>

        <footer>
          {running && (
            <p className="admin-review-bulk__progress" role="status">
              {progress.done} / {progress.total}건 처리 중
            </p>
          )}
          <button
            ref={cancelButtonRef}
            type="button"
            className="admin-button"
            disabled={running}
            onClick={onCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="admin-button admin-button--primary"
            disabled={!checked || running}
            onClick={onConfirm}
          >
            {running ? '반영 중…' : `${rows.length}건 반영`}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default ReviewImportBulkDialog;
