import { useEffect, useRef, type ReactNode } from 'react';
import type { AdminReadingLogResponse } from '../../../types/adminReadingLogApi';
import { READING_LOG_STATUS_LABELS } from '../../../types/readingLog';
import { formatKoDateTime24 } from '../../../utils/date';
import './reading-log-detail.css';

type Props = {
  log: AdminReadingLogResponse | null;
  /** 현재 목록 조건에서의 위치 (목록에 없으면 null) */
  position: { index: number; total: number } | null;
  loading?: boolean;
  /** 일지를 불러오지 못했을 때의 안내 */
  error?: string;
  busy?: boolean;
  feedback?: ReactNode;
  onList: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  /** 처리 후 다음 대기 일지로 이동 옵션. 검토 대기 목록에서 대기 일지를 볼 때만 줍니다. */
  autoNext?: { checked: boolean; onChange: (checked: boolean) => void };
  /** 승인·반려 영역 (ReadingLogReviewPanel) */
  children?: ReactNode;
};

/** 독서일지 한 건의 독립 검토 화면: 목록·이전·다음 이동, 기본 정보, 도서별 검토와 처리 버튼 */
export default function ReadingLogDetailView({
  log,
  position,
  loading = false,
  error = '',
  busy = false,
  feedback,
  onList,
  onPrevious,
  onNext,
  autoNext,
  children,
}: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const logId = log?.readingLogId;
  // 다른 일지로 바뀌면 제목으로 초점을 옮겨, 화면 낭독기와 키보드 사용자가 새 일지에서 시작하게 합니다.
  useEffect(() => {
    if (logId != null) heading.current?.focus({ preventScroll: false });
  }, [logId]);

  return (
    <article className="log-detail" aria-busy={loading}>
      <nav className="log-detail__bar" aria-label="일지 이동">
        <button type="button" className="admin-button" disabled={busy} onClick={onList}>
          <span aria-hidden="true">←</span> 목록으로
        </button>
        <div className="log-detail__step">
          {position && (
            <span className="log-detail__position">
              {(position.index + 1).toLocaleString()} / {position.total.toLocaleString()}
            </span>
          )}
          <button
            type="button"
            className="admin-button"
            disabled={busy || !onPrevious}
            onClick={onPrevious}
          >
            이전 일지
          </button>
          <button
            type="button"
            className="admin-button"
            disabled={busy || !onNext}
            onClick={onNext}
          >
            다음 일지
          </button>
        </div>
      </nav>

      {feedback}

      {error ? (
        <p className="log-detail__message" role="alert">
          {error}
        </p>
      ) : !log ? (
        <p className="log-detail__message" role="status">
          {loading ? '일지를 불러오는 중입니다.' : '일지를 찾을 수 없습니다.'}
        </p>
      ) : (
        <>
          <header className="log-detail__head">
            <h2 ref={heading} tabIndex={-1}>
              {log.userName}
              <small>{log.studentNo}</small>
            </h2>
            <span className="log-detail__status" data-status={log.status}>
              {READING_LOG_STATUS_LABELS[log.status]}
            </span>
          </header>
          {!position && (
            <p className="log-detail__note">
              현재 목록 조건에 포함되지 않은 일지입니다. 이전·다음 이동은 목록 조건 안에서만
              가능합니다.
            </p>
          )}
          <dl className="log-detail__info">
            <div>
              <dt>코스</dt>
              <dd>{log.courseName || '—'}</dd>
            </div>
            <div>
              <dt>독서일</dt>
              <dd>{log.readingDate}</dd>
            </div>
            <div>
              <dt>제출일</dt>
              <dd>
                <time dateTime={log.createdAt}>{formatKoDateTime24(log.createdAt)}</time>
              </dd>
            </div>
            <div>
              <dt>제출 독서량</dt>
              <dd>
                {log.totalReadPages.toLocaleString('ko-KR')}쪽
                {log.books.length > 1 && ` · ${log.books.length}권`}
              </dd>
            </div>
            <div>
              <dt>제출 기준 환산 거리</dt>
              <dd>
                {log.convertedDistanceMeter.toLocaleString('ko-KR')}m
                <small> 서평 확인 후 인정</small>
              </dd>
            </div>
            {log.reviewedAt && (
              <div>
                <dt>처리 일시</dt>
                <dd>
                  <time dateTime={log.reviewedAt}>{formatKoDateTime24(log.reviewedAt)}</time>
                </dd>
              </div>
            )}
          </dl>
          {children}
          {autoNext && (
            <label className="log-detail__auto">
              <input
                type="checkbox"
                checked={autoNext.checked}
                disabled={busy}
                onChange={(e) => autoNext.onChange(e.target.checked)}
              />
              처리 후 다음 대기 일지로 이동
            </label>
          )}
        </>
      )}
    </article>
  );
}
