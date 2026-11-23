import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { ImportedReview, ReviewConfirmation } from '../../../api/reviewImportApi';
import { METERS_PER_PAGE } from '../../../constants/reading';
import {
  REVIEW_COMPARE_MARK_LABELS,
  formatMeters,
  formatPages,
  formatSourceTime,
  getCandidateCredit,
  getDefaultCandidate,
  getReviewComparisons,
  isConfirmableRow,
} from '../../../types/adminReviewImport';
import { formatKoDateTime24 } from '../../../utils/date';
import ApprovedBookLogs from './ApprovedBookLogs';

type ReviewImportRowDetailProps = {
  row: ImportedReview;
  eventId: number;
  busy: boolean;
  readOnly: boolean;
  onCollapse: () => void;
  onConfirm: (row: ImportedReview, request: ReviewConfirmation) => Promise<void>;
};

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

/**
 * 대조표에서 펼친 한 행의 상세.
 * 왼쪽(근거)에는 확인 사항·항목별 대조·서평 원문을, 오른쪽(판단)에는 인정 계산·확인 항목과
 * 반영 버튼을 둡니다.
 */
function ReviewImportRowDetail({
  row,
  eventId,
  busy,
  readOnly,
  onCollapse,
  onConfirm,
}: ReviewImportRowDetailProps) {
  const [candidateId, setCandidateId] = useState(
    () => getDefaultCandidate(row)?.participantBookId ?? 0,
  );
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const candidate =
    row.candidates.find((item) => item.participantBookId === candidateId) ??
    getDefaultCandidate(row);
  const confirmable = isConfirmableRow(row);
  const needsNote = row.warnings.length > 0;
  const credit = candidate ? getCandidateCredit(candidate) : null;
  const canSubmit =
    confirmable && !readOnly && !busy && !!candidate && checked && (!needsNote || !!note.trim());
  const labelId = `reviewImportDetailTitle-${row.id}`;

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
    <form className="admin-review-detail" aria-labelledby={labelId} onSubmit={submit}>
      <h3 id={labelId} className="admin-review-detail__sr">
        엑셀 {row.sourceRow}행 {row.memberName ?? ''} 검토
      </h3>

      <div className="admin-review-detail__evidence">
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

        {confirmable && (
          <section className="admin-review-detail__section">
            <h4>대조 결과</h4>
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
                {getReviewComparisons(row, candidate).map((item) => (
                  <tr key={item.key}>
                    <th scope="row">{item.label}</th>
                    <td>{item.source || '—'}</td>
                    <td>{item.record || '—'}</td>
                    <td>
                      <span className={`admin-review-compare__mark is-${item.mark}`}>
                        {REVIEW_COMPARE_MARK_LABELS[item.mark]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {row.status !== 'EXCLUDED' && (
          <section className="admin-review-detail__section">
            <h4>서평 원문</h4>
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
      </div>

      <div className="admin-review-detail__decision">
        {!confirmable && row.status !== 'EXCLUDED' && (
          <section className="admin-review-detail__section">
            <h4>솔라스 서평 정보</h4>
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

        {row.verification && (
          <section className="admin-review-detail__section">
            <h4>처리 기록</h4>
            <p className="admin-review-detail__applied">
              {row.verification.verifiedBy} · {formatKoDateTime24(row.verification.verifiedAt)} ·{' '}
              {formatPages(row.verification.creditedPages)} (
              {formatMeters(row.verification.creditedDistanceMeter)}) 인정
            </p>
          </section>
        )}

        {confirmable && candidate && credit && (
          <section className="admin-review-detail__section">
            <h4>인정 계산</h4>
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
          <section className="admin-review-detail__section">
            <h4>확인</h4>
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
            <ul className="admin-checklist">
              <li>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy || readOnly || !candidate}
                    onChange={(event) => setChecked(event.target.checked)}
                  />
                  <strong>원문 확인</strong>
                  <small>작성자·도서·서평 내용과 행사 인정 기간을 확인했습니다.</small>
                </label>
              </li>
            </ul>
          </section>
        )}

        <div className="admin-review-detail__actions">
          {confirmable && <p>{hint}</p>}
          <button type="button" className="admin-button" onClick={onCollapse}>
            접기
          </button>
          {confirmable && (
            <button
              type="submit"
              className="admin-button admin-button--primary"
              disabled={!canSubmit}
              aria-busy={busy}
            >
              {candidate ? `${formatMeters(candidate.distanceToCreditMeter)} 반영` : '거리 반영'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

export default ReviewImportRowDetail;
