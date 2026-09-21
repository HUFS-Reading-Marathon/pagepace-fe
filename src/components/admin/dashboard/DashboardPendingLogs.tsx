import { Link } from 'react-router-dom';
import type { AdminReadingLogResponse } from '../../../types/adminReadingLogApi';
import { hasServerWarning } from '../../../utils/dashboardAnalytics';
import { formatKoDateKey } from '../../../utils/date';

type DashboardPendingLogsProps = {
  logs: AdminReadingLogResponse[];
};

function getBookSummary(log: AdminReadingLogResponse) {
  const firstBook = log.books[0];

  if (!firstBook) {
    return '등록된 책 없음';
  }

  return log.books.length > 1
    ? `${firstBook.bookTitle} 외 ${log.books.length - 1}권`
    : firstBook.bookTitle;
}

function DashboardPendingLogs({ logs }: DashboardPendingLogsProps) {
  return (
    <section className="admin-dashboard__card admin-dashboard__operations-card admin-dashboard__enter">
      <header className="admin-dashboard__card-header">
        <h2>검토 대기 독서일지</h2>
      </header>

      {logs.length === 0 ? (
        <div className="admin-dashboard__empty">검토 대기 중인 독서일지가 없습니다.</div>
      ) : (
        <div className="admin-dashboard__table-wrapper">
          <table className="admin-dashboard__table admin-dashboard__table--logs">
            <thead>
              <tr>
                <th scope="col">참가자</th>
                <th scope="col">독서 날짜</th>
                <th scope="col">도서</th>
                <th scope="col">페이지</th>
                <th scope="col">자동 검증</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const hasWarning = hasServerWarning(log);

                return (
                  <tr key={log.readingLogId}>
                    <td>{log.userName}</td>
                    <td>{formatKoDateKey(log.readingDate)}</td>
                    <td title={getBookSummary(log)}>{getBookSummary(log)}</td>
                    <td>{log.totalReadPages.toLocaleString('ko-KR')}쪽</td>
                    <td>
                      <span
                        className={`admin-dashboard__review admin-dashboard__review--${
                          hasWarning ? 'warning' : 'safe'
                        }`}
                      >
                        {hasWarning ? '확인 필요' : '이상 없음'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Link to="/admin/logs" className="admin-dashboard__card-link">
        전체 검토 목록 보기
        <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export default DashboardPendingLogs;
