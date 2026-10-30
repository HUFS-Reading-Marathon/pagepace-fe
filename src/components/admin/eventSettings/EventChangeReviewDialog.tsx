import { useRef } from 'react';
import { useModalDialog } from '../../../hooks/useModalDialog';
import type { FormChange } from '../../../utils/adminEventForms';

type EventChangeReviewDialogProps = {
  eventLabel: string;
  changes: FormChange[];
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** 행사·코스 설정 저장 전에 기존 값과 변경 값을 나란히 보여 주는 확인 창입니다. */
function EventChangeReviewDialog({
  eventLabel,
  changes,
  isSaving,
  onCancel,
  onConfirm,
}: EventChangeReviewDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const { handleBackdropMouseDown } = useModalDialog({
    onClose: () => {
      if (!isSaving) onCancel();
    },
    initialFocusRef: cancelButtonRef,
  });
  const impacts = [...new Set(changes.flatMap((change) => change.impact ?? []))];

  return (
    <div className="admin-event-change-review__backdrop" onMouseDown={handleBackdropMouseDown}>
      <section
        className="admin-event-change-review"
        role="dialog"
        aria-modal="true"
        aria-labelledby="eventChangeReviewTitle"
        aria-describedby="eventChangeReviewDescription"
      >
        <header>
          <h2 id="eventChangeReviewTitle">변경사항 확인</h2>
          <p id="eventChangeReviewDescription">
            <strong>{eventLabel}</strong>에 아래 {changes.length}개 항목이 저장됩니다. 선택한
            행사에만 적용됩니다.
          </p>
        </header>

        <div className="admin-event-change-review__table-wrapper">
          <table>
            <thead>
              <tr>
                <th scope="col">대상</th>
                <th scope="col">항목</th>
                <th scope="col">기존 값</th>
                <th scope="col" aria-label="변경 방향" />
                <th scope="col">변경할 값</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={`${change.scope}-${change.label}`}>
                  <td>{change.scope}</td>
                  <th scope="row">{change.label}</th>
                  <td className="is-before">{change.before}</td>
                  <td aria-hidden="true">→</td>
                  <td className="is-after">{change.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {impacts.length > 0 && (
          <ul className="admin-event-change-review__impacts">
            {impacts.map((impact) => (
              <li key={impact}>{impact}</li>
            ))}
          </ul>
        )}

        <footer>
          <button
            ref={cancelButtonRef}
            type="button"
            className="admin-button"
            disabled={isSaving}
            onClick={onCancel}
          >
            계속 수정
          </button>
          <button
            type="button"
            className="admin-button admin-button--primary"
            disabled={isSaving}
            aria-busy={isSaving}
            onClick={onConfirm}
          >
            {isSaving ? '저장 중…' : '변경사항 저장'}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default EventChangeReviewDialog;
