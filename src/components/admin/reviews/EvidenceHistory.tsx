import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../api/apiClient';
import {
  getReviewEvidence,
  revokeReviewEvidence,
  type ReviewEvidence,
} from '../../../api/adminReadingLogApi';
import { formatKoDateTime24 } from '../../../utils/date';

type EvidenceHistoryProps = {
  bookId: number;
  onChanged: () => Promise<void>;
  onReplace: (id: number, content: string, time: string) => void;
  locked: boolean;
};

/** 참가 도서의 서평 인정 이력을 보여 주고, 최근 인정 건 취소와 취소된 원문 재인정을 처리합니다. */
function EvidenceHistory({ bookId, onChanged, onReplace, locked }: EvidenceHistoryProps) {
  const [rows, setRows] = useState<ReviewEvidence[]>([]);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;

    getReviewEvidence(bookId)
      .then((result) => {
        if (active) {
          setRows(result);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(getApiErrorMessage(requestError, '인정 이력을 불러오지 못했습니다.'));
      });

    return () => {
      active = false;
    };
  }, [bookId, revision]);

  const latest = rows.find((row) => !row.revokedAt);

  const revoke = async (id: number) => {
    if (
      busy ||
      !reason.trim() ||
      !window.confirm(
        '이 서평 확인을 취소할까요? 유효한 서평이 모두 취소되면 이후 자동 반영분을 포함한 이 책의 인정 거리가 회수됩니다.',
      )
    )
      return;

    setBusy(true);
    setError('');

    try {
      await revokeReviewEvidence(bookId, id, reason.trim());
      setReason('');
      setRevision((current) => current + 1);
      await onChanged();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '취소 결과를 확인해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  if (rows.length === 0 && !error) {
    return null;
  }

  return (
    <section className="admin-reviews__history" aria-labelledby={`reviewHistory-${bookId}`}>
      <h3 id={`reviewHistory-${bookId}`}>서평 인정 이력</h3>
      {error && (
        <p className="admin-reviews__history-error" role="alert">
          {error}{' '}
          <button type="button" onClick={() => setRevision((current) => current + 1)}>
            다시 조회
          </button>
        </p>
      )}
      <ul className="admin-reviews__history-list">
        {rows.map((row) => (
          <li key={row.id}>
            <details>
              <summary>
                <span
                  className={`admin-reviews__history-state${row.revokedAt ? ' is-revoked' : ''}`}
                >
                  {row.revokedAt ? '취소' : '인정'}
                </span>
                <span>
                  #{row.id} · {row.sourceType === 'SOLAS' ? '솔라스 대조' : '수동 확인'} · 확인 당시{' '}
                  {row.creditedPages.toLocaleString('ko-KR')}쪽
                </span>
              </summary>
              <dl>
                <div>
                  <dt>원문 시각</dt>
                  <dd>
                    {row.sourceUpdatedAt
                      ? formatKoDateTime24(row.sourceUpdatedAt)
                      : '이전 이력 시각 없음'}
                  </dd>
                </div>
                <div>
                  <dt>처리</dt>
                  <dd>
                    {row.verifiedBy} · {formatKoDateTime24(row.verifiedAt)}
                  </dd>
                </div>
                {row.note && (
                  <div>
                    <dt>메모</dt>
                    <dd>{row.note}</dd>
                  </div>
                )}
                {row.revokedAt && (
                  <div>
                    <dt>취소</dt>
                    <dd>
                      {row.revokedBy} · {formatKoDateTime24(row.revokedAt)} · {row.revokeReason}
                    </dd>
                  </div>
                )}
              </dl>
              {row.sourceContent && <blockquote>{row.sourceContent}</blockquote>}
              {!locked && !latest && row.revokedAt && row.sourceContent && row.sourceUpdatedAt && (
                <button
                  type="button"
                  className="admin-button"
                  onClick={() => onReplace(row.id, row.sourceContent!, row.sourceUpdatedAt!)}
                >
                  이 원문 재인정 검토
                </button>
              )}
            </details>
          </li>
        ))}
      </ul>
      {latest && !locked && (
        <div className="admin-reviews__revoke">
          <label>
            <span>최근 인정 건 #{latest.id} 취소 사유</span>
            <input
              maxLength={1000}
              value={reason}
              placeholder="예: 다른 책의 서평으로 확인됨"
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="admin-button admin-button--danger"
            disabled={busy || !reason.trim()}
            onClick={() => void revoke(latest.id)}
          >
            인정 취소
          </button>
        </div>
      )}
    </section>
  );
}

export default EvidenceHistory;
