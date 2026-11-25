import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getAdminEvents } from '../../api/adminEventApi';
import { downloadExcel, getApiErrorMessage } from '../../api/apiClient';
import { useAdminEventState } from '../../hooks/useAdminEventState';
import type { AdminEvent } from '../../types/adminEvent';
import { preferredAdminEvent } from '../../utils/eventSelection';
import {
  INVALID_UPLOAD_MESSAGE,
  REPORT_TITLES,
  formatReportDate,
  isAcceptableReviewFile,
  reportErrorMessage,
  reportFileName,
  reportSuccessFeedback,
  type ContestReport,
  type ReportFeedback,
} from './contestReportFeedback';
import './contest-reports.css';

type Feedbacks = Partial<Record<ContestReport, ReportFeedback>>;

const PROGRESS_TEXT = '엑셀 파일을 만들고 있습니다. 기록이 많으면 시간이 조금 걸릴 수 있습니다.';

function FeedbackIcon({ tone }: { tone: ReportFeedback['tone'] }) {
  if (tone === 'progress') return <span className="contest-reports__spinner" aria-hidden="true" />;
  const path = tone === 'success' ? 'm4.75 8.25 2.25 2.25 4.25-4.75' : 'M8 5v3.75M8 11.25h.01';
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      {tone === 'warning' ? (
        <path
          d="M8 1.75 14.75 13.5H1.25Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      ) : (
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 오류는 즉시 읽히도록 alert, 나머지는 status로 알립니다. */
function Feedback({ feedback }: { feedback: ReportFeedback }) {
  return (
    <p
      className={`contest-reports__feedback contest-reports__feedback--${feedback.tone}`}
      role={feedback.tone === 'error' ? 'alert' : 'status'}
    >
      <FeedbackIcon tone={feedback.tone} />
      <span>{feedback.text}</span>
    </p>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 2.5v7.25M4.75 6.75 8 10l3.25-3.25M3 13.25h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReportCard({
  report,
  description,
  feedback,
  inlineAction,
  action,
  children,
}: {
  report: ContestReport;
  description: string;
  feedback?: ReportFeedback;
  /** 입력 항목이 없는 보고서는 버튼을 설명 옆에 둡니다. */
  inlineAction?: boolean;
  action: ReactNode;
  children?: ReactNode;
}) {
  const titleId = `contest-report-${report}-title`;
  return (
    <section
      className={`contest-reports__card${inlineAction ? ' contest-reports__card--inline' : ''}`}
      aria-labelledby={titleId}
    >
      <div className="contest-reports__intro">
        <h2 id={titleId}>{REPORT_TITLES[report]}</h2>
        <p>{description}</p>
      </div>
      {children && <div className="contest-reports__controls">{children}</div>}
      <div className="contest-reports__action">{action}</div>
      {feedback && <Feedback feedback={feedback} />}
    </section>
  );
}

export default function AdminContestReportsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useAdminEventState();
  const [scope, setScope] = useState('PARTICIPANTS');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<ContestReport | null>(null);
  const [pageNotice, setPageNotice] = useState<ReportFeedback | null>(null);
  // 피드백은 보고서별로, 어느 행사에서 생긴 것인지와 함께 둡니다. 다른 행사로 바꾸면 보이지 않습니다.
  const [feedback, setFeedback] = useState<{ eventId: number | null; items: Feedbacks }>({
    eventId: null,
    items: {},
  });
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const event = events.find((item) => item.eventId === eventId);
  const visibleFeedback = feedback.eventId === eventId ? feedback.items : {};

  useEffect(() => {
    let active = true;
    getAdminEvents()
      .then((list) => {
        if (active) {
          setEvents(list);
          setEventId(preferredAdminEvent(list)?.eventId ?? null);
          if (!list.length)
            setPageNotice({ tone: 'warning', text: '결과를 조회할 행사가 없습니다.' });
        }
      })
      .catch((e) => {
        if (active) {
          setPageNotice({
            tone: 'error',
            text: getApiErrorMessage(e, '행사를 불러오지 못했습니다. 다시 시도해 주세요.'),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [setEventId]);

  const showFeedback = (forEvent: number, report: ContestReport, next: ReportFeedback | null) => {
    setFeedback((current) => {
      const items = current.eventId === forEvent ? { ...current.items } : {};
      if (next) items[report] = next;
      else delete items[report];
      return { eventId: forEvent, items };
    });
  };

  const clearFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const download = async (report: ContestReport) => {
    if (!event || lock.current || (report === 'journals' && !file)) return;
    // 요청을 보낸 시점의 행사로 파일 이름과 피드백을 정합니다.
    const target = event;
    lock.current = true;
    setBusy(report);
    showFeedback(target.eventId, report, { tone: 'progress', text: PROGRESS_TEXT });
    try {
      const path = `/api/admin/reports/${target.eventId}/${report}`;
      let body: FormData | undefined;
      if (report === 'journals' && file) {
        body = new FormData();
        body.append('file', file);
      }
      const result = await downloadExcel(
        report === 'participants' ? `${path}?scope=${scope}` : path,
        body ? { method: 'POST', body } : {},
      );
      const url = URL.createObjectURL(result.file);
      const link = document.createElement('a');
      link.href = url;
      link.download = reportFileName(target.roundNo, report);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showFeedback(
        target.eventId,
        report,
        reportSuccessFeedback(report, result.missingCallNumbers),
      );
    } catch (e) {
      showFeedback(target.eventId, report, { tone: 'error', text: reportErrorMessage(e) });
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const button = (report: ContestReport) => (
    <button
      type="button"
      className="admin-button admin-button--primary contest-reports__download"
      aria-label={`${REPORT_TITLES[report]} 엑셀 다운로드`}
      aria-busy={busy === report}
      disabled={!event || busy !== null || (report === 'journals' && !file)}
      onClick={() => void download(report)}
    >
      {busy === report ? (
        <span className="contest-reports__spinner" aria-hidden="true" />
      ) : (
        <DownloadIcon />
      )}
      {busy === report ? '파일 생성 중…' : '엑셀 다운로드'}
    </button>
  );

  return (
    <section className="admin-page contest-reports">
      <header className="admin-page__header contest-reports__header">
        <div>
          <h1>결과 보고서</h1>
          <p>회차를 선택해 결과보고 양식별 엑셀 파일을 내려받으세요.</p>
        </div>
        <label className="contest-reports__event">
          <span>관리 행사</span>
          <select
            value={eventId ?? ''}
            disabled={busy !== null || !events.length}
            onChange={(e) => {
              clearFile();
              setFeedback({ eventId: null, items: {} });
              setEventId(Number(e.target.value));
            }}
          >
            {!events.length && <option value="">행사 없음</option>}
            {events.map((item) => (
              <option key={item.eventId} value={item.eventId}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </header>

      {pageNotice && (
        <div className="contest-reports__page-notice">
          <Feedback feedback={pageNotice} />
        </div>
      )}

      <div className="contest-reports__list">
        <ReportCard
          report="participants"
          description="이름, 학번·사번, 소속, 학년, 연락처, 이메일과 성별을 신청자 명단 양식으로 정리합니다."
          feedback={visibleFeedback.participants}
          action={button('participants')}
        >
          <label className="contest-reports__field">
            <span>명단 범위</span>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={busy !== null}
            >
              <option value="PARTICIPANTS">승인·완주 참가자</option>
              <option value="APPLICANTS">전체 신청자 (철회 제외)</option>
            </select>
          </label>
        </ReportCard>

        <ReportCard
          report="books"
          inlineAction
          description="승인된 일지의 도서를 판본별로 한 번씩 청구기호 순으로 정리합니다. 책 제목을 누르면 한국외대 도서관 상세 페이지가 열리며, 청구기호를 확인하지 못한 도서는 목록 마지막에 둡니다."
          feedback={visibleFeedback.books}
          action={button('books')}
        />

        <ReportCard
          report="journals"
          description="솔라스에서 내려받은 서평 엑셀을 승인된 일지와 대조합니다. 파일 생성은 참가자의 인정 거리나 서평 확인 상태를 바꾸지 않습니다."
          feedback={visibleFeedback.journals}
          action={button('journals')}
        >
          <p className="contest-reports__period">
            <span>솔라스 추출 기간</span>
            <strong>
              {event
                ? `${formatReportDate(event.eventStartDate)} ~ ${formatReportDate(event.eventEndDate)}`
                : '행사를 선택해 주세요'}
            </strong>
          </p>
          <div className="contest-reports__upload">
            <span id="contestReportFileLabel" className="contest-reports__label">
              전체 기간 솔라스 서평 엑셀
            </span>
            <div className="contest-reports__file">
              <input
                ref={fileInput}
                id="contestReportFile"
                className="contest-reports__file-input"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-labelledby="contestReportFileLabel"
                aria-describedby="contestReportFileName contestReportFileHint"
                disabled={busy !== null || !event}
                onChange={(e) => {
                  const next = e.target.files?.[0] ?? null;
                  if (next && !isAcceptableReviewFile(next)) {
                    clearFile();
                    if (event) {
                      showFeedback(event.eventId, 'journals', {
                        tone: 'error',
                        text: INVALID_UPLOAD_MESSAGE,
                      });
                    }
                    return;
                  }
                  // 파일만 골라 둡니다. 서버 요청은 엑셀 다운로드 버튼을 눌렀을 때만 보냅니다.
                  setFile(next);
                  if (event) showFeedback(event.eventId, 'journals', null);
                }}
              />
              <label
                htmlFor="contestReportFile"
                className="admin-button contest-reports__file-button"
                aria-hidden="true"
              >
                {file ? '파일 변경' : '파일 선택'}
              </label>
              <span
                id="contestReportFileName"
                className={`contest-reports__file-name${file ? '' : ' contest-reports__file-name--empty'}`}
                title={file?.name}
              >
                {file ? file.name : '선택된 파일 없음'}
              </span>
              {file && (
                <button
                  type="button"
                  className="contest-reports__file-clear"
                  aria-label={`선택한 파일 ${file.name} 지우기`}
                  disabled={busy !== null}
                  onClick={() => {
                    clearFile();
                    fileInput.current?.focus();
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="m4.5 4.5 7 7m0-7-7 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              )}
            </div>
            <small id="contestReportFileHint">
              .xlsx 파일, 최대 20MB · 파일을 고른 뒤 엑셀 다운로드를 눌러야 서버로 보냅니다.
            </small>
          </div>
        </ReportCard>
      </div>
    </section>
  );
}
