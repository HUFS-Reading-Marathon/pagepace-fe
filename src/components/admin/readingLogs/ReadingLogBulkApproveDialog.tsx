import { type MouseEvent, useEffect, useRef } from 'react';

type ReadingLogBulkApproveDialogProps = {
  selectedCount: number;
  onClose: () => void;
  onConfirm: () => void;
};

function ReadingLogBulkApproveDialog({
  selectedCount,
  onClose,
  onConfirm,
}: ReadingLogBulkApproveDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
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
    };
  }, []);

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="admin-reading-log-dialog__backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
      <section
        className="admin-reading-log-dialog admin-reading-log-dialog--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulkApproveDialogTitle"
        aria-describedby="bulkApproveDialogDescription"
      >
        <header className="admin-reading-log-dialog__header">
          <div>
            <p className="admin-reading-log-dialog__eyebrow">일괄 처리 확인</p>
            <h2 id="bulkApproveDialogTitle">독서일지 일괄 승인</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="admin-reading-log-dialog__close"
            aria-label="일괄 승인 확인 창 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="admin-reading-log-dialog__content">
          <p
            id="bulkApproveDialogDescription"
            className="admin-reading-log-dialog__confirm-message"
          >
            선택한 <strong>{selectedCount}건</strong>의 독서일지를
            승인하시겠습니까?
          </p>
          <div className="admin-reading-log-dialog__warning">
            자동 검증은 입력값의 형식과 누적 초과만 확인합니다. 실제 책 전체
            페이지 수와 제외 도서 여부를 직접 확인한 뒤 승인해 주세요.
          </div>
        </div>

        <footer className="admin-reading-log-dialog__actions">
          <button
            type="button"
            className="admin-reading-log-dialog__button admin-reading-log-dialog__button--primary"
            onClick={onConfirm}
          >
            {selectedCount}건 승인하기
          </button>
          <button
            type="button"
            className="admin-reading-log-dialog__button"
            onClick={onClose}
          >
            돌아가기
          </button>
        </footer>
      </section>
    </div>
  );
}

export default ReadingLogBulkApproveDialog;
