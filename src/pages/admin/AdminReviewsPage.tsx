import { useEffect, useState } from 'react';
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
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useState<number | null>(null);
  const [targets, setTargets] = useState<AdminReviewTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminEvents()
      .then((next) => {
        setEvents(next);
        setEventId(
          next.find((event) => event.status === 'IN_PROGRESS')?.eventId ?? next[0]?.eventId ?? null,
        );

        if (!next.length) {
          setIsLoading(false);
        }
      })
      .catch((requestError: unknown) => {
        setError(getApiErrorMessage(requestError, '행사를 불러오지 못했습니다.'));
        setIsLoading(false);
      });
  }, []);

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
    if (
      !window.confirm(
        `${target.userName} 학생의 “${target.bookTitle}” 서평을 확인하고 ${formatCreditDistance(
          target.distanceToCreditMeter,
        )}를 반영할까요?`,
      )
    ) {
      return;
    }

    setVerifyingId(target.participantBookId);

    try {
      await verifyAdminReview(target.participantBookId);
      setTargets((current) =>
        current.filter((item) => item.participantBookId !== target.participantBookId),
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, '서평 확인에 실패했습니다.'));
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <section className="admin-page admin-reviews">
      <header className="admin-page__header admin-reviews__header">
        <div>
          <h1>서평 확인</h1>
          <p>학생이 작성 완료한 서평을 확인한 뒤 독서 거리를 반영합니다.</p>
        </div>
        <label>
          <span>행사</span>
          <select
            value={eventId ?? ''}
            onChange={(event) => {
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
        <b>{targets.length}건 대기</b>
      </div>
      {error && <p className="admin-reviews__error">{error}</p>}
      {isLoading ? (
        <div className="admin-reviews__empty">확인 대상을 불러오고 있습니다.</div>
      ) : targets.length === 0 ? (
        <div className="admin-reviews__empty">확인할 서평이 없습니다.</div>
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
                  disabled={verifyingId !== null}
                  onClick={() => void verify(target)}
                >
                  {verifyingId === target.participantBookId ? '반영 중…' : '서평 확인 · 거리 반영'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AdminReviewsPage;
