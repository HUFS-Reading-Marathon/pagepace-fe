import ApprovedBookLogs from '../../components/admin/reviews/ApprovedBookLogs';
import EvidenceHistory from '../../components/admin/reviews/EvidenceHistory';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useSearchParams,
  type SetURLSearchParams,
} from 'react-router-dom';
import { ApiError, getApiErrorMessage } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import ReviewTargetTable from '../../components/admin/reviews/ReviewTargetTable';
import {
  INITIAL_REVIEW_SEARCH,
  readReviewListState,
  reviewFilterCounts,
  visibleReviewTargets,
  writeReviewListState,
  type ReviewListState,
} from '../../components/admin/reviews/reviewTargetFilters';
import DetailNavBar from '../../components/admin/table/DetailNavBar';
import { clampPage } from '../../components/admin/table/pagination';
import { nextCandidateId } from '../../components/admin/table/queueNavigation';
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

const AUTO_NEXT_KEY = 'pagepace:admin:review-auto-next';
const LEAVE_WITH_DRAFT =
  '입력 중인 서평 원문 시각·본문이 있습니다. 이동하면 입력한 내용이 사라집니다. 이동할까요?';
type DetailFeedback = { targetId: number; tone: 'success' | 'warning' | 'error'; text: string };
type NavigationState = { fromList?: boolean } | null;

function readAutoNext() {
  try {
    return localStorage.getItem(AUTO_NEXT_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** 상세 대상 파라미터: 없으면 null, 양의 정수가 아니면 NaN */
function parseBookId(value: string | null) {
  if (value === null) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : NaN;
}

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
  params,
  setParams,
}: {
  params: URLSearchParams;
  setParams: SetURLSearchParams;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as NavigationState;
  const fromList = navigationState?.fromList === true;
  const requestedEvent = params.get('eventId');
  // participantBookId가 있으면 개별 확인 상세 화면입니다(기존 바로가기 주소와 같음).
  const selectedId = parseBookId(params.get('participantBookId'));
  const workspace: 'excel' | 'manual' =
    selectedId !== null || params.get('tab') === 'manual' ? 'manual' : 'excel';
  const listState = useMemo(() => readReviewListState(params), [params]);
  const { search, pageSize } = listState;
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
  const [detailFeedback, setDetailFeedback] = useState<DetailFeedback | null>(null);
  const [recent, setRecent] = useState<number | null>(null);
  const [autoNext, setAutoNext] = useState(readAutoNext);
  const listScroll = useRef<number | null>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null);
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
  }, [eventId]);

  const counts = useMemo(() => reviewFilterCounts(targets), [targets]);
  const pendingCount = counts.pending;
  const visibleTargets = useMemo(() => visibleReviewTargets(targets, search), [search, targets]);
  const currentPage = clampPage(listState.page, visibleTargets.length, pageSize);
  const pageTargets = visibleTargets.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const activeTarget =
    selectedId === null || Number.isNaN(selectedId)
      ? undefined
      : targets.find((target) => target.participantBookId === selectedId);
  const draft =
    activeTarget && evidence.targetId === activeTarget.participantBookId
      ? evidence
      : EMPTY_EVIDENCE;
  const eventLocked = events.some(
    (event) => event.eventId === eventId && ['FINALIZED', 'ARCHIVED'].includes(event.status),
  );
  const activeIndex = activeTarget ? visibleTargets.indexOf(activeTarget) : -1;
  const hasDraft =
    selectedId !== null &&
    evidence.targetId === selectedId &&
    !!(evidence.time || evidence.content.trim() || evidence.note.trim());

  // 다른 화면의 바로가기로 확인 완료 서평을 열면, 목록 상태를 확인 완료로 맞춰 이전·다음 이동을 그 안에서 합니다.
  const adoptFilter =
    !isLoading && !!activeTarget && !params.has('rf') && !fromList && activeTarget.reviewVerified;
  useEffect(() => {
    if (!adoptFilter) return;
    const next = new URLSearchParams(params);
    next.set('rf', 'verified');
    setParams(next, { replace: true, state: navigationState });
  }, [adoptFilter, params, setParams, navigationState]);

  // 다른 서평으로 바뀌면 제목으로 초점을 옮깁니다.
  const activeId = activeTarget?.participantBookId;
  useEffect(() => {
    if (activeId != null) panelHeading.current?.focus();
  }, [activeId]);

  // 상세에서 목록으로 돌아오면 이전 스크롤 위치와 마지막으로 본 행으로 돌아갑니다.
  // 상세를 거쳐 목록으로 바뀐 때에만 되돌립니다(주소 변경은 전환으로 늦게 그려질 수 있음).
  const wasDetail = useRef(false);
  useEffect(() => {
    if (selectedId !== null) {
      wasDetail.current = true;
      return;
    }
    if (!wasDetail.current || workspace !== 'manual') return;
    wasDetail.current = false;
    window.scrollTo(0, listScroll.current ?? 0);
    listScroll.current = null;
    const row = recent === null ? null : document.getElementById('review-target-row-' + recent);
    (row ?? document.getElementById('review-target-count'))?.focus({ preventScroll: true });
  }, [selectedId, workspace, recent]);

  // 원문을 입력하는 중에 새로고침하거나 창을 닫으면 브라우저 확인 창을 띄웁니다.
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);
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

  const setWorkspace = (next: 'excel' | 'manual') => {
    const nextParams = new URLSearchParams(params);
    nextParams.delete('participantBookId');
    if (next === 'manual') nextParams.set('tab', 'manual');
    else nextParams.delete('tab');
    setParams(nextParams, { replace: true });
  };

  /** 목록 조건 변경: 빠르게 이어지는 입력이 서로 덮어쓰지 않도록 최신 주소 파라미터를 기준으로 계산합니다. */
  const setList = (update: (current: ReviewListState) => Partial<ReviewListState>) => {
    setFeedbackMessage('');
    setParams(
      (latest) => {
        const current = readReviewListState(latest);
        return writeReviewListState(latest, { ...current, ...update(current) });
      },
      { replace: true },
    );
  };

  const canLeave = () => {
    if (!hasDraft) return true;
    if (!window.confirm(LEAVE_WITH_DRAFT)) return false;
    setEvidence(EMPTY_EVIDENCE);
    return true;
  };

  /** 상세 화면 열기. 목록에서 들어오면 기록을 쌓고, 상세 안에서의 이동은 기록을 바꿔 뒤로 가기가 목록으로 가게 합니다. */
  const openTarget = (targetId: number, fromDetail = false, sourceRows = visibleTargets) => {
    const position = sourceRows.findIndex((target) => target.participantBookId === targetId);
    const page = position >= 0 ? Math.floor(position / pageSize) : listState.page;
    if (!fromDetail) listScroll.current = window.scrollY;
    setActionError('');
    setDetailFeedback(null);
    setRecent(targetId);
    const next = writeReviewListState(params, { ...listState, page });
    next.set('tab', 'manual');
    next.set('participantBookId', String(targetId));
    setParams(next, {
      replace: fromDetail,
      state: { fromList: fromDetail ? fromList : true },
    });
  };

  const backToList = () => {
    setActionError('');
    setDetailFeedback(null);
    if (fromList) {
      navigate(-1);
      return;
    }
    const next = new URLSearchParams(params);
    next.delete('participantBookId');
    next.set('tab', 'manual');
    setParams(next, { replace: true });
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
    if (eventId === null) return null;
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
    return queue.status === 'fulfilled' ? queue.value : null;
  };

  const retryQueue = async () => {
    if (queueReloading) return;
    setQueueReloading(true);
    await refreshReviews();
    setQueueReloading(false);
  };

  /**
   * 서버에서 확인 처리가 성공한 뒤에만 결과를 반영합니다. 확인 대기 목록에서 자동 이동이 켜져 있으면
   * 최신 대상을 다시 받아 같은 검색·정렬 조건의 다음 대기 서평으로 옮기고, 남은 대상이 없으면 목록으로
   * 돌아갑니다. 실패하면 현재 대상과 입력한 원문을 그대로 둡니다.
   */
  const verify = async (target: AdminReviewTarget) => {
    if (!canVerify || !breakdown || eventId === null || manualBusy.current) {
      return;
    }
    manualBusy.current = true;
    const beforeIds = visibleTargets.map((item) => item.participantBookId);

    setVerifyingId(target.participantBookId);
    setActionError('');
    setFeedbackMessage('');
    setDetailFeedback(null);

    let done: string;
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
      done = `${target.userName} 님의 “${target.bookTitle}”에 ${(creditedDistance / METERS_PER_PAGE).toLocaleString('ko-KR')}쪽(${creditedDistance.toLocaleString('ko-KR')}m)을 반영했습니다.`;
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
        setDetailFeedback({
          targetId: target.participantBookId,
          tone: 'error',
          text: `${target.userName} 님의 “${target.bookTitle}” · ${requestError.message}`,
        });
        await refreshReviews(target.studentNo);
      }
      manualBusy.current = false;
      setVerifyingId(null);
      return;
    }

    const fresh = await refreshReviews(target.studentNo);
    manualBusy.current = false;
    setVerifyingId(null);

    if (!autoNext || search.filter !== 'pending') {
      setDetailFeedback({ targetId: target.participantBookId, tone: 'success', text: done });
      return;
    }
    if (!fresh) {
      // 확인은 끝났으므로 실패로 알리거나 다시 보내지 않습니다. 이동만 멈추고 두 결과를 나눠 알립니다.
      setDetailFeedback({
        targetId: target.participantBookId,
        tone: 'warning',
        text: `${done} 다만 확인 대기 목록을 다시 불러오지 못해 이동하지 않았습니다. 목록에서 다시 조회해 주세요.`,
      });
      return;
    }
    const nextRows = visibleReviewTargets(fresh, search);
    const nextId = nextCandidateId(
      beforeIds,
      target.participantBookId,
      nextRows.map((item) => item.participantBookId),
    );
    if (nextId !== null) {
      openTarget(nextId, true, nextRows);
      setDetailFeedback({ targetId: nextId, tone: 'success', text: `${done} 다음 서평입니다.` });
    } else {
      backToList();
      setFeedbackMessage(
        `${done} ${search.query.trim() ? '현재 조건에 남은' : '남은'} 확인 대기 서평이 없습니다.`,
      );
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
            <h2 id="reviewPanelTitle" ref={panelHeading} tabIndex={-1}>
              {activeTarget.userName}
              <small className="admin-reviews__student">{activeTarget.studentNo}</small>
            </h2>
          </div>
          <span
            className="review-detail__status"
            data-verified={activeTarget.reviewVerified || undefined}
          >
            {activeTarget.reviewVerified ? '확인 완료' : '확인 대기'}
          </span>
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
            onChanged={async () => {
              await refreshReviews(activeTarget.studentNo);
            }}
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
            {search.filter === 'pending' && !eventLocked && (
              <label className="review-detail__auto">
                <input
                  type="checkbox"
                  checked={autoNext}
                  disabled={verifyingId !== null}
                  onChange={(e) => {
                    setAutoNext(e.target.checked);
                    try {
                      localStorage.setItem(AUTO_NEXT_KEY, String(e.target.checked));
                    } catch {
                      /* 저장하지 못해도 이번 화면에서는 그대로 동작합니다. */
                    }
                  }}
                />
                처리 후 다음 대기 서평으로 이동
              </label>
            )}
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
            onChange={(event) => {
              if (canLeave()) setParams({ eventId: event.target.value }, { replace: true });
            }}
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
            onVerified={async () => {
              await refreshReviews();
            }}
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
          {selectedId === null ? (
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
              recent={recent}
              onSearch={(patch) =>
                setList((current) => ({ search: { ...current.search, ...patch }, page: 0 }))
              }
              onReset={() => setList(() => ({ search: INITIAL_REVIEW_SEARCH, page: 0 }))}
              onRefresh={() => void retryQueue()}
              onPage={(page) => setList(() => ({ page }))}
              onPageSize={(size) => setList(() => ({ pageSize: size, page: 0 }))}
              onOpen={(target) => openTarget(target.participantBookId)}
            />
          ) : (
            <div className="review-detail">
              <DetailNavBar
                noun="서평"
                position={
                  activeIndex >= 0 ? { index: activeIndex, total: visibleTargets.length } : null
                }
                busy={verifyingId !== null}
                onBack={() => canLeave() && backToList()}
                onPrevious={
                  activeIndex > 0
                    ? () =>
                        canLeave() &&
                        openTarget(visibleTargets[activeIndex - 1].participantBookId, true)
                    : undefined
                }
                onNext={
                  activeIndex >= 0 && activeIndex < visibleTargets.length - 1
                    ? () =>
                        canLeave() &&
                        openTarget(visibleTargets[activeIndex + 1].participantBookId, true)
                    : undefined
                }
              />
              {detailFeedback?.targetId === selectedId && (
                <p
                  className={`review-detail__feedback review-detail__feedback--${detailFeedback.tone}`}
                  role={detailFeedback.tone === 'error' ? 'alert' : 'status'}
                >
                  {detailFeedback.text}
                </p>
              )}
              {Number.isNaN(selectedId) ? (
                <p className="review-detail__message" role="alert">
                  서평 주소가 올바르지 않습니다.
                </p>
              ) : isLoading ? (
                <p className="review-detail__message" role="status">
                  확인 대상을 불러오고 있습니다.
                </p>
              ) : !activeTarget ? (
                <p className="review-detail__message" role="alert">
                  {queueError && !targets.length
                    ? queueError
                    : '선택한 서평이 이 회차의 확인 대상에 없습니다. 목록에서 다른 도서를 선택해 주세요.'}
                </p>
              ) : (
                <>
                  {activeIndex < 0 && (
                    <p className="review-detail__note">
                      현재 목록 조건에 포함되지 않은 서평입니다. 이전·다음 이동은 목록 조건 안에서만
                      가능합니다.
                    </p>
                  )}
                  {queueError && (
                    <p className="review-detail__note" role="alert">
                      {queueError} 화면의 값은 마지막으로 불러온 내용입니다.
                    </p>
                  )}
                  <div ref={panelRef} className="admin-reviews__panel">
                    {renderPanel()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function AdminReviewsPage() {
  const [parameters, setParameters] = useSearchParams();
  // 행사가 바뀔 때만 새로 그립니다. 목록·상세 이동에서는 엑셀 대조 결과와 업로드 상태를 그대로 둡니다.
  return (
    <AdminReviews
      key={parameters.get('eventId') ?? ''}
      params={parameters}
      setParams={setParameters}
    />
  );
}
