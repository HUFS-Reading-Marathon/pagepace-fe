import { type MouseEvent, useEffect, useRef } from 'react';
import type {
  StatusDialogMode,
  StatusSnapshot,
} from '../../../types/adminStatus';
import { formatStatusDate } from '../../../utils/statusAggregation';

type StatusPublishConfirmDialogProps = {
  mode: Exclude<StatusDialogMode, null>;
  snapshot: StatusSnapshot;
  isPublic: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function StatusPublishConfirmDialog({
  mode,
  snapshot,
  isPublic,
  onClose,
  onConfirm,
}: StatusPublishConfirmDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const completedCount = snapshot.participants.filter(
    (participant) => participant.isCompleted,
  ).length;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousBodyOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const isPublishMode = mode === 'publish';
  const title = isPublishMode
    ? isPublic
      ? '공개본 업데이트 확인'
      : '대회 현황 공개 확인'
    : '비공개 전환 확인';

  return (
    <div
      className="admin-status-dialog__backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        className="admin-status-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="statusDialogTitle"
      >
        <header className="admin-status-dialog__header">
          <div>
            <p>대회 현황 공개 관리</p>
            <h2 id="statusDialogTitle">{title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="확인 창 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="admin-status-dialog__content">
          {isPublishMode ? (
            <>
              <p>
                현재 미리보기 내용으로 사용자 대회 현황을 공개합니다.
              </p>
              <dl>
                <div>
                  <dt>기준 날짜</dt>
                  <dd>{formatStatusDate(snapshot.baseDate)}</dd>
                </div>
                <div>
                  <dt>공개 참가자</dt>
                  <dd>{snapshot.participants.length}명</dd>
                </div>
                <div>
                  <dt>이름 마스킹</dt>
                  <dd>{snapshot.settings.maskNames ? '사용' : '미사용'}</dd>
                </div>
                <div>
                  <dt>순위 공개</dt>
                  <dd>{snapshot.settings.showRanks ? '공개' : '비공개'}</dd>
                </div>
                <div>
                  <dt>완주자</dt>
                  <dd>{completedCount}명</dd>
                </div>
              </dl>
            </>
          ) : (
            <div className="admin-status-dialog__warning">
              비공개로 전환하면 사용자 화면에서 대회 현황을 볼 수 없습니다.
              기존 공개 스냅샷 데이터는 삭제되지 않습니다.
            </div>
          )}
        </div>

        <footer className="admin-status-dialog__actions">
          <button
            type="button"
            className={
              isPublishMode
                ? 'admin-status-dialog__button--primary'
                : 'admin-status-dialog__button--danger'
            }
            onClick={onConfirm}
          >
            {isPublishMode
              ? isPublic
                ? '공개본 업데이트'
                : '현황 공개'
              : '비공개 전환'}
          </button>
          <button type="button" onClick={onClose}>
            돌아가기
          </button>
        </footer>
      </section>
    </div>
  );
}

export default StatusPublishConfirmDialog;

