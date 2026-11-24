import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import { ApiError, getApiErrorMessage } from '../../../api/apiClient';
import {
  confirmImportedReview,
  getReviewImportDetail,
  getReviewImportHistory,
  uploadReviewExcel,
  type ImportedReview,
  type ReviewConfirmation,
  type ReviewImportBatch,
  type ReviewImportHistory,
} from '../../../api/reviewImportApi';
import {
  REVIEW_IMPORT_VIEWS,
  formatMeters,
  formatPages,
  getDefaultCandidate,
  isBulkConfirmableRow,
  isConfirmableRow,
  matchesReviewImportKeyword,
  type ReviewImportView,
} from '../../../types/adminReviewImport';
import { clampPage, DEFAULT_PAGE_SIZE } from '../table/pagination';
import { nextCandidateId } from '../table/queueNavigation';
import TablePagination from '../table/TablePagination';
import ReviewImportBulkDialog from './ReviewImportBulkDialog';
import ReviewImportDetailDialog from './ReviewImportDetailDialog';
import ReviewImportDetailPanel from './ReviewImportDetailPanel';
import ReviewImportSource from './ReviewImportSource';
import ReviewImportTable from './ReviewImportTable';
import '../../../styles/admin-participants.css';
import './review-import-dialog.css';

export type ReviewPreview = {
  /** memberNo를 주면 그 회원의 행이 있는 묶음만, 없으면 대조 결과 전체를 다시 불러옵니다. */
  reload: (memberNo?: string) => Promise<void>;
};

type LoadedBatch = {
  batch: ReviewImportBatch;
  /** 서버 페이지(50행) 단위 행 목록. 반영 후에는 영향을 받은 페이지만 다시 불러옵니다. */
  pages: ImportedReview[][];
};

type Feedback = { message: string; isError: boolean };

const PAGE_FETCH_CONCURRENCY = 4;
const AUTO_NEXT_KEY = 'pagepace:admin:review-import-auto-next';
const LEAVE_WITH_NOTE =
  '작성 중인 검토 메모가 있습니다. 이동하면 입력한 내용이 사라집니다. 이동할까요?';

function readAutoNext() {
  try {
    return localStorage.getItem(AUTO_NEXT_KEY) !== 'false';
  } catch {
    return true;
  }
}

/** 보기(상태 묶음)와 검색어에 맞는 행. 표·상세 창의 이전·다음 이동이 같은 순서를 씁니다. */
function filterRows(rows: ImportedReview[], view: ReviewImportView, keyword: string) {
  const statuses = REVIEW_IMPORT_VIEWS.find((item) => item.key === view)?.statuses ?? [];
  return rows.filter(
    (row) => statuses.includes(row.status) && matchesReviewImportKeyword(row, keyword),
  );
}
const REFRESH_ON_ERROR_CODES = [
  'REVIEW_TOTALS_CHANGED',
  'REVIEW_NOT_ELIGIBLE',
  'REVIEW_MATCH_REQUIRED',
  'REVIEW_ALREADY_APPLIED',
  'REVOKED_EVIDENCE',
];
const VIEW_ORDER: ReviewImportView[] = ['ready', 'review', 'done', 'blocked', 'excluded'];

const EMPTY_MESSAGES: Record<ReviewImportView, string> = {
  ready: '바로 반영할 수 있는 서평이 없습니다.',
  review: '확인이 필요한 서평이 없습니다.',
  done: '이 자료에서 반영한 서평이 아직 없습니다.',
  blocked: '반영할 수 없는 행이 없습니다.',
  excluded: '비참가자 서평이 없습니다.',
};

const VIEW_DESCRIPTIONS: Record<ReviewImportView, string> = {
  ready: '회원번호·도서 ID·이름이 모두 일치한 서평입니다. 표에서 골라 한 번에 반영할 수 있습니다.',
  review:
    '후보 도서는 찾았지만 확인할 사항이 있습니다. 사유를 확인하고 검토 메모를 남긴 뒤 반영합니다.',
  done: '이 서평이나 같은 책의 다른 서평으로 이미 인정된 행입니다.',
  blocked: '승인 독서일지와 맞지 않거나 자료에 오류가 있어 반영할 수 없는 행입니다.',
  excluded: '이 행사 참가자가 아닌 회원의 서평이라 대조에서 제외했습니다.',
};

async function fetchPages(eventId: number, batchId: number, pageIndices: number[]) {
  const details = [];

  for (let start = 0; start < pageIndices.length; start += PAGE_FETCH_CONCURRENCY) {
    const chunk = pageIndices.slice(start, start + PAGE_FETCH_CONCURRENCY);
    details.push(
      ...(await Promise.all(chunk.map((page) => getReviewImportDetail(eventId, batchId, page)))),
    );
  }

  return details;
}

/** 업로드 한 건의 대조 결과를 모든 페이지에 걸쳐 불러옵니다. */
async function fetchBatch(
  eventId: number,
  batchId: number,
  onProgress: (loadedRows: number) => void,
): Promise<LoadedBatch> {
  const first = await getReviewImportDetail(eventId, batchId, 0);
  const totalPages = Math.max(1, first.totalPages);
  const pages: ImportedReview[][] = Array.from({ length: totalPages }, () => []);
  let loadedRows = first.rows.length;

  pages[0] = first.rows;
  onProgress(loadedRows);

  for (let start = 1; start < totalPages; start += PAGE_FETCH_CONCURRENCY) {
    const indices = Array.from(
      { length: Math.min(PAGE_FETCH_CONCURRENCY, totalPages - start) },
      (_, offset) => start + offset,
    );
    const details = await fetchPages(eventId, batchId, indices);

    details.forEach((detail) => {
      pages[detail.page] = detail.rows;
      loadedRows += detail.rows.length;
    });
    onProgress(loadedRows);
  }

  return { batch: first.batch, pages };
}

function firstViewWithRows(rows: ImportedReview[]): ReviewImportView {
  return (
    VIEW_ORDER.find((key) => {
      const statuses = REVIEW_IMPORT_VIEWS.find((view) => view.key === key)?.statuses ?? [];
      return rows.some((row) => statuses.includes(row.status));
    }) ?? 'ready'
  );
}

function sumCredit(rows: ImportedReview[]) {
  return rows.reduce(
    (sum, row) => {
      const candidate = getDefaultCandidate(row);
      return {
        pages: sum.pages + (candidate?.uncreditedPages ?? 0),
        meters: sum.meters + (candidate?.distanceToCreditMeter ?? 0),
      };
    },
    { pages: 0, meters: 0 },
  );
}

type ReviewImportWorkspaceProps = {
  ref?: Ref<ReviewPreview>;
  eventId: number;
  readOnly: boolean;
  onBusyChange: (busy: boolean) => void;
  onVerified: () => Promise<void>;
};

/**
 * 솔라스 서평 엑셀 대조 화면.
 * 대조 자료(업로드) → 상태별 결과 표(본문 전체 너비, 페이지 이동) → 상세 창(모달) 순서로,
 * 반영 가능한 서평은 여러 건을 한 번에, 확인이 필요한 서평은 사유와 메모를 남겨 한 건씩 반영합니다.
 */
function ReviewImportWorkspace({
  ref,
  eventId,
  readOnly,
  onBusyChange,
  onVerified,
}: ReviewImportWorkspaceProps) {
  const [history, setHistory] = useState<ReviewImportHistory | null>(null);
  const [loaded, setLoaded] = useState<LoadedBatch | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [rowsProgress, setRowsProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<ReviewImportView>('ready');
  const [keyword, setKeyword] = useState('');
  /** 상세 창에서 보고 있는 행. null이면 상세 창이 닫혀 있습니다. */
  const [activeRowId, setActiveRowId] = useState<number | null>(null);
  /** 상세 창을 닫은 뒤 표에서 구분해 보여 줄 마지막으로 본 행 */
  const [recentRowId, setRecentRowId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [autoNext, setAutoNext] = useState(readAutoNext);
  /** 작성 중인 검토 메모. 반영 실패로 상세가 다시 그려져도 이어서 씁니다. */
  const [draftNote, setDraftNote] = useState<{ rowId: number; text: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inFlight = useRef(false);
  const loadedRef = useRef<LoadedBatch | null>(null);

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  const showBatch = useCallback((result: LoadedBatch) => {
    loadedRef.current = result;
    setLoaded(result);
    setSelectedIds([]);
    setActiveRowId(null);
    setRecentRowId(null);
    setDraftNote(null);
    setKeyword('');
    setPage(0);
    setView(firstViewWithRows(result.pages.flat()));
  }, []);

  useEffect(() => {
    let active = true;

    getReviewImportHistory(eventId)
      .then(async (next) => {
        if (!active) return;
        setHistory(next);
        const latest = next.batches[0];

        if (!latest) return;

        setRowsProgress({ loaded: 0, total: latest.rowCount });
        const result = await fetchBatch(eventId, latest.id, (loadedRows) => {
          if (active) setRowsProgress({ loaded: loadedRows, total: latest.rowCount });
        });

        if (active) showBatch(result);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setFeedback({
            message: getApiErrorMessage(requestError, '업로드 내역을 불러오지 못했습니다.'),
            isError: true,
          });
        }
      })
      .finally(() => {
        if (active) {
          setHistoryLoading(false);
          setRowsProgress(null);
        }
      });

    return () => {
      active = false;
    };
  }, [eventId, showBatch]);

  /** 한 번에 하나의 요청만 처리하고, 처리 중에는 페이지의 행사 선택·탭 전환을 막습니다. */
  const run = useCallback(
    async (action: () => Promise<void>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      onBusyChange(true);

      try {
        await action();
      } catch (requestError) {
        setFeedback({
          message: getApiErrorMessage(requestError, '요청을 처리하지 못했습니다.'),
          isError: true,
        });
      } finally {
        inFlight.current = false;
        setBusy(false);
        onBusyChange(false);
      }
    },
    [onBusyChange],
  );

  /** 반영 후 상태가 바뀔 수 있는 회원의 행이 들어 있는 페이지만 다시 불러옵니다. */
  const refreshMembers = useCallback(
    async (memberNos: (string | null)[] | null) => {
      const current = loadedRef.current;
      if (!current) return;

      const targets = memberNos === null ? null : new Set(memberNos.filter(Boolean));
      const pageIndices = current.pages.flatMap((pageRows, index) =>
        targets === null || pageRows.some((row) => row.memberNo && targets.has(row.memberNo))
          ? [index]
          : [],
      );

      if (pageIndices.length === 0) return;

      const details = await fetchPages(eventId, current.batch.id, pageIndices);
      const pages = [...current.pages];
      details.forEach((detail) => {
        pages[detail.page] = detail.rows;
      });
      const next = { batch: details[0]?.batch ?? current.batch, pages };
      loadedRef.current = next;
      setLoaded(next);
      // 이미 반영됐거나 더는 일괄 반영할 수 없는 행은 선택에서 뺍니다.
      const confirmable = new Set(
        pages
          .flat()
          .filter(isBulkConfirmableRow)
          .map((row) => row.id),
      );
      setSelectedIds((selected) => selected.filter((id) => confirmable.has(id)));
    },
    [eventId],
  );

  useImperativeHandle(
    ref,
    () => ({
      reload: (memberNo?: string) => refreshMembers(memberNo ? [memberNo] : null),
    }),
    [refreshMembers],
  );

  const rows = useMemo(() => loaded?.pages.flat() ?? [], [loaded]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        REVIEW_IMPORT_VIEWS.map((item) => [
          item.key,
          rows.filter((row) => item.statuses.includes(row.status)).length,
        ]),
      ) as Record<ReviewImportView, number>,
    [rows],
  );
  const visibleRows = useMemo(() => filterRows(rows, view, keyword), [keyword, rows, view]);
  const currentPage = clampPage(page, visibleRows.length, pageSize);
  const pageRows = visibleRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const readyTotals = useMemo(() => sumCredit(rows.filter(isBulkConfirmableRow)), [rows]);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id) && isBulkConfirmableRow(row)),
    [rows, selectedIds],
  );
  const selectedTotals = sumCredit(selectedRows);
  const eligibleRows = useMemo(
    () => (view === 'ready' ? visibleRows.filter(isBulkConfirmableRow) : []),
    [view, visibleRows],
  );
  const selectedOnPage = pageRows.filter((row) => selectedIds.includes(row.id)).length;
  // 상세 창은 보기에서 빠진 행(방금 반영한 행)도 계속 보여 줄 수 있도록 전체 행에서 찾습니다.
  const activeRow =
    activeRowId === null ? null : (rows.find((row) => row.id === activeRowId) ?? null);
  const activeIndex = activeRow ? visibleRows.indexOf(activeRow) : -1;
  const hasDraft = !!draftNote && draftNote.rowId === activeRowId && !!draftNote.text.trim();
  const trackNote = useCallback(
    (text: string) =>
      setDraftNote((current) =>
        activeRowId === null || (current?.rowId === activeRowId && current.text === text)
          ? current
          : { rowId: activeRowId, text },
      ),
    [activeRowId],
  );

  // 검토 메모를 쓰는 중에 새로고침하거나 창을 닫으면 브라우저 확인 창을 띄웁니다.
  useEffect(() => {
    if (!hasDraft) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);

  const canLeave = () => {
    if (!hasDraft) return true;
    if (!window.confirm(LEAVE_WITH_NOTE)) return false;
    setDraftNote(null);
    return true;
  };

  /** 상세 창에서 볼 행을 바꾸고, 표도 그 행이 있는 쪽으로 맞춥니다. */
  const showRow = (rowId: number, source = visibleRows) => {
    const index = source.findIndex((row) => row.id === rowId);
    if (index >= 0) setPage(Math.floor(index / pageSize));
    setActiveRowId(rowId);
    setRecentRowId(rowId);
  };

  const selectRow = (rowId: number) => {
    setFeedback(null);
    showRow(rowId);
  };

  const moveRow = (offset: -1 | 1) => {
    const next = visibleRows[activeIndex + offset];
    if (!next || busy || !canLeave()) return;
    setFeedback(null);
    showRow(next.id);
  };

  /** 상세 창을 닫고, 마지막으로 본 행의 상세 보기 버튼(없으면 표 위 보기 버튼)으로 초점을 돌립니다. */
  const closeDetail = () => {
    if (busy || !canLeave()) return;
    const rowId = activeRowId;
    setActiveRowId(null);
    setDraftNote(null);
    window.requestAnimationFrame(() => {
      const target =
        (rowId !== null && document.getElementById(`review-import-row-${rowId}`)) ||
        document.querySelector<HTMLElement>(
          '.admin-review-import .admin-segmented [aria-pressed="true"]',
        );
      target?.focus();
    });
  };

  const changeView = (next: ReviewImportView) => {
    setView(next);
    setActiveRowId(null);
    setRecentRowId(null);
    setSelectedIds([]);
    setPage(0);
  };

  const openBatch = (batchId: number) =>
    void run(async () => {
      setFeedback(null);
      const total = history?.batches.find((batch) => batch.id === batchId)?.rowCount ?? 0;
      setRowsProgress({ loaded: 0, total });

      try {
        showBatch(
          await fetchBatch(eventId, batchId, (loadedRows) =>
            setRowsProgress({ loaded: loadedRows, total }),
          ),
        );
      } finally {
        setRowsProgress(null);
      }
    });

  const changeHistoryPage = (page: number) =>
    void run(async () => {
      setHistory(await getReviewImportHistory(eventId, page));
    });

  const upload = async (file: File) => {
    let uploaded = false;

    await run(async () => {
      setFeedback(null);
      const batch = await uploadReviewExcel(eventId, file);
      uploaded = true;
      setRowsProgress({ loaded: 0, total: batch.rowCount });

      try {
        const [nextHistory, result] = await Promise.all([
          getReviewImportHistory(eventId),
          fetchBatch(eventId, batch.id, (loadedRows) =>
            setRowsProgress({ loaded: loadedRows, total: batch.rowCount }),
          ),
        ]);
        setHistory(nextHistory);
        showBatch(result);
      } finally {
        setRowsProgress(null);
      }

      setFeedback({
        message: `${batch.rowCount.toLocaleString('ko-KR')}행을 올려 대조했습니다. 아직 거리는 반영되지 않았습니다.`,
        isError: false,
      });
    });

    return uploaded;
  };

  /** 대조 결과와 서평 확인 대기 목록을 함께 갱신합니다. 실패해도 이미 처리된 반영은 유지됩니다. */
  const refreshAfterCredit = async (memberNos: (string | null)[]) => {
    const results = await Promise.allSettled([refreshMembers(memberNos), onVerified()]);

    if (results.some((result) => result.status === 'rejected')) {
      setFeedback({
        message:
          '반영은 완료했지만 목록을 새로 불러오지 못했습니다. 대조 자료를 다시 선택해 주세요.',
        isError: true,
      });
      return false;
    }
    return true;
  };

  /**
   * 한 건 반영. 서버에서 성공한 뒤에만 목록·건수를 새로 불러오고, 자동 이동이 켜져 있으면 같은 보기·검색
   * 조건의 다음 대상으로 옮깁니다(남은 대상이 없으면 상세 창을 닫습니다). 실패하면 현재 대상과 메모를 둡니다.
   */
  const confirmOne = (row: ImportedReview, request: ReviewConfirmation) => {
    const current = loadedRef.current;
    if (!current) return Promise.resolve();

    const beforeIds = visibleRows.map((item) => item.id);
    const bookTitle =
      row.candidates.find((item) => item.participantBookId === request.participantBookId)
        ?.bookTitle ?? row.bookTitle;

    return run(async () => {
      setFeedback(null);
      let message: string;

      try {
        const result = await confirmImportedReview(eventId, current.batch.id, row.id, request);
        message = result.alreadyApplied
          ? `엑셀 ${row.sourceRow}행은 이미 반영한 서평입니다. 거리를 더하지 않았습니다.`
          : `${row.memberName} 님의 “${bookTitle}”에 ${formatPages(result.creditedPages)}(${formatMeters(result.creditedDistanceMeter)})을 반영했습니다.`;
      } catch (requestError) {
        if (
          requestError instanceof ApiError &&
          REFRESH_ON_ERROR_CODES.includes(requestError.code ?? '')
        ) {
          await refreshMembers([row.memberNo]).catch(() => undefined);
        }
        throw requestError;
      }

      setDraftNote(null);
      setSelectedIds((selected) => selected.filter((id) => id !== row.id));
      // 목록을 새로 받지 못하면 다음 대상을 정할 수 없으므로 이 행에 머뭅니다.
      if (!(await refreshAfterCredit([row.memberNo]))) return;

      if (!autoNext) {
        setFeedback({ message, isError: false });
        return;
      }
      const fresh = filterRows(loadedRef.current?.pages.flat() ?? [], view, keyword);
      const nextId = nextCandidateId(
        beforeIds,
        row.id,
        fresh.map((item) => item.id),
      );
      if (nextId === null) {
        setFeedback({ message: `${message} 이 보기에 남은 대상이 없습니다.`, isError: false });
        setActiveRowId(null);
        window.requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(
              '.admin-review-import .admin-segmented [aria-pressed="true"]',
            )
            ?.focus(),
        );
        return;
      }
      setFeedback({ message: `${message} 다음 대상입니다.`, isError: false });
      showRow(nextId, fresh);
    });
  };

  const confirmBulk = () => {
    const current = loadedRef.current;
    const targets = selectedRows;
    if (!current || targets.length === 0) return;

    void run(async () => {
      setFeedback(null);
      setBulkProgress({ done: 0, total: targets.length });
      let creditedCount = 0;
      let creditedPages = 0;
      let creditedMeters = 0;
      let alreadyApplied = 0;
      const failures: string[] = [];

      try {
        for (const [index, row] of targets.entries()) {
          const candidate = getDefaultCandidate(row);

          if (candidate) {
            try {
              const result = await confirmImportedReview(eventId, current.batch.id, row.id, {
                participantBookId: candidate.participantBookId,
                expectedApprovedPages: candidate.approvedPages,
                expectedUncreditedPages: candidate.uncreditedPages,
                evidenceChecked: true,
                note: '',
              });

              if (result.alreadyApplied) {
                alreadyApplied += 1;
              } else {
                creditedCount += 1;
                creditedPages += result.creditedPages;
                creditedMeters += result.creditedDistanceMeter;
              }
            } catch (requestError) {
              failures.push(
                `엑셀 ${row.sourceRow}행 ${getApiErrorMessage(requestError, '반영하지 못했습니다.')}`,
              );
            }
          }

          setBulkProgress({ done: index + 1, total: targets.length });
        }
      } finally {
        setBulkOpen(false);
        setBulkProgress(null);
        setSelectedIds([]);
      }

      const parts = [
        `${creditedCount}건 반영 (${formatPages(creditedPages)} · ${formatMeters(creditedMeters)})`,
      ];
      if (alreadyApplied > 0) parts.push(`이미 반영된 ${alreadyApplied}건은 건너뜀`);
      if (failures.length > 0) parts.push(`실패 ${failures.length}건: ${failures.join(' / ')}`);
      setFeedback({ message: parts.join(' · '), isError: failures.length > 0 });

      await refreshAfterCredit(targets.map((row) => row.memberNo));
    });
  };

  const excludedRows = view === 'excluded' ? visibleRows : [];

  /** 보기가 비었을 때 다음에 처리할 보기로 바로 이동할 수 있게 안내합니다. */
  const emptyState: { message: string; action?: { label: string; onClick: () => void } } =
    keyword.trim()
      ? {
          message: '조건에 맞는 행이 없습니다.',
          action: { label: '검색어 지우기', onClick: () => setKeyword('') },
        }
      : view === 'ready' && counts.review > 0
        ? {
            message: '바로 반영할 수 있는 서평을 모두 처리했습니다.',
            action: {
              label: `확인 필요 ${counts.review}건 보기`,
              onClick: () => changeView('review'),
            },
          }
        : view === 'review' && counts.ready > 0
          ? {
              message: '확인이 필요한 서평이 없습니다.',
              action: {
                label: `반영 가능 ${counts.ready}건 보기`,
                onClick: () => changeView('ready'),
              },
            }
          : (view === 'ready' || view === 'review') && counts.done > 0
            ? {
                message:
                  '이 자료에서 반영할 서평을 모두 처리했습니다. 엑셀에 없는 서평은 개별 확인 탭에서 확인합니다.',
                action: {
                  label: `처리 완료 ${counts.done}건 보기`,
                  onClick: () => changeView('done'),
                },
              }
            : { message: EMPTY_MESSAGES[view] };

  return (
    <section
      className="admin-review-import"
      aria-label="솔라스 서평 엑셀 대조"
      aria-busy={busy || historyLoading || rowsProgress !== null}
    >
      <ReviewImportSource
        history={history}
        batch={loaded?.batch ?? null}
        isLoading={historyLoading && !history}
        busy={busy || rowsProgress !== null}
        readOnly={readOnly}
        onSelectBatch={openBatch}
        onHistoryPage={changeHistoryPage}
        onUpload={upload}
        onInvalidFile={(message) => setFeedback({ message, isError: true })}
      />

      {feedback && (
        <p
          className={`admin-feedback admin-review-import__feedback${feedback.isError ? ' admin-feedback--error' : ''}`}
          role={feedback.isError ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      )}

      {rowsProgress && (
        <p className="admin-review-import__loading" role="status">
          대조 결과를 불러오는 중입니다
          {rowsProgress.total > 0 &&
            ` (${rowsProgress.loaded.toLocaleString('ko-KR')} / ${rowsProgress.total.toLocaleString('ko-KR')}행)`}
        </p>
      )}

      {loaded && !rowsProgress && (
        <>
          <div className="admin-review-import__toolbar">
            <div className="admin-segmented" role="group" aria-label="대조 결과 보기">
              {REVIEW_IMPORT_VIEWS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={view === item.key}
                  disabled={busy}
                  onClick={() => changeView(item.key)}
                >
                  {item.label}
                  <b
                    className={
                      item.key === 'review' && counts.review > 0 ? 'is-warning' : undefined
                    }
                  >
                    {counts[item.key].toLocaleString('ko-KR')}
                  </b>
                </button>
              ))}
            </div>
            <input
              type="search"
              className="admin-review-import__search"
              value={keyword}
              aria-label="대조 결과 검색"
              placeholder="엑셀 행, 작성자, 회원번호, 도서명"
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(0);
              }}
            />
          </div>

          <p className="admin-review-import__description">
            {VIEW_DESCRIPTIONS[view]}
            {view === 'ready' && counts.ready > 0 && (
              <>
                {' '}
                모두 반영하면{' '}
                <strong>
                  {formatPages(readyTotals.pages)} · {formatMeters(readyTotals.meters)}
                </strong>
                가 인정됩니다.
              </>
            )}
          </p>

          {view === 'excluded' ? (
            <div className="admin-review-import__excluded">
              {excludedRows.length === 0 ? (
                <p>비참가자 서평이 없습니다.</p>
              ) : (
                <>
                  <p>
                    원본 엑셀에서 해당하는 행 {excludedRows.length.toLocaleString('ko-KR')}개입니다.
                    거리 반영과 관계없으므로 따로 처리하지 않아도 됩니다.
                  </p>
                  <p className="admin-review-import__row-numbers">
                    <span>엑셀 행</span> {excludedRows.map((row) => row.sourceRow).join(', ')}
                  </p>
                </>
              )}
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="admin-review-import__empty">
              <p>{emptyState.message}</p>
              {emptyState.action && (
                <button
                  type="button"
                  className="admin-button"
                  disabled={busy}
                  onClick={emptyState.action.onClick}
                >
                  {emptyState.action.label}
                </button>
              )}
            </div>
          ) : (
            <div className="admin-review-import__list admin-review-import__list--full">
              <ReviewImportTable
                view={view}
                rows={pageRows}
                activeRowId={recentRowId}
                selectedIds={selectedIds}
                busy={busy}
                readOnly={readOnly}
                emptyMessage={keyword.trim() ? '조건에 맞는 행이 없습니다.' : EMPTY_MESSAGES[view]}
                onSelectRow={selectRow}
                onToggleRow={(rowId, checked) =>
                  setSelectedIds((current) =>
                    checked
                      ? [...new Set([...current, rowId])]
                      : current.filter((id) => id !== rowId),
                  )
                }
                onToggleAll={(checked) => {
                  const ids = pageRows.filter(isBulkConfirmableRow).map((row) => row.id);
                  setSelectedIds((current) =>
                    checked
                      ? [...new Set([...current, ...ids])]
                      : current.filter((id) => !ids.includes(id)),
                  );
                }}
              />
              {view === 'ready' && selectedRows.length > 0 && (
                <div className="admin-review-import__bulk" aria-label="선택한 서평">
                  <p>
                    <strong>{selectedRows.length.toLocaleString('ko-KR')}건 선택</strong>
                    {selectedRows.length > selectedOnPage && (
                      <small>
                        이 쪽 {selectedOnPage.toLocaleString('ko-KR')}건 · 다른 쪽{' '}
                        {(selectedRows.length - selectedOnPage).toLocaleString('ko-KR')}건
                      </small>
                    )}
                    <span>
                      {formatPages(selectedTotals.pages)} · {formatMeters(selectedTotals.meters)}
                    </span>
                  </p>
                  {selectedRows.length < eligibleRows.length && (
                    <button
                      type="button"
                      className="admin-review-import__bulk-clear"
                      disabled={busy}
                      onClick={() => setSelectedIds(eligibleRows.map((row) => row.id))}
                    >
                      반영 가능 전체 {eligibleRows.length.toLocaleString('ko-KR')}건 선택
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-review-import__bulk-clear"
                    disabled={busy}
                    onClick={() => setSelectedIds([])}
                  >
                    선택 해제
                  </button>
                  <button
                    type="button"
                    className="admin-review-import__bulk-submit"
                    disabled={busy || readOnly}
                    onClick={() => setBulkOpen(true)}
                  >
                    선택한 {selectedRows.length.toLocaleString('ko-KR')}건 반영
                  </button>
                </div>
              )}
              <TablePagination
                total={visibleRows.length}
                page={currentPage}
                pageSize={pageSize}
                busy={busy}
                label="대조 결과 페이지"
                onPage={setPage}
                onPageSize={(size) => {
                  setPageSize(size);
                  setPage(0);
                }}
              />
            </div>
          )}
        </>
      )}

      {activeRow && (
        <ReviewImportDetailDialog busy={busy} onRequestClose={closeDetail}>
          <ReviewImportDetailPanel
            key={`${activeRow.id}-${activeRow.status}-${activeRow.candidates
              .map(
                (candidate) =>
                  `${candidate.participantBookId}:${candidate.approvedPages}:${candidate.uncreditedPages}`,
              )
              .join(',')}`}
            row={activeRow}
            eventId={eventId}
            position={activeIndex >= 0 ? activeIndex + 1 : null}
            total={visibleRows.length}
            busy={busy}
            readOnly={readOnly}
            feedback={feedback}
            autoNext={
              activeIndex >= 0 && isConfirmableRow(activeRow)
                ? {
                    checked: autoNext,
                    onChange: (checked) => {
                      setAutoNext(checked);
                      try {
                        localStorage.setItem(AUTO_NEXT_KEY, String(checked));
                      } catch {
                        /* 저장하지 못해도 이번 화면에서는 그대로 동작합니다. */
                      }
                    },
                  }
                : undefined
            }
            initialNote={draftNote?.rowId === activeRow.id ? draftNote.text : ''}
            onNoteChange={trackNote}
            onMove={moveRow}
            onClose={closeDetail}
            onConfirm={confirmOne}
          />
        </ReviewImportDetailDialog>
      )}

      {bulkOpen && (
        <ReviewImportBulkDialog
          rows={selectedRows}
          progress={bulkProgress}
          onCancel={() => setBulkOpen(false)}
          onConfirm={confirmBulk}
        />
      )}
    </section>
  );
}

export default ReviewImportWorkspace;
