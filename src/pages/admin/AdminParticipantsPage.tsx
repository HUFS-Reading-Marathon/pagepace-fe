import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAdminEvents, getAdminEventCourses } from '../../api/adminEventApi';
import { getApiErrorMessage } from '../../api/apiClient';
import {
  getRoster,
  promoteRoster,
  ROSTER_STATUSES,
  rosterStatus,
  rosterKey,
  type RosterRow,
} from '../../api/adminRosterApi';
import { resolveAdminQueueEvent } from '../../utils/adminEvent';
import { selectEvent } from '../../utils/eventSelection';
import type { AdminEvent, AdminCourse } from '../../types/adminEvent';
import { ADMIN_APPLICATION_AFFILIATION_LABELS } from '../../types/adminApplication';
import ParticipantDetailDialog from '../../components/admin/participants/ParticipantDetailDialog';
import ParticipantEditor from '../../components/admin/participants/ParticipantEditor';
import ParticipantFilters from '../../components/admin/participants/ParticipantFilters';
import { EMPTY_FILTERS, matchesRosterRow, type RosterFilters } from '../../utils/participantRoster';
import ParticipantTable from '../../components/admin/participants/ParticipantTable';
import { formatKoDateTime, getLocalDateKey } from '../../utils/date';
import '../../styles/admin-participants.css';

function downloadRows(rows: RosterRow[]) {
  const header = [
    '순번',
    '상태',
    '이름',
    '학번/사번',
    '소속',
    '신분',
    '연락처',
    '이메일',
    '코스',
    '등록일',
  ];
  const values = rows.map((r) => {
    const status = rosterStatus(r);
    return [
      String(r.serialNo),
      status && ROSTER_STATUSES[status],
      r.name,
      r.studentNo,
      r.department,
      ADMIN_APPLICATION_AFFILIATION_LABELS[r.affiliationType],
      r.phone,
      r.email,
      r.courseName,
      formatKoDateTime(r.registeredAt),
    ];
  });
  const csv = [header, ...values]
    .map((row) =>
      row
        .map((value) => {
          let text = value ?? '';
          if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
          return '"' + text.replaceAll('"', '""') + '"';
        })
        .join(','),
    )
    .join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = '독서마라톤_참가자목록_' + getLocalDateKey() + '.csv';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Registry({
  event,
  events,
  onEventChange,
}: {
  event: AdminEvent;
  events: AdminEvent[];
  onEventChange: (id: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [localFilters, setFilters] = useState<RosterFilters>(EMPTY_FILTERS);
  const statusParam = params.get('status') ?? '';
  const filters = useMemo(
    () => ({
      ...localFilters,
      status: Object.hasOwn(ROSTER_STATUSES, statusParam) ? statusParam : '',
    }),
    [localFilters, statusParam],
  );
  const [page, setPage] = useState(1),
    [perPage, setPerPage] = useState(10);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editor, setEditor] = useState<'add' | RosterRow | null>(null);
  const [targetCourse, setTargetCourse] = useState('');
  const [promoting, setPromoting] = useState(false);
  useEffect(() => {
    let current = true;
    Promise.all([getRoster(event.eventId), getAdminEventCourses(event.eventId)])
      .then(([entries, options]) => {
        if (current) {
          setRows(entries);
          setCourses(options);
          setLoadError('');
        }
      })
      .catch((error) => {
        if (current) setLoadError(getApiErrorMessage(error, '참가자 명단을 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [event.eventId, refresh]);

  const filtered = useMemo(() => rows.filter((r) => matchesRosterRow(r, filters)), [rows, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);
  const firstPage = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, i) => firstPage + i);
  const checked = filtered.filter((r) => selected.has(rosterKey(r)));
  const activeEvent = ['APPLICATION_OPEN', 'APPLICATION_CLOSED', 'IN_PROGRESS'].includes(
    event.status,
  );
  const writable = !['FINALIZED', 'ARCHIVED'].includes(event.status);
  const canEdit = (row: RosterRow) =>
    writable &&
    (['APPROVED', 'COMPLETED'].includes(row.participationStatus ?? '') ||
      (!row.participationId && row.applicationStatus === 'APPLIED'));
  const higherCourses =
    checked.length && activeEvent && checked.every((r) => r.participationId && canEdit(r))
      ? courses.filter(
          (c) =>
            c.active !== false &&
            checked.every((r) => {
              const original = courses.find((course) => course.courseId === r.courseId);
              return original && c.targetDistanceMeter > original.targetDistanceMeter;
            }),
        )
      : [];
  const linkedApp = params.get('applicationId'),
    linkedParticipation = params.get('participationId');
  const detail = linkedApp
    ? rows.find((r) => String(r.applicationId) === linkedApp)
    : linkedParticipation
      ? rows.find((r) => String(r.participationId) === linkedParticipation)
      : undefined;
  const detailIndex = detail ? filtered.indexOf(detail) : -1;
  const setDetail = (row: RosterRow | null) => {
    const next = new URLSearchParams(params);
    next.delete('applicationId');
    next.delete('participationId');
    if (row) {
      next.set('eventId', String(event.eventId));
      if (row.applicationId) next.set('applicationId', String(row.applicationId));
      else if (row.participationId) next.set('participationId', String(row.participationId));
    }
    setParams(next, { replace: true });
  };
  const clearSelection = () => {
    setSelected(new Set());
    setTargetCourse('');
    setActionError('');
  };
  const changeFilters = (next: RosterFilters) => {
    setFilters(next);
    setPage(1);
    clearSelection();
    setMessage('');
    if (statusParam !== next.status) {
      const copy = new URLSearchParams(params);
      if (next.status) copy.set('status', next.status);
      else copy.delete('status');
      setParams(copy, { replace: true });
    }
  };
  const toggle = (ids: number[], checked: boolean) => {
    setSelected((old) => {
      const next = new Set(old);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setTargetCourse('');
    setActionError('');
    setMessage('');
  };
  const saved = (text: string) => {
    const added = editor === 'add';
    setEditor(null);
    const next = new URLSearchParams(params);
    next.delete('applicationId');
    next.delete('participationId');
    if (added) next.delete('status');
    setParams(next, { replace: true });
    clearSelection();
    setMessage(text);
    setLoading(true);
    setRefresh((n) => n + 1);
    if (added) {
      setFilters(EMPTY_FILTERS);
      setPage(1);
    }
  };
  const promote = async () => {
    const course = higherCourses.find((c) => String(c.courseId) === targetCourse);
    if (!course || promoting) return;
    setPromoting(true);
    setActionError('');
    try {
      await promoteRoster(
        event.eventId,
        checked.map((r) => r.participationId!),
        course.courseId,
      );
      saved(checked.length + '명의 코스를 ' + course.name + '로 변경했습니다.');
    } catch (error) {
      setActionError(getApiErrorMessage(error, '코스를 변경하지 못했습니다.'));
    } finally {
      setPromoting(false);
    }
  };
  const ready = !loading && !loadError;
  return (
    <section className="admin-page participant-registry">
      <header className="roster-heading">
        <h1>참가자 관리</h1>
        <div className="roster-heading-actions">
          <label>
            관리 행사
            <select
              aria-label="관리 행사"
              value={event.eventId}
              disabled={promoting}
              onChange={(e) => onEventChange(e.target.value)}
            >
              {events.map((e) => (
                <option key={e.eventId} value={e.eventId}>
                  {e.title}
                </option>
              ))}
            </select>
          </label>
          <button
            className="roster-btn roster-primary"
            type="button"
            disabled={!activeEvent || !ready || promoting}
            onClick={() => setEditor('add')}
          >
            참가자 추가
          </button>
        </div>
      </header>
      {message && (
        <p className="roster-feedback" role="status">
          {message}
        </p>
      )}
      {(actionError || loadError) && (
        <div className="roster-error" role="alert">
          {actionError || loadError}
          {loadError && (
            <button
              type="button"
              className="roster-link"
              onClick={() => {
                setLoading(true);
                setRefresh((n) => n + 1);
              }}
            >
              다시 불러오기
            </button>
          )}
        </div>
      )}
      {ready && (linkedApp || linkedParticipation) && !detail && (
        <p className="roster-error" role="alert">
          이 행사에서 지정한 참가 기록을 찾을 수 없습니다.
        </p>
      )}
      <section className="roster-sheet" aria-label="참가자 목록">
        <div className="roster-tools">
          <div className="roster-actions" aria-live="polite">
            {checked.length ? (
              <>
                <strong>{checked.length}명 선택</strong>
                {checked.length === 1 && (
                  <button
                    className="roster-btn"
                    type="button"
                    disabled={!ready || promoting}
                    onClick={() =>
                      canEdit(checked[0]) ? setEditor(checked[0]) : setDetail(checked[0])
                    }
                  >
                    {canEdit(checked[0]) ? '선택 수정' : '상세 보기'}
                  </button>
                )}
                {checked.length > 1 &&
                  (higherCourses.length ? (
                    <>
                      <select
                        aria-label="변경할 코스"
                        value={targetCourse}
                        disabled={promoting}
                        onChange={(e) => setTargetCourse(e.target.value)}
                      >
                        <option value="">승급할 코스 선택</option>
                        {higherCourses.map((c) => (
                          <option value={c.courseId} key={c.courseId}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="roster-btn"
                        disabled={!ready || !targetCourse || promoting}
                        onClick={() => void promote()}
                      >
                        코스 변경
                      </button>
                    </>
                  ) : (
                    <span className="roster-note">함께 승급할 수 있는 코스가 없습니다.</span>
                  ))}
                <button
                  type="button"
                  className="roster-link"
                  disabled={promoting}
                  onClick={clearSelection}
                >
                  선택 해제
                </button>
              </>
            ) : (
              <strong>전체 {rows.length.toLocaleString()}명</strong>
            )}
          </div>
          <button
            type="button"
            className="roster-link"
            onClick={() => downloadRows(filtered)}
            disabled={!ready || !filtered.length}
          >
            목록 다운로드
          </button>
        </div>
        <fieldset className="roster-fieldset" disabled={promoting}>
          <ParticipantFilters filters={filters} courses={courses} onChange={changeFilters} />
        </fieldset>
        <ParticipantTable
          rows={visible}
          selected={selected}
          onSelect={toggle}
          onOpen={setDetail}
          busy={!ready || promoting}
          message={
            loading
              ? '명단을 불러오는 중입니다.'
              : loadError
                ? '명단을 불러오지 못했습니다.'
                : !filtered.length
                  ? rows.length
                    ? '조건에 맞는 참가자가 없습니다.'
                    : '등록된 참가자가 없습니다.'
                  : ''
          }
        />
        <footer className="roster-footer">
          <span aria-live="polite">
            {filtered.length ? start + 1 + '–' + Math.min(start + perPage, filtered.length) : '0'} /{' '}
            {filtered.length}명
          </span>
          <nav className="roster-pagination" aria-label="참가자 명단 페이지">
            <button
              aria-label="이전 페이지"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              이전
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                aria-label={n + '페이지'}
                aria-current={currentPage === n ? 'page' : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              aria-label="다음 페이지"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              다음
            </button>
          </nav>
          <select
            aria-label="페이지당 행 수"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}명씩 보기
              </option>
            ))}
          </select>
        </footer>
      </section>
      {detail && !editor && (
        <ParticipantDetailDialog
          key={rosterKey(detail)}
          eventTitle={event.title}
          row={detail}
          editable={canEdit(detail)}
          onClose={() => setDetail(null)}
          onEdit={() => setEditor(detail)}
          previous={detailIndex > 0 ? () => setDetail(filtered[detailIndex - 1]) : undefined}
          next={
            detailIndex >= 0 && detailIndex + 1 < filtered.length
              ? () => setDetail(filtered[detailIndex + 1])
              : undefined
          }
          onSaved={saved}
        />
      )}
      {editor && (
        <ParticipantEditor
          key={editor === 'add' ? 'add' : rosterKey(editor)}
          eventId={event.eventId}
          courses={courses}
          registeredStudentNos={rows.map((r) => r.studentNo)}
          courseChangesAllowed={activeEvent}
          participant={editor === 'add' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
    </section>
  );
}

export default function AdminParticipantsPage() {
  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    getAdminEvents()
      .then((data) => {
        if (current) setEvents(data);
      })
      .catch((e) => {
        if (current) setError(getApiErrorMessage(e, '행사를 불러오지 못했습니다.'));
      });
    return () => {
      current = false;
    };
  }, []);
  const event = events && resolveAdminQueueEvent(events, params.get('eventId'));
  useEffect(() => {
    if (event) selectEvent('admin', event.eventId);
  }, [event]);
  if (!event)
    return (
      <section className="admin-page participant-registry">
        <header className="roster-heading">
          <h1>참가자 관리</h1>
        </header>
        <p role={error ? 'alert' : 'status'}>
          {error || (events ? '조회할 수 있는 행사가 없습니다.' : '행사를 불러오는 중입니다.')}
        </p>
        {events?.length ? (
          <button
            className="roster-btn"
            onClick={() => setParams({ eventId: String(events[0].eventId) })}
          >
            행사 선택
          </button>
        ) : null}
      </section>
    );
  return (
    <Registry
      key={event.eventId}
      event={event}
      events={events}
      onEventChange={(id) => setParams({ eventId: id })}
    />
  );
}
