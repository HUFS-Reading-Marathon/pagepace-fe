import { useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import ReviewExcelImport from '../../components/admin/reviews/ReviewExcelImport';
import {
  getAdminReviewTargets,
  verifyAdminReview,
  type AdminReviewTarget,
} from '../../api/adminReadingLogApi';
import { METERS_PER_PAGE } from '../../constants/reading';
import { formatReadingDistance } from '../../types/adminReadingLog';
import type { AdminEvent } from '../../types/adminEvent';
import { formatKoDateTime24 } from '../../utils/date';
import { preferredAdminEvent } from '../../utils/eventSelection';
import { useAdminEventState } from '../../hooks/useAdminEventState';
import '../../styles/admin-reviews.css';

type ReviewTab = 'pending' | 'verified';
type QueueSort = 'oldest' | 'newest';

const REVIEW_CHECK_ITEMS = [
  {
    key: 'author-book',
    label: '작성자와 도서 확인',
    description: '도서관 서평의 작성자·도서가 이 참가자와 책 정보와 일치합니다.',
  },
  {
    key: 'amount',
    label: '이번 인정 분량 서평 확인',
    description: '서평 내용이 이번에 인정할 독서 분량에 대한 것임을 확인했습니다.',
  },
] as const;

const NARROW_LAYOUT_QUERY = '(max-width: 1180px)';

/**
 * 서버가 내려준 승인 누적 쪽수와 이번 반영 거리로 "이미 인정된 쪽수"를 역산합니다.
 * 값이 서로 맞지 않으면(5m 단위가 아니거나 승인 누적보다 크면) 추정하지 않고 null을 돌려줍니다.
 */
function getCreditBreakdown(target: AdminReviewTarget) {
  const creditPages = target.distanceToCreditMeter / METERS_PER_PAGE;

  if (!Number.isInteger(creditPages) || creditPages < 0 || creditPages > target.approvedReadPages) {
    return null;
  }

  return {
    approvedPages: target.approvedReadPages,
    alreadyCreditedPages: target.approvedReadPages - creditPages,
    creditPages,
  };
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
  const [actionError, setActionError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [tab, setTab] = useState<ReviewTab>('pending');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortOrder, setSortOrder] = useState<QueueSort>('oldest');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [checkedItems, setCheckedItems] = useState<{ targetId: number | null; keys: string[] }>({
    targetId: null,
    keys: [],
  });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAdminEvents()
      .then((next) => {
        setEvents(next);
        setEventId(preferredAdminEvent(next)?.eventId ?? null);

        if (!next.length) {
          setIsLoading(false);
        }
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

  const pendingCount = targets.filter((target) => !target.reviewVerified).length;
  const verifiedCount = targets.length - pendingCount;

  const visibleTargets = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    const direction = sortOrder === 'oldest' ? 1 : -1;

    return targets
      .filter((target) => (tab === 'pending' ? !target.reviewVerified : target.reviewVerified))
      .filter(
        (target) =>
          !keyword ||
          [target.userName, target.studentNo, target.bookTitle, target.author ?? ''].some((value) =>
            value.toLowerCase().includes(keyword),
          ),
      )
      .sort(
        (left, right) => direction * left.reviewSubmittedAt.localeCompare(right.reviewSubmittedAt),
      );
  }, [searchKeyword, sortOrder, tab, targets]);

  const activeTarget =
    visibleTargets.find((target) => target.participantBookId === selectedId) ?? visibleTargets[0];
  const activeIndex = activeTarget ? visibleTargets.indexOf(activeTarget) : -1;
  const activeChecks =
    activeTarget && checkedItems.targetId === activeTarget.participantBookId
      ? checkedItems.keys
      : [];
  const breakdown = activeTarget ? getCreditBreakdown(activeTarget) : null;
  const allChecked = REVIEW_CHECK_ITEMS.every((item) => activeChecks.includes(item.key));

  const selectTarget = (targetId: number) => {
    setSelectedId(targetId);
    setActionError('');

    if (window.matchMedia(NARROW_LAYOUT_QUERY).matches) {
      window.requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  };

  const toggleCheck = (targetId: number, key: string, checked: boolean) => {
    setCheckedItems((current) => {
      const keys = current.targetId === targetId ? current.keys : [];

      return {
        targetId,
        keys: checked ? [...new Set([...keys, key])] : keys.filter((item) => item !== key),
      };
    });
  };

  /** 서버에서 확인 처리가 성공한 뒤에만 목록을 갱신하고 다음 대기 서평으로 이동합니다. */
  const verify = async (target: AdminReviewTarget) => {
    if (verifyingId !== null || eventId === null || manualBusy.current || importBusy) {
      return;
    }
    manualBusy.current = true;

    const index = visibleTargets.indexOf(target);
    const nextTarget = visibleTargets[index + 1] ?? visibleTargets[index - 1] ?? null;

    setVerifyingId(target.participantBookId);
    setActionError('');
    setFeedbackMessage('');

    try {
      await verifyAdminReview(target.participantBookId);
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, '서평 확인에 실패했습니다.'));
      manualBusy.current = false;
      setVerifyingId(null);
      return;
    }

    setFeedbackMessage(
      `${target.userName} 님의 “${target.bookTitle}” 서평을 확인하고 ${formatReadingDistance(
        target.distanceToCreditMeter,
      )}를 반영했습니다.`,
    );

    try {
      setTargets(await getAdminReviewTargets(eventId));
    } catch {
      // 확인 처리는 이미 성공했으므로, 목록 재조회에 실패하면 처리한 항목만 확인 완료로 표시합니다.
      setTargets((current) =>
        current.map((item) =>
          item.participantBookId === target.participantBookId
            ? { ...item, reviewVerified: true }
            : item,
        ),
      );
    } finally {
      manualBusy.current = false;
      setVerifyingId(null);
    }

    if (nextTarget) {
      selectTarget(nextTarget.participantBookId);
    }
  };

  const renderQueue = () => {
    if (isLoading) {
      return (
        <p className="admin-queue__message" role="status">
          확인 대상을 불러오고 있습니다.
        </p>
      );
    }

    if (visibleTargets.length === 0) {
      return (
        <p className="admin-queue__message">
          {searchKeyword.trim()
            ? '조건에 맞는 서평이 없습니다.'
            : tab === 'pending'
              ? '참여자의 서평 작성 알림이 없습니다. 솔라스 자료는 아래에서 대조할 수 있습니다.'
              : '이 목록에 포함된 확인 완료 서평이 없습니다.'}
        </p>
      );
    }

    return (
      <ul className="admin-queue__list">
        {visibleTargets.map((target) => (
          <li key={target.participantBookId}>
            <button
              type="button"
              className="admin-queue__item"
              aria-current={target === activeTarget ? 'true' : undefined}
              onClick={() => selectTarget(target.participantBookId)}
            >
              <strong>{target.userName}</strong>
              <small>
                {target.bookTitle} · {formatKoDateTime24(target.reviewSubmittedAt)}
              </small>
              <span className="admin-queue__item-side">
                <span className="admin-queue__pages">
                  +{formatReadingDistance(target.distanceToCreditMeter)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  };

  const renderPanel = () => {
    if (!activeTarget) {
      return (
        <div className="admin-detail-panel">
          <p className="admin-detail-panel__empty">
            {isLoading ? '확인 대상을 불러오고 있습니다.' : '왼쪽 목록에서 서평을 선택하세요.'}
          </p>
        </div>
      );
    }

    const isVerifying = verifyingId === activeTarget.participantBookId;
    const canVerify =
      !activeTarget.reviewVerified && allChecked && verifyingId === null && !importBusy;

    return (
      <section className="admin-detail-panel" aria-labelledby="reviewPanelTitle">
        <header className="admin-detail-panel__head">
          <div>
            <p className="admin-detail-panel__eyebrow">인정할 독서량 확인</p>
            <h2 id="reviewPanelTitle">
              {activeTarget.userName}
              <small className="admin-reviews__student">{activeTarget.studentNo}</small>
            </h2>
          </div>
          <div className="admin-detail-panel__nav">
            <span>
              {activeIndex + 1} / {visibleTargets.length}
            </span>
            <button
              type="button"
              aria-label="이전 서평"
              disabled={activeIndex <= 0 || verifyingId !== null}
              onClick={() => selectTarget(visibleTargets[activeIndex - 1].participantBookId)}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="다음 서평"
              disabled={activeIndex >= visibleTargets.length - 1 || verifyingId !== null}
              onClick={() => selectTarget(visibleTargets[activeIndex + 1].participantBookId)}
            >
              ›
            </button>
          </div>
        </header>

        <div className="admin-detail-panel__body">
          <div className="admin-reviews__book">
            <div>
              <h3>{activeTarget.bookTitle}</h3>
              <p>
                {activeTarget.author || '저자 정보 없음'} · 서평 제출{' '}
                {formatKoDateTime24(activeTarget.reviewSubmittedAt)}
              </p>
            </div>
            {activeTarget.reviewSearchUrl ? (
              <a
                className="admin-button"
                href={activeTarget.reviewSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                도서관 서평 열기 ↗
              </a>
            ) : (
              <span className="admin-reviews__no-link">서평 링크 없음</span>
            )}
          </div>
          <p className="admin-reviews__source-note">
            서평 원문은 도서관 사이트에서 직접 확인합니다. 이 화면은 서평 내용을 자동으로 검증하지
            않습니다.
          </p>

          {breakdown ? (
            <div className="admin-reviews__equation" aria-label="이번 인정 쪽수 계산">
              <div>
                <span>승인 누적</span>
                <strong>{breakdown.approvedPages.toLocaleString('ko-KR')}쪽</strong>
              </div>
              <b aria-hidden="true">−</b>
              <div>
                <span>이미 인정</span>
                <strong>{breakdown.alreadyCreditedPages.toLocaleString('ko-KR')}쪽</strong>
              </div>
              <b aria-hidden="true">=</b>
              <div className="is-result">
                <span>이번 인정</span>
                <strong>{breakdown.creditPages.toLocaleString('ko-KR')}쪽</strong>
              </div>
            </div>
          ) : (
            <p className="admin-reviews__warning">
              승인 누적 {activeTarget.approvedReadPages.toLocaleString('ko-KR')}쪽과 반영 거리가 1쪽
              = {METERS_PER_PAGE}m 기준으로 맞지 않아 이미 인정된 분량을 계산하지 않았습니다. 반영
              전에 참가자 기록을 확인해 주세요.
            </p>
          )}

          <div className="admin-reviews__distance">
            <div>
              <span>
                {activeTarget.reviewVerified ? '반영된 독서 거리' : '이번에 반영될 독서 거리'}
              </span>
              <strong>+{formatReadingDistance(activeTarget.distanceToCreditMeter)}</strong>
            </div>
            {breakdown && (
              <p>
                계산식 {breakdown.creditPages.toLocaleString('ko-KR')}쪽 × {METERS_PER_PAGE}m
                <br />
                이미 인정된 분량은 다시 반영되지 않습니다.
              </p>
            )}
          </div>

          {activeTarget.reviewVerified ? (
            <p className="admin-reviews__verified">
              확인 완료
              {activeTarget.reviewVerifiedAt &&
                ` · ${formatKoDateTime24(activeTarget.reviewVerifiedAt)}`}
            </p>
          ) : (
            <section className="admin-reviews__checks" aria-labelledby="reviewChecksTitle">
              <h3 id="reviewChecksTitle">확인 체크 항목</h3>
              <ul className="admin-checklist">
                {REVIEW_CHECK_ITEMS.map((item) => (
                  <li key={item.key}>
                    <label>
                      <input
                        type="checkbox"
                        checked={activeChecks.includes(item.key)}
                        disabled={verifyingId !== null}
                        onChange={(event) =>
                          toggleCheck(
                            activeTarget.participantBookId,
                            item.key,
                            event.target.checked,
                          )
                        }
                      />
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {actionError && (
            <p className="admin-reviews__action-error" role="alert">
              {actionError}
            </p>
          )}
        </div>

        {!activeTarget.reviewVerified && (
          <footer className="admin-detail-panel__actions">
            <p className="admin-detail-panel__actions-hint">
              {allChecked
                ? '서버 처리가 끝나면 다음 서평으로 이동합니다.'
                : '확인 항목을 모두 체크하면 반영할 수 있습니다.'}
            </p>
            <button
              type="button"
              className="admin-button admin-button--primary"
              disabled={!canVerify}
              aria-busy={isVerifying}
              onClick={() => void verify(activeTarget)}
            >
              {isVerifying
                ? '반영 중…'
                : `확인하고 ${formatReadingDistance(activeTarget.distanceToCreditMeter)} 반영`}
            </button>
          </footer>
        )}
      </section>
    );
  };

  return (
    <section className="admin-page admin-reviews">
      <header className="admin-page__header admin-reviews__header">
        <div>
          <h1>서평 확인</h1>
          <p>
            참여자 알림 또는 솔라스 자료로 서평을 확인한 뒤, 아직 인정되지 않은 분량만 거리(1쪽 ={' '}
            {METERS_PER_PAGE}m)로 반영합니다.
          </p>
        </div>
        <label>
          <span>행사</span>
          <select
            disabled={verifyingId !== null || importBusy}
            value={eventId ?? ''}
            onChange={(event) => {
              setTargets([]);
              setIsLoading(true);
              setSelectedId(null);
              setFeedbackMessage('');
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

      <div className="admin-reviews__tabs">
        <div className="admin-segmented" aria-label="서평 확인 상태">
          <button type="button" aria-pressed={tab === 'pending'} onClick={() => setTab('pending')}>
            참여자 알림 대기 <b>{pendingCount}</b>
          </button>
          <button
            type="button"
            aria-pressed={tab === 'verified'}
            onClick={() => setTab('verified')}
          >
            확인 완료 <b>{verifiedCount}</b>
          </button>
        </div>
        <p className="admin-feedback" role="status" aria-live="polite">
          {feedbackMessage}
        </p>
      </div>

      {error && (
        <p className="admin-reviews__error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-split">
        <section className="admin-queue" aria-labelledby="reviewQueueTitle">
          <div className="admin-queue__head">
            <h2 id="reviewQueueTitle">
              {tab === 'pending' ? '확인 대기' : '확인 완료'} <span>{visibleTargets.length}건</span>
            </h2>
            <select
              aria-label="정렬"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as QueueSort)}
            >
              <option value="oldest">제출 오래된 순</option>
              <option value="newest">최근 제출 순</option>
            </select>
          </div>
          <div className="admin-queue__tools">
            <input
              type="search"
              value={searchKeyword}
              aria-label="서평 확인 대상 검색"
              placeholder="참가자, 학번, 책 제목, 저자"
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
          </div>
          {renderQueue()}
        </section>

        <div ref={panelRef} className="admin-reviews__panel">
          {renderPanel()}
        </div>
      </div>

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
