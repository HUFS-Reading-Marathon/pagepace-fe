import { useRef } from 'react';
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
  onClose: () => void;
  onApprove: (applicationId: number) => void;
  onReject: (applicationId: number) => void;
};

function ParticipantDetailDialog({
  application,
  fallbackApplication,
  isLoading,
  error,
  actionError,
  isProcessing,
  onClose,
  onApprove,
  onReject,
}: ParticipantDetailDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const displayedApplication = application ?? fallbackApplication;
  const { handleBackdropMouseDown } = useModalDialog({
    onClose,
    initialFocusRef: closeButtonRef,
    restoreFocus: true,
  });

  return (
    <div
      className="admin-participant-dialog__backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
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
              참가 신청 상세
            </p>
            <div className="admin-participant-dialog__title-row">
              <h2 id="participantDialogTitle">
                {displayedApplication.name}
              </h2>
              <ParticipantStatusBadge status={displayedApplication.status} />
            </div>
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
            <p
              className="admin-participant-dialog__mode-description"
              role="status"
            >
              참가신청 상세를 불러오는 중입니다.
            </p>
          </div>
        ) : error ? (
          <div className="admin-participant-dialog__content">
            <p
              className="admin-participant-dialog__error"
              role="alert"
            >
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
                    {ADMIN_APPLICATION_AFFILIATION_LABELS[
                      displayedApplication.affiliationType
                    ] ?? displayedApplication.affiliationType}
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
                  <dd>
                    {formatKoDateTime(
                      displayedApplication.appliedAt,
                    )}
                  </dd>
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
                    <ParticipantStatusBadge
                      status={displayedApplication.status}
                    />
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {actionError && !isLoading && !error && (
          <div className="admin-participant-dialog__content">
            <p
              className="admin-participant-dialog__error"
              role="alert"
            >
              {actionError}
            </p>
          </div>
        )}

        <footer className="admin-participant-dialog__actions">
          {!isLoading &&
            !error &&
            displayedApplication.status === 'APPLIED' && (
              <>
                <button
                  type="button"
                  className="admin-participant-dialog__button admin-participant-dialog__button--primary"
                  onClick={() =>
                    onApprove(displayedApplication.applicationId)
                  }
                  disabled={isProcessing}
                >
                  {isProcessing ? '처리 중...' : '승인'}
                </button>
                <button
                  type="button"
                  className="admin-participant-dialog__button admin-participant-dialog__button--danger"
                  onClick={() => onReject(displayedApplication.applicationId)}
                  disabled={isProcessing}
                >
                  반려
                </button>
                <button
                  type="button"
                  className="admin-participant-dialog__button"
                  disabled
                  title="백엔드 참가신청 수정 API 확인이 필요합니다."
                >
                  정보 수정
                </button>
              </>
            )}
          {!isLoading &&
            !error &&
            displayedApplication.status === 'APPROVED' && (
              <>
                <button
                  type="button"
                  className="admin-participant-dialog__button"
                  disabled
                  title="백엔드 참가신청 수정 API 확인이 필요합니다."
                >
                  정보 수정
                </button>
                <button
                  type="button"
                  className="admin-participant-dialog__button"
                  disabled
                  title="백엔드 코스 변경 API 확인이 필요합니다."
                >
                  코스 변경
                </button>
                <button
                  type="button"
                  className="admin-participant-dialog__button admin-participant-dialog__button--danger"
                  disabled
                  title="백엔드 참가 취소 API 확인이 필요합니다."
                >
                  참가 취소
                </button>
              </>
            )}
          {!isLoading &&
            !error &&
            displayedApplication.status === 'REJECTED' && (
              <button
                type="button"
                className="admin-participant-dialog__button"
                disabled
                title="백엔드 참가신청 수정 API 확인이 필요합니다."
              >
                정보 수정
              </button>
            )}
          <button
            type="button"
            className="admin-participant-dialog__button"
            onClick={onClose}
          >
            닫기
          </button>
        </footer>
      </section>
    </div>
  );
}

export default ParticipantDetailDialog;
