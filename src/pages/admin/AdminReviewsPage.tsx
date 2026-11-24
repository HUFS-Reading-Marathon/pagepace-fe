import ApprovedBookLogs from '../../components/admin/reviews/ApprovedBookLogs';
import EvidenceHistory from '../../components/admin/reviews/EvidenceHistory';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, getApiErrorMessage } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import ReviewTargetTable from '../../components/admin/reviews/ReviewTargetTable';
import {
  INITIAL_REVIEW_SEARCH,
  reviewFilterCounts,
  visibleReviewTargets,
  type ReviewSearch,
} from '../../components/admin/reviews/reviewTargetFilters';
import { DEFAULT_PAGE_SIZE, clampPage } from '../../components/admin/table/pagination';
import ReviewImportWorkspace, {
  type ReviewPreview,
} from '../../components/admin/reviews/ReviewImportWorkspace';
import {
  getAdminReviewTargets,
  replaceReviewTarget,
  settleReviewTargets,
  verifyAdminReview,
  type AdminReviewTarget,
} from '../../api/adminReadingLogApi';
import { METERS_PER_PAGE } from '../../constants/reading';
import type { AdminEvent } from '../../types/adminEvent';
import { formatKoDateTime24 } from '../../utils/date';
import { preferredAdminEvent } from '../../utils/eventSelection';
import { useAdminEventState } from '../../hooks/useAdminEventState';
import '../../styles/admin-reviews.css';

const REVIEW_CHECK_ITEMS = [
  {
    key: 'author-book',
    label: '작성자와 도서 확인',
    description: '도서관 서평의 작성자·도서가 이 참가자와 책 정보와 일치합니다.',
  },
  {
    key: 'date-content',
    label: '기간과 원문 확인',
    description: '행사 기간에 작성·수정된 이 책의 서평 원문을 확인했습니다.',
  },
] as const;

const EMPTY_EVIDENCE = {
  targetId: null as number | null,
  time: '',
  content: '',
  note: '',
  replacesId: null as number | null,
};

function reviewTimeLabel(target: AdminReviewTarget) {
  if (target.reviewSubmittedAt) return `서평 제출 ${formatKoDateTime24(target.reviewSubmittedAt)}`;
  if (target.reviewVerifiedAt) return `서평 확인 ${formatKoDateTime24(target.reviewVerifiedAt)}`;
  return '승인된 일지 · 참가자 알림 없음';
}

/**
 * 승인 누적 쪽수에서 미인정 거리에 해당하는 쪽수를 빼서 이미 인정된 분량을 구합니다.
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

function AdminReviews({
  requestedEvent,
  requestedBook,
  onSelectEvent,
}: {
  requestedEvent: string | null;
  requestedBook: string | null;
  onSelectEvent: (eventId: string) => void;
}) {
  const [workspace, setWorkspace] = useState<'excel' | 'manual'>(
    requestedBook ? 'manual' : 'excel',
  );
  const [importBusy, setImportBusy] = useState(false);
  const manualBusy = useRef(false);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useAdminEventState();
  const [targets, setTargets] = useState<AdminReviewTarget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  // 개별 확인 목록(review-targets) 조회 실패. 빈 목록과 구분하고, 마지막으로 받은 목록은 유지합니다.
  const [queueError, setQueueError] = useState('');
  const [queueReloading, setQueueReloading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [search, setSearch] = useState<ReviewSearch>(INITIAL_REVIEW_SEARCH);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [missingLinkedBook, setMissingLinkedBook] = useState(false);
  const [evidence, setEvidence] = useState(EMPTY_EVIDENCE);
  const [checkedItems, setCheckedItems] = useState<{ targetId: number | null; keys: string[] }>({
    targetId: null,
    keys: [],
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const excelPreview = useRef<ReviewPreview>(null);

  useEffect(() => {
    let active = true;
    getAdminEvents()
      .then((next) => {
        if (!active) return;
        setEvents(next);
        const initialEvent =
          requestedEvent === null
            ? preferredAdminEvent(next)
            : next.find((event) => String(event.eventId) === requestedEvent);
        setEventId(initialEvent?.eventId ?? null);
        if (!initialEvent) {
          if (requestedEvent !== null)
            setError('링크의 행사를 찾을 수 없습니다. 관리 행사를 선택해 주세요.');
          setIsLoading(false);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(getApiErrorMessage(requestError, '행사를 불러오지 못했습니다.'));
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestedEvent, setEventId]);

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
          setQueueError('');
          if (requestedBook !== null) {
            const requested = next.find(
              (target) => String(target.participantBookId) === requestedBook,
            );
            if (requested) {
              setSearch((current) => ({
                ...current,
                filter: requested.reviewVerified ? 'verified' : 'pending',
              }));
              setSelectedId(requested.participantBookId);
            } else {
              setMissingLinkedBook(true);
              setFeedbackMessage(
                '선택한 서평이 이 회차의 확인 대상에 없습니다. 목록에서 다른 도서를 선택해 주세요.',
              );
            }
          }
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setQueueError(getApiErrorMessage(requestError, '서평 확인 대상을 불러오지 못했습니다.'));
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
  }, [eventId, requestedBook]);

  const counts = useMemo(() => reviewFilterCounts(targets), [targets]);
  const pendingCount = counts.pending;
  const visibleTargets = useMemo(() => visibleReviewTargets(targets, search), [search, targets]);
  const currentPage = clampPage(page, visibleTargets.length, pageSize);
  const pageTargets = visibleTargets.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  // 표에서 고른 대상만 확인 영역에 보여 줍니다. 아무것도 고르지 않았으면 빈 상세 영역을 두지 않습니다.
  const activeTarget = targets.find((target) => target.participantBookId === selectedId);
  const draft =
    activeTarget && evidence.targetId === activeTarget.participantBookId
      ? evidence
      : EMPTY_EVIDENCE;
  const eventLocked = events.some(
    (event) => event.eventId === eventId && ['FINALIZED', 'ARCHIVED'].includes(event.status),
  );
  const activeIndex = activeTarget ? visibleTargets.indexOf(activeTarget) : -1;
  const panelTotal = visibleTargets.length;
  const activeChecks =
    activeTarget && checkedItems.targetId === activeTarget.participantBookId
      ? checkedItems.keys
      : [];
  const breakdown = activeTarget ? getCreditBreakdown(activeTarget) : null;
  const allChecked = REVIEW_CHECK_ITEMS.every((item) => activeChecks.includes(item.key));
  const canVerify =
    !!activeTarget &&
    !activeTarget.reviewVerified &&
    !eventLocked &&
    !!breakdown?.creditPages &&
    allChecked &&
    !!draft.time &&
    !!draft.content.trim() &&
    (!draft.replacesId || !!draft.note.trim()) &&
    verifyingId === null &&
    !importBusy;

  const selectTarget = (targetId: number) => {
    setSelectedId(targetId);
    setActionError('');
    if (missingLinkedBook) {
      setMissingLinkedBook(false);
      setFeedbackMessage('');
    }

    // 확인 영역은 표 아래에 열리므로 그 위치로 옮깁니다.
    window.requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
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

  /**
   * 서평 확인 대기 목록을 다시 불러옵니다. studentNo를 주면 엑셀 대조 결과에서도 그 참가자의 행만
   * 다시 불러옵니다 (개별 확인이나 인정 취소가 같은 참가자의 대조 상태를 바꿀 수 있습니다).
   */
  const refreshReviews = async (studentNo?: string) => {
    if (eventId === null) return;
    setCheckedItems({ targetId: null, keys: [] });
    const [queue, excel] = await Promise.allSettled([
      getAdminReviewTargets(eventId),
      studentNo ? excelPreview.current?.reload(studentNo) : Promise.resolve(),
    ]);
    // 일시적인 조회 실패로 목록을 비우지 않습니다. 마지막 목록을 두고 최신이 아님을 알립니다.
    setTargets((current) => settleReviewTargets(current, queue));
    setQueueError(
      queue.status === 'rejected'
        ? getApiErrorMessage(queue.reason, '서평 확인 대상을 다시 불러오지 못했습니다.')
        : '',
    );
    setError(
      excel.status === 'rejected'
        ? '엑셀 대조 결과를 다시 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.'
        : '',
    );
  };

  const retryQueue = async () => {
    if (queueReloading) return;
    setQueueReloading(true);
    await refreshReviews();
    setQueueReloading(false);
  };

  /** 서버에서 확인 처리가 성공한 뒤에만 다음 대기 서평으로 이동합니다. */
  const verify = async (target: AdminReviewTarget) => {
    if (!canVerify || !breakdown || eventId === null || manualBusy.current) {
      return;
    }
    manualBusy.current = true;

    const index = visibleTargets.indexOf(target);
    const nextTarget = visibleTargets[index + 1] ?? visibleTargets[index - 1] ?? null;

    setVerifyingId(target.participantBookId);
    setActionError('');
    setFeedbackMessage('');

    try {
      const updated = await verifyAdminReview(target.participantBookId, {
        sourceUpdatedAt: draft.time,
        sourceContent: draft.content.trim(),
        expectedApprovedPages: target.approvedReadPages,
        expectedUncreditedPages: breakdown.creditPages,
        evidenceChecked: allChecked,
        ...(draft.replacesId
          ? { replacesEvidenceId: draft.replacesId, note: draft.note.trim() }
          : {}),
      });
      const creditedDistance = target.distanceToCreditMeter - updated.distanceToCreditMeter;
      setFeedbackMessage(
        `${target.userName} 님의 “${target.bookTitle}”에 ${(creditedDistance / METERS_PER_PAGE).toLocaleString('ko-KR')}쪽(${creditedDistance.toLocaleString('ko-KR')}m)을 반영했습니다.`,
      );
      setEvidence(EMPTY_EVIDENCE);
      // 서버가 확인한 결과는 재조회 성공 여부와 관계없이 목록에 바로 반영합니다.
      setTargets((current) => replaceReviewTarget(current, updated));
    } catch (requestError) {
      setActionError(getApiErrorMessage(requestError, '서평 확인에 실패했습니다.'));
      if (
        requestError instanceof ApiError &&
        ['REVIEW_TOTALS_CHANGED', 'REVIEW_ALREADY_VERIFIED'].includes(requestError.code ?? '')
      ) {
        setActionError('');
        setFeedbackMessage(
          `${target.userName} 님의 “${target.bookTitle}” · ${requestError.message}`,
        );
        await refreshReviews(target.studentNo);
      }
      manualBusy.current = false;
      setVerifyingId(null);
      return;
    }

    await refreshReviews(target.studentNo);
    manualBusy.current = false;
    setVerifyingId(null);

    if (nextTarget) {
      selectTarget(nextTarget.participantBookId);
    }
  };

  const renderPanel = () => {
    if (!activeTarget) return null;

    const isVerifying = verifyingId === activeTarget.participantBookId;

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
            {activeIndex >= 0 && (
              <span>
                {activeIndex + 1} / {panelTotal}
              </span>
            )}
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
              disabled={
                activeIndex < 0 || activeIndex >= visibleTargets.length - 1 || verifyingId !== null
              }
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
                {activeTarget.author || '저자 정보 없음'} · {reviewTimeLabel(activeTarget)}
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

          <ApprovedBookLogs
            key={activeTarget.participantBookId}
            bookId={activeTarget.participantBookId}
          />
          {breakdown ? (
            <div className="admin-reviews__equation" aria-label="누적 미인정 쪽수 계산">
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
                <span>미인정</span>
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
              <span>남은 미인정 거리</span>
              <strong>{activeTarget.distanceToCreditMeter.toLocaleString('ko-KR')}m</strong>
            </div>
            {breakdown && (
              <p>
                계산식 {breakdown.creditPages.toLocaleString('ko-KR')}쪽 × {METERS_PER_PAGE}m
                <br />이 책의 승인된 독서일지를 모두 인정합니다. 이후 일지 승인분도 자동 반영됩니다.
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
              <label className="admin-reviews__evidence">
                도서관 서평 원문 작성·최종 수정 시각 (한국시간)
                <input
                  type="datetime-local"
                  step="1"
                  value={draft.time}
                  required
                  disabled={verifyingId !== null || eventLocked}
                  onChange={(event) =>
                    setEvidence({
                      ...draft,
                      targetId: activeTarget.participantBookId,
                      time: event.target.value,
                    })
                  }
                />
              </label>
              <label className="admin-reviews__evidence">
                도서관 서평 원문
                <textarea
                  value={draft.content}
                  rows={3}
                  maxLength={32000}
                  required
                  disabled={verifyingId !== null || eventLocked}
                  onChange={(event) =>
                    setEvidence({
                      ...draft,
                      targetId: activeTarget.participantBookId,
                      content: event.target.value,
                    })
                  }
                />
              </label>
              {draft.replacesId && (
                <label className="admin-reviews__evidence">
                  원문 재인정 사유
                  <input
                    maxLength={1000}
                    value={draft.note}
                    onChange={(e) => setEvidence({ ...draft, note: e.target.value })}
                  />
                </label>
              )}
              <h3 id="reviewChecksTitle">확인 체크 항목</h3>
              <ul className="admin-checklist">
                {REVIEW_CHECK_ITEMS.map((item) => (
                  <li key={item.key}>
                    <label>
                      <input
                        type="checkbox"
                        checked={activeChecks.includes(item.key)}
                        disabled={verifyingId !== null || eventLocked}
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

          <EvidenceHistory
            key={activeTarget.participantBookId + '-' + String(activeTarget.reviewVerified)}
            bookId={activeTarget.participantBookId}
            locked={eventLocked || verifyingId !== null || importBusy}
            onChanged={() => refreshReviews(activeTarget.studentNo)}
            onReplace={(id, content, time) => {
              setEvidence({
                targetId: activeTarget.participantBookId,
                replacesId: id,
                content,
                time,
                note: '',
              });
            }}
          />
          {actionError && (
            <p className="admin-reviews__action-error" role="alert">
              {actionError}
            </p>
          )}
        </div>

        {!activeTarget.reviewVerified && (
          <footer className="admin-detail-panel__actions">
            <p className="admin-detail-panel__actions-hint">
              {eventLocked
                ? '결과가 확정된 회차입니다.'
                : '원문 시각과 본문을 입력하고 두 항목을 확인해 주세요.'}
            </p>
            <button
              type="button"
              className="admin-button admin-button--primary"
              disabled={!canVerify}
              aria-busy={isVerifying}
              onClick={() => void verify(activeTarget)}
            >
              {isVerifying ? '반영 중…' : '이 책의 서평 승인'}
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
          <p>솔라스 서평 자료와 승인된 독서일지를 대조해 인정 거리를 반영합니다.</p>
        </div>
        <label>
          <span>관리 행사</span>
          <select
            disabled={verifyingId !== null || importBusy}
            value={eventId ?? ''}
            onChange={(event) => onSelectEvent(event.target.value)}
          >
            {!eventId && <option value="">행사를 선택해 주세요</option>}
            {events.map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {event.roundNo}회 · {event.title}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div
        className="admin-page-tabs admin-reviews__workspace"
        role="tablist"
        aria-label="서평 확인 방식"
      >
        <button
          type="button"
          role="tab"
          id="reviewWorkspaceExcel"
          aria-selected={workspace === 'excel'}
          aria-controls="reviewWorkspaceExcelPanel"
          className={`admin-page-tabs__link${workspace === 'excel' ? ' admin-page-tabs__link--active' : ''}`}
          disabled={importBusy || verifyingId !== null}
          onClick={() => setWorkspace('excel')}
        >
          엑셀 대조
        </button>
        <button
          type="button"
          role="tab"
          id="reviewWorkspaceManual"
          aria-selected={workspace === 'manual'}
          aria-controls="reviewWorkspaceManualPanel"
          className={`admin-page-tabs__link${workspace === 'manual' ? ' admin-page-tabs__link--active' : ''}`}
          disabled={importBusy || verifyingId !== null}
          onClick={() => setWorkspace('manual')}
        >
          개별 확인
          {pendingCount > 0 && <b className="admin-reviews__tab-count">{pendingCount}</b>}
        </button>
      </div>
      {error && (
        <p className="admin-reviews__error" role="alert">
          {error}
        </p>
      )}
      {eventId && (
        <div
          id="reviewWorkspaceExcelPanel"
          role="tabpanel"
          aria-labelledby="reviewWorkspaceExcel"
          hidden={workspace !== 'excel'}
        >
          <ReviewImportWorkspace
            ref={excelPreview}
            key={eventId}
            eventId={eventId}
            readOnly={eventLocked}
            onBusyChange={setImportBusy}
            onVerified={() => refreshReviews()}
          />
        </div>
      )}

      {workspace === 'excel' && !eventId && (
        <p className="admin-reviews__status" role="status">
          {isLoading ? '행사를 불러오고 있습니다.' : '대조할 행사를 선택해 주세요.'}
        </p>
      )}
      {workspace === 'manual' && (
        <div
          id="reviewWorkspaceManualPanel"
          role="tabpanel"
          aria-labelledby="reviewWorkspaceManual"
        >
          <p className="admin-reviews__manual-intro">
            엑셀에 없는 서평은 도서관 사이트에서 원문을 열어 확인한 뒤, 원문 시각과 본문을 남기고
            직접 인정합니다.
          </p>
          <ReviewTargetTable
            rows={pageTargets}
            total={visibleTargets.length}
            page={currentPage}
            pageSize={pageSize}
            search={search}
            counts={counts}
            loading={isLoading}
            busy={verifyingId !== null || queueReloading}
            error={queueError}
            hasLoaded={targets.length > 0}
            feedback={feedbackMessage}
            recent={activeTarget?.participantBookId ?? null}
            onSearch={(patch) => {
              setSearch((current) => ({ ...current, ...patch }));
              setPage(0);
            }}
            onReset={() => {
              setSearch(INITIAL_REVIEW_SEARCH);
              setPage(0);
            }}
            onRefresh={() => void retryQueue()}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(0);
            }}
            onOpen={(target) => selectTarget(target.participantBookId)}
          />

          <div ref={panelRef} className="admin-reviews__panel review-targets__detail">
            {renderPanel()}
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminReviewsPage() {
  const [parameters, setParameters] = useSearchParams();
  const requestedEvent = parameters.get('eventId');
  const requestedBook = parameters.get('participantBookId');
  return (
    <AdminReviews
      key={parameters.toString()}
      requestedEvent={requestedEvent}
      requestedBook={requestedBook}
      onSelectEvent={(eventId) => setParameters({ eventId }, { replace: true })}
    />
  );
}
