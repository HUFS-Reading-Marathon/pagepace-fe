import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../../api/apiClient';
import { getApprovedBookLogs, type ApprovedBookLog } from '../../../api/adminReadingLogApi';
import { formatKoDateKey } from '../../../utils/date';

type ApprovedBookLogsProps = {
  bookId: number;
};

/** 참가 도서에 묶인 승인 독서일지를 펼쳐 보고, 독서일지 검토 화면으로 이동할 수 있게 합니다. */
function ApprovedBookLogs({ bookId }: ApprovedBookLogsProps) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ApprovedBookLog[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;

    getApprovedBookLogs(bookId)
      .then((rows) => {
        if (active) {
          setLogs(rows);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            getApiErrorMessage(requestError, '승인 일지를 불러오지 못했습니다. 다시 열어 주세요.'),
          );
        }
      });

    return () => {
      active = false;
    };
  }, [open, bookId]);

  const totalPages = logs?.reduce((sum, log) => sum + log.pages, 0) ?? 0;

  return (
    <details
      className="admin-reviews__logs"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>이 책의 승인 독서일지</summary>
      {open &&
        (error ? (
          <p className="admin-reviews__logs-message" role="alert">
            {error}
          </p>
        ) : logs === null ? (
          <p className="admin-reviews__logs-message" role="status">
            조회 중입니다.
          </p>
        ) : logs.length === 0 ? (
          <p className="admin-reviews__logs-message">승인된 일지가 없습니다.</p>
        ) : (
          <>
            <ul className="admin-reviews__logs-list">
              {logs.map((log) => (
                <li key={log.readingLogId}>
                  <Link to={`/admin/logs?eventId=${log.eventId}&logId=${log.readingLogId}`}>
                    <span>{formatKoDateKey(log.readingDate)}</span>
                    <strong>{log.pages.toLocaleString('ko-KR')}쪽</strong>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="admin-reviews__logs-total">
              {logs.length}건 · 합계 {totalPages.toLocaleString('ko-KR')}쪽
            </p>
          </>
        ))}
    </details>
  );
}

export default ApprovedBookLogs;
