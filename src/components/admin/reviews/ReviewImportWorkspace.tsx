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
  matchesReviewImportKeyword,
  type ReviewImportView,
} from '../../../types/adminReviewImport';
import ReviewImportBulkDialog from './ReviewImportBulkDialog';
import ReviewImportDetailPanel from './ReviewImportDetailPanel';
import ReviewImportSource from './ReviewImportSource';
import ReviewImportTable from './ReviewImportTable';

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
const NARROW_LAYOUT_QUERY = '(max-width: 1180px)';
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
 * 대조 자료(업로드) → 상태별 결과 표 → 오른쪽 상세 패널 순서로, 반영 가능한 서평은 여러 건을
 * 한 번에, 확인이 필요한 서평은 사유와 메모를 남겨 한 건씩 반영합니다.
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
  const [activeRowId, setActiveRowId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const inFlight = useRef(false);
  const loadedRef = useRef<LoadedBatch | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  const showBatch = useCallback((result: LoadedBatch) => {
    loadedRef.current = result;
    setLoaded(result);
    setSelectedIds([]);
    setActiveRowId(null);
    setKeyword('');
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
  const visibleRows = useMemo(() => {
    const statuses = REVIEW_IMPORT_VIEWS.find((item) => item.key === view)?.statuses ?? [];
    return rows.filter(
      (row) => statuses.includes(row.status) && matchesReviewImportKeyword(row, keyword),
    );
  }, [keyword, rows, view]);
  const readyTotals = useMemo(() => sumCredit(rows.filter(isBulkConfirmableRow)), [rows]);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id) && isBulkConfirmableRow(row)),
    [rows, selectedIds],
  );
  const selectedTotals = sumCredit(selectedRows);
  const activeRow = visibleRows.find((row) => row.id === activeRowId) ?? visibleRows[0] ?? null;
  const activeIndex = activeRow ? visibleRows.indexOf(activeRow) : -1;

  const selectRow = (rowId: number) => {
    setActiveRowId(rowId);

    if (window.matchMedia(NARROW_LAYOUT_QUERY).matches) {
      window.requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      );
    }
  };

  const changeView = (next: ReviewImportView) => {
    setView(next);
    setActiveRowId(null);
    setSelectedIds([]);
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
    }
  };

  const confirmOne = (row: ImportedReview, request: ReviewConfirmation) => {
    const current = loadedRef.current;
    if (!current) return Promise.resolve();

    const index = visibleRows.findIndex((item) => item.id === row.id);
    const nextRow = visibleRows[index + 1] ?? visibleRows[index - 1] ?? null;
    const bookTitle =
      row.candidates.find((item) => item.participantBookId === request.participantBookId)
        ?.bookTitle ?? row.bookTitle;

    return run(async () => {
      setFeedback(null);

      try {
        const result = await confirmImportedReview(eventId, current.batch.id, row.id, request);
        setFeedback({
          message: result.alreadyApplied
            ? `엑셀 ${row.sourceRow}행은 이미 반영한 서평입니다. 거리를 더하지 않았습니다.`
            : `${row.memberName} 님의 “${bookTitle}”에 ${formatPages(result.creditedPages)}(${formatMeters(result.creditedDistanceMeter)})을 반영했습니다.`,
          isError: false,
        });
        setActiveRowId(nextRow?.id ?? null);
      } catch (requestError) {
        if (
          requestError instanceof ApiError &&
          REFRESH_ON_ERROR_CODES.includes(requestError.code ?? '')
        ) {
          await refreshMembers([row.memberNo]).catch(() => undefined);
        }
        throw requestError;
      }

      await refreshAfterCredit([row.memberNo]);
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
                setActiveRowId(null);
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
            <div className="admin-review-import__split">
              <div className="admin-review-import__list">
                <ReviewImportTable
                  view={view}
                  rows={visibleRows}
                  activeRowId={activeRow?.id ?? null}
                  selectedIds={selectedIds}
                  busy={busy}
                  readOnly={readOnly}
                  emptyMessage={
                    keyword.trim() ? '조건에 맞는 행이 없습니다.' : EMPTY_MESSAGES[view]
                  }
                  onSelectRow={selectRow}
                  onToggleRow={(rowId, checked) =>
                    setSelectedIds((current) =>
                      checked
                        ? [...new Set([...current, rowId])]
                        : current.filter((id) => id !== rowId),
                    )
                  }
                  onToggleAll={(checked) =>
                    setSelectedIds(
                      checked ? visibleRows.filter(isBulkConfirmableRow).map((row) => row.id) : [],
                    )
                  }
                />
                {view === 'ready' && selectedRows.length > 0 && (
                  <div className="admin-review-import__bulk" aria-label="선택한 서평">
                    <p>
                      <strong>{selectedRows.length}건 선택</strong>
                      <span>
                        {formatPages(selectedTotals.pages)} · {formatMeters(selectedTotals.meters)}
                      </span>
                    </p>
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
                      선택한 {selectedRows.length}건 반영
                    </button>
                  </div>
                )}
              </div>

              <div ref={panelRef} className="admin-review-import__panel">
                {activeRow ? (
                  <ReviewImportDetailPanel
                    key={`${activeRow.id}-${activeRow.status}-${activeRow.candidates
                      .map(
                        (candidate) =>
                          `${candidate.participantBookId}:${candidate.approvedPages}:${candidate.uncreditedPages}`,
                      )
                      .join(',')}`}
                    row={activeRow}
                    eventId={eventId}
                    position={activeIndex + 1}
                    total={visibleRows.length}
                    busy={busy}
                    readOnly={readOnly}
                    onMove={(offset) => {
                      const next = visibleRows[activeIndex + offset];
                      if (next) selectRow(next.id);
                    }}
                    onConfirm={confirmOne}
                  />
                ) : (
                  <div className="admin-detail-panel">
                    <p className="admin-detail-panel__empty">표에서 서평을 선택하세요.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
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
