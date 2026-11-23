import { useEffect, useRef, useState } from 'react';
import { ROSTER_STATUSES, rosterStatus, type RosterRow } from '../../../api/adminRosterApi';
import { ADMIN_APPLICATION_AFFILIATION_LABELS } from '../../../types/adminApplication';
import { getApiErrorMessage } from '../../../api/apiClient';
import { formatKoDateTime } from '../../../utils/date';
import { approveAdminApplication, rejectAdminApplication } from '../../../api/adminApplicationApi';

type Props = {
  row: RosterRow;
  number?: number;
  eventTitle: string;
  editable: boolean;
  onClose: () => void;
  onEdit: () => void;
  previous?: () => void;
  next?: () => void;
  onSaved: (message: string) => void;
};

export default function ParticipantDetailDialog({
  row,
  number,
  eventTitle,
  editable,
  onClose,
  onEdit,
  previous,
  next,
  onSaved,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [rejecting, setRejecting] = useState(false),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  const status = rosterStatus(row);
  const fields = [
    ...(number === undefined ? [] : [['순번', String(number)]]),
    ['상태', status && ROSTER_STATUSES[status]],
    ['학번/사번', row.studentNo],
    ['이메일', row.email],
    ['연락처', row.phone],
    ['신분', ADMIN_APPLICATION_AFFILIATION_LABELS[row.affiliationType]],
    ['대학', row.college],
    ['학과/부서', row.department],
    ['학년', row.grade],
    ['성별', row.gender],
    ['행사', eventTitle],
    ['코스', row.courseName],
    ['등록일', formatKoDateTime(row.registeredAt)],
    ...(row.rejectReason ? [['반려 사유', row.rejectReason]] : []),
  ];
  async function review(approve: boolean) {
    if (busy || !row.applicationId || (!approve && !reason.trim())) return;
    setBusy(true);
    setError('');
    try {
      if (approve) await approveAdminApplication(row.applicationId);
      else await rejectAdminApplication(row.applicationId, reason.trim());
      onSaved(row.name + ' 님의 신청을 ' + (approve ? '승인' : '반려') + '했습니다.');
    } catch (err) {
      setBusy(false);
      setError(getApiErrorMessage(err, '처리하지 못했습니다.'));
    }
  }
  return (
    <dialog
      ref={dialog}
      className="roster-detail"
      aria-labelledby="roster-detail-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id="roster-detail-title">{row.name}</h2>
        <div className="roster-actions">
          <button
            className="roster-link"
            type="button"
            disabled={busy || !previous}
            onClick={previous}
            aria-label="이전 신청서"
          >
            이전
          </button>
          <button
            className="roster-link"
            type="button"
            disabled={busy || !next}
            onClick={next}
            aria-label="다음 신청서"
          >
            다음
          </button>
          <button type="button" className="roster-btn" onClick={onClose} disabled={busy}>
            닫기
          </button>
        </div>
      </header>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      {error && (
        <p className="roster-error" role="alert">
          {error}
        </p>
      )}
      {rejecting ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void review(false);
          }}
        >
          <label>
            반려 사유
            <textarea
              required
              value={reason}
              maxLength={500}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <footer>
            <button
              className="roster-btn"
              type="button"
              disabled={busy}
              onClick={() => setRejecting(false)}
            >
              취소
            </button>
            <button className="roster-btn" type="submit" disabled={busy || !reason.trim()}>
              반려 확정
            </button>
          </footer>
        </form>
      ) : (
        editable && (
          <footer>
            <button className="roster-btn" type="button" onClick={onEdit} disabled={busy}>
              정보 수정
            </button>
            {status === 'APPLIED' && (
              <>
                <button className="roster-btn" disabled={busy} onClick={() => setRejecting(true)}>
                  반려
                </button>
                <button
                  className="roster-btn roster-primary"
                  disabled={busy}
                  onClick={() => void review(true)}
                >
                  참가 승인
                </button>
              </>
            )}
          </footer>
        )
      )}
    </dialog>
  );
}
