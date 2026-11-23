import { useEffect, useRef, useState } from 'react';
import { getAdminEvents } from '../../api/adminEventApi';
import { downloadExcel, getApiErrorMessage } from '../../api/apiClient';
import { useAdminEventState } from '../../hooks/useAdminEventState';
import type { AdminEvent } from '../../types/adminEvent';
import { preferredAdminEvent } from '../../utils/eventSelection';
import './contest-reports.css';

const REPORT_NAMES = { participants: '참가자현황', books: '도서목록', journals: '일지+서평' };
type Report = keyof typeof REPORT_NAMES;

export default function AdminContestReportsPage() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useAdminEventState();
  const [scope, setScope] = useState('PARTICIPANTS');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<Report | null>(null);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const event = events.find((item) => item.eventId === eventId);

  useEffect(() => {
    let active = true;
    getAdminEvents()
      .then((list) => {
        if (active) {
          setEvents(list);
          setEventId(preferredAdminEvent(list)?.eventId ?? null);
          if (!list.length) setMessage('결과를 조회할 행사가 없습니다.');
        }
      })
      .catch((e) => {
        if (active) setMessage(getApiErrorMessage(e, '행사를 불러오지 못했습니다.'));
      });
    return () => {
      active = false;
    };
  }, [setEventId]);

  const download = async (report: Report) => {
    if (!event || lock.current || (report === 'journals' && !file)) return;
    lock.current = true;
    setBusy(report);
    setMessage('');
    try {
      const path = `/api/admin/reports/${event.eventId}/${report}`;
      let body: FormData | undefined;
      if (report === 'journals' && file) {
        body = new FormData();
        body.append('file', file);
      }
      const blob = await downloadExcel(
        report === 'participants' ? `${path}?scope=${scope}` : path,
        body ? { method: 'POST', body } : {},
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `제${event.roundNo}회_${REPORT_NAMES[report]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`${REPORT_NAMES[report]} 파일을 내려받았습니다.`);
    } catch (e) {
      setMessage(getApiErrorMessage(e, '파일을 내려받지 못했습니다. 다시 시도해 주세요.'));
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const button = (report: Report) => (
    <button
      type="button"
      className="admin-button admin-button--primary"
      disabled={!event || busy !== null || (report === 'journals' && !file)}
      onClick={() => void download(report)}
    >
      {busy === report ? '파일 생성 중…' : `${REPORT_NAMES[report]} 다운로드`}
    </button>
  );

  return (
    <section className="admin-page contest-reports">
      <header className="admin-page__header">
        <div>
          <h1>결과 보고서</h1>
          <p>회차를 선택해 결과보고 양식별 엑셀 파일을 내려받으세요.</p>
        </div>
        <label className="contest-reports__field">
          관리 행사
          <select
            value={eventId ?? ''}
            disabled={busy !== null || !events.length}
            onChange={(e) => {
              setFile(null);
              setMessage('');
              setEventId(Number(e.target.value));
            }}
          >
            {events.map((item) => (
              <option key={item.eventId} value={item.eventId}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </header>
      {message && <p role="status">{message}</p>}
      <section className="contest-reports__card">
        <div>
          <h2>참가자 현황</h2>
          <p>
            이름, 학번·사번, 소속, 학년, 연락처, 이메일과 성별을 신청자 명단 양식으로 정리합니다.
          </p>
          <label className="contest-reports__field">
            명단 범위
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={busy !== null}
            >
              <option value="PARTICIPANTS">승인·완주 참가자</option>
              <option value="APPLICANTS">전체 신청자 (철회 제외)</option>
            </select>
          </label>
        </div>
        {button('participants')}
      </section>
      <section className="contest-reports__card">
        <div>
          <h2>도서 목록</h2>
          <p>
            승인된 일지의 도서를 판본별로 한 번씩 청구기호 순으로 정리합니다. 책 제목을 누르면
            한국외대 도서관 상세 페이지가 열립니다.
          </p>
        </div>
        {button('books')}
      </section>
      <section className="contest-reports__card">
        <div>
          <h2>일지 + 서평</h2>
          <p>
            솔라스에서{' '}
            {event ? `${event.eventStartDate} ~ ${event.eventEndDate}` : '대회 전체 기간'}으로
            추출한 서평 엑셀을 선택하세요. 승인된 일지와 원문을 대조하며, 파일 생성은 참가자의 인정
            거리를 바꾸지 않습니다.
          </p>
          <label className="contest-reports__field">
            전체 기간 솔라스 엑셀 (.xlsx, 최대 20MB)
            <input
              key={eventId}
              type="file"
              accept=".xlsx"
              disabled={busy !== null || !event}
              onChange={(e) => {
                const next = e.target.files?.[0] ?? null;
                if (
                  next &&
                  (!next.name.toLowerCase().endsWith('.xlsx') || next.size > 20 * 1024 * 1024)
                ) {
                  e.target.value = '';
                  setFile(null);
                  setMessage('20MB 이하의 .xlsx 파일을 선택해 주세요.');
                } else {
                  setFile(next);
                  setMessage('');
                }
              }}
            />
          </label>
        </div>
        {button('journals')}
      </section>
    </section>
  );
}
