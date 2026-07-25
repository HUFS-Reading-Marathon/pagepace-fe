import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { readingLogs, type ReadingLog } from '../../mocks/readingLogs';
import { formatDistance } from '../../utils/reading';
import './logs.css';

function getBookStyle(log: ReadingLog): CSSProperties {
  const titleLength = log.title.replace(/\s/g, '').length;
  const authorLength = log.author.replace(/\s/g, '').length;

  let width = 48;
  let height = 198;

  if (titleLength >= 8) width = 58;
  else if (titleLength >= 6) width = 54;
  else if (titleLength >= 4) width = 50;

  if (titleLength >= 8) height += 14;
  else if (titleLength >= 6) height += 8;

  if (authorLength >= 6) height += 4;
  if (log.pages >= 150) height += 10;
  else if (log.pages >= 110) height += 6;

  if (height > 226) height = 226;

  return {
    ['--book-width' as string]: `${width}px`,
    ['--book-height' as string]: `${height}px`,
  };
}

function MyReadingLogsPage() {
  const [selectedLog, setSelectedLog] = useState<ReadingLog>(readingLogs[0]);

  return (
    <main className="log-page">
      <section className="log-hero">
        <p className="log-label">My Reading Logs</p>
        <h1>나의 독서기록</h1>
        <p>
          제출한 독서일지를 서가 형태로 확인하고, 각 기록의 인정/검토/반려 상태와
          상세 내용을 확인할 수 있습니다.
        </p>
      </section>

      <section className="log-library-layout">
        <div className="log-library">
          <div className="log-section-row">
            <div>
              <p className="log-section-kicker">Bookshelf</p>
              <h2>제출한 독서일지</h2>
            </div>

            <Link to="/logs/new" className="log-primary-link">
              독서일지 작성
            </Link>
          </div>

          <div className="book-shelf" aria-label="독서일지 서가">
            <div className="book-shelf-row">
              {readingLogs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  className={`book-spine genre-${log.genreKey} status-${log.status} ${
                    selectedLog.id === log.id ? 'is-selected' : ''
                  }`}
                  onClick={() => setSelectedLog(log)}
                  style={getBookStyle(log)}
                  aria-label={`${log.title} 독서기록 보기`}
                >
                  <span className="book-status-dot" aria-hidden="true" />
                  <span className="book-spine-date">
                    {log.date.slice(5).replace('-', '.')}
                  </span>

                  <strong>{log.title}</strong>

                  <span className="book-spine-sub">
                    <small>{log.author}</small>
                    <em>{log.pages}</em>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="log-legend">
            <span>
              <i className="legend-dot approved" />
              인정
            </span>
            <span>
              <i className="legend-dot pending" />
              검토중
            </span>
            <span>
              <i className="legend-dot rejected" />
              반려
            </span>
          </div>
        </div>

        <aside className="log-detail-panel" aria-label="선택한 독서일지 상세">
          <div className="log-detail-head">
            <span className={`log-status-badge status-${selectedLog.status}`}>
              {selectedLog.status}
            </span>
            <span className="log-detail-date">{selectedLog.date}</span>
          </div>

          <h3>{selectedLog.title}</h3>
          <p className="log-detail-meta">
            {selectedLog.author} · {selectedLog.publisher}
          </p>

          <dl className="log-detail-list">
            <div>
              <dt>장르</dt>
              <dd>{selectedLog.genre}</dd>
            </div>
            <div>
              <dt>읽은 페이지</dt>
              <dd>{selectedLog.pages.toLocaleString()}쪽</dd>
            </div>
            <div>
              <dt>환산 거리</dt>
              <dd>{formatDistance(selectedLog.pages * 5)}</dd>
            </div>
          </dl>

          <div className="log-detail-memo">
            <span>메모</span>
            <p>{selectedLog.memo}</p>
          </div>

          <div className="log-detail-actions">
            <Link to={`/logs/${selectedLog.id}`} className="log-detail-link">
              독서일지 보러가기
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default MyReadingLogsPage;