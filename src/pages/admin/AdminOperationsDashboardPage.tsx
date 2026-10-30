import { preferredAdminEvent } from "../../utils/eventSelection";
import { useAdminEventState } from "../../hooks/useAdminEventState";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAdminApplications } from "../../api/adminApplicationApi";
import { ApiError } from "../../api/apiClient";
import { getAdminEvents } from "../../api/adminEventApi";
import {
  getAdminReviewTargets,
  type AdminReviewTarget,
  getAdminReadingLogs,
} from "../../api/adminReadingLogApi";
import type { AdminApplicationListItem } from "../../types/adminApplication";
import type { AdminEvent, EventStatus } from "../../types/adminEvent";
import type { AdminReadingLogResponse } from "../../types/adminReadingLogApi";
import "../../styles/admin-operations.css";

const EVENT_ORDER: EventStatus[] = [
  "IN_PROGRESS",
  "APPLICATION_OPEN",
  "APPLICATION_CLOSED",
  "READY",
  "DRAFT",
  "ENDED",
  "FINALIZED",
  "ARCHIVED",
];
const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: "작성 중",
  READY: "준비",
  APPLICATION_OPEN: "신청 접수 중",
  APPLICATION_CLOSED: "신청 마감",
  IN_PROGRESS: "진행 중",
  ENDED: "종료",
  FINALIZED: "최종 확정",
  ARCHIVED: "보관",
};

function chooseEvent(events: AdminEvent[]) {
  const remembered = preferredAdminEvent(events);
  if (remembered) return remembered;
  for (const status of EVENT_ORDER) {
    const event = events.find((item) => item.status === status);
    if (event) return event;
  }
  return events[0] ?? null;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function AdminOperationsDashboardPage() {
  const [queueFilter, setQueueFilter] = useState("전체");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useAdminEventState();
  const [applications, setApplications] = useState<AdminApplicationListItem[]>(
    [],
  );
  const [reviews, setReviews] = useState<AdminReviewTarget[]>([]);
  const [logs, setLogs] = useState<AdminReadingLogResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminEvents()
      .then((nextEvents) => {
        setEvents(nextEvents);
        setSelectedEventId(chooseEvent(nextEvents)?.eventId ?? null);
        if (nextEvents.length === 0) setIsLoading(false);
      })
      .catch((requestError: unknown) => {
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "행사 목록을 불러오지 못했습니다.",
        );
        setIsLoading(false);
      });
  }, [setSelectedEventId]);

  useEffect(() => {
    if (selectedEventId === null) return;
    let isActive = true;
    Promise.all([
      getAdminApplications(selectedEventId),
      getAdminReadingLogs({ eventId: selectedEventId }),
      getAdminReviewTargets(selectedEventId),
    ])
      .then(([nextApplications, nextLogs, nextReviews]) => {
        if (!isActive) return;
        setApplications(nextApplications);
        setLogs(nextLogs);
        setReviews(nextReviews);
        setError("");
      })
      .catch((requestError: unknown) => {
        if (!isActive) return;
        setError(
          requestError instanceof ApiError
            ? requestError.message
            : "운영 현황을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [selectedEventId]);

  const selectedEvent =
    events.find((event) => event.eventId === selectedEventId) ?? null;
  const pendingApplications = useMemo(
    () =>
      applications
        .filter((item) => item.status === "APPLIED")
        .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt)),
    [applications],
  );
  const pendingLogs = useMemo(
    () =>
      logs
        .filter((item) => item.status === "SUBMITTED")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [logs],
  );
  const totalTasks =
    pendingApplications.length + pendingLogs.length + reviews.length;

  const queue = [
    ...pendingApplications.map(item => ({id: `application-${item.applicationId}`, kind: "참가 신청", name: item.name, detail: item.courseName, date: item.appliedAt, href: "/admin/participants", action: "신청 검토"})),
    ...pendingLogs.map(item => ({id: `log-${item.readingLogId}`, kind: "독서일지", name: item.userName, detail: `${item.books.map(book => book.bookTitle).join(", ")} · ${item.totalReadPages}쪽`, date: item.createdAt, href: "/admin/logs", action: "일지 검토"})),
    ...reviews.map(item => ({id: `review-${item.participantBookId}`, kind: "서평", name: item.userName, detail: item.bookTitle, date: item.reviewSubmittedAt, href: "/admin/reviews", action: "서평 확인"})),
  ].sort((a,b) => a.date.localeCompare(b.date));
  const filteredQueue = queue.filter(item => queueFilter === "전체" || item.kind === queueFilter);
  return (
    <section className="admin-page admin-operations">
      <header className="admin-page__header admin-operations__header">
        <div><h1>운영 현황</h1><p>참가 신청, 독서일지와 서평의 처리 현황을 확인합니다.</p></div>
        <label className="admin-operations__event-select"><span>행사</span>
          <select value={selectedEventId ?? ""} onChange={event => {setIsLoading(true); setSelectedEventId(Number(event.target.value));}}>
            {events.map(event => <option key={event.eventId} value={event.eventId}>{event.title}</option>)}
          </select>
        </label>
      </header>
      {error && <div className="admin-operations__error" role="alert">{error}</div>}
      {!isLoading && !selectedEvent ? <div className="admin-operations__empty">등록된 행사가 없습니다. <Link to="/admin/event">행사 등록</Link></div> : <>
        <div className="ops-summary" aria-label="처리 대기 현황">
          {[{title:"참가 신청",count:pendingApplications.length,href:"/admin/participants",hint:"신청 정보 검토"},{title:"독서일지",count:pendingLogs.length,href:"/admin/logs",hint:"독서량 승인"},{title:"서평",count:reviews.length,href:"/admin/reviews",hint:"작성 기록 확인"}].map(item =>
            <Link key={item.title} to={item.href} className="ops-summary__item"><span>{item.title} 대기</span><strong>{isLoading ? "—" : item.count}<small>건</small></strong><span>{item.hint}<b aria-hidden="true">↗</b></span></Link>)}
        </div>
        <div className="ops-workspace">
          <section className="console-panel">
            <div className="console-panel__heading"><h2>처리 대기 목록</h2><span>전체 {isLoading ? "—" : totalTasks}건 · 접수순</span></div>
            <div className="ux-tabs" aria-label="처리 유형">
              {["전체","참가 신청","독서일지","서평"].map(kind => <button key={kind} aria-pressed={kind === queueFilter} className={kind === queueFilter ? "active" : ""} onClick={() => setQueueFilter(kind)}>{kind}</button>)}
            </div>
            {isLoading ? <p className="console-empty" role="status">처리 목록을 불러오고 있습니다.</p> : filteredQueue.length ? <div className="table-scroll"><table className="console-table"><thead><tr><th>구분</th><th>참가자</th><th>내용</th><th>접수일</th><th>처리</th></tr></thead><tbody>
              {filteredQueue.slice(0,15).map(item => <tr key={item.id}><td><span className="console-badge">{item.kind}</span></td><th scope="row">{item.name}</th><td>{item.detail}</td><td><time>{formatDateTime(item.date)}</time></td><td><Link className="console-link-button" to={item.href}>{item.action}</Link></td></tr>)}
            </tbody></table></div> : <p className="console-empty">처리 대기 항목이 없습니다.</p>}
            {filteredQueue.length > 15 && <p className="console-footnote">접수순 15건을 표시합니다. 전체 목록은 각 관리 화면에서 확인할 수 있습니다.</p>}
          </section>
          <aside className="ops-context">
            <section className="console-panel"><div className="console-panel__heading"><h2>행사 정보</h2></div><div className="console-panel__body">
              <span className="console-badge">{selectedEvent ? EVENT_STATUS_LABEL[selectedEvent.status] : "불러오는 중"}</span><h3>{selectedEvent?.title}</h3>
              <dl className="ops-dates"><dt>독서일지 접수기간</dt><dd>{selectedEvent?.eventStartDate}<br/>~ {selectedEvent?.eventEndDate}</dd></dl>
              <Link className="console-link-button" to="/admin/event">행사·코스 설정</Link>
            </div></section>
            <section className="console-panel"><div className="console-panel__heading"><h2>관리 메뉴</h2></div><nav className="ops-shortcuts"><Link to="/admin/participants">참가자 관리 <span>→</span></Link><Link to="/admin/notices">공지사항 관리 <span>→</span></Link><Link to="/admin/statistics">운영 통계 <span>→</span></Link></nav></section>
          </aside>
        </div>
      </>}
    </section>
  );
}

export default AdminOperationsDashboardPage;
