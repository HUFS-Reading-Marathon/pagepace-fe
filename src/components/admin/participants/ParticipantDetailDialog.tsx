import {
  type FormEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AFFILIATION_OPTIONS,
  COURSE_LABELS,
  COURSE_OPTIONS,
  formatParticipantDateTime,
  getAffiliationDisplay,
  type AdminParticipant,
  type AdminParticipantUpdate,
  type AffiliationType,
  type CourseType,
  type ParticipantDialogMode,
} from '../../../types/adminParticipant';
import ParticipantStatusBadge from './ParticipantStatusBadge';

type ParticipantDetailDialogProps = {
  participant: AdminParticipant;
  initialMode: ParticipantDialogMode;
  onClose: () => void;
  onApprove: (participantId: string) => void;
  onReject: (participantId: string, reason: string) => void;
  onUpdate: (
    participantId: string,
    updates: AdminParticipantUpdate,
  ) => void;
  onCancelParticipation: (participantId: string) => void;
};

type ParticipantEditForm = {
  name: string;
  loginId: string;
  department: string;
  affiliation: AffiliationType;
  phone: string;
  email: string;
  course: CourseType;
  adminMemo: string;
};

function createEditForm(participant: AdminParticipant): ParticipantEditForm {
  return {
    name: participant.name,
    loginId: participant.loginId,
    department: participant.department,
    affiliation: participant.affiliation,
    phone: participant.phone,
    email: participant.email,
    course: participant.course,
    adminMemo: participant.adminMemo ?? '',
  };
}

function ParticipantDetailDialog({
  participant,
  initialMode,
  onClose,
  onApprove,
  onReject,
  onUpdate,
  onCancelParticipation,
}: ParticipantDetailDialogProps) {
  const [mode, setMode] = useState<ParticipantDialogMode>(initialMode);
  const [editForm, setEditForm] = useState<ParticipantEditForm>(() =>
    createEditForm(participant),
  );
  const [editError, setEditError] = useState('');
  const [rejectionReason, setRejectionReason] = useState(
    participant.rejectionReason ?? '',
  );
  const [rejectionError, setRejectionError] = useState('');
  const [nextCourse, setNextCourse] = useState<CourseType>(
    participant.course,
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

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

  const startEdit = () => {
    setEditForm(createEditForm(participant));
    setEditError('');
    setMode('edit');
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedName = editForm.name.trim();
    const normalizedLoginId = editForm.loginId.trim();
    const normalizedDepartment = editForm.department.trim();
    const normalizedPhone = editForm.phone.trim();
    const normalizedEmail = editForm.email.trim();
    const normalizedMemo = editForm.adminMemo.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !normalizedName ||
      !normalizedLoginId ||
      !normalizedDepartment ||
      !editForm.affiliation ||
      !normalizedPhone ||
      !normalizedEmail ||
      !editForm.course
    ) {
      setEditError('필수 정보를 모두 입력해 주세요.');
      return;
    }

    if (!emailPattern.test(normalizedEmail)) {
      setEditError('이메일을 정확히 입력해 주세요.');
      return;
    }

    onUpdate(participant.id, {
      name: normalizedName,
      loginId: normalizedLoginId,
      department: normalizedDepartment,
      affiliation: editForm.affiliation,
      grade:
        editForm.affiliation === 'undergraduate'
          ? (participant.grade ?? '1')
          : null,
      phone: normalizedPhone,
      email: normalizedEmail,
      course: editForm.course,
      adminMemo: normalizedMemo || undefined,
    });
    setEditError('');
    setMode('view');
  };

  const handleRejectSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedReason = rejectionReason.trim();

    if (!normalizedReason) {
      setRejectionError('반려 사유를 입력해 주세요.');
      return;
    }

    onReject(participant.id, normalizedReason);
    setRejectionError('');
    setMode('view');
  };

  const handleCourseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (nextCourse === participant.course) {
      return;
    }

    onUpdate(participant.id, { course: nextCourse });
    setMode('view');
  };

  const renderViewActions = () => {
    if (participant.applicationStatus === 'PENDING') {
      return (
        <>
          <button
            type="button"
            className="admin-participant-dialog__button admin-participant-dialog__button--primary"
            onClick={() => onApprove(participant.id)}
          >
            승인
          </button>
          <button
            type="button"
            className="admin-participant-dialog__button admin-participant-dialog__button--danger"
            onClick={() => {
              setRejectionReason('');
              setRejectionError('');
              setMode('reject');
            }}
          >
            반려
          </button>
          <button
            type="button"
            className="admin-participant-dialog__button"
            onClick={startEdit}
          >
            정보 수정
          </button>
          <button
            type="button"
            className="admin-participant-dialog__button"
            onClick={onClose}
          >
            닫기
          </button>
        </>
      );
    }

    if (participant.applicationStatus === 'APPROVED') {
      return (
        <>
          <button
            type="button"
            className="admin-participant-dialog__button"
            onClick={startEdit}
          >
            정보 수정
          </button>
          <button
            type="button"
            className="admin-participant-dialog__button"
            onClick={() => {
              setNextCourse(participant.course);
              setMode('course');
            }}
          >
            코스 변경
          </button>
          <button
            type="button"
            className="admin-participant-dialog__button admin-participant-dialog__button--danger"
            onClick={() => setMode('cancel')}
          >
            참가 취소
          </button>
          <button
            type="button"
            className="admin-participant-dialog__button"
            onClick={onClose}
          >
            닫기
          </button>
        </>
      );
    }

    if (participant.applicationStatus === 'REJECTED') {
      return (
        <>
          <button
            type="button"
            className="admin-participant-dialog__button"
            onClick={startEdit}
          >
            정보 수정
          </button>
          <button
            type="button"
            className="admin-participant-dialog__button"
            onClick={onClose}
          >
            닫기
          </button>
        </>
      );
    }

    return (
      <button
        type="button"
        className="admin-participant-dialog__button"
        onClick={onClose}
      >
        닫기
      </button>
    );
  };

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
      >
        <header className="admin-participant-dialog__header">
          <div>
            <p className="admin-participant-dialog__eyebrow">참가 신청 상세</p>
            <div className="admin-participant-dialog__title-row">
              <h2 id="participantDialogTitle">{participant.name}</h2>
              <ParticipantStatusBadge
                status={participant.applicationStatus}
              />
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

        {mode === 'view' && (
          <>
            <div className="admin-participant-dialog__content">
              <section className="admin-participant-dialog__section">
                <h3>기본 정보</h3>
                <dl className="admin-participant-dialog__details">
                  <div>
                    <dt>이름</dt>
                    <dd>{participant.name}</dd>
                  </div>
                  <div>
                    <dt>학번/사번</dt>
                    <dd>{participant.loginId}</dd>
                  </div>
                  <div>
                    <dt>소속</dt>
                    <dd>{participant.department}</dd>
                  </div>
                  <div>
                    <dt>신분</dt>
                    <dd>
                      {getAffiliationDisplay(
                        participant.affiliation,
                        participant.grade,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>연락처</dt>
                    <dd>{participant.phone}</dd>
                  </div>
                  <div>
                    <dt>이메일</dt>
                    <dd className="admin-participant-dialog__break-text">
                      {participant.email}
                    </dd>
                  </div>
                  <div>
                    <dt>개인정보 동의</dt>
                    <dd>{participant.privacyAgreed ? '동의' : '미동의'}</dd>
                  </div>
                  <div>
                    <dt>신청일시</dt>
                    <dd>{formatParticipantDateTime(participant.appliedAt)}</dd>
                  </div>
                </dl>
              </section>

              <section className="admin-participant-dialog__section">
                <h3>참가 정보</h3>
                <dl className="admin-participant-dialog__details">
                  <div>
                    <dt>선택 코스</dt>
                    <dd>{COURSE_LABELS[participant.course]}</dd>
                  </div>
                  <div>
                    <dt>현재 신청 상태</dt>
                    <dd>
                      <ParticipantStatusBadge
                        status={participant.applicationStatus}
                      />
                    </dd>
                  </div>
                </dl>

                {participant.rejectionReason && (
                  <div className="admin-participant-dialog__note-block">
                    <strong>반려 사유</strong>
                    <p>{participant.rejectionReason}</p>
                  </div>
                )}

                <div className="admin-participant-dialog__note-block">
                  <strong>관리자 메모</strong>
                  <p>
                    {participant.adminMemo ||
                      '작성된 관리자 메모가 없습니다.'}
                  </p>
                  <small>관리자 메모는 참가자에게 공개되지 않습니다.</small>
                </div>
              </section>
            </div>

            <footer className="admin-participant-dialog__actions">
              {renderViewActions()}
            </footer>
          </>
        )}

        {mode === 'edit' && (
          <form
            className="admin-participant-dialog__form"
            onSubmit={handleEditSubmit}
            noValidate
          >
            <div className="admin-participant-dialog__content">
              <section className="admin-participant-dialog__section">
                <h3>참가자 정보 수정</h3>
                <div className="admin-participant-dialog__form-grid">
                  <label>
                    <span>이름</span>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>학번/사번</span>
                    <input
                      type="text"
                      value={editForm.loginId}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          loginId: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>소속</span>
                    <input
                      type="text"
                      value={editForm.department}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          department: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>신분</span>
                    <select
                      value={editForm.affiliation}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          affiliation: event.target.value as AffiliationType,
                        }))
                      }
                    >
                      {AFFILIATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>연락처</span>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>이메일</span>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>선택 코스</span>
                    <select
                      value={editForm.course}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          course: event.target.value as CourseType,
                        }))
                      }
                    >
                      {COURSE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="admin-participant-dialog__memo-field">
                    <span>관리자 메모</span>
                    <textarea
                      value={editForm.adminMemo}
                      maxLength={500}
                      rows={5}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          adminMemo: event.target.value,
                        }))
                      }
                    />
                    <small>
                      참가자에게 공개되지 않습니다.{' '}
                      {editForm.adminMemo.length}/500
                    </small>
                  </label>
                </div>

                {editError && (
                  <p
                    className="admin-participant-dialog__error"
                    role="alert"
                  >
                    {editError}
                  </p>
                )}
              </section>
            </div>

            <footer className="admin-participant-dialog__actions">
              <button
                type="submit"
                className="admin-participant-dialog__button admin-participant-dialog__button--primary"
              >
                저장
              </button>
              <button
                type="button"
                className="admin-participant-dialog__button"
                onClick={() => {
                  setEditForm(createEditForm(participant));
                  setEditError('');
                  setMode('view');
                }}
              >
                취소
              </button>
            </footer>
          </form>
        )}

        {mode === 'reject' && (
          <form
            className="admin-participant-dialog__form"
            onSubmit={handleRejectSubmit}
          >
            <div className="admin-participant-dialog__content">
              <section className="admin-participant-dialog__section">
                <h3>신청 반려</h3>
                <p className="admin-participant-dialog__mode-description">
                  {participant.name}님의 신청을 반려하는 사유를 입력해
                  주세요.
                </p>
                <label className="admin-participant-dialog__textarea-field">
                  <span>반려 사유</span>
                  <textarea
                    value={rejectionReason}
                    rows={5}
                    aria-describedby={
                      rejectionError ? 'rejectionReasonError' : undefined
                    }
                    onChange={(event) =>
                      setRejectionReason(event.target.value)
                    }
                  />
                </label>
                {rejectionError && (
                  <p
                    id="rejectionReasonError"
                    className="admin-participant-dialog__error"
                    role="alert"
                  >
                    {rejectionError}
                  </p>
                )}
              </section>
            </div>

            <footer className="admin-participant-dialog__actions">
              <button
                type="submit"
                className="admin-participant-dialog__button admin-participant-dialog__button--danger"
              >
                반려 확정
              </button>
              <button
                type="button"
                className="admin-participant-dialog__button"
                onClick={() => {
                  setRejectionError('');
                  setMode('view');
                }}
              >
                취소
              </button>
            </footer>
          </form>
        )}

        {mode === 'course' && (
          <form
            className="admin-participant-dialog__form"
            onSubmit={handleCourseSubmit}
          >
            <div className="admin-participant-dialog__content">
              <section className="admin-participant-dialog__section">
                <h3>코스 변경</h3>
                <p className="admin-participant-dialog__mode-description">
                  현재 코스: <strong>{COURSE_LABELS[participant.course]}</strong>
                </p>
                <label className="admin-participant-dialog__select-field">
                  <span>새 코스</span>
                  <select
                    value={nextCourse}
                    onChange={(event) =>
                      setNextCourse(event.target.value as CourseType)
                    }
                  >
                    {COURSE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
            </div>

            <footer className="admin-participant-dialog__actions">
              <button
                type="submit"
                className="admin-participant-dialog__button admin-participant-dialog__button--primary"
                disabled={nextCourse === participant.course}
              >
                변경 저장
              </button>
              <button
                type="button"
                className="admin-participant-dialog__button"
                onClick={() => setMode('view')}
              >
                취소
              </button>
            </footer>
          </form>
        )}

        {mode === 'cancel' && (
          <>
            <div className="admin-participant-dialog__content">
              <section className="admin-participant-dialog__section">
                <h3>참가 취소 확인</h3>
                <p className="admin-participant-dialog__mode-description">
                  <strong>{participant.name}</strong>님의{' '}
                  <strong>{COURSE_LABELS[participant.course]}</strong> 참가를
                  취소하시겠습니까? 참가자 정보는 삭제되지 않고 상태만
                  변경됩니다.
                </p>
              </section>
            </div>

            <footer className="admin-participant-dialog__actions">
              <button
                type="button"
                className="admin-participant-dialog__button admin-participant-dialog__button--danger"
                onClick={() => {
                  onCancelParticipation(participant.id);
                  setMode('view');
                }}
              >
                취소 확정
              </button>
              <button
                type="button"
                className="admin-participant-dialog__button"
                onClick={() => setMode('view')}
              >
                돌아가기
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export default ParticipantDetailDialog;
