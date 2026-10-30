import { preferredAdminEvent } from '../../utils/eventSelection';
import { useAdminEventState } from '../../hooks/useAdminEventState';
import { useEffect, useRef, useState } from 'react';
import ReviewExcelImport from '../../components/admin/reviews/ReviewExcelImport';
import { getApiErrorMessage } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import {
  getAdminReviewTargets,
  verifyAdminReview,
  type AdminReviewTarget,
} from '../../api/adminReadingLogApi';
import type { AdminEvent } from '../../types/adminEvent';
import '../../styles/admin-reviews.css';

function formatCreditDistance(meters: number) {
  return `${(meters / 1000).toFixed(2)}km`;
}

function AdminReviewsPage() {
  const [importBusy, setImportBusy] = useState(false);
  const manualBusy = useRef(false);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useAdminEventState();
  const [targets, setTargets] = useState<AdminReviewTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminEvents()
      .then((next) => {
        setEvents(next);
        setEventId(preferredAdminEvent(next)?.eventId ?? null);
        if (!next.length) setIsLoading(false);
      })
      .catch((requestError: unknown) => {
        setError(getApiErrorMessage(requestError, '행사를 불러오지 못했습니다.'));
        setIsLoading(false);
      });
  }, [setEventId]);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    let active = true;

    getAdminReviewTargets(eventId)
      .then((next) => {
        if (active) {
          setTargets(next);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(getApiErrorMessage(requestError, '서평 확인 대상을 불러오지 못했습니다.'));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  const verify = async (target: AdminReviewTarget) => {
    if (manualBusy.current || importBusy) return;
    if (
      !window.confirm(
        `${target.userName} 학생의 “${target.bookTitle}” 서평을 확인하고 ${formatCreditDistance(
          target.distanceToCreditMeter,
        )}를 반영할까요?`,
      )
    ) {
      return;
    }
    manualBusy.current = true;

    setVerifyingId(target.participantBookId);

    try {
      await verifyAdminReview(target.participantBookId);
      setTargets((current) =>
        current.filter((item) => item.participantBookId !== target.participantBookId),
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '서평 확인에 실패했습니다.'));
    } finally {
      manualBusy.current = false;
      setVerifyingId(null);
    }
  };

  return (
    <section className="admin-page admin-reviews">
      <header className="admin-page__header admin-reviews__header">
        <div>
          <h1>서평 확인</h1>
          <p>참여자 알림 또는 솔라스 자료로 서평을 확인한 뒤 독서 거리를 반영합니다.</p>
        </div>
        <label>
          <span>행사</span>
          <select
            disabled={verifyingId !== null || importBusy}
            value={eventId ?? ''}
            onChange={(event) => {
              setTargets([]);
              setIsLoading(true);
              setEventId(Number(event.target.value));
            }}
          >
            {events.map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {event.roundNo}회 · {event.title}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="admin-reviews__notice">
        <strong>운영 기준</strong>
        <span>
          독서일지 승인 시 페이지가 반영되고, 서평 확인 시 1쪽당 5m가 거리와 완주 여부에 반영됩니다.
        </span>
        <b>참여자 알림 {targets.length}건</b>
      </div>
      {error && <p className="admin-reviews__error">{error}</p>}
      {isLoading ? (
        <div className="admin-reviews__empty">확인 대상을 불러오고 있습니다.</div>
      ) : targets.length === 0 ? (
        <div className="admin-reviews__empty">
          참여자의 서평 작성 알림이 없습니다. 솔라스 자료는 아래에서 대조할 수 있습니다.
        </div>
      ) : (
        <div className="admin-reviews__grid">
          {targets.map((target) => (
            <article key={target.participantBookId}>
              <div className="admin-reviews__person">
                <span>{target.userName.slice(0, 1)}</span>
                <div>
                  <strong>{target.userName}</strong>
                  <small>{target.studentNo}</small>
                </div>
              </div>
              <h2>{target.bookTitle}</h2>
              <p>{target.author || '저자 정보 없음'}</p>
              <dl>
                <div>
                  <dt>승인 페이지</dt>
                  <dd>{target.approvedReadPages.toLocaleString()}쪽</dd>
                </div>
                <div>
                  <dt>반영 거리</dt>
                  <dd>{formatCreditDistance(target.distanceToCreditMeter)}</dd>
                </div>
              </dl>
              <div className="admin-reviews__actions">
                {target.reviewSearchUrl && (
                  <a href={target.reviewSearchUrl} target="_blank" rel="noreferrer">
                    서평 확인하기
                  </a>
                )}
                <button
                  type="button"
                  disabled={verifyingId !== null || importBusy}
                  onClick={() => void verify(target)}
                >
                  {verifyingId === target.participantBookId ? '반영 중…' : '서평 확인 · 거리 반영'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {eventId && (
        <fieldset className="review-import-fieldset" disabled={verifyingId !== null}>
          <ReviewExcelImport
            key={eventId}
            eventId={eventId}
            onBusyChange={setImportBusy}
            onVerified={async () => setTargets(await getAdminReviewTargets(eventId))}
          />
        </fieldset>
      )}
    </section>
  );
}

export default AdminReviewsPage;
