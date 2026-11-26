import ContentSkeleton from '../../components/layout/ContentSkeleton';
import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/apiClient';
import { getBookRequests, REQUEST_REASON_LABELS, type BookRequest } from '../../api/bookRequestApi';
import { getCurrentParticipation } from '../../api/participationApi';
import { formatKoDateKey } from '../../utils/date';
import {
  BOOK_INQUIRY_TONE,
  bookInquiryResult,
  bookInquiryStatusLabel,
  pageBookInquiries,
} from './bookInquiryState';

type Loaded = { eventTitle: string; rows: BookRequest[] };

function Chevron() {
  return (
    <svg className="inquiry-board__chevron" viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

function BookInquiryItem({ item }: { item: BookRequest }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const tone = BOOK_INQUIRY_TONE[item.status];
  return (
    <li className="inquiry-board__item">
      <h3 className="inquiry-board__item-heading">
        <button
          type="button"
          className="inquiry-board__toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="inquiry-board__summary">
            <span className="inquiry-board__title">{item.title}</span>
            <span className="inquiry-board__meta">
              <span>
                독서일 <time dateTime={item.readingDate}>{formatKoDateKey(item.readingDate)}</time>
              </span>
              <span>{item.readPages.toLocaleString('ko-KR')}쪽</span>
            </span>
          </span>
          <span className={`inquiry-board__state is-${tone}`}>
            {bookInquiryStatusLabel(item.status)}
          </span>
          <Chevron />
        </button>
      </h3>
      <div
        id={panelId}
        className="inquiry-board__panel"
        data-open={open || undefined}
        inert={!open}
      >
        <div className="inquiry-board__panel-inner">
          <section className="inquiry-board__question" aria-label="문의 내용">
            <h4>문의 내용</h4>
            <dl className="book-inquiry__facts">
              <div>
                <dt>확인이 필요한 이유</dt>
                <dd>{REQUEST_REASON_LABELS[item.reason]}</dd>
              </div>
              <div>
                <dt>접수일</dt>
                <dd>
                  <time dateTime={item.createdAt}>
                    {formatKoDateKey(item.createdAt.slice(0, 10))}
                  </time>
                </dd>
              </div>
              {item.isbn && (
                <div>
                  <dt>ISBN</dt>
                  <dd>{item.isbn}</dd>
                </div>
              )}
            </dl>
            {item.note && <p>{item.note}</p>}
          </section>
          <section
            className={`inquiry-board__answer book-inquiry__result is-${tone}`}
            aria-label="처리 결과"
          >
            <h4>
              {item.status === 'REJECTED' ? '반려 사유' : '처리 결과'}
              {item.reviewedAt && (
                <time dateTime={item.reviewedAt}>
                  {formatKoDateKey(item.reviewedAt.slice(0, 10))}
                </time>
              )}
            </h4>
            <p>{bookInquiryResult(item)}</p>
            {item.status === 'LINKED' && item.readingLogId && (
              <Link className="book-inquiry__log-link" to={`/logs/${item.readingLogId}`}>
                만들어진 독서일지 보기
              </Link>
            )}
          </section>
        </div>
      </div>
    </li>
  );
}

/**
 * 문의 게시판의 도서 문의 탭: 선택한 참가 회차에서 본인이 접수한 도서 확인 요청과 처리 결과입니다.
 * 기존 도서 확인 요청 API(GET /api/me/book-requests)를 그대로 써서 이전 요청도 함께 보입니다.
 */
export default function UserBookInquiryList({
  query,
  page,
  onPage,
}: {
  query: string;
  page: number;
  onPage: (page: number) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; data?: Loaded; error?: string }>();
  useEffect(() => {
    let active = true;
    getCurrentParticipation()
      .then(async (participation) => {
        const rows = await getBookRequests(participation.eventId);
        if (active) setResult({ attempt, data: { eventTitle: participation.eventTitle, rows } });
      })
      .catch((error) => {
        if (active)
          setResult({
            attempt,
            error: getApiErrorMessage(error, '도서 문의 내역을 불러오지 못했습니다.'),
          });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const current = result?.attempt === attempt ? result : undefined;
  const listing = current?.data ? pageBookInquiries(current.data.rows, query, page) : null;
  // 주소의 쪽 번호가 범위를 벗어나면 마지막 쪽을 보여 줍니다(pageBookInquiries가 범위를 맞춤).

  return (
    <div aria-live="polite" aria-busy={!current}>
      {current?.error ? (
        <p className="inquiry-board__message" role="alert">
          {current.error}{' '}
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            다시 불러오기
          </button>
        </p>
      ) : !listing || !current?.data ? (
        <ContentSkeleton variant="list" label="도서 문의 내역을 불러오는 중입니다." />
      ) : (
        <>
          <p className="book-inquiry__event">{current.data.eventTitle}</p>
          {listing.items.length === 0 ? (
            <p className="inquiry-board__message">
              {query
                ? `“${query}”에 해당하는 도서 문의가 없습니다.`
                : '접수한 도서 문의가 없습니다. 검색되지 않거나 쪽수가 없는 책은 도서 문의로 남겨 주세요.'}
            </p>
          ) : (
            <>
              <div className="inquiry-board__columns" aria-hidden="true">
                <span>도서명</span>
                <span>처리 상태</span>
              </div>
              <ul className="inquiry-board__list" aria-label="도서 문의">
                {listing.items.map((item) => (
                  <BookInquiryItem key={item.id} item={item} />
                ))}
              </ul>
              {listing.pages > 1 && (
                <nav className="inquiry-board__pages" aria-label="도서 문의 페이지">
                  <button
                    type="button"
                    disabled={listing.page === 0}
                    onClick={() => onPage(listing.page - 1)}
                  >
                    이전
                  </button>
                  {Array.from({ length: listing.pages }, (_, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-current={index === listing.page ? 'page' : undefined}
                      onClick={() => onPage(index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={listing.page >= listing.pages - 1}
                    onClick={() => onPage(listing.page + 1)}
                  >
                    다음
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
