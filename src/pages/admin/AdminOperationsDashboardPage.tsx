import { preferredAdminEvent } from '../../utils/eventSelection';
import { useAdminEventState } from '../../hooks/useAdminEventState';
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
import { chooseEventIdByStatus } from '../../utils/adminEvent';
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

/** 운영 바로가기: 기존 메뉴명·경로를 그대로 두고, 작은 outline 아이콘(16px)을 붙입니다. */
const SHORTCUTS = [
  {
    to: '/admin/status',
    label: '대회 현황·랭킹',
    // 막대 그래프
    icon: 'M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5',
  },
  {
    to: '/admin/event',
    label: '행사·코스 설정',
    // 달력
    icon: 'M3 4.5h10v8.5H3zM3 7h10M5.5 3v3M10.5 3v3',
  },
  {
    to: '/admin/statistics',
    label: '운영 통계',
    // 꺾은선 그래프
    icon: 'M2.5 13.5h11M3.5 10.5l3-3 2.5 2 4-4.5',
  },
  {
    to: '/admin/notices',
    label: '공지사항 관리',
    // 확성기
    icon: 'M3 6.5v3h2.5l4.5 3v-9l-4.5 3zM12 6.5a2 2 0 0 1 0 3',
  },
] as const;

type QueueConfig = {
  step: string;
  title: string;
  /** 현재 처리 대기 건수. 서버 조회에 실패해 알 수 없으면 null */
  count: number | null;
  /** 해당 업무의 처리 대기 목록(선택한 행사) */
  to: string;
};

function AdminOperationsDashboardPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useAdminEventState();
  const [applications, setApplications] = useState<AdminApplicationListItem[]>([]);
  const [logs, setLogs] = useState<AdminReadingLogResponse[]>([]);
  const [reviewTargets, setReviewTargets] = useState<AdminReviewTarget[] | null>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminEvents()
      .then((nextEvents) => {
        setEvents(nextEvents);
        setSelectedEventId(
          preferredAdminEvent(nextEvents)?.eventId ??
            chooseEventIdByStatus(nextEvents, EVENT_ORDER),
        );

        if (nextEvents.length === 0) {
          setIsLoading(false);
        }
      })
      .catch((requestError: unknown) => {
        setError(getApiErrorMessage(requestError, '행사 목록을 불러오지 못했습니다.'));
        setIsLoading(false);
      });
  }, [setSelectedEventId]);

  useEffect(() => {
    if (selectedEventId === null) {
      return;
    }

    let isActive = true;

    Promise.all([
      getAdminApplications(selectedEventId),
      getAdminReadingLogs({ eventId: selectedEventId, status: 'SUBMITTED' }),
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

        setApplications([]);
        setLogs([]);
        setReviewTargets(null);
        setError(getApiErrorMessage(requestError, '운영 현황을 불러오지 못했습니다.'));
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
  // 건수 집계 기준은 그대로입니다: 승인 대기 신청, 제출(검토 대기) 일지, 아직 인정되지 않은 서평 대상.
  const pendingApplicationCount = useMemo(
    () => applications.filter((item) => item.status === 'APPLIED').length,
    [applications],
  );
  const pendingLogCount = useMemo(
    () => logs.filter((item) => item.status === 'SUBMITTED').length,
    [logs],
  );
  const pendingReviewCount = useMemo(
    () => (reviewTargets ?? []).filter((item) => !item.reviewVerified).length,
    [reviewTargets],
  );
  const totalTasks = pendingApplicationCount + pendingLogCount + pendingReviewCount;

  // 카드는 선택한 행사를 eventId로 넘겨, 이동한 화면에서도 같은 행사의 처리 대기 목록이 열립니다.
  const eventQuery = (extra: Record<string, string> = {}) =>
    new URLSearchParams({
      ...(selectedEventId === null ? {} : { eventId: String(selectedEventId) }),
      ...extra,
    }).toString();
  const queues: QueueConfig[] = [
    {
      step: '01',
      title: '참가신청 승인',
      count: error ? null : pendingApplicationCount,
      to: `/admin/participants?${eventQuery({ status: 'APPLIED' })}`,
    },
    {
      step: '02',
      title: '독서일지 검토',
      // 독서일지 검토 목록은 상태 조건이 없으면 검토 대기(SUBMITTED)를 엽니다.
      count: error ? null : pendingLogCount,
      to: `/admin/logs?${eventQuery()}`,
    },
    {
      step: '03',
      title: '서평 확인',
      // 개별 확인 탭은 상태 조건이 없으면 확인 대기를 엽니다.
      count: error || reviewTargets === null ? null : pendingReviewCount,
      to: `/admin/reviews?${eventQuery({ tab: 'manual' })}`,
    },
  ];

  const renderQueue = (queue: QueueConfig) => {
    const status = isLoading
      ? '건수를 불러오는 중'
      : queue.count === null
        ? '건수를 불러오지 못했습니다'
        : `처리 대기 ${queue.count.toLocaleString('ko-KR')}건`;

    return (
      <Link
        key={queue.step}
        to={queue.to}
        className="admin-operations__queue"
        aria-label={`${queue.step} ${queue.title}, ${status}`}
        aria-busy={isLoading || undefined}
      >
        <span className="admin-operations__queue-head">
          <span className="admin-operations__step">{queue.step}</span>
          <span className="admin-operations__queue-title">{queue.title}</span>
        </span>
        <span className="admin-operations__queue-foot">
          {/* 불러오는 중이나 조회 실패를 0건으로 보이지 않게 합니다. */}
          {isLoading ? (
            <span className="admin-operations__queue-count is-pending">-</span>
          ) : queue.count === null ? (
            <span className="admin-operations__queue-count is-unavailable">
              -<small>불러오지 못함</small>
            </span>
          ) : (
            <span className="admin-operations__queue-count">
              {queue.count.toLocaleString('ko-KR')}
              <small>건</small>
            </span>
          )}
          <span className="admin-operations__queue-arrow" aria-hidden="true">
            →
          </span>
        </span>
      </Link>
    );
  };

  return (
    <section className="admin-page admin-operations">
      <header className="admin-page__header admin-operations__header">
        <div>
          <h1>오늘의 운영 업무</h1>
          <p>처리가 필요한 참가신청·독서일지·서평을 확인할 수 있습니다.</p>
        </div>
        <label className="admin-operations__event-select">
          <span>관리 행사</span>
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
                {isLoading || error || reviewTargets === null ? '-' : totalTasks}
                <small>건</small>
              </strong>
            </div>
          </section>

          <div className="admin-operations__queues">{queues.map(renderQueue)}</div>

          <section className="admin-operations__secondary" aria-labelledby="operationsShortcuts">
            <h2 id="operationsShortcuts">운영 바로가기</h2>
            <nav aria-labelledby="operationsShortcuts">
              {SHORTCUTS.map(({ to, label, icon }) => (
                <Link key={to} to={to}>
                  <svg
                    className="admin-operations__shortcut-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    aria-hidden="true"
                  >
                    <path
                      d={icon}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{label}</span>
                  <svg
                    className="admin-operations__shortcut-chevron"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    aria-hidden="true"
                  >
                    <path
                      d="m4.5 2.5 3.5 3.5-3.5 3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              ))}
            </nav>
          </section>
        </>
      )}
    </section>
  );
}

export default AdminOperationsDashboardPage;
