import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type {
  ImportedReview,
  ReviewCandidate,
  ReviewConfirmation,
} from '../../../api/reviewImportApi';
import { METERS_PER_PAGE } from '../../../constants/reading';
import {
  formatMeters,
  formatPages,
  formatSourceTime,
  getCandidateCredit,
  getDefaultCandidate,
  isConfirmableRow,
  normalizeForCompare,
} from '../../../types/adminReviewImport';
import { formatKoDateTime24 } from '../../../utils/date';
import ApprovedBookLogs from './ApprovedBookLogs';
import ReviewImportStatusBadge from './ReviewImportStatusBadge';

type ReviewImportDetailPanelProps = {
  row: ImportedReview;
  eventId: number;
  /** 현재 보기·검색 조건에서의 위치(1부터). 조건에서 빠진 행(방금 반영한 행 등)이면 null */
  position: number | null;
  total: number;
  busy: boolean;
  readOnly: boolean;
  /** 상세 창 안에서 보여 줄 처리 결과·오류 */
  feedback?: { message: string; isError: boolean } | null;
  /** 반영 후 다음 대상으로 이동 옵션 (반영할 수 있는 행에서만) */
  autoNext?: { checked: boolean; onChange: (checked: boolean) => void };
  onMove: (offset: -1 | 1) => void;
  onClose?: () => void;
  onConfirm: (row: ImportedReview, request: ReviewConfirmation) => Promise<void>;
  /** 이전에 작성하던 검토 메모 (반영 실패 후 다시 그려져도 이어서 씁니다) */
  initialNote?: string;
  /** 작성 중인 검토 메모 (닫거나 이동할 때 확인) */
  onNoteChange?: (note: string) => void;
};

type CompareMark = 'same' | 'edition' | 'title' | 'different' | 'none';

const COMPARE_MARK_LABELS: Record<CompareMark, string> = {
  same: '일치',
  edition: '판본 일치',
  title: '제목으로 찾음',
  different: '다름',
  none: '—',
};

function getComparisons(row: ImportedReview, candidate: ReviewCandidate | undefined) {
  const mark = (same: boolean): CompareMark => (!candidate ? 'none' : same ? 'same' : 'different');
  const sameBookId = candidate?.libraryBookId === row.libraryBookId;
  const bookIdMark: CompareMark = !candidate
    ? 'none'
    : sameBookId
      ? 'same'
      : candidate.matchType === 'TITLE'
        ? 'title'
        : 'edition';

  return [
    {
      label: '회원번호',
      source: row.memberNo,
      record: candidate?.studentNo,
      mark: mark(row.memberNo === candidate?.studentNo),
    },
    {
      label: '이름',
      source: row.memberName,
      record: candidate?.name,
      mark: mark(normalizeForCompare(row.memberName) === normalizeForCompare(candidate?.name)),
    },
    {
      label: '도서 ID',
      source: row.libraryBookId === null ? null : String(row.libraryBookId),
      record: candidate ? String(candidate.libraryBookId) : undefined,
      mark: bookIdMark,
    },
    {
      label: '도서명',
      source: row.bookTitle,
      record: candidate?.bookTitle,
      mark: mark(normalizeForCompare(row.bookTitle) === normalizeForCompare(candidate?.bookTitle)),
    },
  ];
}

function StatusGuide({ row, eventId }: { row: ImportedReview; eventId: number }) {
  if (row.status === 'BOOK_VERIFIED') {
    return (
      <p className="admin-review-detail__guide">
        이 책은 다른 서평으로 이미 인정되었습니다. 이후 승인되는 독서일지도 자동으로 거리에
        반영됩니다.
      </p>
    );
  }

  if (row.status === 'UNMATCHED') {
    return (
      <p className="admin-review-detail__guide">
        참가자의 승인 독서일지에서 이 책을 찾지 못했습니다. 독서일지가 아직 검토 전이거나 다른
        판본으로 기록되었을 수 있습니다.{' '}
        <Link to={`/admin/logs?eventId=${eventId}`}>독서일지 검토로 이동</Link>
      </p>
    );
  }

  if (row.status === 'NO_CREDIT' && row.verification) {
    return (
      <p className="admin-review-detail__guide">
        인정을 취소한 서평입니다. 다시 인정하려면 개별 확인 탭의 서평 인정 이력에서 사유를 남겨
        주세요.
      </p>
    );
  }

  return null;
}

/** 엑셀 한 행의 대조 내용, 서평 원문, 인정 계산을 보여 주고 거리 반영을 처리합니다. */
function ReviewImportDetailPanel({
  row,
  eventId,
  position,
  total,
  busy,
  readOnly,
  feedback = null,
  autoNext,
  onMove,
  onClose,
  onConfirm,
  initialNote = '',
  onNoteChange,
}: ReviewImportDetailPanelProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [candidateId, setCandidateId] = useState(
    () => getDefaultCandidate(row)?.participantBookId ?? 0,
  );
  const [note, setNote] = useState(initialNote);
  const [checked, setChecked] = useState(false);
  const candidate =
    row.candidates.find((item) => item.participantBookId === candidateId) ??
    getDefaultCandidate(row);
  const confirmable = isConfirmableRow(row);
  const needsNote = row.warnings.length > 0;
  const credit = candidate ? getCandidateCredit(candidate) : null;
  const comparisons = getComparisons(row, confirmable ? candidate : undefined);
  const canSubmit =
    confirmable && !readOnly && !busy && !!candidate && checked && (!needsNote || !!note.trim());

  useEffect(() => {
    onNoteChange?.(note);
  }, [note, onNoteChange]);
  // 다른 행으로 바뀌면 제목으로 초점을 옮겨, 화면 낭독기와 키보드 사용자가 새 행에서 시작하게 합니다.
  useEffect(() => {
    heading.current?.focus();
  }, [row.id]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || !candidate) return;

    await onConfirm(row, {
      participantBookId: candidate.participantBookId,
      expectedApprovedPages: candidate.approvedPages,
      expectedUncreditedPages: candidate.uncreditedPages,
      evidenceChecked: checked,
      note: note.trim(),
    });
  };

  const hint = readOnly
    ? '결과가 확정된 회차입니다.'
    : !candidate
      ? '반영할 참가 도서를 선택해 주세요.'
      : needsNote && !note.trim()
        ? '확인 사항에 대한 검토 메모를 남겨 주세요.'
        : !checked
          ? '원문을 확인한 뒤 확인란을 선택해 주세요.'
          : `${formatPages(candidate.uncreditedPages)}을 거리로 반영합니다.`;

  return (
    <form
      className="admin-review-dialog__form admin-review-detail"
      aria-labelledby="reviewImportDetailTitle"
      onSubmit={submit}
    >
      <header className="admin-review-dialog__head">
        <h2 id="reviewImportDetailTitle" ref={heading} tabIndex={-1}>
          서평 대조 상세
        </h2>
        <div className="admin-review-dialog__nav">
          {position !== null && (
            <span className="admin-review-dialog__position">
              {position.toLocaleString('ko-KR')} / {total.toLocaleString('ko-KR')}
            </span>
          )}
          <button
            type="button"
            className="admin-button"
            disabled={position === null || position <= 1 || busy}
            onClick={() => onMove(-1)}
          >
            이전 대상
          </button>
          <button
            type="button"
            className="admin-button"
            disabled={position === null || position >= total || busy}
            onClick={() => onMove(1)}
          >
            다음 대상
          </button>
          {onClose && (
            <button
              type="button"
              className="admin-button admin-review-dialog__close"
              disabled={busy}
              onClick={onClose}
            >
              닫기
            </button>
          )}
        </div>
      </header>

      <div className="admin-review-dialog__body">
        <div className="admin-review-dialog__who">
          <strong>{row.memberName || '이름 없음'}</strong>
          <span>{row.memberNo || '회원번호 없음'}</span>
          <span>엑셀 {row.sourceRow}행</span>
          <ReviewImportStatusBadge status={row.status} />
        </div>
        {position === null && (
          <p className="admin-review-dialog__out">
            현재 보기·검색 조건에 포함되지 않은 행입니다. 이전·다음 이동은 조건 안에서만 가능합니다.
          </p>
        )}
        {feedback && (
          <p
            className={`admin-feedback admin-review-dialog__feedback${feedback.isError ? ' admin-feedback--error' : ''}`}
            role={feedback.isError ? 'alert' : 'status'}
          >
            {feedback.message}
          </p>
        )}
        {row.warnings.length > 0 && (
          <div
            className={`admin-review-detail__warnings${confirmable ? '' : ' is-blocked'}`}
            role="note"
          >
            <strong>{confirmable ? '확인 사항' : '반영할 수 없는 이유'}</strong>
            <ul>
              {row.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <StatusGuide row={row} eventId={eventId} />

        {confirmable && row.candidates.length > 1 && (
          <fieldset className="admin-review-detail__candidates" disabled={busy || readOnly}>
            <legend>반영할 참가 도서</legend>
            {row.candidates.map((item) => (
              <label key={item.participantBookId}>
                <input
                  type="radio"
                  name={`reviewCandidate-${row.id}`}
                  checked={candidate?.participantBookId === item.participantBookId}
                  onChange={() => {
                    setCandidateId(item.participantBookId);
                    setChecked(false);
                  }}
                />
                <span>
                  <strong>{item.bookTitle}</strong>
                  <small>
                    도서 ID {item.libraryBookId} · 승인 {formatPages(item.approvedPages)} · 인정
                    예정 {formatPages(item.uncreditedPages)}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {!confirmable && row.status !== 'EXCLUDED' && (
          <section className="admin-review-detail__section" aria-labelledby="reviewFactsTitle">
            <h3 id="reviewFactsTitle">솔라스 서평 정보</h3>
            <dl className="admin-review-detail__facts">
              <div>
                <dt>회원번호</dt>
                <dd>{row.memberNo || '—'}</dd>
              </div>
              <div>
                <dt>이름</dt>
                <dd>{row.memberName || '—'}</dd>
              </div>
              <div>
                <dt>도서 ID</dt>
                <dd>{row.libraryBookId ?? '—'}</dd>
              </div>
              <div>
                <dt>도서명</dt>
                <dd>{row.bookTitle || '—'}</dd>
              </div>
            </dl>
          </section>
        )}

        {confirmable && (
          <section className="admin-review-detail__section" aria-labelledby="reviewCompareTitle">
            <h3 id="reviewCompareTitle">대조 결과</h3>
            <table className="admin-review-compare">
              <thead>
                <tr>
                  <th scope="col">항목</th>
                  <th scope="col">솔라스 서평</th>
                  <th scope="col">PagePace 기록</th>
                  <th scope="col">
                    <span className="admin-review-compare__sr">대조</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((item) => (
                  <tr key={item.label}>
                    <th scope="row">{item.label}</th>
                    <td>{item.source || '—'}</td>
                    <td>{item.record || '—'}</td>
                    <td>
                      <span className={`admin-review-compare__mark is-${item.mark}`}>
                        {COMPARE_MARK_LABELS[item.mark]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {row.status !== 'EXCLUDED' && (
          <section className="admin-review-detail__section" aria-labelledby="reviewSourceTitle">
            <h3 id="reviewSourceTitle">서평 원문</h3>
            <div className="admin-review-detail__source">
              <div className="admin-review-detail__source-head">
                <strong>{row.reviewTitle || '제목 없음'}</strong>
                <span>최종 수정 {formatSourceTime(row.sourceUpdatedAt)}</span>
              </div>
              {row.bibliographicInfo && (
                <p className="admin-review-detail__biblio">{row.bibliographicInfo}</p>
              )}
              <p className="admin-review-detail__content">{row.content || '본문 없음'}</p>
            </div>
            <p className="admin-review-detail__note">
              최종 수정일은 최초 작성일이 아닙니다. 행사 인정 기간과 함께 확인해 주세요.
            </p>
          </section>
        )}

        {row.verification && (
          <section className="admin-review-detail__section" aria-labelledby="reviewAppliedTitle">
            <h3 id="reviewAppliedTitle">처리 기록</h3>
            <p className="admin-review-detail__applied">
              {row.verification.verifiedBy} · {formatKoDateTime24(row.verification.verifiedAt)} ·{' '}
              {formatPages(row.verification.creditedPages)} (
              {formatMeters(row.verification.creditedDistanceMeter)}) 인정
            </p>
          </section>
        )}

        {confirmable && candidate && credit && (
          <section className="admin-review-detail__section" aria-labelledby="reviewCreditTitle">
            <h3 id="reviewCreditTitle">인정 계산</h3>
            <div className="admin-reviews__equation" aria-label="이번에 인정할 쪽수 계산">
              <div>
                <span>승인 누적</span>
                <strong>{formatPages(credit.approvedPages)}</strong>
              </div>
              <b aria-hidden="true">−</b>
              <div>
                <span>이미 인정</span>
                <strong>{formatPages(credit.alreadyCreditedPages)}</strong>
              </div>
              <b aria-hidden="true">=</b>
              <div className="is-result">
                <span>이번 인정</span>
                <strong>{formatPages(credit.creditPages)}</strong>
              </div>
            </div>
            <div className="admin-reviews__distance">
              <div>
                <span>반영할 거리</span>
                <strong>{formatMeters(credit.creditMeters)}</strong>
              </div>
              <p>
                {formatPages(credit.creditPages)} × {METERS_PER_PAGE}m
                <br />
                같은 책의 이후 승인 일지는 자동으로 반영됩니다.
              </p>
            </div>
            <ApprovedBookLogs
              key={candidate.participantBookId}
              bookId={candidate.participantBookId}
            />
          </section>
        )}

        {confirmable && (
          <section className="admin-review-detail__section" aria-labelledby="reviewConfirmTitle">
            <h3 id="reviewConfirmTitle">검토 메모</h3>
            <label className="admin-review-detail__memo">
              <span>검토 메모 {needsNote ? '(필수)' : '(선택)'}</span>
              <textarea
                aria-label={`엑셀 ${row.sourceRow}행 검토 메모`}
                rows={2}
                maxLength={1000}
                required={needsNote}
                disabled={busy || readOnly}
                placeholder={needsNote ? '예: 판본만 다르고 같은 책임을 확인함' : ''}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </section>
        )}
      </div>

      {confirmable && (
        <footer className="admin-review-dialog__foot">
          <label className="admin-review-dialog__check">
            <input
              type="checkbox"
              checked={checked}
              disabled={busy || readOnly || !candidate}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>
              <strong>원문 확인</strong> 작성자·도서·서평 내용과 행사 인정 기간을 확인했습니다.
            </span>
          </label>
          <p className="admin-review-dialog__hint" aria-live="polite">
            {hint}
          </p>
          {autoNext && (
            <label className="admin-review-dialog__auto">
              <input
                type="checkbox"
                checked={autoNext.checked}
                disabled={busy}
                onChange={(event) => autoNext.onChange(event.target.checked)}
              />
              반영 후 다음 대상으로 이동
            </label>
          )}
          <button
            type="submit"
            className="admin-button admin-button--primary"
            disabled={!canSubmit}
            aria-busy={busy}
          >
            {candidate ? `${formatMeters(candidate.distanceToCreditMeter)} 반영` : '거리 반영'}
          </button>
        </footer>
      )}
    </form>
  );
}

export default ReviewImportDetailPanel;
