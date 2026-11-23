import { useEffect, useState } from 'react';
import { apiRequest, getApiErrorMessage } from '../../../api/apiClient';
import { formatKoDateTime24 } from '../../../utils/date';

type Evidence = {
  id: number;
  sourceUpdatedAt: string | null;
  creditedPages: number;
  sourceType: string;
  verifiedBy: string;
  verifiedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
  sourceContent: string | null;
  note: string | null;
  revokedBy: string | null;
};

export default function EvidenceHistory({
  bookId,
  onChanged,
  onReplace,
  locked,
}: {
  bookId: number;
  onChanged: () => Promise<void>;
  onReplace: (id: number, content: string, time: string) => void;
  locked: boolean;
}) {
  const [rows, setRows] = useState<Evidence[]>([]);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const path = '/api/admin/reading-logs/review-targets/' + bookId + '/evidence';
  useEffect(() => {
    let active = true;
    apiRequest<Evidence[]>(path)
      .then((result) => {
        if (active) {
          setRows(result ?? []);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(getApiErrorMessage(e, '인정 이력을 불러오지 못했습니다.'));
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  const latest = rows.find((r) => !r.revokedAt);
  async function revoke(id: number) {
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
      await apiRequest(path + '/' + id + '/revoke', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      setReason('');
      setRevision((n) => n + 1);
      await onChanged();
    } catch (e) {
      setError(getApiErrorMessage(e, '취소 결과를 확인해 주세요.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="인정 이력">
      <h3>서평 확인 이력</h3>
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={() => setRevision((n) => n + 1)}>
            다시 조회
          </button>
        </p>
      )}
      <ul>
        {rows.map((r) => (
          <li key={r.id}>
            <details>
              <summary>
                #{r.id} · {r.sourceType === 'SOLAS' ? '솔라스' : '수동'} · 확인 당시{' '}
                {r.creditedPages}쪽 · {r.revokedAt ? '취소' : '인정'}
              </summary>
              <p>
                원문{' '}
                {r.sourceUpdatedAt ? formatKoDateTime24(r.sourceUpdatedAt) : '이전 이력 시각 없음'}{' '}
                · 처리 {r.verifiedBy} {formatKoDateTime24(r.verifiedAt)}
              </p>
              {r.sourceContent && <blockquote>{r.sourceContent}</blockquote>}
              {r.note && <p>{r.note}</p>}
              {r.revokedAt && (
                <p>
                  {r.revokedBy} · {formatKoDateTime24(r.revokedAt)} · {r.revokeReason}
                </p>
              )}
              {!locked && !latest && r.revokedAt && r.sourceContent && r.sourceUpdatedAt && (
                <button
                  type="button"
                  onClick={() => onReplace(r.id, r.sourceContent!, r.sourceUpdatedAt!)}
                >
                  이 원문 재인정 검토
                </button>
              )}
            </details>
          </li>
        ))}
      </ul>
      {latest && !locked && (
        <div>
          <label>
            최근 인정 건 #{latest.id} 취소 사유
            <input maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button type="button" disabled={busy || !reason.trim()} onClick={() => revoke(latest.id)}>
            인정 취소
          </button>
        </div>
      )}
    </section>
  );
}
