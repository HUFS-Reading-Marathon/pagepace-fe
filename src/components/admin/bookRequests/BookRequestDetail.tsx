import ContentSkeleton from '../../layout/ContentSkeleton';
import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { REQUEST_REASON_LABELS, type BookRequest } from '../../../api/bookRequestApi';
import { formatKoDateTime24 } from '../../../utils/date';
import DetailNavBar from '../table/DetailNavBar';
import { BOOK_REQUEST_FILTER_LABELS } from './bookRequestList';
import '../readingLogs/reading-log-detail.css';
import './book-request-admin.css';

type Props = {
  request: BookRequest | null;
  /** 현재 목록 조건에서의 위치 (목록에 없으면 null) */
  position: { index: number; total: number } | null;
  loading?: boolean;
  /** 요청을 불러오지 못했거나 찾지 못했을 때의 안내 */
  error?: string;
  busy?: boolean;
  feedback?: ReactNode;
  onList: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  /** 처리 후 다음 대기 요청으로 이동 옵션. 확인 대기 목록에서 대기 요청을 볼 때만 줍니다. */
  autoNext?: { checked: boolean; onChange: (checked: boolean) => void };
  /** 소장 서지 확인·반려 영역 (BookRequestProcessPanel) */
  children?: ReactNode;
};

const Field = ({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) => (
  <div data-wide={wide || undefined}>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

/** 도서 확인 요청 한 건의 독립 상세 화면: 목록·이전·다음 이동, 요청 정보, 처리 영역 */
export default function BookRequestDetail({
  request,
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
  const requestId = request?.id;
  // 다른 요청으로 바뀌면 제목으로 초점을 옮겨, 화면 낭독기와 키보드 사용자가 새 요청에서 시작하게 합니다.
  useEffect(() => {
    if (requestId != null) heading.current?.focus({ preventScroll: false });
  }, [requestId]);

  return (
    <article className="log-detail book-request-detail" aria-busy={loading}>
      <DetailNavBar
        noun="요청"
        position={position}
        busy={busy}
        onBack={onList}
        onPrevious={onPrevious}
        onNext={onNext}
      />

      {feedback}

      {error ? (
        <p className="log-detail__message" role="alert">
          {error}
        </p>
      ) : !request && loading ? (
        <ContentSkeleton variant="detail" label="요청을 불러오는 중입니다." />
      ) : !request ? (
        <p className="log-detail__message" role="status">
          요청을 찾을 수 없습니다.
        </p>
      ) : (
        <>
          <header className="log-detail__head">
            <h2 ref={heading} tabIndex={-1}>
              {request.participantName}
              <small>{request.studentNo}</small>
            </h2>
            <span className="log-detail__status" data-status={request.status}>
              {BOOK_REQUEST_FILTER_LABELS[request.status]}
            </span>
          </header>
          {!position && (
            <p className="log-detail__note">
              현재 목록 조건에 포함되지 않은 요청입니다. 이전·다음 이동은 목록 조건 안에서만
              가능합니다.
            </p>
          )}

          <section className="book-request-detail__section" aria-labelledby="book-request-info">
            <h3 id="book-request-info">요청 정보</h3>
            <dl className="log-detail__info">
              <Field label="요청 사유">{REQUEST_REASON_LABELS[request.reason]}</Field>
              <Field label="독서일">{request.readingDate}</Field>
              <Field label="요청 독서량">{request.readPages.toLocaleString('ko-KR')}쪽</Field>
              <Field label="요청일">
                <time dateTime={request.createdAt}>{formatKoDateTime24(request.createdAt)}</time>
              </Field>
              {request.reviewedAt && (
                <Field label="처리 일시">
                  <time dateTime={request.reviewedAt}>
                    {formatKoDateTime24(request.reviewedAt)}
                  </time>
                </Field>
              )}
            </dl>
          </section>

          <section className="book-request-detail__section" aria-labelledby="book-request-book">
            <h3 id="book-request-book">요청 도서</h3>
            <dl className="log-detail__info">
              <Field label="도서명" wide>
                {request.title}
              </Field>
              <Field label="저자">{request.author || '—'}</Field>
              <Field label="출판사">{request.publisher || '—'}</Field>
              <Field label="ISBN">{request.isbn || '—'}</Field>
            </dl>
          </section>

          {request.note && (
            <section className="book-request-detail__section" aria-labelledby="book-request-note">
              <h3 id="book-request-note">참가자 요청 내용</h3>
              <p className="book-request-detail__text">{request.note}</p>
            </section>
          )}

          {request.rejectReason && (
            <section className="book-request-detail__section" aria-labelledby="book-request-reject">
              <h3 id="book-request-reject">반려 사유</h3>
              <p className="book-request-detail__text">{request.rejectReason}</p>
            </section>
          )}

          {request.readingLogId && (
            <p className="book-request-detail__link">
              <Link to={`/admin/logs?eventId=${request.eventId}&logId=${request.readingLogId}`}>
                이관된 일지 검토 <span aria-hidden="true">→</span>
              </Link>
            </p>
          )}

          {children}
          {autoNext && (
            <label className="log-detail__auto">
              <input
                type="checkbox"
                checked={autoNext.checked}
                disabled={busy}
                onChange={(e) => autoNext.onChange(e.target.checked)}
              />
              처리 후 다음 대기 요청으로 이동
            </label>
          )}
        </>
      )}
    </article>
  );
}
