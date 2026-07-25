import { Link, useParams } from 'react-router-dom';
import { readingLogs } from '../../mocks/readingLogs';
import { formatDistance } from '../../utils/reading';
import './logs.css';

function ReadingLogDetailPage() {
  const { logId } = useParams();
  const log = readingLogs.find((item) => item.id === Number(logId));

  if (!log) {
    return (
      <main className="page-container">
        <section className="page-section">
          <p className="page-label">Reading Log</p>
          <h1>독서일지를 찾을 수 없습니다.</h1>
          <p className="page-description">
            요청하신 독서일지가 존재하지 않거나 이동되었을 수 있습니다.
          </p>
          <Link to="/logs" className="btn btn-secondary">
            목록으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="reading-detail-page">
      <section className="reading-detail-card">
        <div className="reading-detail-head">
          <div>
            <p className="page-label">Reading Log Detail</p>
            <h1>{log.title}</h1>
            <p>
              {log.author} · {log.publisher}
            </p>
          </div>

          <span className={`log-status-badge status-${log.status}`}>
            {log.status}
          </span>
        </div>

        <dl className="reading-detail-list">
          <div>
            <dt>독서 날짜</dt>
            <dd>{log.date}</dd>
          </div>
          <div>
            <dt>장르</dt>
            <dd>{log.genre}</dd>
          </div>
          <div>
            <dt>읽은 페이지</dt>
            <dd>{log.pages.toLocaleString()}쪽</dd>
          </div>
          <div>
            <dt>환산 거리</dt>
            <dd>{formatDistance(log.pages * 5)}</dd>
          </div>
        </dl>

        <div className="reading-detail-memo">
          <h2>메모</h2>
          <p>{log.memo}</p>
        </div>

        <div className="reading-detail-actions">
          <Link to="/logs" className="btn btn-secondary">
            목록으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}

export default ReadingLogDetailPage;