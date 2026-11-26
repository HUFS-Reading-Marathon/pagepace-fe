import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAdminEvents, getAdminEventCourses } from '../../api/adminEventApi';
import { getApiErrorMessage } from '../../api/apiClient';
import {
  getRoster,
  downloadRoster,
  ROSTER_STATUSES,
  rosterKey,
  type RosterRow,
} from '../../api/adminRosterApi';
import { resolveAdminQueueEvent } from '../../utils/adminEvent';
import { selectEvent } from '../../utils/eventSelection';
import type { AdminEvent, AdminCourse } from '../../types/adminEvent';
import ParticipantDetailDialog from '../../components/admin/participants/ParticipantDetailDialog';
import ParticipantEditor from '../../components/admin/participants/ParticipantEditor';
import ParticipantFilters from '../../components/admin/participants/ParticipantFilters';
import {
  DEFAULT_FILTERS,
  DEFAULT_SORT,
  sortedRoster,
  type RosterFilters,
  type RosterSort,
} from '../../utils/participantRoster';
import ParticipantTable from '../../components/admin/participants/ParticipantTable';
import { getLocalDateKey } from '../../utils/date';
import '../../styles/admin-participants.css';

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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [localFilters, setFilters] = useState<RosterFilters>(DEFAULT_FILTERS);
  const statusParam = params.get('status') ?? DEFAULT_FILTERS.status;
  const filters = useMemo(
    () => ({
      ...localFilters,
      status:
        statusParam === 'ALL'
          ? ''
          : Object.hasOwn(ROSTER_STATUSES, statusParam)
            ? statusParam
            : DEFAULT_FILTERS.status,
    }),
    [localFilters, statusParam],
  );
  const [page, setPage] = useState(1),
    [perPage, setPerPage] = useState(10);
  const [selected, setSelected] = useState<number | null>(null);
  const [sort, setSort] = useState<RosterSort>(DEFAULT_SORT);
  const [editor, setEditor] = useState<'add' | RosterRow | null>(null);
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let current = true;
    Promise.all([getRoster(event.eventId), getAdminEventCourses(event.eventId)])
      .then(([entries, options]) => {
        if (current) {
          setRows(entries);
          setHasLoaded(true);
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

  const filtered = useMemo(() => sortedRoster(rows, filters, sort), [rows, filters, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * perPage;
  const visible = filtered.slice(start, start + perPage);
  const firstPage = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(5, pageCount) }, (_, i) => firstPage + i);
  const checked = filtered.find((r) => rosterKey(r) === selected);
  const activeEvent = ['APPLICATION_OPEN', 'APPLICATION_CLOSED', 'IN_PROGRESS'].includes(
    event.status,
  );
  const writable = !['FINALIZED', 'ARCHIVED'].includes(event.status);
  const canEdit = (row: RosterRow) =>
    writable &&
    (['APPROVED', 'COMPLETED'].includes(row.participationStatus ?? '') ||
      (!row.participationId && row.applicationStatus === 'APPLIED'));
  const linkedApp = params.get('applicationId'),
    linkedParticipation = params.get('participationId');
  const detail = linkedApp
    ? rows.find((r) => String(r.applicationId) === linkedApp)
    : linkedParticipation
      ? rows.find((r) => String(r.participationId) === linkedParticipation)
      : undefined;
  const detailIndex = detail
    ? filtered.findIndex((row) => rosterKey(row) === rosterKey(detail))
    : -1;
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
    setSelected(null);
    setActionError('');
  };
  const changeFilters = (next: RosterFilters) => {
    setFilters(next);
    setPage(1);
    clearSelection();
    setMessage('');
    if (filters.status !== next.status) {
      const copy = new URLSearchParams(params);
      if (next.status === DEFAULT_FILTERS.status) copy.delete('status');
      else copy.set('status', next.status || 'ALL');
      setParams(copy, { replace: true });
    }
  };
  const changeSort = (column: RosterSort['column']) => {
    setSort((previous) => ({
      column,
      direction:
        previous.column === column && previous.direction === 'ascending'
          ? 'descending'
          : 'ascending',
    }));
    setPage(1);
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
      setFilters(DEFAULT_FILTERS);
      setPage(1);
    }
  };
  const download = async () => {
    if (downloading || !filtered.length) return;
    setDownloading(true);
    setActionError('');
    try {
      const { file } = await downloadRoster(event.eventId, filtered);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = '참가자명단_' + getLocalDateKey() + '.xlsx';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setActionError(getApiErrorMessage(error, '목록을 내려받지 못했습니다.'));
    } finally {
      setDownloading(false);
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
            disabled={!activeEvent || !ready}
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
            <strong>
              {filters.status === DEFAULT_FILTERS.status ? '승인 참가자' : '조회 결과'}{' '}
              <b>{filtered.length.toLocaleString()}</b>명
            </strong>
            {checked && (
              <span className="roster-selection">
                {checked.name} 선택{' '}
                <button className="roster-link" onClick={clearSelection}>
                  선택 해제
                </button>
              </span>
            )}
          </div>
          <button
            type="button"
            className="roster-download"
            onClick={() => void download()}
            disabled={!ready || !filtered.length || downloading}
          >
            <svg
              aria-hidden="true"
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M8 2v7m-3-3 3 3 3-3M2.5 10v3h11v-3" />
            </svg>
            {downloading ? '다운로드 중' : '목록 다운로드'}
          </button>
        </div>
        <div className="roster-filterline">
          <ParticipantFilters filters={filters} courses={courses} onChange={changeFilters} />
          <button
            className="roster-edit roster-btn"
            type="button"
            disabled={!ready || !checked || !canEdit(checked)}
            onClick={() => {
              if (checked) setEditor(checked);
            }}
          >
            수정
          </button>
        </div>
        <ParticipantTable
          rows={visible}
          selected={checked ? selected : null}
          onSelect={setSelected}
          onOpen={setDetail}
          busy={!ready}
          sort={sort}
          onSort={changeSort}
          initialLoading={loading && !hasLoaded}
          message={
            loading && !hasLoaded
              ? '명단을 불러오는 중입니다.'
              : loadError && !hasLoaded
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
          number={detailIndex >= 0 ? filtered[detailIndex].number : undefined}
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
