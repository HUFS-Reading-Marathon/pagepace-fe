import { type FormEvent, useRef, useState } from 'react';
import { useModalDialog } from '../../../hooks/useModalDialog';
import {
  ADMIN_APPLICATION_AFFILIATION_LABELS,
  type AdminApplicationDetail,
  type AdminApplicationListItem,
} from '../../../types/adminApplication';
import { formatKoDateTime } from '../../../utils/date';
import ParticipantStatusBadge from './ParticipantStatusBadge';

type ParticipantDetailDialogProps = {
  application: AdminApplicationDetail | null;
  fallbackApplication: AdminApplicationListItem;
  isLoading: boolean;
  error: string | null;
  actionError: string | null;
  isProcessing: boolean;
  /** 현재 목록에서의 위치. 시트를 닫지 않고 이전·다음 신청서로 이동할 때 사용합니다. */
  position: { index: number; total: number };
  initialRejecting?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onApprove: (applicationId: number) => void;
  /** 반려 요청. 서버 처리에 성공하면 true를 돌려줍니다. */
  onReject: (applicationId: number, reason: string) => Promise<boolean>;
};

function ParticipantDetailDialog({
  application,
  fallbackApplication,
  isLoading,
  error,
  actionError,
  isProcessing,
  position,
  initialRejecting = false,
  onPrevious,
  onNext,
  onClose,
  onApprove,
  onReject,
}: ParticipantDetailDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [isRejecting, setIsRejecting] = useState(initialRejecting);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const displayedApplication = application ?? fallbackApplication;
  const { handleBackdropMouseDown } = useModalDialog({
    onClose,
    initialFocusRef: closeButtonRef,
    restoreFocus: true,
  });

  const handleRejectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = rejectReason.trim();

    if (!reason) {
      setRejectError('반려 사유를 입력해 주세요.');
      return;
    }

    if (await onReject(displayedApplication.applicationId, reason)) {
      setIsRejecting(false);
      setRejectReason('');
    }
  };

  return (
    <div className="admin-participant-dialog__backdrop" onMouseDown={handleBackdropMouseDown}>
      <section
        className="admin-participant-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="participantDialogTitle"
        aria-busy={isLoading || isProcessing}
      >
        <header className="admin-participant-dialog__header">
          <div>
            <p className="admin-participant-dialog__eyebrow">
              {displayedApplication.status === 'APPROVED' ? '참가자 상세' : '참가 신청서 상세'}
            </p>
            <div className="admin-participant-dialog__title-row">
              <h2 id="participantDialogTitle">{displayedApplication.name}</h2>
              <ParticipantStatusBadge status={displayedApplication.status} />
            </div>
          </div>

          <div className="admin-participant-dialog__nav">
            <span>
              {position.index + 1} / {position.total}
            </span>
            <button
              type="button"
              aria-label="이전 신청서"
              disabled={!onPrevious || isProcessing}
              onClick={onPrevious}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="다음 신청서"
              disabled={!onNext || isProcessing}
              onClick={onNext}
            >
              ›
            </button>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="admin-participant-dialog__close"
            aria-label="참가자 상세 다이얼로그 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {isLoading ? (
          <div className="admin-participant-dialog__content">
            <p className="admin-participant-dialog__mode-description" role="status">
              참가신청 상세를 불러오는 중입니다.
            </p>
          </div>
        ) : error ? (
          <div className="admin-participant-dialog__content">
            <p className="admin-participant-dialog__error" role="alert">
              {error}
            </p>
          </div>
        ) : (
          <div className="admin-participant-dialog__content">
            <section className="admin-participant-dialog__section">
              <h3>기본 정보</h3>
              <dl className="admin-participant-dialog__details">
                <div>
                  <dt>이름</dt>
                  <dd>{displayedApplication.name || '-'}</dd>
                </div>
                <div>
                  <dt>학번/사번</dt>
                  <dd>{displayedApplication.studentNo || '-'}</dd>
                </div>
                <div>
                  <dt>소속</dt>
                  <dd>{displayedApplication.department || '-'}</dd>
                </div>
                <div>
                  <dt>신분</dt>
                  <dd>
                    {ADMIN_APPLICATION_AFFILIATION_LABELS[displayedApplication.affiliationType] ??
                      displayedApplication.affiliationType}
                  </dd>
                </div>
                <div>
                  <dt>연락처</dt>
                  <dd>{displayedApplication.phone || '-'}</dd>
                </div>
                <div>
                  <dt>이메일</dt>
                  <dd className="admin-participant-dialog__break-text">
                    {displayedApplication.email || '-'}
                  </dd>
                </div>
                <div>
                  <dt>신청일시</dt>
                  <dd>{formatKoDateTime(displayedApplication.appliedAt)}</dd>
                </div>
              </dl>
            </section>

            <section className="admin-participant-dialog__section">
              <h3>참가 정보</h3>
              <dl className="admin-participant-dialog__details">
                <div>
                  <dt>행사</dt>
                  <dd>{displayedApplication.eventTitle || '-'}</dd>
                </div>
                <div>
                  <dt>선택 코스</dt>
                  <dd>{displayedApplication.courseName || '-'}</dd>
                </div>
                <div>
                  <dt>현재 신청 상태</dt>
                  <dd>
                    <ParticipantStatusBadge status={displayedApplication.status} />
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {actionError && !isLoading && !error && (
          <div className="admin-participant-dialog__content">
            <p className="admin-participant-dialog__error" role="alert">
              {actionError}
            </p>
          </div>
        )}

        {isRejecting && !isLoading && !error ? (
          <form className="admin-participant-dialog__reject" onSubmit={handleRejectSubmit}>
            <label htmlFor="participantRejectReason">반려 사유</label>
            <textarea
              id="participantRejectReason"
              rows={4}
              value={rejectReason}
              placeholder="신청자에게 안내할 반려 사유를 입력해 주세요."
              aria-describedby={rejectError ? 'participantRejectError' : undefined}
              onChange={(event) => {
                setRejectReason(event.target.value);
                setRejectError('');
              }}
            />
            {rejectError && (
              <p
                id="participantRejectError"
                className="admin-participant-dialog__error"
                role="alert"
              >
                {rejectError}
              </p>
            )}
            <div className="admin-participant-dialog__actions">
              <button
                type="button"
                className="admin-participant-dialog__button"
                disabled={isProcessing}
                onClick={() => {
                  setIsRejecting(false);
                  setRejectError('');
                }}
              >
                돌아가기
              </button>
              <button
                type="submit"
                className="admin-participant-dialog__button admin-participant-dialog__button--danger"
                disabled={isProcessing}
              >
                {isProcessing ? '처리 중...' : '반려 확정'}
              </button>
            </div>
          </form>
        ) : (
          <footer className="admin-participant-dialog__actions">
            {!isLoading && !error && displayedApplication.status === 'APPLIED' ? (
              <>
                <button
                  type="button"
                  className="admin-participant-dialog__button admin-participant-dialog__button--danger"
                  onClick={() => setIsRejecting(true)}
                  disabled={isProcessing}
                >
                  반려
                </button>
                <button
                  type="button"
                  className="admin-participant-dialog__button admin-participant-dialog__button--primary"
                  onClick={() => onApprove(displayedApplication.applicationId)}
                  disabled={isProcessing}
                >
                  {isProcessing ? '처리 중...' : '참가 승인'}
                </button>
              </>
            ) : (
              !isLoading &&
              !error && (
                <p className="admin-participant-dialog__pending-note">
                  정보 수정·코스 변경·참가 취소는 서버 API가 확인되면 제공됩니다.
                </p>
              )
            )}
            <button type="button" className="admin-participant-dialog__button" onClick={onClose}>
              닫기
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}

export default ParticipantDetailDialog;
