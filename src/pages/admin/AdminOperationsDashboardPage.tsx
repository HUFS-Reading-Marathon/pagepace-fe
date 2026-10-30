import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminApplications } from '../../api/adminApplicationApi';
import { getApiErrorMessage } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import {
  getAdminReadingLogs,
  getAdminReviewTargets,
  type AdminReviewTarget,
} from '../../api/adminReadingLogApi';
import type { AdminApplicationListItem } from '../../types/adminApplication';
import { EVENT_STATUS_LABELS, type AdminEvent, type EventStatus } from '../../types/adminEvent';
import type { AdminReadingLogResponse } from '../../types/adminReadingLogApi';
import { chooseAdminEventId } from '../../utils/adminEvent';
import { useRememberedAdminEvent } from '../../hooks/useRememberedAdminEvent';
import '../../styles/admin-operations.css';

const EVENT_ORDER: EventStatus[] = [
  'IN_PROGRESS',
  'APPLICATION_OPEN',
  'APPLICATION_CLOSED',
  'READY',
  'DRAFT',
  'ENDED',
  'FINALIZED',
  'ARCHIVED',
];

const QUEUE_PREVIEW_COUNT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

type QueueRow = {
  key: number;
  to: string;
  name: string;
  meta: string;
  submittedAt: string;
};

type QueueConfig = {
  step: string;
  title: string;
  description: string;
  rows: QueueRow[];
  /** 서버 조회에 실패해 건수를 알 수 없으면 null */
  unavailableMessage: string | null;
  emptyText: string;
  actionTo: string;
  actionLabel: string;
};

/** 가장 오래 기다린 요청의 대기 일수. 제출 시각을 해석할 수 없으면 null을 돌려줍니다. */
function getWaitingDays(value: string | undefined) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();

  return Number.isNaN(time) ? null : Math.max(0, Math.floor((Date.now() - time) / DAY_MS));
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function AdminOperationsDashboardPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  useRememberedAdminEvent(selectedEventId);
  const [applications, setApplications] = useState<AdminApplicationListItem[]>([]);
  const [logs, setLogs] = useState<AdminReadingLogResponse[]>([]);
  const [reviewTargets, setReviewTargets] = useState<AdminReviewTarget[] | null>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminEvents()
      .then((nextEvents) => {
        setEvents(nextEvents);
        setSelectedEventId(chooseAdminEventId(nextEvents, EVENT_ORDER));

        if (nextEvents.length === 0) {
          setIsLoading(false);
        }
      })
      .catch((requestError: unknown) => {
        setError(getApiErrorMessage(requestError, '행사 목록을 불러오지 못했습니다.'));
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    if (selectedEventId === null) {
      return;
    }

    let isActive = true;

    Promise.all([
      getAdminApplications(selectedEventId),
      getAdminReadingLogs({ eventId: selectedEventId }),
      // 서평 대기 조회가 실패해도 신청·일지 업무는 그대로 보여 줍니다.
      getAdminReviewTargets(selectedEventId).catch(() => null),
    ])
      .then(([nextApplications, nextLogs, nextReviewTargets]) => {
        if (!isActive) {
          return;
        }

        setApplications(nextApplications);
        setLogs(nextLogs);
        setReviewTargets(nextReviewTargets);
        setError('');
      })
      .catch((requestError: unknown) => {
        if (!isActive) {
          return;
        }

        setError(getApiErrorMessage(requestError, '오늘의 업무를 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedEventId]);

  const selectedEvent = events.find((event) => event.eventId === selectedEventId) ?? null;
  const pendingApplications = useMemo(
    () =>
      applications
        .filter((item) => item.status === 'APPLIED')
        .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt)),
    [applications],
  );
  const pendingLogs = useMemo(
    () =>
      logs
        .filter((item) => item.status === 'SUBMITTED')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [logs],
  );
  const pendingReviews = useMemo(
    () =>
      (reviewTargets ?? [])
        .filter((item) => !item.reviewVerified)
        .sort((a, b) => a.reviewSubmittedAt.localeCompare(b.reviewSubmittedAt)),
    [reviewTargets],
  );
  const totalTasks = pendingApplications.length + pendingLogs.length + pendingReviews.length;

  const queues: QueueConfig[] = [
    {
      step: '01',
      title: '참가 신청 승인',
      description: '오래 기다린 신청부터 확인합니다.',
      rows: pendingApplications.map((item) => ({
        key: item.applicationId,
        to: '/admin/participants?status=APPLIED',
        name: item.name,
        meta: `${item.studentNo} · ${item.courseName}`,
        submittedAt: item.appliedAt,
      })),
      unavailableMessage: null,
      emptyText: '처리할 참가 신청서가 없습니다.',
      actionTo: '/admin/participants?status=APPLIED',
      actionLabel: '신청서 검수하기',
    },
    {
      step: '02',
      title: '독서일지 검토',
      description: '제출 순서대로 도서와 쪽수를 확인합니다.',
      rows: pendingLogs.map((log) => ({
        key: log.readingLogId,
        to: `/admin/logs?logId=${log.readingLogId}`,
        name: log.userName,
        meta: `${log.books.map((book) => book.bookTitle).join(', ')} · ${log.totalReadPages}쪽`,
        submittedAt: log.createdAt,
      })),
      unavailableMessage: null,
      emptyText: '검토할 독서일지가 없습니다.',
      actionTo: '/admin/logs',
      actionLabel: '독서일지 검토하기',
    },
    {
      step: '03',
      title: '서평 확인',
      description: '서평을 확인하고 인정 거리를 반영합니다.',
      rows: pendingReviews.map((target) => ({
        key: target.participantBookId,
        to: '/admin/reviews',
        name: target.userName,
        meta: `${target.bookTitle} · +${target.distanceToCreditMeter.toLocaleString('ko-KR')}m`,
        submittedAt: target.reviewSubmittedAt,
      })),
      unavailableMessage:
        reviewTargets === null ? '서평 확인 대기 목록을 불러오지 못했습니다.' : null,
      emptyText: '확인할 서평이 없습니다.',
      actionTo: '/admin/reviews',
      actionLabel: '서평 확인하기',
    },
  ];

  const renderQueue = (queue: QueueConfig) => {
    const oldestDays = getWaitingDays(queue.rows[0]?.submittedAt);

    return (
      <section className="admin-operations__queue" key={queue.step}>
        <header>
          <div>
            <span className="admin-operations__step">{queue.step}</span>
            <h2>{queue.title}</h2>
            <p>{queue.description}</p>
          </div>
          <strong>
            {isLoading || queue.unavailableMessage ? '-' : queue.rows.length}건
            {!isLoading && oldestDays !== null && (
              <small className={oldestDays >= 3 ? 'is-late' : undefined}>
                가장 오래 대기 {oldestDays}일
              </small>
            )}
          </strong>
        </header>
        <div className="admin-operations__queue-list">
          {isLoading ? (
            <p className="admin-operations__queue-message">불러오고 있습니다.</p>
          ) : queue.unavailableMessage ? (
            <p className="admin-operations__queue-message" role="alert">
              {queue.unavailableMessage}
            </p>
          ) : queue.rows.length === 0 ? (
            <p className="admin-operations__queue-message is-complete">{queue.emptyText}</p>
          ) : (
            queue.rows.slice(0, QUEUE_PREVIEW_COUNT).map((row) => (
              <Link key={row.key} to={row.to} className="admin-operations__queue-row">
                <div>
                  <strong>{row.name}</strong>
                  <span>{row.meta}</span>
                </div>
                <time>{formatDateTime(row.submittedAt)}</time>
                <span aria-hidden="true">→</span>
              </Link>
            ))
          )}
          {!isLoading && queue.rows.length > QUEUE_PREVIEW_COUNT && (
            <p className="admin-operations__queue-more">
              외 {queue.rows.length - QUEUE_PREVIEW_COUNT}건
            </p>
          )}
        </div>
        <Link to={queue.actionTo} className="admin-operations__queue-action">
          {queue.actionLabel} <span>→</span>
        </Link>
      </section>
    );
  };

  return (
    <section className="admin-page admin-operations">
      <header className="admin-page__header admin-operations__header">
        <div>
          <span className="admin-operations__eyebrow">TODAY'S WORK</span>
          <h1>오늘의 운영 업무</h1>
          <p>신청·독서일지·서평 처리 대기를 한곳에서 확인하고, 오래 기다린 요청부터 처리하세요.</p>
        </div>
        <label className="admin-operations__event-select">
          <span>업무 대상 행사</span>
          <select
            value={selectedEventId ?? ''}
            onChange={(event) => {
              setIsLoading(true);
              setSelectedEventId(Number(event.target.value));
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

      {error && (
        <div className="admin-operations__error" role="alert">
          {error}
        </div>
      )}
      {!isLoading && !selectedEvent ? (
        <div className="admin-operations__empty">
          운영할 행사가 없습니다. <Link to="/admin/event">행사를 먼저 등록해 주세요.</Link>
        </div>
      ) : (
        <>
          <section className="admin-operations__event-context">
            <div>
              <span>
                {selectedEvent ? EVENT_STATUS_LABELS[selectedEvent.status] : '불러오는 중'}
              </span>
              <strong>{selectedEvent?.title ?? '행사 정보를 불러오고 있습니다.'}</strong>
              <small>
                {selectedEvent
                  ? `${selectedEvent.eventStartDate} ~ ${selectedEvent.eventEndDate}`
                  : ''}
              </small>
            </div>
            <div className="admin-operations__task-total">
              <span>처리 대기</span>
              <strong>
                {isLoading ? '-' : totalTasks}
                <small>건</small>
              </strong>
            </div>
          </section>

          <div className="admin-operations__queues">{queues.map(renderQueue)}</div>

          <section className="admin-operations__secondary">
            <div>
              <h2>그 밖의 운영</h2>
              <p>필요할 때 확인하거나 변경하는 관리 기능입니다.</p>
            </div>
            <nav>
              <Link to="/admin/status">
                <strong>대회 현황·랭킹</strong>
                <span>참가자별 진행 상황 확인</span>
              </Link>
              <Link to="/admin/event">
                <strong>행사·코스 설정</strong>
                <span>기간과 코스 기준 변경</span>
              </Link>
              <Link to="/admin/statistics">
                <strong>운영 통계</strong>
                <span>참여와 독서 추이 분석</span>
              </Link>
              <Link to="/admin/notices">
                <strong>공지사항 관리</strong>
                <span>사용자 공지 작성·게시</span>
              </Link>
            </nav>
          </section>
        </>
      )}
    </section>
  );
}

export default AdminOperationsDashboardPage;
