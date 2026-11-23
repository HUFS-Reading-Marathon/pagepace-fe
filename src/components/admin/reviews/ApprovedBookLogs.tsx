import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, getApiErrorMessage } from '../../../api/apiClient';

type ApprovedLog = { readingLogId: number; eventId: number; readingDate: string; pages: number };

export default function ApprovedBookLogs({ bookId }: { bookId: number }) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ApprovedLog[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    apiRequest<ApprovedLog[]>(`/api/admin/reading-logs/review-targets/${bookId}/approved-logs`)
      .then((rows) => {
        if (active) {
          setLogs(rows ?? []);
          setError('');
        }
      })
      .catch((e) => {
        if (active)
          setError(getApiErrorMessage(e, '승인 일지를 불러오지 못했습니다. 다시 열어 주세요.'));
      });
    return () => {
      active = false;
    };
  }, [open, bookId]);

  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>이 책의 승인 독서일지 보기</summary>
      {open &&
        (error ? (
          <p role="alert">{error}</p>
        ) : logs === null ? (
          <p>조회 중…</p>
        ) : logs.length === 0 ? (
          <p>승인된 일지가 없습니다.</p>
        ) : (
          <ul>
            {logs.map((log) => (
              <li key={log.readingLogId}>
                <Link to={`/admin/logs?eventId=${log.eventId}&logId=${log.readingLogId}`}>
                  {log.readingDate} · {log.pages.toLocaleString()}쪽
                </Link>
              </li>
            ))}
          </ul>
        ))}
    </details>
  );
}
