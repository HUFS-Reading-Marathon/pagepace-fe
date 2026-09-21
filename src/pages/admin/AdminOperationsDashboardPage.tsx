import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminApplications } from '../../api/adminApplicationApi';
import { getApiErrorMessage } from '../../api/apiClient';
import { getAdminEvents } from '../../api/adminEventApi';
import { getAdminReadingLogs } from '../../api/adminReadingLogApi';
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

const QUEUE_PREVIEW_COUNT = 5;

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
  const [applications, setApplications] = useState<AdminApplicationListItem[]>([]);
  const [logs, setLogs] = useState<AdminReadingLogResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminEvents()
      .then((nextEvents) => {
        setEvents(nextEvents);
        setSelectedEventId(chooseEventIdByStatus(nextEvents, EVENT_ORDER));

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
    ])
      .then(([nextApplications, nextLogs]) => {
        if (!isActive) {
          return;
        }

        setApplications(nextApplications);
        setLogs(nextLogs);
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
  const totalTasks = pendingApplications.length + pendingLogs.length;

  return (
    <section className="admin-page admin-operations">
      <header className="admin-page__header admin-operations__header">
        <div>
          <span className="admin-operations__eyebrow">TODAY'S WORK</span>
          <h1>오늘의 운영 업무</h1>
          <p>승인 대기 중인 업무부터 순서대로 처리하세요.</p>
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

          <div className="admin-operations__queues">
            <section className="admin-operations__queue">
              <header>
                <div>
                  <span className="admin-operations__step">01</span>
                  <h2>참가 신청서 검수</h2>
                  <p>오래 기다린 신청부터 확인합니다.</p>
                </div>
                <strong>{isLoading ? '-' : pendingApplications.length}건</strong>
              </header>
              <div className="admin-operations__queue-list">
                {isLoading ? (
                  <p className="admin-operations__queue-message">신청서를 불러오고 있습니다.</p>
                ) : pendingApplications.length === 0 ? (
                  <p className="admin-operations__queue-message is-complete">
                    처리할 참가 신청서가 없습니다.
                  </p>
                ) : (
                  pendingApplications.slice(0, QUEUE_PREVIEW_COUNT).map((item) => (
                    <Link
                      key={item.applicationId}
                      to="/admin/participants"
                      className="admin-operations__queue-row"
                    >
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.studentNo} · {item.courseName}
                        </span>
                      </div>
                      <time>{formatDateTime(item.appliedAt)}</time>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ))
                )}
              </div>
              <Link to="/admin/participants" className="admin-operations__queue-action">
                참가 신청서 검수하기 <span>→</span>
              </Link>
            </section>

            <section className="admin-operations__queue">
              <header>
                <div>
                  <span className="admin-operations__step">02</span>
                  <h2>독서일지 검토</h2>
                  <p>제출 순서대로 내용과 페이지를 확인합니다.</p>
                </div>
                <strong>{isLoading ? '-' : pendingLogs.length}건</strong>
              </header>
              <div className="admin-operations__queue-list">
                {isLoading ? (
                  <p className="admin-operations__queue-message">독서일지를 불러오고 있습니다.</p>
                ) : pendingLogs.length === 0 ? (
                  <p className="admin-operations__queue-message is-complete">
                    검토할 독서일지가 없습니다.
                  </p>
                ) : (
                  pendingLogs.slice(0, QUEUE_PREVIEW_COUNT).map((log) => (
                    <Link
                      key={log.readingLogId}
                      to="/admin/logs"
                      className="admin-operations__queue-row"
                    >
                      <div>
                        <strong>{log.userName}</strong>
                        <span>
                          {log.books.map((book) => book.bookTitle).join(', ')} ·{' '}
                          {log.totalReadPages}쪽
                        </span>
                      </div>
                      <time>{formatDateTime(log.createdAt)}</time>
                      <span aria-hidden="true">→</span>
                    </Link>
                  ))
                )}
              </div>
              <Link to="/admin/logs" className="admin-operations__queue-action">
                독서일지 검토하기 <span>→</span>
              </Link>
            </section>
          </div>

          <section className="admin-operations__secondary">
            <div>
              <h2>그 밖의 운영</h2>
              <p>필요할 때 확인하거나 변경하는 관리 기능입니다.</p>
            </div>
            <nav>
              <Link to="/admin/status">
                <strong>대회 현황 관리</strong>
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
            </nav>
          </section>
        </>
      )}
    </section>
  );
}

export default AdminOperationsDashboardPage;
